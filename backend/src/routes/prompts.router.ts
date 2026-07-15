import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import promptController from '../controllers/prompt.controller.js';
import { PromptStatus } from '@prisma/client';

const router = Router();

const promptCreateSchema = z.object({
  name: z.string().min(1, 'Prompt name is required').max(100),
  notes: z.string().max(500).optional(),
  body: z.string().min(1, 'Prompt body cannot be empty'),
});

const promptUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional(),
  status: z.nativeEnum(PromptStatus).optional(),
});

const promptVersionSchema = z.object({
  body: z.string().min(1, 'Version body cannot be empty'),
  notes: z.string().max(500).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Prompt ID format'),
});

const versionParamSchema = z.object({
  id: z.string().uuid('Invalid Prompt ID format'),
  versionNumber: z.coerce.number().int().positive('Version number must be a positive integer'),
});

router.use(requireAuth);

router.get('/prompts', promptController.list);

router.get(
  '/prompts/:id',
  validateRequest({ params: idParamSchema }),
  promptController.getById
);

router.post(
  '/prompts',
  validateRequest({ body: promptCreateSchema }),
  promptController.create
);

router.put(
  '/prompts/:id',
  validateRequest({ params: idParamSchema, body: promptUpdateSchema }),
  promptController.update
);

router.get(
  '/prompts/:id/versions',
  validateRequest({ params: idParamSchema }),
  promptController.listVersions
);

router.get(
  '/prompts/:id/versions/:versionNumber',
  validateRequest({ params: versionParamSchema }),
  promptController.getVersion
);

router.post(
  '/prompts/:id/versions',
  validateRequest({ params: idParamSchema, body: promptVersionSchema }),
  promptController.createVersion
);

router.post(
  '/prompts/:id/versions/:versionNumber/rollback',
  validateRequest({ params: versionParamSchema }),
  promptController.rollbackVersion
);

export default router;
