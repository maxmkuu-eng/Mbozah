import { LiveStreamSettings } from '../types';

export const LIVE_STREAM_STORAGE_KEY = 'mkuu_gemini_live_settings_v1';

export const DEFAULT_LIVE_STREAM_SETTINGS: LiveStreamSettings = {
  visualEffect: 'fluid_orb',
  voicePersona: 'capella',
  speechRate: 1.0,
  pitch: 1.0,
  continuousMode: true,
  interruptOnSpeech: true,
  language: 'sw-TZ',
  ambientGlow: true,
  sensitivityLevel: 'normal',
  hapticFeedback: true,
};

export function getStoredLiveStreamSettings(): LiveStreamSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LIVE_STREAM_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(LIVE_STREAM_STORAGE_KEY);
    if (!raw) return DEFAULT_LIVE_STREAM_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LIVE_STREAM_SETTINGS,
      ...parsed,
    };
  } catch (e) {
    console.warn('Could not parse stored live stream settings:', e);
    return DEFAULT_LIVE_STREAM_SETTINGS;
  }
}

export function saveStoredLiveStreamSettings(settings: LiveStreamSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LIVE_STREAM_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Could not save live stream settings:', e);
  }
}
