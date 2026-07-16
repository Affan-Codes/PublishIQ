import { PlatformConnection, Platform, HealthStatus, ConnectionStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const platformConnectionRepository = {
  async getById(id: string): Promise<PlatformConnection | null> {
    return prisma.platformConnection.findUnique({
      where: { id },
    });
  },

  async list(workspaceId: string): Promise<PlatformConnection[]> {
    return prisma.platformConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    workspaceId: string;
    platform: Platform;
    accessTokenHex: string;
    refreshTokenHex: string;
    expiresAt: Date;
    scopes: string[];
    healthStatus: HealthStatus;
    status: ConnectionStatus;
  }): Promise<PlatformConnection> {
    return prisma.platformConnection.create({
      data: {
        workspaceId: data.workspaceId,
        platform: data.platform,
        accessTokenEnc: Buffer.from(data.accessTokenHex, 'hex'),
        refreshTokenEnc: Buffer.from(data.refreshTokenHex, 'hex'),
        expiresAt: data.expiresAt,
        scopes: data.scopes,
        healthStatus: data.healthStatus,
        status: data.status,
      },
    });
  },

  async update(
    id: string,
    data: {
      platform?: Platform;
      accessTokenHex?: string;
      refreshTokenHex?: string;
      expiresAt?: Date;
      scopes?: string[];
      healthStatus?: HealthStatus;
      status?: ConnectionStatus;
    }
  ): Promise<PlatformConnection> {
    const updateData: Record<string, any> = {};
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.accessTokenHex !== undefined) {
      updateData.accessTokenEnc = Buffer.from(data.accessTokenHex, 'hex');
    }
    if (data.refreshTokenHex !== undefined) {
      updateData.refreshTokenEnc = Buffer.from(data.refreshTokenHex, 'hex');
    }
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
    if (data.scopes !== undefined) updateData.scopes = data.scopes;
    if (data.healthStatus !== undefined) updateData.healthStatus = data.healthStatus;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.platformConnection.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string): Promise<PlatformConnection> {
    return prisma.platformConnection.delete({
      where: { id },
    });
  },
};

export default platformConnectionRepository;
