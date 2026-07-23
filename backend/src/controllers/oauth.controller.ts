import { Request, Response, NextFunction } from 'express';
import oauthService from '../services/oauth.service.js';
import { Platform } from '@prisma/client';
import { env } from '../config/env.js';
import { ValidationError } from '../errors/custom-errors.js';

export const oauthController = {
  async authorize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platformParam = (req.params.platform as string).toUpperCase();
      let platform: Platform;

      if (platformParam === 'YOUTUBE') platform = Platform.YouTube;
      else if (platformParam === 'FACEBOOK') platform = Platform.Facebook;
      else if (platformParam === 'INSTAGRAM') platform = Platform.Instagram;
      else throw new ValidationError(`Invalid OAuth platform: ${req.params.platform}`);

      const url = oauthService.getAuthorizationUrl(platform, req.workspaceId!);
      res.json({
        success: true,
        data: { url },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platformParam = (req.params.platform as string).toUpperCase();
      let platform: Platform;

      if (platformParam === 'YOUTUBE') platform = Platform.YouTube;
      else if (platformParam === 'FACEBOOK') platform = Platform.Facebook;
      else if (platformParam === 'INSTAGRAM') platform = Platform.Instagram;
      else throw new ValidationError(`Invalid OAuth platform: ${req.params.platform}`);

      const code = req.query.code as string;
      const stateRaw = req.query.state as string;

      if (!code) {
        throw new ValidationError('Authorization code is missing from OAuth callback parameters');
      }

      let workspaceId = req.workspaceId;
      if (!workspaceId && stateRaw) {
        try {
          const decodedState = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
          workspaceId = decodedState.workspaceId;
        } catch {}
      }

      if (!workspaceId) {
        throw new ValidationError('Workspace context could not be identified from OAuth state parameter');
      }

      const connections = await oauthService.handleOAuthCallback(platform, code, workspaceId);

      // Redirect to frontend platform-connections page
      const redirectUrl = `${env.CORS_ORIGIN}/platform-connections?connected=${platform.toLowerCase()}&count=${connections.length}`;
      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  },
};

export default oauthController;
