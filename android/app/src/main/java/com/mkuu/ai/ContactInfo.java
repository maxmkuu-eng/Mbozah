package com.mkuu.ai;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.ContactsContract;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

/** Reads the phone numbers currently stored in the device contacts. */
public final class ContactInfo {
    private ContactInfo() {}

    public static JSONArray getContacts(Context context) {
        JSONArray result = new JSONArray();
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) return result;

        String[] projection = {
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
        };

        Map<String, JSONObject> unique = new LinkedHashMap<>();
        try (Cursor cursor = context.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                null,
                null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE NOCASE ASC")) {
            if (cursor == null) return result;
            int idIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID);
            int nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
            int numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);

            while (cursor.moveToNext()) {
                String name = nameIndex >= 0 ? cursor.getString(nameIndex) : "";
                String number = numberIndex >= 0 ? cursor.getString(numberIndex) : "";
                String normalized = normalize(number);
                if (normalized.isEmpty()) continue;
                String key = normalized;
                if (unique.containsKey(key)) continue;

                JSONObject item = new JSONObject();
                item.put("contactId", idIndex >= 0 ? cursor.getString(idIndex) : "");
                item.put("name", name == null ? "" : name);
                item.put("number", number == null ? "" : number);
                item.put("normalizedNumber", normalized);
                unique.put(key, item);
            }
        } catch (Exception ignored) {
            // Permission/provider/device errors fail closed and return what was read.
        }

        for (JSONObject item : unique.values()) result.put(item);
        return result;
    }

    public static boolean matchesContact(Context context, String incomingNumber) {
        String normalizedIncoming = normalize(incomingNumber);
        if (normalizedIncoming.isEmpty()) return false;
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) return false;

        try (Cursor cursor = context.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},
                null, null, null)) {
            if (cursor == null) return false;
            int numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
            if (numberIndex < 0) return false;
            while (cursor.moveToNext()) {
                if (sameNumber(normalizedIncoming, normalize(cursor.getString(numberIndex)))) return true;
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    public static String normalize(String number) {
        if (number == null) return "";
        return number.replaceAll("[^0-9+]", "");
    }

    public static boolean sameNumber(String a, String b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) return false;
        if (a.equals(b)) return true;
        String da = a.replace("+", "");
        String db = b.replace("+", "");
        if (da.equals(db)) return true;
        if (da.length() >= 9 && db.length() >= 9) {
            return da.substring(da.length() - 9).equals(db.substring(db.length() - 9));
        }
        return false;
    }
}
