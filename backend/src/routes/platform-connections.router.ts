import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import platformConnectionController from '../controllers/platformConnection.controller.js';
import { ConnectionStatus, Role } from '@prisma/client';
import { ValidationError } from '../errors/custom-errors.js';

const router = Router();

// YT-014 fix: Drop raw accessTokenHex/refreshTokenHex from update schema entirely.
// All token additions and credentials changes MUST go through verified OAuth.
const connectionUpdateSchema = z.object({
  displayName: z.string().optional(),
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

// YT-005 & YT-014 fix: Require Owner/Admin role and enforce safe connection status/name updates only
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
