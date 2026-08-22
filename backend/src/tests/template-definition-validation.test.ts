import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TemplateDefinitionSchema,
  V1_TEMPLATE_DEFINITIONS,
} from '../schemas/template-definition.schema.js';

test('Template Definition Validation Tests', async (t) => {
  await t.test('all 5 canonical V1 template definitions pass strict validation', () => {
    for (const [name, def] of Object.entries(V1_TEMPLATE_DEFINITIONS)) {
      const parsed = TemplateDefinitionSchema.safeParse(def);
      assert.equal(parsed.success, true, `Canonical template ${name} should pass validation`);
    }
  });

  await t.test('rejects invalid color hex codes', () => {
    const base = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    base.colors.primary = 'red';
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.colors.primary = '#12345'; // only 5 chars
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.colors.primary = 'rgb(255, 255, 255)';
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.colors.primary = '#GGGGGG';
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);
  });

  await t.test('rejects out-of-bounds layout dimensions', () => {
    const base = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    base.layout.maxContentWidthPx = 350; // below 400
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.layout.maxContentWidthPx = 1200; // above 1000
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.layout.maxContentWidthPx = 800;
    base.layout.blockGapPx = 4; // below 8
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.layout.blockGapPx = 200; // above 160
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);
  });

  await t.test('rejects non-standard font weights (only 400, 600, 700 allowed)', () => {
    const base = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    base.typography.heading.weight = 500;
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.typography.heading.weight = 300;
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.typography.heading.weight = 700;
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, true);
  });

  await t.test('rejects out-of-bounds branding & watermark scales and opacities', () => {
    const base = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    base.branding.sizeScalePct = 40; // below 50
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.branding.sizeScalePct = 160; // above 150
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.branding.sizeScalePct = 100;
    base.branding.opacityCeiling = 1.5; // above 1
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.branding.opacityCeiling = -0.1; // below 0
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);
  });

  await t.test('rejects unrecognized category or layout enums', () => {
    const base = JSON.parse(JSON.stringify(V1_TEMPLATE_DEFINITIONS.MinimalQuote));

    base.category = 'UnsupportedCategory';
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);

    base.category = 'MinimalQuote';
    base.layout.contentAlign = 'justify';
    assert.equal(TemplateDefinitionSchema.safeParse(base).success, false);
  });
});
