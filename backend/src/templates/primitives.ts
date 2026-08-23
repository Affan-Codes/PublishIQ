import { escapeHtml } from '../utils/html-escape.js';
import {
  TemplateDefinition,
  TypographyRole,
  ColorToken,
} from '../schemas/template-definition.schema.js';
import { ContentBlock, ContentRun } from '../schemas/content-block.schema.js';

export type RenderLanguage = 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';

export interface PrimitiveRenderContext {
  definition: TemplateDefinition;
  language: RenderLanguage;
  layer?: 'full' | 'foreground';
}

/**
 * 1. Canvas Primitive
 * Fixed 1080x1920 root canvas container with font imports, background styles, and scrim overlay.
 */
export function renderCanvas(
  contentHtml: string,
  context: PrimitiveRenderContext,
  brandingWatermarkHtml: string
): string {
  const { definition, layer } = context;
  const isForegroundOnly = layer === 'foreground';
  const bgMode = definition.backgroundTreatment?.mode || 'solid';

  let bodyBg = '#000000';
  if (isForegroundOnly) {
    bodyBg = 'transparent';
  } else if (bgMode === 'solid') {
    bodyBg = definition.colors.background || '#000000';
  } else if (bgMode === 'gradient') {
    bodyBg = `linear-gradient(180deg, ${definition.colors.background} 0%, #000000 100%)`;
  }

  const scrimOpacity = typeof definition.backgroundTreatment?.scrimOpacity === 'number'
    ? definition.backgroundTreatment.scrimOpacity
    : 0.65;
  const scrimTop = Math.min(1, scrimOpacity);
  const scrimMid = Math.max(0, scrimOpacity - 0.2);
  const scrimBot = Math.min(1, scrimOpacity + 0.1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&family=Fira+Code:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      background: ${bodyBg};
      -webkit-font-smoothing: antialiased;
    }

    .canvas-container {
      position: relative;
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    ${isForegroundOnly ? `
    /* Layer 1: Scrim Overlay for Readability over Background (MQA-05 / MQA-11) */
    .overlay-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 1080px;
      height: 1920px;
      background: linear-gradient(180deg, rgba(0, 0, 0, ${scrimTop}) 0%, rgba(0, 0, 0, ${scrimMid}) 50%, rgba(0, 0, 0, ${scrimBot}) 100%);
      z-index: 2;
    }
    ` : ''}

    /* Layer 2: Foreground Content (Text + Branding + Watermark) */
    .content-layer {
      position: relative;
      z-index: 3;
      width: 1080px;
      height: 1920px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: ${definition.layout.safeAreaInsetsPx?.topPx ?? 140}px ${definition.layout.safeAreaInsetsPx?.rightPx ?? 80}px ${definition.layout.safeAreaInsetsPx?.bottomPx ?? 160}px ${definition.layout.safeAreaInsetsPx?.leftPx ?? 80}px;
    }

    .lang-urdu {
      font-family: 'Noto Nastaliq Urdu', serif !important;
      direction: rtl;
      text-align: right;
    }

    .lang-hindi {
      font-family: 'Noto Sans Devanagari', sans-serif !important;
    }

    .font-monospace {
      font-family: 'Fira Code', 'Courier New', Courier, monospace !important;
    }

    .font-latin {
      font-family: 'Poppins', sans-serif;
    }

    .template-divider-line {
      width: 100%;
      border: 0;
      height: 2px;
      background-color: ${definition.colors.muted || '#4A5568'};
      margin: 12px 0;
      opacity: 0.7;
    }

    .template-divider-symbol {
      font-family: 'Fira Code', monospace;
      font-size: 28px;
      color: ${definition.colors.accent || '#F6AD55'};
      font-weight: 700;
      letter-spacing: 4px;
      margin: 8px 0;
      text-align: center;
    }

    .decoration-glyph {
      display: inline-block;
      margin-right: 12px;
      font-weight: 700;
    }

    .decoration-corner {
      position: absolute;
      font-size: 24px;
      color: ${definition.colors.muted || '#718096'};
      opacity: 0.5;
      font-family: monospace;
    }

    .corner-tl { top: 40px; left: 40px; }
    .corner-tr { top: 40px; right: 40px; }
    .corner-bl { bottom: 40px; left: 40px; }
    .corner-br { bottom: 40px; right: 40px; }

    .code-block-wrapper {
      background-color: ${definition.colors.secondary ? `${definition.colors.secondary}22` : 'rgba(255, 255, 255, 0.05)'};
      border-left: 4px solid ${definition.colors.accent || '#4EC9B0'};
      padding: 24px 32px;
      border-radius: 8px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
  </style>
</head>
<body>
  <div class="canvas-container">
    ${isForegroundOnly ? '<div class="overlay-layer"></div>' : ''}
    ${context.definition.decorations.cornerMark ? `
      <div class="decoration-corner corner-tl">⎡</div>
      <div class="decoration-corner corner-tr">⎤</div>
      <div class="decoration-corner corner-bl">⎣</div>
      <div class="decoration-corner corner-br">⎦</div>
    ` : ''}
    <div class="content-layer">
      ${brandingWatermarkHtml}
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * 2. ContentContainer Primitive
 * Vertical flex container with alignment, anchor, gap, and max-width.
 */
export function renderContentContainer(
  blocksHtml: string,
  context: PrimitiveRenderContext
): string {
  const { layout } = context.definition;
  const textAlign = layout.contentAlign === 'center' ? 'center' : 'left';
  const alignItems = layout.contentAlign === 'center' ? 'center' : 'flex-start';

  let justifyContent = 'center';
  if (layout.verticalAnchor === 'top') justifyContent = 'flex-start';
  else if (layout.verticalAnchor === 'bottom') justifyContent = 'flex-end';

  return `
    <div class="content-container" style="
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: ${justifyContent};
      align-items: ${alignItems};
      width: 100%;
      max-width: ${layout.maxContentWidthPx}px;
      gap: ${layout.blockGapPx}px;
      text-align: ${textAlign};
    ">
      ${blocksHtml}
    </div>
  `;
}

/**
 * 3. TextBlock Primitive
 * Renders a single ContentBlock by resolving typography role, per-run emphasis, and font family.
 */
export function renderTextBlock(
  block: ContentBlock,
  context: PrimitiveRenderContext
): string {
  const { definition, language } = context;
  const mappingKey = `${block.type}_${block.role ?? 'default'}`;
  const defaultKey = `${block.type}_default`;

  const mapping =
    (definition.contentMapping as any)[mappingKey] ||
    (definition.contentMapping as any)[defaultKey] ||
    (definition.contentMapping as any)[block.type] ||
    { typography: block.type === 'heading' ? 'heading' : block.type === 'code' ? 'code' : 'body' };

  const typographyRole: TypographyRole = mapping.typography || 'body';
  const forceEmphasis = mapping.forceEmphasis;
  const colorOverrideToken: ColorToken | undefined = mapping.colorOverride;

  const typoConfig = definition.typography[typographyRole] || definition.typography.body;
  const sizePx = typoConfig.sizePx;
  const weight = 'weight' in typoConfig ? typoConfig.weight : 400;
  const lineHeight = typoConfig.lineHeight;

  let fontClass = 'font-latin';
  if (typographyRole === 'code') {
    fontClass = 'font-monospace';
  } else if (language === 'Urdu') {
    fontClass = 'lang-urdu';
  } else if (language === 'Hindi') {
    fontClass = 'lang-hindi';
  }

  // Handle code block container styling
  const isCodeType = block.type === 'code';

  const runsHtml = (block.runs || []).map((run: ContentRun) => {
    const effectiveEmphasis = forceEmphasis || run.emphasis || 'normal';
    const rule = (definition.emphasisRules as Record<string, any>)[effectiveEmphasis] || definition.emphasisRules.normal;

    let colorHex: string = (definition.colors as Record<string, string>)[rule.colorToken] || definition.colors.primary;
    if (colorOverrideToken && (definition.colors as Record<string, string>)[colorOverrideToken]) {
      colorHex = (definition.colors as Record<string, string>)[colorOverrideToken] as string;
    }

    const runWeight = rule.weight || weight;
    const runTransform = rule.textTransform === 'uppercase' ? 'uppercase' : 'none';
    const letterSpacing = rule.letterSpacingPx ? `letter-spacing: ${rule.letterSpacingPx}px;` : '';

    const escapedText = escapeHtml(run.text);
    const formattedText = isCodeType ? escapedText.replace(/\n/g, '<br/>') : escapedText;

    return `<span style="
      color: ${colorHex};
      font-weight: ${runWeight};
      text-transform: ${runTransform};
      ${letterSpacing}
    ">${formattedText}</span>`;
  }).join('');

  // Leading decorations (e.g. terminalPrompt or codeIcon)
  let leadingDecoration = '';
  if (definition.decorations.terminalPrompt && (block.role === 'command' || block.type === 'code')) {
    leadingDecoration = `<span class="decoration-glyph" style="color: ${definition.colors.accent || '#7EE787'}; font-family: monospace;">$ </span>`;
  } else if (definition.decorations.codeIcon && block.type === 'heading') {
    leadingDecoration = `<span class="decoration-glyph" style="color: ${definition.colors.accent || '#F6AD55'}; font-family: monospace;">&lt;/&gt; </span>`;
  }

  let trailingDecoration = '';
  if (definition.decorations.heart && block.role === 'attribution') {
    trailingDecoration = `<span style="color: ${definition.colors.accent || '#ED8936'}; margin-left: 8px;"> ♡&lt;/&gt;</span>`;
  }

  const blockHtml = `
    <div class="${fontClass}" style="
      font-size: ${sizePx}px;
      line-height: ${lineHeight};
      font-weight: ${weight};
      word-wrap: break-word;
      width: 100%;
      text-shadow: 0px 4px 24px rgba(0, 0, 0, 0.8), 0px 2px 8px rgba(0, 0, 0, 0.6);
    ">
      ${leadingDecoration}${runsHtml}${trailingDecoration}
    </div>
  `;

  if (isCodeType) {
    return `<div class="code-block-wrapper">${blockHtml}</div>`;
  }

  return blockHtml;
}

/**
 * 4. Divider Primitive
 * Renders decorative dividers between content blocks.
 */
export function renderDivider(context: PrimitiveRenderContext): string {
  const dividerType = context.definition.decorations.divider;
  if (dividerType === 'line') {
    return '<hr class="template-divider-line" />';
  }
  if (dividerType === 'code_symbol') {
    return '<div class="template-divider-symbol">&lt;/&gt;</div>';
  }
  return '';
}

/**
 * 5. BrandWatermarkLayer Primitive
 * Renders header branding and footer watermark using caption typography, scaled size, and clamped opacity.
 */
export function renderBrandWatermarkLayer(
  brandingText: string | undefined,
  watermarkText: string | undefined,
  brandingOpacity: number | undefined,
  watermarkOpacity: number | undefined,
  context: PrimitiveRenderContext
): { brandingHtml: string; watermarkHtml: string } {
  const { definition, language } = context;
  const captionTypo = definition.typography.caption;
  const baseSize = captionTypo.sizePx;
  const baseWeight = captionTypo.weight;

  const brandScale = (definition.branding.sizeScalePct || 100) / 100;
  const brandSize = Math.round(baseSize * brandScale);
  const effectiveBrandOpacity = Math.min(
    brandingOpacity ?? 1,
    definition.branding.opacityCeiling ?? 1
  );

  const wmScale = (definition.watermark.sizeScalePct || 100) / 100;
  const wmSize = Math.round(baseSize * wmScale);
  const effectiveWmOpacity = Math.min(
    watermarkOpacity ?? 1,
    definition.watermark.opacityCeiling ?? 1
  );

  let fontClass = 'font-latin';
  if (language === 'Urdu') fontClass = 'lang-urdu';
  else if (language === 'Hindi') fontClass = 'lang-hindi';

  const finalBrandingText = brandingText || 'PUBLISHIQ';
  const finalWatermarkText = watermarkText || '@publishiq';

  const brandingHtml = `
    <div class="${fontClass}" style="
      font-size: ${brandSize}px;
      font-weight: ${baseWeight};
      color: ${definition.colors.primary || '#FFFFFF'};
      opacity: ${effectiveBrandOpacity};
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0px 2px 10px rgba(0, 0, 0, 0.7);
    ">${escapeHtml(finalBrandingText)}</div>
  `;

  const watermarkHtml = `
    <div class="${fontClass}" style="
      font-size: ${wmSize}px;
      font-weight: 400;
      color: ${definition.colors.secondary || '#E2E8F0'};
      opacity: ${effectiveWmOpacity};
      letter-spacing: 1px;
      text-shadow: 0px 2px 10px rgba(0, 0, 0, 0.7);
    ">${escapeHtml(finalWatermarkText)}</div>
  `;

  return { brandingHtml, watermarkHtml };
}
