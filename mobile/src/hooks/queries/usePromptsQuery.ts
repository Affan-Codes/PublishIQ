import { useQuery } from '@tanstack/react-query';
import { getPrompts } from '../../api/endpoints/prompts';
import { Prompt } from '../../types/domain';

export function usePromptsQuery(options?: { enabled?: boolean }) {
  return useQuery<Prompt[]>({
    queryKey: ['prompts'],
    queryFn: ({ signal }) => getPrompts(signal),
    enabled: options?.enabled ?? true,
  });
}
