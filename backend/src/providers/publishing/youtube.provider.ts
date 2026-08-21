import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';

/**
 * Uploads a video file stream directly from a remote Cloudinary URL to YouTube via a resumable upload session location URL.
 * If a network disconnect occurs mid-transfer, it queries Google for the received byte range
 * and resumes streaming from Cloudinary using an HTTP Range header (bytes=${offset}-).
 */
async function uploadStreamWithResumption(uploadUrl: string, videoUrl: string, fileSize: number): Promise<any> {
  let offset = 0;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      if (offset === 0) {
        logger.info({ videoUrl, fileSize, attempt: attempts }, 'Streaming video from Cloudinary to YouTube resumable upload endpoint');
        const remoteStreamRes = await axios.get(videoUrl, { responseType: 'stream' });
        const response = await axios.put(uploadUrl, remoteStreamRes.data, {
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': 'video/mp4',
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: (status) => status === 200 || status === 201 || status === 308,
        });

        if (response.status === 200 || response.status === 201) {
          return response.data;
        }
      } else {
        const remainingBytes = fileSize - offset;
        logger.info({ offset, remainingBytes, attempt: attempts }, 'Resuming YouTube video upload stream from Cloudinary byte offset using Range header');
        const remoteStreamRes = await axios.get(videoUrl, {
          headers: { Range: `bytes=${offset}-` },
          responseType: 'stream',
        });

        const response = await axios.put(uploadUrl, remoteStreamRes.data, {
          headers: {
            'Content-Length': remainingBytes.toString(),
            'Content-Range': `bytes ${offset}-${fileSize - 1}/${fileSize}`,
            'Content-Type': 'video/mp4',
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: (status) => status === 200 || status === 201 || status === 308,
        });

        if (response.status === 200 || response.status === 201) {
          return response.data;
        }
      }
    } catch (putErr: any) {
      logger.warn({ err: putErr.message, attempt: attempts }, 'Network exception during YouTube stream upload. Querying session status to resume...');
    }

    // Query Google for uploaded byte status (per YouTube Resumable Upload specification)
    try {
      const statusRes = await axios.put(uploadUrl, null, {
        headers: {
          'Content-Length': '0',
          'Content-Range': `bytes */${fileSize}`,
        },
        validateStatus: (status) => status === 308 || status === 200 || status === 201,
      });

      if (statusRes.status === 200 || statusRes.status === 201) {
        return statusRes.data;
      }

      if (statusRes.status === 308) {
        const rangeHeader = statusRes.headers['range']; // e.g., "bytes=0-1048575"
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            offset = parseInt(match[1], 10) + 1;
            logger.info({ offset, rangeHeader }, 'Google confirmed received bytes. Resuming stream from byte offset');
            continue;
          }
        }
        offset = 0;
      }
    } catch (queryErr: any) {
      logger.error({ err: queryErr.message }, 'Failed to query YouTube upload session status for byte resumption');
      throw queryErr;
    }
  }

  throw new Error(`YouTube resumable stream upload failed after ${maxAttempts} resumption attempts.`);
}

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
    logger.info({ platform: this.platform }, 'Publishing to YouTube Shorts via Resumable Upload from Cloudinary');

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
      const videoUrl = content.videoUrl!;

      // Determine size of remote video file on Cloudinary
      let fileSize = 0;
      try {
        const headRes = await axios.head(videoUrl);
        const contentLengthHeader = headRes.headers['content-length'];
        if (contentLengthHeader) {
          fileSize = parseInt(String(contentLengthHeader), 10);
        }
      } catch (headErr: any) {
        logger.debug({ videoUrl, err: headErr.message }, 'HEAD request failed for Cloudinary video, falling back to GET for size');
      }

      if (!fileSize) {
        const getRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        fileSize = getRes.data.length;
      }

      if (!fileSize) {
        return {
          success: false,
          errorMessage: `Unable to determine file size for remote video URL: ${videoUrl}`,
          errorCode: 'INVALID_REMOTE_MEDIA',
        };
      }

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
      logger.info({ fileSize, privacyStatus }, 'Initiating YouTube resumable upload session for Cloudinary asset');
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

      logger.info('YouTube resumable upload session created. Uploading video stream directly from Cloudinary...');

      // Step 2 & Resumption: Stream file from Cloudinary to uploadUrl with byte-offset query resumption
      const uploadResultData = await uploadStreamWithResumption(uploadUrl, videoUrl, fileSize);

      logger.info({ videoId: uploadResultData?.id }, 'YouTube video upload completed successfully from Cloudinary');

      return {
        success: true,
        externalId: uploadResultData?.id,
        platformResponse: uploadResultData,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to YouTube');
      const httpStatus = err.response?.status;
      const apiReason = err.response?.data?.error?.errors?.[0]?.reason || err.response?.data?.error?.status;
      const apiMessage = err.response?.data?.error?.message || err.message;
      const isAmbiguous = !err.response && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout'));
      const errorCode = isAmbiguous ? 'AMBIGUOUS_DELIVERY' : (apiReason || httpStatus || 'YOUTUBE_API_ERROR');

      return {
        success: false,
        errorMessage: isAmbiguous ? `AMBIGUOUS_DELIVERY: ${apiMessage}` : `YouTube API error (${errorCode}): ${apiMessage}`,
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

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await axios.post('https://oauth2.googleapis.com/token', tokenParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return {
      accessToken: res.data.access_token,
      expiresInSeconds: res.data.expires_in || 3600,
    };
  }
};

export default youtubeAdapter;
