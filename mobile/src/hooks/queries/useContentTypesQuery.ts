import { useQuery } from '@tanstack/react-query';
import { getContentTypes } from '../../api/endpoints/content-types';
import { ContentType } from '../../types/domain';

export function useContentTypesQuery(options?: { enabled?: boolean }) {
  return useQuery<ContentType[]>({
    queryKey: ['content-types'],
    queryFn: ({ signal }) => getContentTypes(signal),
    enabled: options?.enabled ?? true,
  });
}
