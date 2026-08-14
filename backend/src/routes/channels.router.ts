import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/request-validator.js';
import channelController from '../controllers/channel.controller.js';
import { AutomationMode, ChannelStatus } from '@prisma/client';

const router = Router();

// Regex for standard 5-field cron validation (supports wildcard steps like */2, ranges, lists)
const cronRegex = /^((?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?(?:,(?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?)*)\s+((?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?(?:,(?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?)*)\s+((?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?(?:,(?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?)*)\s+((?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?(?:,(?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?)*)\s+((?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?(?:,(?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?)*)$/;

const channelCreateSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  contentProfileId: z.string().uuid('Invalid Content Profile ID'),
  automationMode: z.nativeEnum(AutomationMode),
  status: z.nativeEnum(ChannelStatus),
  scheduleCron: z.string().regex(cronRegex, 'Invalid cron expression format (must be 5 fields)').default('0 9 * * *'),
  publishingConfiguration: z.record(z.string(), z.any()).default({}),
  platformConnectionIds: z.array(z.string().uuid('Invalid connection ID format')).default([]),
});

const channelUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contentProfileId: z.string().uuid().optional(),
  automationMode: z.nativeEnum(AutomationMode).optional(),
  status: z.nativeEnum(ChannelStatus).optional(),
  scheduleCron: z.string().regex(cronRegex, 'Invalid cron expression format').optional(),
  publishingConfiguration: z.record(z.string(), z.any()).optional(),
  platformConnectionIds: z.array(z.string().uuid()).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid Channel ID format'),
});

router.use(requireAuth);

router.get('/channels', channelController.list);
router.get(
  '/channels/:id',
  validateRequest({ params: idParamSchema }),
  channelController.getById
);

router.post(
  '/channels',
  validateRequest({ body: channelCreateSchema }),
  channelController.create
);

router.put(
  '/channels/:id',
  validateRequest({ params: idParamSchema, body: channelUpdateSchema }),
  channelController.update
);

router.delete(
  '/channels/:id',
  validateRequest({ params: idParamSchema }),
  channelController.delete
);

router.post(
  '/channels/:id/duplicate',
  validateRequest({ params: idParamSchema }),
  channelController.duplicate
);

export default router;
