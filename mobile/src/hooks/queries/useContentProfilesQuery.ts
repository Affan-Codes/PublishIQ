import { useQuery } from '@tanstack/react-query';
import { getContentProfiles } from '../../api/endpoints/content-profiles';
import { ContentProfile } from '../../types/domain';

export function useContentProfilesQuery(options?: { enabled?: boolean }) {
  return useQuery<ContentProfile[]>({
    queryKey: ['content-profiles'],
    queryFn: ({ signal }) => getContentProfiles(signal),
    enabled: options?.enabled ?? true,
  });
}
