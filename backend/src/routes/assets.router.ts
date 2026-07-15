import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import assetController from '../controllers/asset.controller.js';
import { AssetType, AssetStatus, LicenseStatus } from '@prisma/client';

const router = Router();

const assetCreateSchema = z.object({
  type: z.nativeEnum(AssetType),
  name: z.string().min(1, 'Asset name is required').max(100),
  status: z.nativeEnum(AssetStatus),
  filePath: z.string().min(1, 'Asset file path is required'),
  metadata: z.record(z.string(), z.any()).default({}),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
});

const assetUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  filePath: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Asset ID format'),
});

const querySchema = z.object({
  type: z.nativeEnum(AssetType).optional(),
});

router.use(requireAuth);

router.get(
  '/assets',
  validateRequest({ query: querySchema }),
  assetController.list
);

router.get(
  '/assets/:id',
  validateRequest({ params: idParamSchema }),
  assetController.getById
);

router.post(
  '/assets',
  validateRequest({ body: assetCreateSchema }),
  assetController.create
);

router.put(
  '/assets/:id',
  validateRequest({ params: idParamSchema, body: assetUpdateSchema }),
  assetController.update
);

router.delete(
  '/assets/:id',
  validateRequest({ params: idParamSchema }),
  assetController.delete
);

export default router;
