import apiClient from '../client';
import { unwrap, unwrapWithMeta } from '../unwrap';
import { ApiSuccess, Job, JobType, PaginationMeta, PipelineStage } from '../../types/domain';

export interface JobsQueryParams {
  jobType?: JobType;
  pipelineStage?: PipelineStage;
  channelId?: string;
  page?: number;
  limit?: number;
}

export interface CreateJobParams {
  channelId?: string;
  contentProfileId?: string;
  sourceGeneratedContentId?: string;
  dryRun?: boolean;
}

export async function getJobs(
  params?: JobsQueryParams,
  signal?: AbortSignal
): Promise<{ data: Job[]; meta?: PaginationMeta }> {
  const res = await apiClient.get<ApiSuccess<Job[], PaginationMeta>>('/jobs', {
    params,
    signal,
  });
  return unwrapWithMeta(res);
}

export async function getJobById(id: string, signal?: AbortSignal): Promise<Job> {
  const res = await apiClient.get<ApiSuccess<Job>>(`/jobs/${id}`, { signal });
  return unwrap(res);
}

export async function createJob(params: CreateJobParams): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>('/jobs', params);
  return unwrap(res);
}

export async function retryJob(id: string): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>(`/jobs/${id}/retry`);
  return unwrap(res);
}

export async function cancelJob(id: string): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>(`/jobs/${id}/cancel`);
  return unwrap(res);
}

export async function approveJob(id: string): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>(`/jobs/${id}/approve`);
  return unwrap(res);
}

export async function rejectJob(id: string, reason?: string): Promise<Job> {
  const res = await apiClient.post<ApiSuccess<Job>>(`/jobs/${id}/reject`, {
    reason: reason || 'User rejected in Queue Review',
  });
  return unwrap(res);
}
