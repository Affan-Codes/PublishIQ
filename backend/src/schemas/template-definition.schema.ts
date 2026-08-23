import { z } from 'zod';
import {
  BlockTypeSchema,
  BlockRoleSchema,
  EmphasisRoleSchema,
  StructuredContent,
} from './content-block.schema.js';

export const TemplateCategorySchema = z.enum([
  'CodeAnalogy',
  'MinimalQuote',
  'SplitStatement',
  'Terminal',
  'CodeBlock',
]);

export const ColorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex string (e.g. #FFFFFF)');

export const ColorTokenSchema = z.enum([
  'accent',
  'primary',
  'secondary',
  'muted',
  'error',
]);

export const FontWeightSchema = z.union([
  z.literal(400),
  z.literal(600),
  z.literal(700),
]);

export const TextTransformSchema = z.enum(['none', 'uppercase', 'lowercase']);

export const TypographyRoleSchema = z.enum(['heading', 'body', 'code', 'caption']);

export const EmphasisRuleSchema = z
  .object({
    colorToken: ColorTokenSchema,
    weight: FontWeightSchema,
    textTransform: TextTransformSchema,
    letterSpacingPx: z.number().min(-10).max(50).optional(),
  })
  .strict();

export const SafeAreaInsetsSchema = z
  .object({
    topPx: z.number().int().min(0).max(400),
    bottomPx: z.number().int().min(0).max(400),
    leftPx: z.number().int().min(0).max(400),
    rightPx: z.number().int().min(0).max(400),
  })
  .strict();

export const TemplateCompatibilitySchema = z
  .object({
    supportedBlockTypes: z.array(BlockTypeSchema).min(1),
    supportedRoles: z.array(BlockRoleSchema).min(1),
    minBlocks: z.number().int().min(1).max(20),
    maxBlocks: z.number().int().min(1).max(20),
  })
  .strict();

export const TemplateDefinitionSchema = z
  .object({
    category: TemplateCategorySchema,

    layout: z
      .object({
        contentAlign: z.enum(['center', 'left']),
        verticalAnchor: z.enum(['top', 'center', 'bottom']),
        maxContentWidthPx: z.number().int().min(400).max(1000),
        blockGapPx: z.number().int().min(8).max(160),
        safeAreaInsetsPx: SafeAreaInsetsSchema.default({
          topPx: 140,
          bottomPx: 160,
          leftPx: 80,
          rightPx: 80,
        }),
      })
      .strict(),

    typography: z
      .object({
        heading: z
          .object({
            sizePx: z.number().int().min(20).max(200),
            weight: FontWeightSchema,
            lineHeight: z.number().min(0.5).max(4),
          })
          .strict(),
        body: z
          .object({
            sizePx: z.number().int().min(14).max(150),
            weight: FontWeightSchema,
            lineHeight: z.number().min(0.5).max(4),
          })
          .strict(),
        code: z
          .object({
            sizePx: z.number().int().min(14).max(150),
            lineHeight: z.number().min(0.5).max(4),
          })
          .strict(),
        caption: z
          .object({
            sizePx: z.number().int().min(10).max(100),
            weight: FontWeightSchema,
            lineHeight: z.number().min(0.5).max(4),
          })
          .strict(),
      })
      .strict(),

    colors: z
      .object({
        background: ColorHexSchema,
        primary: ColorHexSchema,
        secondary: ColorHexSchema,
        accent: ColorHexSchema,
        muted: ColorHexSchema,
        error: ColorHexSchema,
      })
      .strict(),

    emphasisRules: z
      .object({
        primary: EmphasisRuleSchema,
        secondary: EmphasisRuleSchema,
        normal: EmphasisRuleSchema,
        muted: EmphasisRuleSchema,
      })
      .strict(),

    contentMapping: z.record(
      z.string(),
      z
        .object({
          typography: TypographyRoleSchema,
          forceEmphasis: EmphasisRoleSchema.optional(),
          colorOverride: ColorTokenSchema.optional(),
        })
        .strict()
    ),

    decorations: z
      .object({
        divider: z.enum(['none', 'line', 'code_symbol']),
        codeIcon: z.boolean(),
        terminalPrompt: z.boolean(),
        heart: z.boolean(),
        cornerMark: z.boolean(),
      })
      .strict(),

    backgroundTreatment: z
      .object({
        mode: z.enum(['solid', 'image', 'gradient', 'image_overlay']),
        scrimOpacity: z.number().min(0).max(1).optional(),
      })
      .strict(),

    branding: z
      .object({
        typography: z.literal('caption'),
        sizeScalePct: z.number().min(50).max(150),
        opacityCeiling: z.number().min(0).max(1),
      })
      .strict(),

    watermark: z
      .object({
        typography: z.literal('caption'),
        sizeScalePct: z.number().min(50).max(150),
        opacityCeiling: z.number().min(0).max(1),
      })
      .strict(),

    compatibility: TemplateCompatibilitySchema,
  })
  .strict();

export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;
export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type FontWeight = z.infer<typeof FontWeightSchema>;
export type TextTransform = z.infer<typeof TextTransformSchema>;
export type TypographyRole = z.infer<typeof TypographyRoleSchema>;
export type EmphasisRule = z.infer<typeof EmphasisRuleSchema>;
export type SafeAreaInsets = z.infer<typeof SafeAreaInsetsSchema>;
export type TemplateCompatibility = z.infer<typeof TemplateCompatibilitySchema>;
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;

export const V1_TEMPLATE_DEFINITIONS: Record<TemplateCategory, TemplateDefinition> = {
  CodeAnalogy: {
    category: 'CodeAnalogy',
    layout: {
      contentAlign: 'left',
      verticalAnchor: 'center',
      maxContentWidthPx: 900,
      blockGapPx: 32,
      safeAreaInsetsPx: { topPx: 140, bottomPx: 160, leftPx: 80, rightPx: 80 },
    },
    typography: {
      heading: { sizePx: 56, weight: 700, lineHeight: 1.4 },
      body: { sizePx: 42, weight: 400, lineHeight: 1.6 },
      code: { sizePx: 36, lineHeight: 1.5 },
      caption: { sizePx: 28, weight: 600, lineHeight: 1.4 },
    },
    colors: {
      background: '#000000',
      primary: '#FFFFFF',
      secondary: '#A0AEC0',
      accent: '#F6AD55',
      muted: '#718096',
      error: '#E53E3E',
    },
    emphasisRules: {
      primary: { colorToken: 'accent', weight: 700, textTransform: 'none' },
      secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
      normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
    },
    contentMapping: {
      heading: { typography: 'heading' },
      body_default: { typography: 'body' },
      body_label: { typography: 'body', forceEmphasis: 'primary' },
      body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
      code_default: { typography: 'code' },
      code_command: { typography: 'code', forceEmphasis: 'normal' },
      body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
      list_item_default: { typography: 'body' },
    },
    decorations: {
      divider: 'none',
      codeIcon: false,
      terminalPrompt: false,
      heart: false,
      cornerMark: false,
    },
    backgroundTreatment: {
      mode: 'solid',
    },
    branding: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 1.0,
    },
    watermark: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 0.7,
    },
    compatibility: {
      supportedBlockTypes: ['heading', 'body', 'divider'],
      supportedRoles: ['default', 'label', 'attribution', 'error'],
      minBlocks: 1,
      maxBlocks: 12,
    },
  },

  MinimalQuote: {
    category: 'MinimalQuote',
    layout: {
      contentAlign: 'center',
      verticalAnchor: 'center',
      maxContentWidthPx: 880,
      blockGapPx: 48,
      safeAreaInsetsPx: { topPx: 150, bottomPx: 200, leftPx: 90, rightPx: 90 },
    },
    typography: {
      heading: { sizePx: 64, weight: 700, lineHeight: 1.5 },
      body: { sizePx: 48, weight: 400, lineHeight: 1.6 },
      code: { sizePx: 38, lineHeight: 1.5 },
      caption: { sizePx: 28, weight: 600, lineHeight: 1.4 },
    },
    colors: {
      background: '#0A0A0C',
      primary: '#FFFFFF',
      secondary: '#E2E8F0',
      accent: '#FFFFFF',
      muted: '#718096',
      error: '#E53E3E',
    },
    emphasisRules: {
      primary: { colorToken: 'primary', weight: 700, textTransform: 'uppercase' },
      secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
      normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
    },
    contentMapping: {
      heading: { typography: 'heading' },
      body_default: { typography: 'body' },
      body_label: { typography: 'body', forceEmphasis: 'primary' },
      body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
      code_default: { typography: 'code' },
      code_command: { typography: 'code', forceEmphasis: 'normal' },
      body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
      list_item_default: { typography: 'body' },
    },
    decorations: {
      divider: 'none',
      codeIcon: false,
      terminalPrompt: false,
      heart: false,
      cornerMark: false,
    },
    backgroundTreatment: {
      mode: 'solid',
    },
    branding: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 1.0,
    },
    watermark: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 0.65,
    },
    compatibility: {
      supportedBlockTypes: ['heading', 'body', 'divider'],
      supportedRoles: ['default', 'attribution', 'cta', 'error', 'label'],
      minBlocks: 1,
      maxBlocks: 6,
    },
  },

  SplitStatement: {
    category: 'SplitStatement',
    layout: {
      contentAlign: 'left',
      verticalAnchor: 'center',
      maxContentWidthPx: 900,
      blockGapPx: 36,
      safeAreaInsetsPx: { topPx: 160, bottomPx: 170, leftPx: 85, rightPx: 85 },
    },
    typography: {
      heading: { sizePx: 60, weight: 700, lineHeight: 1.4 },
      body: { sizePx: 44, weight: 400, lineHeight: 1.6 },
      code: { sizePx: 36, lineHeight: 1.5 },
      caption: { sizePx: 28, weight: 600, lineHeight: 1.4 },
    },
    colors: {
      background: '#000000',
      primary: '#FFFFFF',
      secondary: '#CBD5E0',
      accent: '#ED8936',
      muted: '#A0AEC0',
      error: '#E53E3E',
    },
    emphasisRules: {
      primary: { colorToken: 'accent', weight: 700, textTransform: 'none' },
      secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
      normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
    },
    contentMapping: {
      heading: { typography: 'heading' },
      body_default: { typography: 'body' },
      body_label: { typography: 'body', forceEmphasis: 'primary' },
      body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
      code_default: { typography: 'code' },
      code_command: { typography: 'code', forceEmphasis: 'normal' },
      body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
      list_item_default: { typography: 'body' },
    },
    decorations: {
      divider: 'line',
      codeIcon: true,
      terminalPrompt: false,
      heart: true,
      cornerMark: false,
    },
    backgroundTreatment: {
      mode: 'image_overlay',
      scrimOpacity: 0.65,
    },
    branding: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 1.0,
    },
    watermark: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 0.7,
    },
    compatibility: {
      supportedBlockTypes: ['heading', 'body', 'divider'],
      supportedRoles: ['default', 'label', 'attribution'],
      minBlocks: 2,
      maxBlocks: 8,
    },
  },

  Terminal: {
    category: 'Terminal',
    layout: {
      contentAlign: 'left',
      verticalAnchor: 'top',
      maxContentWidthPx: 920,
      blockGapPx: 28,
      safeAreaInsetsPx: { topPx: 180, bottomPx: 150, leftPx: 70, rightPx: 70 },
    },
    typography: {
      heading: { sizePx: 52, weight: 700, lineHeight: 1.4 },
      body: { sizePx: 38, weight: 400, lineHeight: 1.6 },
      code: { sizePx: 42, lineHeight: 1.5 },
      caption: { sizePx: 26, weight: 400, lineHeight: 1.4 },
    },
    colors: {
      background: '#0D1117',
      primary: '#58A6FF',
      secondary: '#8B949E',
      accent: '#7EE787',
      muted: '#484F58',
      error: '#FF7B72',
    },
    emphasisRules: {
      primary: { colorToken: 'accent', weight: 700, textTransform: 'none' },
      secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
      normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
    },
    contentMapping: {
      heading: { typography: 'heading' },
      body_default: { typography: 'body' },
      body_label: { typography: 'body', forceEmphasis: 'primary' },
      body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
      code_default: { typography: 'code' },
      code_command: { typography: 'code', forceEmphasis: 'normal' },
      body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
      list_item_default: { typography: 'body' },
    },
    decorations: {
      divider: 'none',
      codeIcon: false,
      terminalPrompt: true,
      heart: false,
      cornerMark: true,
    },
    backgroundTreatment: {
      mode: 'solid',
    },
    branding: {
      typography: 'caption',
      sizeScalePct: 90,
      opacityCeiling: 0.8,
    },
    watermark: {
      typography: 'caption',
      sizeScalePct: 90,
      opacityCeiling: 0.6,
    },
    compatibility: {
      supportedBlockTypes: ['code', 'body', 'list_item', 'divider'],
      supportedRoles: ['default', 'command', 'error', 'attribution'],
      minBlocks: 1,
      maxBlocks: 10,
    },
  },

  CodeBlock: {
    category: 'CodeBlock',
    layout: {
      contentAlign: 'left',
      verticalAnchor: 'center',
      maxContentWidthPx: 920,
      blockGapPx: 36,
      safeAreaInsetsPx: { topPx: 130, bottomPx: 150, leftPx: 75, rightPx: 75 },
    },
    typography: {
      heading: { sizePx: 56, weight: 700, lineHeight: 1.4 },
      body: { sizePx: 42, weight: 400, lineHeight: 1.6 },
      code: { sizePx: 38, lineHeight: 1.6 },
      caption: { sizePx: 28, weight: 600, lineHeight: 1.4 },
    },
    colors: {
      background: '#1E1E1E',
      primary: '#D4D4D4',
      secondary: '#252526',
      accent: '#4EC9B0',
      muted: '#6A9955',
      error: '#F44747',
    },
    emphasisRules: {
      primary: { colorToken: 'accent', weight: 600, textTransform: 'none' },
      secondary: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
      muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
    },
    contentMapping: {
      heading: { typography: 'heading' },
      body_default: { typography: 'body' },
      body_label: { typography: 'body', forceEmphasis: 'primary' },
      body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
      code_default: { typography: 'code' },
      code_command: { typography: 'code', forceEmphasis: 'normal' },
      body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
      list_item_default: { typography: 'body' },
    },
    decorations: {
      divider: 'none',
      codeIcon: true,
      terminalPrompt: false,
      heart: false,
      cornerMark: false,
    },
    backgroundTreatment: {
      mode: 'solid',
    },
    branding: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 1.0,
    },
    watermark: {
      typography: 'caption',
      sizeScalePct: 100,
      opacityCeiling: 0.7,
    },
    compatibility: {
      supportedBlockTypes: ['code', 'body', 'divider'],
      supportedRoles: ['default', 'attribution', 'cta'],
      minBlocks: 1,
      maxBlocks: 8,
    },
  },
};

