import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { getValkeyInstance } from '../database/valkey.js';
import { logger } from '../utils/logger.js';
import { maintenanceService } from '../services/maintenance.service.js';

const connection = getValkeyInstance();

export const cleanupProcessor = async (job: Job) => {
  logger.info({ job: job.id }, 'Running cleanup job');
  await maintenanceService.runCleanup();
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

  const baseWorkerOpts = {
    connection: connection as any,
    prefix: env.QUEUE_PREFIX,
  };

  const workers = [
    new Worker('cleanup', cleanupProcessor, { ...baseWorkerOpts, concurrency: 1 }),
    new Worker('retry-publish', retryPublishProcessor, { ...baseWorkerOpts, concurrency: 2 }),
    new Worker('token-refresh', tokenRefreshProcessor, { ...baseWorkerOpts, concurrency: 1 }),
    new Worker('health-check', healthCheckProcessor, { ...baseWorkerOpts, concurrency: 1 }),
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
