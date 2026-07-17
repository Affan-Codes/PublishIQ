import { Queue, ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisInstance } from '../database/redis.js';
import { logger } from '../utils/logger.js';

const connection = getRedisInstance();

// Helper to construct queue names with the prefix
const getQueueName = (name: string) => `${env.QUEUE_PREFIX}:${name}`;

export const contentPipelineQueue = new Queue(getQueueName('content-pipeline'), {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
export const cleanupQueue = new Queue(getQueueName('cleanup'), { connection: connection as any });
export const archiveQueue = new Queue(getQueueName('archive'), { connection: connection as any });
export const retryPublishQueue = new Queue(getQueueName('retry-publish'), { connection: connection as any });
export const tokenRefreshQueue = new Queue(getQueueName('token-refresh'), { connection: connection as any });
export const healthCheckQueue = new Queue(getQueueName('health-check'), { connection: connection as any });

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
