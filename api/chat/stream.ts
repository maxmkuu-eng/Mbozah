import { searchWeb, formatAxaLiveAnswer, detectSearchIntent } from '../../server/webSearchService.js';
import { geminiService, AI_PROVIDER, PERSONAL_CHAT_MODEL } from '../../server/geminiService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const {
      message = '',
      conversationHistory = [],
      isVoice = false,
      attachments = [],
    } = req.body || {};

    if (!message && (!attachments || attachments.length === 0)) {
      send({ type: 'error', message: 'Ujumbe au kiambatisho kinahitajika' });
      res.end();
      return;
    }

    // HARD PROVIDER BOUNDARY:
    // Live web-search requests are handled directly by AXA/Exa.
    // Gemini is NEVER called to synthesize, answer, summarize, or interfere with them.
    if (detectSearchIntent(message)) {
      const started = Date.now();
      const liveSearch = await searchWeb(message, {
        news: /habari|news|leo|sasa|latest|current|hivi punde|tukio|matokeo|ratiba|bei|price|weather|kifo|msiba|mazishi|anazikwa|msimamo|ligi|mechi|wasanii|burudani|kitaifa|kimataifa/i.test(message),
        numResults: 8,
      });
      const reply = formatAxaLiveAnswer(liveSearch, {
        formattedString: new Intl.DateTimeFormat('sw-TZ', {
          timeZone: 'Africa/Dar_es_Salaam',
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).format(new Date()),
        iso: new Date().toISOString(),
      });

      send({ type: 'delta', text: reply });
      send({
        type: 'done',
        cleanSpeechText: reply.replace(/[*_~`#>]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\n+/g, ' ').trim(),
        memoriesExtracted: [],
        peopleRecognized: [],
        generatedFiles: [],
        aiProvider: 'AXA Live Web Search',
        chatModel: 'AXA Live Web Search',
        latencyMs: Date.now() - started,
      });
      res.end();
      return;
    }

    const result = await geminiService.processChat({
      userId: 'user_max_owner',
      message,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      isVoice: Boolean(isVoice),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const chunks = result.reply.match(/.{1,48}(?:\s+|$)/g) || [result.reply];
    for (const chunk of chunks) {
      if (!chunk) continue;
      send({ type: 'delta', text: chunk });
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    send({
      type: 'done',
      cleanSpeechText: result.cleanSpeechText,
      memoriesExtracted: result.memoriesExtracted,
      peopleRecognized: result.peopleRecognized,
      generatedFiles: result.generatedFiles,
      aiProvider: result.aiProvider || AI_PROVIDER,
      chatModel: result.chatModel || PERSONAL_CHAT_MODEL,
      latencyMs: result.latencyMs,
    });
    res.end();
  } catch (error: any) {
    console.error('[MKUU-BACKEND] Streaming API Error:', error);
    send({
      type: 'error',
      message: error?.message || 'API Error',
      aiProvider: AI_PROVIDER,
      chatModel: PERSONAL_CHAT_MODEL,
    });
    res.end();
  }
}
