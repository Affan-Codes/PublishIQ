import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, ContentType, ContentTypeStatus } from '../../types/domain';

export async function getContentTypes(signal?: AbortSignal): Promise<ContentType[]> {
  const res = await apiClient.get<ApiSuccess<ContentType[]>>('/content-types', { signal });
  return unwrap(res);
}

export async function getContentTypeById(id: string, signal?: AbortSignal): Promise<ContentType> {
  const res = await apiClient.get<ApiSuccess<ContentType>>(`/content-types/${id}`, { signal });
  return unwrap(res);
}

export async function createContentType(params: { name: string; status: ContentTypeStatus }): Promise<ContentType> {
  const res = await apiClient.post<ApiSuccess<ContentType>>('/content-types', params);
  return unwrap(res);
}

export async function updateContentType(
  id: string,
  params: { name?: string; status?: ContentTypeStatus }
): Promise<ContentType> {
  const res = await apiClient.put<ApiSuccess<ContentType>>(`/content-types/${id}`, params);
  return unwrap(res);
}

export async function deleteContentType(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/content-types/${id}`);
  return unwrap(res);
}
