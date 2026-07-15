import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { eventBus } from '../events/event-bus.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Store active SSE connections
const activeClients = new Set<Response>();

// Handle cross-process/in-process Notification events
eventBus.on('NotificationCreated', (event) => {
  const sseData = `data: ${JSON.stringify(event.payload)}\n\n`;
  for (const client of activeClients) {
    client.write(sseData);
  }
});

// SSE endpoint
router.get('/notifications/stream', requireAuth, (req: Request, res: Response): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send an initial heartbeat/ack
  res.write('data: {"status":"connected"}\n\n');

  activeClients.add(res);
  logger.info('New SSE notification client connected');

  // Setup keep-alive ping interval to prevent connection timeouts
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(pingInterval);
    activeClients.delete(res);
    logger.info('SSE notification client disconnected');
  });
});

export default router;
