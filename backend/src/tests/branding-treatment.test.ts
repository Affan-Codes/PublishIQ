import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { V1_TEMPLATE_DEFINITIONS, V1_SAMPLE_CONTENTS } from '../schemas/template-definition.schema.js';

test('Branding & Watermark Presentation Treatment Tests', async (t) => {
  await t.test('clamps requested branding opacity to template opacityCeiling', () => {
    const templateDef = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.Terminal));
    templateDef.branding.opacityCeiling = 0.5;

    // Request higher opacity from profile (0.95)
    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.Terminal,
      definition: templateDef,
      language: 'English',
      branding: 'TERMINAL_BRAND',
      brandingOpacity: 0.95,
    });

    // Must be clamped to 0.5
    assert.ok(html.includes('opacity: 0.5;'), 'Effective opacity must be clamped to ceiling 0.5');
    assert.ok(!html.includes('opacity: 0.95;'), 'Higher requested opacity must not leak past ceiling');
  });

  await t.test('uses requested opacity when below template opacityCeiling', () => {
    const templateDef = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.Terminal));
    templateDef.branding.opacityCeiling = 0.8;

    // Request lower opacity from profile (0.4)
    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.Terminal,
      definition: templateDef,
      language: 'English',
      branding: 'TERMINAL_BRAND',
      brandingOpacity: 0.4,
    });

    assert.ok(html.includes('opacity: 0.4;'), 'Effective opacity should be 0.4 when below ceiling');
  });

  await t.test('clamps watermark opacity to template watermark opacityCeiling', () => {
    const templateDef = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));
    templateDef.watermark.opacityCeiling = 0.65;

    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.MinimalQuote,
      definition: templateDef,
      language: 'English',
      watermark: '@mywatermark',
      watermarkOpacity: 1.0,
    });

    assert.ok(html.includes('opacity: 0.65;'), 'Watermark opacity must be clamped to 0.65');
  });

  await t.test('correctly scales typography font size according to sizeScalePct', () => {
    const templateDef = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));
    templateDef.typography.caption.sizePx = 30;
    templateDef.branding.sizeScalePct = 120; // 30 * 1.2 = 36px
    templateDef.watermark.sizeScalePct = 80;  // 30 * 0.8 = 24px

    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.MinimalQuote,
      definition: templateDef,
      language: 'English',
      branding: 'SCALED_BRAND',
      watermark: '@scaled_wm',
    });

    assert.ok(html.includes('font-size: 36px;'), 'Branding must be scaled to 36px');
    assert.ok(html.includes('font-size: 24px;'), 'Watermark must be scaled to 24px');
  });

  await t.test('branding and watermark identity text propagate into rendered HTML', () => {
    const html = renderFromDefinition({
      content: V1_SAMPLE_CONTENTS.MinimalQuote,
      definition: V1_TEMPLATE_DEFINITIONS.MinimalQuote,
      language: 'English',
      branding: 'ACME_PRODUCTIONS',
      watermark: '@acme_official',
    });

    assert.ok(html.includes('ACME_PRODUCTIONS'), 'Branding text must be present');
    assert.ok(html.includes('@acme_official'), 'Watermark text must be present');
  });

  await t.test('RenderingConfigurationSchema strictly rejects legacy branding and watermark keys', async () => {
    const { RenderingConfigurationSchema } = await import('../schemas/content-profile.schema.js');

    const validPayload = {
      animation: { preset: 'SlowZoomIn' },
    };
    assert.ok(RenderingConfigurationSchema.safeParse(validPayload).success);

    const legacyPayload = {
      branding: 'LegacyBrand',
      watermark: '@legacy',
      animation: { preset: 'None' },
    };
    const parsed = RenderingConfigurationSchema.safeParse(legacyPayload);
    assert.strictEqual(parsed.success, false, 'RenderingConfigurationSchema must reject legacy branding/watermark fields');
  });
});

