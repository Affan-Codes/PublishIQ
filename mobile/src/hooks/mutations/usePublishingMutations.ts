import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retryPublishing, republishContent } from '../../api/endpoints/publishing';
import { useToast } from '../../providers/ToastProvider';

export function useRetryPublishMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => retryPublishing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Publishing retry enqueued');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to retry publishing');
    },
  });
}

export function useRepublishMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      generatedContentId,
      channelId,
    }: {
      generatedContentId: string;
      channelId: string;
    }) => republishContent(generatedContentId, channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Content republishing triggered successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Republish failed');
    },
  });
}
