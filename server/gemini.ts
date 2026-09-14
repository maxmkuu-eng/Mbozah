import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';
import { imageService } from './imageService.js';
import { detectSearchIntent } from './webSearchService.js';

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Resilient multi-model fallback list in order of preference for high availability & speed
const MODEL_FALLBACK_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
];

export async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}): Promise<string> {
  const ai = getGenAI();
  const preferred = params.preferredModel || 'gemini-3.8-flash';
  const modelsToTry = [
    preferred,
    ...MODEL_FALLBACK_CANDIDATES.filter((m) => m !== preferred),
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      const text = response.text;
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);

      // If failure was tool-related (e.g. googleSearch) or 429 quota with tools, retry immediately without tools
      if (params.config?.tools) {
        try {
          const configWithoutTools = { ...params.config };
          delete configWithoutTools.tools;
          const responseNoTools = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: configWithoutTools,
          });
          const textNoTools = responseNoTools.text;
          if (textNoTools && textNoTools.trim().length > 0) {
            return textNoTools;
          }
        } catch (noToolsErr) {
          lastError = noToolsErr;
        }
      }

      // Quick brief wait before next model
      const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
      if (isRateLimit) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  // Final safety net: try all candidate models cleanly without tools if tools were configured
  if (params.config?.tools) {
    const configNoTools = { ...params.config };
    delete configNoTools.tools;
    for (const model of modelsToTry) {
      try {
        const responseNoTools = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: configNoTools,
        });
        const textNoTools = responseNoTools.text;
        if (textNoTools && textNoTools.trim().length > 0) {
          return textNoTools;
        }
      } catch (noToolsFallbackErr) {
        lastError = noToolsFallbackErr;
      }
    }
  }

  throw lastError || new Error('Wanamitandao wa AI hawajapatikana kwa sasa.');
}

export interface ProcessChatParams {
  userId: string;
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | string;
    content: string;
    attachments?: any[];
    generatedFiles?: any[];
  }>;
  isVoice?: boolean;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    base64Data: string;
  }>;
}

export interface ChatResponseResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted?: Memory[];
  peopleRecognized?: Person[];
  generatedFiles?: GeneratedFileSummary[];
}

