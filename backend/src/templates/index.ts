import { renderDefaultQuoteTemplate, TemplateRenderData } from './DefaultQuoteTemplate.js';

export function getTemplateRenderer(componentPath?: string) {
  switch (componentPath) {
    case 'DefaultQuoteTemplate':
    case 'Default':
    default:
      return renderDefaultQuoteTemplate;
  }
}

export type { TemplateRenderData };
