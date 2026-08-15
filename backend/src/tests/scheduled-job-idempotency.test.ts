import test from 'node:test';
import assert from 'node:assert';
import { channelSchedulingService } from '../services/channel-scheduling.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';

test('CRIT-02: Scheduled Job Idempotency & Worker Recovery Tests', async (t) => {
  await t.test('createScheduledJob should return existing Job ID when matching bullJobId exists', async () => {
    const mockChannelId = '00000000-0000-0000-0000-000000000001';
    const mockBullJobId = 'repeat:channel-sched-1:1700000000000';
    const existingJobId = '00000000-0000-0000-0000-000000000002';

    const origFindByBull = jobRepository.findByBullJobId;
    const origGetChannel = channelRepository.getById;
    const origCreateJob = jobRepository.createJob;

    let createJobCalled = false;

    try {
      jobRepository.findByBullJobId = async (bullJobId: string) => {
        if (bullJobId === mockBullJobId) {
          return { id: existingJobId, channelId: mockChannelId } as any;
        }
        return null;
      };

      channelRepository.getById = async () => ({
        id: mockChannelId,
        workspaceId: '00000000-0000-0000-0000-000000000003',
        status: 'Active',
        contentProfile: { id: 'prof-1', promptVersionId: 'pv-1', templateVersionId: 'tv-1' },
      }) as any;

      jobRepository.createJob = async () => {
        createJobCalled = true;
        return { id: 'job-new-sched' } as any;
      };

      const returnedJobId = await channelSchedulingService.createScheduledJob(mockChannelId, mockBullJobId);

      assert.strictEqual(returnedJobId, existingJobId, 'Should return existing job ID');
      assert.strictEqual(createJobCalled, false, 'Should not create a duplicate DB job');
    } finally {
      jobRepository.findByBullJobId = origFindByBull;
      channelRepository.getById = origGetChannel;
      jobRepository.createJob = origCreateJob;
    }
  });

  await t.test('createScheduledJob should create a new Job if bullJobId is not found', async () => {
    const mockChannelId = '00000000-0000-0000-0000-000000000001';
    const mockBullJobId = 'repeat:channel-sched-2:1700000000000';
    const newJobId = '00000000-0000-0000-0000-000000000004';

    const origFindByBull = jobRepository.findByBullJobId;
    const origGetChannel = channelRepository.getById;
    const origCreateJob = jobRepository.createJob;

    let createdSnapshot: any = null;

    try {
      jobRepository.findByBullJobId = async () => null;

      channelRepository.getById = async () => ({
        id: mockChannelId,
        workspaceId: '00000000-0000-0000-0000-000000000003',
        status: 'Active',
        contentProfile: { id: 'prof-1', promptVersionId: 'pv-1', templateVersionId: 'tv-1' },
      }) as any;

      jobRepository.createJob = async (data: any) => {
        createdSnapshot = data.configSnapshot;
        return { id: newJobId, ...data } as any;
      };

      const returnedJobId = await channelSchedulingService.createScheduledJob(mockChannelId, mockBullJobId);

      assert.strictEqual(returnedJobId, newJobId, 'Should return newly created job ID');
      assert.strictEqual(createdSnapshot?.bullJobId, mockBullJobId, 'Should store bullJobId in configSnapshot');
    } finally {
      jobRepository.findByBullJobId = origFindByBull;
      channelRepository.getById = origGetChannel;
      jobRepository.createJob = origCreateJob;
    }
  });
});
