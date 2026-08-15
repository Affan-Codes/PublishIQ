import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { logRepository } from '../repositories/log.repository.js';
import { getValkeyInstance } from '../database/valkey.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const localEventBus = new EventEmitter();

const VALKEY_EVENT_CHANNEL = 'publishiq:domain-events';
let valkeySubscriber: Redis | null = null;

/**
 * Persists a DomainEvent in the database and broadcasts it system-wide using Valkey Pub/Sub.
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
    const firstWorkspace = await workspaceRepository.getFirst();
    workspaceId = firstWorkspace?.id || '';
  }

  // 1. Create and commit the DomainEvent in PostgreSQL
  const domainEvent = await logRepository.createDomainEvent({
    workspaceId,
    type,
    payload,
    jobId: jobId || null,
  });

  // 2. Publish to Valkey Pub/Sub channel
  if (process.env.NODE_ENV !== 'test') {
    try {
      const valkey = getValkeyInstance();
      const eventMsg = JSON.stringify({
        id: domainEvent.id,
        workspaceId: domainEvent.workspaceId,
        type: domainEvent.type,
        payload: domainEvent.payload,
        jobId: domainEvent.jobId,
        createdAt: domainEvent.createdAt,
      });
      
      await valkey.publish(VALKEY_EVENT_CHANNEL, eventMsg);
    } catch (err: any) {
      logger.error({ err, eventId: domainEvent.id }, 'Failed to publish event to Valkey Pub/Sub');
    }
  }

  // 3. Emit on the local process event bus
  localEventBus.emit(type, domainEvent);
  localEventBus.emit('*', domainEvent);

  logger.debug({ type, eventId: domainEvent.id }, 'Domain Event emitted');
  return domainEvent;
}

/**
 * Broadcasts an already-persisted DomainEvent system-wide using Valkey Pub/Sub and local EventEmitter.
 * Does NOT persist to PostgreSQL (prevents duplicate DomainEvent rows).
 */
export async function broadcastDomainEvent(domainEvent: any): Promise<void> {
  if (!domainEvent) return;

  // 1. Publish to Valkey Pub/Sub channel
  if (process.env.NODE_ENV !== 'test') {
    try {
      const valkey = getValkeyInstance();
      const eventMsg = JSON.stringify({
        id: domainEvent.id,
        workspaceId: domainEvent.workspaceId,
        type: domainEvent.type,
        payload: domainEvent.payload,
        jobId: domainEvent.jobId,
        createdAt: domainEvent.createdAt,
      });
      
      await valkey.publish(VALKEY_EVENT_CHANNEL, eventMsg);
    } catch (err: any) {
      logger.error({ err, eventId: domainEvent.id }, 'Failed to publish event to Valkey Pub/Sub');
    }
  }

  // 2. Emit on the local process event bus
  localEventBus.emit(domainEvent.type, domainEvent);
  localEventBus.emit('*', domainEvent);

  logger.debug({ type: domainEvent.type, eventId: domainEvent.id }, 'Domain Event broadcasted');
}

export const eventBus = {
  broadcastDomainEvent,
  /**
   * Initializes the Valkey Pub/Sub connection bridge for subscription.
   */
  async init(isSubscriber: boolean = false): Promise<void> {
    if (isSubscriber) {
      if (valkeySubscriber) return;

      try {
        valkeySubscriber = new Redis(env.VALKEY_URL, {
          maxRetriesPerRequest: null,
        });

        valkeySubscriber.on('connect', () => {
          logger.info('Valkey event bridge subscriber connected');
        });

        valkeySubscriber.on('error', (err) => {
          logger.error({ err }, 'Valkey event bridge subscriber error');
        });

        await valkeySubscriber.subscribe(VALKEY_EVENT_CHANNEL);

        valkeySubscriber.on('message', (channel: string, message: string) => {
          if (channel === VALKEY_EVENT_CHANNEL) {
            try {
              const domainEvent = JSON.parse(message);
              
              // Emit on the local process emitter
              localEventBus.emit(domainEvent.type, domainEvent);
              localEventBus.emit('*', domainEvent);
            } catch (err: any) {
              logger.error({ err }, 'Failed to parse Valkey Pub/Sub message');
            }
          }
        });
      } catch (err: any) {
        logger.error({ err }, 'Failed to initialize Valkey Event Bridge');
        throw err;
      }
    }
  },

  /**
   * Closes the Valkey Pub/Sub subscriber connection.
   */
  async close(): Promise<void> {
    if (valkeySubscriber) {
      await valkeySubscriber.quit();
      valkeySubscriber = null;
      logger.info('Valkey event bridge subscriber closed');
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
