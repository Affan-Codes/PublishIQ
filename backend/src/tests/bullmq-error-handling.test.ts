import test from 'node:test';
import assert from 'node:assert';
import { contentPipelineProcessor } from '../workers/content-pipeline.worker.js';
import { jobRepository } from '../repositories/job.repository.js';
import { ValidationError } from '../errors/custom-errors.js';
import { PipelineStage } from '@prisma/client';

test('HIGH-05: BullMQ Non-Retryable Error Discard & Failure Transition Tests', async (t) => {
  await t.test('contentPipelineProcessor should call job.discard() and throw when non-retryable ValidationError occurs', async () => {
    let discardCalled = false;

    const mockJob: any = {
      id: 'bull-job-123',
      data: {
        jobId: '00000000-0000-0000-0000-000000000001',
      },
      updateProgress: async () => {},
      discard: async () => {
        discardCalled = true;
      },
    };

    const origGetById = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;

    try {
      jobRepository.getById = async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        workspaceId: '00000000-0000-0000-0000-000000000002',
        pipelineStage: PipelineStage.Draft,
        configSnapshot: {},
      }) as any;

      jobRepository.transitionJobStage = async () => {
        throw new ValidationError('Validation failed: Profanity detected in generated text');
      };

      await assert.rejects(
        async () => {
          await contentPipelineProcessor(mockJob);
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should propagate ValidationError to BullMQ');
          return true;
        }
      );

      assert.strictEqual(discardCalled, true, 'job.discard() must be called to eliminate remaining BullMQ retry attempts');
    } finally {
      jobRepository.getById = origGetById;
      jobRepository.transitionJobStage = origTransition;
    }
  });
});
