import { useQuery } from '@tanstack/react-query';
import { getAssetById } from '../../api/endpoints/assets';
import { Asset } from '../../types/domain';

export function useAssetDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Asset>({
    queryKey: ['asset', id],
    queryFn: ({ signal }) => getAssetById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
