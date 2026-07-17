import channelRepository from '../repositories/channel.repository.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import platformConnectionRepository from '../repositories/platformConnection.repository.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/custom-errors.js';
import { AutomationMode, ChannelStatus, ConnectionStatus, ContentProfileStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';
import schedulerService from './scheduler.service.js';

export const channelService = {
  async getChannelById(id: string) {
    logger.debug({ id }, 'Fetching channel by ID');
    const channel = await channelRepository.getById(id);
    if (!channel) {
      throw new NotFoundError(`Channel with ID ${id} not found`);
    }
    return channel;
  },

  async listChannels(workspaceId: string) {
    logger.debug({ workspaceId }, 'Listing channels');
    return channelRepository.list(workspaceId);
  },

  async createChannel(data: {
    workspaceId: string;
    name: string;
    contentProfileId: string;
    automationMode: AutomationMode;
    status: ChannelStatus;
    scheduleCron: string;
    publishingConfiguration: any;
    platformConnectionIds: string[];
  }) {
    logger.info({ name: data.name }, 'Creating new channel');

    // 1. Enforce unique channel name in workspace
    const existing = await channelRepository.getByName(data.workspaceId, data.name);
    if (existing) {
      throw new ConflictError(`Channel with name "${data.name}" already exists in this workspace`);
    }

    // 2. Validate Content Profile exists, belongs to workspace, and is Active
    const profile = await contentProfileRepository.getById(data.contentProfileId);
    if (!profile || profile.workspaceId !== data.workspaceId) {
      throw new ValidationError(`Content Profile with ID ${data.contentProfileId} is invalid`);
    }
    if (profile.status !== ContentProfileStatus.Active) {
      throw new ValidationError(`Content Profile "${profile.name}" is disabled and cannot be linked`);
    }

    // 3. Validate Platform Connections exist, belong to workspace, and are enabled
    for (const pcId of data.platformConnectionIds) {
      const conn = await platformConnectionRepository.getById(pcId);
      if (!conn || conn.workspaceId !== data.workspaceId) {
        throw new ValidationError(`Platform connection ID ${pcId} is invalid`);
      }
      if (conn.status !== ConnectionStatus.Active) {
        throw new ValidationError(`Platform connection to ${conn.platform} is disabled and cannot be linked`);
      }
    }

    const channel = await channelRepository.create(data);
    await schedulerService.syncChannelSchedule(channel.id);
    return channel;
  },

  async updateChannel(
    id: string,
    workspaceId: string,
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
    logger.info({ id, data }, 'Updating channel');
    const existingChannel = await this.getChannelById(id);

    if (data.name) {
      const duplicate = await channelRepository.getByName(workspaceId, data.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Channel with name "${data.name}" already exists in this workspace`);
      }
    }

    if (data.contentProfileId) {
      const profile = await contentProfileRepository.getById(data.contentProfileId);
      if (!profile || profile.workspaceId !== workspaceId) {
        throw new ValidationError(`Content Profile with ID ${data.contentProfileId} is invalid`);
      }
      if (profile.status !== ContentProfileStatus.Active) {
        throw new ValidationError(`Content Profile "${profile.name}" is disabled and cannot be linked`);
      }
    }

    if (data.platformConnectionIds) {
      for (const pcId of data.platformConnectionIds) {
        const conn = await platformConnectionRepository.getById(pcId);
        if (!conn || conn.workspaceId !== workspaceId) {
          throw new ValidationError(`Platform connection ID ${pcId} is invalid`);
        }
        if (conn.status !== ConnectionStatus.Active) {
          throw new ValidationError(`Platform connection to ${conn.platform} is disabled and cannot be linked`);
        }
      }
    }

    const channel = await channelRepository.update(id, data);
    await schedulerService.syncChannelSchedule(id);
    return channel;
  },

  async deleteChannel(id: string) {
    logger.warn({ id }, 'Deleting channel');
    await this.getChannelById(id); // Ensure exists
    await schedulerService.removeChannelSchedule(id);
    return channelRepository.delete(id);
  },

  async duplicateChannel(id: string, workspaceId: string) {
    logger.info({ id }, 'Duplicating channel');
    const channel = await this.getChannelById(id);

    // Generate unique name
    let newName = `${channel.name} Copy`;
    let suffix = 1;
    while (await channelRepository.getByName(workspaceId, newName)) {
      newName = `${channel.name} Copy ${suffix}`;
      suffix++;
    }

    const duplicated = await channelRepository.create({
      workspaceId,
      name: newName,
      contentProfileId: channel.contentProfileId,
      automationMode: channel.automationMode,
      status: ChannelStatus.Disabled, // default duplicated channels to disabled for safety
      scheduleCron: channel.scheduleCron,
      publishingConfiguration: channel.publishingConfiguration,
      platformConnectionIds: channel.platformConnections.map((pc: any) => pc.id),
    });
    await schedulerService.syncChannelSchedule(duplicated.id);
    return duplicated;
  },
};

export default channelService;
