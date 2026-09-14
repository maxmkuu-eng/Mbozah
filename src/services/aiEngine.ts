import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';
import { apiFetch, getApiUrl, getApiBaseUrl, getFallbackApiBaseUrl, getStoredMagicHourApiKey, MkuuApiError } from './apiConfig';

const GEMINI_API_KEY_STORAGE = 'mkuu_gemini_api_key_v1';

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key || !key.trim()) localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  else localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
}

export interface ChatEngineParams {
  userId: string;
  message: string;
  conversationId: string;
  conversationHistory?: ChatMessage[];
  isVoice?: boolean;
  attachments?: any[];
  user?: UserProfile | null;
  memories?: Memory[];
  people?: Person[];
  onChunk?: (delta: string, fullText: string) => void;
  signal?: AbortSignal;
}

export interface ChatEngineResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted?: Memory[];
  peopleRecognized?: Person[];
  generatedFiles?: GeneratedFileSummary[];
  engineUsed: 'server' | 'direct_gemini';
  aiProvider?: string;
  chatModel?: string;
  intent?: string;
}

function hasImageAttachment(params: ChatEngineParams): boolean {
  return (params.attachments || []).some((a: any) =>
    String(a?.mimeType || '').toLowerCase().startsWith('image/') ||
    String(a?.base64Data || '').startsWith('data:image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(String(a?.fileType || '').toLowerCase())
  );
}

function cleanSpeech(text: string): string {
  return String(text || '').replace(/[#*`_~[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Image attachments and image generation MUST use the dedicated Magic Hour Studio image endpoints.
 * Architecture: MKUU Client -> MKUU Backend (/api/image) -> Magic Hour Studio API -> Image Result
 */
async function processMagicHourImage(params: ChatEngineParams): Promise<ChatEngineResult> {
  const image = (params.attachments || []).find((a: any) =>
    String(a?.mimeType || '').toLowerCase().startsWith('image/') ||
    String(a?.base64Data || '').startsWith('data:image/')
  );

  if (!image?.base64Data) {
    throw new Error('Picha haikupatikana. Tafadhali chagua picha tena.');
  }

  const userMsg = (params.message && params.message.trim()) || '';
  const isBanner = /banner/i.test(userMsg);
  const aspectRatio = isBanner ? '16:9' : '1:1';
  const apiKey = getStoredMagicHourApiKey();

  const response = await apiFetch<any>('/api/image/edit', {
    method: 'POST',
    body: JSON.stringify({
      prompt: userMsg || 'Hariri picha hii kwa umakini wa hali ya juu huku ukizingatia sifa zote za mtu aliyepo kwenye picha bila kubadilisha jinsia yake',
      imageBase64: image.base64Data,
      mimeType: image.mimeType || 'image/jpeg',
      filename: image.filename || 'picha_iliyohaririwa.png',
      aspectRatio,
      apiKey: apiKey || undefined,
    }),
  });

  if (!response?.success || !response?.file) {
    throw new Error(response?.error || response?.message || 'Magic Hour Studio haikurudisha picha iliyohaririwa.');
  }

  const reply = response.reply || 'Picha yako imehaririwa kwa ubora wa juu kupitia Magic Hour Studio.';
  const generatedFiles = response.generatedFiles || [response.file];

  if (params.onChunk) params.onChunk(reply, reply);

  return {
    reply,
    cleanSpeechText: cleanSpeech(reply),
    generatedFiles,
    engineUsed: 'server',
    aiProvider: 'Magic Hour Studio',
    chatModel: response.modelUsed || 'Magic Hour Studio',
    intent: 'image',
  };
}

async function processMagicHourGenerate(params: ChatEngineParams): Promise<ChatEngineResult> {
  const userMsg = (params.message && params.message.trim()) || '';
  const isBanner = /banner/i.test(userMsg);
  const aspectRatio = isBanner ? '16:9' : '1:1';
  const apiKey = getStoredMagicHourApiKey();

  const response = await apiFetch<any>('/api/image/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: params.message,
      aspectRatio,
      apiKey: apiKey || undefined,
    }),
  });

  if (!response?.success || !response?.file) {
    throw new Error(response?.error || response?.message || 'Magic Hour Studio haikurudisha picha.');
  }

  const reply = response.reply || 'Picha yako imetengenezwa kwa ubora wa juu kupitia Magic Hour Studio.';
  const generatedFiles = response.generatedFiles || [response.file];

  if (params.onChunk) params.onChunk(reply, reply);

  return {
    reply,
    cleanSpeechText: cleanSpeech(reply),
    generatedFiles,
    engineUsed: 'server',
    aiProvider: 'Magic Hour Studio',
    chatModel: response.modelUsed || 'Magic Hour Studio',
    intent: 'image',
  };
}

function consumeSseEvent(event: string, onPayload: (payload: any) => void): void {
  const dataLines = event.split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  if (!dataLines.length) return;
  const raw = dataLines.join('\n').trim();
  if (!raw || raw === '[DONE]') return;
  try { onPayload(JSON.parse(raw)); }
  catch (error) { console.warn('[MKUU-CLIENT] Ignoring malformed SSE event:', error); }
}

async function streamServerChat(params: ChatEngineParams, explicitBase?: string): Promise<ChatEngineResult> {
  const url = getApiUrl('/api/chat/stream', explicitBase);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      conversationId: params.conversationId,
      message: params.message,
      conversationHistory: (params.conversationHistory || []).slice(-10),
      people: params.people || [],
      attachments: params.attachments || [],
      isVoice: params.isVoice,
    }),
  });
  if (!response.ok || !response.body) {
    throw new MkuuApiError({
      code: 'BACKEND_UNREACHABLE',
      status: response.status,
      userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
      technicalDetails: `Streaming endpoint returned HTTP ${response.status}`,
      targetUrl: url,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let reply = '';
  let donePacket: any = null;

  const processPayload = (payload: any) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'delta' && typeof payload.text === 'string') {
      reply += payload.text;
      params.onChunk?.(payload.text, reply);
    } else if (payload.type === 'done') {
      donePacket = payload;
      if (!reply && typeof payload.reply === 'string') {
        reply = payload.reply;
        params.onChunk?.(payload.reply, reply);
      }
    } else if (payload.type === 'error') {
      throw new Error(payload.message || 'Streaming error');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let delimiter = buffer.indexOf('\n\n');
    while (delimiter !== -1) {
      const event = buffer.slice(0, delimiter);
      buffer = buffer.slice(delimiter + 2);
      consumeSseEvent(event, processPayload);
      delimiter = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (buffer.trim()) consumeSseEvent(buffer, processPayload);
  if (!reply.trim()) throw new Error('MKUU streaming returned no reply text');

  return {
    reply,
    cleanSpeechText: donePacket?.cleanSpeechText || cleanSpeech(reply),
    generatedFiles: donePacket?.generatedFiles,
    memoriesExtracted: donePacket?.memoriesExtracted,
    peopleRecognized: donePacket?.peopleRecognized,
    engineUsed: 'server',
    aiProvider: donePacket?.aiProvider || 'Google Gemini',
    chatModel: donePacket?.chatModel || 'gemini-3.1-flash-lite',
    intent: 'chat',
  };
}

async function fallbackStandardServerChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const data = await apiFetch<any>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: params.conversationId,
      message: params.message,
      conversationHistory: (params.conversationHistory || []).slice(-10),
      people: params.people || [],
      attachments: params.attachments || [],
      isVoice: params.isVoice,
    }),
  });
  const reply = data.reply || data.message || '';
  if (!reply.trim()) throw new Error('Seva ya MKUU haikutoa jibu. Tafadhali jaribu tena.');
  params.onChunk?.(reply, reply);
  return {
    reply,
    cleanSpeechText: data.cleanSpeechText || cleanSpeech(reply),
    generatedFiles: data.generatedFiles,
    memoriesExtracted: data.memoriesExtracted,
    peopleRecognized: data.peopleRecognized,
    engineUsed: 'server',
    aiProvider: data.aiProvider || 'Google Gemini',
    chatModel: data.chatModel || 'gemini-3.1-flash-lite',
    intent: 'chat',
  };
}

