import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import axios from 'axios';
import path from 'path';
import { Readable } from 'stream';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Configure Cloudinary SDK with Zod-validated environment configuration
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Infer Cloudinary resource_type based on file extension.
 * Audio and Video files use 'video', documents/fonts/raw files use 'raw', images use 'image'.
 */
function inferResourceType(filePathOrUrl: string): 'image' | 'video' | 'raw' | 'auto' {
  const cleanPath = filePathOrUrl.split('?')[0] || filePathOrUrl;
  const ext = path.extname(cleanPath).toLowerCase();
  
  if (['.mp4', '.mov', '.avi', '.webm', '.mkv', '.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac'].includes(ext)) {
    return 'video';
  }
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.tiff'].includes(ext)) {
    return 'image';
  }
  if (['.ttf', '.otf', '.woff', '.woff2', '.pdf', '.zip', '.txt'].includes(ext)) {
    return 'raw';
  }
  return 'auto';
}

/**
 * Derives a clean Cloudinary public_id from a relative or absolute file path or Cloudinary URL.
 */
function derivePublicId(pathOrUrl: string): string {
  // If it's a full Cloudinary URL, extract public_id after /upload/ (version prefix stripped)
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(pathOrUrl);
      const pathname = parsedUrl.pathname;
      const uploadIdx = pathname.indexOf('/upload/');
      if (uploadIdx !== -1) {
        let afterUpload = pathname.substring(uploadIdx + '/upload/'.length);
        // Strip optional version prefix v12345678/
        afterUpload = afterUpload.replace(/^v\d+\//, '');
        // Strip extension
        const extIdx = afterUpload.lastIndexOf('.');
        if (extIdx !== -1) {
          afterUpload = afterUpload.substring(0, extIdx);
        }
        return afterUpload;
      }
    } catch {
      // Fallback to path string processing if URL parsing fails
    }
  }

  // Remove leading slash and file extension
  let clean = pathOrUrl.replace(/^\//, '');
  const ext = path.extname(clean);
  if (ext) {
    clean = clean.substring(0, clean.length - ext.length);
  }
  
  // Normalize legacy 'assets/<type>/...' to distinct folder '<type>/...'
  if (clean.startsWith('assets/')) {
    clean = clean.substring('assets/'.length);
  }

  // Normalize singular asset category names to distinct folder names
  clean = clean
    .replace(/^background\//, 'backgrounds/')
    .replace(/^font\//, 'fonts/')
    .replace(/^logo\//, 'logos/')
    .replace(/^watermark\//, 'watermarks/')
    .replace(/^animation\//, 'animations/')
    .replace(/^icon\//, 'icons/');

  if (!clean.startsWith('publishiq/')) {
    clean = `publishiq/${clean}`;
  }
  return clean;
}

/**
 * Splits a derived public_id string into an explicit folder path and filename ID
 * so Cloudinary Console Media Library visually displays physical subfolders.
 */
function parseCloudinaryFolderAndId(pathOrUrl: string): { folder: string; filenameId: string; fullPublicId: string } {
  const fullPublicId = derivePublicId(pathOrUrl);
  const lastSlashIdx = fullPublicId.lastIndexOf('/');
  if (lastSlashIdx !== -1) {
    return {
      folder: fullPublicId.substring(0, lastSlashIdx),
      filenameId: fullPublicId.substring(lastSlashIdx + 1),
      fullPublicId,
    };
  }
  return {
    folder: 'publishiq',
    filenameId: fullPublicId,
    fullPublicId,
  };
}

export const cloudinaryStorageProvider = {
  /**
   * Uploads a Buffer to Cloudinary using upload_stream and returns its secure_url.
   */
  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const resourceType = inferResourceType(relativePath);
    const { folder, filenameId, fullPublicId } = parseCloudinaryFolderAndId(relativePath);

    logger.debug({ relativePath, folder, filenameId, fullPublicId, resourceType }, 'Uploading buffer to Cloudinary storage');

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: filenameId,
          resource_type: resourceType,
          overwrite: true,
          invalidate: true,
          use_filename: true,
          unique_filename: false,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            // Categorize Cloudinary specific errors
            const errMsg = error.message || String(error);
            if (error.http_code === 401 || error.http_code === 403 || errMsg.includes('Must supply api_key') || errMsg.includes('Invalid API key') || errMsg.includes('403')) {
              logger.error({ error, publicId: fullPublicId }, 'Cloudinary Authentication/Authorization Failure (HTTP 401/403): Invalid Cloud Name, API Key, or Secret provided in .env. Please configure valid credentials.');
            } else if (error.http_code === 420 || errMsg.includes('disabled') || errMsg.includes('quota') || errMsg.includes('exceeded')) {
              logger.error({ error, publicId: fullPublicId }, 'Cloudinary Quota Exceeded / Storage Plan Limit reached.');
            } else {
              logger.error({ error, publicId: fullPublicId, resourceType }, 'Cloudinary Upload Failed.');
            }
            return reject(new Error(`Cloudinary storage upload error: ${errMsg}`));
          }

          if (!result || !result.secure_url) {
            logger.error({ publicId: fullPublicId }, 'Cloudinary returned empty result or missing secure_url.');
            return reject(new Error('Cloudinary response missing secure_url.'));
          }

          logger.info({ publicId: fullPublicId, secureUrl: result.secure_url, format: result.format, bytes: result.bytes }, 'Uploaded file to Cloudinary successfully');
          resolve(result.secure_url);
        }
      );

      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  },

  /**
   * Reads binary file data from Cloudinary via HTTP GET on secure_url.
   *
   * RATIONALE FOR HTTP GET vs Admin API:
   * Direct HTTP GET on the secure_url fetches the raw binary content fast and reliably across all
   * resource types (images, videos, raw audio/fonts) without requiring Cloudinary Admin API signature generation.
   */
  async read(pathOrUrl: string): Promise<Buffer> {
    logger.debug({ pathOrUrl }, 'Fetching binary asset buffer from Cloudinary URL');
    try {
      const response = await axios.get(pathOrUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (err: any) {
      logger.error({ pathOrUrl, err: err.message }, 'Failed to read asset buffer from Cloudinary');
      throw new Error(`Cloudinary asset read error: ${err.message}`);
    }
  },

  /**
   * Deletes an asset from Cloudinary using destroy().
   * Silently ignores "not found" / "already deleted" errors to match legacy tolerant behavior.
   */
  async delete(pathOrUrl: string): Promise<void> {
    if (!pathOrUrl) return;

    const publicId = derivePublicId(pathOrUrl);
    const resourceType = inferResourceType(pathOrUrl);

    logger.debug({ pathOrUrl, publicId, resourceType }, 'Deleting asset from Cloudinary');

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result.result === 'ok' || result.result === 'not found') {
        logger.info({ publicId, status: result.result }, 'Cloudinary asset deleted or was already removed');
      } else {
        logger.warn({ publicId, result }, 'Cloudinary asset deletion returned unexpected result status');
      }
    } catch (err: any) {
      // Do not throw on "not found" / already gone, match tolerant local disk provider behavior
      logger.warn({ publicId, pathOrUrl, err: err.message }, 'Tolerated error during Cloudinary asset deletion');
    }
  },
};

export default cloudinaryStorageProvider;
