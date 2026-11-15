import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createJob,
  retryJob,
  cancelJob,
  approveJob,
  rejectJob,
  CreateJobParams,
} from '../../api/endpoints/jobs';
import { useToast } from '../../providers/ToastProvider';

export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: CreateJobParams) => createJob(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Content generation pipeline triggered');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to trigger content generation');
    },
  });
}

export function useRetryJobMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (jobId: string) => retryJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Job retry enqueued');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to retry job');
    },
  });
}

export function useCancelJobMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      toast.info('Job cancelled successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to cancel job');
    },
  });
}

export function useApproveJobMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (jobId: string) => approveJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      toast.success('Content job approved for publication');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Approval failed');
    },
  });
}

export function useRejectJobMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      rejectJob(jobId, reason),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      toast.info('Content job rejected');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Rejection failed');
    },
  });
}
