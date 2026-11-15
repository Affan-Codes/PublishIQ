import { useQuery } from '@tanstack/react-query';
import { getChannelById } from '../../api/endpoints/channels';
import { Channel } from '../../types/domain';

export function useChannelDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Channel>({
    queryKey: ['channel', id],
    queryFn: ({ signal }) => getChannelById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
