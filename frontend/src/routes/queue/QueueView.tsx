import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  ListTodo,
  XCircle,
  RefreshCcw,
  AlertTriangle,
  Clock,
  Eye,
  Check,
  X,
  Activity,
  FileText
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
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedJobForReview, setSelectedJobForReview] = useState<Job | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/queue/stats', { withCredentials: true });
      return res.data;
    },
    refetchInterval: 5000, // Poll statistics every 5 seconds
  });

  const { data: scheduledData } = useQuery<ScheduledRunsResponse>({
    queryKey: ['scheduled-upcoming'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/scheduler/upcoming', { withCredentials: true });
      return res.data;
    },
  });

  const { data: jobsData, isLoading: isJobsLoading } = useQuery<JobsResponse>({
    queryKey: ['queue-jobs', page, stageFilter, typeFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (stageFilter) params.pipelineStage = stageFilter;
      if (typeFilter) params.jobType = typeFilter;

      const res = await axios.get('/api/v1/jobs', { params, withCredentials: true });
      return res.data;
    },
    refetchInterval: 3000, // Refresh running job lists frequently
  });

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/jobs/${id}/cancel`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to cancel job');
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/jobs/${id}/retry`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to retry job');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/jobs/${id}/approve`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      setSelectedJobForReview(null);
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to approve job');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/jobs/${id}/reject`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      setSelectedJobForReview(null);
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to reject job');
    }
  });

  const stats = statsData?.data || { total: 0, waiting: 0, active: 0, delayed: 0, failed: 0, archived: 0 };
  const jobs = jobsData?.data || [];
  const scheduled = scheduledData?.data || [];
  const totalPages = Math.ceil((jobsData?.meta?.total || 0) / 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-purple-400" /> Queue Monitoring
        </h2>
        <p className="text-sm text-[#9c9cb0]">Monitor active background execution pipelines, retry errors, and manage Hybrid approvals</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-200 flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Live Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Jobs', count: stats.total, color: 'text-white', bg: 'bg-[#0e0e12]' },
          { label: 'Waiting', count: stats.waiting, color: 'text-blue-400', bg: 'bg-[#0e0e12]' },
          { label: 'Active (Running)', count: stats.active, color: 'text-purple-400', bg: 'bg-purple-950/10 border-purple-500/20' },
          { label: 'Delayed', count: stats.delayed, color: 'text-yellow-400', bg: 'bg-[#0e0e12]' },
          { label: 'Failed', count: stats.failed, color: 'text-red-400', bg: 'bg-red-950/10 border-red-500/20' },
          { label: 'Archived', count: stats.archived, color: 'text-[#6e6e80]', bg: 'bg-[#0e0e12]' },
        ].map((item, idx) => (
          <div key={idx} className={`rounded-xl border border-[#1a1a24] p-4 text-center ${item.bg}`}>
            <p className="text-xs text-[#6e6e80] font-medium">{item.label}</p>
            <p className={`mt-2 text-2xl font-bold ${item.color}`}>{item.count}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Repeat Schedules */}
      {scheduled.length > 0 && (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" /> Upcoming Repeat Schedules (BullMQ)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#e0e0e6] divide-y divide-[#1a1a24]">
              <thead>
                <tr className="text-xs text-[#6e6e80] font-medium">
                  <th className="pb-3">Channel Name</th>
                  <th className="pb-3">Cron Rule</th>
                  <th className="pb-3">Timezone</th>
                  <th className="pb-3">Next Scheduled Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {scheduled.map((s) => (
                  <tr key={s.key} className="text-xs">
                    <td className="py-3 font-semibold text-white">{s.channelName}</td>
                    <td className="py-3 font-mono text-purple-400">{s.cron}</td>
                    <td className="py-3 text-[#9c9cb0]">{s.tz}</td>
                    <td className="py-3 text-yellow-400 font-medium">
                      {s.next ? new Date(s.next).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active & Historical Jobs Table */}
      <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" /> Execution Registry
          </h3>

          <div className="flex items-center gap-3">
            {/* Filter by Job Type */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-[#e0e0e6] outline-none"
            >
              <option value="">All Job Types</option>
              <option value="ContentPipeline">Content Pipeline</option>
              <option value="Cleanup">Cleanup</option>
              <option value="HealthCheck">Health Check</option>
            </select>

            {/* Filter by Stage */}
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-[#e0e0e6] outline-none"
            >
              <option value="">All Stages</option>
              <option value="Draft">Draft</option>
              <option value="Running">Running</option>
              <option value="Queued">Queued (Approval Pending)</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {isJobsLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-sm text-[#6e6e80]">No matching execution records found</div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#e0e0e6] divide-y divide-[#1a1a24]">
                <thead>
                  <tr className="text-xs text-[#6e6e80] font-medium">
                    <th className="pb-3">Job ID / Type</th>
                    <th className="pb-3">Channel Scope</th>
                    <th className="pb-3">Current Stage</th>
                    <th className="pb-3">Registered At</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a24]">
                  {jobs.map((job) => (
                    <tr key={job.id} className="text-xs">
                      <td className="py-4">
                        <p className="font-mono text-purple-400 font-medium truncate w-32" title={job.id}>
                          {job.id}
                        </p>
                        <p className="text-[10px] text-[#6e6e80] mt-0.5">{job.jobType}</p>
                      </td>
                      <td className="py-4">
                        <p className="font-semibold text-white">{job.channel?.name || 'Workspace Level'}</p>
                        {job.channel && (
                          <p className="text-[10px] text-[#6e6e80] mt-0.5">Mode: {job.channel.automationMode}</p>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              job.pipelineStage === 'Completed'
                                ? 'bg-emerald-500'
                                : job.pipelineStage === 'Failed'
                                ? 'bg-red-500'
                                : job.pipelineStage === 'Running'
                                ? 'bg-purple-500 animate-pulse'
                                : job.pipelineStage === 'Queued'
                                ? 'bg-yellow-500'
                                : 'bg-[#6e6e80]'
                            }`}
                          />
                          <span className="font-medium text-white">{job.pipelineStage || 'N/A'}</span>
                        </div>
                        {job.pipelineStage === 'Failed' && job.failureReason && (
                          <p className="text-[10px] text-red-400 mt-1 max-w-xs truncate" title={job.failureReason}>
                            Error: {job.failureReason}
                          </p>
                        )}
                      </td>
                      <td className="py-4 text-[#9c9cb0]">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 text-right space-x-2">
                        {job.pipelineStage === 'Queued' && (
                          <button
                            onClick={() => setSelectedJobForReview(job)}
                            className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500 hover:text-black transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </button>
                        )}

                        {job.pipelineStage === 'Failed' && (
                          <button
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                            className="inline-flex items-center gap-1 rounded bg-purple-600/10 px-2.5 py-1 text-[11px] font-semibold text-purple-400 border border-purple-500/20 hover:bg-purple-600 hover:text-white transition disabled:opacity-50"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Retry
                          </button>
                        )}

                        {['Draft', 'Running', 'Queued'].includes(job.pipelineStage || '') && (
                          <button
                            onClick={() => cancelMutation.mutate(job.id)}
                            disabled={cancelMutation.isPending}
                            className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#1a1a24] pt-4">
                <span className="text-xs text-[#6e6e80]">
                  Showing Page {page} of {totalPages}
                </span>
                <div className="space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="rounded border border-[#1a1a24] bg-[#161620] px-3 py-1 text-xs text-[#9c9cb0] hover:text-white disabled:opacity-50 transition"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="rounded border border-[#1a1a24] bg-[#161620] px-3 py-1 text-xs text-[#9c9cb0] hover:text-white disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Review and Approval Modal */}
      {selectedJobForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-[#1a1a24] bg-[#0c0c0e] shadow-2xl p-6 sm:p-8 space-y-6 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Review Generated Pipeline Output</h3>
                <p className="text-xs text-[#6e6e80] mt-0.5">Job ID: {selectedJobForReview.id}</p>
              </div>
              <button
                onClick={() => setSelectedJobForReview(null)}
                className="rounded-lg p-1 text-[#9c9cb0] hover:bg-[#161620] hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable content) */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Media Preview Column */}
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Rendered Assets</p>
                  
                  {/* Video Player */}
                  {selectedJobForReview.videoUrl ? (
                    <div className="rounded-xl border border-[#1a1a24] bg-black overflow-hidden aspect-[9/16] max-h-[400px] flex items-center justify-center">
                      <video
                        src={selectedJobForReview.videoUrl}
                        controls
                        className="w-full h-full object-contain"
                        poster={selectedJobForReview.imageUrl || undefined}
                      />
                    </div>
                  ) : selectedJobForReview.imageUrl ? (
                    // Image Preview fallback if video rendering is not done
                    <div className="rounded-xl border border-[#1a1a24] bg-black overflow-hidden aspect-[9/16] max-h-[400px] flex items-center justify-center">
                      <img
                        src={selectedJobForReview.imageUrl}
                        alt="Rendered Canvas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] h-48 flex flex-col items-center justify-center text-center p-4">
                      <AlertTriangle className="h-8 w-8 text-yellow-500/70" />
                      <p className="text-xs text-[#9c9cb0] mt-2 font-medium">No rendered assets available</p>
                    </div>
                  )}
                </div>

                {/* Text Content & Metadata Column */}
                <div className="space-y-6">
                  {/* Quote Text */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Quote Text
                    </p>
                    <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-sm italic text-white text-center leading-relaxed">
                      "{selectedJobForReview.generatedText}"
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Caption</p>
                    <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 text-xs font-mono whitespace-pre-wrap text-[#9c9cb0] leading-relaxed">
                      {selectedJobForReview.caption}
                    </div>
                  </div>

                  {/* Hashtags */}
                  {selectedJobForReview.hashtags && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Hashtags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(selectedJobForReview.hashtags)
                          ? selectedJobForReview.hashtags
                          : JSON.parse(selectedJobForReview.hashtags || '[]')
                        ).map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-400 border border-purple-500/15"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#1a1a24] pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                disabled={rejectMutation.isPending || approveMutation.isPending}
                onClick={() => rejectMutation.mutate(selectedJobForReview.id)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white transition duration-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject and Fail
              </button>

              <button
                disabled={rejectMutation.isPending || approveMutation.isPending}
                onClick={() => approveMutation.mutate(selectedJobForReview.id)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition duration-200 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Approve and Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueView;
