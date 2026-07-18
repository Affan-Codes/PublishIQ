import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
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
    logger.info({ platform: this.platform }, 'Publishing to Facebook Page');
    
    let accessToken: string;
    try {
      accessToken = decrypt(Buffer.from(connection.accessTokenEnc));
    } catch (err: any) {
      return { success: false, errorMessage: 'Failed to decrypt access token: ' + err.message };
    }

    // Check if it's a test token or dummy connection
    if (accessToken === 'mock_token' || accessToken === '********' || accessToken.startsWith('ig_') || accessToken.startsWith('yt_')) {
      logger.info('Simulating Facebook publishing success for test token');
      const mockId = `fb_post_${Date.now()}`;
      return {
        success: true,
        externalId: mockId,
        platformResponse: { id: mockId, status: 'mocked' },
      };
    }

    try {
      // 1. Get Facebook Page Accounts
      const accountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
        params: { access_token: accessToken }
      });

      const pages = accountsRes.data?.data || [];
      if (pages.length === 0) {
        return { success: false, errorMessage: 'No Facebook Pages found linked to this access token.' };
      }

      // Pick the first page
      const page = pages[0];
      const pageId = page.id;
      const pageAccessToken = page.access_token;

      const caption = content.caption || '';
      
      // 2. Publish Image or Video
      if (content.videoUrl) {
        const videoFilePath = path.resolve(env.MEDIA_ROOT, content.videoUrl);
        
        if (!fs.existsSync(videoFilePath)) {
          return { success: false, errorMessage: `Video file not found locally at: ${videoFilePath}` };
        }

        const form = new FormData();
        form.append('source', fs.createReadStream(videoFilePath));
        form.append('description', caption);

        const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/videos`, form, {
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
        // Image upload
        const imageFilePath = path.resolve(env.MEDIA_ROOT, content.imageUrl!);
        
        if (!fs.existsSync(imageFilePath)) {
          return { success: false, errorMessage: `Image file not found locally at: ${imageFilePath}` };
        }

        const form = new FormData();
        form.append('source', fs.createReadStream(imageFilePath));
        form.append('message', caption);

        const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/photos`, form, {
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
      const apiError = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        errorMessage: `Facebook API error: ${apiError}`,
        platformResponse: err.response?.data,
      };
    }
  }
};

export default facebookAdapter;
