import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { V1_TEMPLATE_DEFINITIONS, V1_SAMPLE_CONTENTS } from '../schemas/template-definition.schema.js';
import { TemplateDefinitionSchema } from '../schemas/template-definition.schema.js';
import { StructuredContentSchema } from '../schemas/content-block.schema.js';
import { renderingService } from '../services/rendering.service.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';

test('Live Template Preview Endpoint Unit & Behavioral Contract Tests (P1-01)', async (t) => {
  await t.test('renderFromDefinition returns valid non-empty HTML for valid template definition and content', () => {
    const minimalQuoteDef = V1_TEMPLATE_DEFINITIONS.MinimalQuote;
    const minimalSample = V1_SAMPLE_CONTENTS.MinimalQuote;

    const html = renderFromDefinition({
      definition: minimalQuoteDef,
      content: minimalSample,
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@publishiq',
    });

    assert.ok(typeof html === 'string', 'Returned HTML must be a string');
    assert.ok(html.startsWith('<!DOCTYPE html>'), 'Must start with DOCTYPE');
    assert.ok(html.includes('PUBLISHIQ'), 'Must include branding text');
    assert.ok(html.includes('@publishiq'), 'Must include watermark text');
    assert.ok(html.includes('class="canvas-container"'), 'Must contain canvas container');
    assert.ok(html.includes('1080px'), 'Must declare 1080px dimensions');
    assert.ok(html.includes('1920px'), 'Must declare 1920px dimensions');
  });

  await t.test('preview generation is fast and never invokes Playwright, Cloudinary, or StorageProvider', async () => {
    let playwrightCalled = false;
    let storageSaveCalled = false;

    const origRenderImage = renderingService.renderImage;
    const origStorageSave = cloudinaryStorageProvider.save;

    try {
      renderingService.renderImage = async () => {
        playwrightCalled = true;
        return { imageUrl: 'mock' };
      };
      cloudinaryStorageProvider.save = async () => {
        storageSaveCalled = true;
        return { url: 'mock', bytes: 100, format: 'png', publicId: 'mock' };
      };

      const start = performance.now();
      const html = renderFromDefinition({
        definition: V1_TEMPLATE_DEFINITIONS.Terminal,
        content: V1_SAMPLE_CONTENTS.Terminal,
        language: 'English',
      });
      const durationMs = performance.now() - start;

      assert.ok(durationMs < 50, `Preview generation must be synchronous and fast (< 50ms), took ${durationMs}ms`);
      assert.strictEqual(playwrightCalled, false, 'Live preview MUST NOT call Playwright');
      assert.strictEqual(storageSaveCalled, false, 'Live preview MUST NOT upload to Cloudinary/Storage');
      assert.ok(html.includes('./relationship.exe'), 'Must render valid content from sample runs');
    } finally {
      renderingService.renderImage = origRenderImage;
      cloudinaryStorageProvider.save = origStorageSave;
    }
  });

  await t.test('rejects invalid TemplateDefinition payloads', () => {
    const invalidDef = {
      category: 'MinimalQuote',
      // Missing required layout and typography
      colors: { background: '#000000' },
    };

    const parsed = TemplateDefinitionSchema.safeParse(invalidDef);
    assert.strictEqual(parsed.success, false, 'Must reject incomplete template definition');
  });

  await t.test('rejects invalid StructuredContent payloads', () => {
    const invalidContent = {
      // blocks is not an array
      blocks: 'invalid-string',
    };

    const parsed = StructuredContentSchema.safeParse(invalidContent);
    assert.strictEqual(parsed.success, false, 'Must reject malformed content schema');
  });
});
