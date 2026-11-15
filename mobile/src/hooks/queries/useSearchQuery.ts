import { useQuery } from '@tanstack/react-query';
import { searchAll } from '../../api/endpoints/search';
import { SearchResults } from '../../types/domain';

export function useSearchQuery(query: string, enabled?: boolean) {
  const trimmed = query.trim();
  const isEligible = (enabled !== undefined ? enabled : true) && trimmed.length >= 2;

  return useQuery<SearchResults>({
    queryKey: ['search', trimmed],
    queryFn: ({ signal }) => searchAll(trimmed, signal),
    enabled: isEligible,
  });
}
