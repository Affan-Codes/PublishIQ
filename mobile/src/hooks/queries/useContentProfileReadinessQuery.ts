import { useQuery } from '@tanstack/react-query';
import { getProfileReadiness, ReadinessCheckResult } from '../../api/endpoints/content-profiles';

export function useContentProfileReadinessQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<ReadinessCheckResult>({
    queryKey: ['content-profile-readiness', id],
    queryFn: ({ signal }) => getProfileReadiness(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
