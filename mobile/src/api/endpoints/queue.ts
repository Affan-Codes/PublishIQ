import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, QueueStats, UpcomingSchedulerRun } from '../../types/domain';

export async function getQueueStats(signal?: AbortSignal): Promise<QueueStats> {
  const res = await apiClient.get<ApiSuccess<QueueStats>>('/queue/stats', { signal });
  return unwrap(res);
}

export async function getUpcomingRuns(signal?: AbortSignal): Promise<UpcomingSchedulerRun[]> {
  const res = await apiClient.get<ApiSuccess<UpcomingSchedulerRun[]>>('/scheduler/upcoming', { signal });
  return unwrap(res);
}
