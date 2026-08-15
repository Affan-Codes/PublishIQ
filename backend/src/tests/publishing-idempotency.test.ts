import test from 'node:test';
import assert from 'node:assert';
import { publishingService } from '../services/publishing.service.js';
import { publishingRecordRepository } from '../repositories/publishingRecord.repository.js';
import { jobRepository } from '../repositories/job.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { eventBus } from '../events/event-bus.js';
import { instagramAdapter } from '../providers/publishing/instagram.provider.js';
import { PublishRecordStatus, Platform } from '@prisma/client';

test('CRIT-01: Publishing Idempotency & Per-Platform Resume Tests', async (t) => {
  await t.test('publishJobContent should skip platform connections that already succeeded', async () => {
    const mockJobId = '00000000-0000-0000-0000-000000000001';
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000002';
    const conn1Id = '00000000-0000-0000-0000-000000000003';
    const conn2Id = '00000000-0000-0000-0000-000000000004';

    const mockJob = {
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      channel: {
        id: '00000000-0000-0000-0000-000000000005',
        platformConnections: [
          { platformConnection: { id: conn1Id, platform: Platform.YouTube } },
          { platformConnection: { id: conn2Id, platform: Platform.Instagram } },
        ],
        contentProfile: { contentType: { name: 'Quote' } },
        publishingConfiguration: {},
      },
      configSnapshot: {},
    };

    const mockContent = {
      id: '00000000-0000-0000-0000-000000000006',
      jobId: mockJobId,
      text: 'Test content',
      imageUrl: 'https://example.com/image.png',
      videoUrl: 'https://example.com/video.mp4',
      caption: 'Test caption',
      hashtags: ['test'],
    };

    const mockExistingRecords = [
      {
        id: '00000000-0000-0000-0000-000000000007',
        jobId: mockJobId,
        platformConnectionId: conn1Id,
        status: PublishRecordStatus.Success,
        platform: Platform.YouTube,
      },
    ];

    const origGetJob = jobRepository.getJobForPublishing;
    const origFindContent = generatedContentRepository.findByJobId;
    const origListByJob = publishingRecordRepository.listByJobId;
    const origGetConn = platformConnectionRepository.getById;
    const origCreateRecord = publishingRecordRepository.create;
    const origUpdateContent = generatedContentRepository.update;
    const origEnsureHealth = (publishingService as any).ensureConnectionHealth;
    const origEmitDomainEvent = eventBus.emitDomainEvent;
    const origPublishIg = instagramAdapter.publish;

    const publishedConnections: string[] = [];

    try {
      instagramAdapter.publish = async () => ({ success: true, externalId: 'ig-post-123' }) as any;
      eventBus.emitDomainEvent = async () => ({ id: 'evt-1' }) as any;
      jobRepository.getJobForPublishing = async () => mockJob as any;
      generatedContentRepository.findByJobId = async () => mockContent as any;
      publishingRecordRepository.listByJobId = async () => mockExistingRecords as any;
      platformConnectionRepository.getById = async (id: string) => ({
        id,
        platform: id === conn1Id ? Platform.YouTube : Platform.Instagram,
        status: 'Active',
        accessTokenEnc: Buffer.from('mock-token'),
        refreshTokenEnc: Buffer.from('mock-refresh'),
        expiresAt: new Date(Date.now() + 100000),
      }) as any;
      (publishingService as any).ensureConnectionHealth = async () => true;
      publishingRecordRepository.create = async (data: any) => {
        publishedConnections.push(data.platformConnectionId);
        return { id: 'rec-new', ...data };
      };
      generatedContentRepository.update = async () => mockContent as any;

      await publishingService.publishJobContent(mockJobId);

      assert.strictEqual(publishedConnections.includes(conn1Id), false, 'YouTube connection should have been skipped as already successful');
      assert.strictEqual(publishedConnections.includes(conn2Id), true, 'Instagram connection should have been processed');
    } finally {
      jobRepository.getJobForPublishing = origGetJob;
      generatedContentRepository.findByJobId = origFindContent;
      publishingRecordRepository.listByJobId = origListByJob;
      platformConnectionRepository.getById = origGetConn;
      publishingRecordRepository.create = origCreateRecord;
      generatedContentRepository.update = origUpdateContent;
      (publishingService as any).ensureConnectionHealth = origEnsureHealth;
      eventBus.emitDomainEvent = origEmitDomainEvent;
      instagramAdapter.publish = origPublishIg;
    }
  });
});
