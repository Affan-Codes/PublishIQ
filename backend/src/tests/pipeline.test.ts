import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { PipelineStage } from '@prisma/client';

const PIPELINE_STAGE_SEQUENCE: PipelineStage[] = [
  PipelineStage.GeneratingContent,
  PipelineStage.Validating,
  PipelineStage.RenderingImage,
  PipelineStage.AttachingMusic,
  PipelineStage.RenderingVideo,
  PipelineStage.Publishing,
  PipelineStage.Completed,
];

function normalizeAndHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

test('Normalization Hashing Unit Tests', async (t) => {
  await t.test('should produce identical hashes for texts that differ only in casing and spacing', () => {
    const textA = '  Discipline  Equals   FREEDOM!  ';
    const textB = 'discipline equals freedom!';
    assert.strictEqual(normalizeAndHash(textA), normalizeAndHash(textB));
  });

  await t.test('should produce different hashes for semantically different texts', () => {
    const textA = 'Focus on the journey';
    const textB = 'Focus on the destination';
    assert.notStrictEqual(normalizeAndHash(textA), normalizeAndHash(textB));
  });
});

test('Pipeline Stage Transition and Resume Unit Tests', async (t) => {
  await t.test('should correctly identify index for failed stage resumption', () => {
    const failedStage = PipelineStage.RenderingVideo;
    const startIndex = PIPELINE_STAGE_SEQUENCE.indexOf(failedStage);
    assert.strictEqual(startIndex, 4);
  });

  await t.test('should start from index 0 when stage is Draft or Running', () => {
    const stage = PipelineStage.Draft;
    const startIndex = PIPELINE_STAGE_SEQUENCE.indexOf(stage);
    const resumeIndex = startIndex === -1 ? 0 : startIndex;
    assert.strictEqual(resumeIndex, 0);
  });

  await t.test('should preserve generation stage sequence integrity', () => {
    assert.strictEqual(PIPELINE_STAGE_SEQUENCE.length, 7);
    assert.strictEqual(PIPELINE_STAGE_SEQUENCE[0], PipelineStage.GeneratingContent);
    assert.strictEqual(PIPELINE_STAGE_SEQUENCE[6], PipelineStage.Completed);
  });
});
