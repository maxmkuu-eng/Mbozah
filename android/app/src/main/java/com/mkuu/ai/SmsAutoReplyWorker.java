package com.mkuu.ai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

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

public class SmsAutoReplyWorker extends Worker {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_SMS_ENABLED = "smsEnabled";
    private static final String KEY_SELECTED_SIM_SLOT = "selectedSimSlot";
    private static final String KEY_SIM1_SUB_ID = "sim1SubscriptionId";
    private static final String KEY_SIM2_SUB_ID = "sim2SubscriptionId";
    private static final String CONTEXT_PREFIX = "sms_context_";
    private static final String BACKEND_URL = "https://new-1cr3r.faable.link/api/sms/inbound";
    private static final String REMINDER_URL = "https://new-1cr3r.faable.link/api/manager/reminders";
    private static final String NOTIFICATION_CHANNEL = "mkuu_auto_reply_actions";
    public static final String INPUT_SENDER = "sender";
    public static final String INPUT_MESSAGE = "message";
    public static final String INPUT_SUBSCRIPTION_ID = "subscriptionId";

    public SmsAutoReplyWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        // The receiver already identified a real incoming SMS. Do not require a
        // contact match here: every sender is eligible for Auto Reply.
        String sender = getInputData().getString(INPUT_SENDER);
        String message = getInputData().getString(INPUT_MESSAGE);
        int incomingSubscriptionId = getInputData().getInt(INPUT_SUBSCRIPTION_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        if (sender == null || message == null || sender.trim().isEmpty() || message.trim().isEmpty()) return Result.failure();
        sender = sender.trim();
        message = message.trim();

        if (!isEnabled(prefs)) return Result.success();
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return Result.failure();

        int outgoingSubscriptionId = chooseOutgoingSubscriptionId(prefs, incomingSubscriptionId);
        String recipient = findSimNumber(context, outgoingSubscriptionId);
        try {
            JSONArray history = loadConversationHistory(prefs, sender);
            JSONObject contact = findContact(context, sender);

            // This is the ONLY AI route for SMS. It is the dedicated backend path
            // that calls Gemini 3.8 Flash and deliberately bypasses AXA/live search.
            String reply = requestAiReply(prefs, sender, message, recipient, history, contact);
            String action = extractAction(reply);
            reply = stripActionMarker(reply);
            if (reply == null || reply.trim().isEmpty()) return Result.retry();
            if (!isEnabled(prefs)) return Result.success();

            sendSms(outgoingSubscriptionId, sender, reply.trim());
            saveConversationTurn(prefs, sender, message, reply.trim());
            showReplyStatusNotification(context, sender, reply.trim());
            if (isEnabled(prefs) && !"NONE".equals(action)) {
                createManagerReminder(sender, message, action);
                if (isEnabled(prefs)) showActionNotification(context, sender, message);
            }
            return Result.success();
        } catch (Exception ignored) {
            // Never send a fake acknowledgement. Let WorkManager retry the real
            // Gemini request so the actual incoming SMS can still receive an answer.
            return Result.retry();
        }
    }

