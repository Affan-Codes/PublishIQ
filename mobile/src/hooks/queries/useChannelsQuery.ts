import { useQuery } from '@tanstack/react-query';
import { getChannels } from '../../api/endpoints/channels';
import { Channel } from '../../types/domain';

export function useChannelsQuery(options?: { enabled?: boolean }) {
  return useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: ({ signal }) => getChannels(signal),
    enabled: options?.enabled ?? true,
  });
}
