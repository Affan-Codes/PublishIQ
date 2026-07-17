import { z } from 'zod';

export const AIContentResponseSchema = z.object({
  title: z.string().min(1, 'Title must not be empty'),
  quote: z.string().min(1, 'Quote must not be empty'),
  caption: z.string().min(1, 'Caption must not be empty'),
  hashtags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
  language: z.string().min(1, 'Language must not be empty'),
  contentType: z.string().min(1, 'ContentType must not be empty'),
});

export type AIContentResponse = z.infer<typeof AIContentResponseSchema>;
