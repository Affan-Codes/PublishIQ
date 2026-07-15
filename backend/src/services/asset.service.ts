import assetRepository from '../repositories/asset.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Asset, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const assetService = {
  async getAssetById(id: string): Promise<Asset> {
    logger.debug({ id }, 'Fetching asset by ID');
    const asset = await assetRepository.getById(id);
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
    filePath: string;
    metadata: any;
    licenseStatus?: LicenseStatus;
  }): Promise<Asset> {
    logger.info({ name: data.name, type: data.type }, 'Creating new asset');
    return assetRepository.create(data);
  },

  async updateAsset(
    id: string,
    data: {
      name?: string;
      status?: AssetStatus;
      filePath?: string;
      metadata?: any;
      licenseStatus?: LicenseStatus;
    }
  ): Promise<Asset> {
    logger.info({ id, data }, 'Updating asset fields');
    await this.getAssetById(id); // Ensure exists
    return assetRepository.update(id, data);
  },

  async deleteAsset(id: string): Promise<Asset> {
    logger.warn({ id }, 'Deleting asset');
    await this.getAssetById(id); // Ensure exists
    return assetRepository.delete(id);
  },
};

export default assetService;
