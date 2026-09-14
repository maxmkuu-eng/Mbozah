import express from 'express';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from '../server/geminiService.js';
import { generateContentWithFallback } from '../server/gemini.js';
import { imageService, PRIMARY_IMAGE_MODEL } from '../server/imageService.js';
import { db } from '../server/db.js';
import { universalAgent } from '../server/agentEngine.js';
import { streamGemini } from '../server/streaming.js';
import { runDiagnostics } from '../server/diagnostics.js';
import { getSportDashboard } from '../server/sportService.js';

const app = express();
const DEFAULT_USER_ID = 'user_max_owner';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({ limit: '50mb' }));

app.get(['/health', '/api/health'], async (_req, res) => {
  try {
    const health = await geminiService.getHealthStatus();
    res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: health.chatModel || PERSONAL_CHAT_MODEL, backend: health.backend || BACKEND_IDENTIFIER, aiProvider: health.aiProvider || AI_PROVIDER, imageModel: PRIMARY_IMAGE_MODEL, latencyMs: health.latencyMs });
  } catch (_error) {
    res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, aiProvider: AI_PROVIDER });
  }
});

app.get('/api/sport', async (_req, res) => {
  try { res.json(await getSportDashboard()); }
  catch (e:any) { res.status(503).json({ error: 'SPORT_UNAVAILABLE', message: e?.message || 'Sport data haipatikani kwa sasa.' }); }
});

