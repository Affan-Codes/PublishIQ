import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import v1Router from './routes/v1.router.js';
import errorHandler from './middlewares/error-handler.js';
import { logger } from './utils/logger.js';

export const app = express();

// Secure HTTP headers
app.use(helmet());

// Configure CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Rate limiter for authentication login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit to 20 attempts
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', loginLimiter);

// Global API rate limiter
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit to 300 requests per 15 minutes per IP
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1', globalApiLimiter);

// Logging middleware
app.use((req, res, next) => {
  logger.trace({ method: req.method, path: req.path }, 'Inbound HTTP request');
  next();
});

app.use(cookieParser(env.SESSION_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static media files from MEDIA_ROOT
app.use('/media', express.static(env.MEDIA_ROOT));

// Mount routes
app.use('/api/v1', v1Router);

// Centralized error handler
app.use(errorHandler);

export default app;
