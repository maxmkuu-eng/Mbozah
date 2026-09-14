import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';
import { searchWeb, formatAxaLiveAnswer, WEB_SEARCH_PROVIDER, SearchQueryResult, detectSearchIntent } from './webSearchService.js';
import { findFootballMatch } from './sportService.js';

export const AI_PROVIDER = 'Google Gemini';
export const PERSONAL_CHAT_MODEL = 'gemini-3.1-flash-lite';
export const BACKEND_IDENTIFIER = 'MKUU Server';

export const CHAT_MODEL_FALLBACKS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
];

function extractRetryDelayMs(err: any): number {
  try {
    const errMsg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
    const match = errMsg.match(/retry in ([0-9.]+)s/i) || errMsg.match(/"retryDelay":\s*"([0-9.]+)s"/i);
    if (match && match[1]) {
      const sec = parseFloat(match[1]);
      if (!isNaN(sec) && sec > 0) return Math.min(Math.ceil(sec * 1000) + 300, 3500);
    }
  } catch {}
  return 1500;
}

export function getCurrentTanzaniaTimeContext(): {
  formattedString: string;
  dayOfWeek: string;
  dateString: string;
  timeString: string;
  timeZone: string;
  iso: string;
} {
  const now = new Date();
  const timeZone = 'Africa/Dar_es_Salaam';
  const fullFormatter = new Intl.DateTimeFormat('sw-TZ', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fullFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = getPart('weekday');
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');
  const formattedString = `${weekday}, ${day} ${month} ${year}, saa ${hour}:${minute}:${second}, Africa/Dar_es_Salaam (UTC+3)`;
  return {
    formattedString,
    dayOfWeek: weekday,
    dateString: `${day} ${month} ${year}`,
    timeString: `${hour}:${minute}:${second}`,
    timeZone,
    iso: now.toISOString(),
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | string;
  content: string;
  attachments?: any[];
  generatedFiles?: any[];
}

export interface ProcessChatParams {
  userId: string;
  message: string;
  conversationHistory?: ChatMessage[];
  isVoice?: boolean;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    size?: number;
    base64Data?: string;
  }>;
}

export interface ChatProcessResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted: Array<{ category: string; content: string }>;
  peopleRecognized: Array<{ name: string; relationship: string }>;
  generatedFiles: GeneratedFileSummary[];
  aiProvider: string;
  chatModel: string;
  latencyMs: number;
}

export class GeminiService {
  private static instance: GeminiService | null = null;
  private aiClient: GoogleGenAI | null = null;

