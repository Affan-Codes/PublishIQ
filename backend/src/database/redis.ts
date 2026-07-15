import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let redisInstance: Redis | null = null;

export function getRedisInstance(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    redisInstance.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redisInstance.on('error', (err: any) => {
      logger.error({ err }, 'Redis connection error');
    });
  }
  return redisInstance;
}

export default getRedisInstance;
