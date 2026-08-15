import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import contentProfileController from '../controllers/contentProfile.controller.js';
import {
  ContentProfileCreateSchema,
  ContentProfileUpdateSchema,
} from '../schemas/content-profile.schema.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ContentProfile ID format'),
});

router.use(requireAuth);

router.get('/content-profiles', contentProfileController.list);

router.get(
  '/content-profiles/:id',
  validateRequest({ params: idParamSchema }),
  contentProfileController.getById
);

router.post(
  '/content-profiles',
  validateRequest({ body: ContentProfileCreateSchema }),
  contentProfileController.create
);

router.put(
  '/content-profiles/:id',
  validateRequest({ params: idParamSchema, body: ContentProfileUpdateSchema }),
  contentProfileController.update
);

router.delete(
  '/content-profiles/:id',
  validateRequest({ params: idParamSchema }),
  contentProfileController.delete
);

export default router;
