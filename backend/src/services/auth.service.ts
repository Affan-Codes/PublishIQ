import userRepository from '../repositories/user.repository.js';
import sessionRepository, { SessionWithUser } from '../repositories/session.repository.js';
import { UnauthorizedError, NotFoundError } from '../errors/custom-errors.js';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';
import { Session } from '@prisma/client';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const RENEWAL_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export const authService = {
  async login(email: string, password: string): Promise<{ session: Session; user: any }> {
    logger.info({ email }, 'Attempting operator login');

    const user = await userRepository.getByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid operator email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid operator email or password');
    }

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const session = await sessionRepository.create(user.id, expiresAt);

    logger.info({ email, sessionId: session.id }, 'Operator login successful');
    return {
      session,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        workspaceId: user.workspaceId,
      },
    };
  },

  async logout(sessionId: string): Promise<void> {
    logger.info({ sessionId }, 'Logging out session');
    try {
      await sessionRepository.delete(sessionId);
    } catch (error) {
      logger.debug({ sessionId, error }, 'Session already deleted or missing');
    }
  },

  async validateSession(sessionId: string): Promise<SessionWithUser> {
    logger.debug({ sessionId }, 'Validating session');
    const session = await sessionRepository.getById(sessionId);
    
    if (!session) {
      throw new UnauthorizedError('Session not found');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      // Clean up expired session
      try {
        await sessionRepository.delete(sessionId);
      } catch {}
      throw new UnauthorizedError('Session has expired');
    }

    // Auto-renew session if close to expiry
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry < RENEWAL_THRESHOLD_MS) {
      logger.debug({ sessionId }, 'Renewing session expiry');
      const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
      await sessionRepository.touch(sessionId, newExpiresAt);
      session.expiresAt = newExpiresAt;
    }

    return session;
  },
};

export default authService;
