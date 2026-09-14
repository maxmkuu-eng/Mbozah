import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Volume2,
  Mic,
  Activity,
  Check,
  RotateCcw,
  Zap,
  Globe,
  Radio,
  Flame,
  Layers,
  Star,
  BarChart2,
} from 'lucide-react';
import {
  LiveStreamSettings,
  LiveStreamVisualEffect,
  LiveStreamVoicePersona,
} from '../types';
import {
  DEFAULT_LIVE_STREAM_SETTINGS,
  saveStoredLiveStreamSettings,
} from '../services/liveStreamConfig';

interface GeminiLiveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LiveStreamSettings;
  onUpdateSettings: (newSettings: LiveStreamSettings) => void;
  onTestVoice?: (text: string) => void;
}

export const GeminiLiveSettingsModal: React.FC<GeminiLiveSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestVoice,
}) => {
  const [localSettings, setLocalSettings] = useState<LiveStreamSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Keep in sync with parent settings when opened
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleChange = <K extends keyof LiveStreamSettings>(
    key: K,
    value: LiveStreamSettings[K]
  ) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onUpdateSettings(updated);
    saveStoredLiveStreamSettings(updated);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_LIVE_STREAM_SETTINGS);
    onUpdateSettings(DEFAULT_LIVE_STREAM_SETTINGS);
    saveStoredLiveStreamSettings(DEFAULT_LIVE_STREAM_SETTINGS);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const visualEffectOptions: {
    id: LiveStreamVisualEffect;
    name: string;
    description: string;
    icon: React.ElementType;
    badge: string;
  }[] = [
    {
      id: 'fluid_orb',
      name: 'Gemini Fluid Orb',
      description: 'Umbo hai la majimaji linalotiririka na kubadilika na masafa ya sauti (Asili ya Gemini).',
      icon: Flame,
      badge: 'GEMINI DEFAULT',
    },
    {
      id: 'aurora_wave',
      name: 'Quantum Aurora',
      description: 'Mawimbi ya spectral yanayopita taratibu na kuangaza kwa rangi za anga za Gemini.',
      icon: Layers,
      badge: 'AURORA GLOW',
    },
    {
      id: 'radiant_star',
      name: 'Radiant Gemini Star',
      description: 'Nyota ya ncha 4 ya Gemini inayozunguka na kupiga mawimbi ya nishati unapoongea.',
      icon: Star,
      badge: 'STARBURST',
    },
    {
      id: 'kinetic_bars',
      name: 'Kinetic Spectrum Bars',
      description: 'Visualizer ya kisasa yenye rounded equalizer bars za rangi za Google Gemini.',
      icon: BarChart2,
      badge: 'FREQUENCY',
    },
  ];

  const voicePersonaOptions: {
    id: LiveStreamVoicePersona;
    name: string;
    tone: string;
    description: string;
  }[] = [
    {
      id: 'capella',
      name: 'Capella (Gemini Live)',
      tone: 'Tulivu na ya Kirafiki',
      description: 'Sauti asili ya Gemini Live yenye unyumbulifu na joto la kirafiki.',
    },
    {
      id: 'vega',
      name: 'Vega (Gemini Energetic)',
      tone: 'Changamfu na Shupavu',
      description: 'Sauti yenye nguvu, wepesi na mvuto kwa kazi za uchangamfu.',
    },
    {
      id: 'orion',
      name: 'Orion (Gemini Deep)',
      tone: 'Kina na Kiufundi',
      description: 'Sauti ya kina, utulivu wa juu na mwelekeo wa kitaalamu.',
    },
    {
      id: 'ursa',
      name: 'Ursa (Gemini Confident)',
      tone: 'Imara na Ya Kisasa',
      description: 'Sauti thabiti, ya ujasiri na maamuzi ya haraka.',
    },
    {
      id: 'lyra',
      name: 'Lyra (Gemini Soft)',
      tone: 'Laini na Tulivu',
      description: 'Sauti nyepesi, ya faraja na uwazi mkubwa wa matamshi.',
    },
    {
      id: 'swahili_local',
      name: 'Mkuu Swahili Asili',
      tone: 'Kiswahili Sanifu cha Tanzania',
      description: 'Matamshi asilia ya Kiswahili yaliyoboreshwa kwa lahaja ya Afrika Mashariki.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-[#F5F2ED]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#0e0f13] border border-[#2a2c36] rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#20222a] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4E88FF]/20 via-[#9B72CF]/20 to-[#D4AF37]/20 border border-[#4E88FF]/40 flex items-center justify-center text-[#4E88FF] shadow-md">
              <Sparkles className="w-5 h-5 text-[#4E88FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-white text-base sm:text-lg leading-tight">
                  Mipangilio ya Gemini Live Stream
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#4E88FF]/15 text-[#4E88FF] border border-[#4E88FF]/30">
                  GEMINI FX
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Sanidi mwonekano, sauti, na athari za uhuishaji (animations) za Gemini Live
              </p>
            </div>
          </div>

          <button
            id="gemini-settings-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] border-[#252732] transition cursor-pointer"
            title="Funga"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Gemini Live Visual Effect & Animation Style */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Athari za Uhuishaji (Visualizer & Animation Effects)</span>
            </label>
            <span className="text-[11px] text-[#737885]">4 Mitindo ya Gemini</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visualEffectOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = localSettings.visualEffect === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  id={`gemini-fx-${opt.id}`}
                  onClick={() => handleChange('visualEffect', opt.id)}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#4E88FF]/15 to-[#9B72CF]/15 border-[#4E88FF] shadow-lg shadow-[#4E88FF]/10'
                      : 'bg-[#14151a] hover:bg-[#1b1c24] border-[#252733] text-[#a0a5b2]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#4E88FF] text-white'
                            : 'bg-[#20222a] text-[#888888]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-[#d0d4dd]'
                        }`}
                      >
                        {opt.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#4E88FF] flex items-center justify-center text-white">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#7d8291] leading-snug">
                    {opt.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] font-mono text-[#4E88FF] tracking-wider uppercase">
                      {opt.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Gemini Live Voice Persona */}
        <div className="space-y-2.5 pt-2 border-t border-[#20222a]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Sauti ya Gemini (Voice Personality & Style)</span>
            </label>
            <span className="text-[11px] text-[#737885]">6 Chaguzi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {voicePersonaOptions.map((voice) => {
              const isSelected = localSettings.voicePersona === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  id={`gemini-voice-${voice.id}`}
                  onClick={() => handleChange('voicePersona', voice.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#14151a] hover:bg-[#1b1c24] border-[#252733] text-[#8e95a2]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-[#D4AF37]" />
                      <span className="truncate">{voice.name}</span>
                    </div>
                    <div className="text-[10px] text-[#8e95a2] truncate">{voice.tone}</div>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Test Voice Button */}
          {onTestVoice && (
            <button
              type="button"
              id="gemini-test-voice-btn"
              onClick={() =>
                onTestVoice(
                  localSettings.language === 'sw-TZ'
                    ? 'Habari Max! Hii ni sauti ya Gemini Live yenye mtiririko wa moja kwa moja.'
                    : 'Hello Max! This is Gemini Live with real-time stream audio animation.'
                )
              }
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#4E88FF]/15 via-[#9B72CF]/15 to-[#D4AF37]/15 hover:from-[#4E88FF]/25 hover:to-[#D4AF37]/25 border border-[#4E88FF]/30 text-xs text-[#f0f4f9] font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-[#4E88FF]" />
              <span>Sikiliza Mfano wa Sauti Hii & Uhuishaji wa Gemini</span>
            </button>
          )}
        </div>

        {/* Section 3: Speech Rate & Pitch Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#20222a]">
          {/* Rate */}
          <div className="bg-[#14151a] border border-[#252733] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Kasi ya Maongezi</span>
              </span>
              <span className="font-mono text-[#D4AF37] font-bold">
                {localSettings.speechRate}x
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[0.8, 1.0, 1.2, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleChange('speechRate', rate)}
                  className={`flex-1 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                    localSettings.speechRate === rate
                      ? 'bg-[#D4AF37] text-black font-bold'
                      : 'bg-[#1e2028] text-[#8e95a2] hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Pitch */}
          <div className="bg-[#14151a] border border-[#252733] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-[#4E88FF]" />
                <span>Kina cha Sauti (Tone)</span>
              </span>
              <span className="font-mono text-[#4E88FF] font-bold">
                {localSettings.pitch === 0.8
                  ? 'Kina / Nzito'
                  : localSettings.pitch === 1.2
                  ? 'Nyembamba'
                  : 'Asili (1.0)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { val: 0.8, label: 'Kina' },
                { val: 1.0, label: 'Asili' },
                { val: 1.2, label: 'Nyepesi' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleChange('pitch', p.val)}
                  className={`flex-1 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                    localSettings.pitch === p.val
                      ? 'bg-[#4E88FF] text-white font-bold'
                      : 'bg-[#1e2028] text-[#8e95a2] hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Live Stream Toggles (Continuous Mode, Interrupt, Ambient Glow) */}
        <div className="space-y-2 pt-2 border-t border-[#20222a]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>Mtiririko wa Moja kwa Moja (Live Stream Behaviors)</span>
          </span>

          <div className="space-y-2">
            {/* Continuous Auto-Listen Mode */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14151a] border border-[#252733]">
              <div className="pr-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Mtiririko Usiokatika (Hands-free Live Stream)</span>
                </div>
                <p className="text-[11px] text-[#7d8291] mt-0.5">
                  Baada ya MKUU AI kujibu, kipaza sauti hufunguka kiotomatiki bila haja ya kugusa skrini tena.
                </p>
              </div>
              <button
                type="button"
                id="toggle-gemini-continuous-mode"
                onClick={() =>
                  handleChange('continuousMode', !localSettings.continuousMode)
                }
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  localSettings.continuousMode ? 'bg-[#4E88FF]' : 'bg-[#252733]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    localSettings.continuousMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Interrupt AI on Speech */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14151a] border border-[#252733]">
              <div className="pr-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kukatiza AI Papo Hapo (Barge-In)</span>
                </div>
                <p className="text-[11px] text-[#7d8291] mt-0.5">
                  Kukatiza sauti ya AI mara moja unapoanza kuongea au kugusa kielelezo cha Gemini.
                </p>
              </div>
              <button
                type="button"
                id="toggle-gemini-interrupt"
                onClick={() =>
                  handleChange('interruptOnSpeech', !localSettings.interruptOnSpeech)
                }
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  localSettings.interruptOnSpeech ? 'bg-[#D4AF37]' : 'bg-[#252733]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    localSettings.interruptOnSpeech ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Ambient Background Glow */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14151a] border border-[#252733]">
              <div className="pr-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#9B72CF]" />
                  <span>Mwangaza wa Mandharinyuma (Gemini Ambient Aura)</span>
                </div>
                <p className="text-[11px] text-[#7d8291] mt-0.5">
                  Uhuishaji wa mwanga laini (aura) na chembe za nyota (celestial particles) kuzunguka kielelezo.
                </p>
              </div>
              <button
                type="button"
                id="toggle-gemini-ambient-glow"
                onClick={() => handleChange('ambientGlow', !localSettings.ambientGlow)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  localSettings.ambientGlow ? 'bg-[#9B72CF]' : 'bg-[#252733]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    localSettings.ambientGlow ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 5: Language Selection */}
        <div className="pt-2 border-t border-[#20222a] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-[#4E88FF]" />
            <span className="text-xs font-semibold text-white">Lugha ya Live Stream:</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-[#14151a] p-1 rounded-xl border border-[#252733]">
            <button
              type="button"
              id="lang-sw-btn"
              onClick={() => handleChange('language', 'sw-TZ')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                localSettings.language === 'sw-TZ'
                  ? 'bg-[#4E88FF] text-white'
                  : 'text-[#8e95a2] hover:text-white'
              }`}
            >
              Kiswahili (Tanzania)
            </button>
            <button
              type="button"
              id="lang-en-btn"
              onClick={() => handleChange('language', 'en-US')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                localSettings.language === 'en-US'
                  ? 'bg-[#4E88FF] text-white'
                  : 'text-[#8e95a2] hover:text-white'
              }`}
            >
              English (Global)
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-[#20222a] flex items-center justify-between">
          <button
            type="button"
            id="gemini-reset-defaults-btn"
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-[#8e95a2] hover:text-[#f0f4f9] transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rejesha ya Awali</span>
          </button>

          <div className="flex items-center space-x-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
                <Check className="w-3 h-3" />
                Imehifadhiwa!
              </span>
            )}
            <button
              type="button"
              id="gemini-save-settings-btn"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4E88FF] to-[#9B72CF] hover:from-[#4176e0] hover:to-[#8961b8] text-white font-bold text-xs shadow-lg shadow-[#4E88FF]/20 transition cursor-pointer"
            >
              Imekamilika & Funga
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveSettingsModal;
