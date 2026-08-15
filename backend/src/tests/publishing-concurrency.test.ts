import test from 'node:test';
import assert from 'node:assert';
import { publishingService } from '../services/publishing.service.js';
import { publishingRecordRepository } from '../repositories/publishingRecord.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { jobRepository } from '../repositories/job.repository.js';
import { ConflictError } from '../errors/custom-errors.js';
import { PublishRecordStatus, Platform } from '@prisma/client';

test('HIGH-03: Publishing Concurrency & Republish Job Integrity Tests', async (t) => {
  await t.test('retryPublishRecord should reject concurrent attempts when claimForRetry returns false', async () => {
    const mockRecordId = '00000000-0000-0000-0000-000000000001';
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000002';

    const origGetById = publishingRecordRepository.getById;
    const origClaim = publishingRecordRepository.claimForRetry;

    try {
      publishingRecordRepository.getById = async () => ({
        id: mockRecordId,
        workspaceId: mockWorkspaceId,
        status: PublishRecordStatus.Failure,
        platform: Platform.YouTube,
        generatedContent: { text: 'Some text', imageUrl: 'https://example.com/img.png', videoUrl: 'https://example.com/v.mp4' },
        platformConnection: { id: 'conn-1', accessTokenEnc: Buffer.from('token'), refreshTokenEnc: Buffer.from('refresh'), expiresAt: new Date(Date.now() + 100000) },
      }) as any;

      // Simulate race where another worker already claimed the record
      publishingRecordRepository.claimForRetry = async () => false;

      await assert.rejects(
        async () => {
          await publishingService.retryPublishRecord(mockRecordId, mockWorkspaceId);
        },
        (err: any) => {
          assert(err instanceof ConflictError, `Expected ConflictError but got ${err.name}`);
          return true;
        }
      );
    } finally {
      publishingRecordRepository.getById = origGetById;
      publishingRecordRepository.claimForRetry = origClaim;
    }
  });

  await t.test('republishContent should create a new Job without mutating original GeneratedContent.jobId', async () => {
    const origGenContentId = '00000000-0000-0000-0000-000000000001';
    const origJobId = '00000000-0000-0000-0000-000000000002';
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000003';
    const mockChannelId = '00000000-0000-0000-0000-000000000004';

    const origGetWithJob = generatedContentRepository.getByIdWithJob;
    const origGetChannel = channelRepository.getById;
    const origCreateJob = jobRepository.createJob;
    const origUpdateContent = generatedContentRepository.update;
    const origPublishJob = publishingService.publishJobContent;
    const origTransition = jobRepository.transitionJobStage;

    let updateGenContentCalled = false;
    let createdJobConfig: any = null;

    try {
      generatedContentRepository.getByIdWithJob = async () => ({
        id: origGenContentId,
        jobId: origJobId,
        workspaceId: mockWorkspaceId,
        text: 'Wisdom quote',
        imageUrl: 'https://example.com/img.png',
        videoUrl: 'https://example.com/vid.mp4',
        caption: 'Caption',
        hashtags: ['wisdom'],
        promptVersionId: 'pv-1',
        templateVersionId: 'tv-1',
      }) as any;

      channelRepository.getById = async () => ({
        id: mockChannelId,
        workspaceId: mockWorkspaceId,
        contentProfileId: 'prof-1',
        platformConnections: [{ id: 'conn-1' }],
      }) as any;

      jobRepository.createJob = async (data: any) => {
        createdJobConfig = data;
        return { id: '00000000-0000-0000-0000-000000000005', ...data };
      };

      generatedContentRepository.update = async () => {
        updateGenContentCalled = true;
        return {} as any;
      };

      publishingService.publishJobContent = async () => {};
      jobRepository.transitionJobStage = async () => ({} as any);

      await publishingService.republishContent(origGenContentId, mockChannelId, mockWorkspaceId);

      assert.strictEqual(updateGenContentCalled, false, 'GeneratedContent.jobId must NEVER be mutated during republish!');
      assert.strictEqual(createdJobConfig?.configSnapshot?.originalJobId, origJobId, 'Should store originalJobId in republish job snapshot');
      assert.strictEqual(createdJobConfig?.configSnapshot?.sourceGeneratedContentId, origGenContentId, 'Should store sourceGeneratedContentId in republish job snapshot');
    } finally {
      generatedContentRepository.getByIdWithJob = origGetWithJob;
      channelRepository.getById = origGetChannel;
      jobRepository.createJob = origCreateJob;
      generatedContentRepository.update = origUpdateContent;
      publishingService.publishJobContent = origPublishJob;
      jobRepository.transitionJobStage = origTransition;
    }
  });
});