export async function processMkuuChat(params: ProcessChatParams): Promise<ChatResponseResult> {
  const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;

  // 1. Fetch persistent context for Max
  const user = db.getUser(userId) || db.getOwner();
  const memories = db.getMemories(userId);
  const people = db.getPeople(userId);

  // 2. Check for explicit memory triggers
  const isExplicitMemoryCommand = detectMemoryIntent(message);
  let newlySavedMemory: Memory | null = null;

  if (isExplicitMemoryCommand) {
    const extractedContent = extractMemoryContent(message);
    if (extractedContent) {
      newlySavedMemory = db.addMemory({
        userId,
        content: extractedContent,
        category: categorizeMemory(extractedContent),
        importance: 'high',
        tags: ['chat_kumbukumbu', 'max_memory'],
        source: 'explicit_command',
      });
      // Refresh memory list with the new memory
      memories.unshift(newlySavedMemory);
    }
  }

  // 3. Check for real file generation requests
  const fileGenerationIntent = detectFileGenerationIntent(message);
  let generatedFilesList: GeneratedFileSummary[] = [];

  const hasImageAttachment = !!attachments?.some(
    (a) =>
      a.mimeType?.startsWith('image/') ||
      a.base64Data?.startsWith('data:image/') ||
      ['jpg', 'jpeg', 'png', 'webp'].includes(a.fileType?.toLowerCase() || '')
  );

  const isImageEditOrGen = detectImageEditingOrGenIntent(message, hasImageAttachment);

  let aiReplyText = '';

  // DIRECT ROUTING: If request is Image Editing or Image Generation, route immediately to Gemini 3 Pro Image
  if (isImageEditOrGen) {
    try {
      const generatedImageResult = await processImageEditingOrGeneration({
        userId,
        message,
        attachments,
      });

      if (generatedImageResult) {
        generatedFilesList.push(generatedImageResult.file);
        aiReplyText = generatedImageResult.explanation;
      } else {
        aiReplyText = `Samahani Max wangu, uhariri wa picha haukuweza kukamilika mara moja kwenye seva. Tafadhali hakikisha picha imeambatanishwa kisha jaribu tena.`;
      }
    } catch (e: any) {
      console.error('Image editing/generation routing error:', e);
      aiReplyText = `Hitilafu ya uhariri wa picha: ${e?.message || 'Huduma haikupatikana kwa sasa'}. Tafadhali jaribu tena.`;
    }
  } else {
    // 4. Construct System Prompt with True Context for standard conversational flow
    const systemPrompt = `
Wewe ni **MKUU AI** (Mkuu), msaidizi binafsi mwenye akili ya hali ya juu na mtiifu aliyejengwa mahsusi kwa ajili ya mmiliki wako mkuu anayeitwa **MAX**.

UTAMBULISHO WA MMILIKI:
- Jina la Mmiliki: ${user.name} (Max)
- Barua Pepe: ${user.email}
- Hadhi: Mmiliki Pekee Aliyeidhinishwa (Authorized Owner)

MAADILI NA TABIA YA MKUU AI:
1. Wewe ni msaidizi mwangalifu, mkarimu, mwenye akili kubwa na heshima ya juu kwa Max.
2. Lugha ya msingi ni **Kiswahili fasaha na cha asili**. Pia jibu kwa Kiingereza au lugha nyingine kama Max amekuuliza kwa lugha hiyo.
3. Tumia lugha ya heshima na ya kirafiki (mfano: "Habari Max", "Ndiyo Mkuu wangu", "Bila shaka Max", "Nimekumbuka Max").
4. **KANUNI KUU YA KUMBUKUMBU (MAX MEMORY):**
   - Tumia orodha ya kumbukumbu (MAX MEMORY) zilizohifadhiwa hapa chini.
   - Kama Max akikuuliza kuhusu jambo la kibinafsi, tafuta kwenye orodha ya kumbukumbu.
   - KAMA jambo halipo kwenye kumbukumbu zilizohifadhiwa, eleza kwa uwazi na heshima kwamba bado hujaweka kumbukumbu hiyo kwenye Max Memory badala ya kubuni au kutunga habari za uongo.
5. **KANUNI KUU YA UTAMBUZI WA WATU (MAX IDENTIFY & WATU WANGU WA KARIBU):**
   - Angalia orodha ya watu wa karibu hapa chini.
   - Kama Max akikuuliza "Unamjua mke wangu?", "Nani ni mke wangu?", "Unamjua mama yangu?", "Boss wangu ni nani?", au kumtaja mtu kwa jina (mfano "Mary", "Mama Zawadi", "Baraka", "Boss Juma"), tumia taarifa zao halisi zilizoorodheshwa hapa chini.
   - Mfano: Kama Mary ameorodheshwa na relationship "Mke wangu", jibu: "Ndiyo Max, mke wako ni Mary." Pamoja na kueleza taarifa zake kwa kifupi pale inapofaa.
   - USISEME "Simfahamu" kwa mtu yeyote aliyepo kwenye orodha ya Watu wa Karibu!
6. **KANUNI YA UTENGENEZAJI WA MAFAILI NA PICHA (FILES & IMAGE PRODUCTION):**
   - Mfumo huu una injini halisi ya kuzalisha mafaili (PDF, Excel, Word, CSV) na picha zilizohaririwa au zilizokatwa bila background (PNG Transparent / JPEG / SVG).
   - **MARUFUKU KABISA:** USIWAHI kusema eti "sina uwezo wa kutoa faili au picha iliyokatwa" au kumwambia Max aende kwenye tovuti za nje kama remove.bg! Mfumo huu wa MKUU AI unazalisha picha halisi na kuiweka moja kwa moja hapa kwenye mazungumzo.
   - Kama Max ametuma picha na kuomba kuondoa background ("remove background", "ondoa background", "toa background", "futa background"), mthibitishie kuwa umemuondolea background na picha yake safi ya PNG inaonyeshwa na ipo tayari kutazamwa na kupakuliwa hapa chini.

---
ORODHA YA KUMBUKUMBU ZA SASA ZA MAX (MAX MEMORY - SERVER PERSISTED):
${memories.length > 0
  ? memories.map((m, i) => `${i + 1}. [${m.category}] ${m.content} (Ilihifadhiwa: ${m.createdAt})`).join('\n')
  : 'Hakuna kumbukumbu za ziada zilizohifadhiwa kwa sasa.'}

---
ORODHA YA WATU WANGU WA KARIBU (MAX IDENTIFY / CLOSE PEOPLE):
${people.length > 0
  ? people.map((p, i) => `${i + 1}. Jina: ${p.name} | Uhusiano: ${p.relationship}${p.nickname ? ` | Jina la utani: ${p.nickname}` : ''}${p.phone ? ` | Simu: ${p.phone}` : ''}${p.email ? ` | Email: ${p.email}` : ''}${p.notes ? ` | Maelezo: ${p.notes}` : ''}`).join('\n')
  : 'Hakuna watu wa karibu waliohifadhiwa kwa sasa.'}

${newlySavedMemory ? `\nTAARIFA YA SASA: Max ametoka kutoa amri ya kukumbuka: "${newlySavedMemory.content}". Hii imehifadhiwa kwa ufanisi kwenye database ya kudumu (Max Memory). Mthibitishie kuwa umehifadhi.` : ''}
`;

    // 5. Call Gemini API with Fallbacks & Resiliency for Conversational Assistant
    try {
      // Construct robust alternating multiturn conversation history
      const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

      // Filter and sanitize past history (excluding trailing user message if already added)
      const rawHistory = Array.isArray(conversationHistory) ? [...conversationHistory] : [];
      
      if (rawHistory.length > 0) {
        const last = rawHistory[rawHistory.length - 1];
        if (last.role === 'user' && (last.content === message || (!last.content && !message))) {
          rawHistory.pop();
        }
      }

      // Take up to the last 20 messages for rich conversational depth
      const recentHistory = rawHistory.slice(-20);

      for (const h of recentHistory) {
        const text = (h.content || '').trim();
        if (!text && (!h.attachments || h.attachments.length === 0)) continue;

        const role: 'user' | 'model' = h.role === 'user' ? 'user' : 'model';
        const parts: any[] = [];
        if (text) {
          parts.push({ text });
        }

        // If past message had attachments
        if (h.attachments && Array.isArray(h.attachments)) {
          for (const att of h.attachments) {
            if (att.previewUrl?.startsWith('data:image/') || att.base64Data) {
              const b64 = (att.previewUrl || att.base64Data || '').replace(/^data:image\/\w+;base64,/, '');
              if (b64) {
                parts.push({
                  inlineData: {
                    data: b64,
                    mimeType: att.mimeType || 'image/jpeg',
                  },
                });
              }
            }
          }
        }

        if (parts.length === 0) continue;

        const lastTurn = contents[contents.length - 1];
        if (lastTurn && lastTurn.role === role) {
          lastTurn.parts.push(...parts);
        } else {
          contents.push({ role, parts });
        }
      }

      if (contents.length > 0 && contents[0].role === 'model') {
        contents.unshift({
          role: 'user',
          parts: [{ text: 'Habari MKUU AI, mimi ni Max mmiliki wako.' }],
        });
      }

      const currentUserParts: any[] = [];
      if (message) {
        currentUserParts.push({ text: message });
      }

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          if (att.base64Data) {
            const rawBase64 = att.base64Data.includes(',') ? att.base64Data.split(',')[1] : att.base64Data;
            if (att.mimeType && att.mimeType.startsWith('image/')) {
              currentUserParts.push({
                inlineData: {
                  data: rawBase64,
                  mimeType: att.mimeType,
                },
              });
            } else if (att.mimeType === 'application/pdf') {
              currentUserParts.push({
                inlineData: {
                  data: rawBase64,
                  mimeType: 'application/pdf',
                },
              });
            } else {
              try {
                const decodedText = Buffer.from(rawBase64, 'base64').toString('utf-8');
                currentUserParts.push({
                  text: `\n\n[Maudhui ya Faili Lililoambatanishwa: ${att.filename} (${att.fileType})]:\n${decodedText.slice(0, 8000)}\n---`,
                });
              } catch (e) {
                currentUserParts.push({ text: `\n\n[Faili lililoambatanishwa: ${att.filename}]` });
              }
            }
          }
        }
      }

      if (currentUserParts.length === 0) {
        currentUserParts.push({ text: message || 'Tafadhali endelea na mazungumzo yetu.' });
      }

      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === 'user') {
        lastTurn.parts.push(...currentUserParts);
      } else {
        contents.push({
          role: 'user',
          parts: currentUserParts,
        });
      }

      const isSearchQuery = detectSearchIntent(message);
      const generationConfig: any = {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      };
      if (isSearchQuery) {
        generationConfig.tools = [{ googleSearch: {} }];
      }

      aiReplyText = await generateContentWithFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: contents,
        config: generationConfig,
      });
    } catch (error) {
      console.error('Error generating AI response with Gemini after fallbacks:', error);
      aiReplyText = generateContextualFallback({
        message,
        user,
        memories,
        people,
        newlySavedMemory,
      });
    }
  }

  // 6. If file generation was requested, generate the real binary file
  if (fileGenerationIntent) {
    try {
      const generated = await generateRealFile({
        userId,
        filename: fileGenerationIntent.filename,
        fileType: fileGenerationIntent.fileType,
        title: fileGenerationIntent.title,
        content: fileGenerationIntent.content || aiReplyText,
        description: `Faili halisi la ${fileGenerationIntent.fileType.toUpperCase()} lililoandaliwa na MKUU AI`,
      });
      generatedFilesList.push(generated);

      aiReplyText += `\n\n📄 **Faili Liko Tayari:** Nimeliandaa faili lako halisi la **${generated.filename}** (${(generated.size / 1024).toFixed(1)} KB). Unaweza kulipakua mara moja kupitia kitufe kilicho hapa chini.`;
    } catch (e) {
      console.error('Failed to generate binary file:', e);
    }
  }

  // 7. Clean text for Voice TTS (strip markdown asterisks, hashes, backticks, brackets)
  const cleanSpeechText = cleanMarkdownForVoice(aiReplyText);

  // 8. Find matching people mentioned in conversation
  const matchedPeople = people.filter((p) =>
    message.toLowerCase().includes(p.name.toLowerCase()) ||
    (p.nickname && message.toLowerCase().includes(p.nickname.toLowerCase())) ||
    message.toLowerCase().includes(p.relationship.toLowerCase())
  );

  return {
    reply: aiReplyText,
    cleanSpeechText,
    memoriesExtracted: newlySavedMemory ? [newlySavedMemory] : undefined,
    peopleRecognized: matchedPeople.length > 0 ? matchedPeople : undefined,
    generatedFiles: generatedFilesList.length > 0 ? generatedFilesList : undefined,
  };
}

function detectMemoryIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const triggers = [
    'kumbuka hii',
    'kumbuka kwamba',
    'kumbuka kuwa',
    'save this',
    'usisahaul',
    'usisahau',
    'remember this',
    'remember that',
    'hifadhi hii',
    'weka kwenye kumbukumbu',
    'zingatia hili',
    'andika kumbukumbu',
  ];
  return triggers.some((t) => lower.includes(t));
}

function extractMemoryContent(text: string): string {
  // Strip trigger words and get core statement
  let cleaned = text
    .replace(/^(mkuu|mkuu ai|mkuu,\s*|mkuu ai,\s*)/i, '')
    .replace(/^(kumbuka hii|kumbuka kwamba|kumbuka kuwa|kumbuka|save this|usisahau|remember this|remember that|hifadhi hii|weka kwenye kumbukumbu)[:,\s]*/i, '')
    .trim();

  // If user says "napenda...", adjust context for Max
  if (cleaned.startsWith('napenda') || cleaned.startsWith('ninapenda')) {
    cleaned = `Max anapenda ${cleaned.replace(/^(napenda|ninapenda)\s*/i, '')}`;
  } else if (cleaned.startsWith('naitwa') || cleaned.startsWith('mimi ni')) {
    cleaned = `Max: ${cleaned}`;
  }

  return cleaned || text;
}

