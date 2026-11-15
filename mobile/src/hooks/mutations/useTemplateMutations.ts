import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rollbackTemplateVersion } from '../../api/endpoints/templates';
import { useToast } from '../../providers/ToastProvider';

export function useRollbackTemplateMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, versionNumber }: { id: string; versionNumber: number }) =>
      rollbackTemplateVersion(id, versionNumber),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', id] });
      toast.success('Template rolled back successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to rollback template');
    },
  });
}
