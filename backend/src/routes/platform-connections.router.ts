import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import platformConnectionController from '../controllers/platformConnection.controller.js';
import { Platform, HealthStatus, ConnectionStatus } from '@prisma/client';

const router = Router();

const connectionCreateSchema = z.object({
  platform: z.nativeEnum(Platform),
  accessTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Access token must be a valid hex string'),
  refreshTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Refresh token must be a valid hex string'),
  expiresAt: z.string().datetime(),
  scopes: z.array(z.string()).default([]),
  healthStatus: z.nativeEnum(HealthStatus).default(HealthStatus.Healthy),
  status: z.nativeEnum(ConnectionStatus).default(ConnectionStatus.Active),
});

const connectionUpdateSchema = z.object({
  accessTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Access token must be a valid hex string').optional(),
  refreshTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Refresh token must be a valid hex string').optional(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).optional(),
  healthStatus: z.nativeEnum(HealthStatus).optional(),
  status: z.nativeEnum(ConnectionStatus).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid connection ID format'),
});

router.use(requireAuth);

router.get('/platform-connections', platformConnectionController.list);
router.get(
  '/platform-connections/:id',
  validateRequest({ params: idParamSchema }),
  platformConnectionController.getById
);

router.post(
  '/platform-connections',
  validateRequest({ body: connectionCreateSchema }),
  platformConnectionController.create
);

router.put(
  '/platform-connections/:id',
  validateRequest({ params: idParamSchema, body: connectionUpdateSchema }),
  platformConnectionController.update
);

router.delete(
  '/platform-connections/:id',
  validateRequest({ params: idParamSchema }),
  platformConnectionController.delete
);

export default router;
