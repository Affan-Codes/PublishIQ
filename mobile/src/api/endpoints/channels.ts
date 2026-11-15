import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, AutomationMode, Channel, ChannelStatus } from '../../types/domain';

export interface CreateChannelParams {
  name: string;
  contentProfileId: string;
  automationMode: AutomationMode;
  status: ChannelStatus;
  scheduleCron?: string;
  publishingConfiguration?: Record<string, unknown>;
  platformConnectionIds?: string[];
}

export interface UpdateChannelParams {
  name?: string;
  contentProfileId?: string;
  automationMode?: AutomationMode;
  status?: ChannelStatus;
  scheduleCron?: string;
  publishingConfiguration?: Record<string, unknown>;
  platformConnectionIds?: string[];
}

export async function getChannels(signal?: AbortSignal): Promise<Channel[]> {
  const res = await apiClient.get<ApiSuccess<Channel[]>>('/channels', { signal });
  return unwrap(res);
}

export async function getChannelById(id: string, signal?: AbortSignal): Promise<Channel> {
  const res = await apiClient.get<ApiSuccess<Channel>>(`/channels/${id}`, { signal });
  return unwrap(res);
}

export async function createChannel(params: CreateChannelParams): Promise<Channel> {
  const res = await apiClient.post<ApiSuccess<Channel>>('/channels', params);
  return unwrap(res);
}

export async function updateChannel(id: string, params: UpdateChannelParams): Promise<Channel> {
  const res = await apiClient.put<ApiSuccess<Channel>>(`/channels/${id}`, params);
  return unwrap(res);
}

export async function deleteChannel(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/channels/${id}`);
  return unwrap(res);
}

export async function duplicateChannel(id: string): Promise<Channel> {
  const res = await apiClient.post<ApiSuccess<Channel>>(`/channels/${id}/duplicate`);
  return unwrap(res);
}
