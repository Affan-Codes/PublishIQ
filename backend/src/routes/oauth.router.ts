import { Router } from 'express';
import oauthController from '../controllers/oauth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/oauth/:platform/authorize', requireAuth, oauthController.authorize);
router.get('/oauth/:platform/callback', oauthController.callback);

export default router;
