import { useQuery } from '@tanstack/react-query';
import { getContentProfileById } from '../../api/endpoints/content-profiles';
import { ContentProfile } from '../../types/domain';

export function useContentProfileDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<ContentProfile>({
    queryKey: ['content-profile', id],
    queryFn: ({ signal }) => getContentProfileById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
