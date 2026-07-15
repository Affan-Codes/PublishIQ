import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../database/db.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import { ValidationError, UnauthorizedError } from '../errors/custom-errors.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

// Cache the hashed password at startup for single-operator auth
const OPERATOR_PASSWORD_HASH = bcrypt.hashSync(env.OPERATOR_PASSWORD, 10);

router.post(
  '/auth/login',
  validateRequest({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (email.toLowerCase() !== env.OPERATOR_EMAIL.toLowerCase()) {
        throw new UnauthorizedError('Invalid operator email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, OPERATOR_PASSWORD_HASH);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid operator email or password');
      }

      // Fetch workspace
      const workspace = await prisma.workspace.findFirst();
      if (!workspace) {
        throw new Error('Workspace is not initialized. Ensure database seeding has run.');
      }

      const token = jwt.sign(
        {
          email: email.toLowerCase(),
          workspaceId: workspace.id,
        },
        env.SESSION_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie('session', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        success: true,
        data: {
          email: email.toLowerCase(),
          workspaceId: workspace.id,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/auth/logout', (req: Request, res: Response): void => {
  res.clearCookie('session', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({
    success: true,
    data: {},
    meta: {},
  });
});

router.get('/auth/session', requireAuth, (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      email: req.operator?.email,
      workspaceId: req.workspaceId,
    },
    meta: {},
  });
});

export default router;
