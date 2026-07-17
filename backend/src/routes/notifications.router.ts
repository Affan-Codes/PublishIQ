import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import notificationsController from '../controllers/notifications.controller.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Notification ID format'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.use(requireAuth);

router.get(
  '/notifications/stream',
  notificationsController.sseStream
);

router.get(
  '/notifications',
  validateRequest({ query: listQuerySchema }),
  notificationsController.list
);

router.post(
  '/notifications/:id/read',
  validateRequest({ params: idParamSchema }),
  notificationsController.markAsRead
);

router.post(
  '/notifications/read-all',
  notificationsController.markAllAsRead
);

export default router;
