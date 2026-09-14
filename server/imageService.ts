import { GoogleGenAI } from '@google/genai';
import { Client } from 'magic-hour';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU IMAGE STUDIO - MAGIC HOUR STUDIO
// Dedicated provider for AI Image Generation and AI Image Editing.
// Powered by Magic Hour Studio API (https://api.magichour.ai)
// ============================================================================

export const PRIMARY_IMAGE_MODEL = 'Magic Hour Studio';
export const IMAGE_MODELS = {
  default: 'default',
  flux: 'flux-schnell',
  turbo: 'z-image-turbo',
  seedream: 'seedream-v4',
  edit: 'default',
};

export const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
};

export interface ProcessImageParams {
  userId: string;
  prompt: string;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    size?: number;
    base64Data?: string;
  }>;
  imageBase64?: string;
  aspectRatio?: string;
  model?: string;
  apiKey?: string;
}

export interface ImageProcessResult {
  file: GeneratedFileSummary;
  explanation: string;
  modelUsed: string;
}

export interface VisionAnalysisResult {
  isPerson: boolean;
  gender: 'man' | 'woman' | 'boy' | 'girl' | 'unspecified';
  subjectSummary: string;
  clothing: string;
  style: 'cartoon' | 'anime' | 'photorealistic' | 'artistic' | 'edit';
  optimizedPrompt: string;
  negativePrompt: string;
}

const tempImageStore = new Map<string, { buffer: Buffer; mimeType: string; createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of tempImageStore.entries()) {
    if (now - item.createdAt > 15 * 60 * 1000) tempImageStore.delete(id);
  }
}, 5 * 60 * 1000);

export function getTempImage(id: string): { buffer: Buffer; mimeType: string } | null {
  const item = tempImageStore.get(id);
  return item ? { buffer: item.buffer, mimeType: item.mimeType } : null;
}

export class ImageService {
  private static instance: ImageService | null = null;
  private aiClient: GoogleGenAI | null = null;

  public static getInstance(): ImageService {
    if (!ImageService.instance) ImageService.instance = new ImageService();
    return ImageService.instance;
  }

  private getApiKey(customKey?: string): string {
    return (
      (customKey || '').trim() ||
      process.env.MAGIC_HOUR_API_KEY ||
      process.env.MAGIC_HOUR_TOKEN ||
      process.env.MAGIC_HOUR_API_TOKEN ||
      ''
    );
  }

  private getMagicHourClient(customKey?: string): Client {
    const token = this.getApiKey(customKey);
    if (!token) {
      throw new Error(
        'MAGIC_HOUR_API_KEY haijawekwa. Tafadhali weka API key ya Magic Hour Studio kwenye Security Center au Mipangilio (Settings) ili kuwezesha uundaji na uhariri wa picha kwenye APK na mtandaoni.'
      );
    }
    return new Client({ token });
  }

  private getGenAIClient(): GoogleGenAI | null {
    if (!this.aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }
    return this.aiClient;
  }

