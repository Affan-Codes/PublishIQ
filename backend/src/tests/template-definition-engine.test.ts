import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { V1_TEMPLATE_DEFINITIONS, V1_SAMPLE_CONTENTS } from '../schemas/template-definition.schema.js';

test('Template Definition Engine Rendering Tests', async (t) => {
  await t.test('renders all 5 canonical template definitions with their sample contents', () => {
    for (const [category, definition] of Object.entries(V1_TEMPLATE_DEFINITIONS)) {
      const sample = (V1_SAMPLE_CONTENTS as any)[category];
      assert.ok(sample, `Sample content must exist for ${category}`);

      const html = renderFromDefinition({
        content: sample,
        definition,
        language: 'English',
        branding: 'BRAND_TEST',
        watermark: '@brand_test',
        layer: 'full',
      });

      assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce HTML document');
      assert.ok(html.includes('BRAND_TEST'), 'Must contain branding text');
      assert.ok(html.includes('@brand_test'), 'Must contain watermark text');
      assert.ok(html.includes('width: 1080px;'), 'Must specify 1080px canvas');
      assert.ok(html.includes('height: 1920px;'), 'Must specify 1920px canvas');
    }
  });

  await t.test('renders all 5 block types (heading, body, code, divider, list_item)', () => {
    const multiBlockContent = {
      blocks: [
        { type: 'heading' as const, runs: [{ text: 'Main Heading' }] },
        { type: 'divider' as const, runs: [] },
        { type: 'body' as const, runs: [{ text: 'Body paragraph text' }] },
        { type: 'code' as const, runs: [{ text: 'const x = 10;' }] },
        { type: 'list_item' as const, runs: [{ text: 'List item entry' }] },
      ],
    };

    const html = renderFromDefinition({
      content: multiBlockContent,
      definition: V1_TEMPLATE_DEFINITIONS.SplitStatement,
      language: 'English',
    });

    assert.ok(html.includes('Main Heading'), 'Must render heading block');
    assert.ok(html.includes('template-divider-line') || html.includes('template-divider-symbol'), 'Must render divider block');
    assert.ok(html.includes('Body paragraph text'), 'Must render body block');
    assert.ok(html.includes('const x = 10;'), 'Must render code block');
    assert.ok(html.includes('List item entry'), 'Must render list item block');
  });

  await t.test('applies primary, secondary, normal, and muted emphasis rules accurately', () => {
    const emphasisContent = {
      blocks: [
        {
          type: 'body' as const,
          runs: [
            { text: 'PRIMARY_KEYWORD', emphasis: 'primary' as const },
            { text: 'SECONDARY_KEYWORD', emphasis: 'secondary' as const },
            { text: 'NORMAL_TEXT', emphasis: 'normal' as const },
            { text: 'MUTED_TEXT', emphasis: 'muted' as const },
          ],
        },
      ],
    };

    const def = V1_TEMPLATE_DEFINITIONS.CodeAnalogy;
    const html = renderFromDefinition({
      content: emphasisContent,
      definition: def,
      language: 'English',
    });

    // Primary accent color in CodeAnalogy is #F6AD55
    assert.ok(html.includes('PRIMARY_KEYWORD'), 'Contains primary keyword');
    assert.ok(html.includes('#F6AD55'), 'Contains primary accent color');
    assert.ok(html.includes('font-weight: 700'), 'Contains primary bold weight');
    assert.ok(html.includes('MUTED_TEXT'), 'Contains muted text');
  });

  await t.test('applies uppercase text transform when configured on emphasis rule', () => {
    const minimalQuoteDef = V1_TEMPLATE_DEFINITIONS.MinimalQuote;
    assert.equal(minimalQuoteDef.emphasisRules.primary.textTransform, 'uppercase');

    const html = renderFromDefinition({
      content: {
        blocks: [
          {
            type: 'body' as const,
            runs: [{ text: 'lowercase update', emphasis: 'primary' }],
          },
        ],
      },
      definition: minimalQuoteDef,
      language: 'English',
    });

    assert.ok(html.includes('text-transform: uppercase'), 'Primary run must include text-transform uppercase');
  });

  await t.test('ensures code blocks render with monospace font styling', () => {
    const codeContent = {
      blocks: [
        {
          type: 'code' as const,
          runs: [{ text: 'function calculate() {\n  return 42;\n}' }],
        },
      ],
    };

    const html = renderFromDefinition({
      content: codeContent,
      definition: V1_TEMPLATE_DEFINITIONS.CodeBlock,
      language: 'English',
    });

    assert.ok(html.includes('font-monospace'), 'Must apply font-monospace class');
    assert.ok(html.includes('code-block-wrapper'), 'Must wrap in code-block-wrapper');
    assert.ok(html.includes('calculate()'), 'Must contain function text');
    assert.ok(html.includes('<br/>'), 'Must convert newlines to line breaks');
  });

  await t.test('renders up to 12 blocks seamlessly', () => {
    const twelveBlocks = {
      blocks: Array.from({ length: 12 }, (_, i) => ({
        type: 'body' as const,
        runs: [{ text: `Statement line ${i + 1}`, emphasis: 'normal' as const }],
      })),
    };

    const html = renderFromDefinition({
      content: twelveBlocks,
      definition: V1_TEMPLATE_DEFINITIONS.CodeAnalogy,
      language: 'English',
    });

    for (let i = 1; i <= 12; i++) {
      assert.ok(html.includes(`Statement line ${i}`), `Must render line ${i}`);
    }
  });

  await t.test('renders transparent foreground scrim overlay when layer is foreground', () => {
    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.SplitStatement,
      definition: V1_TEMPLATE_DEFINITIONS.SplitStatement,
      language: 'English',
      layer: 'foreground',
    });

    assert.ok(html.includes('background: transparent;'), 'Body background must be transparent');
    assert.ok(html.includes('overlay-layer'), 'Must contain scrim overlay layer');
  });
});
