-- AlterTable
ALTER TABLE "PublishingRecord" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "errorDetails" TEXT,
ADD COLUMN     "generatedContentId" UUID,
ADD COLUMN     "platform" "Platform" NOT NULL DEFAULT 'YouTube',
ADD COLUMN     "platformPostId" TEXT,
ADD COLUMN     "providerMetadata" JSONB,
ADD COLUMN     "publishedUrl" TEXT,
ADD COLUMN     "retries" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PublishingRecord_platform_idx" ON "PublishingRecord"("platform");

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_generatedContentId_fkey" FOREIGN KEY ("generatedContentId") REFERENCES "GeneratedContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
