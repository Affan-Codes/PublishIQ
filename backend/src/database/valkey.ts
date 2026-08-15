import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let valkeyInstance: Redis | null = null;

export function getValkeyInstance(): Redis {
  if (!valkeyInstance) {
    const isTls = env.VALKEY_URL.startsWith('rediss://');

    const options: RedisOptions = {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 30000,
      keepAlive: 10000, // Send TCP keepalive every 10s to prevent cloud timeouts
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn({ times, delay }, 'Valkey connection lost. Retrying reconnection...');
        return delay;
      },
    };

    if (isTls) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    valkeyInstance = new Redis(env.VALKEY_URL, options);

    valkeyInstance.on('connect', () => {
      logger.info('Connected to Valkey');
    });

    valkeyInstance.on('error', (err: any) => {
      logger.error({ err: err.message || err }, 'Valkey connection error');
    });
  }
  return valkeyInstance;
}

export function setMockValkey(mock: any): void {
  valkeyInstance = mock;
}

export async function closeValkeyInstance(): Promise<void> {
  if (valkeyInstance && typeof valkeyInstance.quit === 'function') {
    try {
      await valkeyInstance.quit();
    } catch {}
    valkeyInstance = null;
  }
}

export const getRedisInstance = getValkeyInstance;

export default getValkeyInstance;
