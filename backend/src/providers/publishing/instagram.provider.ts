import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';

export const instagramAdapter: PublishingAdapter = {
  platform: Platform.Instagram,

  validate(content: GeneratedContentData): PlatformLimitViolation[] {
    const violations: PlatformLimitViolation[] = [];

    if (!content.imageUrl && !content.videoUrl) {
      violations.push({
        field: 'media',
        message: 'Instagram publishing requires either a generated image or video URL asset path.',
      });
    }

    const caption = content.caption || '';
    if (caption.length > 2200) {
      violations.push({
        field: 'caption',
        message: 'Instagram captions cannot exceed 2200 characters.',
        limit: 2200,
        actual: caption.length,
      });
    }

    return violations;
  },

  async publish(content: GeneratedContentData, connection: PlatformConnectionData): Promise<PublishResult> {
    logger.info({ platform: this.platform }, 'Publishing to Instagram Business Account');

    let accessToken: string;
    try {
      accessToken = decrypt(Buffer.from(connection.accessTokenEnc));
    } catch (err: any) {
      return { success: false, errorMessage: 'Failed to decrypt access token: ' + err.message };
    }

    // Check if it's a test environment for publishing simulation
    if (process.env.NODE_ENV === 'test') {
      logger.info('Simulating Instagram publishing success for test environment');
      const mockId = `ig_media_${Date.now()}`;
      return {
        success: true,
        externalId: mockId,
        platformResponse: { id: mockId, status: 'mocked' },
      };
    }

    try {
      // 1. Resolve Connected Instagram Business Account ID
      const accountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
        params: { access_token: accessToken }
      });

      const pages = accountsRes.data?.data || [];
      if (pages.length === 0) {
        return { success: false, errorMessage: 'No Facebook Pages found linked to this access token.' };
      }

      // Query connected IG account for the first page
      const firstPage = pages[0];
      const pageId = firstPage.id;
      const pageAccessToken = firstPage.access_token;

      const pageDetailsRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: pageAccessToken
        }
      });

      const instagramBusinessAccountId = pageDetailsRes.data?.instagram_business_account?.id;
      if (!instagramBusinessAccountId) {
        return { success: false, errorMessage: `No Instagram Business Account connected to Facebook Page: ${firstPage.name}` };
      }

      const caption = content.caption || '';
      
      // Determine media URL (needs to be public)
      const mediaPath = content.videoUrl || content.imageUrl;
      // Strip leading './' from mediaPath if it exists
      const cleanedPath = mediaPath?.replace(/^\.\//, '') || '';
      const publicMediaUrl = `${env.APP_BASE_URL}/${cleanedPath}`;

      logger.info({ publicMediaUrl }, 'Resolved public media URL for Instagram download');

      let igContainerId: string;

      // 2. Create Media Container
      if (content.videoUrl) {
        // Video Reels Container
        const containerRes = await axios.post(
          `https://graph.facebook.com/v19.0/${instagramBusinessAccountId}/media`,
          null,
          {
            params: {
              media_type: 'REELS',
              video_url: publicMediaUrl,
              caption,
              share_to_feed: 'true',
              access_token: pageAccessToken,
            }
          }
        );
        igContainerId = containerRes.data.id;

        // Poll container status until ready
        logger.info({ igContainerId }, 'Created Reels container, starting status polling');
        let ready = false;
        let attempts = 0;
        const maxAttempts = 30; // 2.5 minutes maximum wait time
        
        while (!ready && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          attempts++;
          
          const statusRes = await axios.get(`https://graph.facebook.com/v19.0/${igContainerId}`, {
            params: {
              fields: 'status_code,status,error_info',
              access_token: pageAccessToken
            }
          });

          const statusCode = statusRes.data.status_code;
          logger.debug({ igContainerId, statusCode }, 'Reels container polling tick');
          
          if (statusCode === 'FINISHED') {
            ready = true;
          } else if (statusCode === 'ERROR') {
            const errInfo = statusRes.data.error_info || 'Unknown Reels container compilation error';
            throw new Error(`Instagram Reels processing failed: ${JSON.stringify(errInfo)}`);
          }
        }

        if (!ready) {
          throw new Error('Timeout waiting for Instagram Reels container processing to finish.');
        }
      } else {
        // Image Container
        const containerRes = await axios.post(
          `https://graph.facebook.com/v19.0/${instagramBusinessAccountId}/media`,
          null,
          {
            params: {
              image_url: publicMediaUrl,
              caption,
              access_token: pageAccessToken,
            }
          }
        );
        igContainerId = containerRes.data.id;
      }

      // 3. Publish Media Container
      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${instagramBusinessAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: igContainerId,
            access_token: pageAccessToken,
          }
        }
      );

      return {
        success: true,
        externalId: publishRes.data.id,
        platformResponse: publishRes.data,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to Instagram');
      const apiError = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        errorMessage: `Instagram API error: ${apiError}`,
        platformResponse: err.response?.data,
      };
    }
  },

  async checkHealth(accessToken: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return true;
    await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { fields: 'id', access_token: accessToken }
    });
    return true;
  },

  async refreshToken(refreshToken: string) {
    const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID || 'dummy_app_id',
        client_secret: process.env.FACEBOOK_APP_SECRET || 'dummy_app_secret',
        fb_exchange_token: refreshToken,
      }
    });

    return {
      accessToken: res.data.access_token,
      expiresInSeconds: res.data.expires_in || 5184000,
    };
  }
};

export default instagramAdapter;
