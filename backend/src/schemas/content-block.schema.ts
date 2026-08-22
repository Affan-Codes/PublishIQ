import { z } from 'zod';

export const EmphasisRoleSchema = z.enum(['primary', 'secondary', 'normal', 'muted']);
export const BlockTypeSchema = z.enum(['heading', 'body', 'code', 'divider', 'list_item']);
export const BlockRoleSchema = z.enum(['default', 'label', 'command', 'error', 'attribution', 'cta']);

export const ContentRunSchema = z
  .object({
    text: z
      .string()
      .min(1, 'Run text cannot be empty')
      .max(220, 'Run text cannot exceed 220 characters')
      .refine(
        (txt) => !/[<>]/.test(txt) && !/javascript:/i.test(txt) && !/data:text\/html/i.test(txt),
        { message: 'Run text cannot contain HTML tags or script URI prefixes' }
      ),
    emphasis: EmphasisRoleSchema.optional(),
  })
  .strict();

export const ContentBlockSchema = z
  .object({
    type: BlockTypeSchema,
    role: BlockRoleSchema.optional(),
    runs: z.array(ContentRunSchema).max(6, 'A block cannot have more than 6 runs'),
  })
  .strict()
  .refine((b) => b.type === 'divider' || b.runs.length >= 1, {
    message: 'runs must contain at least one item unless type is divider',
  });

export const StructuredContentSchema = z
  .object({
    blocks: z
      .array(ContentBlockSchema)
      .min(1, 'Structured content must contain at least 1 block')
      .max(12, 'Structured content cannot exceed 12 blocks'),
  })
  .strict()
  .refine(
    (data) => {
      try {
        const serialized = JSON.stringify(data.blocks);
        return serialized.length <= 4096;
      } catch {
        return false;
      }
    },
    { message: 'Serialized structured content payload cannot exceed 4KB' }
  );

export type EmphasisRole = z.infer<typeof EmphasisRoleSchema>;
export type BlockType = z.infer<typeof BlockTypeSchema>;
export type BlockRole = z.infer<typeof BlockRoleSchema>;
export type ContentRun = z.infer<typeof ContentRunSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type StructuredContent = z.infer<typeof StructuredContentSchema>;
