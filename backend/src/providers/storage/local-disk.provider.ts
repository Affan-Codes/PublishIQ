import fs from 'fs/promises';
import path from 'path';
import { StorageProvider } from './storage.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const mediaRoot = env.MEDIA_ROOT;

export const localDiskStorageProvider: StorageProvider = {
  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const fullPath = path.resolve(mediaRoot, relativePath);
    const directory = path.dirname(fullPath);

    logger.debug({ relativePath, fullPath }, 'Saving asset to local disk storage');

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(fullPath, buffer);
      
      logger.info({ relativePath }, 'Asset saved successfully');
      
      return `/media/${relativePath}`;
    } catch (err: any) {
      logger.error({ err, relativePath }, 'Failed to save asset to local disk');
      throw new Error(`Storage error: Failed to save file to ${relativePath}. ${err.message}`);
    }
  },

  async read(relativePath: string): Promise<Buffer> {
    // If the path starts with /media/, strip it to get the relative path
    let cleanedPath = relativePath;
    if (relativePath.startsWith('/media/')) {
      cleanedPath = relativePath.substring('/media/'.length);
    }
    const fullPath = path.resolve(mediaRoot, cleanedPath);

    logger.debug({ relativePath, fullPath }, 'Reading asset from local disk storage');

    try {
      return await fs.readFile(fullPath);
    } catch (err: any) {
      logger.error({ err, relativePath }, 'Failed to read asset from local disk');
      throw new Error(`Storage error: Failed to read file ${relativePath}. ${err.message}`);
    }
  },

  async delete(uri: string): Promise<void> {
    if (!uri.startsWith('/media/')) {
      logger.warn({ uri }, 'Invalid URI formatting for local disk storage deletion. Skipping.');
      return;
    }

    const relativePath = uri.substring('/media/'.length);
    const fullPath = path.resolve(mediaRoot, relativePath);

    logger.debug({ relativePath, fullPath }, 'Deleting asset from local disk storage');

    try {
      await fs.unlink(fullPath);
      logger.info({ relativePath }, 'Asset deleted successfully');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.error({ err, relativePath }, 'Failed to delete asset from local disk');
        throw new Error(`Storage error: Failed to delete file ${relativePath}. ${err.message}`);
      }
    }
  },
};

export default localDiskStorageProvider;
