import test from 'node:test';
import assert from 'node:assert/strict';
import { promptService } from '../services/prompt.service.js';
import { geminiResponseSchema } from '../providers/ai/gemini.provider.js';

test('PCP-01: Prompt Output Contract Tests', async (t) => {
  await t.test('promptService.getOutputContract returns all properties from geminiResponseSchema', () => {
    const contract = promptService.getOutputContract();
    const contractKeys = contract.map((item) => item.key).sort();
    const schemaKeys = Object.keys(geminiResponseSchema.properties).sort();

    assert.deepEqual(contractKeys, schemaKeys, 'Contract keys must exactly match geminiResponseSchema properties');

    for (const item of contract) {
      assert.ok(item.description, `Field ${item.key} must have a description`);
      assert.ok(item.type, `Field ${item.key} must have a type`);
      const isRequiredInSchema = geminiResponseSchema.required.includes(item.key);
      assert.equal(item.required, isRequiredInSchema, `Field ${item.key} required flag must match schema required list`);
    }
  });
});
