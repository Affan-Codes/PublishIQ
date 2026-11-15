import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  duplicateContent,
  regenerateContent,
  deleteContent,
} from '../../api/endpoints/generated-contents';
import { useToast } from '../../providers/ToastProvider';

export function useDuplicateContentMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, channelId }: { id: string; channelId: string }) =>
      duplicateContent(id, channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['generated-contents'] });
      toast.success('Content duplicate pipeline started');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to duplicate content');
    },
  });
}

export function useRegenerateContentMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, channelId }: { id: string; channelId: string }) =>
      regenerateContent(id, channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['generated-contents'] });
      toast.success('Content regeneration pipeline started');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to regenerate content');
    },
  });
}

export function useDeleteContentMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-contents'] });
      toast.success('Generated content record deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete content');
    },
  });
}
