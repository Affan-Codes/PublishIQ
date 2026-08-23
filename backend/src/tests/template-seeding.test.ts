import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V1_TEMPLATE_DEFINITIONS,
  V1_SAMPLE_CONTENTS,
  TemplateDefinitionSchema,
  TemplateCategorySchema,
} from '../schemas/template-definition.schema.js';

test('Canonical Template Seeding Tests (P1-01)', async (t) => {
  const categories = TemplateCategorySchema.options;

  await t.test('all 5 TemplateCategory definitions are defined and conform to schema', () => {
    assert.strictEqual(categories.length, 5);

    for (const cat of categories) {
      const def = V1_TEMPLATE_DEFINITIONS[cat];
      assert.ok(def, `Definition for ${cat} must exist in V1_TEMPLATE_DEFINITIONS`);
      const parsed = TemplateDefinitionSchema.safeParse(def);
      assert.ok(parsed.success, `Definition for ${cat} must pass TemplateDefinitionSchema validation: ${JSON.stringify(parsed.error?.format())}`);
    }
  });

  await t.test('all 5 TemplateCategory sample contents exist and contain structured blocks', () => {
    for (const cat of categories) {
      const sample = V1_SAMPLE_CONTENTS[cat];
      assert.ok(sample, `Sample content for ${cat} must exist`);
      assert.ok(Array.isArray(sample.blocks), `Sample content for ${cat} must have blocks array`);
      assert.ok(sample.blocks.length > 0, `Sample content for ${cat} must have at least 1 block`);
    }
  });

  await t.test('each V1 template defines safeAreaInsetsPx in layout and insets are differentiated (P2-01)', () => {
    const insetsSignatures = new Set<string>();

    for (const cat of categories) {
      const def = V1_TEMPLATE_DEFINITIONS[cat];
      assert.ok(def.layout.safeAreaInsetsPx, `Template ${cat} must define safeAreaInsetsPx`);
      assert.ok(typeof def.layout.safeAreaInsetsPx.topPx === 'number');
      assert.ok(typeof def.layout.safeAreaInsetsPx.bottomPx === 'number');
      assert.ok(typeof def.layout.safeAreaInsetsPx.leftPx === 'number');
      assert.ok(typeof def.layout.safeAreaInsetsPx.rightPx === 'number');

      const sig = `${def.layout.safeAreaInsetsPx.topPx}:${def.layout.safeAreaInsetsPx.bottomPx}:${def.layout.safeAreaInsetsPx.leftPx}:${def.layout.safeAreaInsetsPx.rightPx}`;
      insetsSignatures.add(sig);
    }

    // Assert that templates do not all share the same generic inset
    assert.ok(insetsSignatures.size >= 4, 'Templates must have differentiated, layout-specific safe area insets');
  });

  await t.test('each V1 template defines compatibility rules', () => {
    for (const cat of categories) {
      const def = V1_TEMPLATE_DEFINITIONS[cat];
      assert.ok(def.compatibility, `Template ${cat} must define compatibility rules`);
      assert.ok(Array.isArray(def.compatibility.supportedBlockTypes));
      assert.ok(Array.isArray(def.compatibility.supportedRoles));
      assert.ok(def.compatibility.minBlocks >= 1);
      assert.ok(def.compatibility.maxBlocks >= def.compatibility.minBlocks);
    }
  });
});
