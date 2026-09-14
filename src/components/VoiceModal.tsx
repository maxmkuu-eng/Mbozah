import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Crown,
  AlertCircle,
  Settings,
  Send,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
  Radio,
  Sliders,
  Zap,
} from 'lucide-react';
import { VoiceState, Memory, Person, LiveStreamSettings } from '../types';
import { GeminiLiveVisualizer } from './GeminiLiveVisualizer';
import { GeminiLiveSettingsModal } from './GeminiLiveSettingsModal';
import {
  getStoredLiveStreamSettings,
  saveStoredLiveStreamSettings,
  DEFAULT_LIVE_STREAM_SETTINGS,
} from '../services/liveStreamConfig';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (
    message: string,
    isVoice: boolean
  ) => Promise<{ reply: string; cleanSpeechText: string }>;
  memories: Memory[];
  people: Person[];
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  memories,
  people,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [manualInput, setManualInput] = useState('');
  const [isRecordingMediaStream, setIsRecordingMediaStream] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [liveStreamSettings, setLiveStreamSettings] = useState<LiveStreamSettings>(
    DEFAULT_LIVE_STREAM_SETTINGS
  );

  // Refs
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const isStartingListeningRef = useRef<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<string>('');
  const voiceStateRef = useRef<VoiceState>('ready');
  const isListeningExplicitlyRef = useRef<boolean>(false);
  const liveStreamSettingsRef = useRef<LiveStreamSettings>(DEFAULT_LIVE_STREAM_SETTINGS);

  // Web Audio API refs for real-time live microphone stream analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animAudioFrameRef = useRef<number | null>(null);
  const speakingIntervalRef = useRef<any>(null);

  // Load stored settings on mount or open
  useEffect(() => {
    const saved = getStoredLiveStreamSettings();
    setLiveStreamSettings(saved);
    liveStreamSettingsRef.current = saved;
  }, [isOpen]);

  // Sync state refs
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    liveStreamSettingsRef.current = liveStreamSettings;
  }, [liveStreamSettings]);

  // Clean Markdown & Technical symbols for clean spoken voice
  const sanitizeTextForSpeech = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/^[\s*•\-+]+\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Start procedural speech audio animation
  const startSpeakingAudioAnimation = () => {
    if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
    let step = 0;
    speakingIntervalRef.current = setInterval(() => {
      step += 0.25;
      const wave = Math.abs(Math.sin(step)) * 0.55 + Math.sin(step * 2.3) * 0.25 + 0.15;
      setAudioLevel(Math.max(0.1, Math.min(0.95, wave)));
    }, 60);
  };

  // Stop speaking audio animation
  const stopSpeakingAudioAnimation = () => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    setAudioLevel(0);
  };

  // Text-To-Speech Playback with Gemini Voice Persona, Native Android Bridge & Speed Controls
  const speakText = (text: string) => {
    if (isMuted) {
      setVoiceState('ready');
      stopSpeakingAudioAnimation();
      return;
    }

    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned) {
      setVoiceState('ready');
      stopSpeakingAudioAnimation();
      return;
    }

    const currentSettings = liveStreamSettingsRef.current;
    const isSwahili = currentSettings.language === 'sw-TZ';

    // 1. First priority: Check native Android DeviceBridge TTS (for APK)
    if (
      typeof window !== 'undefined' &&
      (window as any).MkuuDevice &&
      typeof (window as any).MkuuDevice.speak === 'function'
    ) {
      setVoiceState('speaking');
      startSpeakingAudioAnimation();
      const spoken = (window as any).MkuuDevice.speak(cleaned, isSwahili ? 'sw' : 'en');
      if (spoken) {
        const checkInterval = setInterval(() => {
          if (!(window as any).MkuuDevice?.isSpeaking?.()) {
            clearInterval(checkInterval);
            stopSpeakingAudioAnimation();
            setVoiceState('ready');
            if (liveStreamSettingsRef.current.continuousMode) {
              setTimeout(() => {
                if (voiceStateRef.current === 'ready') {
                  startListening();
                }
              }, 450);
            }
          }
        }, 200);
        return;
      }
    }

    // 2. Web Speech Synthesis fallback
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceState('ready');
      stopSpeakingAudioAnimation();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = currentSettings.speechRate || 1.0;
      utterance.pitch = currentSettings.pitch || 1.0;

      // Select voice safely
      const voices = window.speechSynthesis.getVoices() || [];
      if (isSwahili) {
        const swVoice = voices.find((v) => v.lang.toLowerCase().startsWith('sw'));
        if (swVoice) {
          utterance.voice = swVoice;
          utterance.lang = swVoice.lang;
        } else {
          // If browser has no specific sw-TZ voice, use default system voice so it doesn't fail
          const defVoice = voices.find((v) => v.default) || voices[0];
          if (defVoice) {
            utterance.voice = defVoice;
            utterance.lang = defVoice.lang || 'en-US';
          }
        }
      } else {
        const enVoice =
          voices.find(
            (v) =>
              v.lang.toLowerCase().includes('en-us') ||
              v.lang.toLowerCase().includes('en-gb') ||
              v.lang.toLowerCase().startsWith('en')
          ) || voices[0];
        if (enVoice) {
          utterance.voice = enVoice;
          utterance.lang = enVoice.lang;
        }
      }

      (window as any).__mkuuVoiceUtterance = utterance;

      utterance.onstart = () => {
        setVoiceState('speaking');
        startSpeakingAudioAnimation();
      };

      utterance.onend = () => {
        (window as any).__mkuuVoiceUtterance = null;
        stopSpeakingAudioAnimation();
        setVoiceState('ready');

        // Continuous Live Stream Mode (Hands-free conversation like Gemini Live!)
        if (liveStreamSettingsRef.current.continuousMode) {
          setTimeout(() => {
            if (voiceStateRef.current === 'ready') {
              startListening();
            }
          }, 450);
        }
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        (window as any).__mkuuVoiceUtterance = null;
        stopSpeakingAudioAnimation();
        setVoiceState('ready');
      };

      setVoiceState('speaking');
      startSpeakingAudioAnimation();
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    } catch (err) {
      console.error('TTS playback error:', err);
      stopSpeakingAudioAnimation();
      setVoiceState('ready');
    }
  };

  // Send speech transcript to backend AI
  const handleProcessVoice = async (textToSend: string) => {
    if (!textToSend || !textToSend.trim()) {
      setVoiceState('ready');
      return;
    }

    setVoiceState('thinking');
    setErrorMessage('');
    stopMicAudioAnalyser();

    try {
      const result = await onSendMessage(textToSend, true);
      setAiResponse(result.reply);
      setVoiceState('speaking');
      speakText(result.cleanSpeechText || result.reply);
    } catch (e: any) {
      console.error('AI Voice Processing Error:', e);
      setVoiceState('error');
      setErrorMessage(
        e.message?.includes('network') || e.message?.includes('fetch')
          ? 'Haijaweza kuwasiliana na seva. Angalia mtandao wako.'
          : 'MKUU AI haijaweza kupata jibu kwa sasa.'
      );
    }
  };

  // Start real-time Web Audio API frequency analysis for live microphone stream
  const startMicAudioAnalyser = (stream: MediaStream) => {
    stopMicAudioAnalyser();
    try {
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const sensitivityMultiplier =
        liveStreamSettingsRef.current.sensitivityLevel === 'high'
          ? 1.5
          : liveStreamSettingsRef.current.sensitivityLevel === 'low'
          ? 0.7
          : 1.0;

      const updateLoop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, (avg / 75) * sensitivityMultiplier);
        setAudioLevel(normalized);

        animAudioFrameRef.current = requestAnimationFrame(updateLoop);
      };

      updateLoop();
    } catch (e) {
      console.warn('AudioContext setup note:', e);
    }
  };

  // Stop Web Audio API analyser
  const stopMicAudioAnalyser = () => {
    if (animAudioFrameRef.current) {
      cancelAnimationFrame(animAudioFrameRef.current);
      animAudioFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Check Speech Recognition & Speech Synthesis Support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    synthRef.current = 'speechSynthesis' in window ? window.speechSynthesis : null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognition);

    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
          recognitionRef.current = null;
        }
      } catch (e) {}
      try {
        if (synthRef.current) synthRef.current.cancel();
      } catch (e) {}
      isRecognitionRunningRef.current = false;
      stopMicAudioAnalyser();
      stopSpeakingAudioAnimation();
    };
  }, []);

  // Request Microphone Permissions
  const requestMicPermission = async (): Promise<MediaStream | null> => {
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
        setErrorMessage('');
        return stream;
      }
      setHasPermission(true);
      return null;
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setHasPermission(false);
      setVoiceState('error');
      setErrorMessage(
        'Ruhusa ya microphone imezuiwa. Tafadhali ruhusu kipaza sauti kwenye kivinjari au app.'
      );
      return null;
    }
  };

  // Safe Speech Recognition Starter to prevent InvalidStateError
  const startSpeechRecognition = (lang: string): boolean => {
    if (!isSupported) return false;

    // If already actively running, do not re-start
    if (isRecognitionRunningRef.current) {
      return true;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return false;
    }

    // Safely abort and clear any previous instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = lang;

      recognition.onstart = () => {
        isRecognitionRunningRef.current = true;
        isListeningExplicitlyRef.current = true;
        setVoiceState('listening');
        setErrorMessage('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setTranscript(currentTranscript);
          transcriptRef.current = currentTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        isRecognitionRunningRef.current = false;
        isListeningExplicitlyRef.current = false;
        stopMicAudioAnalyser();

        if (event.error === 'no-speech') {
          setVoiceState('ready');
          setErrorMessage('Sauti haijasikika. Gusa kielelezo kuongea tena.');
        } else if (event.error === 'aborted') {
          if (voiceStateRef.current === 'listening') {
            setVoiceState('ready');
          }
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setVoiceState('error');
          setHasPermission(false);
          setErrorMessage('Ruhusa ya microphone imekataliwa. Tafadhali ruhusu kipaza sauti.');
        } else {
          setVoiceState('error');
          setErrorMessage(`Kipaza sauti: ${event.error}`);
        }
      };

      recognition.onend = () => {
        isRecognitionRunningRef.current = false;
        const wasListening = isListeningExplicitlyRef.current;
        isListeningExplicitlyRef.current = false;
        stopMicAudioAnalyser();

        const finalSpeech = transcriptRef.current;
        if (finalSpeech && finalSpeech.trim().length > 0 && wasListening) {
          handleProcessVoice(finalSpeech);
        } else if (voiceStateRef.current === 'listening') {
          setVoiceState('ready');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      isRecognitionRunningRef.current = true;
      return true;
    } catch (err: any) {
      isRecognitionRunningRef.current = false;
      console.warn('Recognition start caught safely:', err);
      return false;
    }
  };

  // Start Listening with Live Stream Web Audio Analyser
  const startListening = async () => {
    // Guard against re-entrant calls or starting while already listening
    if (
      isStartingListeningRef.current ||
      isRecognitionRunningRef.current ||
      voiceStateRef.current === 'listening'
    ) {
      return;
    }
    isStartingListeningRef.current = true;

    try {
      // If AI is currently speaking and interrupt is enabled, cancel speech
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      stopSpeakingAudioAnimation();

      setTranscript('');
      transcriptRef.current = '';
      setAiResponse('');
      setErrorMessage('');

      // Check & Request permission
      const stream = await requestMicPermission();
      if (stream) {
        startMicAudioAnalyser(stream);
      }

      const currentLang = liveStreamSettingsRef.current.language || 'sw-TZ';

      if (isSupported) {
        const started = startSpeechRecognition(currentLang);
        if (started) {
          return;
        }
      }

      // Direct MediaRecorder Audio Capture Fallback
      try {
        const fallbackStream =
          stream || (await navigator.mediaDevices.getUserMedia({ audio: true }));
        startMicAudioAnalyser(fallbackStream);

        const mediaRecorder = new MediaRecorder(fallbackStream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstart = () => {
          setIsRecordingMediaStream(true);
          setVoiceState('listening');
        };

        mediaRecorder.onstop = () => {
          setIsRecordingMediaStream(false);
          stopMicAudioAnalyser();
          if (transcriptRef.current.trim()) {
            handleProcessVoice(transcriptRef.current);
          } else {
            setVoiceState('ready');
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (err: any) {
        setVoiceState('error');
        stopMicAudioAnalyser();
        setErrorMessage('Kipaza sauti hakijafunguka. Unaweza kuandika ujumbe hapa chini.');
      }
    } finally {
      isStartingListeningRef.current = false;
    }
  };

  // Stop Listening & Trigger Processing
  const stopListening = () => {
    isListeningExplicitlyRef.current = true;
    stopMicAudioAnalyser();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    }
    isRecognitionRunningRef.current = false;

    if (mediaRecorderRef.current && isRecordingMediaStream) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (synthRef.current) synthRef.current.cancel();
    stopSpeakingAudioAnimation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (voiceState === 'speaking') {
      setVoiceState('ready');
    }
  };

  // Quick Voice Prompts
  const quickVoicePrompts = [
    'Mkuu, nipe muhtasari wa mambo yangu ya leo',
    'Chora picha ya mji wa kisasa wenye taa za neon',
    'Max Memory imehifadhi nini kunihusu?',
    'Niandalie ripoti ya fedha na bajeti ya mwezi huu',
  ];

  if (!isOpen) return null;

  const stateConfig = {
    ready: {
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      badge: '🟢 GEMINI READY',
      label: 'Uko Tayari — Gusa Kielelezo Kuongea',
    },
    listening: {
      color: 'bg-[#4E88FF]',
      textColor: 'text-[#4E88FF]',
      badge: '🔵 GEMINI LISTENING',
      label: 'Anasikiliza Max kwa Moja kwa Moja...',
    },
    thinking: {
      color: 'bg-[#9B72CF]',
      textColor: 'text-[#9B72CF]',
      badge: '🟣 GEMINI REASONING',
      label: 'MKUU AI Anachakata Jibu...',
    },
    speaking: {
      color: 'bg-[#D4AF37]',
      textColor: 'text-[#D4AF37]',
      badge: '🟡 GEMINI STREAMING',
      label: 'MKUU AI Anazungumza Sasa...',
    },
    error: {
      color: 'bg-red-500',
      textColor: 'text-red-400',
      badge: '🔴 GEMINI ALERT',
      label: errorMessage || 'Weka ujumbe wa sauti au chagua mifano',
    },
  };

  const currentStatus = stateConfig[voiceState];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in text-[#F5F2ED]">
        <div className="relative w-full max-w-lg bg-[#0b0c10] border border-[#20222a] rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[94vh] overflow-y-auto">
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-[#1b1c23] pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4E88FF]/20 via-[#9B72CF]/20 to-[#D4AF37]/20 border border-[#4E88FF]/40 flex items-center justify-center text-[#4E88FF] shadow-md">
                <Sparkles className="w-5 h-5 text-[#4E88FF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="serif font-bold text-white text-base leading-tight">
                    Gemini Live Stream
                  </h3>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#4E88FF]/15 text-[#4E88FF] border border-[#4E88FF]/30">
                    LIVE AUDIO FX
                  </span>
                </div>
                <p className="text-[11px] text-[#888888]">
                  Sauti ya Moja kwa Moja & Uhuishaji wa Masafa
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Gemini Settings Button */}
              <button
                type="button"
                id="voice-open-settings-btn"
                onClick={() => setIsSettingsOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#4E88FF]/15 to-[#9B72CF]/15 hover:from-[#4E88FF]/25 hover:to-[#9B72CF]/25 border border-[#4E88FF]/30 text-xs font-semibold text-[#f0f4f9] flex items-center gap-1.5 transition cursor-pointer"
                title="Fungua Mipangilio ya Live Stream"
              >
                <Settings className="w-3.5 h-3.5 text-[#4E88FF]" />
                <span className="hidden sm:inline">Settings</span>
              </button>

              {/* Mute Button */}
              <button
                type="button"
                id="voice-toggle-mute-btn"
                onClick={toggleMute}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isMuted
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'glass text-[#888888] hover:text-[#F5F2ED] border-[#222222]'
                }`}
                title={isMuted ? 'Washa Sauti ya Spika' : 'Zima Sauti ya Spika'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                id="voice-close-modal-btn"
                onClick={() => {
                  if (synthRef.current) synthRef.current.cancel();
                  if (recognitionRef.current) recognitionRef.current.abort();
                  stopMicAudioAnalyser();
                  stopSpeakingAudioAnimation();
                  onClose();
                }}
                className="p-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] border-[#222222] transition cursor-pointer"
                title="Funga Dirisha"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Central Gemini Live Animation & Visual Effects Area */}
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            {/* Status Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#121318] border border-[#232530] shadow-sm">
              <span className="text-[11px] font-mono font-bold tracking-wider">
                {currentStatus.badge}
              </span>
              <span className="text-[#444]">•</span>
              <span className={`text-[11px] font-semibold ${currentStatus.textColor}`}>
                {currentStatus.label}
              </span>
            </div>

            {/* Authentic Gemini Live Canvas Visualizer Orb */}
            <div className="relative my-1 flex items-center justify-center">
              <GeminiLiveVisualizer
                voiceState={voiceState}
                audioLevel={audioLevel}
                visualEffect={liveStreamSettings.visualEffect}
                ambientGlow={liveStreamSettings.ambientGlow}
                size={270}
                onClick={() => {
                  if (voiceState === 'listening') {
                    stopListening();
                  } else if (voiceState === 'speaking') {
                    if (synthRef.current) synthRef.current.cancel();
                    stopSpeakingAudioAnimation();
                    setVoiceState('ready');
                  } else {
                    startListening();
                  }
                }}
              />
            </div>

            {/* Live Audio Input Gain Meter (Active when listening) */}
            {voiceState === 'listening' && (
              <div className="w-full max-w-xs flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#14151b] border border-[#282a36]">
                <Mic className="w-3.5 h-3.5 text-[#4E88FF] shrink-0" />
                <div className="flex-1 h-1.5 bg-[#20222e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#4E88FF] via-[#9B72CF] to-[#D4AF37] transition-all duration-75 rounded-full"
                    style={{ width: `${Math.round(audioLevel * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#8e95a2] shrink-0">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
            )}

            {hasPermission === false && (
              <div className="w-full max-w-sm bg-red-950/40 border border-red-500/40 rounded-2xl p-3 text-center space-y-2">
                <p className="text-xs text-red-200">
                  Kipaza sauti kimezuiwa kwenye kifaa hiki.
                </p>
                <button
                  type="button"
                  id="voice-request-perm-direct-btn"
                  onClick={async () => {
                    const stream = await requestMicPermission();
                    if (stream) startListening();
                  }}
                  className="px-4 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow cursor-pointer transition"
                >
                  Ruhusu Microphone Sasa
                </button>
              </div>
            )}

            <p className="text-xs text-[#888888] text-center max-w-sm">
              {voiceState === 'listening'
                ? 'Ongea sasa na kielelezo cha Gemini kitasikiliza kwa wakati halisi.'
                : voiceState === 'speaking'
                ? 'MKUU AI anazungumza kwa kutumia athari na mawimbi ya Gemini Live...'
                : voiceState === 'thinking'
                ? 'Uchambuzi wa hoja unaendelea...'
                : 'Gusa kielelezo cha Gemini Live hapo juu kuanza kuongea mubashara'}
            </p>
          </div>

          {/* Live Transcript / AI Output Display Box */}
          {(transcript || aiResponse) && (
            <div className="glass p-4 rounded-2xl border border-[#222222] space-y-2 bg-[#090909]">
              {transcript && (
                <div className="space-y-1">
                  <span className="text-[10px] text-[#4E88FF] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    <span>Maneno Yako:</span>
                  </span>
                  <p className="text-xs text-[#F5F2ED] italic">"{transcript}"</p>
                </div>
              )}

              {aiResponse && (
                <div className="pt-2 border-t border-[#1e1e1e] space-y-1">
                  <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    <span>Jibu la MKUU AI (Gemini Live):</span>
                  </span>
                  <p className="text-xs text-[#E0DCD3] leading-relaxed serif">{aiResponse}</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Voice Phrases */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                Mifano ya Kuanzia:
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="text-[10px] text-[#4E88FF] hover:underline flex items-center gap-1"
              >
                <Sliders className="w-3 h-3" />
                <span>Badili Uhuishaji</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickVoicePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  id={`voice-quick-prompt-${idx}`}
                  onClick={() => {
                    setTranscript(prompt);
                    transcriptRef.current = prompt;
                    handleProcessVoice(prompt);
                  }}
                  className="text-left p-2.5 rounded-xl glass hover:bg-white/5 border border-[#222222] text-[11px] text-[#CCCCCC] hover:text-[#D4AF37] transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Play className="w-3 h-3 text-[#D4AF37] shrink-0" />
                  <span className="truncate">{prompt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Speech Input Box (Seamless Bridge) */}
          <div className="pt-2 border-t border-[#1e1e1e]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) {
                  const text = manualInput.trim();
                  setManualInput('');
                  setTranscript(text);
                  transcriptRef.current = text;
                  handleProcessVoice(text);
                }
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                id="voice-manual-input"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Au andika hapa uongee na sauti ya MKUU AI..."
                className="flex-1 bg-[#141414] border border-[#282828] rounded-xl px-3 py-2 text-xs text-[#F5F2ED] placeholder-[#777777] outline-none focus:border-[#4E88FF]"
              />
              <button
                type="submit"
                id="voice-manual-send-btn"
                disabled={!manualInput.trim()}
                className={`p-2 rounded-xl text-black font-bold transition cursor-pointer ${
                  manualInput.trim()
                    ? 'bg-gradient-to-r from-[#4E88FF] to-[#D4AF37] text-white hover:opacity-90'
                    : 'bg-[#222222] text-[#666666]'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Dedicated Gemini Live Settings Modal */}
      <GeminiLiveSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={liveStreamSettings}
        onUpdateSettings={(newSettings) => {
          setLiveStreamSettings(newSettings);
          saveStoredLiveStreamSettings(newSettings);
        }}
        onTestVoice={(sampleText) => {
          speakText(sampleText);
        }}
      />
    </>
  );
};

export default VoiceModal;
