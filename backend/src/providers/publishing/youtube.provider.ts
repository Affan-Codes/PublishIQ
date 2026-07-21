import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';

export const youtubeAdapter: PublishingAdapter = {
  platform: Platform.YouTube,

  validate(content: GeneratedContentData): PlatformLimitViolation[] {
    const violations: PlatformLimitViolation[] = [];

    if (!content.videoUrl) {
      violations.push({
        field: 'videoUrl',
        message: 'YouTube publishing requires a generated video URL asset path.',
      });
    }

    const title = content.caption || '';
    if (title.length > 100) {
      violations.push({
        field: 'title',
        message: 'YouTube title / caption cannot exceed 100 characters.',
        limit: 100,
        actual: title.length,
      });
    }

    return violations;
  },

  async publish(content: GeneratedContentData, connection: PlatformConnectionData): Promise<PublishResult> {
    logger.info({ platform: this.platform }, 'Publishing to YouTube Shorts');

    let accessToken: string;
    try {
      accessToken = decrypt(Buffer.from(connection.accessTokenEnc));
    } catch (err: any) {
      return { success: false, errorMessage: 'Failed to decrypt access token: ' + err.message };
    }

    // Check if it's a test environment for publishing simulation
    if (process.env.NODE_ENV === 'test') {
      logger.info('Simulating YouTube publishing success for test environment');
      const mockId = `yt_video_${Date.now()}`;
      return {
        success: true,
        externalId: mockId,
        platformResponse: {
          id: mockId,
          status: { uploadStatus: 'uploaded', privacyStatus: 'public' },
        },
      };
    }

    try {
      const videoFilePath = path.resolve(env.MEDIA_ROOT, content.videoUrl!);
      if (!fs.existsSync(videoFilePath)) {
        return { success: false, errorMessage: `Video file not found locally at: ${videoFilePath}` };
      }

      // Build Title and Description
      const rawTitle = content.caption || 'Daily Wisdom';
      const cleanTitle = rawTitle.slice(0, 100);
      const description = `${rawTitle}\n\n#Shorts #Wisdom #Quotes`;

      // Extract tags
      const tags = Array.isArray(content.hashtags) ? content.hashtags : [];

      // Google Multipart/Related Upload
      const metadata = {
        snippet: {
          title: cleanTitle,
          description,
          tags,
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: 'public', // Default public for shorts
          selfDeclaredMadeForKids: false,
        },
      };

      const boundary = '-------314159265358979323846';
      const metadataPart = [
        `\r\n--${boundary}\r\n`,
        `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
        JSON.stringify(metadata),
        `\r\n`
      ].join('');

      const mediaHeader = [
        `--${boundary}\r\n`,
        `Content-Type: video/mp4\r\n\r\n`
      ].join('');

      const mediaFooter = `\r\n--${boundary}--\r\n`;

      const videoBuffer = fs.readFileSync(videoFilePath);

      // Concatenate parts: metadata header + video file buffer + footer
      const bodyBuffer = Buffer.concat([
        Buffer.from(metadataPart, 'utf8'),
        Buffer.from(mediaHeader, 'utf8'),
        videoBuffer,
        Buffer.from(mediaFooter, 'utf8')
      ]);

      const response = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
        bodyBuffer,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      return {
        success: true,
        externalId: response.data.id,
        platformResponse: response.data,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to YouTube');
      const apiError = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        errorMessage: `YouTube API error: ${apiError}`,
        platformResponse: err.response?.data,
      };
    }
  },

  async checkHealth(accessToken: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return true;
    await axios.get('https://www.googleapis.com/oauth2/v3/tokeninfo', {
      params: { access_token: accessToken }
    });
    return true;
  },

  async refreshToken(refreshToken: string) {
    const res = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }
    });

    return {
      accessToken: res.data.access_token,
      expiresInSeconds: res.data.expires_in || 3600,
    };
  }
};

export default youtubeAdapter;
