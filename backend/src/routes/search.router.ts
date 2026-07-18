import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import searchController from '../controllers/search.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/search', searchController.search);

export default router;
