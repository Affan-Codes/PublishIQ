import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentRunSchema, ContentBlockSchema } from '../schemas/content-block.schema.js';
import { TemplateDefinitionSchema } from '../schemas/template-definition.schema.js';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { escapeHtml } from '../utils/html-escape.js';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';

test('Template Security Tests', async (t) => {
  await t.test('schema validation strictly rejects HTML tags, javascript URIs, and data URIs in runs', () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'Hello <span style="color:red">test</span>',
      'Click >> here <<',
    ];

    for (const input of maliciousInputs) {
      const parsed = ContentRunSchema.safeParse({ text: input });
      assert.equal(parsed.success, false, `Must reject malicious run input: ${input}`);
    }
  });

  await t.test('escapeHtml reliably converts all HTML special characters into inert HTML entities', () => {
    const raw = `"><script>alert('xss' & "hack")</script>`;
    const escaped = escapeHtml(raw);

    assert.ok(!escaped.includes('<'), 'Must not contain <');
    assert.ok(!escaped.includes('>'), 'Must not contain >');
    assert.ok(!escaped.includes('"'), 'Must not contain double quote');
    assert.ok(!escaped.includes("'"), 'Must not contain single quote');
    assert.ok(escaped.includes('&lt;script&gt;'), 'Must contain &lt;script&gt;');
    assert.ok(escaped.includes('&amp;'), 'Must contain &amp;');
  });

  await t.test('renderFromDefinition safely escapes any interpolated branding or watermark strings', () => {
    const rawBranding = 'MY_BRAND <script>alert(1)</script>';
    const rawWatermark = '@watermark "injection" & \'quote\'';

    const html = renderFromDefinition({
      content: {
        blocks: [
          {
            type: 'body',
            runs: [{ text: 'Safe plain text message' }],
          },
        ],
      },
      definition: V1_TEMPLATE_DEFINITIONS.MinimalQuote,
      language: 'English',
      branding: rawBranding,
      watermark: rawWatermark,
    });

    assert.ok(!html.includes('<script>'), 'Rendered HTML must not include unescaped script tags');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Branding must be escaped');
    assert.ok(html.includes('&quot;injection&quot;'), 'Watermark quotes must be escaped');
    assert.ok(html.includes('&amp;'), 'Ampersands must be escaped');
  });

  await t.test('TemplateDefinition schema rejects arbitrary CSS/JS injection attempts in color and layout fields', () => {
    const maliciousDef = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    maliciousDef.colors.background = '#000000; display: none;';
    assert.equal(TemplateDefinitionSchema.safeParse(maliciousDef).success, false);

    maliciousDef.colors.background = '#000000';
    maliciousDef.layout.maxContentWidthPx = '900px; filter: blur(5px);' as any;
    assert.equal(TemplateDefinitionSchema.safeParse(maliciousDef).success, false);
  });
});
