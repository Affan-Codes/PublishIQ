import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createChannel,
  updateChannel,
  deleteChannel,
  duplicateChannel,
  CreateChannelParams,
  UpdateChannelParams,
} from '../../api/endpoints/channels';
import { useToast } from '../../providers/ToastProvider';

export function useCreateChannelMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: CreateChannelParams) => createChannel(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel created successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create channel');
    },
  });
}

export function useUpdateChannelMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: UpdateChannelParams }) =>
      updateChannel(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channel', id] });
      toast.success('Channel updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update channel');
    },
  });
}

export function useDeleteChannelMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete channel');
    },
  });
}

export function useDuplicateChannelMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => duplicateChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel duplicated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to duplicate channel');
    },
  });
}
