import { useQuery } from '@tanstack/react-query';
import { getQueueStats } from '../../api/endpoints/queue';
import { QueueStats } from '../../types/domain';

export function useQueueStatsQuery(options?: { enabled?: boolean }) {
  return useQuery<QueueStats>({
    queryKey: ['queue-stats'],
    queryFn: ({ signal }) => getQueueStats(signal),
    enabled: options?.enabled ?? true,
    refetchInterval: 10_000, // Section 9.8: Queue stats 10s polling
  });
}
