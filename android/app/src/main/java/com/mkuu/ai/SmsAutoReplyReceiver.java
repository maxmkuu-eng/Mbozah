package com.mkuu.ai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.telephony.SubscriptionManager;

import androidx.core.content.ContextCompat;
import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_SMS_ENABLED = "smsEnabled";
    private static final String KEY_SELECTED_SIM_SLOT = "selectedSimSlot";
    private static final String KEY_SIM1_SUB_ID = "sim1SubscriptionId";
    private static final String KEY_SIM2_SUB_ID = "sim2SubscriptionId";
    private static final String CONTEXT_PREFIX = "sms_context_";
    private static final String BACKEND_URL = "https://new-1cr3r.faable.link/api/sms/inbound";
    private static final String NOTIFICATION_CHANNEL = "mkuu_sms_received";
    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        final Context appContext = context.getApplicationContext();
        final SharedPreferences prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        if (!prefs.contains(KEY_ENABLED) || !prefs.contains(KEY_SMS_ENABLED) || !prefs.contains(KEY_EMERGENCY_STOP)) {
            prefs.edit().putBoolean(KEY_ENABLED, true).putBoolean(KEY_SMS_ENABLED, true).putBoolean(KEY_EMERGENCY_STOP, false).apply();
        }
        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) return;

        final SmsMessage[] messages;
        try { messages = Telephony.Sms.Intents.getMessagesFromIntent(intent); } catch (Exception ignored) { return; }
        if (messages == null || messages.length == 0) return;

        StringBuilder body = new StringBuilder();
        String sender = "";
        for (SmsMessage sms : messages) {
            if (sms == null) continue;
            if (sender.isEmpty()) sender = sms.getOriginatingAddress();
            String part = sms.getMessageBody();
            if (part != null) body.append(part);
        }
        sender = sender == null ? "" : sender.trim();
        final String message = body.toString().trim();
        if (sender.isEmpty() || message.isEmpty()) return;

        showSmsReceivedNotification(appContext, sender, message);
        if (!isAutoReplyEnabled(prefs)) return;
        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

        final String finalSender = sender;
        final int incomingSubscriptionId = getIncomingSubscriptionId(intent);
        final int outgoingSubscriptionId = chooseOutgoingSubscriptionId(prefs, incomingSubscriptionId);
        final PendingResult pendingResult = goAsync();

        EXECUTOR.execute(() -> {
            try {
                JSONArray history = loadHistory(prefs, finalSender);
                String reply = requestAiReply(appContext, prefs, finalSender, message, history);
                if (reply == null || reply.trim().isEmpty()) throw new IllegalStateException("Empty Gemini reply");
                reply = reply.replace("[[MKUU_ACTION:CONTACT_OWNER]]", "").trim();
                if (reply.isEmpty()) throw new IllegalStateException("Empty cleaned reply");
                if (!isAutoReplyEnabled(prefs)) return;

                sendSms(outgoingSubscriptionId, finalSender, reply);
                saveHistory(prefs, finalSender, message, reply);
                showReplyNotification(appContext, finalSender, reply);
            } catch (Exception ignored) {
                // If the direct fast path fails, hand the same SMS to WorkManager.
                // The Worker retries the real Gemini request; no fake/canned SMS is sent.
                enqueueRetry(appContext, finalSender, message, incomingSubscriptionId);
            } finally {
                pendingResult.finish();
            }
        });
    }

    private static boolean isAutoReplyEnabled(SharedPreferences prefs) {
        return prefs.getBoolean(KEY_ENABLED, true)
                && prefs.getBoolean(KEY_SMS_ENABLED, true)
                && !prefs.getBoolean(KEY_EMERGENCY_STOP, false);
    }

    private static String getApiUrl(SharedPreferences prefs) {
        String custom = prefs.getString("backendUrl", "");
        if (custom != null && custom.trim().startsWith("http")) {
            return custom.trim().replaceAll("/+$", "") + "/api/sms/inbound";
        }
        return BACKEND_URL;
    }

    private static String requestAiReply(Context context, SharedPreferences prefs, String sender, String message, JSONArray history) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(getApiUrl(prefs)).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(25000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            JSONObject payload = new JSONObject();
            payload.put("sender", sender);
            payload.put("message", message);
            payload.put("conversationHistory", history);
            payload.put("contact", findContact(context, sender));
            try (OutputStream out = connection.getOutputStream()) {
                out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null || status < 200 || status >= 300) throw new IllegalStateException("SMS AI HTTP " + status);
            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
            }
            JSONObject json = new JSONObject(response.toString());
            String reply = json.optString("reply", json.optString("generatedReply", "")).trim();
            if (reply.isEmpty()) throw new IllegalStateException("SMS AI returned empty reply");
            return reply;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static JSONObject findContact(Context context, String sender) {
        try {
            JSONArray contacts = ContactInfo.getContacts(context);
            for (int i = 0; i < contacts.length(); i++) {
                JSONObject item = contacts.optJSONObject(i);
                if (item != null && ContactInfo.sameNumber(ContactInfo.normalize(sender), item.optString("normalizedNumber", ""))) {
                    return new JSONObject().put("known", true).put("name", item.optString("name", "")).put("number", item.optString("number", sender));
                }
            }
        } catch (Exception ignored) {}
        try { return new JSONObject().put("known", false).put("name", "").put("number", sender); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    private static JSONArray loadHistory(SharedPreferences prefs, String sender) {
        try { return new JSONArray(prefs.getString(CONTEXT_PREFIX + ContactInfo.normalize(sender), "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private static void saveHistory(SharedPreferences prefs, String sender, String message, String reply) {
        try {
            JSONArray history = loadHistory(prefs, sender);
            history.put(new JSONObject().put("role", "user").put("content", message));
            history.put(new JSONObject().put("role", "assistant").put("content", reply));
            while (history.length() > 12) history.remove(0);
            prefs.edit().putString(CONTEXT_PREFIX + ContactInfo.normalize(sender), history.toString()).apply();
        } catch (Exception ignored) {}
    }

    private static void enqueueRetry(Context context, String sender, String message, int subscriptionId) {
        try {
            Data input = new Data.Builder()
                    .putString(SmsAutoReplyWorker.INPUT_SENDER, sender)
                    .putString(SmsAutoReplyWorker.INPUT_MESSAGE, message)
                    .putInt(SmsAutoReplyWorker.INPUT_SUBSCRIPTION_ID, subscriptionId)
                    .build();
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(SmsAutoReplyWorker.class)
                    .setInputData(input)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .build();
            WorkManager.getInstance(context).enqueue(work);
        } catch (Exception ignored) {}
    }

    private static int getIncomingSubscriptionId(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return SubscriptionManager.INVALID_SUBSCRIPTION_ID;
        int id = extras.getInt("subscription", SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        if (id == SubscriptionManager.INVALID_SUBSCRIPTION_ID) id = extras.getInt(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX, SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        return id;
    }

    private static int chooseOutgoingSubscriptionId(SharedPreferences prefs, int incomingId) {
        String selected = prefs.getString(KEY_SELECTED_SIM_SLOT, "both");
        if ("both".equals(selected)) return incomingId;
        int preferred = "sim1".equals(selected)
                ? prefs.getInt(KEY_SIM1_SUB_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID)
                : prefs.getInt(KEY_SIM2_SUB_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        return preferred != SubscriptionManager.INVALID_SUBSCRIPTION_ID ? preferred : incomingId;
    }

    private static void sendSms(int subscriptionId, String destination, String text) {
        SmsManager manager = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subscriptionId != SubscriptionManager.INVALID_SUBSCRIPTION_ID)
                ? SmsManager.getSmsManagerForSubscriptionId(subscriptionId) : SmsManager.getDefault();
        if (text.length() <= 160) manager.sendTextMessage(destination, null, text, null, null);
        else {
            ArrayList<String> parts = manager.divideMessage(text);
            manager.sendMultipartTextMessage(destination, null, parts, null, null);
        }
    }

    private static void showSmsReceivedNotification(Context context, String sender, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(new NotificationChannel(NOTIFICATION_CHANNEL, "MKUU AI SMS", NotificationManager.IMPORTANCE_HIGH));
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, NOTIFICATION_CHANNEL) : new Notification.Builder(context);
            builder.setSmallIcon(android.R.drawable.sym_action_email).setContentTitle("MKUU AI — SMS mpya imeingia").setContentText(sender + ": " + message).setStyle(new Notification.BigTextStyle().bigText("MKUU AI ameiona SMS mpya kutoka " + sender + "\n\n" + message)).setAutoCancel(true).setPriority(Notification.PRIORITY_HIGH);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception ignored) {}
    }

    private static void showReplyNotification(Context context, String sender, String reply) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(new NotificationChannel("mkuu_sms_reply", "MKUU AI SMS Reply", NotificationManager.IMPORTANCE_DEFAULT));
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, "mkuu_sms_reply") : new Notification.Builder(context);
            builder.setSmallIcon(android.R.drawable.sym_action_email).setContentTitle("MKUU AI — SMS imejibiwa").setContentText("Imemjibu " + sender).setStyle(new Notification.BigTextStyle().bigText("Jibu kwa " + sender + ":\n\n" + reply)).setAutoCancel(true);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception ignored) {}
    }
}
