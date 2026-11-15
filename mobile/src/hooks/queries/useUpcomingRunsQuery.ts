import { useQuery } from '@tanstack/react-query';
import { getUpcomingRuns } from '../../api/endpoints/queue';
import { UpcomingSchedulerRun } from '../../types/domain';

export function useUpcomingRunsQuery(options?: { enabled?: boolean }) {
  return useQuery<UpcomingSchedulerRun[]>({
    queryKey: ['scheduler-upcoming'],
    queryFn: ({ signal }) => getUpcomingRuns(signal),
    enabled: options?.enabled ?? true,
    refetchInterval: 30_000, // Section 9.8: Queue upcoming 30s polling
  });
}