  public static readonly AI_PROVIDER = AI_PROVIDER;
  public static readonly PERSONAL_CHAT_MODEL = PERSONAL_CHAT_MODEL;
  public static readonly BACKEND_IDENTIFIER = BACKEND_IDENTIFIER;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) GeminiService.instance = new GeminiService();
    return GeminiService.instance;
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'mkuu-ai-backend-gemini-service' } },
      });
    }
    return this.aiClient;
  }

  public async getHealthStatus(): Promise<{
    aiProvider: string;
    chatModel: string;
    backend: string;
    status: 'connected' | 'unavailable';
    latencyMs?: number;
    error?: string;
  }> {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: hasKey ? 'connected' : 'unavailable', latencyMs: 5 };
  }

  public async processChat(params: ProcessChatParams): Promise<ChatProcessResult> {
    const startTime = Date.now();
    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;
    console.log(`[MKUU-BACKEND] [CHAT_REQUEST_RECEIVED] user=${userId} msgLen=${message?.length || 0} attachCount=${attachments?.length || 0}`);
    const user = db.getUser(userId) || db.getOwner();
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);
    const recognizedPeople = this.getRecognizedPeople(message, people, newlySavedPerson);
    const systemPrompt = this.buildSystemPrompt({ user, memories, people, newlySavedMemory, newlySavedPerson });
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);
    const isSearchQuery = this.detectSearchIntent(message);
    let liveSearch: Awaited<ReturnType<typeof searchWeb>> | null = null;
    let axaSearchFailed = false;

    if (isSearchQuery) {
      try {
        liveSearch = await searchWeb(message, {
          news: /habari|news|leo|sasa|latest|current|hivi punde|tukio|matokeo|ratiba|bei|price|weather|kifo|msiba|mazishi|anazikwa|msimamo|ligi|mechi|wasanii|burudani|kitaifa|kimataifa/i.test(message),
          numResults: 8,
        });
        console.log(`[MKUU-BACKEND] [AXA_WEB_SEARCH] provider="${WEB_SEARCH_PROVIDER}" results=${liveSearch.results.length}`);
        if (liveSearch.results.length === 0) axaSearchFailed = true;
      } catch (webErr: any) {
        axaSearchFailed = true;
        console.error('[MKUU-BACKEND] AXA web search failed:', webErr?.message || webErr);
      }
      const timeContext = getCurrentTanzaniaTimeContext();
      const reply = await this.synthesizeAxaAnswer(message, liveSearch, timeContext);
      return {
        reply,
        cleanSpeechText: this.cleanMarkdownForVoice(reply),
        memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
        peopleRecognized: recognizedPeople,
        generatedFiles: generatedFilesList,
        aiProvider: WEB_SEARCH_PROVIDER,
        chatModel: 'AXA Live Web Search',
        latencyMs: Date.now() - startTime,
      };
    }

    const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } };
    console.log(`[MKUU-BACKEND] [GEMINI_REQUEST_STARTED] provider="${AI_PROVIDER}" model="${PERSONAL_CHAT_MODEL}" searchGrounding=${isSearchQuery}`);
    let aiReplyText = '';
    let usedModel = PERSONAL_CHAT_MODEL;
    try {
      aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });
      console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model="${usedModel}" latency=${Date.now() - startTime}ms status=200`);
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      console.error(`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="${errMsg}" latency=${Date.now() - startTime}ms`);
      const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Rate limit') || errMsg.includes('exceeded your current quota');
      if (isRateLimit) {
        aiReplyText = `Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). \n\nTafadhali subiri sekunde chache kisha ubonyeze **'JARIBU TENA'** au unitumie ujumbe tena, nitaendelea kukuhudumia mara moja.`;
      } else {
        throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${err?.message || 'Huduma haikupatikana kwa sasa'}`);
      }
    }
    if (fileIntent) {
      try {
        const genFile = await generateRealFile({ userId, filename: fileIntent.filename, fileType: fileIntent.fileType, title: fileIntent.title, content: aiReplyText, description: fileIntent.description });
        generatedFilesList.push(genFile);
      } catch (err) { console.warn('[MKUU-BACKEND] File generation note:', err); }
    }
    const cleanSpeechText = this.cleanMarkdownForVoice(aiReplyText);
    return {
      reply: aiReplyText,
      cleanSpeechText,
      memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
      peopleRecognized: recognizedPeople,
      generatedFiles: generatedFilesList,
      aiProvider: AI_PROVIDER,
      chatModel: PERSONAL_CHAT_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  public async *streamChat(params: ProcessChatParams): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'done'; result: ChatProcessResult }, void, unknown> {
    const { userId, message, conversationHistory = [], attachments = [] } = params;
    const startTime = Date.now();
    console.log(`[MKUU-BACKEND] [CHAT_STREAM_STARTED] user=${userId} msgLen=${message?.length || 0}`);
    const user = db.getUser(userId) || db.getOwner();
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);
    const recognizedPeople = this.getRecognizedPeople(message, people, newlySavedPerson);
    const systemPrompt = this.buildSystemPrompt({ user, memories, people, newlySavedMemory, newlySavedPerson });
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);
    const isSearchQuery = this.detectSearchIntent(message);
    let liveSearch: Awaited<ReturnType<typeof searchWeb>> | null = null;
    let axaSearchFailed = false;

    if (isSearchQuery) {
      try {
        liveSearch = await searchWeb(message, {
          news: /habari|news|leo|sasa|latest|current|hivi punde|tukio|matokeo|ratiba|bei|price|weather|kifo|msiba|mazishi|anazikwa|msimamo|ligi|mechi|wasanii|burudani|kitaifa|kimataifa/i.test(message),
          numResults: 8,
        });
        console.log(`[MKUU-BACKEND] [AXA_WEB_SEARCH_STREAM] provider="${WEB_SEARCH_PROVIDER}" results=${liveSearch.results.length}`);
        if (liveSearch.results.length === 0) axaSearchFailed = true;
      } catch (webErr: any) {
        axaSearchFailed = true;
        console.error('[MKUU-BACKEND] AXA web search failed in stream:', webErr?.message || webErr);
      }
      const timeContext = getCurrentTanzaniaTimeContext();
      for await (const chunk of this.streamSynthesizedAxaReport(message, liveSearch, timeContext, newlySavedMemory, recognizedPeople, startTime, axaSearchFailed)) yield chunk;
      return;
    }

    const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } };
    const client = this.getClient();
    const modelsToTry = [PERSONAL_CHAT_MODEL, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== PERSONAL_CHAT_MODEL)];
    let fullReply = '';
    let streamStarted = false;
    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const stream = await client.models.generateContentStream({ model, contents, config: generationConfig });
        for await (const chunk of stream) {
          const text = chunk.text || '';
          if (text) { streamStarted = true; fullReply += text; yield { type: 'delta', text }; }
        }
        if (fullReply.trim().length > 0) break;
      } catch (err: any) {
        lastError = err;
        if (streamStarted && fullReply.length > 0) break;
      }
    }
    if (!fullReply.trim()) {
      const errMsg = String(lastError?.message || '');
      const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
      if (isRateLimit) {
        const rateLimitMsg = `Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota).\n\nTafadhali subiri sekunde chache kisha ubonyeze **'JARIBU TENA'** au unitumie ujumbe tena, nitaendelea kukuhudumia mara moja.`;
        fullReply = rateLimitMsg;
        yield { type: 'delta', text: rateLimitMsg };
      } else throw lastError || new Error('Google Gemini streaming failed');
    }
    if (fileIntent) {
      try {
        const genFile = await generateRealFile({ userId, filename: fileIntent.filename, fileType: fileIntent.fileType, title: fileIntent.title, content: fullReply, description: fileIntent.description });
        generatedFilesList.push(genFile);
      } catch (err) { console.warn('[MKUU-BACKEND] File generation note in stream:', err); }
    }
    const cleanSpeechText = this.cleanMarkdownForVoice(fullReply);
    yield { type: 'done', result: { reply: fullReply, cleanSpeechText, memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [], peopleRecognized: recognizedPeople, generatedFiles: generatedFilesList, aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, latencyMs: Date.now() - startTime } };
  }

  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {
    const client = this.getClient();
    const preferred = params.preferredModel || PERSONAL_CHAT_MODEL;
    const modelsToTry = [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];
    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });
        const text = response.text;
        if (text && text.trim().length > 0) return text;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) await new Promise((r) => setTimeout(r, 400));
      }
    }
    throw lastError || new Error('All Gemini model candidates are temporarily unavailable.');
  }

  private buildSystemPrompt(context: { user: any; memories: Memory[]; people: Person[]; newlySavedMemory: any; newlySavedPerson?: any }): string {
    const { user, memories, people, newlySavedMemory, newlySavedPerson } = context;
    const timeContext = getCurrentTanzaniaTimeContext();
    return `
Wewe ni **MKUU AI** (Mkuu), msaidizi binafsi mwenye akili ya hali ya juu aliyejengwa mahsusi kwa ajili ya mmiliki wako anayeitwa **MAX**.
Seva ya nyuma (backend) ya MKUU inaendeshwa na injini ya **Google Gemini API** kupitia modeli ya **Gemini 3.8 Flash (${PERSONAL_CHAT_MODEL})**.

UTAMBULISHO WA MMILIKI:
- Jina la Mmiliki: ${user.name} (Max)
- Barua Pepe: ${user.email}
- Hadhi: Mmiliki Pekee Aliyeidhinishwa (Authorized Owner)

MUDA, TAREHE NA SIKU YA SASA YA TANZANIA (SERVER REAL-TIME CLOCK):
- Muda Kamili wa Sasa: ${timeContext.formattedString}
- Siku ya Leo: ${timeContext.dayOfWeek}
- Tarehe ya Leo: ${timeContext.dateString}
- Saa ya Sasa: ${timeContext.timeString} (${timeContext.timeZone}, UTC+3)
- MAAGIZO MAHUSUSI YA MUDA: Akiuliza "Saa ngapi?", "Ni saa ngapi sasa?", "Leo ni siku gani?", "Leo tarehe ngapi?", au swali lolote la wakati/tarehe, jibu moja kwa moja kwa usahihi ukitumia muda na tarehe halisi ya sasa iliyoonyeshwa hapa juu. Kamwe usiseme kwamba huwezi kuona saa au huna access ya location.

MAADILI NA TABIA YA MKUU AI:
1. Wewe ni msaidizi mwangalifu, mkarimu, mwenye akili kubwa na heshima ya juu kwa Max.
2. Lugha ya msingi ni **Kiswahili fasaha na cha asili**. Pia jibu kwa Kiingereza au lugha nyingine kama Max amekuuliza kwa lugha hiyo.
3. Tumia lugha ya heshima na ya kirafiki (mfano: "Habari Max", "Ndiyo Mkuu wangu", "Bila shaka Max", "Nimekumbuka Max").
4. **KANUNI KUU YA KUMBUKUMBU ZA KUDUMU (MAX PERSISTENT MEMORY):**
   - Hapa chini kuna orodha kamili ya kumbukumbu zote ambazo Max amekuambia uhifadhi (zimehifadhiwa kwenye database ya kudumu ya MKUU AI).
   - Hata ikitokea kupita siku ngapi, miezi au miaka, kumbukumbu hizi hazipotei wala kusahaulika kamwe!
   - Max akikuuliza: "Unakumbuka nilichokwambia?", "Nilikuambia nini kuhusu X?", "Unakumbuka X?", "Kumbukumbu zangu zinasemaje?", "Kumbukumbu zangu ni zipi?", "Nisomee kumbukumbu nilizokwambia uhifadhi", au swali lolote linalohusu yale aliyowahi kukuambia uhifadhi au kukumbuka:
     * Kagua kwa umakini mkubwa ORODHA YA KUMBUKUMBU ZA KUDUMU ZA MAX hapa chini.
     * Mjibu kwa ufasaha na uhakika mkubwa wa 100%, ukimtajia kile ulichohifadhi kama alivyoeleza.
     * Ikiwa Max anakuambia jambo jipya la kukumbuka au kuhifadhi (mfano "Kumbuka...", "Hifadhi..."), mthibitishie kwa uaminifu kuwa umelihifadhi salama kwenye Max Memory na litadumu milele bila kusahaulika.
     * Ikiwa jambo halipo kabisa kwenye orodha ya kumbukumbu, mweleze kwa heshima kuwa taarifa hiyo bado haijawekwa kwenye kumbukumbu zako, lakini yuko huru kukuambia nawe utaihifadhi mara moja.

5. **KANUNI KUU YA UTAMBUZI WA WATU WA KARIBU (MAX IDENTIFY):**
   - Hapa chini kuna orodha kamili ya Watu wa Karibu wa Max waliosajiliwa kwenye mfumo (ikiwa na Majina, Namba zao za Simu, Uhusiano, Majina ya Utani na Maelezo).
   - Max au mtu mwingine akimtaja mtu kwa JINA, JINA LA UTANI (NICKNAME), UHUSIANO (mfano "mke wangu", "mama yangu", "kaka yangu", "boss wangu", "rafiki yangu"), au ataandika NAMBA YAKE YA SIMU (mfano "07...", "06...", "+255...", "Hii namba ni ya nani?", "Nani mwenye namba hii?"):
     * Mtambue mtu huyo mara moja kwa usahihi wa 100%!
     * Mjibu Max moja kwa moja kwa kumtaja jina lake, uhusiano wake na Max, na namba yake ya simu kulingana na orodha ya Watu wa Karibu.
     * Zingatia: Namba za simu nchini Tanzania zinaweza kuandikwa kwa muundo tofauti (mfano 0712345678, +255 712 345 678, au 255712345678), zote zinamtambulisha mtu huyo huyo.
     * Kamwe usiseme "Simfahamu mtu huyu" au "Sina taarifa zake" ikiwa yupo kwenye orodha ya Watu Wangu wa Karibu!
     * Ikiwa Max anakutambulisha mtu mpya au anakupa namba mpya ya kuhifadhi (mfano "Huyu ni [Jina] namba [Simu] ni [Uhusiano]"), mthibitishie kuwa umemsajili kwenye Watu wa Karibu na utamtambua kila wakati.

6. **KANUNI YA MAFAILI NA NYARAKA:** Mfumo huu una injini halisi ya kuzalisha mafaili (PDF, Excel, Word, CSV).
7. **KANUNI YA MAJUKUMU (NORMAL CHAT PEKEE):**
   - MKUU/Gemini anahusika pekee na mazungumzo ya kawaida, uchambuzi, ushauri, ufafanuzi, nyaraka, hadithi na utatuzi wa matatizo.
   - Hauruhusiwi kabisa kujibu au kuingilia maswali ya live web search. Kazi hiyo inafanywa pekee na AXA bila kuingiliwa na Gemini.

---
ORODHA YA KUMBUKUMBU ZA KUDUMU ZA MAX (MAX PERSISTENT MEMORY):
${memories.length > 0 ? memories.map((m, i) => `${i + 1}. [${m.category}] ${m.content} (Tarehe: ${m.createdAt})`).join('\n') : 'Hakuna kumbukumbu za ziada zilizohifadhiwa kwa sasa. Max atakapokupa kumbukumbu za kuhifadhi, zitaonekana hapa.'}

---
ORODHA YA WATU WANGU WA KARIBU (MAX IDENTIFY / CLOSE PEOPLE):
${people.length > 0 ? people.map((p, i) => `${i + 1}. Jina: ${p.name} | Uhusiano: ${p.relationship}${p.nickname ? ` | Jina la utani: ${p.nickname}` : ''}${p.phone ? ` | Namba ya Simu: ${p.phone}` : ''}${p.email ? ` | Email: ${p.email}` : ''}${p.notes ? ` | Maelezo: ${p.notes}` : ''}`).join('\n') : 'Hakuna mtu wa karibu aliyesajiliwa kwa sasa. Max atakapoorodhesha watu wake au namba zao za simu, watasajiliwa hapa na utawatambua mara moja.'}

${newlySavedMemory ? `TAARIFA YA SASA HIVI: Max ametoka kutoa amri ya kukumbuka: "${newlySavedMemory.content}". Hii imehifadhiwa kwenye kumbukumbu za kudumu.` : ''}
${newlySavedPerson ? `TAARIFA YA SASA HIVI: Max ametoka kusajili mtu mpya wa karibu: ${newlySavedPerson.name} (${newlySavedPerson.relationship})${newlySavedPerson.phone ? `, Simu: ${newlySavedPerson.phone}` : ''}. Huyu amesajiliwa kwenye orodha.` : ''}
`;
  }

  private buildConversationHistory(history: ChatMessage[], currentMessage: string, attachments: any[]): Array<{ role: 'user' | 'model'; parts: any[] }> {
    const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];
    const rawHistory = Array.isArray(history) ? [...history] : [];
    if (rawHistory.length > 0) {
      const last = rawHistory[rawHistory.length - 1];
      if (last.role === 'user' && (last.content === currentMessage || (!last.content && !currentMessage))) rawHistory.pop();
    }
    const recentHistory = rawHistory.slice(-20);
    for (const h of recentHistory) {
      const text = (h.content || '').trim();
      if (!text && (!h.attachments || h.attachments.length === 0)) continue;
      const role: 'user' | 'model' = h.role === 'user' ? 'user' : 'model';
      const parts: any[] = [];
      if (text) parts.push({ text });
      if (h.attachments && Array.isArray(h.attachments)) {
        for (const att of h.attachments) {
          if (att.previewUrl?.startsWith('data:image/') || att.base64Data) {
            const b64 = (att.previewUrl || att.base64Data || '').replace(/^data:image\/\w+;base64,/, '');
            if (b64) parts.push({ inlineData: { data: b64, mimeType: att.mimeType || 'image/jpeg' } });
          }
        }
      }
      if (parts.length === 0) continue;
      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === role) lastTurn.parts.push(...parts); else contents.push({ role, parts });
    }
    if (contents.length > 0 && contents[0].role === 'model') contents.unshift({ role: 'user', parts: [{ text: 'Habari MKUU AI, mimi ni Max mmiliki wako.' }] });
    const currentUserParts: any[] = [];
    if (currentMessage) currentUserParts.push({ text: currentMessage });
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data) {
          const rawBase64 = att.base64Data.includes(',') ? att.base64Data.split(',')[1] : att.base64Data;
          if (att.mimeType && att.mimeType.startsWith('image/')) currentUserParts.push({ inlineData: { data: rawBase64, mimeType: att.mimeType } });
          else if (att.mimeType === 'application/pdf') currentUserParts.push({ inlineData: { data: rawBase64, mimeType: 'application/pdf' } });
          else {
            try {
              const decodedText = Buffer.from(rawBase64, 'base64').toString('utf-8');
              currentUserParts.push({ text: `\n\n[Faili: ${att.filename}]:\n${decodedText.slice(0, 8000)}\n---` });
            } catch { currentUserParts.push({ text: `\n\n[Faili lililoambatanishwa: ${att.filename}]` }); }
          }
        }
      }
    }
    if (currentUserParts.length === 0) currentUserParts.push({ text: currentMessage || 'Tafadhali endelea na mazungumzo.' });
    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === 'user') lastTurn.parts.push(...currentUserParts); else contents.push({ role: 'user', parts: currentUserParts });
    return contents;
  }

  private normalizeDigits(phone?: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('255')) return digits.slice(3);
    if (digits.startsWith('0')) return digits.slice(1);
    return digits;
  }

  public getRecognizedPeople(message: string, allPeople: Person[] | string, newlySavedPerson?: Person | null): Array<{ name: string; relationship: string }> {
    const list: Array<{ name: string; relationship: string }> = [];
    const seenNames = new Set<string>();

    if (newlySavedPerson) {
      list.push({ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship });
      seenNames.add(newlySavedPerson.name.toLowerCase());
    }

    const msgLower = (message || '').toLowerCase();
    const msgDigits = this.normalizeDigits(message);
    const peopleList: Person[] = typeof allPeople === 'string' ? db.getPeople(allPeople) : (Array.isArray(allPeople) ? allPeople : []);

    for (const p of peopleList) {
      if (seenNames.has(p.name.toLowerCase())) continue;

      let matched = false;
      // Match by name
      if (p.name && p.name.trim().length >= 2 && msgLower.includes(p.name.toLowerCase())) {
        matched = true;
      }
      // Match by nickname
      if (!matched && p.nickname && p.nickname.trim().length >= 2 && msgLower.includes(p.nickname.toLowerCase())) {
        matched = true;
      }
      // Match by relationship keyword
      if (!matched && p.relationship && p.relationship.trim().length >= 3 && msgLower.includes(p.relationship.toLowerCase())) {
        matched = true;
      }
      // Match by phone number
      if (!matched && p.phone) {
        const pDigits = this.normalizeDigits(p.phone);
        if (pDigits && pDigits.length >= 7) {
          if (msgDigits.includes(pDigits) || pDigits.includes(msgDigits) || msgLower.includes(p.phone.toLowerCase())) {
            matched = true;
          }
        }
      }

      if (matched) {
        list.push({ name: p.name, relationship: p.relationship });
        seenNames.add(p.name.toLowerCase());
      }
    }

    return list;
  }

  public detectAndSaveMemory(userId: string, message: string): Memory | null {
    if (!message) return null;
    const lower = message.toLowerCase().trim();
    const memoryTriggers = [
      'kumbuka kwamba',
      'kumbuka kuwa',
      'kumbuka hii:',
      'kumbuka hii',
      'kumbuka:',
      'kumbuka ',
      'hifadhi kwamba',
      'hifadhi kuwa',
      'hifadhi hii:',
      'hifadhi hii',
      'hifadhi taarifa hii:',
      'hifadhi taarifa hii',
      'hifadhi:',
      'hifadhi ',
      'weka kwenye kumbukumbu kwamba',
      'weka kwenye kumbukumbu kuwa',
      'weka kwenye kumbukumbu:',
      'weka kwenye kumbukumbu',
      'weka kumbukumbu kwamba',
      'weka kumbukumbu kuwa',
      'weka kumbukumbu:',
      'weka kumbukumbu',
      'usisahau kwamba',
      'usisahau kuwa',
      'usisahau:',
      'usisahau ',
      'usiache kukumbuka',
      'iweke kwenye kumbukumbu',
      'tunza kwenye kumbukumbu',
      'tunza hii kumbukumbu',
      'zingatia kwamba',
      'zingatia kuwa',
      'zingatia hili:',
      'zingatia hili',
      'remember that',
      'remember this',
      'remember:',
      'save this:',
      'save that',
      'store this',
    ];

    const matchedTrigger = memoryTriggers.find((t) => lower.startsWith(t) || lower.includes(t));
    if (!matchedTrigger) return null;

    let contentToSave = message;
    if (lower.startsWith(matchedTrigger)) {
      contentToSave = message.slice(matchedTrigger.length).replace(/^[:\s,]+/, '').trim();
    } else {
      const idx = lower.indexOf(matchedTrigger);
      contentToSave = message.slice(idx + matchedTrigger.length).replace(/^[:\s,]+/, '').trim();
    }

    if (contentToSave.length < 3) return null;

    // Check if duplicate already exists in DB
    const existing = db.getMemories(userId);
    if (existing.some((m) => m.content.toLowerCase().trim() === contentToSave.toLowerCase().trim())) {
      return null;
    }

    let category: 'General' | 'Preferences' | 'Work' | 'Family' | 'Health' | 'Finance' | 'Rules' = 'General';
    const cl = contentToSave.toLowerCase();
    if (cl.includes('mke') || cl.includes('mtoto') || cl.includes('mama') || cl.includes('baba') || cl.includes('familia') || cl.includes('ndugu')) category = 'Family';
    else if (cl.includes('pesa') || cl.includes('biashara') || cl.includes('mteja') || cl.includes('mkataba') || cl.includes('kampuni') || cl.includes('shilingi') || cl.includes('dola')) category = 'Finance';
    else if (cl.includes('password') || cl.includes('nenosiri') || cl.includes('pin') || cl.includes('akaunti') || cl.includes('namba ya') || cl.includes('sheria') || cl.includes('kanuni')) category = 'Rules';
    else if (cl.includes('kazi') || cl.includes('ofisi') || cl.includes('mradi') || cl.includes('boss') || cl.includes('ripoti')) category = 'Work';
    else if (cl.includes('afya') || cl.includes('dawa') || cl.includes('hospitali') || cl.includes('chakula') || cl.includes('mazoezi')) category = 'Health';
    else if (cl.includes('napenda') || cl.includes('mimi ni') || cl.includes('tabia') || cl.includes('napendelea')) category = 'Preferences';

    return db.addMemory({
      userId,
      category,
      content: contentToSave,
      importance: 'high',
      tags: [category.toLowerCase(), 'max_memory'],
      source: 'explicit_command',
    });
  }

  public detectAndSavePerson(userId: string, message: string): Person | null {
    if (!message) return null;
    const cleanMsg = message.trim();
    const lower = cleanMsg.toLowerCase();

    // Check if user is asking/querying instead of registering
    if (
      lower.startsWith('je,') ||
      lower.startsWith('je ') ||
      lower.includes('ni nani') ||
      lower.includes('yuko wapi') ||
      lower.includes('yupo') ||
      lower.startsWith('nipe taarifa') ||
      lower.startsWith('nipe namba') ||
      lower.startsWith('mpigie') ||
      lower.startsWith('mtumie')
    ) {
      return null;
    }

    // Extract potential phone number (handles formats like 0712345678, +255 784 123 456, +255784123456, 0655 11 22 33, 255755123456)
    const phoneMatch = cleanMsg.match(/(?:\+?255[\s-]?|0)[67]\d(?:[\s-]?\d){7}/);
    const extractedPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : undefined;

    // Check triggers for adding/saving a person
    const isPersonRegistration =
      lower.includes('huyu ni') ||
      lower.includes('huyu anaitwa') ||
      lower.includes('mtu wangu wa karibu') ||
      lower.includes('watu wangu wa karibu') ||
      lower.includes('ongeza mtu') ||
      lower.includes('msajili') ||
      lower.includes('weka mtu') ||
      lower.includes('hifadhi mtu') ||
      lower.includes('hifadhi namba ya') ||
      lower.includes('weka namba ya') ||
      lower.includes('anaitwa') ||
      ((lower.includes('mke') || lower.includes('mama') || lower.includes('baba') || lower.includes('kaka') || lower.includes('dada') || lower.includes('rafiki')) && (extractedPhone || lower.includes('namba')));

    if (!isPersonRegistration && !extractedPhone) return null;

    let name = '';
    let relationship = '';

    // Extract relationship if mentioned
    const relKeywords = [
      'mke wangu', 'mke', 'mume wangu', 'mume',
      'mama yangu', 'mama', 'baba yangu', 'baba',
      'kaka yangu', 'kaka', 'dada yangu', 'dada',
      'mtoto wangu', 'mtoto', 'binti yangu', 'kijana wangu',
      'rafiki yangu', 'rafiki', 'jirani yangu', 'jirani',
      'dereva wangu', 'dereva', 'msaidizi wangu', 'msaidizi',
      'mfanyakazi wangu', 'mfanyakazi', 'boss wangu', 'boss', 'bosi wangu', 'bosi',
      'mwanasheria wangu', 'daktari wangu', 'mhasibu wangu'
    ];
    for (const rk of relKeywords) {
      if (new RegExp(`\\b${rk}\\b`, 'i').test(cleanMsg)) {
        relationship = rk;
        break;
      }
    }

    // Pattern 1: "anaitwa [Name]"
    const anaitwaMatch = cleanMsg.match(/anaitwa\s+([A-Za-z0-9\s.]+?)(?:\s+(?:namba|simu|ni|kama)|\s*$)/i);
    if (anaitwaMatch) {
      name = anaitwaMatch[1].trim();
    }

    // Pattern 2: "huyu ni [Name]"
    if (!name) {
      const huyuMatch = cleanMsg.match(/huyu\s+ni\s+([A-Za-z0-9\s.]+?)(?:\s+(?:namba|simu|yake|ni|kama)|\s*$)/i);
      if (huyuMatch) {
        name = huyuMatch[1].trim();
      }
    }

    // Pattern 3: "hifadhi/weka namba ya [Name]"
    if (!name) {
      const nambaYaMatch = cleanMsg.match(/(?:namba|simu)\s+ya\s+([A-Za-z0-9\s.]+?)(?:\s+(?:ni|kama)|\s*$)/i);
      if (nambaYaMatch) {
        name = nambaYaMatch[1].trim();
      }
    }

    // Pattern 4: "[Rel] anaitwa/ni [Name]"
    if (!name) {
      const relNameMatch = cleanMsg.match(/(?:mke|mama|baba|kaka|dada|mtoto|rafiki|dereva|msaidizi|boss)\s+(?:wangu|yangu)?\s+(?:anaitwa|ni)\s+([A-Za-z0-9\s.]+?)(?:\s+(?:namba|simu|yake)|\s*$)/i);
      if (relNameMatch) {
        name = relNameMatch[1].trim();
      }
    }

    // Fallback name extraction
    if (!name && extractedPhone) {
      const parts = cleanMsg.replace(extractedPhone, '').split(/\s+/).filter(w => w.length > 1 && !['huyu', 'ni', 'namba', 'yake', 'wangu', 'yangu', 'mtu'].includes(w.toLowerCase()));
      if (parts.length > 0) {
        name = parts[0];
      }
    }

    if (!name) return null;

    // Clean up extracted name
    if (extractedPhone) {
      name = name.replace(extractedPhone, '').trim();
    }
    name = name.replace(/\b(namba|simu|nambari|ya|yake|wa|yangu|wangu|kama|ni|anaitwa|huyu)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const nameWords = name.split(/\s+/).filter(Boolean);
    if (nameWords.length > 3) {
      name = nameWords.slice(0, 2).join(' ');
    }
    if (name.length < 2) return null;

    if (!relationship) relationship = 'Mtu wa karibu';

    const existingPeople = db.getPeople(userId);
    const existing = existingPeople.find((p) => {
      if (p.name.toLowerCase() === name.toLowerCase()) return true;
      if (extractedPhone && p.phone && this.normalizeDigits(p.phone) === this.normalizeDigits(extractedPhone)) return true;
      return false;
    });

    if (existing) {
      return db.updatePerson(existing.id, userId, {
        phone: extractedPhone || existing.phone,
        relationship: relationship !== 'Mtu wa karibu' ? relationship : existing.relationship,
      });
    }

    return db.addPerson({
      userId,
      name,
      relationship,
      phone: extractedPhone,
      avatarColor: 'emerald',
      notes: `Amesajiliwa na Max: ${name} (${relationship})${extractedPhone ? `, Simu: ${extractedPhone}` : ''}`,
    });
  }

  private detectSearchIntent(message: string): boolean { return detectSearchIntent(message); }

  private detectFileGenerationIntent(message: string): { filename: string; fileType: 'pdf' | 'docx' | 'xlsx' | 'csv'; title: string; description: string } | null {
    const lower = (message || '').toLowerCase();
    const dateSuffix = new Date().toISOString().slice(0, 10);
    if (lower.includes('tengeneza pdf') || lower.includes('andaa pdf') || lower.includes('nipe pdf') || lower.includes('ripoti ya pdf')) return { filename: `Ripoti_ya_Max_${dateSuffix}.pdf`, fileType: 'pdf', title: 'Ripoti Rasmi ya PDF', description: 'Waraka rasmi wa PDF ulioandaliwa na MKUU AI' };
    if (lower.includes('excel') || lower.includes('spreadsheet') || lower.includes('lahajedwali') || lower.includes('hesabu za excel')) return { filename: `Jedwali_la_Max_${dateSuffix}.xlsx`, fileType: 'xlsx', title: 'Jedwali la Excel (XLSX)', description: 'Jedwali la hesabu na takwimu lililoandaliwa na MKUU AI' };
    if (lower.includes('word') || lower.includes('doc') || lower.includes('barua') || lower.includes('mkataba')) return { filename: `Waraka_wa_Max_${dateSuffix}.docx`, fileType: 'docx', title: 'Waraka wa Microsoft Word', description: 'Waraka rasmi wa maandishi ulioandaliwa na MKUU AI' };
    if (lower.includes('csv') || lower.includes('faili la csv')) return { filename: `Takwimu_za_Max_${dateSuffix}.csv`, fileType: 'csv', title: 'Faili la Takwimu za CSV', description: 'Faili la CSV la uchanganuzi wa data lililoandaliwa na MKUU AI' };
    return null;
  }

  private async synthesizeAxaAnswer(message: string, liveSearch: SearchQueryResult | null, timeContext: ReturnType<typeof getCurrentTanzaniaTimeContext>): Promise<string> {
    // Check if query is about football/sports and sportService has verified fixture/result
    if (/simba|yanga|young africans|azam|mechi|mchezo|ratiba|matokeo|fixture|soka|mpira|uwanja|champions league|ligi kuu/i.test(message)) {
      const sportMatch = await findFootballMatch(message);
      if (sportMatch) return sportMatch;
    }
    // IMPORTANT: AXA is the sole provider for live/current web answers. Gemini is never called here.
    if (liveSearch && liveSearch.sources.length > 0) return formatAxaLiveAnswer(liveSearch, timeContext);
    return `AXA Live Web Search haikuweza kupata taarifa za sasa mtandaoni kwa swali hili.\nMuda wa utafutaji: ${timeContext.formattedString}`;
  }

  private async *streamSynthesizedAxaReport(
    message: string,
    liveSearch: SearchQueryResult | null,
    timeContext: ReturnType<typeof getCurrentTanzaniaTimeContext>,
    newlySavedMemory: any,
    newlySavedPerson: any,
    startTime: number,
    _axaSearchFailed: boolean
  ): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'done'; result: any }, void, unknown> {
    // IMPORTANT: Check sportService first for football queries
    let fullReply = '';
    let usedProvider = WEB_SEARCH_PROVIDER;
    let usedModel = 'AXA Live Web Search';

    if (/simba|yanga|young africans|azam|mechi|mchezo|ratiba|matokeo|fixture|soka|mpira|uwanja|champions league|ligi kuu/i.test(message)) {
      const sportMatch = await findFootballMatch(message);
      if (sportMatch) {
        fullReply = sportMatch;
        usedProvider = 'FotMob & Azam Sports (Live)';
        usedModel = 'MKUU Live Sports Engine';
      }
    }

    if (!fullReply) {
      fullReply = liveSearch && liveSearch.sources.length > 0
        ? formatAxaLiveAnswer(liveSearch, timeContext)
        : `AXA Live Web Search haikuweza kupata taarifa za sasa mtandaoni kwa swali hili.\nMuda wa utafutaji: ${timeContext.formattedString}`;
    }

    yield { type: 'delta', text: fullReply };
    const cleanSpeechText = this.cleanMarkdownForVoice(fullReply);
    yield {
      type: 'done',
      result: {
        reply: fullReply,
        cleanSpeechText,
        memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
        peopleRecognized: Array.isArray(newlySavedPerson) ? newlySavedPerson : (newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : []),
        generatedFiles: [],
        aiProvider: usedProvider,
        chatModel: usedModel,
        latencyMs: Date.now() - startTime,
      },
    };
  }

  private cleanMarkdownForVoice(text: string): string {
    if (!text) return '';
    return text.replace(/[*_~`#>]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/!\[.*?\]\(.*?\)/g, '').replace(/```[\s\S]*?```/g, '').replace(/\n\s*-\s*/g, '. ').replace(/\n\s*\d+\.\s*/g, '. ').replace(/\n+/g, ' ').trim();
  }
}

export const geminiService = GeminiService.getInstance();
