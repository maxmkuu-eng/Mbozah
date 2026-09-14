/** MKUU AI production API configuration. */
export const DEFAULT_PUBLIC_BACKEND_URL = 'https://new-1cr3r.faable.link';
export const FAABLE_DEPLOY_URL = 'https://new-1cr3r.faable.link';
export const FAABLE_HEALTH_URL = 'https://new-1cr3r.faable.link/health';
export const FAABLE_STATUS_URL = 'https://new-1cr3r.faable.link/api/status';
export const FAABLE_CONSOLE_URL = 'https://faable.com';
export const FAABLE_DOCS_URL = 'https://docs.faable.com';

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';
export const STORAGE_SERVER_KEY_CUSTOM = 'mkuu_backend_api_url_v1';
export const AUTO_REPLY_LOCAL_SETTINGS_KEY = 'mkuu_local_autoreply_settings_v2';
export const STORAGE_MAGIC_HOUR_API_KEY = 'mkuu_magic_hour_api_key_v1';

export function getStoredMagicHourApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_MAGIC_HOUR_API_KEY)?.trim() || '';
}

export function setStoredMagicHourApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key || !key.trim()) {
    localStorage.removeItem(STORAGE_MAGIC_HOUR_API_KEY);
  } else {
    localStorage.setItem(STORAGE_MAGIC_HOUR_API_KEY, key.trim());
  }
}

export type ApiErrorCode = 'NO_INTERNET'|'BACKEND_UNREACHABLE'|'GEMINI_UNAVAILABLE'|'DNS_FAILURE'|'TLS_FAILURE'|'HTTP_401'|'HTTP_403'|'HTTP_429'|'HTTP_500'|'HTTP_502'|'HTTP_503'|'TIMEOUT'|'AUTH_REDIRECT'|'UNKNOWN';

export class MkuuApiError extends Error {
  public code: ApiErrorCode; public status?: number; public technicalDetails: string; public userMessage: string; public targetUrl: string; public isRetryable: boolean;
  constructor(p:{code:ApiErrorCode;userMessage:string;technicalDetails:string;targetUrl:string;status?:number;isRetryable?:boolean}){super(p.userMessage);this.name='MkuuApiError';Object.assign(this,p);this.isRetryable=p.isRetryable??true;}
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap=(window as any).Capacitor;
  return !!(cap?.isNativePlatform?.() || window.location.protocol==='capacitor:' || window.location.protocol==='file:' || (window.location.hostname==='localhost'&&!window.location.port));
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY)?.trim();

  if (isCapacitorNative()) {
    if (custom && custom.startsWith('http')) return custom.replace(/\/+$/, '');
    const env = (import.meta as any).env?.VITE_PUBLIC_API_URL;
    if (typeof env === 'string' && env.trim().startsWith('http')) return env.trim().replace(/\/+$/, '');
    return DEFAULT_PUBLIC_BACKEND_URL;
  }

  // Running in Web browser / Cloud Run preview:
  // Same-origin relative path ('') is always primary to guarantee 0 CORS issues and lowest latency.
  // If the user explicitly configured a custom server URL that is NOT the default faable link, respect it.
  if (custom && custom.startsWith('http') && !custom.includes('faable.link')) {
    return custom.replace(/\/+$/, '');
  }
  return '';
}

export function getFallbackApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  if (isCapacitorNative()) {
    return DEFAULT_PUBLIC_BACKEND_URL;
  }
  const primary = getApiBaseUrl();
  return primary ? '' : DEFAULT_PUBLIC_BACKEND_URL;
}

export const PRODUCTION_API_BASE_URL = DEFAULT_PUBLIC_BACKEND_URL;

export function getRemoteServerUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_PUBLIC_BACKEND_URL;
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY)?.trim();
  if (custom && custom.startsWith('http')) return custom;
  return isCapacitorNative() ? DEFAULT_PUBLIC_BACKEND_URL : (typeof window !== 'undefined' ? window.location.origin : DEFAULT_PUBLIC_BACKEND_URL);
}

export function setRemoteServerUrl(url: string) {
  if (typeof window === 'undefined') return;
  if (!url?.trim()) localStorage.removeItem(STORAGE_SERVER_URL_KEY);
  else localStorage.setItem(STORAGE_SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
}

export function getApiUrl(endpoint: string, explicitBase?: string) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const e = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const b = explicitBase !== undefined ? explicitBase : getApiBaseUrl();
  return b ? `${b}${e}` : e;
}

function isAutoReplySettingsEndpoint(endpoint: string): boolean {
  return endpoint.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') === '/api/autoreply/settings';
}

