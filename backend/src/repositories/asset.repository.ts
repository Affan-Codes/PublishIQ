import { Asset, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const assetRepository = {
  async getById(id: string, workspaceId?: string): Promise<Asset | null> {
    if (workspaceId) {
      return prisma.asset.findFirst({
        where: { id, workspaceId },
      });
    }
    return prisma.asset.findUnique({
      where: { id },
    });
  },

  async list(workspaceId: string, type?: AssetType): Promise<Asset[]> {
    const where: any = { workspaceId };
    if (type !== undefined) {
      where.type = type;
    }
    return prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    workspaceId: string;
    type: AssetType;
    name: string;
    status: AssetStatus;
    filePath: string;
    metadata: any;
    licenseStatus?: LicenseStatus;
  }): Promise<Asset> {
    return prisma.asset.create({
      data: {
        workspaceId: data.workspaceId,
        type: data.type,
        name: data.name,
        status: data.status,
        filePath: data.filePath,
        metadata: data.metadata ?? {},
        licenseStatus: data.licenseStatus ?? null,
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      status?: AssetStatus;
      filePath?: string;
      metadata?: any;
      licenseStatus?: LicenseStatus;
    }
  ): Promise<Asset> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.filePath !== undefined) updateData.filePath = data.filePath;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.licenseStatus !== undefined) updateData.licenseStatus = data.licenseStatus ?? null;

    return prisma.asset.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string): Promise<Asset> {
    return prisma.asset.delete({
      where: { id },
    });
  },
};

export default assetRepository;
