import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentOverflowError } from '../errors/custom-errors.js';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { StructuredContent } from '../schemas/content-block.schema.js';

test('Rendering Overflow Protection Tests (P1-02, P1-03)', async (t) => {
  await t.test('ContentOverflowError has status 422 and code CONTENT_OVERFLOW_ERROR', () => {
    const error = new ContentOverflowError('Test overflow');
    assert.strictEqual(error.statusCode, 422);
    assert.strictEqual(error.code, 'CONTENT_OVERFLOW_ERROR');
    assert.strictEqual(error.message, 'Test overflow');
  });

  await t.test('Safe area insets calculate usable canvas height', () => {
    const def = V1_TEMPLATE_DEFINITIONS.MinimalQuote;
    const insets = def.layout.safeAreaInsetsPx || { topPx: 140, bottomPx: 160, leftPx: 80, rightPx: 80 };
    const usableHeight = 1920 - insets.topPx - insets.bottomPx;

    assert.ok(usableHeight > 0);
    assert.ok(usableHeight < 1920);
    assert.strictEqual(usableHeight, 1920 - 140 - 160);
  });

  await t.test('renderFromDefinition includes safe-area padding in content-layer', () => {
    const def = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));
    def.layout.safeAreaInsetsPx = { topPx: 150, bottomPx: 170, leftPx: 90, rightPx: 90 };

    const content: StructuredContent = {
      blocks: [
        { type: 'heading', runs: [{ text: 'Testing Safe Areas' }] },
      ],
    };

    const html = renderFromDefinition({
      content,
      definition: def,
      language: 'English',
    });

    assert.ok(html.includes('padding: 150px 90px 170px 90px;'), 'Rendered HTML must use definition safe area insets');
  });
});
