import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import domainEventsController from '../controllers/domain-events.controller.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Domain Event ID format'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  jobId: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.use(requireAuth);

router.get(
  '/domain-events',
  validateRequest({ query: listQuerySchema }),
  domainEventsController.list
);

router.get(
  '/domain-events/:id',
  validateRequest({ params: idParamSchema }),
  domainEventsController.getById
);

export default router;
