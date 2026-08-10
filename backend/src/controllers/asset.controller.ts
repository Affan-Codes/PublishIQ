import { Request, Response, NextFunction } from 'express';
import assetService from '../services/asset.service.js';
import { AssetType } from '@prisma/client';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import { ValidationError } from '../errors/custom-errors.js';

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

export const assetController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await assetService.getAssetById(req.params.id as string);
      res.json({
        success: true,
        data: asset,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const type = req.query.type as AssetType | undefined;
      const list = await assetService.listAssets(workspaceId, type);
      res.json({
        success: true,
        data: list,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      let { type, name, status, filePath, metadata, licenseStatus } = req.body;

      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = {};
        }
      }

      if (req.file) {
        const folder = getFolderForAssetType(type);
        const relativePath = `${folder}/${Date.now()}_${req.file.originalname}`;
        filePath = await cloudinaryStorageProvider.save(req.file.buffer, relativePath);
      }

      if (!filePath) {
        throw new ValidationError('Either a file upload or a valid filePath string is required.');
      }

      const asset = await assetService.createAsset({
        workspaceId,
        type,
        name,
        status,
        filePath,
        metadata: metadata || {},
        licenseStatus,
      });

      res.status(201).json({
        success: true,
        data: asset,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { name, status, filePath, metadata, licenseStatus } = req.body;

      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          // Keep as is if parsing fails
        }
      }

      if (req.file) {
        const existingAsset = await assetService.getAssetById(req.params.id as string);
        const folder = getFolderForAssetType(existingAsset?.type || 'asset');
        const relativePath = `${folder}/${Date.now()}_${req.file.originalname}`;
        filePath = await cloudinaryStorageProvider.save(req.file.buffer, relativePath);
      }

      const asset = await assetService.updateAsset(req.params.id as string, {
        name,
        status,
        filePath,
        metadata,
        licenseStatus,
      });

      res.json({
        success: true,
        data: asset,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await assetService.deleteAsset(req.params.id as string);
      if (asset?.filePath && cloudinaryStorageProvider.delete) {
        await cloudinaryStorageProvider.delete(asset.filePath);
      }
      res.json({
        success: true,
        data: asset,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default assetController;
