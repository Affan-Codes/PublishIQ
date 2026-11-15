import { useQuery } from '@tanstack/react-query';
import { getAssets, AssetsQueryParams } from '../../api/endpoints/assets';
import { Asset } from '../../types/domain';

export function useAssetsQuery(params?: AssetsQueryParams, options?: { enabled?: boolean }) {
  return useQuery<Asset[]>({
    queryKey: ['assets', params?.type],
    queryFn: ({ signal }) => getAssets(params, signal),
    enabled: options?.enabled ?? true,
  });
}
