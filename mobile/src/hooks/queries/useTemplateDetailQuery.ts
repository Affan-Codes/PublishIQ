import { useQuery } from '@tanstack/react-query';
import { getTemplateById } from '../../api/endpoints/templates';
import { Template } from '../../types/domain';

export function useTemplateDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Template>({
    queryKey: ['template', id],
    queryFn: ({ signal }) => getTemplateById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
