import axios from 'axios';
import { Platform } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import platformConnectionRepository from '../repositories/platformConnection.repository.js';
import { ValidationError, ExternalProviderError } from '../errors/custom-errors.js';

export const oauthService = {
  getAuthorizationUrl(platform: Platform, workspaceId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId, platform, ts: Date.now() })).toString('base64url');
    const redirectUri = `${env.APP_BASE_URL}/api/v1/oauth/${platform.toLowerCase()}/callback`;

    if (platform === Platform.Facebook || platform === Platform.Instagram) {
      const appId = env.FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
      if (!appId) {
        throw new ValidationError('FACEBOOK_APP_ID environment variable is not configured');
      }
      const scopes = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
        'business_management',
      ].join(',');

      const apiVersion = env.META_GRAPH_API_VERSION || 'v20.0';
      return `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&response_type=code`;
    }

    if (platform === Platform.YouTube) {
      const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new ValidationError('GOOGLE_CLIENT_ID environment variable is not configured');
      }
      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' ');

      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
    }

    throw new ValidationError(`Unsupported OAuth platform: ${platform}`);
  },

  async handleOAuthCallback(platform: Platform, code: string, workspaceId: string): Promise<any[]> {
    logger.info({ platform, workspaceId }, 'Processing OAuth authorization code callback');
    const redirectUri = `${env.APP_BASE_URL}/api/v1/oauth/${platform.toLowerCase()}/callback`;
    const apiVersion = env.META_GRAPH_API_VERSION || 'v20.0';

    if (platform === Platform.Facebook || platform === Platform.Instagram) {
      const appId = env.FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
      const appSecret = env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) {
        throw new ValidationError('Facebook App ID / Secret environment variables are missing');
      }

      // 1. Exchange short-lived token
      const tokenRes = await axios.get(`https://graph.facebook.com/${apiVersion}/oauth/access_token`, {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });
      const shortToken = tokenRes.data.access_token;

      // 2. Exchange for long-lived token (60 days)
      const longTokenRes = await axios.get(`https://graph.facebook.com/${apiVersion}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        },
      });

      const longToken = longTokenRes.data.access_token;
      const expiresIn = longTokenRes.data.expires_in || 5184000;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // 3. Query linked pages
      const pagesRes = await axios.get(`https://graph.facebook.com/${apiVersion}/me/accounts`, {
        params: { access_token: longToken },
      });

      const pages = pagesRes.data?.data || [];
      if (pages.length === 0) {
        throw new ExternalProviderError('Facebook', 'No Facebook Pages discovered for this user account.');
      }

      const createdConnections = [];

      for (const page of pages) {
        if (platform === Platform.Facebook) {
          const conn = await platformConnectionRepository.upsertOAuth({
            workspaceId,
            platform: Platform.Facebook,
            externalAccountId: page.id,
            displayName: page.name,
            accessTokenHex: page.access_token || longToken,
            refreshTokenHex: longToken,
            expiresAt,
            scopes: ['pages_manage_posts', 'pages_read_engagement'],
          });
          createdConnections.push(conn);
        } else if (platform === Platform.Instagram) {
          // Check for linked Instagram Business account
          const pageDetailsRes = await axios.get(`https://graph.facebook.com/${apiVersion}/${page.id}`, {
            params: {
              fields: 'instagram_business_account{id,username,name}',
              access_token: page.access_token || longToken,
            },
          });
          const igAccount = pageDetailsRes.data?.instagram_business_account;
          if (igAccount) {
            const conn = await platformConnectionRepository.upsertOAuth({
              workspaceId,
              platform: Platform.Instagram,
              externalAccountId: igAccount.id,
              displayName: igAccount.username ? `@${igAccount.username}` : (igAccount.name || page.name),
              accessTokenHex: page.access_token || longToken,
              refreshTokenHex: longToken,
              expiresAt,
              scopes: ['instagram_basic', 'instagram_content_publish'],
            });
            createdConnections.push(conn);
          }
        }
      }

      if (createdConnections.length === 0) {
        throw new ExternalProviderError(platform, `No valid ${platform} accounts/pages could be configured.`);
      }

      return createdConnections;
    }

    if (platform === Platform.YouTube) {
      const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new ValidationError('Google Client ID / Secret environment variables are missing');
      }

      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        },
      });

      const accessToken = tokenRes.data.access_token;
      const refreshToken = tokenRes.data.refresh_token || accessToken;
      const expiresIn = tokenRes.data.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Fetch YouTube Channel Details
      const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'snippet',
          mine: true,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const items = channelRes.data?.items || [];
      if (items.length === 0) {
        throw new ExternalProviderError('YouTube', 'No YouTube channel found for this Google account.');
      }

      const channelItem = items[0];
      const channelId = channelItem.id;
      const channelTitle = channelItem.snippet?.title || 'YouTube Channel';

      const conn = await platformConnectionRepository.upsertOAuth({
        workspaceId,
        platform: Platform.YouTube,
        externalAccountId: channelId,
        displayName: channelTitle,
        accessTokenHex: accessToken,
        refreshTokenHex: refreshToken,
        expiresAt,
        scopes: ['youtube.upload', 'youtube.readonly'],
      });

      return [conn];
    }

    throw new ValidationError(`Unsupported platform for OAuth callback: ${platform}`);
  },
};

export default oauthService;
