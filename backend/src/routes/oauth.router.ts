import { Router } from 'express';
import oauthController from '../controllers/oauth.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { Role } from '@prisma/client';

const router = Router();

// YT-005 fix: Add RBAC role check requiring Owner or Administrator role to initiate OAuth
router.get('/oauth/:platform/authorize', requireAuth, requireRole([Role.Owner, Role.Administrator]), oauthController.authorize);
router.get('/oauth/:platform/callback', oauthController.callback);

export default router;
