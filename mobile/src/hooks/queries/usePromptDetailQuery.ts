import { useQuery } from '@tanstack/react-query';
import { getPromptById } from '../../api/endpoints/prompts';
import { Prompt } from '../../types/domain';

export function usePromptDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Prompt>({
    queryKey: ['prompt', id],
    queryFn: ({ signal }) => getPromptById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
