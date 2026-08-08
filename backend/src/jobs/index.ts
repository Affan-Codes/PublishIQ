import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { getValkeyInstance } from '../database/valkey.js';
import { logger } from '../utils/logger.js';

const connection = getValkeyInstance();

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

const queueOpts = {
  connection: connection as any,
  prefix: env.QUEUE_PREFIX,
  defaultJobOptions,
};

export const contentPipelineQueue = new Queue('content-pipeline', queueOpts);
export const cleanupQueue = new Queue('cleanup', queueOpts);
export const archiveQueue = new Queue('archive', queueOpts);
export const retryPublishQueue = new Queue('retry-publish', queueOpts);
export const tokenRefreshQueue = new Queue('token-refresh', queueOpts);
export const healthCheckQueue = new Queue('health-check', queueOpts);

const queues = [
  contentPipelineQueue,
  cleanupQueue,
  archiveQueue,
  retryPublishQueue,
  tokenRefreshQueue,
  healthCheckQueue,
];

export async function initQueues(): Promise<void> {
  logger.info('BullMQ Queues initialized');
}

export async function closeQueues(): Promise<void> {
  await Promise.all(queues.map((q) => q.close()));
  logger.info('BullMQ Queues closed');
}
