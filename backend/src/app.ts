import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import v1Router from './routes/v1.router.js';
import errorHandler from './middlewares/error-handler.js';
import { logger } from './utils/logger.js';

export const app = express();

// Configure CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Logging middleware
app.use((req, res, next) => {
  logger.trace({ method: req.method, path: req.path }, 'Inbound HTTP request');
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static media files from MEDIA_ROOT
app.use('/media', express.static(env.MEDIA_ROOT));

// Mount routes
app.use('/api/v1', v1Router);

// Centralized error handler
app.use(errorHandler);

export default app;
