import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, DashboardStats } from '../../types/domain';

export async function getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
  const res = await apiClient.get<ApiSuccess<DashboardStats>>('/dashboard/stats', { signal });
  return unwrap(res);
}
