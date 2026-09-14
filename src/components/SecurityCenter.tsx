import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Crown,
  Key,
  Download,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cpu,
  Server,
  Globe,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Menu,
  ArrowLeft,
  Image as ImageIcon,
  Rocket,
  Copy,
  Check,
  Eye,
  EyeOff,
  Layers,
  Wand2,
} from 'lucide-react';
import { UserProfile, Memory, Person, AutoReplySettings, LiveStreamSettings } from '../types';
import { getStoredGeminiApiKey, setStoredGeminiApiKey } from '../services/aiEngine';
import { GeminiLiveSettingsModal } from './GeminiLiveSettingsModal';
import {
  getStoredLiveStreamSettings,
  saveStoredLiveStreamSettings,
} from '../services/liveStreamConfig';
import {
  getRemoteServerUrl,
  setRemoteServerUrl,
  isCapacitorNative,
  getApiUrl,
  PRODUCTION_API_BASE_URL,
  checkServerReachability,
  getStoredMagicHourApiKey,
  setStoredMagicHourApiKey,
  FAABLE_DEPLOY_URL,
  FAABLE_HEALTH_URL,
  FAABLE_STATUS_URL,
  FAABLE_CONSOLE_URL,
  FAABLE_DOCS_URL,
} from '../services/apiConfig';

