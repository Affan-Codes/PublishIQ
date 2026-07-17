import { AIProviderAdapter, PromptVersionData, StructuredAIResponse } from './ai-provider.interface.js';
import { env } from '../../config/env.js';
import { ExternalProviderError } from '../../errors/custom-errors.js';
import { logger } from '../../utils/logger.js';
import { AIContentResponseSchema } from '../../schemas/ai-response.schema.js';

const apiKey = env.GEMINI_API_KEY;

// JSON schema definition to send to Gemini API for structured JSON response format
const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A short headline or title for the generated content' },
    quote: { type: 'STRING', description: 'The main motivational/business quote or Shayari text in the requested language' },
    caption: { type: 'STRING', description: 'A descriptive caption for social media posts' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'At least 3 relevant hashtags' },
    metadata: { type: 'OBJECT', description: 'Any extra generation metadata or settings' },
    language: { type: 'STRING', description: 'The language code or name of the output text (English, Hindi, or Urdu)' },
    contentType: { type: 'STRING', description: 'The type of the content (e.g. Shayari, Motivational Quote, etc.)' }
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
    if (!apiKey) {
      throw new ExternalProviderError(
        'Gemini',
        'Gemini API key is not configured. Set GEMINI_API_KEY in your environment.'
      );
    }

    // Replace variables in the prompt body
    let finalPrompt = prompt.body;
    for (const [key, value] of Object.entries(variables)) {
      finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    const executeCall = async (): Promise<StructuredAIResponse> => {
      logger.debug({ versionNumber: prompt.versionNumber }, 'Sending request to Gemini API');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
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
        metadata: {
          title: result.title.trim(),
          caption: result.caption.trim(),
          hashtags: result.hashtags,
          language: result.language.trim(),
          contentType: result.contentType.trim(),
          generationMetadata: result.metadata,
          model: 'gemini-1.5-flash',
          promptVersion: prompt.versionNumber,
        },
      };
    };

    try {
      // Execute the call with retries (3 attempts default)
      return await retryWithBackoff(executeCall, 3, 1000, 2);
    } catch (err: any) {
      logger.error({ err }, 'Gemini API generation failed after all retries');
      throw new ExternalProviderError('Gemini', err.message, err);
    }
  },
};

export default geminiProvider;
