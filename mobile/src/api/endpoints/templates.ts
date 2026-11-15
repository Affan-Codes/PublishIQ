import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, Template } from '../../types/domain';

export async function getTemplates(signal?: AbortSignal): Promise<Template[]> {
  const res = await apiClient.get<ApiSuccess<Template[]>>('/templates', { signal });
  return unwrap(res);
}

export async function getTemplateById(id: string, signal?: AbortSignal): Promise<Template> {
  const res = await apiClient.get<ApiSuccess<Template>>(`/templates/${id}`, { signal });
  return unwrap(res);
}

export async function getTemplateVersionPreview(
  id: string,
  versionNumber: number,
  signal?: AbortSignal
): Promise<{ previewImageUrl: string | null }> {
  const res = await apiClient.get<ApiSuccess<{ previewImageUrl: string | null }>>(
    `/templates/${id}/versions/${versionNumber}/preview`,
    { signal }
  );
  return unwrap(res);
}

export async function rollbackTemplateVersion(id: string, versionNumber: number): Promise<Template> {
  const res = await apiClient.post<ApiSuccess<Template>>(
    `/templates/${id}/versions/${versionNumber}/rollback`
  );
  return unwrap(res);
}
