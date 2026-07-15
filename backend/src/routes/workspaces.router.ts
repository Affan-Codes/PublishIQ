import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import workspaceController from '../controllers/workspace.controller.js';

const router = Router();

const workspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid workspace ID format'),
});

router.use(requireAuth);

router.get('/workspaces', workspaceController.list);

router.get(
  '/workspaces/:id',
  validateRequest({ params: idParamSchema }),
  workspaceController.getById
);

router.post(
  '/workspaces',
  validateRequest({ body: workspaceSchema }),
  workspaceController.create
);

router.put(
  '/workspaces/:id',
  validateRequest({ params: idParamSchema, body: workspaceSchema }),
  workspaceController.update
);

router.delete(
  '/workspaces/:id',
  validateRequest({ params: idParamSchema }),
  workspaceController.delete
);

export default router;
