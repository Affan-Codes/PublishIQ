import {
  TemplateDefinition,
} from '../schemas/template-definition.schema.js';
import { StructuredContent, ContentBlock } from '../schemas/content-block.schema.js';
import {
  RenderLanguage,
  PrimitiveRenderContext,
  renderCanvas,
  renderContentContainer,
  renderTextBlock,
  renderDivider,
  renderBrandWatermarkLayer,
} from './primitives.js';

export interface DefinitionRenderData {
  content: StructuredContent;
  definition: TemplateDefinition;
  language: RenderLanguage;
  branding?: string | undefined;
  watermark?: string | undefined;
  brandingOpacity?: number | undefined;
  watermarkOpacity?: number | undefined;
  layer?: 'full' | 'foreground' | undefined;
}

/**
 * Pure function rendering a StructuredContent payload using a TemplateDefinition into a complete HTML document.
 * Follows exact viewport, typography, language shaper, and layer composition contracts.
 */
export function renderFromDefinition(data: DefinitionRenderData): string {
  const context: PrimitiveRenderContext = {
    definition: data.definition,
    language: data.language,
    layer: data.layer || 'full',
  };

  const { brandingHtml, watermarkHtml } = renderBrandWatermarkLayer(
    data.branding,
    data.watermark,
    data.brandingOpacity,
    data.watermarkOpacity,
    context
  );

  const blocksHtml = (data.content.blocks || []).map((block: ContentBlock) => {
    if (block.type === 'divider') {
      return renderDivider(context);
    }
    return renderTextBlock(block, context);
  }).join('\n');

  const contentContainerHtml = renderContentContainer(blocksHtml, context);

  const bodyContentHtml = `
    ${brandingHtml}
    ${contentContainerHtml}
    ${watermarkHtml}
  `;

  return renderCanvas('', context, bodyContentHtml);
}

export default renderFromDefinition;
