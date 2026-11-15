import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPrompt,
  createPromptVersion,
  rollbackPromptVersion,
  CreatePromptParams,
  CreatePromptVersionParams,
} from '../../api/endpoints/prompts';
import { useToast } from '../../providers/ToastProvider';

export function useCreatePromptMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: CreatePromptParams) => createPrompt(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast.success('Prompt created successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create prompt');
    },
  });
}

export function useCreatePromptVersionMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: CreatePromptVersionParams }) =>
      createPromptVersion(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', id] });
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', id] });
      toast.success('New prompt version created');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create prompt version');
    },
  });
}

export function useRollbackPromptMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, versionNumber }: { id: string; versionNumber: number }) =>
      rollbackPromptVersion(id, versionNumber),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', id] });
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', id] });
      toast.success('Prompt rolled back successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to rollback prompt');
    },
  });
}
