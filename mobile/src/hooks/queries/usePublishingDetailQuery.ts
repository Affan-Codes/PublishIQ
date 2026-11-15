import { useQuery } from '@tanstack/react-query';
import { getPublishingRecordById } from '../../api/endpoints/publishing';
import { PublishingRecord } from '../../types/domain';

export function usePublishingDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<PublishingRecord>({
    queryKey: ['publishing-record', id],
    queryFn: ({ signal }) => getPublishingRecordById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
