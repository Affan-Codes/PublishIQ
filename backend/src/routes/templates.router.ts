import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import templateController from '../controllers/template.controller.js';
import { PromptStatus } from '@prisma/client';

const router = Router();

const templateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  notes: z.string().max(500).optional(),
  componentPath: z.string().min(1, 'Component path is required'),
  componentSource: z.string().optional(),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional(),
  status: z.nativeEnum(PromptStatus).optional(),
});

const templateVersionSchema = z.object({
  componentPath: z.string().min(1, 'Component path is required'),
  componentSource: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Template ID format'),
});

const versionParamSchema = z.object({
  id: z.string().uuid('Invalid Template ID format'),
  versionNumber: z.coerce.number().int().positive('Version number must be a positive integer'),
});

router.use(requireAuth);

router.get('/templates', templateController.list);

router.get(
  '/templates/:id',
  validateRequest({ params: idParamSchema }),
  templateController.getById
);

router.post(
  '/templates',
  validateRequest({ body: templateCreateSchema }),
  templateController.create
);

router.put(
  '/templates/:id',
  validateRequest({ params: idParamSchema, body: templateUpdateSchema }),
  templateController.update
);

router.get(
  '/templates/:id/versions',
  validateRequest({ params: idParamSchema }),
  templateController.listVersions
);

router.get(
  '/templates/:id/versions/:versionNumber',
  validateRequest({ params: versionParamSchema }),
  templateController.getVersion
);

router.post(
  '/templates/:id/versions',
  validateRequest({ params: idParamSchema, body: templateVersionSchema }),
  templateController.createVersion
);

router.post(
  '/templates/:id/versions/:versionNumber/rollback',
  validateRequest({ params: versionParamSchema }),
  templateController.rollbackVersion
);

export default router;
