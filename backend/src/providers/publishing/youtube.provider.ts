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

  async publish(content: GeneratedContentData, connection: PlatformConnectionData, options?: { privacyStatus?: string }): Promise<PublishResult> {
    logger.info({ platform: this.platform }, 'Publishing to YouTube Shorts via Resumable Upload');

    let accessToken: string;
    try {
      accessToken = decrypt(Buffer.from(connection.accessTokenEnc));
    } catch (err: any) {
      return {
        success: false,
        errorMessage: 'Failed to decrypt access token: ' + err.message,
        errorCode: 'DECRYPTION_ERROR',
      };
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
          status: { uploadStatus: 'uploaded', privacyStatus: options?.privacyStatus || content.privacyStatus || 'public' },
        },
      };
    }

    try {
      const videoFilePath = path.resolve(env.MEDIA_ROOT, content.videoUrl!);
      if (!fs.existsSync(videoFilePath)) {
        return {
          success: false,
          errorMessage: `Video file not found locally at: ${videoFilePath}`,
          errorCode: 'FILE_NOT_FOUND',
        };
      }

      const fileStat = fs.statSync(videoFilePath);
      const fileSize = fileStat.size;

      // Build Title and Description
      const rawTitle = content.caption || 'Daily Wisdom';
      const cleanTitle = rawTitle.slice(0, 100);
      const description = `${rawTitle}\n\n#Shorts #Wisdom #Quotes`;

      // Extract tags
      const tags = Array.isArray(content.hashtags) ? content.hashtags : [];

      // Determine privacy status (YT-009 fix)
      const privacyStatus = options?.privacyStatus || content.privacyStatus || 'public';

      // Metadata payload for YouTube API
      const metadata = {
        snippet: {
          title: cleanTitle,
          description,
          tags,
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      };

      // Step 1: Initiate YouTube Resumable Upload session (YT-003 fix)
      logger.info({ fileSize, privacyStatus }, 'Initiating YouTube resumable upload session');
      const initResponse = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        metadata,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': fileSize.toString(),
            'X-Upload-Content-Type': 'video/mp4',
          },
        }
      );

      const uploadUrl = initResponse.headers['location'];
      if (!uploadUrl) {
        return {
          success: false,
          errorMessage: 'YouTube API did not return a resumable upload location URI',
          errorCode: 'MISSING_UPLOAD_LOCATION',
        };
      }

      logger.info('YouTube resumable upload session created. Uploading video stream...');

      // Step 2: Upload video content via stream (YT-003 fix)
      const fileStream = fs.createReadStream(videoFilePath);
      const uploadResponse = await axios.put(uploadUrl, fileStream, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      logger.info({ videoId: uploadResponse.data?.id }, 'YouTube video upload completed successfully');

      return {
        success: true,
        externalId: uploadResponse.data?.id,
        platformResponse: uploadResponse.data,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to YouTube');
      const httpStatus = err.response?.status;
      const apiReason = err.response?.data?.error?.errors?.[0]?.reason || err.response?.data?.error?.status;
      const apiMessage = err.response?.data?.error?.message || err.message;
      const errorCode = apiReason || httpStatus || 'YOUTUBE_API_ERROR';

      return {
        success: false,
        errorMessage: `YouTube API error (${errorCode}): ${apiMessage}`,
        errorCode,
        platformResponse: err.response?.data,
      };
    }
  },

  async checkHealth(accessToken: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return true;
    
    // YT-010 fix: Use authenticated YouTube Data API endpoint (GET /channels?part=id&mine=true) with Authorization header
    await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'id', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return true;
  },

  async refreshToken(refreshToken: string) {
    const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to refresh Google tokens.');
    }

    const res = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
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
