import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import templateController from '../controllers/template.controller.js';
import { PromptStatus, TemplateCategory } from '@prisma/client';
import { TemplateDefinitionSchema } from '../schemas/template-definition.schema.js';
import { StructuredContentSchema } from '../schemas/content-block.schema.js';

const router = Router();

const templateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  notes: z.string().max(500).optional(),
  componentPath: z.string().optional(),
  componentSource: z.string().optional(),
  category: z.nativeEnum(TemplateCategory).optional(),
  definition: TemplateDefinitionSchema.optional(),
  sampleContent: StructuredContentSchema.optional(),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional(),
  status: z.nativeEnum(PromptStatus).optional(),
});

const templateVersionSchema = z.object({
  componentPath: z.string().optional(),
  componentSource: z.string().optional(),
  category: z.nativeEnum(TemplateCategory).optional(),
  definition: TemplateDefinitionSchema.optional(),
  sampleContent: StructuredContentSchema.optional(),
  notes: z.string().max(500).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Template ID format'),
});

const versionParamSchema = z.object({
  id: z.string().uuid('Invalid Template ID format'),
  versionNumber: z.coerce.number().int().positive('Version number must be a positive integer'),
});

const templatePreviewSchema = z.object({
  definition: TemplateDefinitionSchema,
  content: StructuredContentSchema,
  language: z.enum(['English', 'Hindi', 'Urdu', 'HindiRoman', 'UrduRoman']).default('English'),
  branding: z.string().optional(),
  watermark: z.string().optional(),
  brandingOpacity: z.number().min(0).max(1).optional(),
  watermarkOpacity: z.number().min(0).max(1).optional(),
});

const templateStressTestSchema = z.object({
  definition: TemplateDefinitionSchema,
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

router.get(
  '/templates/:id/versions/:versionNumber/preview',
  validateRequest({ params: versionParamSchema }),
  templateController.getPreview
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

router.post(
  '/templates/preview',
  validateRequest({ body: templatePreviewSchema }),
  templateController.preview
);

router.post(
  '/templates/stress-test',
  validateRequest({ body: templateStressTestSchema }),
  templateController.stressTest
);

export default router;
