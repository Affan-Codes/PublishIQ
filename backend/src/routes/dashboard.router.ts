import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/dashboard/stats', dashboardController.getStats);

export default router;
