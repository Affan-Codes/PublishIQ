import test from 'node:test';
import assert from 'node:assert/strict';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';
import { StructuredContent } from '../schemas/content-block.schema.js';

test('Template Compatibility Validation Tests (P1-05)', async (t) => {
  const minimalQuoteDef = V1_TEMPLATE_DEFINITIONS.MinimalQuote;
  const compatibility = minimalQuoteDef.compatibility;

  function validateCompatibility(content: StructuredContent, compat: typeof compatibility): string | null {
    const blocks = content.blocks;
    if (blocks.length < compat.minBlocks || blocks.length > compat.maxBlocks) {
      return `Template incompatibility: Block count (${blocks.length}) outside allowed range [${compat.minBlocks}, ${compat.maxBlocks}]`;
    }
    for (const block of blocks) {
      if (!compat.supportedBlockTypes.includes(block.type)) {
        return `Template incompatibility: Unsupported block type '${block.type}' for template`;
      }
      const role = block.role ?? 'default';
      if (!compat.supportedRoles.includes(role)) {
        return `Template incompatibility: Unsupported block role '${role}' for template`;
      }
    }
    return null;
  }

  await t.test('passes for compatible blocks within capacity limits', () => {
    const validContent: StructuredContent = {
      blocks: [
        { type: 'heading', runs: [{ text: 'Valid Heading' }] },
        { type: 'body', role: 'attribution', runs: [{ text: 'Valid Attribution' }] },
      ],
    };
    const err = validateCompatibility(validContent, compatibility);
    assert.strictEqual(err, null, 'Compatible content must pass');
  });

  await t.test('detects unsupported block type', () => {
    const incompatibleContent: StructuredContent = {
      blocks: [
        { type: 'code', runs: [{ text: 'const x = 1;' }] }, // MinimalQuote does not support 'code' block
      ],
    };
    const err = validateCompatibility(incompatibleContent, compatibility);
    assert.ok(err?.includes("Unsupported block type 'code'"), 'Must detect unsupported block type');
  });

  await t.test('detects block count exceeding template capacity', () => {
    const tooManyBlocks: StructuredContent = {
      blocks: Array.from({ length: 10 }, (_, i) => ({
        type: 'body' as const,
        runs: [{ text: `Block ${i}` }],
      })),
    };
    const err = validateCompatibility(tooManyBlocks, compatibility);
    assert.ok(err?.includes('Block count (10) outside allowed range'), 'Must detect block count over maximum');
  });
});
