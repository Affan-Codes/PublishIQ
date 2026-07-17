import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import jobController from '../controllers/job.controller.js';
import { JobType, PipelineStage } from '@prisma/client';

const router = Router();

const jobCreateSchema = z.object({
  channelId: z.string().uuid('Invalid Channel ID format'),
  sourceGeneratedContentId: z.string().uuid('Invalid Generated Content ID format').optional(),
});

const jobQuerySchema = z.object({
  jobType: z.nativeEnum(JobType).optional(),
  pipelineStage: z.nativeEnum(PipelineStage).optional(),
  channelId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Job ID format'),
});

router.use(requireAuth);

router.get(
  '/jobs',
  validateRequest({ query: jobQuerySchema }),
  jobController.list
);

router.get(
  '/jobs/:id',
  validateRequest({ params: idParamSchema }),
  jobController.getById
);

router.post(
  '/jobs',
  validateRequest({ body: jobCreateSchema }),
  jobController.create
);

router.post(
  '/jobs/:id/retry',
  validateRequest({ params: idParamSchema }),
  jobController.retry
);

router.post(
  '/jobs/:id/cancel',
  validateRequest({ params: idParamSchema }),
  jobController.cancel
);

export default router;
