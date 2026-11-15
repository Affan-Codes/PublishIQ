import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, Prompt, PromptStatus, PromptVersion } from '../../types/domain';

export interface CreatePromptParams {
  name: string;
  status: PromptStatus;
  notes?: string | null;
  body: string;
}

export interface CreatePromptVersionParams {
  body: string;
  status: PromptStatus;
  notes?: string | null;
}

export async function getPrompts(signal?: AbortSignal): Promise<Prompt[]> {
  const res = await apiClient.get<ApiSuccess<Prompt[]>>('/prompts', { signal });
  return unwrap(res);
}

export async function getPromptById(id: string, signal?: AbortSignal): Promise<Prompt> {
  const res = await apiClient.get<ApiSuccess<Prompt>>(`/prompts/${id}`, { signal });
  return unwrap(res);
}

export async function createPrompt(params: CreatePromptParams): Promise<Prompt> {
  const res = await apiClient.post<ApiSuccess<Prompt>>('/prompts', params);
  return unwrap(res);
}

export async function updatePrompt(
  id: string,
  params: { name?: string; status?: PromptStatus; notes?: string | null }
): Promise<Prompt> {
  const res = await apiClient.put<ApiSuccess<Prompt>>(`/prompts/${id}`, params);
  return unwrap(res);
}

export async function getPromptVersions(id: string, signal?: AbortSignal): Promise<PromptVersion[]> {
  const res = await apiClient.get<ApiSuccess<PromptVersion[]>>(`/prompts/${id}/versions`, { signal });
  return unwrap(res);
}

export async function getPromptVersion(
  id: string,
  versionNumber: number,
  signal?: AbortSignal
): Promise<PromptVersion> {
  const res = await apiClient.get<ApiSuccess<PromptVersion>>(`/prompts/${id}/versions/${versionNumber}`, { signal });
  return unwrap(res);
}

export async function createPromptVersion(
  id: string,
  params: CreatePromptVersionParams
): Promise<PromptVersion> {
  const res = await apiClient.post<ApiSuccess<PromptVersion>>(`/prompts/${id}/versions`, params);
  return unwrap(res);
}

export async function rollbackPromptVersion(id: string, versionNumber: number): Promise<PromptVersion> {
  const res = await apiClient.post<ApiSuccess<PromptVersion>>(`/prompts/${id}/versions/${versionNumber}/rollback`);
  return unwrap(res);
}

export async function getOutputContract(signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await apiClient.get<ApiSuccess<Record<string, unknown>>>('/prompts/output-contract', { signal });
  return unwrap(res);
}
