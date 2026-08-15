import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import authService from '../services/auth.service.js';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { UnauthorizedError, ForbiddenError } from '../errors/custom-errors.js';

export interface OperatorPayload {
  id: string;
  email: string;
  role: Role;
  workspaceId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      operator?: OperatorPayload;
      workspaceId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.signedCookies?.session || req.cookies?.session;

  if (!token) {
    next(new UnauthorizedError('Authentication session token is missing'));
    return;
  }

  try {
    const session = await authService.validateSession(token);
    
    // Set cookie again in case it was renewed
    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
      signed: true,
    });

    const workspaceId = session.user.workspaceId;
    if (!workspaceId) {
      next(new ForbiddenError('Account is not assigned to a workspace'));
      return;
    }

    req.operator = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      workspaceId,
    };
    req.workspaceId = workspaceId;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }
    next(error);
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.operator) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.operator.role)) {
      next(new ForbiddenError('You do not have permission to access this resource'));
      return;
    }

    next();
  };
};

export default requireAuth;
