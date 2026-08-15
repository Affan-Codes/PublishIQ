import test from 'node:test';
import assert from 'node:assert';
import { publishingService } from '../services/publishing.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { publishingRecordRepository } from '../repositories/publishingRecord.repository.js';
import { PublishRecordStatus, Platform } from '@prisma/client';

test('MED-03 & MED-04: Publishing Resilience & Pinned Version Snapshot Tests', async (t) => {
  await t.test('MED-03: publishJobContent should handle connection disabled mid-loop gracefully', async () => {
    const mockJobId = '00000000-0000-0000-0000-000000000001';
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000002';
    const connDisabledId = '00000000-0000-0000-0000-000000000003';

    const mockJob = {
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      channel: {
        id: '00000000-0000-0000-0000-000000000004',
        platformConnections: [
          { platformConnection: { id: connDisabledId, platform: Platform.YouTube } },
        ],
        contentProfile: { contentType: { name: 'Quote' } },
        publishingConfiguration: {},
      },
      configSnapshot: {},
    };

    const mockContent = {
      id: '00000000-0000-0000-0000-000000000005',
      jobId: mockJobId,
      text: 'Test content',
      imageUrl: 'https://example.com/image.png',
      videoUrl: 'https://example.com/video.mp4',
      caption: 'Test caption',
      hashtags: ['test'],
    };

    const origGetJob = jobRepository.getJobForPublishing;
    const origFindContent = generatedContentRepository.findByJobId;
    const origListByJob = publishingRecordRepository.listByJobId;
    const origGetConn = platformConnectionRepository.getById;
    const origCreateRecord = publishingRecordRepository.create;
    const origUpdateContent = generatedContentRepository.update;

    const createdRecords: any[] = [];

    try {
      jobRepository.getJobForPublishing = async () => mockJob as any;
      generatedContentRepository.findByJobId = async () => mockContent as any;
      publishingRecordRepository.listByJobId = async () => [];
      
      platformConnectionRepository.getById = async () => ({
        id: connDisabledId,
        platform: Platform.YouTube,
        status: 'Disabled',
      }) as any;

      publishingRecordRepository.create = async (data: any) => {
        createdRecords.push(data);
        return { id: '00000000-0000-0000-0000-000000000006', ...data };
      };
      generatedContentRepository.update = async () => mockContent as any;

      await assert.rejects(
        async () => {
          await publishingService.publishJobContent(mockJobId);
        },
        /Publishing failed/
      );

      assert.strictEqual(createdRecords.length, 1);
      assert.strictEqual(createdRecords[0]?.status, PublishRecordStatus.Failure);
      assert(createdRecords[0]?.errorDetails?.includes('disabled'), 'Record should note connection was disabled');
    } finally {
      jobRepository.getJobForPublishing = origGetJob;
      generatedContentRepository.findByJobId = origFindContent;
      publishingRecordRepository.listByJobId = origListByJob;
      platformConnectionRepository.getById = origGetConn;
      publishingRecordRepository.create = origCreateRecord;
      generatedContentRepository.update = origUpdateContent;
    }
  });

  await t.test('MED-04: Version snapshot priority resolution', () => {
    const jobWithSnapshot = {
      configSnapshot: {
        promptVersionId: 'pinned-pv-1',
        templateVersionId: 'pinned-tv-1',
      },
      contentProfile: {
        promptVersionId: 'mutated-pv-2',
        templateVersionId: 'mutated-tv-2',
      },
    };

    const effectivePromptVersionId = jobWithSnapshot.configSnapshot?.promptVersionId || jobWithSnapshot.contentProfile?.promptVersionId;
    const effectiveTemplateVersionId = jobWithSnapshot.configSnapshot?.templateVersionId || jobWithSnapshot.contentProfile?.templateVersionId;

    assert.strictEqual(effectivePromptVersionId, 'pinned-pv-1', 'Should prioritize pinned promptVersionId from configSnapshot');
    assert.strictEqual(effectiveTemplateVersionId, 'pinned-tv-1', 'Should prioritize pinned templateVersionId from configSnapshot');
  });
});
