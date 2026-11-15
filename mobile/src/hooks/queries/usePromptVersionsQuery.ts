import { useQuery } from '@tanstack/react-query';
import { getPromptVersions } from '../../api/endpoints/prompts';
import { PromptVersion } from '../../types/domain';

export function usePromptVersionsQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<PromptVersion[]>({
    queryKey: ['prompt-versions', id],
    queryFn: ({ signal }) => getPromptVersions(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
