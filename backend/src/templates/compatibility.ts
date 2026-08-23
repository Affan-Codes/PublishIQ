import { StructuredContent, ContentBlock } from '../schemas/content-block.schema.js';
import { TemplateCompatibility } from '../schemas/template-definition.schema.js';

/**
 * Validates a StructuredContent payload against a TemplateDefinition's declared compatibility constraints.
 * Returns null if valid, or a descriptive error string if incompatible.
 * Single source of truth shared between the production content pipeline and live stress testing.
 */
export function validateTemplateCompatibility(
  content: StructuredContent,
  compatibility: TemplateCompatibility
): string | null {
  const blocks = content.blocks || [];

  if (blocks.length < compatibility.minBlocks || blocks.length > compatibility.maxBlocks) {
    return `Template incompatibility: Block count (${blocks.length}) outside allowed range [${compatibility.minBlocks}, ${compatibility.maxBlocks}]`;
  }

  for (const block of blocks) {
    if (!compatibility.supportedBlockTypes.includes(block.type)) {
      return `Template incompatibility: Unsupported block type '${block.type}' for template`;
    }

    const role = block.role ?? 'default';
    if (!compatibility.supportedRoles.includes(role)) {
      return `Template incompatibility: Unsupported block role '${role}' for template`;
    }
  }

  return null;
}

export default validateTemplateCompatibility;
