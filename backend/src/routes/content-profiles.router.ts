import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import contentProfileController from '../controllers/contentProfile.controller.js';
import { ContentProfileStatus, Language } from '@prisma/client';

const router = Router();

const jsonSchema = z.record(z.string(), z.any());

const contentProfileCreateSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  status: z.nativeEnum(ContentProfileStatus),
  contentTypeId: z.string().uuid('Invalid ContentType ID format'),
  promptVersionId: z.string().uuid('Invalid PromptVersion ID format'),
  templateVersionId: z.string().uuid('Invalid TemplateVersion ID format'),
  language: z.nativeEnum(Language),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
  promptVariables: jsonSchema.default({}),
  brandingRules: jsonSchema.default({}),
  watermarkRules: jsonSchema.default({}),
  captionStrategy: jsonSchema.default({}),
  hashtagStrategy: jsonSchema.default({}),
  musicSelectionRules: jsonSchema.default({}),
  renderingConfiguration: jsonSchema.default({}),
  validationRules: jsonSchema.default({}),
});

const contentProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.nativeEnum(ContentProfileStatus).optional(),
  contentTypeId: z.string().uuid().optional(),
  promptVersionId: z.string().uuid().optional(),
  templateVersionId: z.string().uuid().optional(),
  language: z.nativeEnum(Language).optional(),
  tone: z.string().optional(),
  writingStyle: z.string().optional(),
  promptVariables: jsonSchema.optional(),
  brandingRules: jsonSchema.optional(),
  watermarkRules: jsonSchema.optional(),
  captionStrategy: jsonSchema.optional(),
  hashtagStrategy: jsonSchema.optional(),
  musicSelectionRules: jsonSchema.optional(),
  renderingConfiguration: jsonSchema.optional(),
  validationRules: jsonSchema.optional(),
});

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
  validateRequest({ body: contentProfileCreateSchema }),
  contentProfileController.create
);

router.put(
  '/content-profiles/:id',
  validateRequest({ params: idParamSchema, body: contentProfileUpdateSchema }),
  contentProfileController.update
);

router.delete(
  '/content-profiles/:id',
  validateRequest({ params: idParamSchema }),
  contentProfileController.delete
);

export default router;
