import { useQuery } from '@tanstack/react-query';
import { getGeneratedContentById } from '../../api/endpoints/generated-contents';
import { GeneratedContent } from '../../types/domain';

export function useGeneratedContentDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<GeneratedContent>({
    queryKey: ['generated-content', id],
    queryFn: ({ signal }) => getGeneratedContentById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
