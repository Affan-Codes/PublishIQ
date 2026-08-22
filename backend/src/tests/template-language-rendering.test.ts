import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';

test('Template Language Matrix & Typography Shaper Tests', async (t) => {
  const sampleContent = {
    blocks: [
      {
        type: 'body' as const,
        runs: [{ text: 'Language test sample text', emphasis: 'normal' as const }],
      },
    ],
  };

  const def = V1_TEMPLATE_DEFINITIONS.MinimalQuote;

  await t.test('Urdu language sets lang-urdu class, Nastaliq font, and RTL direction', () => {
    const html = renderFromDefinition({
      content: sampleContent,
      definition: def,
      language: 'Urdu',
    });

    assert.ok(html.includes('class="lang-urdu"'), 'Must apply lang-urdu class to text block');
    assert.ok(html.includes('Noto Nastaliq Urdu'), 'Must include Noto Nastaliq Urdu font family');
    assert.ok(html.includes('direction: rtl'), 'Must specify RTL text direction');
  });

  await t.test('Hindi language sets lang-hindi class and Devanagari font', () => {
    const html = renderFromDefinition({
      content: sampleContent,
      definition: def,
      language: 'Hindi',
    });

    assert.ok(html.includes('class="lang-hindi"'), 'Must apply lang-hindi class to text block');
    assert.ok(html.includes('Noto Sans Devanagari'), 'Must include Noto Sans Devanagari font family');
  });

  await t.test('English language uses standard font-latin class and Poppins font', () => {
    const html = renderFromDefinition({
      content: sampleContent,
      definition: def,
      language: 'English',
    });

    assert.ok(html.includes('class="font-latin"'), 'Must apply font-latin class to text block');
    assert.ok(html.includes('Poppins'), 'Must include Poppins font family');
    assert.ok(!html.includes('class="lang-urdu"'), 'Must not apply lang-urdu to block');
    assert.ok(!html.includes('class="lang-hindi"'), 'Must not apply lang-hindi to block');
  });

  await t.test('HindiRoman and UrduRoman fall through to standard Latin typography (LTR)', () => {
    const hindiRomanHtml = renderFromDefinition({
      content: sampleContent,
      definition: def,
      language: 'HindiRoman',
    });

    assert.ok(hindiRomanHtml.includes('class="font-latin"'), 'HindiRoman must use font-latin class');
    assert.ok(!hindiRomanHtml.includes('class="lang-hindi"'), 'HindiRoman must not use native Devanagari class');

    const urduRomanHtml = renderFromDefinition({
      content: sampleContent,
      definition: def,
      language: 'UrduRoman',
    });

    assert.ok(urduRomanHtml.includes('class="font-latin"'), 'UrduRoman must use font-latin class');
    assert.ok(!urduRomanHtml.includes('class="lang-urdu"'), 'UrduRoman must not use native Nastaliq/RTL class');
  });
});
