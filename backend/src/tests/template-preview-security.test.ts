import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';

test('Live Template Preview Security & XSS Sanitization Tests (P1-01)', async (t) => {
  await t.test('escapes script tags and attributes in body runs', () => {
    const maliciousContent = {
      blocks: [
        {
          type: 'body' as const,
          role: 'default' as const,
          runs: [
            { text: '<script>alert("XSS Attack")</script>', emphasis: 'normal' as const },
            { text: '<img src="invalid" onerror="fetch(\'http://evil.com\')">', emphasis: 'primary' as const },
          ],
        },
      ],
    };

    const html = renderFromDefinition({
      definition: V1_TEMPLATE_DEFINITIONS.MinimalQuote,
      content: maliciousContent,
      language: 'English',
    });

    assert.strictEqual(html.includes('<script>alert'), false, 'Must not contain unescaped <script>');
    assert.strictEqual(html.includes('<img src='), false, 'Must not contain unescaped <img>');
    assert.ok(html.includes('&lt;script&gt;alert(&quot;XSS Attack&quot;)&lt;/script&gt;'), 'Must contain escaped script entities');
    assert.ok(html.includes('&lt;img src=&quot;invalid&quot;'), 'Must contain escaped img tag');
  });

  await t.test('escapes branding and watermark inputs in preview', () => {
    const safeContent = {
      blocks: [
        {
          type: 'body' as const,
          role: 'default' as const,
          runs: [{ text: 'Standard quote text', emphasis: 'normal' as const }],
        },
      ],
    };

    const html = renderFromDefinition({
      definition: V1_TEMPLATE_DEFINITIONS.MinimalQuote,
      content: safeContent,
      language: 'English',
      branding: 'BRAND"><script>document.cookie</script>',
      watermark: '@handle" onmouseover="alert(1)',
    });

    assert.strictEqual(html.includes('<script>document.cookie</script>'), false, 'Branding must not execute script');
    assert.strictEqual(html.includes('onmouseover="alert(1)'), false, 'Watermark must not inject unescaped attribute');
    assert.ok(html.includes('&lt;script&gt;document.cookie&lt;/script&gt;'), 'Branding script must be entity-escaped');
    assert.ok(html.includes('@handle&quot; onmouseover=&quot;alert(1)'), 'Watermark quotes must be entity-escaped');
  });
});
