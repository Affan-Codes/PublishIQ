import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../../api/endpoints/dashboard';
import { DashboardStats } from '../../types/domain';

export function useDashboardStatsQuery(options?: { enabled?: boolean }) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: ({ signal }) => getDashboardStats(signal),
    enabled: options?.enabled ?? true,
    refetchInterval: 15_000, // Section 9.8: Dashboard 15s focus-gated polling
  });
}
