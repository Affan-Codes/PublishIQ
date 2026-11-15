import apiClient from '../client';
import { unwrap, unwrapWithMeta } from '../unwrap';
import { ApiSuccess, GeneratedContent, Language, PaginationMeta, PublishStatus } from '../../types/domain';

export interface GeneratedContentsQueryParams {
  contentProfileId?: string;
  publishStatus?: PublishStatus;
  language?: Language;
  contentTypeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getGeneratedContents(
  params?: GeneratedContentsQueryParams,
  signal?: AbortSignal
): Promise<{ data: GeneratedContent[]; meta?: PaginationMeta }> {
  const res = await apiClient.get<ApiSuccess<GeneratedContent[], PaginationMeta>>('/generated-contents', {
    params,
    signal,
  });
  return unwrapWithMeta(res);
}

export async function getGeneratedContentById(id: string, signal?: AbortSignal): Promise<GeneratedContent> {
  const res = await apiClient.get<ApiSuccess<GeneratedContent>>(`/generated-contents/${id}`, { signal });
  return unwrap(res);
}

export async function duplicateContent(id: string, channelId: string): Promise<GeneratedContent> {
  const res = await apiClient.post<ApiSuccess<GeneratedContent>>(`/generated-contents/${id}/duplicate`, {
    channelId,
  });
  return unwrap(res);
}

export async function regenerateContent(id: string, channelId: string): Promise<GeneratedContent> {
  const res = await apiClient.post<ApiSuccess<GeneratedContent>>(`/generated-contents/${id}/regenerate`, {
    channelId,
  });
  return unwrap(res);
}

export async function deleteContent(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/generated-contents/${id}`);
  return unwrap(res);
}
