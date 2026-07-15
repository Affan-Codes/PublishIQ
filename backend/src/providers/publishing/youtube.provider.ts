import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export const youtubeAdapter: PublishingAdapter = {
  platform: Platform.YouTube,

  validate(content: GeneratedContentData): PlatformLimitViolation[] {
    const violations: PlatformLimitViolation[] = [];

    // YouTube requires a video upload
    if (!content.videoUrl) {
      violations.push({
        field: 'videoUrl',
        message: 'YouTube publishing requires a generated video URL asset path.',
      });
    }

    // Title limit (taken from caption or text)
    const title = content.caption || content.text;
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
    logger.info({ platform: this.platform, videoUrl: content.videoUrl }, 'Initiating YouTube upload stream');

    // Simulate OAuth check / decryption validation
    if (!connection.accessTokenEnc || connection.accessTokenEnc.length === 0) {
      return {
        success: false,
        errorMessage: 'Invalid or missing YouTube authorization connection tokens',
      };
    }

    try {
      // Return mock publishing success payload for Milestone 1 pipeline
      const mockExternalId = `yt_video_${Date.now()}`;
      return {
        success: true,
        externalId: mockExternalId,
        platformResponse: {
          kind: 'youtube#video',
          id: mockExternalId,
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public',
          },
        },
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to YouTube');
      return {
        success: false,
        errorMessage: err.message || 'Unknown YouTube publishing exception occurred',
      };
    }
  },
};

export default youtubeAdapter;
