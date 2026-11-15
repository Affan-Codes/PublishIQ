import { useQuery } from '@tanstack/react-query';
import { getJobById } from '../../api/endpoints/jobs';
import { Job } from '../../types/domain';

export function useJobDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Job>({
    queryKey: ['job', id],
    queryFn: ({ signal }) => getJobById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5_000;
      const isTerminal =
        data.pipelineStage === 'Completed' ||
        data.pipelineStage === 'Failed' ||
        data.pipelineStage === 'Archived';
      // Poll every 5s while non-terminal per Section 9.8
      return isTerminal ? false : 5_000;
    },
  });
}
