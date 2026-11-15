import { useQuery } from '@tanstack/react-query';
import { getWorkspaces } from '../../api/endpoints/workspaces';
import { Workspace } from '../../types/domain';

export function useWorkspacesQuery(options?: { enabled?: boolean }) {
  return useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: ({ signal }) => getWorkspaces(signal),
    enabled: options?.enabled ?? true,
  });
}
