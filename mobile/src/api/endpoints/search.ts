import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, SearchResults } from '../../types/domain';

export async function searchAll(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const res = await apiClient.get<ApiSuccess<SearchResults>>('/search', {
    params: { q: query },
    signal,
  });
  return unwrap(res);
}
