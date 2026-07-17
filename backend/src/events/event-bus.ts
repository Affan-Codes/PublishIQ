import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { prisma } from '../database/db.js';
import { getRedisInstance } from '../database/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const localEventBus = new EventEmitter();

const REDIS_EVENT_CHANNEL = 'publishiq:domain-events';
let redisSubscriber: Redis | null = null;

/**
 * Persists a DomainEvent in the database and broadcasts it system-wide using Redis Pub/Sub.
 * Supports both:
 * - 4-arg format: emitDomainEvent(workspaceId, type, payload, jobId)
 * - 2-arg format: emitDomainEvent(type, payload) (for backwards compatibility)
 */
export async function emitDomainEvent(
  arg1: string,
  arg2: any,
  arg3?: any,
  arg4?: string
): Promise<any> {
  let workspaceId: string;
  let type: string;
  let payload: any;
  let jobId: string | null = null;

  if (arg3 !== undefined) {
    // 3 or 4 arguments format
    workspaceId = arg1;
    type = arg2;
    payload = arg3;
    jobId = arg4 || null;
  } else {
    // 2 arguments format: emitDomainEvent(type, payload)
    type = arg1;
    payload = arg2;
    workspaceId = payload.workspaceId || '';
    jobId = payload.jobId || payload.domainEvent?.jobId || null;
  }

  // Fallback to resolve workspaceId if missing (v1 has exactly one Workspace)
  if (!workspaceId) {
    const firstWorkspace = await prisma.workspace.findFirst();
    workspaceId = firstWorkspace?.id || '';
  }

  // 1. Create and commit the DomainEvent in PostgreSQL
  const domainEvent = await prisma.domainEvent.create({
    data: {
      workspaceId,
      type,
      payload,
      jobId: jobId || null,
    },
  });

  // 2. Publish to Redis Pub/Sub channel
  try {
    const redis = getRedisInstance();
    const eventMsg = JSON.stringify({
      id: domainEvent.id,
      workspaceId: domainEvent.workspaceId,
      type: domainEvent.type,
      payload: domainEvent.payload,
      jobId: domainEvent.jobId,
      createdAt: domainEvent.createdAt,
    });
    
    await redis.publish(REDIS_EVENT_CHANNEL, eventMsg);
  } catch (err: any) {
    logger.error({ err, eventId: domainEvent.id }, 'Failed to publish event to Redis Pub/Sub');
  }

  // 3. Emit on the local process event bus
  localEventBus.emit(type, domainEvent);
  localEventBus.emit('*', domainEvent);

  logger.debug({ type, eventId: domainEvent.id }, 'Domain Event emitted');
  return domainEvent;
}

export const eventBus = {
  /**
   * Initializes the Redis Pub/Sub connection bridge for subscription.
   */
  async init(isSubscriber: boolean = false): Promise<void> {
    if (isSubscriber) {
      if (redisSubscriber) return;

      try {
        redisSubscriber = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: null,
        });

        redisSubscriber.on('connect', () => {
          logger.info('Redis event bridge subscriber connected');
        });

        redisSubscriber.on('error', (err) => {
          logger.error({ err }, 'Redis event bridge subscriber error');
        });

        await redisSubscriber.subscribe(REDIS_EVENT_CHANNEL);

        redisSubscriber.on('message', (channel: string, message: string) => {
          if (channel === REDIS_EVENT_CHANNEL) {
            try {
              const domainEvent = JSON.parse(message);
              
              // Emit on the local process emitter
              localEventBus.emit(domainEvent.type, domainEvent);
              localEventBus.emit('*', domainEvent);
            } catch (err: any) {
              logger.error({ err }, 'Failed to parse Redis Pub/Sub message');
            }
          }
        });
      } catch (err: any) {
        logger.error({ err }, 'Failed to initialize Redis Event Bridge');
        throw err;
      }
    }
  },

  /**
   * Closes the Redis Pub/Sub subscriber connection.
   */
  async close(): Promise<void> {
    if (redisSubscriber) {
      await redisSubscriber.quit();
      redisSubscriber = null;
      logger.info('Redis event bridge subscriber closed');
    }
  },

  emitDomainEvent,

  on(event: string, listener: (...args: any[]) => void) {
    localEventBus.on(event, listener);
    return this;
  },

  off(event: string, listener: (...args: any[]) => void) {
    localEventBus.off(event, listener);
    return this;
  },

  once(event: string, listener: (...args: any[]) => void) {
    localEventBus.once(event, listener);
    return this;
  },

  emit(event: string, ...args: any[]) {
    return localEventBus.emit(event, ...args);
  },
};

export default eventBus;
