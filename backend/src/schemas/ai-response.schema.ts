import { z } from 'zod';

export const AIContentResponseSchema = z.object({
  title: z.string().min(1, 'Title must not be empty').max(100, 'Title must not exceed 100 characters'),
  quote: z.string().min(1, 'Quote must not be empty'),
  caption: z.string().min(1, 'Caption must not be empty').max(100, 'Caption must not exceed 100 characters'),
  hashtags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
  language: z.string().min(1, 'Language must not be empty'),
  contentType: z.string().min(1, 'ContentType must not be empty'),
  selectedMusicAssetId: z.string().optional(),
  selectedBackgroundAssetId: z.string().optional(),
});

export type AIContentResponse = z.infer<typeof AIContentResponseSchema>;
