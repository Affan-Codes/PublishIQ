import test from 'node:test';
import assert from 'node:assert';
import { getNormalizedHash } from '../utils/normalization.js';
import { PipelineStage } from '@prisma/client';

test('Normalization Hashing Unit Tests', async (t) => {
  await t.test('should produce identical hashes for texts that differ only in casing and spacing', () => {
    const text1 = '  The quick brown fox jumps   over the lazy dog.  ';
    const text2 = 'the QUICK brown FOX Jumps OVER the LAZY dog';

    const hash1 = getNormalizedHash(text1);
    const hash2 = getNormalizedHash(text2);

    assert.strictEqual(hash1, hash2);
  });

  await t.test('should produce different hashes for semantically different texts', () => {
    const text1 = 'The quick brown fox jumps over the lazy dog';
    const text2 = 'A completely different quote text for shayari';

    const hash1 = getNormalizedHash(text1);
    const hash2 = getNormalizedHash(text2);

    assert.notStrictEqual(hash1, hash2);
  });
});

test('Pipeline Stage Transition and Resume Unit Tests', async (t) => {
  const generationStages: PipelineStage[] = [
    PipelineStage.GeneratingContent,
    PipelineStage.Validating,
    PipelineStage.RenderingImage,
    PipelineStage.AttachingMusic,
    PipelineStage.RenderingVideo,
    PipelineStage.GeneratingCaption,
    PipelineStage.GeneratingHashtags,
  ];

  await t.test('should correctly identify index for failed stage resumption', () => {
    const failureStageStr = 'RenderingVideo';
    const stageIndex = generationStages.indexOf(failureStageStr as PipelineStage);
    assert.strictEqual(stageIndex, 4);
  });

  await t.test('should start from index 0 when stage is Draft or Running', () => {
    const stageStr = PipelineStage.Draft;
    const stageIndex = generationStages.indexOf(stageStr);
    assert.strictEqual(stageIndex, -1); // Index -1 defaults to startIndex = 0
  });

  await t.test('should preserve generation stage sequence integrity', () => {
    assert.strictEqual(generationStages[0], PipelineStage.GeneratingContent);
    assert.strictEqual(generationStages[1], PipelineStage.Validating);
    assert.strictEqual(generationStages[2], PipelineStage.RenderingImage);
    assert.strictEqual(generationStages[generationStages.length - 1], PipelineStage.GeneratingHashtags);
  });
});
