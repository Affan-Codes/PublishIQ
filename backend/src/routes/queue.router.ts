import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import queueController from '../controllers/queue.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/queue/stats', queueController.getStats);

export default router;
