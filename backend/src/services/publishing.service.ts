import { logger } from '../utils/logger.js';
import { getPublishingAdapter } from '../providers/publishing/index.js';
import { PlatformConnection, Platform, PublishRecordStatus, PublishStatus, Job, Prisma, PipelineStage } from '@prisma/client';
import { decrypt, encrypt } from '../utils/crypto.js';
import axios from 'axios';
import { env } from '../config/env.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/custom-errors.js';
import eventBus from '../events/event-bus.js';
import { jobRepository } from '../repositories/job.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { publishingRecordRepository } from '../repositories/publishingRecord.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';

export const publishingService = {
  /**
   * Publishes media generated in a content pipeline job to all connected platforms.
   */
  async publishJobContent(jobId: string): Promise<void> {
    logger.info({ jobId }, 'Initiating publishing phase for Content Pipeline Job');

    const job = await jobRepository.getJobForPublishing(jobId);

    if (!job) {
      throw new NotFoundError(`Job not found: ${jobId}`);
    }

    const channel = job.channel;
    if (!channel) {
      logger.warn({ jobId }, 'Job does not have a linked channel. Skipping publish.');
      return;
    }

    const generatedContent = await generatedContentRepository.findByJobId(jobId);

    if (!generatedContent) {
      throw new ValidationError(`No generated content output found for Job ${jobId}`);
    }

    const connections = channel.platformConnections.map(pc => pc.platformConnection);
    if (connections.length === 0) {
      logger.info({ jobId, channelId: channel.id }, 'No platform connections found for channel. Publishing complete.');
      return;
    }

    const contentTypeSnapshot = (channel as any).contentProfile?.contentType?.name || 'Unknown';

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
        
        await publishingRecordRepository.create({
          workspaceId: job.workspaceId,
          jobId: job.id,
          channelId: channel.id,
          platformConnectionId: connection.id,
          contentTypeSnapshot, // snapshot Content Type name (fixes DB-001)
          status: PublishRecordStatus.Failure,
          publishedAt: new Date(),
          platform: platform,
          generatedContentId: generatedContent.id,
          errorDetails: errorMsg,
          retries: 0,
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

        await publishingRecordRepository.create({
          workspaceId: job.workspaceId,
          jobId: job.id,
          channelId: channel.id,
          platformConnectionId: connection.id,
          contentTypeSnapshot, // snapshot Content Type name (fixes DB-001)
          status: PublishRecordStatus.Failure,
          publishedAt: new Date(),
          platform: platform,
          generatedContentId: generatedContent.id,
          errorDetails: errorMsg,
          retries: 0,
        });

        anyFailure = true;
        continue;
      }

      // Reload fresh connection tokens (in case refresh occurred)
      const freshConnection = await platformConnectionRepository.getById(connection.id);
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
      await publishingRecordRepository.create({
        workspaceId: job.workspaceId,
        jobId: job.id,
        channelId: channel.id,
        platformConnectionId: connection.id,
        contentTypeSnapshot, // snapshot Content Type name (fixes DB-001)
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
    await generatedContentRepository.update(generatedContent.id, {
      publishStatus: anyFailure ? PublishStatus.PublishFailed : PublishStatus.Published,
    });

    if (anyFailure) {
      throw new Error('Publishing failed on one or more target platform connections.');
    }
  },

  /**
   * Publishes an existing GeneratedContent manually.
   */
  async republishContent(generatedContentId: string, channelId: string, workspaceId: string): Promise<void> {
    const generatedContent = await generatedContentRepository.getByIdWithJob(generatedContentId, workspaceId);

    if (!generatedContent) {
      throw new NotFoundError('Generated content not found');
    }

    const channel = await channelRepository.getById(channelId);

    if (!channel) {
      throw new NotFoundError('Target channel not found');
    }

    const connections = channel.platformConnections;
    if (connections.length === 0) {
      throw new ValidationError('No active platform connections linked to this channel.');
    }

    logger.info({ generatedContentId, channelId }, 'Operator triggered manual republish of content');

    // Create a new Job to track this republish attempt
    const republishJob = await jobRepository.createJob({
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
    });

    // Link the generated content to the job
    await generatedContentRepository.update(generatedContent.id, {
      jobId: republishJob.id,
    });

    // Run the publish process using the new Job context
    try {
      await this.publishJobContent(republishJob.id);
      
      await jobRepository.transitionJobStage(republishJob.id, PipelineStage.Completed, {});
    } catch (err: any) {
      await jobRepository.transitionJobStage(republishJob.id, PipelineStage.Failed, {
        failedAt: new Date(),
        failureReason: err.message,
        failureStage: 'Publishing'
      });
      throw err;
    }
  },

  /**
   * Retries a single failed publishing record.
   */
  async retryPublishRecord(publishRecordId: string, workspaceId: string): Promise<void> {
    const record = await publishingRecordRepository.getById(publishRecordId);
    if (!record || record.workspaceId !== workspaceId) {
      throw new NotFoundError('Publishing record not found');
    }

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
    const freshConnection = await platformConnectionRepository.getById(connection.id);
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
      await publishingRecordRepository.update(record.id, {
        status: PublishRecordStatus.Success,
        publishedUrl: this.getPublishedUrl(platform, res.externalId, res.platformResponse),
        platformPostId: res.externalId || null,
        duration,
        retries: record.retries + 1,
        providerMetadata: res.platformResponse ? (res.platformResponse as Prisma.InputJsonValue) : Prisma.JsonNull,
        errorDetails: null,
        publishedAt: new Date(),
      });

      // Recalculate compile/publish status for the content
      const siblingFailures = await publishingRecordRepository.count(workspaceId, {
        jobId: record.jobId,
        status: PublishRecordStatus.Failure,
        excludeId: record.id,
      });

      if (siblingFailures === 0) {
        await generatedContentRepository.update(generatedContent.id, {
          publishStatus: PublishStatus.Published,
        });
        
        await jobRepository.transitionJobStage(record.jobId, PipelineStage.Completed, {});
      }

      await eventBus.emitDomainEvent(
        workspaceId,
        'PublishSucceeded',
        { jobId: record.jobId, platform, platformPostId: res.externalId, retriedRecordId: record.id },
        record.jobId
      );
    } else {
      // Update retries count and last error
      await publishingRecordRepository.update(record.id, {
        retries: record.retries + 1,
        errorDetails: res.errorMessage || 'Publish failed',
        providerMetadata: res.platformResponse ? (res.platformResponse as Prisma.InputJsonValue) : Prisma.JsonNull,
        publishedAt: new Date(),
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
      try {
        const decryptedToken = decrypt(Buffer.from(connection.accessTokenEnc));
        const adapter = getPublishingAdapter(connection.platform);
        if (adapter.checkHealth) {
          await adapter.checkHealth(decryptedToken);
        }
      } catch (err: any) {
        logger.warn({ connectionId: connection.id, err: err.message }, 'Health check ping failed. Attempting refresh...');
        try {
          await this.refreshConnectionTokens(connection.id);
        } catch (refreshErr) {
          await platformConnectionRepository.updateRaw(connection.id, { healthStatus: 'Unhealthy' });
          throw new Error('Connection unhealthy, and automatic token refresh failed.');
        }
      }
    }
  },

  /**
   * Refreshes access tokens using refresh token credentials.
   */
  async refreshConnectionTokens(connectionId: string): Promise<void> {
    const connection = await platformConnectionRepository.getById(connectionId);

    if (!connection) throw new NotFoundError('Connection not found');

    const refreshToken = decrypt(Buffer.from(connection.refreshTokenEnc));
    if (!refreshToken) {
      throw new Error('No refresh token available.');
    }

    try {
      const adapter = getPublishingAdapter(connection.platform);
      if (!adapter.refreshToken) {
        throw new Error(`Platform adapter ${connection.platform} does not support token refresh.`);
      }

      const refreshed = await adapter.refreshToken(refreshToken);
      const newExpiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000);

      const updateData: any = {
        accessTokenEnc: encrypt(refreshed.accessToken) as any,
        expiresAt: newExpiresAt,
        healthStatus: 'Healthy',
      };

      if (refreshed.refreshToken) {
        updateData.refreshTokenEnc = encrypt(refreshed.refreshToken) as any;
      }

      await platformConnectionRepository.updateRaw(connectionId, updateData);
    } catch (err: any) {
      logger.error({ connectionId, err: err.message }, 'Failed to refresh connection tokens');
      await platformConnectionRepository.updateRaw(connectionId, { healthStatus: 'Unhealthy' });
      throw err;
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
   * Lists publishing history with filters and pagination.
   */
  async listHistory(workspaceId: string, filters: any, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      publishingRecordRepository.list(workspaceId, { ...filters, skip, take: limit }),
      publishingRecordRepository.count(workspaceId, filters),
    ]);
    return { items, total };
  },

  /**
   * Retrieves detail log for a publishing record.
   */
  async getRecordById(id: string, workspaceId: string) {
    return publishingRecordRepository.getById(id, workspaceId);
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
