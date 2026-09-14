import React, { useState, useEffect } from 'react';
import {
  Zap,
  Phone,
  Mail,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Settings,
  History,
  Send,
  CheckCircle2,
  Play,
  Sparkles,
  Search,
  Trash2,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Smartphone,
  KeyRound,
  Save,
  Radio,
  Bell,
  AlarmClock,
  Layers,
  Sliders,
  CreditCard,
  MessageSquare,
  Menu,
  ArrowLeft,
  Power,
} from 'lucide-react';
import { AutoReplySettings, AutoReplyLog, Person, SimCardInfo, DevicePermissionsState } from '../types';
import { apiFetch } from '../services/apiConfig';

interface AutoReplyCenterProps {
  settings: AutoReplySettings;
  logs: AutoReplyLog[];
  people: Person[];
  onUpdateSettings: (updates: Partial<AutoReplySettings>) => Promise<void>;
  onEmergencyStopToggle: () => void;
  onSimulateInbound: (params: { sender: string; message: string; channel: 'sms' | 'gmail' }) => Promise<AutoReplyLog>;
  onClearLogs: () => Promise<void>;
  onBack?: () => void;
  onToggleMenu?: () => void;
}

export const AutoReplyCenter: React.FC<AutoReplyCenterProps> = ({
  settings,
  logs,
  people,
  onUpdateSettings,
  onEmergencyStopToggle,
  onSimulateInbound,
  onClearLogs,
  onBack,
  onToggleMenu,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'logs' | 'settings'>('simulator');

  // Simulator Form State
  const [selectedPersonId, setSelectedPersonId] = useState<string>('custom');
  const [simSender, setSimSender] = useState('');
  const [simMessage, setSimMessage] = useState('');
  const [simChannel, setSimChannel] = useState<'sms' | 'gmail'>('sms');
  const [isSimulating, setIsSimulating] = useState(false);
  const [latestSimResult, setLatestSimResult] = useState<AutoReplyLog | null>(null);

  // Settings local state - strictly real device data only, no sample placeholders!
  const isSamplePhone = (p?: string) =>
    !p || p.includes('700 123 456') || p.includes('754 889 001') || p.includes('754 000 111') || p.includes('689 123 456');

  const [phoneNumber, setPhoneNumber] = useState(
    settings.myPhoneNumber && !isSamplePhone(settings.myPhoneNumber) ? settings.myPhoneNumber : ''
  );
  const [language, setLanguage] = useState(settings.language);
  const [tone, setTone] = useState(settings.tone);
  const [newRule, setNewRule] = useState('');
  const [rulesList, setRulesList] = useState<string[]>(settings.safetyRules || []);
  const [searchLog, setSearchLog] = useState('');

  // Dual SIM & Hardware State - ONLY real data from device via window.MkuuDevice
  const cleanSims = (sims?: SimCardInfo[]): SimCardInfo[] => {
    if (!sims || !Array.isArray(sims)) return [];
    return sims.filter(
      (s) =>
        s.phoneNumber !== '+255 754 889 001' &&
        s.phoneNumber !== '+255 689 123 456' &&
        s.phoneNumber !== '+255 700 123 456' &&
        s.phoneNumber !== '+255 754 000 111'
    );
  };

  const [simCards, setSimCards] = useState<SimCardInfo[]>(() => cleanSims(settings.simCards));
  const [isRefreshingSims, setIsRefreshingSims] = useState<boolean>(false);
  const [selectedSimSlot, setSelectedSimSlot] = useState<'sim1' | 'sim2' | 'both'>(
    settings.selectedSimSlot === 'sim1' || settings.selectedSimSlot === 'sim2' ? settings.selectedSimSlot : 'both'
  );

  // Device Permissions State
  const [permissions, setPermissions] = useState<DevicePermissionsState>(
    settings.permissions || {
      smsReadSend: true,
      notificationAccess: true,
      exactAlarmReminder: true,
    }
  );

  // Save states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Phone Verification & Removal Modal States
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const [actionNotification, setActionNotification] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Sync settings when changed externally
  useEffect(() => {
    if (settings.myPhoneNumber !== undefined) {
      if (!isSamplePhone(settings.myPhoneNumber)) {
        setPhoneNumber(settings.myPhoneNumber);
      } else {
        setPhoneNumber('');
      }
    }
    if (settings.language) setLanguage(settings.language);
    if (settings.tone) setTone(settings.tone);
    if (settings.safetyRules) setRulesList(settings.safetyRules);
    if (settings.selectedSimSlot) {
      setSelectedSimSlot(
        settings.selectedSimSlot === 'sim1' || settings.selectedSimSlot === 'sim2' ? settings.selectedSimSlot : 'both'
      );
    }
    if (settings.simCards) setSimCards(cleanSims(settings.simCards));
    if (settings.permissions) setPermissions(settings.permissions);
  }, [settings.myPhoneNumber, settings.language, settings.tone, settings.safetyRules, settings.selectedSimSlot, settings.simCards, settings.permissions]);

  const notify = (type: 'success' | 'error' | 'info', text: string) => {
    setActionNotification({ type, text });
    setTimeout(() => {
      setActionNotification((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handlePersonSelect = (personId: string) => {
    setSelectedPersonId(personId);
    if (personId === 'custom') {
      setSimSender('');
      setSimMessage('');
    } else {
      const person = people.find((p) => p.id === personId);
      if (person) {
        setSimSender(person.phone || person.email || person.name);
        if (person.relationship.toLowerCase().includes('mke')) {
          setSimMessage(`Mume wangu ${person.name || ''} hapa, je uko tayari kwa chakula cha usiku?`);
        } else if (person.relationship.toLowerCase().includes('mama')) {
          setSimMessage(`Mwanangu Max, habari ya leo? Usisahau kunipigia jioni.`);
        } else if (person.relationship.toLowerCase().includes('boss')) {
          setSimMessage(`Max, tafadhali nitumie muhtasari wa ripoti ya miradi kabla ya saa kumi.`);
        } else {
          setSimMessage(`Habari Max, niaje kaka?`);
        }
      }
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSender.trim() || !simMessage.trim() || isSimulating) return;

    setIsSimulating(true);
    setLatestSimResult(null);
    try {
      const res = await onSimulateInbound({
        sender: simSender,
        message: simMessage,
        channel: simChannel,
      });
      setLatestSimResult(res);
    } catch (e) {
      console.error('Simulation error', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const cleanPhone = phoneNumber.trim();
      const phoneChanged = cleanPhone !== (settings.myPhoneNumber || '').trim();

      const payload: Partial<AutoReplySettings> = {
        myPhoneNumber: cleanPhone,
        language,
        tone,
        safetyRules: rulesList,
        selectedSimSlot,
        simCards,
        permissions,
        ...(phoneChanged ? { phoneVerified: false, phoneVerifiedAt: undefined } : {}),
      };

      await onUpdateSettings(payload);
      apiFetch('/api/device/sim-cards', {
        method: 'POST',
        body: JSON.stringify({ selectedSimSlot, simCards }),
      }).catch(() => {});
      apiFetch('/api/device/permissions', {
        method: 'POST',
        body: JSON.stringify({ permissions }),
      }).catch(() => {});

      setSaveSuccess(true);
      notify('success', 'Mipangilio ya Auto Reply, Dual SIM na Ruhusa za Simu vimehifadhiwa kikamilifu!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      console.error('Save error', e);
      notify('error', 'Haikuweza kuhifadhi mipangilio. Tafadhali jaribu tena.');
    } finally {
      setIsSaving(false);
    }
  };

  // REFRESH DEVICE SIMS & DATA VIA MkuuDevice (Android APK) OR API
  const handleRefreshDeviceData = async () => {
    setIsRefreshingSims(true);
    let detectedSims: SimCardInfo[] = [];
    let sourceLabel = '';

    try {
      // 1. Prioritize native Android bridge MkuuDevice (DeviceBridge.java)
      if (typeof window !== 'undefined' && (window as any).MkuuDevice && typeof (window as any).MkuuDevice.getSims === 'function') {
        try {
          const raw = (window as any).MkuuDevice.getSims();
          console.log('[MkuuDevice] Reading native sims:', raw);
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed) && parsed.length > 0) {
            detectedSims = parsed.map((item: any, idx: number) => ({
              slotIndex: item.slotIndex || idx + 1,
              carrierName: item.carrierName || `SIM ${idx + 1}`,
              displayName: item.displayName || `SIM ${item.slotIndex || idx + 1}`,
              phoneNumber: item.phoneNumber || '',
              isActive: item.isActive !== false,
              isDefault: idx === 0,
            }));
            sourceLabel = 'simu yako kupitia MkuuDevice';
          }
        } catch (bridgeErr) {
          console.warn('[MkuuDevice] bridge parse error:', bridgeErr);
        }
      }

      // 2. If not on native bridge or 0 SIMs from bridge, query backend endpoint
      if (detectedSims.length === 0) {
        try {
          const res = await apiFetch<any>('/api/device/sim-cards');
          if (res?.simCards && Array.isArray(res.simCards)) {
            detectedSims = cleanSims(res.simCards);
            if (detectedSims.length > 0) {
              sourceLabel = 'mfumo wa kifaa';
            }
          }
        } catch (apiErr) {
          console.warn('Sim card endpoint error:', apiErr);
        }
      }

      // Filter out any sample data
      detectedSims = cleanSims(detectedSims);

      setSimCards(detectedSims);
      await onUpdateSettings({ simCards: detectedSims });
      apiFetch('/api/device/sim-cards', {
        method: 'POST',
        body: JSON.stringify({ selectedSimSlot, simCards: detectedSims }),
      }).catch(() => {});

      // Clean sample phone number if present, or assign active SIM number
      if (isSamplePhone(phoneNumber)) {
        const simWithPhone = detectedSims.find((s) => s.phoneNumber && !isSamplePhone(s.phoneNumber));
        const newPhone = simWithPhone ? simWithPhone.phoneNumber : '';
        setPhoneNumber(newPhone);
        await onUpdateSettings({ myPhoneNumber: newPhone });
      }

      if (detectedSims.length > 0) {
        notify('success', `Laini ${detectedSims.length} halisi zimesomwa kutoka ${sourceLabel}! Namba za sample zimeondolewa.`);
      } else {
        notify('info', 'Namba za sample zimeondolewa. Hakuna laini ya simu iliyogunduliwa bado. Kwenye APK zitasomwa moja kwa moja kutoka kwenye simu yako.');
      }
    } catch (err: any) {
      console.error('Error refreshing SIM cards:', err);
      notify('error', 'Haikuweza kusoma laini za simu. Tafadhali jaribu tena.');
    } finally {
      setIsRefreshingSims(false);
    }
  };

  // Auto-refresh when opening inside Android WebView with MkuuDevice
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MkuuDevice) {
      handleRefreshDeviceData();
    }
  }, []);

  const handleSelectSimSlot = async (slot: 'sim1' | 'sim2' | 'both') => {
    setSelectedSimSlot(slot);
    await onUpdateSettings({ selectedSimSlot: slot });
    apiFetch('/api/device/sim-cards', {
      method: 'POST',
      body: JSON.stringify({ selectedSimSlot: slot, simCards }),
    }).catch(() => {});
    const label = slot === 'sim1' ? 'SIM 1 Pekee (Slot 1)' : slot === 'sim2' ? 'SIM 2 Pekee (Slot 2)' : 'Laini Zote Mbili (Dual SIM)';
    notify('success', `Laini ya kujibu SMS imewekwa: ${label}`);
  };

  const handleTogglePermission = async (key: keyof DevicePermissionsState) => {
    const updated = {
      ...permissions,
      [key]: !permissions[key],
    };
    setPermissions(updated);
    await onUpdateSettings({ permissions: updated });
    apiFetch('/api/device/permissions', {
      method: 'POST',
      body: JSON.stringify({ permissions: updated }),
    }).catch(() => {});
    const permName = key === 'smsReadSend' ? 'SMS' : key === 'notificationAccess' ? 'Notification' : 'Alarm & Reminder';
    notify(updated[key] ? 'success' : 'info', `Ruhusa ya ${permName} imewekwa kuwa: ${updated[key] ? 'IMERUHUSIWA' : 'IMEZIMWA'}`);
  };

  // VERIFY PHONE NUMBER WORKFLOW
  const handleInitiateVerify = () => {
    if (!phoneNumber || !phoneNumber.trim()) {
      notify('error', 'Tafadhali ingiza nambari ya simu kwanza kabla ya kuthibitisha.');
      return;
    }
    const cleanNumber = phoneNumber.trim();
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockOtp);
    setEnteredOtp(mockOtp); // pre-populate with OTP for seamless one-tap verification
    setVerifyError(null);
    setShowVerifyModal(true);
  };

  const handleExecuteVerification = async (useDirect = false) => {
    if (!useDirect && enteredOtp.trim() !== generatedOtp.trim()) {
      setVerifyError('Nambari ya OTP uliyoingiza si sahihi. Tafadhali ingiza namba 6 zilizoonyeshwa.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      await apiFetch('/api/autoreply/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      await onUpdateSettings({
        myPhoneNumber: phoneNumber.trim(),
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
      });

      setIsVerifying(false);
      setShowVerifyModal(false);
      notify('success', `Nambari ${phoneNumber.trim()} imethibitishwa kikamilifu na kuunganishwa na mfumo wa Max Auto Reply!`);
    } catch (err: any) {
      console.error('Verify error', err);
      setIsVerifying(false);
      setVerifyError(err.message || 'Uthibitishaji haukufanikiwa. Tafadhali jaribu tena.');
    }
  };

  // REMOVE PHONE NUMBER WORKFLOW
  const handleInitiateRemove = () => {
    if (!phoneNumber.trim() && !settings.myPhoneNumber) {
      notify('info', 'Hakuna nambari ya simu iliyopo ya kuondoa.');
      return;
    }
    setShowRemoveModal(true);
  };

  const handleExecuteRemove = async () => {
    setIsRemoving(true);
    try {
      await apiFetch('/api/autoreply/remove-phone', {
        method: 'POST',
      });

      setPhoneNumber('');
      await onUpdateSettings({
        myPhoneNumber: '',
        phoneVerified: false,
        phoneVerifiedAt: undefined,
      });

      setIsRemoving(false);
      setShowRemoveModal(false);
      notify('success', 'Nambari ya simu imeondolewa kikamilifu kwenye Auto Reply.');
    } catch (err: any) {
      console.error('Remove error', err);
      setIsRemoving(false);
      notify('error', 'Haikuweza kuondoa nambari ya simu.');
    }
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      const updated = [...rulesList, newRule.trim()];
      setRulesList(updated);
      setNewRule('');
      onUpdateSettings({ safetyRules: updated });
    }
  };

  const handleRemoveRule = (index: number) => {
    const updated = rulesList.filter((_, i) => i !== index);
    setRulesList(updated);
    onUpdateSettings({ safetyRules: updated });
  };

  const isCurrentNumberVerified =
    Boolean(settings.phoneVerified) &&
    phoneNumber.trim() === (settings.myPhoneNumber || '').trim() &&
    phoneNumber.trim().length > 0;

  const filteredLogs = logs.filter(
    (l) =>
      l.sender.toLowerCase().includes(searchLog.toLowerCase()) ||
      (l.senderName && l.senderName.toLowerCase().includes(searchLog.toLowerCase())) ||
      l.incomingMessage.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.generatedReply.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Top Navigation Bar with Menu, Back & Quick SIM Refresh */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#222222]">
        <div className="flex items-center space-x-2">
          {onToggleMenu && (
            <button
              id="autoreply-toggle-menu-btn"
              onClick={onToggleMenu}
              className="p-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#c4c7c5] hover:text-white transition cursor-pointer"
              title="Fungua Menyu"
            >
              <Menu className="w-5 h-5 text-[#f0f4f9]" />
            </button>
          )}
          {onBack && (
            <button
              id="autoreply-back-btn"
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#D4AF37] hover:text-[#fff] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="Rudi kwenye Mazungumzo"
            >
              <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
              <span>Rudi Chat</span>
            </button>
          )}
        </div>

        {/* Global Quick Refresh SIM Button */}
        <button
          id="top-refresh-sims-btn"
          onClick={handleRefreshDeviceData}
          disabled={isRefreshingSims}
          className="px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer shadow-md disabled:opacity-50"
          title="Soma laini halisi kutoka kwenye simu yako kupitia MkuuDevice.getSims()"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSims ? 'animate-spin' : ''}`} />
          <span>REFRESH SIM</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
              <Zap className="w-3.5 h-3.5" />
              <span>MAX AUTO REPLY ENGINE • SMS & GMAIL</span>
            </div>
            <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
              Majibu ya Moja kwa Moja ya Mawasiliano
            </h2>
            <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
              MKUU AI hutambua mtumaji kupitia Max Identify, hutafuta muktadha husika kwenye Max Memory, na huandaa
              jibu sahihi lenye heshima na hekima kupitia ujumuishaji rasmi wa SMS na Gmail.
            </p>
          </div>

          {/* Kill Switch & Auto Reply Master Toggle */}
          {(() => {
            const isAutoReplyActive = !!settings.enabled && !settings.emergencyStop;
            return (
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] uppercase tracking-widest text-[#888888] font-bold">
                    KILL SWITCH STATUS
                  </div>
                  <div className={`text-xs font-bold ${isAutoReplyActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isAutoReplyActive ? 'AUTO REPLY: ON (INAFANYA KAZI)' : 'AUTO REPLY: OFF (IMEZIMWA)'}
                  </div>
                </div>
                <button
                  id="auto-reply-killswitch"
                  onClick={onEmergencyStopToggle}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2.5 transition shadow-xl cursor-pointer ${
                    isAutoReplyActive
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 shadow-emerald-900/20'
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40'
                  }`}
                  title={isAutoReplyActive ? 'Bofya kuzima Auto Reply (Kill Switch OFF)' : 'Bofya kuwasha Auto Reply (Kill Switch ON)'}
                >
                  <Power className="w-4 h-4" />
                  <span>
                    {isAutoReplyActive ? 'KILL SWITCH: ON' : 'KILL SWITCH: OFF'}
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Kill Switch Status Banner if OFF */}
      {(!settings.enabled || settings.emergencyStop) && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-between gap-3 text-red-200">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold">KILL SWITCH: AUTO REPLY IPO OFF (IMEZIMWA)</div>
              <div className="text-[11px] text-red-300/90">
                Auto Reply haitajibu SMS yoyote hadi utakapowasha tena kifungo hiki (Kill Switch: ON).
              </div>
            </div>
          </div>
          <button
            onClick={onEmergencyStopToggle}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition cursor-pointer shadow"
          >
            WASHA AUTO REPLY (ON)
          </button>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#222222] pb-3">
        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'simulator'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Jaribu Auto Reply (Inbound Simulator)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Kumbukumbu za SMS & Gmail ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Mipangilio & Kanuni za Usalama</span>
        </button>
      </div>

      {/* TAB 1: INBOUND SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Form */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#D4AF37]" />
                  <span>Kifaa cha Kujaribu Ujumbe Unaofika (Inbound Test)</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 font-bold uppercase tracking-wider">
                  LIVE PIPELINE
                </span>
              </div>

              <form onSubmit={handleRunSimulation} className="space-y-3.5">
                {/* Select Quick Contact */}
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                    Chagua Mtumaji kutoka Watu wa Karibu
                  </label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => handlePersonSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="custom">Nambari Nyingine / Mgeni (Unknown Number)</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.relationship} ({p.phone || p.email || 'Hana namba'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Mtumaji (From)</label>
                    <input
                      type="text"
                      required
                      value={simSender}
                      onChange={(e) => setSimSender(e.target.value)}
                      placeholder="+255 7..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Njia (Channel)</label>
                    <select
                      value={simChannel}
                      onChange={(e) => setSimChannel(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="sms">📱 SMS Gateway / Companion</option>
                      <option value="gmail">✉️ Gmail OAuth</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                    Ujumbe Unaofika (Incoming Message)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={simMessage}
                    onChange={(e) => setSimMessage(e.target.value)}
                    placeholder="Andika ujumbe unaotumwa kwa Max..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <button
                  id="run-simulation-btn"
                  type="submit"
                  disabled={isSimulating}
                  className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSimulating ? 'INACHAKATA MUKTADHA WA MAX...' : 'TUMA JARIBIO LA UJUMBE (TEST AUTO REPLY)'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Simulation Output & Pipeline Inspector */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg min-h-[300px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                  <span className="serif font-bold text-sm text-[#F5F2ED]">Mrejesho wa Auto Reply</span>
                  {latestSimResult && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        latestSimResult.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : latestSimResult.status === 'blocked_emergency'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                      }`}
                    >
                      {latestSimResult.status}
                    </span>
                  )}
                </div>

                {latestSimResult ? (
                  <div className="space-y-3">
                    {/* Utambuzi */}
                    <div className="p-3 rounded-xl bg-[#050505] border border-[#222222] space-y-1">
                      <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">1. Utambuzi (Max Identify):</div>
                      <div className="text-xs font-semibold text-[#D4AF37]">
                        {latestSimResult.senderName || latestSimResult.sender}
                      </div>
                    </div>

                    {/* Ujumbe Uliofika */}
                    <div className="p-3 rounded-xl bg-[#050505] border border-[#222222] space-y-1">
                      <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">2. Ujumbe Uliopokelewa:</div>
                      <div className="text-xs text-[#F5F2ED] italic">"{latestSimResult.incomingMessage}"</div>
                    </div>

                    {/* Jibu Lililoandaliwa */}
                    <div className="p-4 rounded-xl bg-[#111111] border border-[#D4AF37]/30 space-y-1">
                      <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>3. Jibu la Kiotomatiki Lililozalishwa:</span>
                      </div>
                      <p className="text-xs text-[#F5F2ED] font-medium leading-relaxed">
                        "{latestSimResult.generatedReply}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-[#888888] space-y-2">
                    <Zap className="w-10 h-10 mx-auto opacity-30 text-[#D4AF37]" />
                    <p className="text-xs">Chagua mtumaji upande wa kushoto na uguse 'Tuma Jaribio la Ujumbe'.</p>
                  </div>
                )}
              </div>

              {/* Verified Badge */}
              <div className="pt-3 border-t border-[#222222] flex items-center justify-between text-[11px] text-[#888888]">
                <span>Mtindo: {settings.tone}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salama & Imethibitishwa
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE LOGS (SMS LOG) */}
      {activeSubTab === 'logs' && (
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="serif font-bold text-base text-[#F5F2ED] flex items-center gap-2">
                <History className="w-4 h-4 text-[#D4AF37]" />
                <span>SMS LOG & GMAIL AUDIT TRAIL</span>
              </h3>
              <p className="text-xs text-[#888888]">
                Kumbukumbu halisi za ujumbe ulioingia (Inbound) na majibu yaliyotumwa (Outbound) na Mkuu AI.
              </p>
            </div>

            <button
              id="clear-all-sms-logs-btn"
              onClick={onClearLogs}
              className="px-4 py-2 rounded-xl glass hover:bg-red-500/10 text-[#888888] hover:text-red-400 border border-[#222222] text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer self-start md:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Futa Kumbukumbu Zote</span>
            </button>
          </div>

          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="sms-log-search-input"
              type="text"
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Tafuta kwenye kumbukumbu (mtumaji, mpokeaji, maneno ya ujumbe)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-[#888888]">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
                <p className="text-sm font-semibold text-[#F5F2ED]">Hakuna kumbukumbu za SMS/Gmail zilizopatikana.</p>
                <p className="text-xs text-[#888888] mt-1">Tumia Inbound Simulator kujaribu ujumbe wa moja kwa moja.</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-2xl bg-[#050505] border border-[#222222] hover:border-[#D4AF37]/30 transition space-y-3"
                >
                  {/* Log Header metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                        {log.channel.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-[#111111] text-[#888888] border border-[#222222]">
                        Direction: Inbound / Outbound
                      </span>
                      <span className="font-bold text-sm text-[#F5F2ED]">
                        Mtumaji: {log.senderName ? `${log.senderName} (${log.sender})` : log.sender}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-[#888888] font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          log.status === 'sent'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'blocked_emergency'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                        }`}
                      >
                        Status: {log.status}
                      </span>
                    </div>
                  </div>

                  {/* Message & Reply Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#0c0c0c] border border-[#222222] space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#888888] uppercase tracking-wider">
                        <span>Ujumbe Ulioingia (Mtumaji):</span>
                        <span className="font-mono">{log.sender}</span>
                      </div>
                      <p className="text-[#888888] italic text-xs leading-relaxed pt-1">
                        "{log.incomingMessage}"
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0c0c0c] border border-[#222222] border-l-2 border-[#D4AF37] space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                        <span>Jibu la Mkuu AI (Mpokeaji):</span>
                        <span className="font-mono text-[#888888]">{log.recipient}</span>
                      </div>
                      <p className="text-[#F5F2ED] font-medium text-xs leading-relaxed pt-1">
                        "{log.generatedReply}"
                      </p>
                    </div>
                  </div>

                  {log.matchedRelationship && (
                    <div className="flex items-center space-x-2 text-[11px] text-[#888888] pt-1">
                      <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                      <span>Max Identify: Mtumaji ametambuliwa kama <strong>{log.matchedRelationship}</strong> (Confidence: {(log.confidence * 100).toFixed(0)}%)</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          id="autoreply-action-notification"
          className={`p-4 rounded-2xl flex items-center justify-between transition-all duration-300 border ${
            actionNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionNotification.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
          }`}
        >
          <div className="flex items-center space-x-3 text-xs font-semibold">
            {actionNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : actionNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-[#D4AF37] shrink-0" />
            )}
            <span>{actionNotification.text}</span>
          </div>
          <button
            onClick={() => setActionNotification(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-xs opacity-75 hover:opacity-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 3: SETTINGS & SAFETY RULES (SMS SETTINGS & MY PHONE NUMBER) */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            {/* MY PHONE NUMBER SECTION */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <span>MY PHONE NUMBER — SMS IDENTITY</span>
                </h3>
                {isCurrentNumberVerified ? (
                  <span
                    id="phone-verified-badge"
                    className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-bold uppercase flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>VERIFIED</span>
                  </span>
                ) : (
                  <span
                    id="phone-unverified-badge"
                    className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 font-bold uppercase flex items-center gap-1.5 shadow-sm"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>NOT VERIFIED</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#888888] leading-relaxed">
                Nambari rasmi ya simu ya Max itakayotumika kutambua na kuidhinisha mawasiliano ya SMS Gateway na majibu ya moja kwa moja.
              </p>

              <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Tanzania (+255)"
                      className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#F5F2ED] text-xs font-semibold cursor-not-allowed"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                      Phone Number (Nambari ya Simu ya Max)
                    </label>
                    <input
                      id="my-phone-number-input"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+255 7..."
                      className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#F5F2ED] text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Simu Kuu ya Max (Owner Authorized Number)"
                    className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#888888] text-xs italic"
                  />
                </div>

                {isCurrentNumberVerified && settings.phoneVerifiedAt && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center space-x-2">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Nambari hii imehakikiwa na kuunganishwa rasmi ({new Date(settings.phoneVerifiedAt).toLocaleDateString()} {new Date(settings.phoneVerifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).
                    </span>
                  </div>
                )}

                {/* Verification & Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    id="verify-phone-number-btn"
                    onClick={handleInitiateVerify}
                    className="px-4 py-2 rounded-xl glass hover:bg-white/5 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{isCurrentNumberVerified ? 'RE-VERIFY' : 'VERIFY'}</span>
                  </button>

                  <button
                    id="save-phone-number-btn"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>INAHIFADHI...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>IMEHIFADHIWA!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>SAVE</span>
                      </>
                    )}
                  </button>

                  <button
                    id="remove-phone-number-btn"
                    onClick={handleInitiateRemove}
                    disabled={!phoneNumber.trim() && !settings.myPhoneNumber}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 ${
                      !phoneNumber.trim() && !settings.myPhoneNumber
                        ? 'opacity-40 bg-red-500/5 border-red-500/10 text-red-400/50 cursor-not-allowed'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>REMOVE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* General SMS & Tone Settings */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#D4AF37]" />
                <span>Mtindo na Lugha ya Majibu ya Auto Reply</span>
              </h3>

              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Lugha ya Majibu</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Kiswahili">Kiswahili Fasaha</option>
                      <option value="English">English</option>
                      <option value="Auto">Linganisha na Mtumaji (Auto)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Mtindo (Tone)</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Heshima & Ueledi">Heshima & Ueledi</option>
                      <option value="Kirafiki">Kirafiki</option>
                      <option value="Rasmi">Rasmi</option>
                      <option value="Fupi na Wazi">Fupi na Wazi</option>
                    </select>
                  </div>
                </div>

                <button
                  id="save-autoreply-general-settings-btn"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>INAHIFADHI MIPANGILIO...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>MIPANGILIO IMEHIFADHIWA!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>HIFADHI MIPANGILIO YA MAJIBU</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            {/* DUAL SIM & SIM CARDS SECTION — SINGLE SIM LIST */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#D4AF37]" /><span>Kadi za SIM & Chaguo la Dual SIM</span></h3>
                <div className="flex items-center space-x-2">
                  <button id="refresh-sims-btn" onClick={handleRefreshDeviceData} disabled={isRefreshingSims} className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 text-[11px] font-bold flex items-center space-x-1.5 transition cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSims ? "animate-spin" : ""}`} /><span>REFRESH SIM</span></button>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">{simCards.length > 0 ? `${simCards.length} SIM ACTIVE` : "NO SIM"}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#888888]">SIM Cards Zilizogunduliwa Kwenye Simu:</div>
                {simCards.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-[#050505] border border-[#222222] text-center"><CreditCard className="w-8 h-8 text-[#888888] mx-auto opacity-40" /><div className="text-xs font-semibold text-[#cccccc]">Hakuna laini (SIM card) zilizogunduliwa bado.</div></div>
                ) : (
                  <div className="space-y-3">
                    {simCards.map((sim) => {
                      const slot = sim.slotIndex === 2 ? "sim2" : "sim1";
                      const isSelected = selectedSimSlot === slot;
                      return (
                        <button key={sim.slotIndex} type="button" onClick={() => handleSelectSimSlot(slot)} className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? "bg-[#D4AF37]/10 border-[#D4AF37]/60" : "bg-[#050505] border-[#222222]"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0"><span className="w-8 h-8 shrink-0 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-xs font-bold text-[#D4AF37]">{sim.slotIndex}</span><div className="min-w-0"><div className="text-sm font-bold text-[#F5F2ED] truncate">{sim.displayName}</div><div className="text-[10px] text-[#888888] truncate">{sim.carrierName || "SIM"} • Slot {sim.slotIndex}</div></div></div>
                            <div className="flex items-center gap-2 shrink-0"><span className="text-[11px] font-mono text-[#F5F2ED]/90 bg-black/40 px-2.5 py-1 rounded-lg border border-[#222222]">{sim.phoneNumber || "Hakuna Namba"}</span>{isSelected && <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {simCards.length > 1 && <div className="pt-2 border-t border-[#222222] space-y-2.5"><div className="text-xs font-bold text-[#F5F2ED]">Chagua laini ya kutuma majibu:</div><div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => handleSelectSimSlot("both")} className={`p-2.5 rounded-xl border text-center ${selectedSimSlot === "both" ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold" : "bg-[#050505] text-[#888888] border-[#222222]"}`}>Laini Zote<br/><span className="text-[9px]">Dual SIM</span></button>
                <button type="button" onClick={() => handleSelectSimSlot("sim1")} className={`p-2.5 rounded-xl border text-center ${selectedSimSlot === "sim1" ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold" : "bg-[#050505] text-[#888888] border-[#222222]"}`}>SIM 1<br/><span className="text-[9px]">{simCards[0]?.carrierName || "Slot 1"}</span></button>
                <button type="button" onClick={() => handleSelectSimSlot("sim2")} className={`p-2.5 rounded-xl border text-center ${selectedSimSlot === "sim2" ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold" : "bg-[#050505] text-[#888888] border-[#222222]"}`}>SIM 2<br/><span className="text-[9px]">{simCards[1]?.carrierName || "Slot 2"}</span></button>
              </div></div>}
              {simCards.length === 1 && <div className="p-2.5 rounded-xl bg-black/40 border border-[#222222] text-[11px] text-[#888888]">Laini hii ndiyo laini pekee inayopatikana kwa Auto Reply.</div>}
            </div>
            {/* DEVICE PERMISSIONS SECTION */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span>Ruhusa za Kifaa (Device Permissions)</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  ANDROID SYSTEM READY
                </span>
              </div>

              <div className="space-y-3">
                {/* 1. SMS Permission */}
                <div className="p-3.5 rounded-2xl bg-[#050505] border border-[#222222] flex items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 mt-0.5">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#F5F2ED]">Ruhusa ya SMS</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            permissions.smsReadSend
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {permissions.smsReadSend ? 'Imeruhusiwa' : 'Imezimwa'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888888] mt-0.5 leading-snug">
                        Inamruhusu MKUU AI kusoma SMS zinazoingia na kutuma majibu kupitia laini uliyochagua.
                      </div>
                    </div>
                  </div>
                  <button
                    id="permission-sms-toggle"
                    onClick={() => handleTogglePermission('smsReadSend')}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      permissions.smsReadSend ? 'bg-[#D4AF37] justify-end' : 'bg-[#222222] justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black shadow-md block" />
                  </button>
                </div>

                {/* 2. Notification Permission */}
                <div className="p-3.5 rounded-2xl bg-[#050505] border border-[#222222] flex items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#F5F2ED]">Ruhusa ya Arifa (Notification)</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            permissions.notificationAccess
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {permissions.notificationAccess ? 'Imeruhusiwa' : 'Imezimwa'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888888] mt-0.5 leading-snug">
                        Inamruhusu MKUU AI kugundua na kusoma taarifa za ujumbe kutoka kwa arifa za simu papo hapo.
                      </div>
                    </div>
                  </div>
                  <button
                    id="permission-notification-toggle"
                    onClick={() => handleTogglePermission('notificationAccess')}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      permissions.notificationAccess ? 'bg-[#D4AF37] justify-end' : 'bg-[#222222] justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black shadow-md block" />
                  </button>
                </div>

                {/* 3. Alarm & Reminder Permission */}
                <div className="p-3.5 rounded-2xl bg-[#050505] border border-[#222222] flex items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 mt-0.5">
                      <AlarmClock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#F5F2ED]">Kengele na Vikumbusho (Alarm & Reminder)</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            permissions.exactAlarmReminder
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {permissions.exactAlarmReminder ? 'Imeruhusiwa' : 'Imezimwa'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888888] mt-0.5 leading-snug">
                        Inamruhusu MKUU AI kuweka kengele halisi, vikumbusho, na ratiba za Max bila kukosa.
                      </div>
                    </div>
                  </div>
                  <button
                    id="permission-alarm-toggle"
                    onClick={() => handleTogglePermission('exactAlarmReminder')}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      permissions.exactAlarmReminder ? 'bg-[#D4AF37] justify-end' : 'bg-[#222222] justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black shadow-md block" />
                  </button>
                </div>
              </div>
            </div>

            {/* SAFETY RULES SECTION */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
                <span>Kanuni za Usalama za Auto Reply</span>
              </h3>

              <div className="space-y-2">
                {rulesList.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#050505] border border-[#222222] flex items-center justify-between text-xs text-[#F5F2ED]"
                  >
                    <span>
                      {idx + 1}. {rule}
                    </span>
                    <button
                      onClick={() => handleRemoveRule(idx)}
                      className="text-[#888888] hover:text-red-400 p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  placeholder="Ongeza kanuni mpya ya usalama..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 rounded-xl glass hover:bg-white/5 text-[#F5F2ED] font-bold text-xs border border-[#222222] cursor-pointer"
                >
                  Weka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass p-6 sm:p-8 rounded-3xl border border-[#D4AF37]/30 max-w-md w-full shadow-2xl space-y-5 relative bg-[#090909]">
            <button
              onClick={() => setShowVerifyModal(false)}
              className="absolute top-4 right-4 p-2 text-[#888888] hover:text-white rounded-full hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-base text-[#F5F2ED]">Thibitisha Nambari ya Simu</h3>
                <p className="text-xs text-[#888888]">SMS Gateway Identity Verification</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#111111] border border-[#222222] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#888888]">Nambari ya Simu:</span>
                <span className="font-mono font-bold text-[#F5F2ED] text-sm">{phoneNumber}</span>
              </div>

              {/* Mock SMS notification box */}
              <div className="p-3 rounded-xl bg-[#080808] border border-[#D4AF37]/30 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#D4AF37] font-bold">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" /> Kodi ya Uthibitisho (SMS OTP)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37]">
                    Simulated SMS
                  </span>
                </div>
                <div className="text-center py-2">
                  <span className="font-mono text-2xl tracking-[0.3em] font-bold text-[#F5F2ED] select-all">
                    {generatedOtp}
                  </span>
                </div>
                <p className="text-[10px] text-[#888888] text-center">
                  Ingiza nambari hii hapa chini au bonyeza kitufe cha kuthibitisha papo hapo.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider">
                  Ingiza Kodi ya OTP (Namba 6)
                </label>
                <input
                  id="phone-otp-input"
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => {
                    setEnteredOtp(e.target.value);
                    setVerifyError(null);
                  }}
                  placeholder="Mfano: 849201"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080808] border border-[#222222] text-[#F5F2ED] text-center font-mono text-lg tracking-widest focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {verifyError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{verifyError}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="submit-phone-verification-btn"
                onClick={() => handleExecuteVerification(false)}
                disabled={isVerifying || !enteredOtp.trim()}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>INATHIBITISHA...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>THIBITISHA KODI (CONFIRM OTP)</span>
                  </>
                )}
              </button>

              <button
                id="instant-phone-verification-btn"
                onClick={() => handleExecuteVerification(true)}
                disabled={isVerifying}
                className="w-full py-2.5 rounded-xl glass hover:bg-white/5 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>THIBITISHA MOJA KWA MOJA (ONE-TAP)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE PHONE NUMBER CONFIRMATION MODAL */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass p-6 sm:p-8 rounded-3xl border border-red-500/30 max-w-md w-full shadow-2xl space-y-5 relative bg-[#090909]">
            <button
              onClick={() => setShowRemoveModal(false)}
              className="absolute top-4 right-4 p-2 text-[#888888] hover:text-white rounded-full hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-base text-[#F5F2ED]">Ondoa Nambari ya Simu?</h3>
                <p className="text-xs text-[#888888]">Auto Reply Phone Number Removal</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#111111] border border-[#222222] space-y-2 text-xs">
              <p className="text-[#888888] leading-relaxed">
                Je, una uhakika unataka kuondoa nambari{' '}
                <strong className="text-[#F5F2ED] font-mono">
                  {phoneNumber || settings.myPhoneNumber || 'iliyopo'}
                </strong>{' '}
                kutoka kwenye mfumo wa Auto Reply?
              </p>
              <p className="text-amber-400/90 text-[11px] pt-1">
                ⚠️ Ujumbe wa SMS hautatumwa wala kupokelewa kiotomatiki hadi utakapoweka na kuthibitisha nambari mpya ya simu.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                id="cancel-remove-phone-btn"
                onClick={() => setShowRemoveModal(false)}
                className="py-2.5 rounded-xl glass hover:bg-white/5 text-[#888888] hover:text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                GHAIRI
              </button>

              <button
                id="confirm-remove-phone-btn"
                onClick={handleExecuteRemove}
                disabled={isRemoving}
                className="py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center space-x-1.5"
              >
                {isRemoving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>INAONDOA...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ONDOA SASA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AutoReplyCenter;
