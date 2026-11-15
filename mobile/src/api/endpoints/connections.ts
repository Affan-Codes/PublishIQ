import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, ConnectionStatus, Platform, PlatformConnection } from '../../types/domain';

export async function getConnections(signal?: AbortSignal): Promise<PlatformConnection[]> {
  const res = await apiClient.get<ApiSuccess<PlatformConnection[]>>('/platform-connections', { signal });
  return unwrap(res);
}

export async function getConnectionById(id: string, signal?: AbortSignal): Promise<PlatformConnection> {
  const res = await apiClient.get<ApiSuccess<PlatformConnection>>(`/platform-connections/${id}`, { signal });
  return unwrap(res);
}

export async function updateConnection(
  id: string,
  params: { displayName?: string; status?: ConnectionStatus }
): Promise<PlatformConnection> {
  const res = await apiClient.put<ApiSuccess<PlatformConnection>>(`/platform-connections/${id}`, params);
  return unwrap(res);
}

export async function deleteConnection(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/platform-connections/${id}`);
  return unwrap(res);
}

export async function getOAuthAuthorizeUrl(platform: Platform, signal?: AbortSignal): Promise<{ url: string }> {
  const res = await apiClient.get<ApiSuccess<{ url: string }>>(`/oauth/${platform.toLowerCase()}/authorize`, { signal });
  return unwrap(res);
}
