import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import authService from '../services/auth.service.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

router.post(
  '/auth/login',
  validateRequest({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { session, user } = await authService.login(email, password);

      res.cookie('session', session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: session.expiresAt,
        signed: true,
      });

      res.json({
        success: true,
        data: user,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/auth/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.signedCookies?.session || req.cookies?.session;
      if (token) {
        await authService.logout(token);
      }
      
      res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      res.json({
        success: true,
        data: {},
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/auth/session',
  requireAuth,
  (req: Request, res: Response): void => {
    res.json({
      success: true,
      data: req.operator,
      meta: {},
    });
  }
);

export default router;
