import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/custom-errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn(
      {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        path: req.path,
        method: req.method,
      },
      'Application error'
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details || {},
      },
    });
    return;
  }

  // Unexpected errors
  logger.error(
    {
      error: {
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
    },
    'Unhandled server error'
  );

  const responseError: Record<string, any> = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred.',
  };

  if (env.NODE_ENV === 'development') {
    responseError.details = {
      originalMessage: err.message,
      stack: err.stack,
    };
  }

  res.status(500).json({
    success: false,
    error: responseError,
  });
};

export default errorHandler;
