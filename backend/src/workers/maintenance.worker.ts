import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisInstance } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { maintenanceService } from '../services/maintenance.service.js';

const connection = getRedisInstance();
const getQueueName = (name: string) => `${env.QUEUE_PREFIX}:${name}`;

export const cleanupProcessor = async (job: Job) => {
  logger.info({ job: job.id }, 'Running cleanup job');
  await maintenanceService.runCleanup();
};

export const archiveProcessor = async (job: Job) => {
  logger.info({ job: job.id }, 'Running archive job');
  await maintenanceService.runArchive();
};

export const retryPublishProcessor = async (job: Job<{ jobId: string }>) => {
  logger.info({ job: job.id, jobId: job.data.jobId }, 'Running retry publish job');
  await maintenanceService.runRetryPublish(job.data.jobId);
};

export const tokenRefreshProcessor = async (job: Job) => {
  logger.info({ job: job.id }, 'Running token refresh job');
  await maintenanceService.runTokenRefresh();
};

export const healthCheckProcessor = async (job: Job) => {
  logger.info({ job: job.id }, 'Running background health check job');
  await maintenanceService.runHealthCheck();
};

export function startMaintenanceWorkers(): Worker[] {
  logger.info('Starting Maintenance Workers');

  const workers = [
    new Worker(getQueueName('cleanup'), cleanupProcessor, { connection: connection as any, concurrency: 1 }),
    new Worker(getQueueName('archive'), archiveProcessor, { connection: connection as any, concurrency: 1 }),
    new Worker(getQueueName('retry-publish'), retryPublishProcessor, { connection: connection as any, concurrency: 2 }),
    new Worker(getQueueName('token-refresh'), tokenRefreshProcessor, { connection: connection as any, concurrency: 1 }),
    new Worker(getQueueName('health-check'), healthCheckProcessor, { connection: connection as any, concurrency: 1 }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error({ queue: worker.name, jobId: job?.id, err }, 'Maintenance job failed');
    });
    worker.on('completed', (job) => {
      logger.debug({ queue: worker.name, jobId: job?.id }, 'Maintenance job completed');
    });
  }

  return workers;
}
