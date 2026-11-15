import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, Workspace } from '../../types/domain';

export async function getWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  const res = await apiClient.get<ApiSuccess<Workspace[]>>('/workspaces', { signal });
  return unwrap(res);
}

export async function getWorkspaceById(id: string, signal?: AbortSignal): Promise<Workspace> {
  const res = await apiClient.get<ApiSuccess<Workspace>>(`/workspaces/${id}`, { signal });
  return unwrap(res);
}

export async function createWorkspace(params: { name: string }): Promise<Workspace> {
  const res = await apiClient.post<ApiSuccess<Workspace>>('/workspaces', params);
  return unwrap(res);
}

export async function updateWorkspace(id: string, params: { name: string }): Promise<Workspace> {
  const res = await apiClient.put<ApiSuccess<Workspace>>(`/workspaces/${id}`, params);
  return unwrap(res);
}

export async function deleteWorkspace(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/workspaces/${id}`);
  return unwrap(res);
}
