import { useQuery } from '@tanstack/react-query';
import { getOutputContract } from '../../api/endpoints/prompts';

export function usePromptOutputContractQuery(options?: { enabled?: boolean }) {
  return useQuery<Record<string, unknown>>({
    queryKey: ['prompt-output-contract'],
    queryFn: ({ signal }) => getOutputContract(signal),
    enabled: options?.enabled ?? true,
  });
}
