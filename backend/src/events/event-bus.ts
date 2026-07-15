import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const emitter = new EventEmitter();

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
const channelName = `${env.QUEUE_PREFIX}:domain-events`;

export async function initEventBus(isSubscriber: boolean = false): Promise<void> {
  pubClient = new Redis(env.REDIS_URL);
  
  if (isSubscriber) {
    subClient = new Redis(env.REDIS_URL);
    
    await subClient.subscribe(channelName);
    logger.info(`Subscribed to Redis Pub/Sub channel: ${channelName}`);

    subClient.on('message', (channel: string, message: string) => {
      if (channel === channelName) {
        try {
          const event = JSON.parse(message);
          logger.debug({ eventType: event.type }, 'Cross-process event received via Redis Pub/Sub');
          emitter.emit(event.type, event);
          emitter.emit('*', event);
        } catch (err) {
          logger.error({ err, message }, 'Failed to parse Pub/Sub event message');
        }
      }
    });
  }
}

export async function emitDomainEvent(eventType: string, eventPayload: any): Promise<void> {
  const event = {
    type: eventType,
    payload: eventPayload,
    timestamp: new Date().toISOString(),
  };

  emitter.emit(eventType, event);
  emitter.emit('*', event);

  if (pubClient) {
    try {
      await pubClient.publish(channelName, JSON.stringify(event));
      logger.trace({ eventType }, 'Event published to Redis Pub/Sub');
    } catch (err) {
      logger.error({ err, eventType }, 'Failed to publish event to Redis Pub/Sub');
    }
  }
}

export async function closeEventBus(): Promise<void> {
  if (pubClient) {
    await pubClient.quit();
  }
  if (subClient) {
    await subClient.quit();
  }
}

export const eventBus = {
  init: initEventBus,
  emitDomainEvent: emitDomainEvent,
  close: closeEventBus,
  on(event: string, listener: (...args: any[]) => void) {
    emitter.on(event, listener);
    return this;
  },
  off(event: string, listener: (...args: any[]) => void) {
    emitter.off(event, listener);
    return this;
  },
  once(event: string, listener: (...args: any[]) => void) {
    emitter.once(event, listener);
    return this;
  },
  emit(event: string, ...args: any[]) {
    return emitter.emit(event, ...args);
  },
};

export default eventBus;
