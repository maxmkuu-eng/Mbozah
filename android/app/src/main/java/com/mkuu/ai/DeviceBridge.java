package com.mkuu.ai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.webkit.JavascriptInterface;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** JavaScript bridge exposing device features, Auto Reply settings, and native TTS. */
public final class DeviceBridge {
    private static final String PREFS = "mkuu_autoreply";
    private final Context context;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    public DeviceBridge(Context context) {
        this.context = context.getApplicationContext();
        try {
            this.tts = new TextToSpeech(this.context, status -> {
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true;
                    try {
                        Locale swahili = new Locale("sw", "TZ");
                        int res = tts.setLanguage(swahili);
                        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.getDefault());
                        }
                    } catch (Exception ignored) {}
                }
            });
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public boolean speak(String text, String lang) {
        if (tts == null || !ttsReady || text == null || text.trim().isEmpty()) return false;
        try {
            if ("sw".equalsIgnoreCase(lang) || "sw-tz".equalsIgnoreCase(lang)) {
                Locale swahili = new Locale("sw", "TZ");
                int res = tts.setLanguage(swahili);
                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.getDefault());
                }
            } else {
                tts.setLanguage(Locale.US);
            }
            tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "mkuu_tts_" + System.currentTimeMillis());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void stopSpeaking() {
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
        }
    }

    @JavascriptInterface
    public boolean isSpeaking() {
        return tts != null && tts.isSpeaking();
    }

    @JavascriptInterface
    public void setBackendUrl(String url) {
        if (url != null && !url.trim().isEmpty()) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString("backendUrl", url.trim())
                    .apply();
        }
    }

    @JavascriptInterface
    public String getBackendUrl() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString("backendUrl", "https://new-1cr3r.faable.link");
    }

    public void shutdown() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
            ttsReady = false;
        }
    }

    @JavascriptInterface
    public String getSims() {
        JSONArray result = new JSONArray();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return result.toString();
        SubscriptionManager manager = context.getSystemService(SubscriptionManager.class);
        if (manager == null) return result.toString();
        try {
            List<SubscriptionInfo> list = manager.getActiveSubscriptionInfoList();
            if (list == null) return result.toString();
            List<SubscriptionInfo> sorted = new ArrayList<>(list);
            Collections.sort(sorted, Comparator.comparingInt(SubscriptionInfo::getSimSlotIndex));
            for (SubscriptionInfo info : sorted) {
                String number = "";
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED ||
                        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        try {
                            String platformNumber = manager.getPhoneNumber(info.getSubscriptionId());
                            if (platformNumber != null) number = platformNumber;
                        } catch (SecurityException ignored) {}
                    }
                    if (number.trim().isEmpty()) {
                        try {
                            String legacyNumber = info.getNumber();
                            if (legacyNumber != null) number = legacyNumber;
                        } catch (SecurityException ignored) {}
                    }
                    if (number.trim().isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        try {
                            TelephonyManager tm = context.getSystemService(TelephonyManager.class);
                            if (tm != null) {
                                String line = tm.createForSubscriptionId(info.getSubscriptionId()).getLine1Number();
                                if (line != null) number = line;
                            }
                        } catch (SecurityException ignored) {}
                    }
                }
                CharSequence carrier = info.getCarrierName();
                CharSequence display = info.getDisplayName();
                try {
                    JSONObject item = new JSONObject();
                    item.put("subscriptionId", info.getSubscriptionId());
                    item.put("slotIndex", info.getSimSlotIndex() + 1);
                    item.put("displayName", display == null ? "SIM " + (info.getSimSlotIndex() + 1) : display.toString());
                    item.put("carrierName", carrier == null ? "" : carrier.toString());
                    item.put("phoneNumber", number == null ? "" : number.trim());
                    item.put("isActive", true);
                    result.put(item);
                } catch (JSONException ignored) {}
            }
        } catch (SecurityException ignored) {}
        return result.toString();
    }

    @JavascriptInterface
    public String getContacts() { return ContactInfo.getContacts(context).toString(); }

    @JavascriptInterface
    public String getSelectedSimSlot() { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("selectedSimSlot", "both"); }

    @JavascriptInterface
    public void setSelectedSimSlot(String slot) {
        if (!"sim1".equals(slot) && !"sim2".equals(slot) && !"both".equals(slot)) slot = "both";
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("selectedSimSlot", slot).apply();
    }

    @JavascriptInterface
    public void setSimSubscription(String slot, int subscriptionId) {
        if ("sim1".equals(slot)) context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("sim1SubscriptionId", subscriptionId).apply();
        if ("sim2".equals(slot)) context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("sim2SubscriptionId", subscriptionId).apply();
    }

    @JavascriptInterface
    public void setAutoReplyState(boolean enabled, boolean emergencyStop, boolean smsEnabled) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("enabled", enabled)
                .putBoolean("emergencyStop", emergencyStop)
                .putBoolean("smsEnabled", smsEnabled)
                .apply();
    }

    @JavascriptInterface
    public String getAutoReplyState() {
        android.content.SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject out = new JSONObject();
        try {
            out.put("enabled", p.getBoolean("enabled", true));
            out.put("smsEnabled", p.getBoolean("smsEnabled", true));
            out.put("emergencyStop", p.getBoolean("emergencyStop", false));
            out.put("active", p.getBoolean("enabled", true) && !p.getBoolean("emergencyStop", false));
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public boolean showNotification(String title, String body) {
        if (title == null || body == null) return false;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return false;
            String channelId = "mkuu_reminders";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(channelId, "MKUU AI Reminders & Alarms", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Taarifa za vikumbusho na alarm za Max");
                channel.enableVibration(true);
                manager.createNotificationChannel(channel);
            }
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, channelId) : new Notification.Builder(context);
            builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
                   .setContentTitle(title)
                   .setContentText(body)
                   .setStyle(new Notification.BigTextStyle().bigText(body))
                   .setAutoCancel(true)
                   .setPriority(Notification.PRIORITY_HIGH);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void initializeAutoReplyStateIfMissing() {
        android.content.SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        // The React UI ships with Auto Reply enabled. Keep the native receiver in
        // the same initial state so an incoming SMS is not silently ignored before
        // the first settings save reaches the native bridge.
        android.content.SharedPreferences.Editor editor = p.edit();
        if (!p.contains("enabled")) editor.putBoolean("enabled", true);
        if (!p.contains("smsEnabled")) editor.putBoolean("smsEnabled", true);
        if (!p.contains("emergencyStop")) editor.putBoolean("emergencyStop", false);
        editor.apply();
    }

    @JavascriptInterface
    public String getPermissionState() {
        JSONObject out = new JSONObject();
        try {
            out.put("contacts", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED);
            out.put("phoneState", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED);
            out.put("phoneNumbers", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED);
            out.put("receiveSms", ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED);
            out.put("sendSms", ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED);
        } catch (Exception ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public boolean saveMediaFile(String base64Data, String filename, String mimeType) {
        try {
            if (base64Data == null || base64Data.trim().isEmpty()) return false;
            String clean = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
            byte[] bytes = android.util.Base64.decode(clean, android.util.Base64.DEFAULT);
            if (bytes == null || bytes.length == 0) return false;

            String safeName = (filename != null && !filename.trim().isEmpty()) ? filename.trim() : ("mkuu_file_" + System.currentTimeMillis());
            String safeMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType.trim() : "image/png";
            boolean isImage = safeMime.startsWith("image/");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, safeMime);
                values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, isImage ? android.os.Environment.DIRECTORY_PICTURES + "/MKUU_AI" : android.os.Environment.DIRECTORY_DOWNLOADS + "/MKUU_AI");

                android.net.Uri uri = context.getContentResolver().insert(
                    isImage ? android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI : android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    values
                );
                if (uri != null) {
                    try (java.io.OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(bytes);
                            os.flush();
                        }
                    }
                }
            } else {
                java.io.File dir = android.os.Environment.getExternalStoragePublicDirectory(
                    isImage ? android.os.Environment.DIRECTORY_PICTURES : android.os.Environment.DIRECTORY_DOWNLOADS
                );
                if (!dir.exists()) dir.mkdirs();
                java.io.File file = new java.io.File(dir, safeName);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) {
                    fos.write(bytes);
                    fos.flush();
                }
                android.media.MediaScannerConnection.scanFile(context, new String[]{file.getAbsolutePath()}, new String[]{safeMime}, null);
            }

            android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
            handler.post(() -> android.widget.Toast.makeText(context, "Picha imehifadhiwa kwenye simu: " + safeName, android.widget.Toast.LENGTH_LONG).show());
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}