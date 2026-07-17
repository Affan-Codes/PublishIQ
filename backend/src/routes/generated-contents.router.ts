import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import generatedContentController from '../controllers/generatedContent.controller.js';
import { PublishStatus, Language } from '@prisma/client';

const router = Router();

const generatedContentQuerySchema = z.object({
  contentProfileId: z.string().uuid().optional(),
  publishStatus: z.nativeEnum(PublishStatus).optional(),
  language: z.nativeEnum(Language).optional(),
  contentTypeId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Generated Content ID format'),
});

const actionBodySchema = z.object({
  channelId: z.string().uuid('Invalid Channel ID format'),
});

router.use(requireAuth);

router.get(
  '/generated-contents',
  validateRequest({ query: generatedContentQuerySchema }),
  generatedContentController.list
);

router.get(
  '/generated-contents/:id',
  validateRequest({ params: idParamSchema }),
  generatedContentController.getById
);

router.delete(
  '/generated-contents/:id',
  validateRequest({ params: idParamSchema }),
  generatedContentController.delete
);

router.post(
  '/generated-contents/:id/duplicate',
  validateRequest({ params: idParamSchema, body: actionBodySchema }),
  generatedContentController.duplicate
);

router.post(
  '/generated-contents/:id/regenerate',
  validateRequest({ params: idParamSchema, body: actionBodySchema }),
  generatedContentController.regenerate
);

export default router;