export const V1_SAMPLE_CONTENTS: Record<TemplateCategory, StructuredContent> = {
  CodeAnalogy: {
    blocks: [
      {
        type: 'body',
        runs: [
          { text: 'Variables', emphasis: 'primary' },
          { text: ' taught me to store emotions I never expressed.', emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        runs: [
          { text: 'Functions', emphasis: 'primary' },
          { text: ' taught me that giving without return drains you.', emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        runs: [
          { text: 'Loops', emphasis: 'primary' },
          { text: " reminded me that repeating mistakes isn't growth.", emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        runs: [
          { text: 'Exceptions', emphasis: 'primary' },
          { text: ' showed me that unprepared hearts break easily.', emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        runs: [
          { text: 'Memory', emphasis: 'primary' },
          { text: ' proved some attachments must be cleared.', emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        runs: [
          { text: 'Life', emphasis: 'primary' },
          { text: ' taught me to debug, accept, and move forward.', emphasis: 'normal' },
        ],
      },
      {
        type: 'body',
        role: 'attribution',
        runs: [{ text: '// Execution completed.', emphasis: 'muted' }],
      },
    ],
  },

  MinimalQuote: {
    blocks: [
      {
        type: 'heading',
        runs: [
          { text: 'She was my ' },
          { text: 'UPDATE', emphasis: 'primary' },
          { text: ', but I was just her temporary commit.' },
        ],
      },
      {
        type: 'body',
        role: 'attribution',
        runs: [{ text: '@codedropout // Follow for more', emphasis: 'muted' }],
      },
    ],
  },

  SplitStatement: {
    blocks: [
      {
        type: 'heading',
        runs: [
          { text: 'Relationships are like ' },
          { text: 'code', emphasis: 'primary' },
          { text: '.' },
        ],
      },
      {
        type: 'divider',
        runs: [],
      },
      {
        type: 'body',
        runs: [
          { text: 'One small ' },
          { text: 'error', emphasis: 'primary' },
          { text: ' can break everything if you ignore the ' },
          { text: 'warnings', emphasis: 'primary' },
          { text: '.' },
        ],
      },
    ],
  },

  Terminal: {
    blocks: [
      {
        type: 'code',
        role: 'command',
        runs: [{ text: './relationship.exe' }],
      },
      {
        type: 'body',
        role: 'error',
        runs: [{ text: 'FATAL ERROR: NullPointer in feelings', emphasis: 'primary' }],
      },
      {
        type: 'list_item',
        runs: [{ text: '-> Expected: reciprocated devotion', emphasis: 'secondary' }],
      },
      {
        type: 'list_item',
        runs: [{ text: '-> Received: undefined silence', emphasis: 'muted' }],
      },
      {
        type: 'body',
        role: 'attribution',
        runs: [{ text: 'Process terminated with exit code 1', emphasis: 'muted' }],
      },
    ],
  },

  CodeBlock: {
    blocks: [
      {
        type: 'code',
        runs: [
          {
            text: 'if (love) {\n  trust();\n  grow();\n} else {\n  refactor(mindset);\n}',
          },
        ],
      },
      {
        type: 'body',
        runs: [
          {
            text: 'Never force an algorithm that creates infinite emotional loops.',
            emphasis: 'normal',
          },
        ],
      },
    ],
  },
};
