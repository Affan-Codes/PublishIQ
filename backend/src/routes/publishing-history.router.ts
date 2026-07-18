import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import publishingHistoryController from '../controllers/publishing-history.controller.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid('Invalid record ID format'),
});

const republishSchema = z.object({
  generatedContentId: z.string().uuid('Invalid content ID format'),
  channelId: z.string().uuid('Invalid channel ID format'),
});

router.use(requireAuth);

router.get('/publishing-history', publishingHistoryController.list);
router.get(
  '/publishing-history/:id',
  validateRequest({ params: idParamSchema }),
  publishingHistoryController.getById
);

router.post(
  '/publishing-history/republish',
  validateRequest({ body: republishSchema }),
  publishingHistoryController.republish
);

router.post(
  '/publishing-history/:id/retry',
  validateRequest({ params: idParamSchema }),
  publishingHistoryController.retry
);

export default router;
