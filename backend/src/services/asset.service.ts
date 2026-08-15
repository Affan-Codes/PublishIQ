import fs from 'fs';
import path from 'path';
import assetRepository from '../repositories/asset.repository.js';
import { NotFoundError, ValidationError } from '../errors/custom-errors.js';
import { Asset, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import { getAudioDurationInSeconds, trimAudioSegment } from '../utils/audio.utils.js';

function getFolderForAssetType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'music') return 'music';
  if (t === 'background') return 'backgrounds';
  if (t === 'font') return 'fonts';
  if (t === 'logo') return 'logos';
  if (t === 'watermark') return 'watermarks';
  if (t === 'animation') return 'animations';
  if (t === 'icon') return 'icons';
  return `${t}s`;
}

export const assetService = {
  async getAssetById(id: string, workspaceId?: string): Promise<Asset> {
    logger.debug({ id, workspaceId }, 'Fetching asset by ID');
    const asset = await assetRepository.getById(id, workspaceId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID ${id} not found`);
    }
    return asset;
  },

  async listAssets(workspaceId: string, type?: AssetType): Promise<Asset[]> {
    logger.debug({ workspaceId, type }, 'Listing assets');
    return assetRepository.list(workspaceId, type);
  },

  async createAsset(data: {
    workspaceId: string;
    type: AssetType;
    name: string;
    status: AssetStatus;
    filePath?: string | undefined;
    fileBuffer?: Buffer | undefined;
    originalName?: string | undefined;
    startTime?: number | undefined;
    endTime?: number | undefined;
    metadata?: any;
    licenseStatus?: LicenseStatus | undefined;
  }): Promise<Asset> {
    logger.info({ name: data.name, type: data.type }, 'Creating new asset');

    let finalFilePath = data.filePath;
    let enrichedMetadata = data.metadata || {};
    const folder = getFolderForAssetType(data.type);

    // Handle File Upload
    if (data.fileBuffer && data.fileBuffer.length > 0) {
      if (data.type === AssetType.Music) {
        // Music Trimming Pipeline
        const scratchDir = env.TEMP_RENDER_DIR;
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }

        const uniqueId = Date.now();
        const baseName = data.originalName ? path.basename(data.originalName) : 'track.mp3';
        const tempSourcePath = path.join(scratchDir, `raw_music_${uniqueId}_${baseName}`);
        const tempTrimmedPath = path.join(scratchDir, `trimmed_music_${uniqueId}_${baseName}`);

        let uploadedCloudinaryUrl: string | null = null;

        try {
          // 1. Write raw uploaded music file to temporary disk
          fs.writeFileSync(tempSourcePath, data.fileBuffer);

          // 2. Authoritative source duration calculation using FFmpeg
          const sourceDuration = await getAudioDurationInSeconds(tempSourcePath);

          // 3. Validate user-selected Start and End times
          const startTime = typeof data.startTime === 'number' && !isNaN(data.startTime) ? data.startTime : 0;
          const endTime = typeof data.endTime === 'number' && !isNaN(data.endTime) && data.endTime > 0 
            ? data.endTime 
            : sourceDuration;

          if (startTime < 0) {
            throw new ValidationError('Start time cannot be negative.');
          }
          if (endTime <= startTime) {
            throw new ValidationError(`End time (${endTime}s) must be strictly greater than start time (${startTime}s).`);
          }
          if (startTime >= sourceDuration) {
            throw new ValidationError(`Start time (${startTime}s) cannot exceed total source music duration (${sourceDuration.toFixed(2)}s).`);
          }

          const finalEnd = Math.min(endTime, sourceDuration);
          const trimmedDuration = parseFloat((finalEnd - startTime).toFixed(3));

          if (trimmedDuration > 15.05) {
            throw new ValidationError(`Selected music segment duration (${trimmedDuration.toFixed(1)}s) cannot exceed the maximum limit of 15 seconds.`);
          }

          // 4. Trim audio using FFmpeg
          await trimAudioSegment(tempSourcePath, tempTrimmedPath, startTime, finalEnd);

          const trimmedBuffer = fs.readFileSync(tempTrimmedPath);
          if (trimmedBuffer.length === 0) {
            throw new Error('Trimmed audio file is empty.');
          }

          // 5. Upload ONLY the trimmed clip to Cloudinary
          const relativePath = `${folder}/${uniqueId}_${baseName}`;
          uploadedCloudinaryUrl = await cloudinaryStorageProvider.save(trimmedBuffer, relativePath);
          finalFilePath = uploadedCloudinaryUrl;

          // 6. Enrich metadata
          enrichedMetadata = {
            ...enrichedMetadata,
            sourceDuration: parseFloat(sourceDuration.toFixed(3)),
            startTime: parseFloat(startTime.toFixed(3)),
            endTime: parseFloat(finalEnd.toFixed(3)),
            trimmedDuration,
            format: path.extname(baseName).replace('.', '') || 'mp3',
            sizeBytes: trimmedBuffer.length,
          };
        } finally {
          // Cleanup temporary files
          if (fs.existsSync(tempSourcePath)) {
            try { fs.unlinkSync(tempSourcePath); } catch {}
          }
          if (fs.existsSync(tempTrimmedPath)) {
            try { fs.unlinkSync(tempTrimmedPath); } catch {}
          }
        }

        // 7. Store in database with rollback if DB insertion fails
        try {
          return await assetRepository.create({
            workspaceId: data.workspaceId,
            type: data.type,
            name: data.name,
            status: data.status,
            filePath: finalFilePath!,
            metadata: enrichedMetadata,
            licenseStatus: data.licenseStatus,
          });
        } catch (dbErr) {
          if (uploadedCloudinaryUrl && cloudinaryStorageProvider.delete) {
            logger.warn({ url: uploadedCloudinaryUrl }, 'Database persistence failed after Cloudinary upload; cleaning up orphaned Cloudinary asset');
            await cloudinaryStorageProvider.delete(uploadedCloudinaryUrl).catch(() => {});
          }
          throw dbErr;
        }
      } else {
        // Non-music media asset uploads
        const relativePath = `${folder}/${Date.now()}_${data.originalName || 'file'}`;
        finalFilePath = await cloudinaryStorageProvider.save(data.fileBuffer, relativePath);
      }
    }

    if (!finalFilePath) {
      throw new ValidationError('Either a file upload or a valid filePath string is required.');
    }

    return assetRepository.create({
      workspaceId: data.workspaceId,
      type: data.type,
      name: data.name,
      status: data.status,
      filePath: finalFilePath,
      metadata: enrichedMetadata,
      licenseStatus: data.licenseStatus,
    });
  },

  async updateAsset(
    id: string,
    data: {
      name?: string | undefined;
      status?: AssetStatus | undefined;
      filePath?: string | undefined;
      fileBuffer?: Buffer | undefined;
      originalName?: string | undefined;
      startTime?: number | undefined;
      endTime?: number | undefined;
      metadata?: any;
      licenseStatus?: LicenseStatus | undefined;
    }
  ): Promise<Asset> {
    logger.info({ id, name: data.name }, 'Updating asset');
    const existingAsset = await this.getAssetById(id);

    let finalFilePath = data.filePath;
    let enrichedMetadata = data.metadata !== undefined ? data.metadata : existingAsset.metadata;
    const folder = getFolderForAssetType(existingAsset.type);

    if (data.fileBuffer && data.fileBuffer.length > 0) {
      if (existingAsset.type === AssetType.Music) {
        const scratchDir = env.TEMP_RENDER_DIR;
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }

        const uniqueId = Date.now();
        const baseName = data.originalName ? path.basename(data.originalName) : 'track.mp3';
        const tempSourcePath = path.join(scratchDir, `raw_music_${uniqueId}_${baseName}`);
        const tempTrimmedPath = path.join(scratchDir, `trimmed_music_${uniqueId}_${baseName}`);

        try {
          fs.writeFileSync(tempSourcePath, data.fileBuffer);

          const sourceDuration = await getAudioDurationInSeconds(tempSourcePath);

          const startTime = typeof data.startTime === 'number' && !isNaN(data.startTime) ? data.startTime : 0;
          const endTime = typeof data.endTime === 'number' && !isNaN(data.endTime) && data.endTime > 0 
            ? data.endTime 
            : sourceDuration;

          if (startTime < 0) {
            throw new ValidationError('Start time cannot be negative.');
          }
          if (endTime <= startTime) {
            throw new ValidationError(`End time (${endTime}s) must be strictly greater than start time (${startTime}s).`);
          }
          if (startTime >= sourceDuration) {
            throw new ValidationError(`Start time (${startTime}s) cannot exceed total source music duration (${sourceDuration.toFixed(2)}s).`);
          }

          const finalEnd = Math.min(endTime, sourceDuration);
          const trimmedDuration = parseFloat((finalEnd - startTime).toFixed(3));

          if (trimmedDuration > 15.05) {
            throw new ValidationError(`Selected music segment duration (${trimmedDuration.toFixed(1)}s) cannot exceed the maximum limit of 15 seconds.`);
          }

          await trimAudioSegment(tempSourcePath, tempTrimmedPath, startTime, finalEnd);

          const trimmedBuffer = fs.readFileSync(tempTrimmedPath);

          const relativePath = `${folder}/${uniqueId}_${baseName}`;
          finalFilePath = await cloudinaryStorageProvider.save(trimmedBuffer, relativePath);

          enrichedMetadata = {
            ...(enrichedMetadata || {}),
            sourceDuration: parseFloat(sourceDuration.toFixed(3)),
            startTime: parseFloat(startTime.toFixed(3)),
            endTime: parseFloat(finalEnd.toFixed(3)),
            trimmedDuration,
            format: path.extname(baseName).replace('.', '') || 'mp3',
            sizeBytes: trimmedBuffer.length,
          };
        } finally {
          if (fs.existsSync(tempSourcePath)) {
            try { fs.unlinkSync(tempSourcePath); } catch {}
          }
          if (fs.existsSync(tempTrimmedPath)) {
            try { fs.unlinkSync(tempTrimmedPath); } catch {}
          }
        }
      } else {
        const relativePath = `${folder}/${Date.now()}_${data.originalName || 'file'}`;
        finalFilePath = await cloudinaryStorageProvider.save(data.fileBuffer, relativePath);
      }
    }

    return assetRepository.update(id, {
      name: data.name,
      status: data.status,
      filePath: finalFilePath,
      metadata: enrichedMetadata,
      licenseStatus: data.licenseStatus,
    });
  },

  async deleteAsset(id: string): Promise<Asset> {
    logger.warn({ id }, 'Deleting asset');
    await this.getAssetById(id); // Ensure exists
    return assetRepository.delete(id);
  },
};

export default assetService;
