import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StructuredContentSchema,
  ContentBlockSchema,
  ContentRunSchema,
} from '../schemas/content-block.schema.js';

test('Structured Content Validation Tests', async (t) => {
  await t.test('accepts valid structured content with all 5 block types', () => {
    const validContent = {
      blocks: [
        { type: 'heading', runs: [{ text: 'Main Headline', emphasis: 'primary' }] },
        { type: 'divider', runs: [] },
        { type: 'body', role: 'label', runs: [{ text: 'Body text with ', emphasis: 'normal' }, { text: 'secondary emphasis', emphasis: 'secondary' }] },
        { type: 'code', role: 'command', runs: [{ text: 'npm run build' }] },
        { type: 'list_item', runs: [{ text: 'List item 1', emphasis: 'muted' }] },
      ],
    };

    const parsed = StructuredContentSchema.safeParse(validContent);
    assert.equal(parsed.success, true);
  });

  await t.test('accepts block with missing optional fields (role and emphasis absent)', () => {
    const content = {
      blocks: [
        {
          type: 'body',
          runs: [{ text: 'Plain text without role or emphasis' }],
        },
      ],
    };

    const parsed = StructuredContentSchema.safeParse(content);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.blocks[0]?.role, undefined);
      assert.equal(parsed.data.blocks[0]?.runs[0]?.emphasis, undefined);
    }
  });

  await t.test('rejects invalid block type', () => {
    const invalid = {
      blocks: [
        {
          type: 'invalid_type',
          runs: [{ text: 'Text' }],
        },
      ],
    };

    const parsed = StructuredContentSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  await t.test('rejects invalid emphasis role', () => {
    const invalid = {
      blocks: [
        {
          type: 'body',
          runs: [{ text: 'Text', emphasis: 'hyper_bold' }],
        },
      ],
    };

    const parsed = StructuredContentSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  await t.test('rejects empty blocks array (minimum 1 required)', () => {
    const empty = { blocks: [] };
    const parsed = StructuredContentSchema.safeParse(empty);
    assert.equal(parsed.success, false);
  });

  await t.test('rejects more than 12 blocks', () => {
    const tooManyBlocks = {
      blocks: Array.from({ length: 13 }, (_, i) => ({
        type: 'body',
        runs: [{ text: `Block ${i + 1}` }],
      })),
    };

    const parsed = StructuredContentSchema.safeParse(tooManyBlocks);
    assert.equal(parsed.success, false);
  });

  await t.test('accepts exactly 12 blocks', () => {
    const maxBlocks = {
      blocks: Array.from({ length: 12 }, (_, i) => ({
        type: 'body',
        runs: [{ text: `Block ${i + 1}` }],
      })),
    };

    const parsed = StructuredContentSchema.safeParse(maxBlocks);
    assert.equal(parsed.success, true);
  });

  await t.test('rejects more than 6 runs in a single block', () => {
    const tooManyRuns = {
      type: 'body',
      runs: Array.from({ length: 7 }, (_, i) => ({
        text: `Run ${i + 1}`,
      })),
    };

    const parsed = ContentBlockSchema.safeParse(tooManyRuns);
    assert.equal(parsed.success, false);
  });

  await t.test('accepts 6 runs in a block', () => {
    const maxRuns = {
      type: 'body',
      runs: Array.from({ length: 6 }, (_, i) => ({
        text: `Run ${i + 1}`,
      })),
    };

    const parsed = ContentBlockSchema.safeParse(maxRuns);
    assert.equal(parsed.success, true);
  });

  await t.test('rejects empty runs in non-divider block', () => {
    const emptyRuns = {
      type: 'body',
      runs: [],
    };

    const parsed = ContentBlockSchema.safeParse(emptyRuns);
    assert.equal(parsed.success, false);
  });

  await t.test('allows empty runs in divider block', () => {
    const divider = {
      type: 'divider',
      runs: [],
    };

    const parsed = ContentBlockSchema.safeParse(divider);
    assert.equal(parsed.success, true);
  });

  await t.test('rejects run text exceeding 220 characters', () => {
    const longText = 'a'.repeat(221);
    const parsed = ContentRunSchema.safeParse({ text: longText });
    assert.equal(parsed.success, false);
  });

  await t.test('accepts run text with 220 characters', () => {
    const validLength = 'a'.repeat(220);
    const parsed = ContentRunSchema.safeParse({ text: validLength });
    assert.equal(parsed.success, true);
  });

  await t.test('rejects run text containing HTML or script URI characters', () => {
    assert.equal(ContentRunSchema.safeParse({ text: '<script>alert(1)</script>' }).success, false);
    assert.equal(ContentRunSchema.safeParse({ text: 'Hello <world>' }).success, false);
    assert.equal(ContentRunSchema.safeParse({ text: 'javascript:void(0)' }).success, false);
    assert.equal(ContentRunSchema.safeParse({ text: 'data:text/html;base64,123' }).success, false);
  });
});
