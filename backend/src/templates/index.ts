import { renderDefaultQuoteTemplate, TemplateRenderData } from './DefaultQuoteTemplate.js';
import { renderFromDefinition, DefinitionRenderData } from './definition-engine.js';
import { TemplateDefinition } from '../schemas/template-definition.schema.js';

export interface TemplateVersionRendererInput {
  componentPath?: string | null;
  definition?: unknown;
}

export function getTemplateRenderer(
  templateVersion?: TemplateVersionRendererInput | string | null
): (data: any) => string {
  if (templateVersion && typeof templateVersion === 'object' && templateVersion.definition) {
    return (data: DefinitionRenderData) => renderFromDefinition({
      ...data,
      definition: templateVersion.definition as TemplateDefinition,
    });
  }

  // Legacy path — byte-for-byte identical to current behavior for historical versions without definition
  return renderDefaultQuoteTemplate;
}

export type { TemplateRenderData, DefinitionRenderData, TemplateDefinition };
