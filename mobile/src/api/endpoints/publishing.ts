import apiClient from '../client';
import { unwrap, unwrapWithMeta } from '../unwrap';
import { ApiSuccess, PaginationMeta, Platform, PublishRecordStatus, PublishingRecord } from '../../types/domain';

export interface PublishingQueryParams {
  platform?: Platform;
  channelId?: string;
  status?: PublishRecordStatus;
  contentTypeSnapshot?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getPublishingHistory(
  params?: PublishingQueryParams,
  signal?: AbortSignal
): Promise<{ data: PublishingRecord[]; meta?: PaginationMeta }> {
  const res = await apiClient.get<ApiSuccess<PublishingRecord[], PaginationMeta>>('/publishing-history', {
    params,
    signal,
  });
  return unwrapWithMeta(res);
}

export async function getPublishingRecordById(id: string, signal?: AbortSignal): Promise<PublishingRecord> {
  const res = await apiClient.get<ApiSuccess<PublishingRecord>>(`/publishing-history/${id}`, { signal });
  return unwrap(res);
}

export async function retryPublishing(id: string): Promise<PublishingRecord> {
  const res = await apiClient.post<ApiSuccess<PublishingRecord>>(`/publishing-history/${id}/retry`);
  return unwrap(res);
}

/**
 * Correct backend endpoint for republishing content:
 * POST /publishing-history/republish with { generatedContentId, channelId }
 */
export async function republishContent(
  generatedContentId: string,
  channelId: string
): Promise<PublishingRecord> {
  const res = await apiClient.post<ApiSuccess<PublishingRecord>>('/publishing-history/republish', {
    generatedContentId,
    channelId,
  });
  return unwrap(res);
}
