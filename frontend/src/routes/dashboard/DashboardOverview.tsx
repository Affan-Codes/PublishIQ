import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client.js';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Activity, 
  Server, 
  Radio, 
  FileText, 
  AlertTriangle,
  Play,
  History
} from 'lucide-react';

interface FailedJob {
  id: string;
  failedAt: string;
  failureReason: string | null;
  failureStage: string | null;
  retryCount: number;
  channel?: { name: string };
}

interface RecentPublication {
  id: string;
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  status: 'Success' | 'Failure';
  publishedAt: string;
  channel?: { name: string };
  generatedContent?: { text: string };
}

interface DashboardStats {
  counters: {
    totalChannels: number;
    totalGenerations: number;
    totalPublishSuccess: number;
    totalPublishFailure: number;
    successRate: number;
  };
  queues: {
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    completed: number;
  };
  failedJobs: FailedJob[];
  recentPublications: RecentPublication[];
  connections: Array<{
    platform: string;
    healthStatus: string;
    status: string;
  }>;
  health: {
    database: string;
    redis: string;
  };
}

export const DashboardOverview: React.FC = () => {
  const queryClient = useQueryClient();

  // Query dashboard statistics
  const { data, isLoading, refetch } = useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/stats');
      return res.data;
    },
    refetchInterval: 10000, // auto-refresh every 10 seconds for real-time operations!
  });

  // Mutation to retry/re-enqueue a failed job
  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.post(`/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      alert('Job retry enqueued successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to retry job');
    }
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const stats = data.data;

  const cards = [
    { name: 'Channels Running', value: stats.counters.totalChannels.toString(), desc: 'Connected sources', icon: Radio },
    { name: 'AI Generations', value: stats.counters.totalGenerations.toString(), desc: 'Total quotes & Shayari', icon: FileText },
    { name: 'Publish Success Rate', value: `${stats.counters.successRate}%`, desc: `${stats.counters.totalPublishSuccess} success / ${stats.counters.totalPublishFailure} failures`, icon: CheckCircle },
    { name: 'Active Queue Items', value: stats.queues.active.toString(), desc: `${stats.queues.waiting} waiting in line`, icon: Activity },
  ];

  return (
    <div className="space-y-8 p-6 text-white bg-[#0a0a0c] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            System Operations Dashboard
          </h2>
          <p className="text-sm text-[#9c9cb0] mt-1">Real-time status overview of content generation and distribution queues.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 bg-[#161622] hover:bg-[#1d1d2e] rounded-xl border border-[#222235] transition-all"
          title="Refresh Dashboard"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="relative rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
              <div className="absolute top-4 right-4 p-2 bg-purple-600/10 rounded-lg text-purple-400">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">{stat.name}</p>
              <p className="mt-4 text-3xl font-bold text-white group-hover:scale-105 transition-transform duration-300 origin-left">{stat.value}</p>
              <p className="mt-2 text-xs text-[#9c9cb0]">{stat.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column: Recent Pipeline Runs & Failed Jobs */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Publications */}
          <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                Recent Publication Runs
              </h3>
            </div>
            
            {stats.recentPublications.length === 0 ? (
              <p className="text-sm text-[#6e6e80] py-6 text-center">No recent publications registered.</p>
            ) : (
              <div className="space-y-4">
                {stats.recentPublications.map((pub) => (
                  <div key={pub.id} className="flex items-center justify-between border-b border-[#1a1a24]/50 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {pub.channel?.name || 'Unknown Channel'}
                      </p>
                      <p className="text-xs text-[#9c9cb0] mt-1 max-w-md truncate">
                        {pub.generatedContent?.text || 'No preview available'}
                      </p>
                      <p className="text-[10px] text-[#6e6e80] mt-0.5">
                        Platform: {pub.platform} • {new Date(pub.publishedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div>
                      {pub.status === 'Success' ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          Success
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failed Jobs Inspection Panel */}
          <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Failed Pipeline Inspections
            </h3>
            <p className="text-xs text-[#9c9cb0] mt-1">Recent job failures in the automation loop. Review and trigger manual retries.</p>

            {stats.failedJobs.length === 0 ? (
              <p className="text-sm text-[#6e6e80] py-8 text-center">Zero active failures. System running clean!</p>
            ) : (
              <div className="mt-6 space-y-4">
                {stats.failedJobs.map((job) => (
                  <div key={job.id} className="bg-[#151522] border border-[#222235] p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          Channel: {job.channel?.name || 'Manual Generation'}
                        </span>
                        <span className="text-[10px] bg-rose-950/80 border border-rose-500/30 text-rose-400 rounded px-1.5 py-0.5 uppercase">
                          Failed at: {job.failureStage || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-xs text-rose-300 mt-2 font-mono whitespace-pre-wrap max-h-16 overflow-y-auto bg-[#0b0b11] p-2 rounded border border-[#1b1b26]">
                        {job.failureReason || 'No error details found.'}
                      </p>
                      <div className="text-[10px] text-[#6e6e80] mt-2">
                        Retries: {job.retryCount} • Time: {new Date(job.failedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => retryJobMutation.mutate(job.id)}
                      disabled={retryJobMutation.isPending}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Retry Run
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: System status, connections, & Queue breakdown */}
        <div className="space-y-8">
          {/* System Health */}
          <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-400" />
              Infrastructure Health
            </h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9c9cb0]">PostgreSQL Connection</span>
                {stats.health.database === 'Healthy' ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Offline
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9c9cb0]">Redis Cluster Service</span>
                {stats.health.redis === 'Healthy' ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Offline
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9c9cb0]">BullMQ Pipeline Worker</span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Active
                </span>
              </div>
            </div>
          </div>

          {/* Queue Status counts */}
          <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Pipeline Queue Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#13131d] border border-[#20202e] p-4 rounded-xl">
                <span className="text-xs text-[#8c8c9e]">Active Jobs</span>
                <div className="text-xl font-bold text-white mt-1">{stats.queues.active}</div>
              </div>
              <div className="bg-[#13131d] border border-[#20202e] p-4 rounded-xl">
                <span className="text-xs text-[#8c8c9e]">Waiting</span>
                <div className="text-xl font-bold text-white mt-1">{stats.queues.waiting}</div>
              </div>
              <div className="bg-[#13131d] border border-[#20202e] p-4 rounded-xl">
                <span className="text-xs text-[#8c8c9e]">Delayed</span>
                <div className="text-xl font-bold text-white mt-1">{stats.queues.delayed}</div>
              </div>
              <div className="bg-[#13131d] border border-[#20202e] p-4 rounded-xl">
                <span className="text-xs text-[#8c8c9e]">Failed Queue</span>
                <div className="text-xl font-bold text-rose-400 mt-1">{stats.queues.failed}</div>
              </div>
            </div>
          </div>

          {/* Integration Platforms status */}
          <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <h3 className="text-lg font-bold text-white">Platform Adaptations</h3>
            <div className="mt-4 space-y-4 max-h-60 overflow-y-auto">
              {stats.connections.length === 0 ? (
                <p className="text-xs text-[#6e6e80]">No active platform connections.</p>
              ) : (
                stats.connections.map((conn, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-white">{conn.platform}</span>
                    <div className="flex gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        conn.healthStatus === 'Healthy' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {conn.healthStatus}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        conn.status === 'Active' 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        {conn.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