  public async analyzeImageWithVision(
    base64Data: string,
    mimeType = 'image/jpeg',
    userInstruction = ''
  ): Promise<VisionAnalysisResult> {
    const fallback: VisionAnalysisResult = {
      isPerson: true,
      gender: 'unspecified',
      subjectSummary: 'Mtu kutoka kwenye picha ya asili',
      clothing: 'mavazi halisi ya picha',
      style: 'edit',
      optimizedPrompt: `${userInstruction || 'Edit this image according to the user instruction'}, preserve the exact person, face, body, clothing and important details from the source image.`,
      negativePrompt: 'different person, different clothes, distorted face, bad anatomy, extra limbs',
    };

    const ai = this.getGenAIClient();
    if (!ai || !base64Data) return fallback;

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { inlineData: { data: cleanBase64, mimeType } },
          {
            text: `Analyze this uploaded image for an image editing request. User instruction: "${userInstruction}". Return ONLY JSON with: optimizedPrompt, negativePrompt, gender, subjectSummary, clothing, style. The optimized prompt must tell the image editor to preserve the original subject identity, face, clothing and composition unless the user explicitly asks to change them.`,
          },
        ],
      });
      const raw = (response.text || '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      const p = JSON.parse(match[0]);
      return {
        isPerson: true,
        gender: ['man', 'woman', 'boy', 'girl'].includes(p.gender) ? p.gender : 'unspecified',
        subjectSummary: p.subjectSummary || fallback.subjectSummary,
        clothing: p.clothing || fallback.clothing,
        style: p.style || 'edit',
        optimizedPrompt: p.optimizedPrompt || fallback.optimizedPrompt,
        negativePrompt: p.negativePrompt || fallback.negativePrompt,
      };
    } catch (e: any) {
      console.warn('[MKUU-BACKEND] Vision analysis fallback:', e?.message || e);
      return fallback;
    }
  }

  /**
   * Translates Swahili/English user requests into high-fidelity diffusion prompts.
   * Enforces strict gender accuracy (e.g. male artist -> handsome African male),
   * prestigious 3D branding for MKUU AI logo, and HD photorealism.
   */
  public async optimizePromptForGeneration(userPrompt: string): Promise<{ prompt: string; negativePrompt: string }> {
    const defaultNegative =
      'female, woman, girl (if male requested), male, man (if female requested), zombie, scary, horror, distorted face, bad anatomy, deformed limbs, extra fingers, 2D flat, low quality, blurry, watermark';

    if (!userPrompt || userPrompt.trim().length === 0) {
      return {
        prompt: 'A magnificent 3D HD photorealistic render, 8k resolution, octane render, volumetric studio lighting, rich depth of field.',
        negativePrompt: defaultNegative,
      };
    }

    const ai = this.getGenAIClient();
    if (!ai) {
      return {
        prompt: `${userPrompt.trim()}, 3D HD photorealistic render, 8k resolution, cinematic lighting, sharp focus, detailed textures`,
        negativePrompt: defaultNegative,
      };
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            text: `The user requested image generation in MKUU AI (in Swahili or English): "${userPrompt}".
Translate and expand this into an ultra-detailed, professional English prompt for modern diffusion models.
Crucial rules:
1. Always generate in 3D HD / Photorealistic 3D, 8K resolution, octane render, volumetric lighting, rich textures. Avoid flat 2D cartoon unless explicitly asked.
2. Strict Gender Fidelity:
   - If user asks for a male artist or man ('wa kiume', 'bwana', 'mvulana', 'mwanaume', 'man', 'male artist'), the prompt MUST describe an African male artist with masculine facial features, sharp haircut, modern stylish streetwear, masculine posture. Negative prompt MUST include 'female, woman, girl'.
   - If user asks for female ('wa kike', 'mwanamke', 'msichana', 'woman', 'female'), describe a female subject. Negative prompt MUST include 'male, man, boy'.
3. MKUU AI Logo:
   - If user mentions 'logo ya mkuu ai' or 'nembo', create a prestigious 3D HD emblem logo for MKUU AI: futuristic artificial intelligence leader crest, glowing gold and sapphire blue circuit accents, clean corporate geometry, luxury 3D finish. Negative prompt MUST include 'zombie, horror, distorted faces, monster, ugly'.
4. Output strictly JSON:
{"prompt": "detailed English prompt...", "negativePrompt": "negative prompt..."}`,
          },
        ],
      });

      const raw = (response.text || '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.prompt) {
          return {
            prompt: parsed.prompt,
            negativePrompt: parsed.negativePrompt || defaultNegative,
          };
        }
      }
    } catch (e: any) {
      console.warn('[MKUU-BACKEND] Prompt optimization fallback:', e?.message || e);
    }

    return {
      prompt: `${userPrompt.trim()}, 3D HD photorealistic, 8k resolution, Unreal Engine 5 render style, cinematic lighting, ultra sharp focus`,
      negativePrompt: defaultNegative,
    };
  }

  /**
   * REAL IMAGE EDITING via Magic Hour Studio.
   * Uploads the source image to Magic Hour and uses /v1/ai-image-editor.
   */
  private async fetchMagicHourEdit(options: {
    prompt: string;
    model?: string;
    aspectRatio?: string;
    imageBase64: string;
    mimeType: string;
    apiKey?: string;
  }): Promise<{ buffer: Buffer; contentType: string; modelUsed: string }> {
    const client = this.getMagicHourClient(options.apiKey);

    const cleanBase64 = options.imageBase64.includes(',')
      ? options.imageBase64.split(',')[1]
      : options.imageBase64;
    if (!cleanBase64) throw new Error('Picha ya kuhariri haijatumwa vizuri.');

    const isPng = (options.mimeType || '').toLowerCase().includes('png');
    const ext = isPng ? 'png' : 'jpg';
    const tempFilePath = path.join(
      os.tmpdir(),
      `magichour_input_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    );

    const sourceBuffer = Buffer.from(cleanBase64, 'base64');
    await fs.promises.writeFile(tempFilePath, sourceBuffer);

    try {
      console.log(`[MKUU-BACKEND] [MAGIC_HOUR_EDIT] Sending image edit to Magic Hour Studio, size=${sourceBuffer.length} bytes`);

      const validAspectRatios = ['16:9', '1:1', '2:3', '3:2', '4:3', '4:5', '9:16', 'auto'] as const;
      type AspectType = (typeof validAspectRatios)[number];
      const aspect: AspectType = validAspectRatios.includes(options.aspectRatio as AspectType)
        ? (options.aspectRatio as AspectType)
        : 'auto';

      const validModels = [
        'default',
        'flux-2-klein',
        'gpt-image-2',
        'gpt-image-2.5-flare',
        'nano-banana',
        'nano-banana-2',
        'nano-banana-2-lite',
        'nano-banana-pro',
        'qwen-edit',
        'seedream-v4',
        'seedream-v4.5',
        'seedream-v5-pro',
      ] as const;
      type ModelType = (typeof validModels)[number];
      const model: ModelType = validModels.includes(options.model as ModelType)
        ? (options.model as ModelType)
        : 'default';

      const res = await client.v1.aiImageEditor.generate(
        {
          assets: {
            imageFilePaths: [tempFilePath],
          },
          name: `Mkuu_Edit_${Date.now()}`,
          aspectRatio: aspect,
          model,
          style: {
            prompt: options.prompt,
          },
        },
        {
          waitForCompletion: true,
          downloadOutputs: false,
        }
      );

      const downloadItem = res.downloads?.[0];
      if (!downloadItem?.url) {
        throw new Error('Magic Hour Studio haikurudisha kiungo cha kupakua picha iliyohaririwa.');
      }

      const response = await fetch(downloadItem.url);
      if (!response.ok) {
        throw new Error(`Kupakua picha kutoka Magic Hour kumeshindikana: HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        buffer,
        contentType: response.headers.get('content-type') || 'image/png',
        modelUsed: `Magic Hour Studio (AI Image Editor: ${model})`,
      };
    } catch (err: any) {
      console.error('[MKUU-BACKEND] [MAGIC_HOUR_EDIT] Error:', err);
      throw new Error(`Hitilafu ya Magic Hour Studio wakati wa kuhariri picha: ${err?.message || err}`);
    } finally {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {}
    }
  }

  /**
   * Generates images using Magic Hour Studio (v1/ai-image-generator).
   */
  private async fetchMagicHourGeneration(options: {
    prompt: string;
    model?: string;
    aspectRatio?: string;
    apiKey?: string;
  }): Promise<{ buffer: Buffer; contentType: string; modelUsed: string }> {
    const client = this.getMagicHourClient(options.apiKey);

    const validAspectRatios = ['16:9', '1:1', '9:16'] as const;
    type AspectType = (typeof validAspectRatios)[number];
    const aspect: AspectType = validAspectRatios.includes(options.aspectRatio as AspectType)
      ? (options.aspectRatio as AspectType)
      : '1:1';

    const validModels = [
      'default',
      'flux-2-klein',
      'flux-schnell',
      'gpt-image-2',
      'gpt-image-2.5-flare',
      'nano-banana',
      'nano-banana-2',
      'nano-banana-2-lite',
      'nano-banana-pro',
      'seedream',
      'seedream-v4',
      'seedream-v5-pro',
      'z-image-turbo',
    ] as const;
    type ModelType = (typeof validModels)[number];
    const model: ModelType = validModels.includes(options.model as ModelType)
      ? (options.model as ModelType)
      : 'default';

    console.log(`[MKUU-BACKEND] [MAGIC_HOUR_GEN] Requesting prompt="${options.prompt.slice(0, 80)}" model=${model} aspect=${aspect}`);

    try {
      const res = await client.v1.aiImageGenerator.generate(
        {
          imageCount: 1,
          name: `Mkuu_${Date.now()}`,
          aspectRatio: aspect,
          model,
          style: {
            prompt: options.prompt,
            tool: 'ai-photo-generator',
          },
        },
        {
          waitForCompletion: true,
          downloadOutputs: false,
        }
      );

      const downloadItem = res.downloads?.[0];
      if (!downloadItem?.url) {
        throw new Error('Magic Hour Studio haikurudisha kiungo cha picha iliyozalishwa.');
      }

      const imageRes = await fetch(downloadItem.url);
      if (!imageRes.ok) {
        throw new Error(`Kupakua picha kutoka Magic Hour kumeshindikana: HTTP ${imageRes.status}`);
      }

      const buffer = Buffer.from(await imageRes.arrayBuffer());
      return {
        buffer,
        contentType: imageRes.headers.get('content-type') || 'image/png',
        modelUsed: `Magic Hour Studio (${model})`,
      };
    } catch (err: any) {
      console.error('[MKUU-BACKEND] [MAGIC_HOUR_GEN] Error:', err);
      throw new Error(`Hitilafu ya Magic Hour Studio wakati wa kutengeneza picha: ${err?.message || err}`);
    }
  }

  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments, imageBase64, aspectRatio = '1:1', apiKey } = params;
    const lower = (prompt || '').toLowerCase().trim();
    const imageAttachment = attachments?.find(
      (a) =>
        a.mimeType?.startsWith('image/') ||
        a.base64Data?.startsWith('data:image/') ||
        ['jpg', 'jpeg', 'png', 'webp'].includes(a.fileType?.toLowerCase() || '')
    );

    let rawCleanBase64 = imageBase64 || imageAttachment?.base64Data || '';
    if (rawCleanBase64.includes(',')) rawCleanBase64 = rawCleanBase64.split(',')[1];
    const imageMimeType = imageAttachment?.mimeType || 'image/jpeg';
    const hasSourceImage = Boolean(rawCleanBase64);

    console.log(`[MKUU-BACKEND] [MAGIC_HOUR] hasSourceImage=${hasSourceImage} prompt="${prompt.slice(0, 100)}"`);

    let finalPrompt = prompt?.trim() || 'Create a high quality photorealistic image.';
    let operationLabel = 'Uundaji wa Picha';
    let editModel = params.model || 'default';
    let visionAnalysis: VisionAnalysisResult | null = null;
    let effectiveAspectRatio = aspectRatio || '1:1';

    if (!params.aspectRatio || params.aspectRatio === '1:1') {
      if (lower.includes('banner')) {
        effectiveAspectRatio = '16:9';
      }
    }

    if (hasSourceImage) {
      operationLabel = 'Uhariri wa Picha';
      visionAnalysis = await this.analyzeImageWithVision(rawCleanBase64, imageMimeType, prompt);
      finalPrompt = visionAnalysis.optimizedPrompt || finalPrompt;

      if (/remove background|ondoa background|toa background|futa background|transparent/i.test(lower)) {
        operationLabel = 'Kuondoa Background';
        finalPrompt = `${prompt?.trim() || 'Remove the background'}, preserve the exact person/object, face, body, clothes, colors and edges from the source image; change only the background; create a clean transparent/isolated result.`;
      }

      if (/cartoon|katuni|animation|pixar|disney|anime|caricature|chora/i.test(lower)) {
        operationLabel = 'Ubadilishaji wa Katuni';
        finalPrompt = `${finalPrompt}. Use the uploaded image as the source. Preserve the same person, face, pose, clothing and recognizable identity while applying the requested 3D cartoon style.`;
      }

      if (/hd|enhance|boresha|upscale|clarity|4k/i.test(lower)) {
        operationLabel = 'Kuboresha Picha (HD)';
        finalPrompt = `${finalPrompt}. Preserve the original subject and composition; improve detail, sharpness and resolution without replacing the person.`;
      }

      console.log(`[MKUU-BACKEND] [IMAGE_EDIT] source bytes=${Buffer.from(rawCleanBase64, 'base64').length} model=${editModel}`);
    } else {
      if (lower.includes('banner')) {
        operationLabel = 'Uundaji wa Banner';
      } else if (lower.includes('logo') || lower.includes('nembo')) {
        operationLabel = 'Uundaji wa Nembo / Logo (HD)';
      } else if (lower.includes('cartoon') || lower.includes('katuni')) {
        operationLabel = 'Uundaji wa Katuni';
      }

      // Text-to-image generation: Translate and optimize prompt with Gemini for 3D HD,
      // strict gender fidelity (e.g. male artist stays male), and premium branding (MKUU AI logo without zombie)
      const optimized = await this.optimizePromptForGeneration(prompt);
      finalPrompt = `${optimized.prompt}. Quality: 3D HD, photorealistic 8k, Unreal Engine 5 render style, cinematic lighting. Avoid: ${optimized.negativePrompt}`;
      console.log(`[MKUU-BACKEND] [IMAGE_GEN_PROMPT] User="${prompt}" -> Optimized="${finalPrompt.slice(0, 120)}..."`);
    }

    const result = hasSourceImage
      ? await this.fetchMagicHourEdit({
          prompt: finalPrompt,
          model: editModel,
          aspectRatio: effectiveAspectRatio,
          imageBase64: rawCleanBase64,
          mimeType: imageMimeType,
          apiKey,
        })
      : await this.fetchMagicHourGeneration({
          prompt: finalPrompt,
          model: params.model || 'default',
          aspectRatio: effectiveAspectRatio,
          apiKey,
        });

    const base64Output = result.buffer.toString('base64');
    const isJpeg = result.contentType.includes('jpeg') || result.contentType.includes('jpg');
    const fileType: 'jpg' | 'png' = isJpeg ? 'jpg' : 'png';
    const timestamp = Date.now().toString().slice(-4);
    const filename =
      operationLabel === 'Kuondoa Background'
        ? `Picha_Bila_Background_${timestamp}.png`
        : operationLabel === 'Uundaji wa Banner'
          ? `Banner_ya_Max_${timestamp}.${fileType}`
          : operationLabel.includes('Logo') || operationLabel.includes('Nembo')
            ? `Logo_ya_Max_${timestamp}.${fileType}`
            : operationLabel.includes('Katuni')
              ? `Katuni_ya_Max_${timestamp}.${fileType}`
              : hasSourceImage
                ? `Picha_Iliyohaririwa_${timestamp}.${fileType}`
                : `Picha_ya_Max_${timestamp}.${fileType}`;
    const fileTitle = hasSourceImage
      ? `Picha Iliyohaririwa - ${operationLabel} (Magic Hour Studio)`
      : `${operationLabel} (Magic Hour Studio)`;

    const saved = await generateRealFile({
      userId,
      filename,
      fileType,
      title: fileTitle,
      content: base64Output,
      base64Data: base64Output,
      description: `Picha halisi iliyotengenezwa na Magic Hour Studio (${operationLabel}, Model: ${result.modelUsed}).`,
    });

    const explanation = hasSourceImage
      ? `Ndiyo Max wangu! Nimetumia picha yako halisi kama source kwenye Magic Hour Studio Image Editor, kisha nikatekeleza maelekezo yako: "${prompt}". Picha iliyohaririwa ipo tayari hapa chini.`
      : `Ndiyo Max wangu! Nimetengeneza picha yako kupitia Magic Hour Studio kulingana na maelekezo yako: "${prompt}". Picha ipo tayari hapa chini.`;

    return { file: saved, explanation, modelUsed: result.modelUsed };
  }
}

export const imageService = ImageService.getInstance();
