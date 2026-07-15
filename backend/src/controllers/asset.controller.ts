import { Request, Response, NextFunction } from 'express';
import assetService from '../services/asset.service.js';
import { AssetType } from '@prisma/client';

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
      const { type, name, status, filePath, metadata, licenseStatus } = req.body;
      const asset = await assetService.createAsset({
        workspaceId,
        type,
        name,
        status,
        filePath,
        metadata,
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
      const { name, status, filePath, metadata, licenseStatus } = req.body;
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
