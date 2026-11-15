import { useQuery } from '@tanstack/react-query';
import { getTemplateVersionPreview } from '../../api/endpoints/templates';

export function useTemplatePreviewQuery(
  id: string,
  versionNumber: number,
  options?: { enabled?: boolean }
) {
  return useQuery<{ previewImageUrl: string | null }>({
    queryKey: ['template-preview', id, versionNumber],
    queryFn: ({ signal }) => getTemplateVersionPreview(id, versionNumber, signal),
    enabled: Boolean(id) && Boolean(versionNumber) && (options?.enabled ?? true),
  });
}
