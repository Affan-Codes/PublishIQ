import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateCompatibility } from '../templates/compatibility.js';
import { STRESS_TEST_SCENARIOS } from '../constants/stress-scenarios.js';
import { V1_TEMPLATE_DEFINITIONS } from '../schemas/template-definition.schema.js';
import { renderingService } from '../services/rendering.service.js';

test('Template Stress Test & Shared Compatibility Validation (P1-02)', async (t) => {
  t.after(async () => {
    await renderingService.closeBrowser();
  });

  const minimalQuoteDef = V1_TEMPLATE_DEFINITIONS.MinimalQuote;
  const terminalDef = V1_TEMPLATE_DEFINITIONS.Terminal;

  await t.test('validateTemplateCompatibility passes for valid content matching template constraints', () => {
    const validContent = {
      blocks: [
        {
          type: 'body' as const,
          role: 'default' as const,
          runs: [{ text: 'Clean valid text run', emphasis: 'normal' as const }],
        },
      ],
    };

    const err = validateTemplateCompatibility(validContent, minimalQuoteDef.compatibility!);
    assert.strictEqual(err, null, 'Must return null for compatible content');
  });

  await t.test('validateTemplateCompatibility fails when block count is below minBlocks', () => {
    const emptyContent = { blocks: [] };
    const err = validateTemplateCompatibility(emptyContent, minimalQuoteDef.compatibility!);
    assert.ok(err !== null, 'Must reject content with 0 blocks');
    assert.ok(err.includes('outside allowed range'), 'Error must specify range bounds');
  });

  await t.test('validateTemplateCompatibility fails when block count exceeds maxBlocks', () => {
    const oversizedContent = {
      blocks: Array(10).fill({
        type: 'body' as const,
        role: 'default' as const,
        runs: [{ text: 'Overflow block', emphasis: 'normal' as const }],
      }),
    };

    const err = validateTemplateCompatibility(oversizedContent, minimalQuoteDef.compatibility!);
    assert.ok(err !== null, 'Must reject content with 10 blocks when max is 4');
    assert.ok(err.includes('outside allowed range'));
  });

  await t.test('validateTemplateCompatibility fails when block type is unsupported', () => {
    const codeContent = {
      blocks: [
        {
          type: 'code' as const,
          role: 'command' as const,
          runs: [{ text: 'npm start', emphasis: 'normal' as const }],
        },
      ],
    };

    // MinimalQuote only supports 'heading' and 'body'
    const err = validateTemplateCompatibility(codeContent, minimalQuoteDef.compatibility!);
    assert.ok(err !== null, 'MinimalQuote must reject code block type');
    assert.ok(err.includes("Unsupported block type 'code'"));
  });

  await t.test('all 9 stress test scenarios evaluate with valid status against Terminal definition', async () => {
    for (const scenario of STRESS_TEST_SCENARIOS) {
      const result = await renderingService.evaluateLayoutFit(
        terminalDef,
        scenario.content,
        scenario.language
      );

      assert.ok(['PASS', 'WARNING', 'FAIL'].includes(result.status), `Scenario ${scenario.id} must return valid status`);
      assert.ok(typeof result.message === 'string' && result.message.length > 0, 'Must provide descriptive evaluation message');
    }
  });
});
