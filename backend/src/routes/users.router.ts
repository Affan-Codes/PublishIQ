import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import userController from '../controllers/user.controller.js';
import { Role } from '@prisma/client';

const router = Router();

const userCreateSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(4, 'Password must be at least 4 characters long'),
  role: z.nativeEnum(Role),
});

const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(4).optional(),
  role: z.nativeEnum(Role).optional(),
});

const profileUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(4).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid User ID format'),
});

router.use(requireAuth);

// Profile endpoints (available to any authenticated user)
router.get('/users/me', userController.getMe);
router.put(
  '/users/me',
  validateRequest({ body: profileUpdateSchema }),
  userController.updateMe
);

// Administrator / Owner gated endpoints
router.get(
  '/users',
  requireRole([Role.Owner, Role.Administrator]),
  userController.list
);

router.get(
  '/users/:id',
  requireRole([Role.Owner, Role.Administrator]),
  validateRequest({ params: idParamSchema }),
  userController.getById
);

router.post(
  '/users',
  requireRole([Role.Owner, Role.Administrator]),
  validateRequest({ body: userCreateSchema }),
  userController.create
);

router.put(
  '/users/:id',
  requireRole([Role.Owner, Role.Administrator]),
  validateRequest({ params: idParamSchema, body: userUpdateSchema }),
  userController.update
);

router.delete(
  '/users/:id',
  requireRole([Role.Owner]), // Gated strictly to Owner for high security
  validateRequest({ params: idParamSchema }),
  userController.delete
);

export default router;