function categorizeMemory(content: string): Memory['category'] {
  const lower = content.toLowerCase();
  if (lower.includes('penda') || lower.includes('upendeleo') || lower.includes('lugha') || lower.includes('chakula') || lower.includes('rangi')) {
    return 'Preferences';
  }
  if (lower.includes('kazi') || lower.includes('ofisi') || lower.includes('mradi') || lower.includes('ripoti') || lower.includes('kampuni')) {
    return 'Work';
  }
  if (lower.includes('mke') || lower.includes('mama') || lower.includes('baba') || lower.includes('mtoto') || lower.includes('kaka') || lower.includes('dada') || lower.includes('familia')) {
    return 'Family';
  }
  if (lower.includes('afya') || lower.includes('dawa') || lower.includes('hospitali') || lower.includes('mazoezi')) {
    return 'Health';
  }
  if (lower.includes('fedha') || lower.includes('pesa') || lower.includes('benki') || lower.includes('bajeti') || lower.includes('shilingi') || lower.includes('dola')) {
    return 'Finance';
  }
  if (lower.includes('kanuni') || lower.includes('sheria') || lower.includes('kamwe') || lower.includes('usifanye')) {
    return 'Rules';
  }
  return 'General';
}

interface FileIntent {
  filename: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
  title: string;
  content?: string;
}

