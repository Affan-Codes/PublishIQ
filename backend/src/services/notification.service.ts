import { Response } from 'express';
import { prisma } from '../database/db.js';
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
            const attempts = payload.retryCount || 0;
            const maxAttempts = 3; // or fetch from configuration
            if (attempts >= maxAttempts) {
              message = `Job failed and all retries have been exhausted: ${payload.message || 'Unknown error'}`;
              shouldNotify = true;
            } else {
              message = `Job failed and is retrying (Attempt ${attempts}): ${payload.message || 'Unknown error'}`;
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
            message = `Scheduler encountered a processing error: ${payload.message || 'Unknown error'}`;
            shouldNotify = true;
            break;

          default:
            // Skip other intermediate stages to avoid spamming the user
            break;
        }

        if (shouldNotify && message) {
          // Check if notification already exists for this event to avoid duplicate inserts
          const existing = await prisma.notification.findFirst({
            where: { domainEventId: eventId },
          });

          if (!existing) {
            const notification = await prisma.notification.create({
              data: {
                workspaceId,
                domainEventId: eventId,
                message,
              },
              include: {
                domainEvent: true,
              },
            });

            logger.info({ notificationId: notification.id, type }, 'Created in-app notification');

            // Stream notification to active dashboard clients
            this.broadcastToSSE(workspaceId, 'notification', {
              id: notification.id,
              message: notification.message,
              readAt: notification.readAt,
              createdAt: notification.createdAt,
              jobId,
            });
          }
        }
      } catch (err: any) {
        logger.error({ err }, 'Failed to translate domain event to notification');
      }
    });
    
    logger.info('Notification Service event listener started');
  },
};

export default notificationService;
