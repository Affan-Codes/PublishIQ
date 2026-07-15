import { PublishingAdapter, GeneratedContentData, PlatformConnectionData, PublishResult, PlatformLimitViolation } from './publishing.interface.js';
import { Platform } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export const instagramAdapter: PublishingAdapter = {
  platform: Platform.Instagram,

  validate(content: GeneratedContentData): PlatformLimitViolation[] {
    const violations: PlatformLimitViolation[] = [];

    // Instagram requires either an image or a video
    if (!content.imageUrl && !content.videoUrl) {
      violations.push({
        field: 'media',
        message: 'Instagram publishing requires either a generated image or video URL asset path.',
      });
    }

    // Caption limit
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
    logger.info({ platform: this.platform, mediaUrl: content.imageUrl || content.videoUrl }, 'Initiating Instagram media sharing upload');

    // Simulate OAuth check / decryption validation
    if (!connection.accessTokenEnc || connection.accessTokenEnc.length === 0) {
      return {
        success: false,
        errorMessage: 'Invalid or missing Instagram authorization connection tokens',
      };
    }

    try {
      // Return mock publishing success payload for Milestone 1 pipeline
      const mockExternalId = `ig_post_${Date.now()}`;
      return {
        success: true,
        externalId: mockExternalId,
        platformResponse: {
          id: mockExternalId,
          media_type: content.videoUrl ? 'VIDEO' : 'IMAGE',
          status: 'PUBLISHED',
        },
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to publish to Instagram');
      return {
        success: false,
        errorMessage: err.message || 'Unknown Instagram publishing exception occurred',
      };
    }
  },
};

export default instagramAdapter;
