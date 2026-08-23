import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPipelineQueue } from '../jobs/index.js';
import dashboardService from '../services/dashboard.service.js';
import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { setMockValkey } from '../database/valkey.js';
import { prisma } from '../database/db.js';

test('BullMQ Worker Health Observability Tests (P0-02)', async (t) => {
  setMockValkey({ ping: async () => 'PONG' });
  const origGetWorkers = contentPipelineQueue.getWorkers;
  const origGetDashboardData = dashboardRepository.getDashboardData;

  t.afterEach(() => {
    contentPipelineQueue.getWorkers = origGetWorkers;
    dashboardRepository.getDashboardData = origGetDashboardData;
  });

  t.after(async () => {
    setMockValkey(null);
    await prisma.$disconnect();
  });

  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';

  dashboardRepository.getDashboardData = async () => {
    return [
      1, // channelCount
      5, // contentCount
      4, // successRecordCount
      1, // failureRecordCount
      [], // platformConnections
      [], // failedJobs
      [], // recentPublishes
    ];
  };

  await t.test('reports worker as Offline/unhealthy when no active workers are registered on queue', async () => {
    contentPipelineQueue.getWorkers = async () => [];

    const stats = await dashboardService.getDashboardStats(mockWorkspaceId);

    assert.ok(stats.health, 'Must return health stats object');
    assert.strictEqual(stats.health.worker.status, 'Offline');
    assert.strictEqual(stats.health.worker.count, 0);
  });

  await t.test('reports worker as Healthy when at least one active worker is registered on queue', async () => {
    contentPipelineQueue.getWorkers = async () => [
      { id: 'worker-pid-1234', name: 'content-pipeline-worker' },
      { id: 'worker-pid-5678', name: 'content-pipeline-worker' },
    ] as any;

    const stats = await dashboardService.getDashboardStats(mockWorkspaceId);

    assert.ok(stats.health, 'Must return health stats object');
    assert.strictEqual(stats.health.worker.status, 'Healthy');
    assert.strictEqual(stats.health.worker.count, 2);
  });
});
