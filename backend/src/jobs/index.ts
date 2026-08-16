import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { getValkeyInstance } from '../database/valkey.js';
import { logger } from '../utils/logger.js';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600, // 7 days
  },
};

function createQueue(name: string): Queue {
  const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test')) || process.execArgv.some(arg => arg.includes('test'));
  if (isTest) {
    return {
      name,
      add: async () => ({ id: 'mock-bullmq-job-id' }),
      close: async () => {},
      on: () => {},
    } as any;
  }
  const connection = getValkeyInstance();
  return new Queue(name, {
    connection: connection as any,
    prefix: env.QUEUE_PREFIX,
    defaultJobOptions,
  });
}

export const contentPipelineQueue = createQueue('content-pipeline');
export const cleanupQueue = createQueue('cleanup');
export const retryPublishQueue = createQueue('retry-publish');
export const tokenRefreshQueue = createQueue('token-refresh');
export const healthCheckQueue = createQueue('health-check');

const queues = [
  contentPipelineQueue,
  cleanupQueue,
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
