import { PlatformConnection, Platform, HealthStatus, ConnectionStatus } from '@prisma/client';
import { prisma } from '../database/db.js';
import { encrypt } from '../utils/crypto.js';

export const platformConnectionRepository = {
  async getById(id: string, workspaceId?: string): Promise<PlatformConnection | null> {
    if (workspaceId) {
      return prisma.platformConnection.findFirst({
        where: { id, workspaceId },
      });
    }
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
    externalAccountId?: string;
    displayName?: string;
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
        externalAccountId: data.externalAccountId ?? null,
        displayName: data.displayName ?? null,
        accessTokenEnc: encrypt(data.accessTokenHex) as any,
        refreshTokenEnc: encrypt(data.refreshTokenHex) as any,
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
      externalAccountId?: string;
      displayName?: string;
      accessTokenHex?: string;
      refreshTokenHex?: string;
      expiresAt?: Date;
      scopes?: string[];
      healthStatus?: HealthStatus;
      status?: ConnectionStatus;
    },
    workspaceId?: string
  ): Promise<PlatformConnection> {
    const updateData: Record<string, any> = {};
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.externalAccountId !== undefined) updateData.externalAccountId = data.externalAccountId;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.accessTokenHex !== undefined && data.accessTokenHex !== '********') {
      updateData.accessTokenEnc = encrypt(data.accessTokenHex);
    }
    if (data.refreshTokenHex !== undefined && data.refreshTokenHex !== '********') {
      updateData.refreshTokenEnc = encrypt(data.refreshTokenHex);
    }
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
    if (data.scopes !== undefined) updateData.scopes = data.scopes;
    if (data.healthStatus !== undefined) updateData.healthStatus = data.healthStatus;
    if (data.status !== undefined) updateData.status = data.status;

    if (workspaceId) {
      const existing = await prisma.platformConnection.findFirst({ where: { id, workspaceId } });
      if (!existing) {
        throw new Error(`Platform connection not found in workspace: ${id}`);
      }
    }

    return prisma.platformConnection.update({
      where: { id },
      data: updateData,
    });
  },

  async upsertOAuth(data: {
    workspaceId: string;
    platform: Platform;
    externalAccountId: string;
    displayName: string;
    accessTokenHex: string;
    refreshTokenHex: string;
    expiresAt: Date;
    scopes: string[];
  }): Promise<PlatformConnection> {
    const existing = await prisma.platformConnection.findFirst({
      where: {
        workspaceId: data.workspaceId,
        platform: data.platform,
        externalAccountId: data.externalAccountId,
      },
    });

    if (existing) {
      return prisma.platformConnection.update({
        where: { id: existing.id },
        data: {
          displayName: data.displayName,
          accessTokenEnc: encrypt(data.accessTokenHex) as any,
          refreshTokenEnc: encrypt(data.refreshTokenHex) as any,
          expiresAt: data.expiresAt,
          scopes: data.scopes,
          healthStatus: HealthStatus.Healthy,
          status: ConnectionStatus.Active,
        },
      });
    }

    return prisma.platformConnection.create({
      data: {
        workspaceId: data.workspaceId,
        platform: data.platform,
        externalAccountId: data.externalAccountId,
        displayName: data.displayName,
        accessTokenEnc: encrypt(data.accessTokenHex) as any,
        refreshTokenEnc: encrypt(data.refreshTokenHex) as any,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
        healthStatus: HealthStatus.Healthy,
        status: ConnectionStatus.Active,
      },
    });
  },

  async updateRaw(id: string, data: any): Promise<PlatformConnection> {
    return prisma.platformConnection.update({
      where: { id },
      data,
    });
  },

  async getExpiringConnections(thresholdDate: Date): Promise<PlatformConnection[]> {
    return prisma.platformConnection.findMany({
      where: {
        expiresAt: { lt: thresholdDate },
      },
    });
  },

  async listAll(): Promise<PlatformConnection[]> {
    return prisma.platformConnection.findMany();
  },

  async delete(id: string, workspaceId?: string): Promise<PlatformConnection> {
    if (workspaceId) {
      const existing = await prisma.platformConnection.findFirst({ where: { id, workspaceId } });
      if (!existing) {
        throw new Error(`Platform connection not found in workspace: ${id}`);
      }
    }
    return prisma.platformConnection.delete({
      where: { id },
    });
  },
};

export default platformConnectionRepository;

