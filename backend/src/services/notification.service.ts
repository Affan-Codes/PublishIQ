import { Response } from 'express';
import { notificationRepository, NotificationListOptions } from '../repositories/notification.repository.js';
import { localEventBus } from '../events/event-bus.js';
import { logger } from '../utils/logger.js';

interface SSEClient {
  res: Response;
  workspaceId: string;
}

const sseClients: SSEClient[] = [];

export const notificationService = {
  /**
   * Registers a client response object for SSE streaming.
   */
  registerClient(res: Response, workspaceId: string): void {
    sseClients.push({ res, workspaceId });
    logger.debug({ workspaceId, count: sseClients.length }, 'SSE client registered');
  },

  /**
   * Unregisters a client response object.
   */
  unregisterClient(res: Response): void {
    const index = sseClients.findIndex((c) => c.res === res);
    if (index !== -1) {
      sseClients.splice(index, 1);
      logger.debug({ count: sseClients.length }, 'SSE client unregistered');
    }
  },

  /**
   * Broadcasts a JSON message to all connected SSE clients in a workspace.
   */
  broadcastToSSE(workspaceId: string, event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sentCount = 0;

    for (const client of sseClients) {
      if (client.workspaceId === workspaceId) {
        client.res.write(payload);
        sentCount++;
      }
    }
    logger.trace({ event, sentCount }, 'Broadcasted SSE event to clients');
  },

  /**
   * Starts listening to domain events and translates them to in-app notifications.
   */
  startEventListener(): void {
    localEventBus.on('*', async (domainEvent: any) => {
      try {
        const { type, payload, jobId, workspaceId, id: eventId } = domainEvent;

        let message = '';
        let shouldNotify = false;

        switch (type) {
          case 'JobFailed':
            const attempts = payload?.retryCount || 0;
            const maxAttempts = 3;
            if (attempts >= maxAttempts) {
              message = `Job failed and all retries have been exhausted: ${payload?.message || 'Unknown error'}`;
              shouldNotify = true;
            } else {
              message = `Job failed and is retrying (Attempt ${attempts}): ${payload?.message || 'Unknown error'}`;
              shouldNotify = true;
            }
            break;

          case 'ApprovalRequired':
            message = `Content generation complete for Job. Operator approval is required before completing.`;
            shouldNotify = true;
            break;

          case 'ContentGenerated':
            message = `Content pipeline completed successfully. Rendering outputs are ready.`;
            shouldNotify = true;
            break;

          case 'SchedulerError':
            message = `Scheduler encountered a processing error: ${payload?.message || 'Unknown error'}`;
            shouldNotify = true;
            break;

          default:
            break;
        }

        if (shouldNotify && message) {
          const existing = await notificationRepository.findFirst({
            domainEventId: eventId,
          });

          if (!existing) {
            const notification = await notificationRepository.create({
              workspaceId,
              domainEventId: eventId,
              message,
            });

            const unreadCount = await notificationRepository.countUnread(workspaceId);

            logger.info({ notificationId: notification.id, type }, 'Created in-app notification');

            // Stream notification to active dashboard clients
            this.broadcastToSSE(workspaceId, 'notification', {
              id: notification.id,
              message: notification.message,
              readAt: notification.readAt,
              createdAt: notification.createdAt,
              jobId,
              unreadCount,
              domainEvent: (notification as any).domainEvent,
            });
          }
        }
      } catch (err: any) {
        logger.error({ err }, 'Failed to translate domain event to notification');
      }
    });

    logger.info('Notification Service event listener started');
  },

  async getUnreadCount(workspaceId: string): Promise<number> {
    return notificationRepository.countUnread(workspaceId);
  },

  async getNotificationById(id: string, workspaceId: string) {
    const item = await notificationRepository.getById(id, workspaceId);
    if (!item) {
      throw new Error('Notification not found');
    }
    return item;
  },

  async listNotifications(workspaceId: string, skip: number, limit: number, options: NotificationListOptions = {}) {
    const [items, total, unreadCount] = await Promise.all([
      notificationRepository.list(workspaceId, skip, limit, options),
      notificationRepository.count(workspaceId, options),
      notificationRepository.countUnread(workspaceId),
    ]);
    return { items, total, unreadCount };
  },

  async markAsRead(id: string, workspaceId: string) {
    const existing = await notificationRepository.getById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error('Notification not found');
    }
    const updated = await notificationRepository.update(id, {
      readAt: new Date(),
    });
    const unreadCount = await notificationRepository.countUnread(workspaceId);
    this.broadcastToSSE(workspaceId, 'unread_count_update', { unreadCount });
    return updated;
  },

  async markAllAsRead(workspaceId: string) {
    const res = await notificationRepository.markAllAsRead(workspaceId);
    this.broadcastToSSE(workspaceId, 'unread_count_update', { unreadCount: 0 });
    return res;
  },

  async deleteNotification(id: string, workspaceId: string) {
    const existing = await notificationRepository.getById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error('Notification not found');
    }
    const deleted = await notificationRepository.delete(id, workspaceId);
    const unreadCount = await notificationRepository.countUnread(workspaceId);
    this.broadcastToSSE(workspaceId, 'unread_count_update', { unreadCount });
    return deleted;
  },
};

export default notificationService;
