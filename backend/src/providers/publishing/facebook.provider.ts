import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import FormData from 'form-data';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';

export const facebookAdapter: PublishingAdapter = {
  platform: Platform.Facebook,

  validate(content: GeneratedContentData): PlatformLimitViolation[] {
    const violations: PlatformLimitViolation[] = [];

    if (!content.imageUrl && !content.videoUrl) {
      violations.push({
        field: 'media',
        message: 'Facebook publishing requires either a generated image or video URL asset path.',
      });
    }

    const caption = content.caption || '';
    if (caption.length > 63206) {
      violations.push({
        field: 'caption',
        message: 'Facebook posts cannot exceed 63,206 characters.',
        limit: 63206,
        actual: caption.length,
      });
    }

    return violations;
  },

  async publish(content: GeneratedContentData, connection: PlatformConnectionData): Promise<PublishResult> {
    logger.info({ platform: this.platform }, 'Publishing to Facebook Page from Cloudinary storage');
    
    let accessToken: string;
    try {
      accessToken = decrypt(Buffer.from(connection.accessTokenEnc));
    } catch (err: any) {
      return { success: false, errorMessage: 'Failed to decrypt access token: ' + err.message };
    }

    // Check if it's a test environment for publishing simulation
    if (process.env.NODE_ENV === 'test') {
      logger.info('Simulating Facebook publishing success for test environment');
      const mockId = `fb_post_${Date.now()}`;
      return {
        success: true,
        externalId: mockId,
        platformResponse: { id: mockId, status: 'mocked' },
      };
    }

    const apiVersion = env.META_GRAPH_API_VERSION || 'v20.0';

    try {
      // 1. Get Facebook Page Accounts
      const accountsRes = await axios.get(`https://graph.facebook.com/${apiVersion}/me/accounts`, {
        params: { access_token: accessToken }
      });

      const pages = accountsRes.data?.data || [];
      if (pages.length === 0) {
        return { success: false, errorMessage: 'No Facebook Pages found linked to this access token.' };
      }

      // Pick target page by externalAccountId if available, else first page
      const targetPageId = connection.externalAccountId;
      const page = targetPageId ? (pages.find((p: any) => p.id === targetPageId) || pages[0]) : pages[0];
      const pageId = page.id;
      const pageAccessToken = page.access_token;

      const caption = content.caption || '';
      
      // 2. Publish Image or Video from Cloudinary URL
      if (content.videoUrl) {
        logger.info({ videoUrl: content.videoUrl, pageId }, 'Publishing video to Facebook Page via Cloudinary URL stream');
        const videoStreamRes = await axios.get(content.videoUrl, { responseType: 'stream' });

        const form = new FormData();
        form.append('source', videoStreamRes.data);
        form.append('description', caption);

        const response = await axios.post(`https://graph.facebook.com/${apiVersion}/${pageId}/videos`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${pageAccessToken}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        return {
          success: true,
          externalId: response.data.id,
          platformResponse: response.data,
        };
      } else {
        // Image upload from Cloudinary URL
        logger.info({ imageUrl: content.imageUrl, pageId }, 'Publishing photo to Facebook Page via Cloudinary URL');
        const imageStreamRes = await axios.get(content.imageUrl!, { responseType: 'stream' });

        const form = new FormData();
        form.append('source', imageStreamRes.data);
        form.append('message', caption);

        const response = await axios.post(`https://graph.facebook.com/${apiVersion}/${pageId}/photos`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${pageAccessToken}`,
          },
        });

        return {
          success: true,
          externalId: response.data.id,
          platformResponse: response.data,
        };
      }
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to Facebook');
      const isAmbiguous = !err.response && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout'));
      const apiError = err.response?.data?.error?.message || err.message;
      const errorCode = isAmbiguous ? 'AMBIGUOUS_DELIVERY' : (err.response?.status || err.code || 'FACEBOOK_API_ERROR');
      return {
        success: false,
        errorMessage: isAmbiguous ? `AMBIGUOUS_DELIVERY: ${apiError}` : `Facebook API error: ${apiError}`,
        errorCode,
        platformResponse: err.response?.data,
      };
    }
  },

  async checkHealth(accessToken: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return true;
    const apiVersion = env.META_GRAPH_API_VERSION || 'v20.0';
    await axios.get(`https://graph.facebook.com/${apiVersion}/me`, {
      params: { fields: 'id', access_token: accessToken }
    });
    return true;
  },

  async refreshToken(refreshToken: string) {
    const appId = env.FACEBOOK_APP_ID || process.env.FACEBOOK_APP_SECRET;
    const appSecret = env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set to refresh Facebook tokens.');
    }

    const apiVersion = env.META_GRAPH_API_VERSION || 'v20.0';
    const res = await axios.get(`https://graph.facebook.com/${apiVersion}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: refreshToken,
      }
    });

    return {
      accessToken: res.data.access_token,
      expiresInSeconds: res.data.expires_in || 5184000,
    };
  }
};

export default facebookAdapter;
