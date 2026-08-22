import { AIProviderAdapter, PromptVersionData, StructuredAIResponse } from './ai-provider.interface.js';
import { env } from '../../config/env.js';
import { ExternalProviderError, ValidationError } from '../../errors/custom-errors.js';
import { logger } from '../../utils/logger.js';
import { AIContentResponseSchema } from '../../schemas/ai-response.schema.js';
import { systemConfigCache } from '../../config/system-config.cache.js';
import { extractPromptVariables } from '../../constants/prompt-variables.js';

export const LANGUAGE_SCRIPT_INSTRUCTIONS: Record<string, string> = {
  English: 'Write the output in English.',
  Hindi: 'Write the output in Hindi using Devanagari script (हिंदी में देवनागरी लिपि का प्रयोग करें). Do not use Latin/Roman characters.',
  Urdu: 'Write the output in Urdu using Arabic/Nastaliq script (اردو میں نستعلیق رسم الخط کا استعمال کریں). Do not use Latin/Roman characters.',
  HindiRoman: 'Write the output in Hindi language, but using ONLY Latin/Roman alphabet characters (a-z, A-Z) — this is Hindi written in Roman transliteration, NOT Devanagari script. Do not use any Devanagari characters.',
  UrduRoman: 'Write the output in Urdu language, but using ONLY Latin/Roman alphabet characters (a-z, A-Z) — this is Urdu written in Roman transliteration, NOT Arabic/Nastaliq script. Do not use any Arabic or Urdu script characters.',
};

// JSON schema definition to send to Gemini API for structured JSON response format
export const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A short headline or title for the generated content (MUST NOT exceed 100 characters)' },
    quote: { type: 'STRING', description: 'The main motivational/business quote or Shayari text in the requested language' },
    blocks: {
      type: 'ARRAY',
      description: 'Optional structured content blocks (1-12 blocks). Each block has type (heading, body, code, divider, list_item), optional role (default, label, command, error, attribution, cta), and runs (1-6 runs with text and optional emphasis: primary, secondary, normal, muted).',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', description: 'Block type: heading | body | code | divider | list_item' },
          role: { type: 'STRING', description: 'Block semantic role: default | label | command | error | attribution | cta' },
          runs: {
            type: 'ARRAY',
            description: 'Text segments within this block (1-6 runs)',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING', description: 'Plain text of the run (1-220 chars, no HTML)' },
                emphasis: { type: 'STRING', description: 'Semantic emphasis: primary | secondary | normal | muted' },
              },
              required: ['text'],
            },
          },
        },
        required: ['type', 'runs'],
      },
    },
    caption: { type: 'STRING', description: 'A descriptive caption for social media posts (MUST NOT exceed 100 characters)' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'At least 3 relevant hashtags' },
    metadata: { type: 'OBJECT', description: 'Any extra generation metadata or settings' },
    language: { type: 'STRING', description: 'The language code or name of the output text (English, Hindi, Urdu, HindiRoman, or UrduRoman)' },
    contentType: { type: 'STRING', description: 'The type of the content (e.g. Shayari, Motivational Quote, etc.)' },
    selectedMusicAssetId: { type: 'STRING', description: 'The id of the single best-matching music asset from the provided catalog, or omit if none fit well' },
    selectedBackgroundAssetId: { type: 'STRING', description: 'The id of the single best-matching background asset from the provided catalog, or omit if none fit well' },
  },
  required: ['title', 'quote', 'caption', 'hashtags', 'language', 'contentType']
};

