import { z } from 'zod';
import { ContentProfileStatus, Language } from '@prisma/client';

export const PromptVariablesSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string(), z.number(), z.boolean()])
);

export const BrandingRulesSchema = z
  .object({
    text: z.string().max(100).optional(),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']).optional(),
    color: z.string().max(32).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

export const WatermarkRulesSchema = z
  .object({
    text: z.string().max(100).optional(),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

export const CaptionStrategySchema = z
  .object({
    template: z.string().max(500).optional(),
    prefix: z.string().max(200).optional(),
    suffix: z.string().max(200).optional(),
  })
  .strict();

export const HashtagStrategySchema = z
  .object({
    tags: z.array(z.string().min(1).max(50)).max(30).optional(),
    mode: z.enum(['append', 'prepend', 'replace', 'none']).optional(),
  })
  .strict();

export const MusicSelectionRulesSchema = z
  .object({
    mood: z.string().min(1).max(50).optional(),
    genre: z.string().min(1).max(50).optional(),
    tempo: z.string().max(50).optional(),
    minDurationSeconds: z.number().min(0).max(3600).optional(),
    maxDurationSeconds: z.number().min(0).max(3600).optional(),
  })
  .strict();

export const BackgroundSelectionRulesSchema = z
  .object({
    selectionMode: z.enum(['Manual', 'AI']).optional(),
    manualAssetId: z.string().uuid('Invalid manualAssetId UUID format').optional(),
    mood: z.string().min(1).max(50).optional(),
    style: z.string().min(1).max(50).optional(),
    theme: z.string().min(1).max(50).optional(),
    tags: z.array(z.string().min(1).max(30)).max(20).optional(),
    orientation: z.enum(['portrait', 'landscape', 'square']).optional(),
  })
  .strict()
  .refine(
    (val) => val.selectionMode !== 'Manual' || !!val.manualAssetId,
    { message: 'manualAssetId is required when selectionMode is Manual' }
  );

export const RenderingConfigurationSchema = z
  .object({
    animation: z
      .object({
        preset: z
          .enum([
            'None',
            'SlowZoomIn',
            'SlowZoomOut',
            'PanLeft',
            'PanRight',
            'PanUp',
            'PanDown',
          ])
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ValidationRulesSchema = z
  .object({
    bannedWords: z.array(z.string().min(1).max(50)).max(100).optional(),
    minLength: z.number().min(0).max(10000).optional(),
    maxLength: z.number().min(1).max(10000).optional(),
    strictProfanity: z.boolean().optional(),
  })
  .strict();

export const ContentProfileCreateSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  notes: z.string().max(500).optional().nullable(),
  status: z.nativeEnum(ContentProfileStatus),
  contentTypeId: z.string().uuid('Invalid ContentType ID format'),
  promptVersionId: z.string().uuid('Invalid PromptVersion ID format'),
  templateVersionId: z.string().uuid('Invalid TemplateVersion ID format'),
  language: z.nativeEnum(Language),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
  promptVariables: PromptVariablesSchema.default({}),
  brandingRules: BrandingRulesSchema.default({}),
  watermarkRules: WatermarkRulesSchema.default({}),
  captionStrategy: CaptionStrategySchema.default({}),
  hashtagStrategy: HashtagStrategySchema.default({}),
  musicSelectionRules: MusicSelectionRulesSchema.default({}),
  backgroundSelectionRules: BackgroundSelectionRulesSchema.default({}),
  renderingConfiguration: RenderingConfigurationSchema.default({}),
  validationRules: ValidationRulesSchema.default({}),
});

export const ContentProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional().nullable(),
  status: z.nativeEnum(ContentProfileStatus).optional(),
  contentTypeId: z.string().uuid().optional(),
  promptVersionId: z.string().uuid().optional(),
  templateVersionId: z.string().uuid().optional(),
  language: z.nativeEnum(Language).optional(),
  tone: z.string().optional(),
  writingStyle: z.string().optional(),
  promptVariables: PromptVariablesSchema.optional(),
  brandingRules: BrandingRulesSchema.optional(),
  watermarkRules: WatermarkRulesSchema.optional(),
  captionStrategy: CaptionStrategySchema.optional(),
  hashtagStrategy: HashtagStrategySchema.optional(),
  musicSelectionRules: MusicSelectionRulesSchema.optional(),
  backgroundSelectionRules: BackgroundSelectionRulesSchema.optional(),
  renderingConfiguration: RenderingConfigurationSchema.optional(),
  validationRules: ValidationRulesSchema.optional(),
});

export type ContentProfileInput = z.infer<typeof ContentProfileCreateSchema>;
export type ContentProfileUpdateInput = z.infer<typeof ContentProfileUpdateSchema>;
