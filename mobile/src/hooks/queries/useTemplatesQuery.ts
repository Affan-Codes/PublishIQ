import { useQuery } from '@tanstack/react-query';
import { getTemplates } from '../../api/endpoints/templates';
import { Template } from '../../types/domain';

export function useTemplatesQuery(options?: { enabled?: boolean }) {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: ({ signal }) => getTemplates(signal),
    enabled: options?.enabled ?? true,
  });
}
