import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonTable } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import {
  ListTodo,
  XCircle,
  RefreshCcw,
  Clock,
  Eye,
  Check,
  X,
  Activity
} from 'lucide-react';

interface Job {
  id: string;
  jobType: string;
  channelId: string | null;
  channel?: { name: string; automationMode: string } | null;
  pipelineStage: string | null;
  failureStage: string | null;
  failureReason: string | null;
  generatedText: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  caption: string | null;
  hashtags: any | null;
  createdAt: string;
}

interface JobsResponse {
  success: boolean;
  data: Job[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

interface StatsResponse {
  success: boolean;
  data: {
    total: number;
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    archived: number;
  };
}

interface ScheduledRun {
  key: string;
  name: string;
  cron: string;
  next: string | null;
  tz: string;
  channelId: string;
  channelName: string;
}

interface ScheduledRunsResponse {
  success: boolean;
  data: ScheduledRun[];
}

export const QueueView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedJobForReview, setSelectedJobForReview] = useState<Job | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  // Queries
  const { data: statsData, isFetching: isStatsFetching, refetch: refetchStats } = useQuery<StatsResponse>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/queue/stats', { withCredentials: true });
      return res.data;
    },
    refetchInterval: 5000,
  });

  const { data: scheduledData, refetch: refetchScheduled } = useQuery<ScheduledRunsResponse>({
    queryKey: ['scheduled-upcoming'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/scheduler/upcoming', { withCredentials: true });
      return res.data;
    },
  });

  const { data: jobsData, isLoading: isJobsLoading, isFetching: isJobsFetching, isError, error, refetch: refetchJobs } = useQuery<JobsResponse>({
    queryKey: ['queue-jobs', page, stageFilter, typeFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (stageFilter) params.pipelineStage = stageFilter;
      if (typeFilter) params.jobType = typeFilter;

      const res = await axios.get('/api/v1/jobs', { params, withCredentials: true });
      return res.data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 3000,
  });

  const handleRefreshAll = () => {
    refetchStats();
    refetchScheduled();
    refetchJobs();
  };

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionJobId(id);
      await axios.post(`/api/v1/jobs/${id}/cancel`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      addToast('Job cancelled successfully', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to cancel job', 'error');
    },
    onSettled: () => setActionJobId(null),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionJobId(id);
      await axios.post(`/api/v1/jobs/${id}/retry`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      addToast('Job retry enqueued', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to retry job', 'error');
    },
    onSettled: () => setActionJobId(null),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionJobId(id);
      await axios.post(`/api/v1/jobs/${id}/approve`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      addToast('Content job approved for publication', 'success');
      setSelectedJobForReview(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Approval failed', 'error');
    },
    onSettled: () => setActionJobId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionJobId(id);
      await axios.post(`/api/v1/jobs/${id}/reject`, { reason: 'User rejected in Queue Review' }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      addToast('Content job rejected', 'info');
      setSelectedJobForReview(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Rejection failed', 'error');
    },
    onSettled: () => setActionJobId(null),
  });

  const stats = statsData?.data || { total: 0, waiting: 0, active: 0, delayed: 0, failed: 0, archived: 0 };
  const jobsList = jobsData?.data || [];
  const scheduledRuns = scheduledData?.data || [];
  const meta = jobsData?.meta || { total: 0, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  const formatMediaUrl = (urlPath: string | null) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http')) return urlPath;
    return `http://localhost:4000${urlPath}`;
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="text-purple-400" />
              Queue Management & Review
            </h2>
            <p className="text-sm text-[#9c9cb0]">Inspect active BullMQ background workers and hybrid approval gates</p>
          </div>
          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isJobsFetching} />
        </div>
        <ErrorState
          title="Failed to load queue status"
          message={(error as any)?.message || 'An error occurred while communicating with BullMQ background services.'}
          onRetry={handleRefreshAll}
          onRefresh={handleRefreshAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="text-purple-400" />
            Queue Management & Review
          </h2>
          <p className="text-sm text-[#9c9cb0]">Inspect active BullMQ background workers and hybrid approval gates</p>
        </div>
        <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isJobsFetching || isStatsFetching} title="Refresh queue metrics" />
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Total Items</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Active</span>
          <div className="text-2xl font-bold text-purple-400 mt-1">{stats.active}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Waiting</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.waiting}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Delayed</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats.delayed}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Failed</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{stats.failed}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Archived</span>
          <div className="text-2xl font-bold text-gray-400 mt-1">{stats.archived}</div>
        </div>
      </div>

      {/* Upcoming Cron Runs Bar */}
      {scheduledRuns.length > 0 && (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] flex items-center gap-1.5">
            <Clock size={14} className="text-purple-400" />
            Upcoming Automated Channel Schedules
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1 text-xs">
            {scheduledRuns.map((run) => (
              <div key={run.key} className="bg-[#14141e] border border-[#1a1a24] p-3 rounded-lg flex-shrink-0 space-y-1 min-w-[200px]">
                <div className="font-semibold text-white">{run.channelName}</div>
                <div className="text-[10px] text-[#6e6e80] font-mono">Cron: {run.cron}</div>
                <div className="text-[10px] text-purple-300">
                  Next: {run.next ? new Date(run.next).toLocaleString() : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24]">
        <span className="text-sm font-semibold text-white">Pipeline Execution Items</span>

        <div className="flex gap-3">
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
          >
            <option value="">All Pipeline Stages</option>
            <option value="Queued">Queued (Awaiting Approval)</option>
            <option value="Published">Published</option>
            <option value="Failed">Failed</option>
            <option value="Archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
          >
            <option value="">All Job Types</option>
            <option value="CONTENT_PIPELINE">CONTENT_PIPELINE</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </div>
      </div>

      {/* Table / Empty State */}
      {isJobsLoading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : jobsList.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Queue is clean"
          description="Zero pending queue tasks. Trigger manual generations or wait for automated cron schedules."
        />
      ) : (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#e0e0e6]">
              <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
                <tr>
                  <th className="px-6 py-4">Job ID & Type</th>
                  <th className="px-6 py-4">Channel & Mode</th>
                  <th className="px-6 py-4">Stage Status</th>
                  <th className="px-6 py-4">Created Time</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {jobsList.map((job) => (
                  <tr key={job.id} className="hover:bg-[#161620]/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-semibold text-purple-400">
                        {job.id.slice(0, 8)}...
                      </div>
                      <div className="text-[10px] text-[#6e6e80]">{job.jobType}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{job.channel?.name || 'Manual Generation'}</div>
                      <div className="text-[10px] text-[#6e6e80] font-mono">
                        {job.channel?.automationMode || 'Manual'} Mode
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${job.pipelineStage === 'Published' || job.pipelineStage === 'Queued'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : job.pipelineStage === 'Failed'
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}
                      >
                        {job.pipelineStage === 'Queued' ? 'Ready (Awaiting Review)' : job.pipelineStage}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {job.pipelineStage === 'Queued' && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={Eye}
                            onClick={() => setSelectedJobForReview(job)}
                          >
                            Review
                          </Button>
                        )}

                        {job.pipelineStage === 'Failed' && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={RefreshCcw}
                            isLoading={retryMutation.isPending && actionJobId === job.id}
                            loadingText="Retrying..."
                            onClick={() => retryMutation.mutate(job.id)}
                          >
                            Retry
                          </Button>
                        )}

                        {job.pipelineStage !== 'Published' && job.pipelineStage !== 'Failed' && job.pipelineStage !== 'Archived' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={XCircle}
                            isLoading={cancelMutation.isPending && actionJobId === job.id}
                            loadingText="Cancelling..."
                            onClick={() => cancelMutation.mutate(job.id)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#161620] px-6 py-4">
              <span className="text-xs text-[#9c9cb0]">
                Page <span className="font-semibold text-white">{page}</span> of{' '}
                <span className="font-semibold text-white">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hybrid Approval Review Drawer */}
      {selectedJobForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-400" />
                  Hybrid Approval Gate
                </h3>
                <p className="text-xs text-[#9c9cb0]">
                  Channel: {selectedJobForReview.channel?.name || 'Manual Run'}
                </p>
              </div>
              <button onClick={() => setSelectedJobForReview(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Render Output Artifacts */}
            <div className="space-y-4">
              <div className="bg-[#13131d] p-4 rounded-xl border border-[#20202e]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Quote Text</span>
                <p className="text-sm font-semibold text-white mt-1">"{selectedJobForReview.generatedText}"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedJobForReview.imageUrl && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Compiled PNG</span>
                    <img
                      src={formatMediaUrl(selectedJobForReview.imageUrl)}
                      alt="Rendered"
                      className="mt-1.5 h-36 w-full object-cover rounded-lg border border-[#1a1a24]"
                    />
                  </div>
                )}
                {selectedJobForReview.videoUrl && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Rendered MP4 Short</span>
                    <video
                      src={formatMediaUrl(selectedJobForReview.videoUrl)}
                      controls
                      className="mt-1.5 h-36 w-full object-cover rounded-lg border border-[#1a1a24]"
                    />
                  </div>
                )}
              </div>

              {selectedJobForReview.caption && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Caption & Tags</span>
                  <p className="text-xs text-[#9c9cb0] mt-1 bg-[#14141e] p-3 rounded-lg border border-[#1a1a24]">
                    {selectedJobForReview.caption}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedJobForReview(null)}
              >
                Close
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={X}
                isLoading={rejectMutation.isPending}
                loadingText="Rejecting..."
                onClick={() => rejectMutation.mutate(selectedJobForReview.id)}
              >
                Reject Post
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                isLoading={approveMutation.isPending}
                loadingText="Approving..."
                onClick={() => approveMutation.mutate(selectedJobForReview.id)}
              >
                Approve & Publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueView;