interface SecurityCenterProps {
  user: UserProfile | null;
  memories: Memory[];
  people: Person[];
  autoReplySettings: AutoReplySettings;
  onExportAllData: () => void;
  onUpdatePin: (newPin: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
  onBack?: () => void;
  onToggleMenu?: () => void;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({
  user,
  memories,
  people,
  autoReplySettings,
  onExportAllData,
  onUpdatePin,
  onClearAllData,
  onBack,
  onToggleMenu,
}) => {
  const [pin, setPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Connection & API Key Configuration State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [magicHourApiKey, setMagicHourApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [magicHourKeySaved, setMagicHourKeySaved] = useState(false);
  const [showMagicHourKey, setShowMagicHourKey] = useState(false);
  const [serverUrlSaved, setServerUrlSaved] = useState(false);
  const [copiedFaableKey, setCopiedFaableKey] = useState<string | null>(null);
  const [faableCheck, setFaableCheck] = useState<{ status: 'idle' | 'checking' | 'online' | 'offline'; message: string }>({
    status: 'idle',
    message: '',
  });

  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  // Gemini Live Stream Settings State
  const [isGeminiSettingsOpen, setIsGeminiSettingsOpen] = useState(false);
  const [liveStreamSettings, setLiveStreamSettings] = useState<LiveStreamSettings>(getStoredLiveStreamSettings());

  // Backend Health / Architecture Status State
  const [systemStatus, setSystemStatus] = useState<{
    aiProvider: string;
    chatModel: string;
    backend: string;
    status: string;
    imageModel?: string;
    latencyMs?: number;
  }>({
    aiProvider: 'Mkuu AI',
    chatModel: 'Mkuu AI Engine',
    backend: 'MKUU Server',
    status: 'connected',
    imageModel: 'Magic Hour Studio',
  });

  useEffect(() => {
    setGeminiApiKey(getStoredGeminiApiKey());
    setMagicHourApiKey(getStoredMagicHourApiKey());
    setServerUrl(getRemoteServerUrl());

    // Fetch live backend health and architecture status
    fetch(getApiUrl('/api/status'))
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setSystemStatus({
            aiProvider: data.aiProvider || 'Mkuu AI',
            chatModel: data.chatModel || 'Mkuu AI Engine',
            backend: data.backend || 'MKUU Server',
            status: data.status || 'connected',
            imageModel: data.imageModel || 'Magic Hour Studio',
            latencyMs: data.latencyMs,
          });
        }
      })
      .catch((err) => {
        console.warn('Status fetch note:', err);
      });
  }, []);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 4) return;
    await onUpdatePin(pin.trim());
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
    setPin('');
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGeminiApiKey(geminiApiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 3000);
  };

  const handleSaveMagicHourKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredMagicHourApiKey(magicHourApiKey);
    setMagicHourKeySaved(true);
    setTimeout(() => setMagicHourKeySaved(false), 3000);
  };

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setRemoteServerUrl(serverUrl);
    setServerUrlSaved(true);
    setTimeout(() => setServerUrlSaved(false), 3000);
  };

  const handleCopyLink = async (text: string, keyName: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedFaableKey(keyName);
      setTimeout(() => setCopiedFaableKey(null), 2500);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const handleCheckFaableHealth = async () => {
    setFaableCheck({ status: 'checking', message: 'Inakagua afya ya seva ya Faable...' });
    try {
      const res = await fetch(FAABLE_HEALTH_URL, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setFaableCheck({
          status: 'online',
          message: `Faable ipo hewani na inafanya kazi kikamilifu! (Status: ${data.status || 'ok'})`,
        });
      } else {
        setFaableCheck({
          status: 'offline',
          message: `Faable ilijibu kwa msimbo HTTP ${res.status}.`,
        });
      }
    } catch (err: any) {
      setFaableCheck({
        status: 'offline',
        message: `Haikuweza kuunganishwa na Faable: ${err.message || 'Seva haipatikani'}. Hakikisha kifaa chako kipo mtandaoni.`,
      });
    }
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing', message: 'Inajaribu muunganisho wa Mkuu AI...' });

    // 1. Test Live Production Backend Server (/health)
    try {
      const healthCheck = await checkServerReachability();
      if (healthCheck.reachable) {
        setTestResult({
          status: 'success',
          message: `Muunganisho wa MKUU Production Server umethibitishwa (${healthCheck.latencyMs}ms)!`,
        });
        return;
      }
    } catch (err: any) {
      console.warn('Backend test connection error:', err);
    }

    // 2. Test Direct API Key if present
    const key = geminiApiKey.trim() || getStoredGeminiApiKey();
    if (key) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Sema jambo' }] }],
          }),
        });

        if (res.ok) {
          setTestResult({
            status: 'success',
            message: 'Muunganisho wa Moja kwa Moja na Mkuu AI umethibitishwa kwa 100%!',
          });
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
      } catch (err: any) {
        setTestResult({
          status: 'error',
          message: `Hitilafu ya Key: ${err.message}`,
        });
        return;
      }
    }

    // 3. If unreachable
    setTestResult({
      status: 'error',
      message: 'Seva ya MKUU haipatikani kwa sasa. Tafadhali hakikisha kifaa chako kimeunganishwa kwenye intaneti kisha ujaribu tena.',
    });
  };

  const isNative = isCapacitorNative();
  const hasDirectKey = !!geminiApiKey.trim();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Top Navigation Bar with Menu & Back to Chat */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#222222]">
        <div className="flex items-center space-x-2">
          {onToggleMenu && (
            <button
              id="security-toggle-menu-btn"
              onClick={onToggleMenu}
              className="p-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#c4c7c5] hover:text-white transition cursor-pointer"
              title="Fungua Menyu"
            >
              <Menu className="w-5 h-5 text-[#f0f4f9]" />
            </button>
          )}
          {onBack && (
            <button
              id="security-back-btn"
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#D4AF37] hover:text-[#fff] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="Rudi kwenye Mazungumzo"
            >
              <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
              <span>Rudi Chat</span>
            </button>
          )}
        </div>

        <button
          id="security-quick-export-btn"
          onClick={onExportAllData}
          className="px-3.5 py-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#D4AF37] text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>BACKUP DATA</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MAX SECURITY VAULT & PRIVACY SHIELD</span>
          </div>
          <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
            Ulinzi wa Faragha na Udhibiti wa Mmiliki (Max)
          </h2>
          <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
            Data zote za Max Memory, Watu wa Karibu, na Auto Reply zimehifadhiwa kwa usalama wa kiwango cha juu ndani ya kifaa chako.
          </p>
        </div>
      </div>

      {/* EXPLICIT ARCHITECTURE & BACKEND SYSTEM STATUS CARD */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] bg-[#0c0c0c] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1f1f1f]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                  MKUU AI Backend & Architecture Status
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wider">
                  Live System
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Ripoti rasmi ya mfumo wa MKUU App, MKUU Backend Server, na Mkuu AI Engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {systemStatus.status === 'connected' ? 'Connected' : 'Active'}
            </span>
          </div>
        </div>

        {/* System Architecture Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">AI PROVIDER</span>
            <span className="text-sm font-bold text-[#D4AF37] font-mono block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {systemStatus.aiProvider || 'Mkuu AI'}
            </span>
            <span className="text-[10px] text-[#666666] block">Mkuu AI Engine (Kiswahili)</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">LIVE SEARCH ENGINE</span>
            <span className="text-sm font-bold text-emerald-400 font-mono block flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              AXA Live Web Search
            </span>
            <span className="text-[10px] text-[#666666] block">Utafutaji Halisi wa Mtandao</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">BACKEND SERVER</span>
            <span className="text-sm font-bold text-amber-400 font-mono block flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              {systemStatus.backend || 'MKUU Server'}
            </span>
            <span className="text-[10px] text-[#666666] block">Dedicated Mkuu Core & DB</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">IMAGE STUDIO SERVICE</span>
            <span className="text-sm font-bold text-purple-400 font-mono block flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              {systemStatus.imageModel || 'Magic Hour Studio'}
            </span>
            <span className="text-[10px] text-[#666666] block">Magic Hour Studio Engine</span>
          </div>
        </div>

        {/* Visual Architectural Diagram */}
        <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-3">
          <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
            REQUEST PIPELINE FLOW (ARCHITECTURE)
          </span>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#F5F2ED]">
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-[#D4AF37]">
              MKUU AI APP (APK/WEB)
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-emerald-400">
              MKUU BACKEND
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-purple-400">
              Magic Hour Studio (Images)
            </div>
            <span className="text-[#666666]">|</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-emerald-400">
              AXA (Live Search)
            </div>
            <span className="text-[#666666]">|</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 font-bold text-[#D4AF37]">
              Mkuu AI (Chat)
            </div>
          </div>
        </div>
      </div>

      {/* VIUNGO VYA FAABLE (FAABLE DEPLOYMENT LINKS) CARD */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-emerald-500 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f1f1f]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                  Viungo vya Faable (Faable Deployment Links)
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Viungo rasmi na amri za kupeleka mfumo wa MKUU AI hewani kwenye huduma ya Faable Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckFaableHealth}
              disabled={faableCheck.status === 'checking'}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${faableCheck.status === 'checking' ? 'animate-spin' : ''}`} />
              <span>Kagua Afya ya Faable</span>
            </button>
          </div>
        </div>

        {faableCheck.message && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
              faableCheck.status === 'online'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : faableCheck.status === 'checking'
                ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                : 'bg-red-950/60 border border-red-500/40 text-red-300'
            }`}
          >
            {faableCheck.status === 'online' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{faableCheck.message}</span>
          </div>
        )}

        {/* Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* 1. Production URL */}
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                TOVUTI RASMI YA UZALISHAJI (LIVE APP)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                Primary
              </span>
            </div>
            <div className="font-mono text-xs text-[#F5F2ED] truncate font-semibold">
              {FAABLE_DEPLOY_URL}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={FAABLE_DEPLOY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Fungua Tovuti</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopyLink(FAABLE_DEPLOY_URL, 'deploy')}
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
              >
                {copiedFaableKey === 'deploy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFaableKey === 'deploy' ? 'Imenakiliwa' : 'Nakili'}</span>
              </button>
            </div>
          </div>

          {/* 2. Health Endpoint */}
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                KIKAGUZI CHA AFYA (HEALTH CHECK)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-[#aaaaaa] font-mono">
                GET /health
              </span>
            </div>
            <div className="font-mono text-xs text-[#F5F2ED] truncate font-semibold">
              {FAABLE_HEALTH_URL}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={FAABLE_HEALTH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Kagua JSON</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopyLink(FAABLE_HEALTH_URL, 'health')}
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
              >
                {copiedFaableKey === 'health' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFaableKey === 'health' ? 'Imenakiliwa' : 'Nakili'}</span>
              </button>
            </div>
          </div>

          {/* 3. Status API */}
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                HALI YA ARCHITECTURE (STATUS API)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-[#aaaaaa] font-mono">
                GET /api/status
              </span>
            </div>
            <div className="font-mono text-xs text-[#F5F2ED] truncate font-semibold">
              {FAABLE_STATUS_URL}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={FAABLE_STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Tazama Hali</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopyLink(FAABLE_STATUS_URL, 'status')}
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
              >
                {copiedFaableKey === 'status' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFaableKey === 'status' ? 'Imenakiliwa' : 'Nakili'}</span>
              </button>
            </div>
          </div>

          {/* 4. Faable Console & Deploy Guide */}
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                FAABLE DASHBOARD & CLI
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-[#aaaaaa] font-mono">
                faable.json
              </span>
            </div>
            <div className="font-mono text-xs text-[#F5F2ED] truncate font-semibold">
              {FAABLE_CONSOLE_URL}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={FAABLE_CONSOLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Fungua Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopyLink('faable deploy', 'cli')}
                className="px-3 py-1.5 rounded-xl bg-[#151515] hover:bg-[#222222] text-[#F5F2ED] border border-[#333333] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
              >
                {copiedFaableKey === 'cli' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFaableKey === 'cli' ? 'faable deploy' : 'Nakili CLI'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Deploy Explanation Banner */}
        <div className="p-4 rounded-2xl bg-[#080a0f] border border-[#1b263b] text-xs text-[#8e95a2] space-y-2">
          <div className="font-semibold text-[#f0f4f9] flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-emerald-400" />
            <span>Mwongozo wa Ku-deploy kwenye Faable:</span>
          </div>
          <p className="leading-relaxed">
            Faili la <code className="text-emerald-400 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-[#222]">faable.json</code> limeandaliwa tayari kwa amri ya uzalishaji ya <code className="text-[#D4AF37] font-mono bg-black/40 px-1.5 py-0.5 rounded border border-[#222]">npm run build && node server.ts</code>. Unaweza kuunganisha mradi huu moja kwa moja kwenye akaunti yako ya Faable na kubofya <strong className="text-white">Deploy</strong>.
          </p>
        </div>
      </div>

      {/* MAGIC HOUR STUDIO (APK & WEB) CARD */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-purple-400 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f1f1f]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                  Studio ya Picha ya Magic Hour Studio (Image Studio kwa APK &amp; Web)
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold border border-purple-500/30">
                  Android APK Ready
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Inaauni utengenezaji na uhariri wa picha kwa ubora wa juu kupitia Magic Hour Studio ndani ya simu ya APK na mtandaoni.
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Magic Hour Studio Imeunganishwa
            </span>
          </div>
        </div>

        {/* Magic Hour Studio Image Info & Supported Features */}
        <div className="p-4 rounded-2xl bg-[#050505] border border-purple-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Magic Hour Studio (Provider Rasmi wa Picha kwa APK &amp; Web)
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-medium font-mono">
              {magicHourApiKey ? 'Key Imehifadhiwa' : 'Inatumia Seva / Inasubiri Key'}
            </span>
          </div>
          <p className="text-[11px] text-[#888888] leading-relaxed">
            Huduma ya picha inatumia <strong>Magic Hour Studio</strong> ndani ya APK na mtandaoni. Unaweza kuweka API Key yako hapa chini au kuitegemea kutoka kwenye usanidi wa seva (<code>MAGIC_HOUR_API_KEY</code>).
          </p>

          {/* 6 Core Capabilities requested for APK */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">1. Text to Image</span>
              <span className="text-[10px] text-[#777777]">Uundaji wa picha mpya kutoka maandishi</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">2. Remove Background</span>
              <span className="text-[10px] text-[#777777]">Kuondoa mandharinyuma (Transparent PNG)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">3. Make HD Picture</span>
              <span className="text-[10px] text-[#777777]">Kuboresha picha kuwa 4K/HD na kuongeza ukali</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">4. Create Cartoon</span>
              <span className="text-[10px] text-[#777777]">Picha au picha ya mtu kuwa katuni ya 3D</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">5. Create HD Logo</span>
              <span className="text-[10px] text-[#777777]">Uundaji wa nembo safi ya biashara (1:1)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-purple-900/30">
              <span className="text-[10px] font-bold text-purple-300 block">6. Create Banners</span>
              <span className="text-[10px] text-[#777777]">Mabango na matangazo ya mtandaoni (16:9)</span>
            </div>
          </div>
        </div>

        {/* Magic Hour API Key Direct Input Form */}
        <form onSubmit={handleSaveMagicHourKey} className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              Magic Hour Studio API Key (Kwa Simu ya APK &amp; Web)
            </label>
            <a
              href="https://magichour.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#888888] hover:text-purple-400 flex items-center gap-1 transition underline"
            >
              <span>Pata API Key ya Magic Hour</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={showMagicHourKey ? 'text' : 'password'}
                value={magicHourApiKey}
                onChange={(e) => setMagicHourApiKey(e.target.value)}
                placeholder="Weka Magic Hour API Key (mht_... au token yako)"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#050505] border border-purple-950/60 focus:border-purple-500 text-[#F5F2ED] placeholder-[#666666] text-xs focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowMagicHourKey(!showMagicHourKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-purple-300 transition"
              >
                {showMagicHourKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 shadow-lg shadow-purple-900/30"
            >
              HIFADHI KEY YA MAGIC HOUR
            </button>
          </div>

          {magicHourKeySaved && (
            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>API Key ya Magic Hour Studio imehifadhiwa salama kwenye simu yako!</span>
            </div>
          )}
        </form>
      </div>

      {/* GEMINI LIVE STREAM & ANIMATION FX CARD */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-[#4E88FF] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f1f1f]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#4E88FF]/20 via-[#9B72CF]/20 to-[#D4AF37]/20 text-[#4E88FF] border border-[#4E88FF]/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                  Gemini Live Stream &amp; Uhuishaji (Animation FX)
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#4E88FF]/15 text-[#4E88FF] font-bold border border-[#4E88FF]/30">
                  LIVE STREAM READY
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Athari za Visual za Gemini, mtiririko wa sauti usiokatika, na persona za Google Gemini Live.
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              id="security-open-gemini-settings-btn"
              onClick={() => setIsGeminiSettingsOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#4E88FF] to-[#9B72CF] hover:from-[#4176e0] hover:to-[#8961b8] text-white font-bold text-xs flex items-center space-x-2 transition cursor-pointer shadow-lg shadow-[#4E88FF]/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sanidi Mipangilio ya Gemini Live</span>
            </button>
          </div>
        </div>

        {/* Current Active Configuration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#08090d] border border-[#20222a] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#888888]">Athari ya Uhuishaji:</span>
            <div className="text-xs font-semibold text-white capitalize flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4E88FF] animate-pulse" />
              <span>
                {liveStreamSettings.visualEffect === 'fluid_orb'
                  ? 'Gemini Fluid Orb (Asili)'
                  : liveStreamSettings.visualEffect === 'aurora_wave'
                  ? 'Quantum Aurora Waves'
                  : liveStreamSettings.visualEffect === 'radiant_star'
                  ? 'Radiant Gemini Star'
                  : 'Kinetic Spectrum Bars'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#08090d] border border-[#20222a] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#888888]">Sauti ya Gemini:</span>
            <div className="text-xs font-semibold text-[#D4AF37] capitalize flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span className="truncate">
                {liveStreamSettings.voicePersona.replace('_', ' ')} (
                {liveStreamSettings.language === 'sw-TZ' ? 'Kiswahili' : 'English'})
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#08090d] border border-[#20222a] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#888888]">Hali ya Mazungumzo:</span>
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>
                {liveStreamSettings.continuousMode ? 'Hands-Free (Bila Kukatiza)' : 'Kugusa kwa Mkono'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Connection & Standalone Phone Setup */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-[#D4AF37] shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                Muunganisho wa Akili ya Mkuu AI & Seva ya Wingu
              </h3>
              <p className="text-xs text-[#888888]">
                Sanidi jinsi kifaa hiki kinavyounganishwa na Mkuu AI na seva ya wingu kwa uhuru kamili.
              </p>
            </div>
          </div>

          <div className="hidden sm:block">
            {hasDirectKey ? (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mkuu AI Direct Ipo Tayari
              </span>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Akili ya Ndani (Local AI)
              </span>
            )}
          </div>
        </div>

        {/* Mkuu AI Key Direct Input */}
        <form onSubmit={handleSaveGeminiKey} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              API Key ya Mkuu AI (Kwa Matumizi ya Moja kwa Moja Kwenye Simu)
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-1 transition underline"
            >
              <span>Pata API Key hapa</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Weka Key... au uache wazi kwa Local Brain"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0"
            >
              HIFADHI KEY
            </button>
          </div>

          {apiKeySaved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>API Key ya Mkuu AI imehifadhiwa salama kwenye simu yako!</span>
            </div>
          )}
        </form>

        {/* Custom Server URL (Optional) */}
        <form onSubmit={handleSaveServerUrl} className="space-y-3 pt-1 border-t border-[#1a1a1a]">
          <label className="text-xs font-semibold text-[#888888] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            Seva ya Wingu Binafsi (Custom Backend Server URL — Hiari)
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://new-1cr3r.faable.link (au seva yako)"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl glass hover:bg-[#222222] text-[#F5F2ED] font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 border border-[#333333]"
            >
              HIFADHI SEVA
            </button>
          </div>

          {serverUrlSaved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anwani ya seva imehifadhiwa kikamilifu!</span>
            </div>
          )}
        </form>

        {/* Test Connection Button & Status Output */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testResult.status === 'testing'}
            className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] text-[#F5F2ED] border border-[#333333] text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testResult.status === 'testing' ? 'animate-spin text-[#D4AF37]' : ''}`} />
            <span>JARIBU MUUNGANISHO WA AI</span>
          </button>

          {testResult.message && (
            <p className={`text-xs ${testResult.status === 'success' ? 'text-emerald-400' : testResult.status === 'error' ? 'text-red-400' : 'text-[#888888]'}`}>
              {testResult.message}
            </p>
          )}
        </div>
      </div>

      {/* Owner Identity Profile Card */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xl shadow-lg">
              MX
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-xl">{user?.name || 'Max'}</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold border border-[#D4AF37]/30 flex items-center gap-1 uppercase tracking-wider">
                  <Crown className="w-3 h-3" />
                  MMILIKI HALISI
                </span>
              </div>
              <p className="text-xs text-[#888888] font-mono mt-0.5">{user?.email || 'maxmkuu@gmail.com'}</p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Akaunti Imethibitishwa
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Jukumu (Role)</span>
            <span className="text-xs font-semibold text-[#F5F2ED] mt-0.5 block">Mmiliki Mkuu wa Mfumo (Root Owner)</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Ufikiaji wa Kumbukumbu</span>
            <span className="text-xs font-semibold text-[#D4AF37] mt-0.5 block">{memories.length} Kumbukumbu Zimehifadhiwa</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Watu wa Karibu</span>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">{people.length} Watu Wametambuliwa</span>
          </div>
        </div>
      </div>

      {/* Security Engine Specs & Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-[#D4AF37] font-bold text-xs">
            <Database className="w-4 h-4" />
            <span>Hifadhi ya Ndani (Offline IndexedDB)</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Data zote zimefungwa kwa mtumiaji wa Max pekee ndani ya kifaa chako na hazipotei kamwe hata ukiwa bila intaneti.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-[#D4AF37] font-bold text-xs">
            <Cpu className="w-4 h-4" />
            <span>Unified Mkuu AI Engine</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Inaauni utekelezaji thabiti wa Mkuu AI, akili halisi ya Kiswahili, utafutaji wa mtandao kupitia AXA, na picha kupitia Magic Hour Studio.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
            <Server className="w-4 h-4" />
            <span>Real File Generation</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Mafaili ya PDF, Excel, na Word yanaundwa kwa binary halisi na kuthibitishwa kabla ya kupakuliwa.
          </p>
        </div>
      </div>

      {/* PIN Protection & Vault Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-3.5">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="serif font-bold text-sm text-[#F5F2ED]">Nambari ya Siri ya Vault (Security PIN)</h3>
          </div>
          <p className="text-xs text-[#888888]">
            Weka au badilisha PIN ya usalama kwa ajili ya kufunga shughuli nyeti za Max Memory na Auto Reply.
          </p>

          <form onSubmit={handleSetPin} className="space-y-3">
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Weka PIN mpya (tarakimu 4 hadi 6)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono tracking-widest"
            />
            <button
              type="submit"
              disabled={!pin.trim() || pin.length < 4}
              className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
            >
              HIFADHI PIN YA USALAMA
            </button>
          </form>

          {pinSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>PIN imehifadhiwa kikamilifu!</span>
            </div>
          )}
        </div>

        {/* Data Backup & Export */}
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-3.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <h3 className="serif font-bold text-sm text-[#F5F2ED]">Hamisha Data Zote (Export All Data)</h3>
            </div>
            <p className="text-xs text-[#888888]">
              Pakua nakala kamili ya JSON yenye Max Memory, orodha ya Watu wa Karibu, na kumbukumbu zote za Auto Reply.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              id="export-all-data-btn"
              onClick={onExportAllData}
              className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>PAKUA NAKALA KAMILI YA DATA (JSON BACKUP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="p-6 rounded-3xl bg-red-950/20 border border-red-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="serif font-bold text-sm text-white">Eneo Nyeti la Mfumo (Danger Zone)</h3>
          </div>
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition cursor-pointer"
          >
            Safisha Mfumo Upya
          </button>
        </div>
        <p className="text-xs text-[#888888]">
          Uchaguzi huu utarejesha kumbukumbu na taarifa za msingi za Max na kufuta historia zote za majaribio.
        </p>
      </div>

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border border-red-900/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-white text-base">Thibitisha Kusafisha Mfumo?</h3>
                <p className="text-xs text-[#888888]">Hatua hii itarejesha mfumo katika hali safi ya msingi.</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={async () => {
                  await onClearAllData();
                  setIsResetConfirmOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                NDIYO, REJESHA MFUMO
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Gemini Live Settings Modal */}
      <GeminiLiveSettingsModal
        isOpen={isGeminiSettingsOpen}
        onClose={() => setIsGeminiSettingsOpen(false)}
        settings={liveStreamSettings}
        onUpdateSettings={(newSettings) => {
          setLiveStreamSettings(newSettings);
          saveStoredLiveStreamSettings(newSettings);
        }}
      />
    </div>
  );
};
export default SecurityCenter;
