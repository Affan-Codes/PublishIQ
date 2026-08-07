import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let valkeyInstance: Redis | null = null;

export function getValkeyInstance(): Redis {
  if (!valkeyInstance) {
    valkeyInstance = new Redis(env.VALKEY_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    valkeyInstance.on('connect', () => {
      logger.info('Connected to Valkey');
    });

    valkeyInstance.on('error', (err: any) => {
      logger.error({ err }, 'Valkey connection error');
    });
  }
  return valkeyInstance;
}

export const getRedisInstance = getValkeyInstance;

export default getValkeyInstance;
