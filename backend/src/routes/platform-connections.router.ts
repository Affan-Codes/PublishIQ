import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import platformConnectionController from '../controllers/platformConnection.controller.js';
import { HealthStatus, ConnectionStatus, Role } from '@prisma/client';
import { ValidationError } from '../errors/custom-errors.js';

const router = Router();

const connectionUpdateSchema = z.object({
  externalAccountId: z.string().optional(),
  displayName: z.string().optional(),
  accessTokenHex: z.string().min(1).optional(),
  refreshTokenHex: z.string().min(1).optional(),
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

// YT-004 fix: Reject raw unverified manual token creation endpoint in production. Connections must be created via OAuth.
router.post(
  '/platform-connections',
  requireRole([Role.Owner, Role.Administrator]),
  (req, res, next) => {
    next(new ValidationError('Manual unverified raw token entry is disabled. Platform connections must be created via verified OAuth.'));
  }
);

// YT-005 fix: Require Owner or Administrator role for mutation endpoints
router.put(
  '/platform-connections/:id',
  requireRole([Role.Owner, Role.Administrator]),
  validateRequest({ params: idParamSchema, body: connectionUpdateSchema }),
  platformConnectionController.update
);

router.delete(
  '/platform-connections/:id',
  requireRole([Role.Owner, Role.Administrator]),
  validateRequest({ params: idParamSchema }),
  platformConnectionController.delete
);

export default router;