function detectFileGenerationIntent(text: string): FileIntent | null {
  const lower = text.toLowerCase();

  // Check PDF
  if (lower.includes('pdf') && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create') || lower.includes('make') || lower.includes('andika') || lower.includes('download'))) {
    return {
      filename: `Ripoti_ya_Max_${Date.now().toString().slice(-4)}.pdf`,
      fileType: 'pdf',
      title: 'Ripoti Maalum ya Max',
    };
  }

  // Check Excel / XLSX
  if ((lower.includes('excel') || lower.includes('xlsx') || lower.includes('spreadsheet') || lower.includes('jedwali')) && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create') || lower.includes('make'))) {
    return {
      filename: `Jedwali_la_Max_${Date.now().toString().slice(-4)}.xlsx`,
      fileType: 'xlsx',
      title: 'Jedwali la Kazi na Takwimu za Max',
    };
  }

  // Check DOCX / Word
  if ((lower.includes('docx') || lower.includes('word') || lower.includes('document')) && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create'))) {
    return {
      filename: `Waraka_wa_Max_${Date.now().toString().slice(-4)}.docx`,
      fileType: 'docx',
      title: 'Waraka Rasmi wa Max',
    };
  }

  // Check CSV
  if (lower.includes('csv') && (lower.includes('tengeneza') || lower.includes('create') || lower.includes('niandalie'))) {
    return {
      filename: `Takwimu_za_Max_${Date.now().toString().slice(-4)}.csv`,
      fileType: 'csv',
      title: 'Faili la Takwimu za CSV',
    };
  }

  // Check JSON
  if (lower.includes('json') && (lower.includes('tengeneza') || lower.includes('create') || lower.includes('niandalie') || lower.includes('hifadhi kama json'))) {
    return {
      filename: `Data_ya_Max_${Date.now().toString().slice(-4)}.json`,
      fileType: 'json',
      title: 'Data ya JSON',
    };
  }

  return null;
}

export function detectImageEditingOrGenIntent(message: string, hasImageAttachment: boolean): boolean {
  const lower = (message || '').toLowerCase().trim();

  if (hasImageAttachment) {
    if (
      lower.includes('hd') ||
      lower.includes('enhance') ||
      lower.includes('boresha') ||
      lower.includes('clear') ||
      lower.includes('restore') ||
      lower.includes('rekebisha') ||
      lower.includes('quality') ||
      lower.includes('ubora') ||
      lower.includes('background') ||
      lower.includes('ondoa') ||
      lower.includes('toa') ||
      lower.includes('futa') ||
      lower.includes('remove') ||
      lower.includes('replace') ||
      lower.includes('badilisha') ||
      lower.includes('badili') ||
      lower.includes('nguo') ||
      lower.includes('shirt') ||
      lower.includes('suti') ||
      lower.includes('color') ||
      lower.includes('rangi') ||
      lower.includes('cinematic') ||
      lower.includes('studio') ||
      lower.includes('portrait') ||
      lower.includes('hariri') ||
      lower.includes('edit') ||
      lower.includes('preserve') ||
      lower.includes('uso') ||
      lower.includes('face') ||
      lower.includes('transparent') ||
      lower.includes('2k') ||
      lower.includes('4k') ||
      lower.length <= 60
    ) {
      return true;
    }
  }

  if (
    lower.includes('tengeneza picha') ||
    lower.includes('chora picha') ||
    lower.includes('unda picha') ||
    lower.includes('generate image') ||
    lower.includes('create an image') ||
    lower.includes('draw an image') ||
    lower.includes('draw a picture') ||
    lower.startsWith('picha ya') ||
    lower.includes('picha ya') ||
    lower.includes('naomba picha') ||
    lower.includes('niletee picha') ||
    lower.includes('nipe picha') ||
    lower.includes('tuma picha') ||
    lower.includes('nitengenezee picha') ||
    lower.includes('logo ya mkuu') ||
    lower.includes('nembo ya mkuu') ||
    lower.includes('picha 3d') ||
    lower.includes('picha ya 3d') ||
    lower.includes('picha hd') ||
    lower.includes('tengeneza logo') ||
    lower.includes('unda logo') ||
    lower.includes('tengeneza avatar')
  ) {
    return true;
  }

  return false;
}