app.post(['/api/agent', '/api/agent/'], async (req, res) => {
  try {
    const { message = '', conversationHistory = [], isVoice = false, attachments = [], people = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
    const plan = universalAgent.plan(message, attachments);
    const result = await universalAgent.execute({ userId: DEFAULT_USER_ID, message, conversationHistory: Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [], isVoice, attachments, people });
    res.json({ ...result, plan });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Agent API Error:', error);
    res.status(503).json({ error: 'AGENT_UNAVAILABLE', message: error?.message || 'MKUU Agent haipatikani kwa sasa.', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
  }
});

app.post('/api/agent/plan', (req, res) => {
  try {
    const { message = '', attachments = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
    res.json({ success: true, ...universalAgent.plan(message, attachments) });
  } catch (error: any) {
    res.status(400).json({ error: 'PLAN_FAILED', message: error?.message || String(error) });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  const { message = '', conversationHistory = [], people = [], attachments = [] } = req.body || {};
  if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    for await (const chunk of streamGemini({ userId: DEFAULT_USER_ID, message, conversationHistory, people, attachments })) res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Streaming API Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'Streaming haikupatikana.' })}\n\n`);
    res.end();
  }
});

app.get('/api/system/diagnostics', async (_req, res) => {
  try { res.json(await runDiagnostics()); }
  catch (error: any) { res.status(503).json({ status: 'degraded', error: error?.message || String(error) }); }
});

// Dedicated SMS path. Uses Gemini directly and NEVER enters AXA/live-search routing.
app.post(['/api/sms/inbound', '/api/sms/inbound/'], async (req, res) => {
  try {
    const { sender = '', message = '', conversationHistory = [], contact = {} } = req.body || {};
    const currentMessage = String(message || '').trim();
    const currentSender = String(sender || '').trim();
    if (!currentSender || !currentMessage) return res.status(400).json({ error: 'SMS_REQUIRED' });

    const safeHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-12) : [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of safeHistory) {
      const text = String(item?.content || '').trim();
      if (!text) continue;
      const role: 'user' | 'model' = item?.role === 'assistant' || item?.role === 'model' ? 'model' : 'user';
      const previous = contents[contents.length - 1];
      if (previous && previous.role === role) previous.parts.push({ text });
      else contents.push({ role, parts: [{ text }] });
    }
    if (contents.length > 0 && contents[0].role === 'model') contents.unshift({ role: 'user', parts: [{ text: 'Endelea na mazungumzo haya kama msaidizi wa kawaida wa SMS.' }] });

    let memoryContext = '';
    try {
      const memories = db.getMemories(DEFAULT_USER_ID);
      if (Array.isArray(memories) && memories.length > 0) {
        memoryContext = memories.slice(-30).map((m:any) => `- ${String(m?.content || m?.memory || m?.text || '').trim()}`).filter(Boolean).join('\n');
      }
    } catch (_) {}

    let peopleContext = '';
    try {
      const people = db.getPeople(DEFAULT_USER_ID);
      if (Array.isArray(people) && people.length > 0) {
        peopleContext = people.slice(0, 50).map((p:any) => `- ${p?.name || 'Mtu'}${p?.nickname ? ` (${p.nickname})` : ''}; uhusiano: ${p?.relationship || 'haujawekwa'}; simu: ${p?.phone || 'N/A'}; maelezo: ${p?.notes || ''}`).join('\n');
      }
    } catch (_) {}

    const contactKnown = Boolean(contact?.known);
    const contactName = String(contact?.name || '').trim();
    const previousTurns = safeHistory.map((item:any) => `${item?.role === 'assistant' ? 'MKUU AI' : 'MTUMAJI'}: ${String(item?.content || '')}`).join('\n');
    const instruction = `Wewe ni MKUU AI Auto Reply wa SMS wa kawaida. Lengo lako ni kuendelea na mazungumzo ya kweli, si kutuma ujumbe wa generic au wa kuthibitisha kupokea SMS.

MTUMAJI: ${currentSender}
SMS MPYA:
${currentMessage}

${previousTurns ? `HISTORIA YA MAZUNGUMZO YA MTUMAJI HUYU:\n${previousTurns}\n` : ''}
${peopleContext ? `WATU WALIOHIFADHIWA KWENYE MKUU AI (tumia tu muktadha wa uhusiano, usitaje jina):\n${peopleContext}\n` : ''}
${memoryContext ? `KUMBUKUMBU ZA KUDUMU ZA MKUU AI (tumia pale zinapohitajika kujibu kwa usahihi):\n${memoryContext}\n` : ''}

SHERIA ZA MSINGI:
1. Jibu SMS mpya moja kwa moja kulingana na maana yake. Usijibu kwa ujumbe wa generic wa kupokea SMS.
2. Salamu kama "Hellow", "Hello", "Hi", "Mambo", "Habari" zijibiwe kama salamu ya kawaida na ya kirafiki.
3. Swali lijibiwe swali lenyewe; ombi lijibiwe ombi lenyewe; maoni/utani/mipango viendelezwe kama mazungumzo ya kawaida.
4. Endeleza conversation history ya mtumaji huyu kama mwendelezo wa mazungumzo bila kukata; usichanganye historia ya namba tofauti.
5. KANUNI KUU YA LAZIMA - BILA KUTAJA JINA LA MTU: KAMWE USITAJE jina la mtu aliyetuma SMS wala usimuite kwa jina lolote la mtu kwenye jibu lako la SMS (hata kama unamjua, usiseme "Habari Juma", wala usitaje jina lake lolote). Jibu kwa heshima na uadilifu moja kwa moja bila kutaja jina la mtumaji.
6. Kama SMS inahusu miradi, kazi au taarifa za Max na kumbukumbu zina jibu, tumia kumbukumbu hizo. Kama hakuna taarifa ya kutosha, sema kwa uaminifu kuwa Max anaweza kutoa maelezo zaidi; usibuni ukweli.
7. Dharura au ujumbe unaohitaji uamuzi wa Max: jibu kwa ufupi kwa usalama na ongeza [[MKUU_ACTION:CONTACT_OWNER]] ili mfumo umjulie Max. Usidai umechukua hatua ambayo hujaichukua.
8. LUGHA: Kiswahili -> Kiswahili cha asili; English -> natural English; mixed -> mixed naturally kulingana na mtumaji.
9. Usiseme "nimepokea ujumbe wako", "SMS imepokelewa", "nitakujibu baadaye" au "nimepokea" kama jibu la kawaida, isipokuwa mtumaji ameuliza moja kwa moja kuhusu kupokea ujumbe.
10. Usitumie AXA, live web search, Tavily, search results, sources, URLs au citations kwenye SMS Auto Reply.
11. Usitume draft ya kuomba Max athibitishe kila ujumbe wa kawaida. Jibu moja kwa moja isipokuwa ni dharura, action nyeti, au kuna sababu ya usalama.
12. Jibu kwa mtindo wa mtu halisi, mfupi unaofaa SMS lakini wenye maana kamili. Usirudie maelekezo haya kwenye jibu.`;

    const last = contents[contents.length - 1];
    if (last && last.role === 'user') {
      last.parts.push({ text: currentMessage });
    } else {
      contents.push({ role: 'user', parts: [{ text: currentMessage }] });
    }

    const reply = await generateContentWithFallback({
      preferredModel: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: instruction,
        temperature: 0.5,
        maxOutputTokens: 250,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    let cleanReply = reply.trim();
    if (!cleanReply) return res.status(503).json({ error: 'SMS_REPLY_EMPTY' });

    if (contactName && contactName.trim().length > 1) {
      const escaped = contactName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanReply = cleanReply
        .replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '')
        .replace(/\s{2,}/g, ' ')
        .replace(/,\s*,/g, ',')
        .replace(/^,\s*/, '')
        .trim();
    }
    if (!cleanReply) return res.status(503).json({ error: 'SMS_REPLY_EMPTY' });
    res.json({ reply: cleanReply, cleanSpeechText: cleanReply, mode: 'sms_autoreply', webSearch: false, liveSearch: false });
  } catch (error:any) {
    console.error('[MKUU-SMS] Auto reply error:', error);
    res.status(503).json({ error: 'SMS_REPLY_UNAVAILABLE', message: error?.message || 'SMS reply haikupatikana.' });
  }
});

app.post(['/api/chat', '/api/chat/'], async (req, res) => {
  try {
    const { message = '', conversationId, conversationHistory = [], isVoice = false, attachments = [], people = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
    const hasImage = attachments?.some((a: any) => a.mimeType?.startsWith('image/') || a.base64Data?.startsWith('data:image/'));
    const lower = String(message).toLowerCase();
    const imageAction = hasImage && (lower.includes('background') || lower.includes('ondoa') || lower.includes('badilisha') || lower.includes('edit') || lower.includes('enhance') || lower.length <= 50);
    if (imageAction || lower.startsWith('picha ya') || lower.includes('tengeneza picha') || lower.includes('unda picha')) {
      const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt: message, attachments });
      return res.json({ reply: result.explanation, cleanSpeechText: result.explanation, generatedFiles: [result.file], service: 'ImageService' });
    }
    let history = Array.isArray(conversationHistory) ? conversationHistory : [];
    if (!history.length && conversationId) {
      const conversation = db.getConversation(conversationId, DEFAULT_USER_ID);
      if (conversation?.messages) history = conversation.messages;
    }
    history = history.slice(-10);
    if (Array.isArray(people) && people.length > 0) {
      const peopleContext = people.slice(0, 30).map((p: any) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; Simu: ${p.phone || 'N/A'}; Maelezo: ${p.notes || 'N/A'}`).join('\n');
      history = [{ role: 'system', content: `TAARIFA ZA WATU WA KARIBU WALIOHIFADHIWA KWENYE APP YA MAX:\n${peopleContext}` }, ...history];
    }
    const result = await geminiService.processChat({ userId: DEFAULT_USER_ID, message, conversationHistory: history, isVoice, attachments });
    res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Chat API Error:', error);
    res.status(503).json({ error: 'GEMINI_UNAVAILABLE', message: error?.message || 'Google Gemini API Error', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
  }
});

app.post(['/api/image', '/api/image/', '/api/image/edit', '/api/image/generate'], async (req, res) => {
  try {
    const { prompt = '', imageBase64, mimeType = 'image/jpeg', filename = 'picha_iliyohaririwa.png', apiKey, magicHourApiKey } = req.body || {};
    let attachments = req.body?.attachments || [];
    if (imageBase64) attachments = [{ filename, fileType: mimeType.includes('png') ? 'png' : 'jpg', mimeType, base64Data: imageBase64 }];
    if (!prompt && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'Picha au maelezo ya picha yanahitajika.' });
    const headerKey = req.headers['x-magic-hour-key'] as string;
    const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt: prompt || 'Enhance and edit this image with high precision while strictly preserving identity', attachments, apiKey: apiKey || magicHourApiKey || headerKey });
    return res.json({ success: true, reply: result.explanation, cleanSpeechText: result.explanation, file: result.file, generatedFiles: [result.file], modelUsed: result.modelUsed, service: 'ImageService' });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Image API Error:', error);
    return res.status(503).json({ error: 'IMAGE_UNAVAILABLE', message: error?.message || 'Huduma ya picha haipatikani kwa sasa.' });
  }
});

app.post('/api/autoreply/verify-phone', async (req, res) => {
  try {
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    if (!phoneNumber) return res.status(400).json({ error: 'PHONE_REQUIRED', message: 'Nambari ya simu inahitajika.' });
    res.json({ success: true, phoneNumber, phoneVerified: true, phoneVerifiedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Auto Reply Verify Error:', error);
    res.status(500).json({ error: 'VERIFY_FAILED', message: error?.message || 'Uthibitishaji haukufanikiwa.' });
  }
});

app.post('/api/autoreply/remove-phone', async (_req, res) => res.json({ success: true, phoneNumber: '', phoneVerified: false }));
app.get('/api/conversations', (_req, res) => res.json(db.getConversations(DEFAULT_USER_ID)));
app.get('/api/memories', (_req, res) => res.json(db.getMemories(DEFAULT_USER_ID)));
app.get('/api/people', (_req, res) => { const people = db.getPeople(DEFAULT_USER_ID); if (people.length === 0) return res.json({ source: 'local', people: [] }); res.json(people); });
app.get('/api/files', (_req, res) => res.json(db.getFiles(DEFAULT_USER_ID)));

export default app;
