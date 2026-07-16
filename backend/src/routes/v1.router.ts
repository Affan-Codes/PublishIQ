import { Router } from 'express';
import healthRouter from './health.router.js';
import authRouter from './auth.router.js';
import usersRouter from './users.router.js';
import notificationsRouter from './notifications.router.js';
import workspacesRouter from './workspaces.router.js';
import contentTypesRouter from './content-types.router.js';
import promptsRouter from './prompts.router.js';
import templatesRouter from './templates.router.js';
import assetsRouter from './assets.router.js';
import contentProfilesRouter from './content-profiles.router.js';
import channelsRouter from './channels.router.js';
import platformConnectionsRouter from './platform-connections.router.js';

const router = Router();

// Mount foundations
router.use('/', healthRouter);
router.use('/', authRouter);
router.use('/', usersRouter);
router.use('/', notificationsRouter);

// Mount core domains
router.use('/', workspacesRouter);
router.use('/', contentTypesRouter);
router.use('/', promptsRouter);
router.use('/', templatesRouter);
router.use('/', assetsRouter);
router.use('/', contentProfilesRouter);
router.use('/', channelsRouter);
router.use('/', platformConnectionsRouter);

export default router;
