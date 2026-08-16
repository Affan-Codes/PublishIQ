import { z } from 'zod';

export const BackgroundMetadataSchema = z
  .object({
    mood: z.string().min(1).max(50).optional(),
    style: z.string().min(1).max(50).optional(),
    theme: z.string().min(1).max(50).optional(),
    tags: z.array(z.string().min(1).max(30)).max(20).optional(),
    orientation: z.enum(['portrait', 'landscape', 'square']).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    format: z.string().max(20).optional(),
    bytes: z.number().int().nonnegative().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
  })
  .strict();

export type BackgroundMetadata = z.infer<typeof BackgroundMetadataSchema>;
