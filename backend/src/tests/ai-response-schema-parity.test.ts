import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiResponseSchema } from '../providers/ai/gemini.provider.js';
import { AIContentResponseSchema } from '../schemas/ai-response.schema.js';

test('PAS-03: AI Response Schema Parity Tests', async (t) => {
  await t.test('geminiResponseSchema properties and AIContentResponseSchema shape have identical keys', () => {
    const geminiKeys = Object.keys(geminiResponseSchema.properties).sort();
    const zodKeys = Object.keys(AIContentResponseSchema.shape).sort();

    assert.deepEqual(
      geminiKeys,
      zodKeys,
      `Schema mismatch: geminiResponseSchema keys [${geminiKeys.join(', ')}] do not match AIContentResponseSchema keys [${zodKeys.join(', ')}]`
    );
  });

  await t.test('selectedMusicAssetId is present in both schemas and is optional', () => {
    assert.ok('selectedMusicAssetId' in geminiResponseSchema.properties, 'selectedMusicAssetId missing in geminiResponseSchema');
    assert.ok('selectedMusicAssetId' in AIContentResponseSchema.shape, 'selectedMusicAssetId missing in AIContentResponseSchema');
    assert.ok(!geminiResponseSchema.required.includes('selectedMusicAssetId'), 'selectedMusicAssetId must not be required in geminiResponseSchema');

    // Parse without selectedMusicAssetId to confirm it is optional
    const parseResult = AIContentResponseSchema.safeParse({
      title: 'Valid Title',
      quote: 'Valid Quote text',
      caption: 'Valid Caption',
      hashtags: ['#tag1', '#tag2', '#tag3'],
      language: 'English',
      contentType: 'Quote',
    });
    assert.equal(parseResult.success, true, 'AIContentResponseSchema must accept object without selectedMusicAssetId');
  });
});
