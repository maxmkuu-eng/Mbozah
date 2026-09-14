import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { searchWeb, formatAxaLiveAnswer, detectSearchIntent } from './webSearchService.js';

export interface StreamRequest {
  userId: string;
  message: string;
  conversationHistory?: any[];
  people?: any[];
  attachments?: any[];
}

const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];

function cleanHistory(history: any[]) {
  const turns = Array.isArray(history) ? history.slice(-10) : [];
  return turns
    .filter((m) => m && (m.content || m.parts))
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: Array.isArray(m.parts) ? m.parts : [{ text: String(m.content || '') }],
    }));
}

function getTanzaniaTimeContext() {
  const now = new Date();
  return {
    formattedString: new Intl.DateTimeFormat('sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now),
    iso: now.toISOString(),
  };
}

function cleanAxaSpeech(text: string) {
  return text
    .replace(/[*_~`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n\s*-\s*/g, '. ')
    .replace(/\n+/g, ' ')
    .trim();
}

export async function* streamGemini(request: StreamRequest): AsyncGenerator<string> {
  // HARD PROVIDER BOUNDARY:
  // AXA owns live web search. Gemini is never called for search requests.
  if (detectSearchIntent(request.message)) {
    const started = Date.now();
    const liveSearch = await searchWeb(request.message, {
      news: /habari|news|leo|sasa|latest|current|hivi punde|tukio|matokeo|ratiba|bei|price|weather|kifo|msiba|mazishi|anazikwa|msimamo|ligi|mechi|wasanii|burudani|kitaifa|kimataifa/i.test(request.message),
      numResults: 8,
    });
    const reply = formatAxaLiveAnswer(liveSearch, getTanzaniaTimeContext());
    yield reply;
    console.log(`[MKUU-BACKEND] [AXA_ONLY_STREAM] provider="AXA Live Web Search" latency=${Date.now() - started}ms`);
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');

  const client = new GoogleGenAI({ apiKey });
  const memories = db.getMemories(request.userId).slice(0, 30);
  const dbPeople = db.getPeople(request.userId).slice(0, 30);
  const suppliedPeople = Array.isArray(request.people) ? request.people.slice(0, 30) : [];
  const people = suppliedPeople.length ? suppliedPeople : dbPeople;

  const memoryText = memories.map((m) => `- [${m.category}] ${m.content}`).join('\n') || 'Hakuna memory ya ziada.';
  const peopleText = people.map((p) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; ${p.phone || ''}; ${p.notes || ''}`).join('\n') || 'Hakuna watu wa karibu waliosajiliwa.';
  const systemInstruction = `Wewe ni MKUU AI, agent binafsi wa Max. Jibu kwa Kiswahili fasaha isipokuwa mtumiaji atumie lugha nyingine. Usibuni taarifa ambazo hazipo. Tumia memory na watu wa karibu hapa chini. Ukipewa kazi yenye hatua nyingi, ifanye kwa mpangilio na toa matokeo ya mwisho.\n\nMAX MEMORY:\n${memoryText}\n\nWATU WA KARIBU:\n${peopleText}`;

  const contents = cleanHistory(request.conversationHistory || []);
  contents.push({ role: 'user', parts: [{ text: request.message }] });

  let lastError: any = null;
  for (const model of MODELS) {
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });
      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) yield text;
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('All Gemini streaming models are temporarily unavailable.');
}