function isImageGenerationRequest(text: string): boolean {
  const t = (text || '').toLowerCase().trim();
  const imageTriggers = [
    'tengeneza picha',
    'chora picha',
    'unda picha',
    'fanya picha',
    'nifanyie picha',
    'nipatie picha',
    'niletee picha',
    'leta picha',
    'onesha picha ya',
    'onyesha picha ya',
    'generate image',
    'create image',
    'draw image',
    'make image',
    'generate a picture',
    'create a picture',
    'tengeneza logo',
    'unda logo',
    'create logo',
    'hd logo',
    'nembo ya',
    'tengeneza nembo',
    'unda nembo',
    'tengeneza banner',
    'unda banner',
    'create banner',
    'make banner',
    'design banner',
    'banner ya',
    'tengeneza katuni',
    'chora katuni',
    'create cartoon',
    'make cartoon',
    'cartoon picture',
    'make hd picture',
    'picha ya hd',
    'remove background',
    'ondoa background',
    'toa background',
    'tengeneza avatar',
    'tengeneza picha ya',
    'chora picha ya',
    'unda picha ya',
    'generate an image of',
    'picture of'
  ];
  if (imageTriggers.some((trigger) => t.includes(trigger))) return true;
  if (
    (t.includes('picha') || t.includes('image') || t.includes('photo') || t.includes('banner') || t.includes('logo') || t.includes('nembo') || t.includes('katuni') || t.includes('cartoon')) &&
    (t.includes('tengeneza') || t.includes('chora') || t.includes('unda') || t.includes('fanya') || t.includes('zalisha') || t.includes('create') || t.includes('generate') || t.includes('draw') || t.includes('design') || t.includes('make'))
  ) {
    return true;
  }
  return false;
}

export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  // CRITICAL FIX: image editing is handled before any normal chat/agent route.
  // This guarantees an attached image reaches Magic Hour Studio's editor.
  if (hasImageAttachment(params)) {
    return processMagicHourImage(params);
  }

  // Direct text-to-image intent routing to Magic Hour Studio
  if (isImageGenerationRequest(params.message)) {
    try {
      return await processMagicHourGenerate(params);
    } catch (err) {
      console.warn('[MKUU-CLIENT] Magic Hour Studio direct generation failed, falling back to agent:', err);
    }
  }

  const primaryBase = getApiBaseUrl();
  try {
    const result = await streamServerChat(params, primaryBase);
    if (result.reply.trim()) return result;
  } catch (error) {
    console.warn('[MKUU-CLIENT] Primary streaming failed:', (error as any)?.message || error);
  }

  const fallbackBase = getFallbackApiBaseUrl();
  if (fallbackBase !== primaryBase) {
    try {
      const result = await streamServerChat(params, fallbackBase);
      if (result.reply.trim()) return result;
    } catch (error) {
      console.warn('[MKUU-CLIENT] Fallback streaming failed:', (error as any)?.message || error);
    }
  }

  try {
    return await fallbackStandardServerChat(params);
  } catch (serverErr: any) {
    const directApiKey = getStoredGeminiApiKey();
    if (directApiKey && directApiKey.trim().length > 10) {
      throw new Error('Backend haipatikani; direct Gemini fallback haiwezi kuhariri picha.');
    }
    throw serverErr;
  }
}
