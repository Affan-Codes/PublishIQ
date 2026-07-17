-- CreateEnum
CREATE TYPE "ContentTypeStatus" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('Draft', 'Active', 'Deprecated');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('Background', 'Font', 'Music', 'Logo', 'Watermark', 'Animation', 'Icon');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('Confirmed', 'Unconfirmed');

-- CreateEnum
CREATE TYPE "ContentProfileStatus" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('English', 'Hindi', 'Urdu');

-- CreateEnum
CREATE TYPE "AutomationMode" AS ENUM ('Manual', 'Automatic', 'Hybrid');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YouTube', 'Instagram', 'Facebook');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('Healthy', 'Unhealthy', 'Expired', 'Unknown');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ContentPipeline', 'Cleanup', 'Archive', 'RetryPublish', 'TokenRefresh', 'HealthCheck');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('Draft', 'GeneratingContent', 'Validating', 'GeneratingImage', 'GeneratingVideo', 'SelectingMusic', 'GeneratingCaption', 'GeneratingHashtags', 'Queued', 'Publishing', 'Published', 'Failed', 'Archived');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('Unpublished', 'Published', 'PublishFailed');

-- CreateEnum
CREATE TYPE "PublishRecordStatus" AS ENUM ('Success', 'Failure');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('Debug', 'Info', 'Warn', 'Error');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Owner', 'Administrator', 'User');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentType" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ContentTypeStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" UUID NOT NULL,
    "promptId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "componentPath" TEXT NOT NULL,
    "componentSource" TEXT,
    "status" "PromptStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL,
    "filePath" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "licenseStatus" "LicenseStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentProfile" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ContentProfileStatus" NOT NULL,
    "contentTypeId" UUID NOT NULL,
    "promptVersionId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "tone" TEXT NOT NULL,
    "writingStyle" TEXT NOT NULL,
    "promptVariables" JSONB NOT NULL,
    "brandingRules" JSONB NOT NULL,
    "watermarkRules" JSONB NOT NULL,
    "captionStrategy" JSONB NOT NULL,
    "hashtagStrategy" JSONB NOT NULL,
    "musicSelectionRules" JSONB NOT NULL,
    "renderingConfiguration" JSONB NOT NULL,
    "validationRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contentProfileId" UUID NOT NULL,
    "automationMode" "AutomationMode" NOT NULL,
    "status" "ChannelStatus" NOT NULL,
    "scheduleCron" TEXT NOT NULL,
    "publishingConfiguration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessTokenEnc" BYTEA NOT NULL,
    "refreshTokenEnc" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "healthStatus" "HealthStatus" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelPlatformConnection" (
    "channelId" UUID NOT NULL,
    "platformConnectionId" UUID NOT NULL,

    CONSTRAINT "ChannelPlatformConnection_pkey" PRIMARY KEY ("channelId","platformConnectionId")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "jobType" "JobType" NOT NULL,
    "channelId" UUID,
    "contentProfileId" UUID,
    "configSnapshot" JSONB,
    "pipelineStage" "PipelineStage",
    "maintenanceState" TEXT,
    "failureStage" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failedAt" TIMESTAMP(3),
    "generatedText" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "caption" TEXT,
    "hashtags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "sourceGeneratedContentId" UUID,
    "contentProfileId" UUID NOT NULL,
    "promptVersionId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "contentTypeId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT,
    "metadata" JSONB,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "caption" TEXT,
    "hashtags" JSONB,
    "publishStatus" "PublishStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "jobId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "domainEventId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingRecord" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "platformConnectionId" UUID NOT NULL,
    "contentTypeSnapshot" TEXT NOT NULL,
    "status" "PublishRecordStatus" NOT NULL,
    "platformResponse" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfiguration" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'User',
    "workspaceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptId_versionNumber_key" ON "PromptVersion"("promptId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_versionNumber_key" ON "TemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "Job_workspaceId_jobType_pipelineStage_idx" ON "Job"("workspaceId", "jobType", "pipelineStage");

-- CreateIndex
CREATE INDEX "Job_channelId_createdAt_idx" ON "Job"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedContent_jobId_key" ON "GeneratedContent"("jobId");

-- CreateIndex
CREATE INDEX "GeneratedContent_contentProfileId_idx" ON "GeneratedContent"("contentProfileId");

-- CreateIndex
CREATE INDEX "GeneratedContent_publishStatus_idx" ON "GeneratedContent"("publishStatus");

-- CreateIndex
CREATE INDEX "GeneratedContent_textHash_idx" ON "GeneratedContent"("textHash");

-- CreateIndex
CREATE INDEX "DomainEvent_jobId_createdAt_idx" ON "DomainEvent"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "PublishingRecord_channelId_publishedAt_idx" ON "PublishingRecord"("channelId", "publishedAt");

-- CreateIndex
CREATE INDEX "PublishingRecord_status_idx" ON "PublishingRecord"("status");

-- CreateIndex
CREATE INDEX "PublishingRecord_contentTypeSnapshot_idx" ON "PublishingRecord"("contentTypeSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_workspaceId_key_key" ON "FeatureFlag"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfiguration_workspaceId_key_key" ON "SystemConfiguration"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ContentType" ADD CONSTRAINT "ContentType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProfile" ADD CONSTRAINT "ContentProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProfile" ADD CONSTRAINT "ContentProfile_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProfile" ADD CONSTRAINT "ContentProfile_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProfile" ADD CONSTRAINT "ContentProfile_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_contentProfileId_fkey" FOREIGN KEY ("contentProfileId") REFERENCES "ContentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPlatformConnection" ADD CONSTRAINT "ChannelPlatformConnection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPlatformConnection" ADD CONSTRAINT "ChannelPlatformConnection_platformConnectionId_fkey" FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_contentProfileId_fkey" FOREIGN KEY ("contentProfileId") REFERENCES "ContentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_contentProfileId_fkey" FOREIGN KEY ("contentProfileId") REFERENCES "ContentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_platformConnectionId_fkey" FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfiguration" ADD CONSTRAINT "SystemConfiguration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