    private static boolean isEnabled(SharedPreferences prefs) {
        return prefs.getBoolean(KEY_ENABLED, true) && prefs.getBoolean(KEY_SMS_ENABLED, true) && !prefs.getBoolean(KEY_EMERGENCY_STOP, false);
    }
    private static int chooseOutgoingSubscriptionId(SharedPreferences prefs, int incomingId) {
        String selected = prefs.getString(KEY_SELECTED_SIM_SLOT, "both");
        if ("both".equals(selected)) return incomingId;
        int preferred = "sim1".equals(selected) ? prefs.getInt(KEY_SIM1_SUB_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID) : prefs.getInt(KEY_SIM2_SUB_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        return preferred != SubscriptionManager.INVALID_SUBSCRIPTION_ID ? preferred : incomingId;
    }
    private static String findSimNumber(Context context, int subscriptionId) {
        List<SimInfo> sims = SimInfo.getActiveSims(context);
        for (SimInfo sim : sims) if (subscriptionId == sim.subscriptionId && sim.number != null && !sim.number.trim().isEmpty()) return sim.number.trim();
        return "";
    }

    private static JSONObject findContact(Context context, String sender) {
        try {
            JSONArray contacts = ContactInfo.getContacts(context);
            for (int i = 0; i < contacts.length(); i++) {
                JSONObject item = contacts.optJSONObject(i);
                if (item == null) continue;
                if (ContactInfo.sameNumber(ContactInfo.normalize(sender), item.optString("normalizedNumber", ""))) {
                    return new JSONObject().put("known", true).put("name", item.optString("name", "")).put("number", item.optString("number", sender));
                }
            }
        } catch (Exception ignored) {}
        try { return new JSONObject().put("known", false).put("name", "").put("number", sender); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    private static String getApiUrl(SharedPreferences prefs) {
        String custom = prefs.getString("backendUrl", "");
        if (custom != null && custom.trim().startsWith("http")) {
            return custom.trim().replaceAll("/+$", "") + "/api/sms/inbound";
        }
        return BACKEND_URL;
    }

    private static String requestAiReply(SharedPreferences prefs, String sender, String message, String recipient, JSONArray history, JSONObject contact) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(getApiUrl(prefs)).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(30000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            JSONObject payload = new JSONObject();
            payload.put("sender", sender);
            payload.put("message", message);
            payload.put("conversationHistory", history);
            payload.put("contact", contact);
            try (OutputStream out = connection.getOutputStream()) { out.write(payload.toString().getBytes(StandardCharsets.UTF_8)); }
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null || status < 200 || status >= 300) throw new IllegalStateException("SMS AI HTTP " + status);
            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = reader.readLine()) != null) response.append(line); }
            JSONObject json = new JSONObject(response.toString());
            String reply = json.optString("reply", json.optString("generatedReply", "")).trim();
            if (reply.isEmpty()) throw new IllegalStateException("SMS AI returned empty reply");
            return reply;
        } finally { if (connection != null) connection.disconnect(); }
    }

    private static String contextKey(String sender) { return CONTEXT_PREFIX + ContactInfo.normalize(sender); }
    private static JSONArray loadConversationHistory(SharedPreferences prefs, String sender) {
        try { return new JSONArray(prefs.getString(contextKey(sender), "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
    private static void saveConversationTurn(SharedPreferences prefs, String sender, String message, String reply) {
        try {
            JSONArray history = loadConversationHistory(prefs, sender);
            history.put(new JSONObject().put("role", "user").put("content", message));
            history.put(new JSONObject().put("role", "assistant").put("content", reply));
            int maxItems = 12;
            while (history.length() > maxItems) history.remove(0);
            prefs.edit().putString(contextKey(sender), history.toString()).apply();
        } catch (Exception ignored) {}
    }
    private static String extractAction(String reply) { return reply != null && reply.contains("[[MKUU_ACTION:CONTACT_OWNER]]") ? "CONTACT_OWNER" : "NONE"; }
    private static String stripActionMarker(String reply) { return reply == null ? "" : reply.replace("[[MKUU_ACTION:CONTACT_OWNER]]", "").trim(); }
    private static void createManagerReminder(String sender, String message, String action) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(REMINDER_URL).openConnection(); connection.setRequestMethod("POST"); connection.setConnectTimeout(5000); connection.setReadTimeout(8000); connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            JSONObject payload = new JSONObject(); payload.put("title", "MKUU AI: Mtu anataka uwasiliane naye — " + sender); payload.put("remindAt", new java.util.Date().toInstant().toString()); payload.put("repeat", "none"); payload.put("enabled", true);
            try (OutputStream out = connection.getOutputStream()) { out.write(payload.toString().getBytes(StandardCharsets.UTF_8)); }
            connection.getResponseCode();
        } catch (Exception ignored) {} finally { if (connection != null) connection.disconnect(); }
    }
    private static void showReplyStatusNotification(Context context, String sender, String reply) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE); if (manager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(new NotificationChannel(NOTIFICATION_CHANNEL, "MKUU AI Auto Reply Actions", NotificationManager.IMPORTANCE_HIGH));
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, NOTIFICATION_CHANNEL) : new Notification.Builder(context);
            builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("MKUU AI — SMS imejibiwa").setContentText("Imemjibu " + sender).setStyle(new Notification.BigTextStyle().bigText("MKUU AI amemjibu " + sender + "\n\n" + reply)).setAutoCancel(true).setPriority(Notification.PRIORITY_HIGH);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception ignored) {}
    }
    private static void showActionNotification(Context context, String sender, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE); if (manager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(new NotificationChannel(NOTIFICATION_CHANNEL, "MKUU AI Auto Reply Actions", NotificationManager.IMPORTANCE_HIGH));
            String body = "Anataka uwasiliane naye. Ujumbe: " + message;
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, NOTIFICATION_CHANNEL) : new Notification.Builder(context);
            builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("MKUU AI — Ujumbe wa kufuatilia").setContentText(sender + ": " + body).setStyle(new Notification.BigTextStyle().bigText(sender + "\n\n" + body)).setAutoCancel(true).setPriority(Notification.PRIORITY_HIGH);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception ignored) {}
    }
    private static void sendSms(int subscriptionId, String destination, String text) {
        SmsManager manager = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subscriptionId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) ? SmsManager.getSmsManagerForSubscriptionId(subscriptionId) : SmsManager.getDefault();
        if (text.length() <= 160) manager.sendTextMessage(destination, null, text, null, null);
        else { ArrayList<String> parts = manager.divideMessage(text); manager.sendMultipartTextMessage(destination, null, parts, null, null); }
    }
}
