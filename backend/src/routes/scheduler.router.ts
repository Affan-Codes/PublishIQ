import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import schedulerController from '../controllers/scheduler.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/scheduler/upcoming', schedulerController.listUpcoming);

export default router;
