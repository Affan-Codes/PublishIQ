import { useQuery } from '@tanstack/react-query';
import { getConnections } from '../../api/endpoints/connections';
import { PlatformConnection } from '../../types/domain';

export function useConnectionsQuery(options?: { enabled?: boolean }) {
  return useQuery<PlatformConnection[]>({
    queryKey: ['platform-connections'],
    queryFn: ({ signal }) => getConnections(signal),
    enabled: options?.enabled ?? true,
  });
}
