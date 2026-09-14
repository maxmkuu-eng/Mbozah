package com.mkuu.ai;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Native SIM information used by Auto Reply / Dual SIM UI. */
public final class SimInfo {
    public final int subscriptionId;
    public final int slotIndex;
    public final String displayName;
    public final String number;
    public final String carrierName;

    public SimInfo(int subscriptionId, int slotIndex, String displayName, String number, String carrierName) {
        this.subscriptionId = subscriptionId;
        this.slotIndex = slotIndex;
        this.displayName = displayName;
        this.number = number;
        this.carrierName = carrierName;
    }

    public static List<SimInfo> getActiveSims(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return Collections.emptyList();
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
                != PackageManager.PERMISSION_GRANTED) return Collections.emptyList();

        SubscriptionManager manager = context.getSystemService(SubscriptionManager.class);
        if (manager == null) return Collections.emptyList();

        try {
            List<SubscriptionInfo> subscriptions = manager.getActiveSubscriptionInfoList();
            if (subscriptions == null) return Collections.emptyList();

            List<SimInfo> result = new ArrayList<>();
            for (SubscriptionInfo info : subscriptions) {
                String number = info.getNumber();
                if (number == null) number = "";
                CharSequence carrier = info.getCarrierName();
                CharSequence name = info.getDisplayName();
                result.add(new SimInfo(
                        info.getSubscriptionId(),
                        info.getSimSlotIndex(),
                        name == null ? "SIM " + (info.getSimSlotIndex() + 1) : name.toString(),
                        number,
                        carrier == null ? "" : carrier.toString()
                ));
            }
            return result;
        } catch (SecurityException ignored) {
            return Collections.emptyList();
        }
    }

    private SimInfo() {
        this(SubscriptionManager.INVALID_SUBSCRIPTION_ID, -1, "", "", "");
    }
}
