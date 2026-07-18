import { prisma } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { getPublishingAdapter } from '../providers/publishing/index.js';
import { PlatformConnection, Platform, PublishRecordStatus, PublishStatus, Job, Prisma } from '@prisma/client';
import { decrypt, encrypt } from '../utils/crypto.js';
import axios from 'axios';
import { env } from '../config/env.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/custom-errors.js';
import eventBus from '../events/event-bus.js';

export const publishingService = {
  /**
   * Publishes media generated in a content pipeline job to all connected platforms.
   */
  async publishJobContent(jobId: string): Promise<void> {
    logger.info({ jobId }, 'Initiating publishing phase for Content Pipeline Job');

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        channel: {
          include: {
            platformConnections: {
              include: {
                platformConnection: true
              }
            }
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundError(`Job not found: ${jobId}`);
    }

    const channel = job.channel;
    if (!channel) {
      logger.warn({ jobId }, 'Job does not have a linked channel. Skipping publish.');
      return;
    }

    const generatedContent = await prisma.generatedContent.findFirst({
      where: { jobId },
    });

    if (!generatedContent) {
      throw new ValidationError(`No generated content output found for Job ${jobId}`);
    }

    const connections = channel.platformConnections.map(pc => pc.platformConnection);
    if (connections.length === 0) {
      logger.info({ jobId, channelId: channel.id }, 'No platform connections found for channel. Publishing complete.');
      return;
    }

    let anyFailure = false;

    for (const connection of connections) {
      const platform = connection.platform;
      const adapter = getPublishingAdapter(platform);

      logger.info({ jobId, platform, connectionId: connection.id }, 'Publishing to platform');

      // 1. Validate platform limits
      const violations = adapter.validate({
        text: generatedContent.text,
        imageUrl: generatedContent.imageUrl,
        videoUrl: generatedContent.videoUrl,
        caption: generatedContent.caption,
        hashtags: generatedContent.hashtags,
      });

      if (violations.length > 0) {
        const errorMsg = `Platform limits violation: ${violations.map(v => v.message).join(', ')}`;
        logger.error({ jobId, platform, violations }, errorMsg);
        
        await prisma.publishingRecord.create({
          data: {
            workspaceId: job.workspaceId,
            jobId: job.id,
            channelId: channel.id,
            platformConnectionId: connection.id,
            contentTypeSnapshot: channel.contentProfileId, // snapshot content profile reference
            status: PublishRecordStatus.Failure,
            publishedAt: new Date(),
            platform: platform,
            generatedContentId: generatedContent.id,
            errorDetails: errorMsg,
            retries: 0,
          }
        });

        anyFailure = true;
        continue;
      }

      // 2. Ensure connection health / Token Validation & Refresh
      try {
        await this.ensureConnectionHealth(connection);
      } catch (err: any) {
        const errorMsg = `Connection health check failed: ${err.message}`;
        logger.error({ connectionId: connection.id, err }, errorMsg);

        await prisma.publishingRecord.create({
          data: {
            workspaceId: job.workspaceId,
            jobId: job.id,
            channelId: channel.id,
            platformConnectionId: connection.id,
            contentTypeSnapshot: channel.contentProfileId,
            status: PublishRecordStatus.Failure,
            publishedAt: new Date(),
            platform: platform,
            generatedContentId: generatedContent.id,
            errorDetails: errorMsg,
            retries: 0,
          }
        });

        anyFailure = true;
        continue;
      }

      // Reload fresh connection tokens (in case refresh occurred)
      const freshConnection = await prisma.platformConnection.findUnique({
        where: { id: connection.id }
      });
      if (!freshConnection) throw new Error('Connection lost.');

      const startTime = Date.now();
      let publishRetries = 0;
      let success = false;
      let externalId: string | undefined;
      let platformResponse: any;
      let lastErrorMessage = '';

      const maxPublishRetries = 3;

      while (!success && publishRetries <= maxPublishRetries) {
        try {
          const res = await adapter.publish(
            {
              text: generatedContent.text,
              imageUrl: generatedContent.imageUrl,
              videoUrl: generatedContent.videoUrl,
              caption: generatedContent.caption,
              hashtags: generatedContent.hashtags,
            },
            {
              accessTokenEnc: freshConnection.accessTokenEnc,
              refreshTokenEnc: freshConnection.refreshTokenEnc,
              expiresAt: freshConnection.expiresAt,
            }
          );

          if (res.success) {
            success = true;
            externalId = res.externalId;
            platformResponse = res.platformResponse;
          } else {
            lastErrorMessage = res.errorMessage || 'Publish failed without details';
            platformResponse = res.platformResponse;
            
            // Check if transient error
            if (this.isTransientError(lastErrorMessage)) {
              publishRetries++;
              logger.warn({ jobId, platform, lastErrorMessage, attempt: publishRetries }, 'Transient publishing error, retrying...');
              await new Promise(resolve => setTimeout(resolve, 2000 * publishRetries));
            } else {
              break; // Permanent failure
            }
          }
        } catch (err: any) {
          lastErrorMessage = err.message || 'Unknown error occurred during publish call';
          if (this.isTransientError(lastErrorMessage)) {
            publishRetries++;
            logger.warn({ jobId, platform, lastErrorMessage, attempt: publishRetries }, 'Transient exception, retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000 * publishRetries));
          } else {
            break;
          }
        }
      }

      const duration = Date.now() - startTime;

      // 3. Persist Publishing Record
      await prisma.publishingRecord.create({
        data: {
          workspaceId: job.workspaceId,
          jobId: job.id,
          channelId: channel.id,
          platformConnectionId: connection.id,
          contentTypeSnapshot: channel.contentProfileId,
          status: success ? PublishRecordStatus.Success : PublishRecordStatus.Failure,
          publishedAt: new Date(),
          platform: platform,
          generatedContentId: generatedContent.id,
          publishedUrl: success ? this.getPublishedUrl(platform, externalId, platformResponse) : null,
          platformPostId: externalId || null,
          duration,
          retries: publishRetries,
          providerMetadata: platformResponse ? (platformResponse as Prisma.InputJsonValue) : Prisma.JsonNull,
          errorDetails: success ? null : lastErrorMessage,
        }
      });

      if (!success) {
        anyFailure = true;
        // Emit failed event
        await eventBus.emitDomainEvent(
          job.workspaceId,
          'PublishFailed',
          { jobId: job.id, platform, error: lastErrorMessage },
          job.id
        );
      } else {
        // Emit success event
        await eventBus.emitDomainEvent(
          job.workspaceId,
          'PublishSucceeded',
          { jobId: job.id, platform, platformPostId: externalId },
          job.id
        );
      }
    }

    // 4. Update GeneratedContent publish status
    await prisma.generatedContent.update({
      where: { id: generatedContent.id },
      data: {
        publishStatus: anyFailure ? PublishStatus.PublishFailed : PublishStatus.Published,
      }
    });

    if (anyFailure) {
      throw new Error('Publishing failed on one or more target platform connections.');
    }
  },

  /**
   * Publishes an existing GeneratedContent manually.
   */
  async republishContent(generatedContentId: string, channelId: string, workspaceId: string): Promise<void> {
    const generatedContent = await prisma.generatedContent.findUnique({
      where: { id: generatedContentId, workspaceId },
      include: { job: true }
    });

    if (!generatedContent) {
      throw new NotFoundError('Generated content not found');
    }

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      include: {
        platformConnections: {
          include: { platformConnection: true }
        }
      }
    });

    if (!channel) {
      throw new NotFoundError('Target channel not found');
    }

    const connections = channel.platformConnections.map(pc => pc.platformConnection);
    if (connections.length === 0) {
      throw new ValidationError('No active platform connections linked to this channel.');
    }

    logger.info({ generatedContentId, channelId }, 'Operator triggered manual republish of content');

    // Create a new Job to track this republish attempt
    const republishJob = await prisma.job.create({
      data: {
        workspaceId,
        jobType: 'RetryPublish',
        channelId: channel.id,
        contentProfileId: channel.contentProfileId,
        pipelineStage: 'Publishing',
        generatedText: generatedContent.text,
        imageUrl: generatedContent.imageUrl,
        videoUrl: generatedContent.videoUrl,
        caption: generatedContent.caption,
        hashtags: (generatedContent.hashtags as Prisma.InputJsonValue) || Prisma.JsonNull,
        configSnapshot: {
          originalJobId: generatedContent.jobId,
          republishTrigger: 'manual'
        }
      }
    });

    // Link the generated content to the job
    await prisma.generatedContent.update({
      where: { id: generatedContent.id },
      data: { jobId: republishJob.id }
    });

    // Run the publish process using the new Job context
    try {
      await this.publishJobContent(republishJob.id);
      
      await prisma.job.update({
        where: { id: republishJob.id },
        data: { pipelineStage: 'Completed' }
      });
    } catch (err: any) {
      await prisma.job.update({
        where: { id: republishJob.id },
        data: {
          pipelineStage: 'Failed',
          failedAt: new Date(),
          failureReason: err.message,
          failureStage: 'Publishing'
        }
      });
      throw err;
    }
  },

  /**
   * Retries a single failed publishing record.
   */
  async retryPublishRecord(publishRecordId: string, workspaceId: string): Promise<void> {
    const record = await prisma.publishingRecord.findUnique({
      where: { id: publishRecordId, workspaceId },
      include: {
        generatedContent: true,
        platformConnection: true,
        channel: true,
        job: true,
      }
    });

    if (!record) {
      throw new NotFoundError('Publishing record not found');
    }

    if (record.status === PublishRecordStatus.Success) {
      throw new ConflictError('This publishing record has already succeeded.');
    }

    const generatedContent = record.generatedContent;
    if (!generatedContent) {
      throw new ValidationError('No generated content linked to this publishing record.');
    }

    logger.info({ publishRecordId }, 'Operator triggered manual retry for failed publishing record');

    const platform = record.platform;
    const adapter = getPublishingAdapter(platform);
    const connection = record.platformConnection;

    // Validate limits
    const violations = adapter.validate({
      text: generatedContent.text,
      imageUrl: generatedContent.imageUrl,
      videoUrl: generatedContent.videoUrl,
      caption: generatedContent.caption,
      hashtags: generatedContent.hashtags,
    });

    if (violations.length > 0) {
      throw new ValidationError(`Platform limits violation: ${violations.map(v => v.message).join(', ')}`);
    }

    // Ensure connection health
    await this.ensureConnectionHealth(connection);

    // Reload connection tokens
    const freshConnection = await prisma.platformConnection.findUnique({
      where: { id: connection.id }
    });
    if (!freshConnection) throw new Error('Connection lost.');

    const startTime = Date.now();
    const res = await adapter.publish(
      {
        text: generatedContent.text,
        imageUrl: generatedContent.imageUrl,
        videoUrl: generatedContent.videoUrl,
        caption: generatedContent.caption,
        hashtags: generatedContent.hashtags,
      },
      {
        accessTokenEnc: freshConnection.accessTokenEnc,
        refreshTokenEnc: freshConnection.refreshTokenEnc,
        expiresAt: freshConnection.expiresAt,
      }
    );

    const duration = Date.now() - startTime;

    if (res.success) {
      // Update record to Success
      await prisma.publishingRecord.update({
        where: { id: record.id },
        data: {
          status: PublishRecordStatus.Success,
          publishedUrl: this.getPublishedUrl(platform, res.externalId, res.platformResponse),
          platformPostId: res.externalId || null,
          duration,
          retries: record.retries + 1,
          providerMetadata: res.platformResponse ? (res.platformResponse as Prisma.InputJsonValue) : Prisma.JsonNull,
          errorDetails: null,
          publishedAt: new Date(),
        }
      });

      // Recalculate compile/publish status for the content
      const siblingFailures = await prisma.publishingRecord.count({
        where: {
          jobId: record.jobId,
          status: PublishRecordStatus.Failure,
          id: { not: record.id }
        }
      });

      if (siblingFailures === 0) {
        await prisma.generatedContent.update({
          where: { id: generatedContent.id },
          data: { publishStatus: PublishStatus.Published }
        });
        
        await prisma.job.update({
          where: { id: record.jobId },
          data: { pipelineStage: 'Completed' }
        });
      }

      await eventBus.emitDomainEvent(
        workspaceId,
        'PublishSucceeded',
        { jobId: record.jobId, platform, platformPostId: res.externalId, retriedRecordId: record.id },
        record.jobId
      );
    } else {
      // Update retries count and last error
      await prisma.publishingRecord.update({
        where: { id: record.id },
        data: {
          retries: record.retries + 1,
          errorDetails: res.errorMessage || 'Publish failed',
          providerMetadata: res.platformResponse ? (res.platformResponse as Prisma.InputJsonValue) : Prisma.JsonNull,
          publishedAt: new Date(),
        }
      });

      await eventBus.emitDomainEvent(
        workspaceId,
        'PublishFailed',
        { jobId: record.jobId, platform, error: res.errorMessage, retriedRecordId: record.id },
        record.jobId
      );

      throw new Error(`Retry failed: ${res.errorMessage}`);
    }
  },

  /**
   * Helper: Validates tokens, checking health status and triggering refreshes.
   */
  async ensureConnectionHealth(connection: PlatformConnection): Promise<void> {
    const isExpired = new Date() >= connection.expiresAt;
    
    if (isExpired) {
      logger.info({ connectionId: connection.id }, 'Platform Connection tokens expired. Attempting refresh...');
      await this.refreshConnectionTokens(connection.id);
    } else {
      // Basic health ping check
      try {
        const decryptedToken = decrypt(Buffer.from(connection.accessTokenEnc));
        if (decryptedToken === 'mock_token' || decryptedToken === '********' || decryptedToken.startsWith('ig_') || decryptedToken.startsWith('yt_')) {
          return; // Skip actual ping for mock tokens
        }

        if (connection.platform === Platform.YouTube) {
          await axios.get('https://www.googleapis.com/oauth2/v3/tokeninfo', {
            params: { access_token: decryptedToken }
          });
        } else {
          // Meta (Facebook/Instagram) token health ping
          await axios.get('https://graph.facebook.com/v19.0/me', {
            params: { fields: 'id', access_token: decryptedToken }
          });
        }
      } catch (err: any) {
        logger.warn({ connectionId: connection.id, err: err.message }, 'Health check ping failed. Attempting refresh...');
        try {
          await this.refreshConnectionTokens(connection.id);
        } catch (refreshErr) {
          // Set connection status Unhealthy
          await prisma.platformConnection.update({
            where: { id: connection.id },
            data: { healthStatus: 'Unhealthy' }
          });
          throw new Error('Connection unhealthy, and automatic token refresh failed.');
        }
      }
    }
  },

  /**
   * Refreshes access tokens using refresh token credentials.
   */
  async refreshConnectionTokens(connectionId: string): Promise<void> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) throw new NotFoundError('Connection not found');

    const refreshToken = decrypt(Buffer.from(connection.refreshTokenEnc));
    if (!refreshToken || refreshToken === 'mock_token' || refreshToken === '********') {
      throw new Error('No refresh token available.');
    }

    try {
      if (connection.platform === Platform.YouTube) {
        const res = await axios.post('https://oauth2.googleapis.com/token', null, {
          params: {
            client_id: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }
        });

        const newAccessToken = res.data.access_token;
        const expiresInSeconds = res.data.expires_in || 3600;
        const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        await prisma.platformConnection.update({
          where: { id: connectionId },
          data: {
            accessTokenEnc: encrypt(newAccessToken) as any,
            expiresAt: newExpiresAt,
            healthStatus: 'Healthy'
          }
        });
      } else {
        // Facebook Page / Instagram user long-lived token exchange refresh (expires every 60 days)
        const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.FACEBOOK_APP_ID || 'dummy_app_id',
            client_secret: process.env.FACEBOOK_APP_SECRET || 'dummy_app_secret',
            exchange_token: refreshToken,
          }
        });

        const newAccessToken = res.data.access_token;
        const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now

        await prisma.platformConnection.update({
          where: { id: connectionId },
          data: {
            accessTokenEnc: encrypt(newAccessToken) as any,
            expiresAt: newExpiresAt,
            healthStatus: 'Healthy'
          }
        });
      }
      logger.info({ connectionId }, 'Successfully refreshed platform connection tokens');
    } catch (err: any) {
      logger.error({ connectionId, err }, 'Failed to refresh tokens');
      throw new Error(`Token refresh failed: ${err.message}`);
    }
  },

  /**
   * Helper: Resolves public post URL per platform.
   */
  getPublishedUrl(platform: Platform, externalId?: string, platformResponse?: any): string | null {
    if (!externalId) return null;
    switch (platform) {
      case Platform.YouTube:
        return `https://www.youtube.com/shorts/${externalId}`;
      case Platform.Instagram:
        return `https://www.instagram.com/p/${externalId}`;
      case Platform.Facebook:
        return `https://www.facebook.com/${externalId}`;
      default:
        return null;
    }
  },

  /**
   * Helper: Determine if error is a transient network/rate-limiting issue.
   */
  isTransientError(message: string): boolean {
    const lowercase = message.toLowerCase();
    return (
      lowercase.includes('rate limit') ||
      lowercase.includes('429') ||
      lowercase.includes('timeout') ||
      lowercase.includes('network error') ||
      lowercase.includes('socket hang up') ||
      lowercase.includes('econnreset') ||
      lowercase.includes('temporary') ||
      lowercase.includes('service unavailable') ||
      lowercase.includes('503')
    );
  }
};

export default publishingService;
