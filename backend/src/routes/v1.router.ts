import { Router } from 'express';
import healthRouter from './health.router.js';
import authRouter from './auth.router.js';
import notificationsRouter from './notifications.router.js';

const router = Router();

// Mount foundations
router.use('/', healthRouter);
router.use('/', authRouter);
router.use('/', notificationsRouter);

export default router;