/**
 * Helper to perform an async action with retries and exponential backoff.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
  factor: number = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(factor, attempt - 1);
      logger.warn({ attempt, backoff, error: err.message }, 'Gemini API attempt failed, retrying...');
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

export const geminiProvider: AIProviderAdapter = {
  async generate(
    prompt: PromptVersionData,
    variables: Record<string, unknown>,
    responseSchema?: any
  ): Promise<StructuredAIResponse> {
    // Replace variables in the prompt body
    let finalPrompt = prompt.body;
    for (const [key, value] of Object.entries(variables)) {
      finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // CFG-02: Last line of defense - ensure no unmatched placeholders remain
    const remainingTokens = extractPromptVariables(finalPrompt);
    if (remainingTokens.length > 0) {
      throw new ValidationError(
        `Unmatched prompt placeholder(s) detected: ${remainingTokens.map((t) => `{{${t}}}`).join(', ')}`
      );
    }

    // AQL-20: Append authoritative Language Script Instruction
    const langKey = String(variables.language || 'English');
    const scriptInstruction = LANGUAGE_SCRIPT_INSTRUCTIONS[langKey] || LANGUAGE_SCRIPT_INSTRUCTIONS.English;
    finalPrompt = `${finalPrompt}\n\nLanguage & Script Instruction: ${scriptInstruction}`;

    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ExternalProviderError(
        'Gemini',
        'Gemini API key is not configured. Set GEMINI_API_KEY in your environment.'
      );
    }

    const sysModel = await systemConfigCache.get<string>('ai.gemini_model');
    const modelName = sysModel || env.GEMINI_MODEL || 'gemini-2.5-flash';

    const executeCall = async (): Promise<StructuredAIResponse> => {
      logger.debug({ versionNumber: prompt.versionNumber, model: modelName }, 'Sending request to Gemini API');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const contents = [
        {
          parts: [{ text: finalPrompt }],
        },
      ];

      const generationConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        responseSchema: responseSchema || geminiResponseSchema,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API returned an empty or invalid response structure.');
      }

      // Try parsing and validating the JSON response
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawText.trim());
        if (parsedJson && typeof parsedJson === 'object') {
          if (typeof parsedJson.title === 'string' && parsedJson.title.length > 100) {
            parsedJson.title = parsedJson.title.substring(0, 97) + '...';
          }
          if (typeof parsedJson.caption === 'string' && parsedJson.caption.length > 100) {
            parsedJson.caption = parsedJson.caption.substring(0, 97) + '...';
          }
        }
      } catch (err: any) {
        throw new Error(`Failed to parse Gemini response as JSON: ${err.message}. Raw output: ${rawText}`);
      }

      const validated = AIContentResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new Error(`Gemini response failed schema validation: ${JSON.stringify(validated.error.format())}`);
      }

      logger.debug('Gemini API call and structured response validation succeeded.');

      const result = validated.data;
      return {
        text: result.quote.trim(),
        blocks: result.blocks,
        metadata: {
          title: result.title.trim(),
          caption: result.caption.trim(),
          hashtags: result.hashtags,
          language: result.language.trim(),
          contentType: result.contentType.trim(),
          selectedMusicAssetId: result.selectedMusicAssetId ? result.selectedMusicAssetId.trim() : undefined,
          selectedBackgroundAssetId: result.selectedBackgroundAssetId ? result.selectedBackgroundAssetId.trim() : undefined,
          generationMetadata: result.metadata,
          model: modelName,
          promptVersion: prompt.versionNumber,
        },
      };
    };

    try {
      const retryVal = await systemConfigCache.get<number>('retry_limit.generation');
      const maxRetries = typeof retryVal === 'number' ? retryVal : 3;
      return await retryWithBackoff(executeCall, maxRetries, 1000, 2);
    } catch (err: any) {
      logger.error({ err }, 'Gemini API generation failed after all retries');
      throw new ExternalProviderError('Gemini', err.message, err);
    }
  },

  async selectBestBackgroundMatch(
    catalog: Array<{ id: string; name: string; mood?: string; style?: string; theme?: string; orientation?: string; tags?: string[] }>,
    contentContext: { quote: string; language: string; tone: string; style: string }
  ): Promise<string | null> {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ExternalProviderError(
        'Gemini',
        'Gemini API key is not configured. Set GEMINI_API_KEY in your environment.'
      );
    }

    const sysModel = await systemConfigCache.get<string>('ai.gemini_model');
    const modelName = sysModel || env.GEMINI_MODEL || 'gemini-2.5-flash';

    const selectionSchema = {
      type: 'OBJECT',
      properties: {
        selectedBackgroundAssetId: {
          type: 'STRING',
          description: 'The id of the single best-matching background image asset from the provided catalog',
        },
      },
      required: ['selectedBackgroundAssetId'],
    };

    const promptText = `You are selecting the best background image for the following social media post:
Quote: "${contentContext.quote}"
Language: ${contentContext.language}
Tone: ${contentContext.tone}
Style: ${contentContext.style}

Available Background Image Candidates (JSON):
${JSON.stringify(catalog, null, 2)}

Select the single best background image asset ID from the available candidates. Return valid JSON matching the schema.`;

    const executeCall = async (): Promise<string | null> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: selectionSchema,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      try {
        const parsed = JSON.parse(rawText.trim());
        if (typeof parsed?.selectedBackgroundAssetId === 'string' && parsed.selectedBackgroundAssetId.trim().length > 0) {
          return parsed.selectedBackgroundAssetId.trim();
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Failed to parse Gemini background selection response');
      }
      return null;
    };

    try {
      return await retryWithBackoff(executeCall, 2, 800, 2);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Gemini background selection recovery call failed');
      return null;
    }
  },
};

export default geminiProvider;
