import { db, GeneratedFileSummary } from './db.js';
import { imageService } from './imageService.js';
import { geminiService } from './geminiService.js';

export type AgentIntent = 'chat' | 'image' | 'document' | 'spreadsheet' | 'analysis';

export interface AgentRequest {
  userId: string;
  message: string;
  conversationHistory?: any[];
  attachments?: any[];
  isVoice?: boolean;
  people?: any[];
  apiKey?: string;
}

export interface AgentResult {
  intent: AgentIntent;
  reply: string;
  cleanSpeechText: string;
  generatedFiles: GeneratedFileSummary[];
  memoriesExtracted: any[];
  peopleRecognized: any[];
  aiProvider?: string;
  chatModel?: string;
  latencyMs: number;
}

const IMAGE_WORDS = ['picha', 'image', 'photo', 'picture', 'logo', 'banner', 'poster', 'cartoon', 'background', 'illustration', 'edit photo', 'ondoa background', 'badilisha picha', 'avatar'];
const IMAGE_ACTION_WORDS = [
  'tengeneza', 'create', 'generate', 'edit', 'design', 'chora', 'badili', 'hariri',
  'fanya', 'fanyia', 'nifanyie', 'nipatie', 'niletee', 'leta', 'unda', 'onesha', 'onyesha',
  'zalisha', 'draw', 'make', 'produce'
];
const DOC_WORDS = ['pdf', 'word', 'docx', 'document', 'proposal', 'report', 'ripoti', 'barua', 'resume', 'cv', 'letter', 'memo'];
const SHEET_WORDS = ['excel', 'xlsx', 'spreadsheet', 'csv', 'budget', 'bajeti', 'table', 'jedwali'];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export class UniversalAgentEngine {
  public classify(message: string, attachments: any[] = []): AgentIntent {
    const text = String(message || '').toLowerCase();
    const hasImage = attachments.some((a) =>
      String(a?.mimeType || '').toLowerCase().startsWith('image/') ||
      String(a?.base64Data || '').startsWith('data:image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(String(a?.fileType || '').toLowerCase())
    );
    if (hasImage) return 'image';
    if (
      includesAny(text, IMAGE_WORDS) &&
      (includesAny(text, IMAGE_ACTION_WORDS) || text.includes('picha ya') || text.includes('image of') || text.includes('picture of'))
    ) return 'image';
    if (includesAny(text, SHEET_WORDS)) return 'spreadsheet';
    if (includesAny(text, DOC_WORDS)) return 'document';
    if (text.includes('chambua') || text.includes('analyse') || text.includes('analyze') || text.includes('linganisha') || text.includes('compare')) return 'analysis';
    return 'chat';
  }

  public async execute(request: AgentRequest): Promise<AgentResult> {
    const started = Date.now();
    const intent = this.classify(request.message, request.attachments || []);

    if (intent === 'image') {
      const result = await imageService.processImage({
        userId: request.userId,
        prompt: request.message,
        attachments: request.attachments || [],
        apiKey: request.apiKey,
      });
      return {
        intent,
        reply: result.explanation,
        cleanSpeechText: result.explanation,
        generatedFiles: [result.file],
        memoriesExtracted: [],
        peopleRecognized: [],
        aiProvider: 'Magic Hour Studio',
        chatModel: result.modelUsed || 'Magic Hour Studio',
        latencyMs: Date.now() - started,
      };
    }

    const result = await geminiService.processChat({
      userId: request.userId,
      message: request.message,
      conversationHistory: request.conversationHistory || [],
      isVoice: request.isVoice,
      attachments: request.attachments || [],
    });

    return {
      intent,
      reply: result.reply,
      cleanSpeechText: result.cleanSpeechText,
      generatedFiles: result.generatedFiles || [],
      memoriesExtracted: result.memoriesExtracted || [],
      peopleRecognized: result.peopleRecognized || [],
      aiProvider: result.aiProvider,
      chatModel: result.chatModel,
      latencyMs: Date.now() - started,
    };
  }

  public plan(message: string, attachments: any[] = []) {
    const intent = this.classify(message, attachments);
    const steps = intent === 'image'
      ? ['Elewa maelekezo ya picha', 'Chagua Image Service', 'Tengeneza/hariri picha', 'Hifadhi na toa preview']
      : intent === 'document'
        ? ['Elewa aina ya document', 'Tengeneza maudhui', 'Panga muundo wa kitaalamu', 'Tengeneza faili na preview']
        : intent === 'spreadsheet'
          ? ['Elewa data na lengo', 'Panga jedwali/formulas', 'Tengeneza spreadsheet', 'Kagua matokeo']
          : intent === 'analysis'
            ? ['Elewa swali', 'Kusanya context iliyopo', 'Chambua na linganisha', 'Toa hitimisho']
            : ['Elewa ombi', 'Tumia memory/context', 'Chagua uwezo unaofaa', 'Toa jibu na next action'];
    return { intent, steps };
  }
}

export const universalAgent = new UniversalAgentEngine();