function readLocalAutoReplySettings(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTO_REPLY_LOCAL_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function saveLocalAutoReplySettings(settings: any): void {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') return;
  try { localStorage.setItem(AUTO_REPLY_LOCAL_SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { console.warn('Auto Reply local persistence warning:', e); }
}

function persistAutoReplyRequest(endpoint: string, options?: RequestInit): void {
  if (!isAutoReplySettingsEndpoint(endpoint) || typeof window === 'undefined' || !options?.body) return;
  try {
    const updates = typeof options.body === 'string' ? JSON.parse(options.body) : null;
    if (!updates || typeof updates !== 'object') return;
    const current = readLocalAutoReplySettings() || {};
    saveLocalAutoReplySettings({ ...current, ...updates });
  } catch (e) { console.warn('Auto Reply request persistence warning:', e); }
}

function mergeAutoReplyLocalState(endpoint: string, body: any): any {
  if (!isAutoReplySettingsEndpoint(endpoint) || !body || typeof body !== 'object') return body;
  const local = readLocalAutoReplySettings();
  if (!local) return body;
  const merged = { ...body };
  if (typeof local.emergencyStop === 'boolean') merged.emergencyStop = local.emergencyStop;
  if (local.emergencyStop === true) merged.enabled = false;
  return merged;
}

export async function checkServerReachability(): Promise<{ reachable: boolean; status?: string; latencyMs: number; error?: string }> {
  const s = Date.now();
  try {
    const d = await apiFetch<any>('/health', {}, 7000);
    return { reachable: d?.status === 'ok' || d?.status === 'connected', status: d?.status, latencyMs: Date.now() - s };
  } catch (e: any) {
    return { reachable: false, latencyMs: Date.now() - s, error: e.userMessage || e.message };
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit, timeoutMs = 30000): Promise<T> {
  const url = getApiUrl(endpoint);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (isAutoReplySettingsEndpoint(endpoint)) {
      const local = readLocalAutoReplySettings();
      if (local) return local as T;
    }
    throw new MkuuApiError({
      code: 'NO_INTERNET',
      userMessage: 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.',
      technicalDetails: 'Device offline',
      targetUrl: url,
    });
  }

  persistAutoReplyRequest(endpoint, options);

  const primaryBase = getApiBaseUrl();
  const fallbackBase = getFallbackApiBaseUrl();
  const candidateBases = [primaryBase];
  if (fallbackBase !== primaryBase) {
    candidateBases.push(fallbackBase);
  }

  const effectiveBody = options?.body;
  const isImageOrAgent = endpoint.includes('/api/agent') || endpoint.includes('/api/image');
  const effectiveTimeoutMs = isImageOrAgent ? Math.max(timeoutMs, 90 * 1000) : timeoutMs;
  let lastError: any;

  for (let bIndex = 0; bIndex < candidateBases.length; bIndex++) {
    const base = candidateBases[bIndex];
    const targetUrl = getApiUrl(endpoint, base);
    const isSameOrigin = !base || (typeof window !== 'undefined' && targetUrl.startsWith(window.location.origin)) || isCapacitorNative();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };
    const storedMagicHourKey = getStoredMagicHourApiKey();
    if (storedMagicHourKey && !headers['x-magic-hour-key']) {
      headers['x-magic-hour-key'] = storedMagicHourKey;
    }
    if (effectiveBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      const res = await fetch(targetUrl, {
        ...options,
        body: effectiveBody,
        headers,
        cache: 'no-store',
        signal: options?.signal || controller.signal,
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      let body: any;
      if (contentType.includes('application/json')) {
        try { body = await res.json(); } catch { body = {}; }
      } else {
        body = await res.text();
      }

      if (!res.ok) {
        const detail = typeof body === 'string' ? body : (body?.error || body?.message || `HTTP ${res.status}`);
        const isTemporary = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;

        if (isTemporary && bIndex < candidateBases.length - 1) {
          console.warn(`[MKUU-CLIENT] Candidate ${targetUrl} returned ${res.status}, trying fallback base...`);
          continue;
        }

        throw new MkuuApiError({
          code: isTemporary ? 'GEMINI_UNAVAILABLE' : 'BACKEND_UNREACHABLE',
          status: res.status,
          userMessage: isTemporary
            ? 'MKUU AI HAIPATIKANI KWA SASA\nTafadhali jaribu tena baada ya muda mfupi.'
            : 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
          technicalDetails: String(detail),
          targetUrl,
        });
      }

      const mergedBody = mergeAutoReplyLocalState(endpoint, body);
      if (isAutoReplySettingsEndpoint(endpoint) && mergedBody && typeof mergedBody === 'object') {
        saveLocalAutoReplySettings(mergedBody);
      }
      return mergedBody as T;
    } catch (e: any) {
      lastError = e instanceof MkuuApiError ? e : new MkuuApiError({
        code: 'BACKEND_UNREACHABLE',
        userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
        technicalDetails: e?.message || 'Failed to fetch',
        targetUrl,
      });

      if (bIndex < candidateBases.length - 1) {
        console.info(`[MKUU-CLIENT] Retrying on fallback base after error:`, e?.message || e);
        continue;
      }
    }
  }

  if (isAutoReplySettingsEndpoint(endpoint)) {
    const local = readLocalAutoReplySettings();
    if (local) return local as T;
  }

  throw lastError;
}
