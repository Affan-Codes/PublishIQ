import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import contentTypeController from '../controllers/contentType.controller.js';
import { ContentTypeStatus } from '@prisma/client';

const router = Router();

const contentTypeSchema = z.object({
  name: z.string().min(1, 'Content type name is required').max(100),
  status: z.nativeEnum(ContentTypeStatus),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ContentType ID format'),
});

router.use(requireAuth);

router.get('/content-types', contentTypeController.list);

router.get(
  '/content-types/:id',
  validateRequest({ params: idParamSchema }),
  contentTypeController.getById
);

router.post(
  '/content-types',
  validateRequest({ body: contentTypeSchema }),
  contentTypeController.create
);

router.put(
  '/content-types/:id',
  validateRequest({ params: idParamSchema, body: contentTypeSchema.partial() }),
  contentTypeController.update
);

router.delete(
  '/content-types/:id',
  validateRequest({ params: idParamSchema }),
  contentTypeController.delete
);

export default router;
