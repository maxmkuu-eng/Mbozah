package com.mkuu.ai;

import android.Manifest;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebSettings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int SMS_PERMISSION_REQUEST = 4107;
    private static final int DEVICE_PERMISSION_REQUEST = 4108;
    private DeviceBridge deviceBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings webSettings = getBridge().getWebView().getSettings();
            webSettings.setDomStorageEnabled(true);
            webSettings.setDatabaseEnabled(true);
            deviceBridge = new DeviceBridge(this);
            getBridge().getWebView().addJavascriptInterface(deviceBridge, "MkuuDevice");
        }
        requestDevicePermissions();
        injectAutoReplyNativeSync();
    }

    private void requestDevicePermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

        // Ask for the SMS permissions as their own group first. This avoids OEM
        // permission managers silently skipping SMS when many unrelated permissions
        // are requested in the same dialog.
        java.util.ArrayList<String> smsMissing = new java.util.ArrayList<>();
        String[] sms = new String[]{
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.SEND_SMS
        };
        for (String permission : sms) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                smsMissing.add(permission);
            }
        }
        if (!smsMissing.isEmpty()) {
            ActivityCompat.requestPermissions(this, smsMissing.toArray(new String[0]), SMS_PERMISSION_REQUEST);
            return;
        }

        requestOtherDevicePermissions();
    }

    private void requestOtherDevicePermissions() {
        java.util.ArrayList<String> missing = new java.util.ArrayList<>();
        String[] base = new String[]{
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.READ_PHONE_STATE
        };
        for (String permission : base) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) missing.add(permission);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_NUMBERS) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.READ_PHONE_NUMBERS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!missing.isEmpty()) ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), DEVICE_PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_REQUEST) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted || hasSmsPermissions()) {
                requestOtherDevicePermissions();
            } else {
                showSmsPermissionHelp();
            }
        }
    }

    private boolean hasSmsPermissions() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private void showSmsPermissionHelp() {
        new android.app.AlertDialog.Builder(this)
                .setTitle("Ruhusa za SMS zinahitajika")
                .setMessage("MKUU AI haiwezi kupokea na kujibu SMS bila RECEIVE SMS, READ SMS na SEND SMS. Kama Android imeonyesha ruhusa hii kama Restricted, fungua App info ya MKUU AI na ruhusu mipangilio iliyozuiwa, kisha bonyeza Jaribu tena.")
                .setNegativeButton("Baadaye", null)
                .setPositiveButton("Fungua App info", (dialog, which) -> openAppSettings())
                .setNeutralButton("Jaribu tena", (dialog, which) -> requestDevicePermissions())
                .show();
    }

    private void openAppSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {}
    }

    /** Keeps the existing React UI while synchronizing native SIM/contact and Auto Reply state. */
    private void injectAutoReplyNativeSync() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().postDelayed(this::runNativeSyncScript, 1800);
        getBridge().getWebView().postDelayed(this::runNativeSyncScript, 5000);
        getBridge().getWebView().postDelayed(this::runNativeSyncScript, 10000);
    }

    private void runNativeSyncScript() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String script = "javascript:(function(){" +
                "if(!window.MkuuDevice)return;" +
                "if(window.__mkuuNativeSync)return;window.__mkuuNativeSync=true;" +
                "function syncSims(){try{" +
                "var sims=JSON.parse(window.MkuuDevice.getSims()||'[]');" +
                "function liveNum(i){var s=sims.find(function(v){return v.slotIndex===i});return s&&s.phoneNumber&&s.phoneNumber.trim()?s.phoneNumber.trim():'Namba haijatolewa na SIM';}" +
                "function liveCarrier(i){var s=sims.find(function(v){return v.slotIndex===i});return s&&s.carrierName&&s.carrierName.trim()?s.carrierName.trim():'Mtandao usiojulikana';}" +
                "function scrubSamples(){var nodes=Array.from(document.querySelectorAll('*'));nodes.forEach(function(e){if(e.children.length)return;var t=(e.textContent||'').trim();if(t==='+255 754 889 001')e.textContent=liveNum(1);else if(t==='+255 689 123 456')e.textContent=liveNum(2);else if(t==='Vodacom Tanzania • 4G/5G VoLTE')e.textContent=liveCarrier(1)+' • LIVE SIM';else if(t==='Airtel Tanzania • 4G LTE')e.textContent=liveCarrier(2)+' • LIVE SIM';else if(t==='SIM 1 (Vodacom)')e.textContent=sims.find(function(v){return v.slotIndex===1})?.displayName||'SIM 1';else if(t==='SIM 2 (Airtel)')e.textContent=sims.find(function(v){return v.slotIndex===2})?.displayName||'SIM 2';});}" +
                "scrubSamples();" +
                "var h=Array.from(document.querySelectorAll('*')).find(function(e){return (e.textContent||'').trim()==='SIM Cards Zilizogunduliwa Kwenye Simu:'});" +
                "if(!h||!h.parentElement)return;var box=h.parentElement;var grid=box.children[1];if(!grid)return;" +
                "var html=sims.map(function(s){var n=s.phoneNumber&&s.phoneNumber.trim()?s.phoneNumber:'Namba haijatolewa na SIM';var c=s.carrierName||'Mtandao usiojulikana';var d=s.displayName||('SIM '+s.slotIndex);return '<div class=\\\"p-3.5 rounded-2xl border bg-[#D4AF37]/10 border-[#D4AF37]/50 shadow-md\\\"><div class=\\\"flex items-start justify-between mb-2\\\"><div class=\\\"flex items-center space-x-2\\\"><span class=\\\"w-6 h-6 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[10px] font-bold text-[#D4AF37]\\\">'+s.slotIndex+'</span><div><div class=\\\"text-xs font-bold text-[#F5F2ED] leading-tight\\\">'+d+'</div><div class=\\\"text-[10px] text-[#888888]\\\">'+c+' • LIVE SIM</div></div></div><span class=\\\"w-2 h-2 rounded-full bg-emerald-400 animate-pulse\\\"></span></div><div class=\\\"text-[11px] font-mono text-[#F5F2ED]/90 bg-black/40 px-2.5 py-1 rounded-lg border border-[#222222] flex items-center justify-between\\\"><span>'+n+'</span><span class=\\\"text-[9px] uppercase font-bold text-emerald-400\\\">Active</span></div></div>';}).join('');" +
                "if(!sims.length)html='<div class=\\\"sm:col-span-2 p-4 rounded-2xl bg-[#050505] border border-[#222222] text-xs text-[#888888]\\\">Hakuna SIM iliyoonekana. Hakikisha SIM imewekwa na ruhusa ya Phone State imeruhusiwa.</div>';" +
                "if(grid.getAttribute('data-mkuu-live')!==html){grid.innerHTML=html;grid.setAttribute('data-mkuu-live',html)}" +
                "sims.forEach(function(s){if(s.slotIndex===1)window.MkuuDevice.setSimSubscription('sim1',s.subscriptionId);if(s.slotIndex===2)window.MkuuDevice.setSimSubscription('sim2',s.subscriptionId);});" +
                "var buttons=[['sim-slot-1-btn',1],['sim-slot-2-btn',2]];buttons.forEach(function(x){var b=document.getElementById(x[0]);if(b){var s=sims.find(function(v){return v.slotIndex===x[1]});var sub=b.querySelector('.text-\\[9px\\]');if(sub)sub.textContent=s?(s.carrierName||('SIM '+x[1]))+' • Slot '+x[1]:'SIM '+x[1]+' haipo';}});" +
                "var route=box.parentElement;var existing=document.getElementById('mkuu-native-contacts');if(!existing){existing=document.createElement('div');existing.id='mkuu-native-contacts';existing.className='mt-4 p-4 rounded-2xl bg-[#050505] border border-[#222222]';route.appendChild(existing)}" +
                "var contacts=JSON.parse(window.MkuuDevice.getContacts()||'[]');var contactHtml='<div class=\\\"text-xs font-bold text-[#F5F2ED] mb-2\\\">Namba za kwenye simu (Contacts)</div>'+(contacts.length?'<div class=\\\"space-y-1 max-h-48 overflow-y-auto\\\">'+contacts.slice(0,100).map(function(c){return '<div class=\\\"flex justify-between gap-3 text-[11px] py-1 border-b border-[#222222]\\\"><span class=\\\"text-[#F5F2ED]\\\">'+(c.name||'Bila jina')+'</span><span class=\\\"font-mono text-[#888888]\\\">'+c.number+'</span></div>'}).join('')+'</div>':'<div class=\\\"text-[11px] text-[#888888]\\\">Hakuna namba za contacts zilizosomwa. Ruhusa ya Contacts inahitajika.</div>');if(existing.getAttribute('data-mkuu-contacts')!==contactHtml){existing.innerHTML=contactHtml;existing.setAttribute('data-mkuu-contacts',contactHtml)}" +
                "}catch(e){console.warn('MKUU native SIM sync',e)}}" +
                "function hook(){syncSims();['sim-slot-both-btn','sim-slot-1-btn','sim-slot-2-btn'].forEach(function(id){var b=document.getElementById(id);if(b&&!b.getAttribute('data-mkuu-hook')){b.setAttribute('data-mkuu-hook','1');b.addEventListener('click',function(){window.MkuuDevice.setSelectedSimSlot(id==='sim-slot-1-btn'?'sim1':id==='sim-slot-2-btn'?'sim2':'both')})}})}" +
                "var of=window.fetch;window.fetch=function(){var a=arguments;try{var req=a[1];var u=String(a[0]&&a[0].url||a[0]||'');var method=req&&String(req.method||'GET').toUpperCase();if((u.indexOf('/api/autoreply/settings')>=0||u.indexOf('/api/autoreply/emergency-stop')>=0)&&req&&(method==='POST'||method==='PUT'||method==='PATCH')){var body=req.body;if(typeof body==='string'){var s=JSON.parse(body);var current=JSON.parse(window.MkuuDevice.getAutoReplyState()||'{}');var en=s.enabled!==undefined?!!s.enabled:(s.active!==undefined?!!s.active:!!current.enabled);var es=s.emergencyStop!==undefined?!!s.emergencyStop:(s.stop!==undefined?!!s.stop:!en);window.MkuuDevice.setAutoReplyState(en,es,s.smsEnabled!==undefined?!!s.smsEnabled:en);}}}catch(e){console.warn('MKUU native Auto Reply save',e)}return of.apply(this,a).then(function(r){try{var u=String(a[0]&&a[0].url||a[0]||'');if(u.indexOf('/api/autoreply/settings')>=0||u.indexOf('/api/autoreply/emergency-stop')>=0){r.clone().json().then(function(s){if(s){var en=s.enabled!==undefined?!!s.enabled:(s.active!==undefined?!!s.active:true);var es=s.emergencyStop!==undefined?!!s.emergencyStop:!en;window.MkuuDevice.setAutoReplyState(en,es,s.smsEnabled!==undefined?!!s.smsEnabled:en);}}).catch(function(){})}}catch(e){}return r})};" +
                "hook();setInterval(hook,7000);" +
                "try{window.MkuuDevice.initializeAutoReplyStateIfMissing()}catch(e){}" +
                "})()";
        getBridge().getWebView().evaluateJavascript(script, null);
    }

    @Override
    public void onDestroy() {
        if (deviceBridge != null) {
            deviceBridge.shutdown();
            deviceBridge = null;
        }
        super.onDestroy();
    }
}