export async function processImageEditingOrGeneration(params: {
  userId: string;
  message: string;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    size?: number;
    base64Data?: string;
  }>;
}): Promise<{ file: GeneratedFileSummary; explanation: string } | null> {
  const { userId, message, attachments } = params;

  // Find image attachment if any
  const imageAttachment = attachments?.find(
    (a) =>
      a.mimeType?.startsWith('image/') ||
      a.base64Data?.startsWith('data:image/') ||
      ['jpg', 'jpeg', 'png', 'webp'].includes(a.fileType?.toLowerCase() || '')
  );

  const hasImage = !!imageAttachment;
  const isTargetedIntent = detectImageEditingOrGenIntent(message, hasImage);

  if (!isTargetedIntent && !hasImage) {
    return null;
  }

  // Strictly route via Magic Hour Studio according to user instruction
  const result = await imageService.processImage({
    userId,
    prompt: message,
    attachments: attachments || [],
  });

  return {
    file: result.file,
    explanation: result.explanation,
  };
}


export function cleanMarkdownForVoice(text: string): string {
  if (!text) return '';

  return text
    // Remove bold and italic markdown: **text** or *text* or __text__ or _text_
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove headers: # Header
    .replace(/^#+\s+/gm, '')
    // Remove list markers: - item or * item or 1. item
    .replace(/^[\*\-]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, 'kuna kizuizi cha msimbo wa kompyuta')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links: [text](url)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove emojis that may read weirdly or technical symbols
    .replace(/[#*_~`><|]/g, '')
    // Remove extra whitespaces and newlines
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasWholeWord(text: string, words: string[]): boolean {
  const clean = text.toLowerCase();
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
    return regex.test(clean);
  });
}

function generateContextualFallback(params: {
  message: string;
  user: any;
  memories: Memory[];
  people: Person[];
  newlySavedMemory: Memory | null;
}): string {
  const { message, user, memories, people, newlySavedMemory } = params;
  const lower = message.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  if (newlySavedMemory) {
    return `Ndiyo Max, nimehifadhi kumbukumbu hii kwenye Max Memory ya kudumu:\n\n📌 "${newlySavedMemory.content}"\n\nImewekwa salama kwenye mfumo.`;
  }

  // 1. Question about wife / people / contacts
  const matchedPerson = people.find((p) => {
    const name = p.name.toLowerCase();
    const rel = (p.relationship || '').toLowerCase();
    const nick = (p.nickname || '').toLowerCase();

    if (name && hasWholeWord(lower, [name])) return true;
    if (nick && hasWholeWord(lower, [nick])) return true;
    if (rel.includes('mke') && hasWholeWord(lower, ['mke', 'mkeo', 'mke wangu', 'wife'])) return true;
    if (rel.includes('mama') && hasWholeWord(lower, ['mama', 'mama yangu', 'mother'])) return true;
    if (rel.includes('baba') && hasWholeWord(lower, ['baba', 'baba yangu', 'father'])) return true;
    if ((rel.includes('boss') || rel.includes('bosi')) && hasWholeWord(lower, ['boss', 'bosi', 'mkurugenzi'])) return true;
    return false;
  });

  if (matchedPerson) {
    return `Mkuu Max, kulingana na orodha yako ya **Watu wa Karibu**:\n\n` +
      `💍 **${matchedPerson.relationship}:** **${matchedPerson.name}** ${matchedPerson.nickname ? `(*${matchedPerson.nickname}*)` : ''}\n` +
      `• **Simu:** ${matchedPerson.phone || 'Haijawekwa'}\n` +
      `• **Barua Pepe:** ${matchedPerson.email || 'Haijawekwa'}\n` +
      `• **Maelezo:** ${matchedPerson.notes || 'Mtu wa karibu aliyehifadhiwa'}`;
  }

  // 2. Image Editing / Background removal requests
  if (
    lower.includes('remove background') ||
    lower.includes('background') ||
    lower.includes('toa background') ||
    lower.includes('futa background') ||
    lower.includes('ondoa background') ||
    lower.includes('hariri picha')
  ) {
    return `Ndiyo Mkuu Max, nipo tayari kukusaidia kuondoa au kubadilisha mandharinyuma (*Background*) ya picha yako!\n\n` +
      `📌 **Hatua za Kufuata:**\n` +
      `1. Bonyeza kitufe cha **+** (Kiambatisho / Picha) hapo chini na uchague picha unayotaka kufanyia uhariri.\n` +
      `2. Tuma picha hiyo ikiwa na maelezo unayotaka (mfano: *"Ondoa background"* au *"Weka background nyeupe"*).\n` +
      `3. Nitakuchakatia na kukukabidhi faili safi la picha (PNG Transparent).\n\n` +
      `Tafadhali pakia picha hiyo sasa tuanze kazi!`;
  }

  // 3. Troubleshooting / Bug reports / Complaints
  if (hasWholeWord(lower, ['tatizo', 'shida', 'bug', 'hitilafu', 'haifanyi', 'aifanyi', 'rekebisha', 'fix', 'rudia', 'haitoi', 'kosa'])) {
    return `Mkuu Max, nimepokea maelekezo yako kuhusu suala hilo. Nipo tayari kurekebisha na kutekeleza mara moja bila kukwama.\n\nTafadhali nipe agizo mahususi unalotaka nifanye sasa—iwe ni kuhifadhi kumbukumbu, kutafuta taarifa ya mtu, kukuandalia ripoti/waraka (PDF/Word/Excel), au kujibu swali lolote la kiutendaji.`;
  }

  // 3. Pure Short Greetings ONLY (at most 5 words)
  if (wordCount <= 5 && hasWholeWord(lower, ['habari', 'mambo', 'hujambo', 'shikamoo', 'hello', 'hey', 'hi', 'salama', 'niaje', 'jambo'])) {
    return `Habari Mkuu Max! Mimi ni MKUU AI, msaidizi wako binafsi. Nipo tayari kukusaidia na kumbukumbu zako, watu wako wa karibu, na kuandaa mafaili au nyaraka. Tushughulikie nini sasa?`;
  }

  // 4. Memory query
  if (hasWholeWord(lower, ['unakumbuka', 'kumbukumbu', 'nilikwambia', 'nilisema', 'tulikubaliana'])) {
    if (memories.length > 0) {
      const memList = memories.slice(0, 4).map((m, i) => `${i + 1}. **[${m.category.toUpperCase()}]** ${m.content}`).join('\n\n');
      return `Mkuu Max, ninakumbuka yafuatayo kwenye Kumbukumbu zako za kudumu:\n\n${memList}\n\nUngependa niongeze au nisasambue kumbukumbu yoyote?`;
    }
    return `Mkuu Max, kwa sasa bado hatujaweka kumbukumbu maalum kuhusu hilo. Niambie *"Kumbuka [taarifa yako]"* nami nitaiweka mara moja.`;
  }

  // 5. Identity queries
  if (hasWholeWord(lower, ['wewe ni nani', 'jina lako', 'mimi ni nani', 'unanijua'])) {
    return `Wewe ni Mkuu **Max**, mmiliki na msimamizi mkuu wa mfumo huu wa **MKUU AI**. Mimi ni msaidizi wako mkuu wa kidijitali niliyetayari kutekeleza majukumu yako yote.`;
  }

  // 6. Default truthful explanation when Gemini AI endpoint is unreachable
  return `Mkuu Max, kulikuwa na changamoto ya muda katika kuunganishwa na Google Gemini AI kwa swali lako kuhusu: *" ${message} "*.\n\n` +
    `Mifumo ya usalama na uthabiti imezuia kutoa jibu lisilo sahihi au la kubahatisha. Tafadhali bonyeza kitufe cha kutuma tena mara moja ili kupata jibu kamili kutoka Gemini.`;
}
