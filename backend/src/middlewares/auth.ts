import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/custom-errors.js';

export interface OperatorPayload {
  email: string;
  workspaceId: string;
}

declare global {
  namespace Express {
    interface Request {
      operator?: OperatorPayload;
      workspaceId?: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.session;

  if (!token) {
    throw new UnauthorizedError('Authentication session token is missing');
  }

  try {
    const payload = jwt.verify(token, env.SESSION_SECRET) as OperatorPayload;
    req.operator = payload;
    req.workspaceId = payload.workspaceId;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired authentication session');
  }
};

export default requireAuth;
