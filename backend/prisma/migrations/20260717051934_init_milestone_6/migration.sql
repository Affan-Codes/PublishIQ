-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PipelineStage" ADD VALUE 'Running';
ALTER TYPE "PipelineStage" ADD VALUE 'RenderingImage';
ALTER TYPE "PipelineStage" ADD VALUE 'RenderingVideo';
ALTER TYPE "PipelineStage" ADD VALUE 'AttachingMusic';
ALTER TYPE "PipelineStage" ADD VALUE 'Completed';

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "scheduleConfig" JSONB,
ADD COLUMN     "scheduleTimezone" TEXT,
ADD COLUMN     "scheduleType" TEXT;
