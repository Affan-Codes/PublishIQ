import { Channel, AutomationMode, ChannelStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const channelRepository = {
  async getById(id: string, workspaceId?: string) {
    const where: any = { id };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    const channel = await prisma.channel.findFirst({
      where,
      include: {
        contentProfile: true,
        platformConnections: {
          include: {
            platformConnection: true,
          },
        },
      },
    });

    if (!channel) return null;
    return {
      ...channel,
      platformConnections: channel.platformConnections.map((pc) => pc.platformConnection),
    };
  },

  async getByName(workspaceId: string, name: string) {
    const channel = await prisma.channel.findFirst({
      where: {
        workspaceId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      include: {
        contentProfile: true,
        platformConnections: {
          include: {
            platformConnection: true,
          },
        },
      },
    });

    if (!channel) return null;
    return {
      ...channel,
      platformConnections: channel.platformConnections.map((pc) => pc.platformConnection),
    };
  },

  async list(workspaceId: string) {
    const channels = await prisma.channel.findMany({
      where: { workspaceId },
      include: {
        contentProfile: true,
        platformConnections: {
          include: {
            platformConnection: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((channel) => ({
      ...channel,
      platformConnections: channel.platformConnections.map((pc) => pc.platformConnection),
    }));
  },

  async create(data: {
    workspaceId: string;
    name: string;
    contentProfileId: string;
    automationMode: AutomationMode;
    status: ChannelStatus;
    scheduleCron: string;
    publishingConfiguration: any;
    platformConnectionIds: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const channel = await tx.channel.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          contentProfileId: data.contentProfileId,
          automationMode: data.automationMode,
          status: data.status,
          scheduleCron: data.scheduleCron,
          publishingConfiguration: data.publishingConfiguration ?? {},
        },
      });

      if (data.platformConnectionIds.length > 0) {
        await tx.channelPlatformConnection.createMany({
          data: data.platformConnectionIds.map((id) => ({
            channelId: channel.id,
            platformConnectionId: id,
          })),
        });
      }

      return channel;
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      contentProfileId?: string;
      automationMode?: AutomationMode;
      status?: ChannelStatus;
      scheduleCron?: string;
      publishingConfiguration?: any;
      platformConnectionIds?: string[];
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.contentProfileId !== undefined) updateData.contentProfileId = data.contentProfileId;
      if (data.automationMode !== undefined) updateData.automationMode = data.automationMode;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.scheduleCron !== undefined) updateData.scheduleCron = data.scheduleCron;
      if (data.publishingConfiguration !== undefined) {
        updateData.publishingConfiguration = data.publishingConfiguration;
      }

      const channel = await tx.channel.update({
        where: { id },
        data: updateData,
      });

      if (data.platformConnectionIds !== undefined) {
        // Clear existing connections
        await tx.channelPlatformConnection.deleteMany({
          where: { channelId: id },
        });

        // Insert new ones
        if (data.platformConnectionIds.length > 0) {
          await tx.channelPlatformConnection.createMany({
            data: data.platformConnectionIds.map((pcId) => ({
              channelId: id,
              platformConnectionId: pcId,
            })),
          });
        }
      }

      return channel;
    });
  },

  async delete(id: string) {
    return prisma.$transaction(async (tx) => {
      // Clear join table associations first
      await tx.channelPlatformConnection.deleteMany({
        where: { channelId: id },
      });

      // Clear referencing jobs, or throw if database restricts cascade?
      // Since schema.prisma uses onDelete: Restrict, we cannot delete a channel if jobs reference it.
      // So we delete jobs first or let Prisma raise an error. To keep it clean and robust:
      return tx.channel.delete({
        where: { id },
      });
    });
  },
};

export default channelRepository;
