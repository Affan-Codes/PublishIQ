import { z } from 'zod';

export const ContentProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required'),
  language: z.enum(['English', 'Hindi', 'Urdu']),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
  contentTypeId: z.string().min(1, 'Content type is required'),
  promptVersionId: z.string().min(1, 'Prompt version is required'),
  templateVersionId: z.string().min(1, 'Template version is required'),
  captionStrategy: z.record(z.string(), z.any()).optional(),
  hashtagStrategy: z.record(z.string(), z.any()).optional(),
  musicSelectionRules: z.record(z.string(), z.any()).optional(),
  renderingConfiguration: z.record(z.string(), z.any()).optional(),
});

export type ContentProfileInput = z.infer<typeof ContentProfileSchema>;
