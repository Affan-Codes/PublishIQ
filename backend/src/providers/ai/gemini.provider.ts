import { AIProviderAdapter, PromptVersionData, StructuredAIResponse } from './ai-provider.interface.js';
import { env } from '../../config/env.js';
import { ExternalProviderError } from '../../errors/custom-errors.js';
import { logger } from '../../utils/logger.js';

const apiKey = env.GEMINI_API_KEY;

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

    try {
      logger.debug({ versionNumber: prompt.versionNumber }, 'Sending request to Gemini API');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const contents = [
        {
          parts: [{ text: finalPrompt }],
        },
      ];

      const generationConfig: Record<string, any> = {};
      if (responseSchema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = responseSchema;
      }

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
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini API returned an empty or invalid response structure.');
      }

      logger.debug('Gemini API call succeeded.');

      return {
        text: text.trim(),
        metadata: {
          model: 'gemini-1.5-flash',
          promptVersion: prompt.versionNumber,
        },
      };
    } catch (err: any) {
      logger.error({ err }, 'Gemini API generation failed');
      throw new ExternalProviderError('Gemini', err.message, err);
    }
  },
};

export default geminiProvider;
