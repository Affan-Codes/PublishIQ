import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import assetController from '../controllers/asset.controller.js';
import { AssetType, AssetStatus, LicenseStatus } from '@prisma/client';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for asset uploads
});

const assetCreateSchema = z.object({
  type: z.nativeEnum(AssetType),
  name: z.string().min(1, 'Asset name is required').max(100),
  status: z.nativeEnum(AssetStatus),
  filePath: z.string().optional(),
  metadata: z.union([z.record(z.string(), z.any()), z.string()]).optional().default({}),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
});

const assetUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  filePath: z.string().min(1).optional(),
  metadata: z.union([z.record(z.string(), z.any()), z.string()]).optional(),
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
  upload.single('file'),
  validateRequest({ body: assetCreateSchema }),
  assetController.create
);

router.put(
  '/assets/:id',
  upload.single('file'),
  validateRequest({ params: idParamSchema, body: assetUpdateSchema }),
  assetController.update
);

router.delete(
  '/assets/:id',
  validateRequest({ params: idParamSchema }),
  assetController.delete
);

export default router;
