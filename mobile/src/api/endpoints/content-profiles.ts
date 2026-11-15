import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, ContentProfile, Job } from '../../types/domain';

export interface ReadinessCheckResult {
  ready: boolean;
  missing: string[];
}

export async function getContentProfiles(signal?: AbortSignal): Promise<ContentProfile[]> {
  const res = await apiClient.get<ApiSuccess<ContentProfile[]>>('/content-profiles', { signal });
  return unwrap(res);
}

export async function getContentProfileById(id: string, signal?: AbortSignal): Promise<ContentProfile> {
  const res = await apiClient.get<ApiSuccess<ContentProfile>>(`/content-profiles/${id}`, { signal });
  return unwrap(res);
}

export async function createContentProfile(params: Record<string, unknown>): Promise<ContentProfile> {
  const res = await apiClient.post<ApiSuccess<ContentProfile>>('/content-profiles', params);
  return unwrap(res);
}

export async function updateContentProfile(id: string, params: Record<string, unknown>): Promise<ContentProfile> {
  const res = await apiClient.put<ApiSuccess<ContentProfile>>(`/content-profiles/${id}`, params);
  return unwrap(res);
}

export async function deleteContentProfile(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/content-profiles/${id}`);
  return unwrap(res);
}

export async function getProfileReadiness(id: string, signal?: AbortSignal): Promise<ReadinessCheckResult> {
  const res = await apiClient.get<ApiSuccess<ReadinessCheckResult>>(`/content-profiles/${id}/readiness`, { signal });
  return unwrap(res);
}

export async function triggerDryRun(id: string): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>(`/content-profiles/${id}/dry-run`);
  return unwrap(res);
}
