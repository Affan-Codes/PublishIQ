import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonTable, SkeletonCard } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import {
  Plus,
  X,
  AlertTriangle,
  Image as ImageIcon,
  Video,
  FileText,
  RotateCcw,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Trash2,
  Copy,
  RefreshCw
} from 'lucide-react';

// Form validation schemas
const triggerGenSchema = z.object({
  channelId: z.string().uuid('Please select a valid channel'),
});

const actionChannelSchema = z.object({
  channelId: z.string().uuid('Please select a valid channel'),
});

type TriggerGenValues = z.infer<typeof triggerGenSchema>;

export const JobsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'jobs' | 'content'>('jobs');

  // Search & Filter state for Jobs
  const [jobSearch, setJobSearch] = useState('');
  const [jobChannelFilter, setJobChannelFilter] = useState('');
  const [jobStageFilter, setJobStageFilter] = useState('');
  const [jobPage, setJobPage] = useState(1);

  // Search & Filter state for Generated Content
  const [gcSearch, setGcSearch] = useState('');
  const [gcProfileFilter, setGcProfileFilter] = useState('');
  const [gcLangFilter, setGcLangFilter] = useState('');
  const [gcPage, setGcPage] = useState(1);

  // Modals/Dialogs state
  const [isTriggerGenOpen, setIsTriggerGenOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [previewContentId, setPreviewContentId] = useState<string | null>(null);
  
  const [duplicateContentId, setDuplicateContentId] = useState<string | null>(null);
  const [regenerateContentId, setRegenerateContentId] = useState<string | null>(null);
  const [deletingContentId, setDeletingContentId] = useState<string | null>(null);

  const [errorText, setErrorText] = useState<string | null>(null);

  // Zod forms
  const { register: registerGen, handleSubmit: handleSubmitGen, reset: resetGen, formState: { errors: genErrors } } = useForm<TriggerGenValues>({
    resolver: zodResolver(triggerGenSchema),
  });

  const { register: registerAction, handleSubmit: handleSubmitAction, reset: resetAction, formState: { errors: actionErrors } } = useForm<{ channelId: string }>({
    resolver: zodResolver(actionChannelSchema),
  });

  // Queries
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ['channels-list'],
    queryFn: async () => {
      const res = await apiClient.get('/channels');
      return res.data.data;
    },
  });

  const { data: contentProfiles = [] } = useQuery<any[]>({
    queryKey: ['content-profiles-list'],
    queryFn: async () => {
      const res = await apiClient.get('/content-profiles');
      return res.data.data;
    },
  });

  // Fetch Jobs list
  const { 
    data: jobsData = { data: [], meta: { total: 0 } }, 
    isLoading: isJobsLoading, 
    isFetching: isJobsFetching,
    isError: isJobsError,
    error: jobsError,
    refetch: refetchJobs 
  } = useQuery<any>({
    queryKey: ['jobs', jobPage, jobChannelFilter, jobStageFilter],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: jobPage,
        limit: 8,
      };
      if (jobChannelFilter) params.channelId = jobChannelFilter;
      if (jobStageFilter) params.pipelineStage = jobStageFilter;

      const res = await apiClient.get('/jobs', { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: activeTab === 'jobs' ? 5000 : false,
  });

  // Fetch Job details
  const { data: selectedJob = null, isLoading: isJobDetailLoading } = useQuery<any>({
    queryKey: ['job', selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return null;
      const res = await apiClient.get(`/jobs/${selectedJobId}`);
      return res.data.data;
    },
    enabled: !!selectedJobId,
    refetchInterval: !!selectedJobId ? 3000 : false,
  });

  // Fetch Generated Content list
  const { 
    data: gcData = { data: [], meta: { total: 0 } }, 
    isLoading: isGcLoading,
    isFetching: isGcFetching,
    isError: isGcError,
    error: gcError,
    refetch: refetchGc 
  } = useQuery<any>({
    queryKey: ['generated-contents', gcPage, gcProfileFilter, gcLangFilter, gcSearch],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: gcPage,
        limit: 6,
      };
      if (gcProfileFilter) params.contentProfileId = gcProfileFilter;
      if (gcLangFilter) params.language = gcLangFilter;
      if (gcSearch) params.search = gcSearch;

      const res = await apiClient.get('/generated-contents', { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Fetch single Generated Content details
  const { data: previewContent = null } = useQuery<any>({
    queryKey: ['generated-content', previewContentId],
    queryFn: async () => {
      if (!previewContentId) return null;
      const res = await apiClient.get(`/generated-contents/${previewContentId}`);
      return res.data.data;
    },
    enabled: !!previewContentId,
  });

  const handleRefresh = () => {
    if (activeTab === 'jobs') {
      refetchJobs();
    } else {
      refetchGc();
    }
  };

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: async (values: TriggerGenValues) => {
      await apiClient.post('/jobs', { channelId: values.channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      addToast('Content generation job triggered successfully', 'success');
      setIsTriggerGenOpen(false);
      resetGen();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to trigger content generation');
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.post(`/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', selectedJobId] });
      addToast('Job retry enqueued successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to retry job', 'error');
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.post(`/jobs/${jobId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', selectedJobId] });
      addToast('Job cancelled successfully', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to cancel job', 'error');
    },
  });

  const duplicateContentMutation = useMutation({
    mutationFn: async (values: { channelId: string }) => {
      await apiClient.post(`/generated-contents/${duplicateContentId}/duplicate`, { channelId: values.channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      addToast('Content duplicate pipeline started', 'success');
      setDuplicateContentId(null);
      resetAction();
      setActiveTab('jobs');
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to duplicate content');
    },
  });

  const regenerateContentMutation = useMutation({
    mutationFn: async (values: { channelId: string }) => {
      await apiClient.post(`/generated-contents/${regenerateContentId}/regenerate`, { channelId: values.channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      addToast('Content regeneration pipeline started', 'success');
      setRegenerateContentId(null);
      resetAction();
      setActiveTab('jobs');
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to regenerate content');
    },
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/generated-contents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-contents'] });
      addToast('Generated content record deleted', 'success');
      setDeletingContentId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete content', 'error');
    },
  });

  // Helpers
  const formatMediaUrl = (urlPath: string | null) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http')) return urlPath;
    return `http://localhost:4000${urlPath}`;
  };

  const getStageColor = (stage: string, currentStage: string | null, isFailed: boolean) => {
    const pipelineStages = [
      'Draft',
      'GeneratingContent',
      'Validating',
      'GeneratingImage',
      'SelectingMusic',
      'GeneratingVideo',
      'GeneratingCaption',
      'GeneratingHashtags',
      'Queued',
    ];

    if (stage === currentStage) {
      return isFailed ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-purple-500/20 border-purple-500 text-purple-400 animate-pulse';
    }

    const stageIdx = pipelineStages.indexOf(stage);
    const currentIdx = currentStage ? pipelineStages.indexOf(currentStage) : -1;

    if (currentIdx === -1) return 'bg-[#161622] border-[#222233] text-gray-500';

    if (stageIdx < currentIdx) {
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    }

    return 'bg-[#161622] border-[#222233] text-gray-600';
  };

  const filteredJobs = jobsData.data.filter((job: any) => {
    if (!jobSearch) return true;
    return (
      job.id.toLowerCase().includes(jobSearch.toLowerCase()) ||
      (job.channel?.name || '').toLowerCase().includes(jobSearch.toLowerCase())
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="text-purple-400" />
            AI Content Pipeline
          </h2>
          <p className="text-sm text-[#9c9cb0]">Orchestrate content generation, rendering engine, and asset compiling</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton
            onRefresh={handleRefresh}
            isRefreshing={activeTab === 'jobs' ? isJobsFetching : isGcFetching}
            title="Refresh jobs & content"
          />
          <Button icon={Plus} onClick={() => { setErrorText(null); setIsTriggerGenOpen(true); }}>
            Trigger Generation
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a24] gap-6 text-sm">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-4 font-semibold transition cursor-pointer ${
            activeTab === 'jobs' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Job Executions
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`pb-4 font-semibold transition cursor-pointer ${
            activeTab === 'content' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Generated Content Gallery
        </button>
      </div>

      {/* Contents */}
      {activeTab === 'jobs' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24]">
            <div className="flex items-center gap-3 w-full sm:w-auto relative">
              <Search className="absolute left-3 text-[#6e6e80]" size={16} />
              <input
                type="text"
                placeholder="Search jobs by ID or channel..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="w-full sm:w-72 rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <select
                value={jobChannelFilter}
                onChange={(e) => {
                  setJobChannelFilter(e.target.value);
                  setJobPage(1);
                }}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
              >
                <option value="">All Channels</option>
                {channels.map((ch: any) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>

              <select
                value={jobStageFilter}
                onChange={(e) => {
                  setJobStageFilter(e.target.value);
                  setJobPage(1);
                }}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
              >
                <option value="">All Stages</option>
                <option value="Draft">Draft</option>
                <option value="GeneratingContent">Generating Content</option>
                <option value="Validating">Validating</option>
                <option value="GeneratingImage">Generating Image</option>
                <option value="SelectingMusic">Selecting Music</option>
                <option value="GeneratingVideo">Generating Video</option>
                <option value="GeneratingCaption">Generating Caption</option>
                <option value="GeneratingHashtags">Generating Hashtags</option>
                <option value="Queued">Queued (Ready)</option>
                <option value="Failed">Failed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Job Executions Table */}
          {isJobsError ? (
            <ErrorState
              title="Failed to load job executions"
              message={(jobsError as any)?.message || 'An error occurred while fetching pipeline jobs.'}
              onRetry={refetchJobs}
              onRefresh={refetchJobs}
            />
          ) : isJobsLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No job executions found"
              description="Trigger content generation manually or connect channels to execute automated rendering pipelines."
              actionLabel="Trigger Generation"
              onAction={() => setIsTriggerGenOpen(true)}
            />
          ) : (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
              <table className="w-full text-left text-sm text-[#e0e0e6]">
                <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
                  <tr>
                    <th className="px-6 py-4">Job ID</th>
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">Stage</th>
                    <th className="px-6 py-4">Attempts</th>
                    <th className="px-6 py-4">Execution Time</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a24]">
                  {filteredJobs.map((job: any) => (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className="hover:bg-[#161620]/30 transition cursor-pointer group"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-purple-400 font-semibold group-hover:text-purple-300">
                        {job.id.slice(0, 8)}...{job.id.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">{job.channel?.name || 'Manual Run'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          job.pipelineStage === 'Published' || job.pipelineStage === 'Queued'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : job.pipelineStage === 'Failed'
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                        }`}>
                          {job.pipelineStage === 'Queued' ? 'Ready (Queued)' : job.pipelineStage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#9c9cb0]">{job.retryCount + 1}</td>
                      <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="text-purple-400 hover:text-purple-300 font-semibold text-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Eye size={14} />
                          Monitor Pipeline
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#161620] px-6 py-4">
                <span className="text-xs text-[#9c9cb0]">
                  Showing <span className="font-semibold text-white">{filteredJobs.length}</span> jobs
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={jobPage === 1}
                    onClick={() => setJobPage(p => Math.max(p - 1, 1))}
                    className="rounded border border-[#1a1a24] bg-[#0e0e12] p-1.5 text-[#9c9cb0] hover:text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={jobsData.data.length < 8}
                    onClick={() => setJobPage(p => p + 1)}
                    className="rounded border border-[#1a1a24] bg-[#0e0e12] p-1.5 text-[#9c9cb0] hover:text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Generated Content Gallery Tab */
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24]">
            <div className="flex items-center gap-3 w-full sm:w-auto relative">
              <Search className="absolute left-3 text-[#6e6e80]" size={16} />
              <input
                type="text"
                placeholder="Search quotes or Shayari..."
                value={gcSearch}
                onChange={(e) => setGcSearch(e.target.value)}
                className="w-full sm:w-72 rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <select
                value={gcProfileFilter}
                onChange={(e) => {
                  setGcProfileFilter(e.target.value);
                  setGcPage(1);
                }}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
              >
                <option value="">All Content Profiles</option>
                {contentProfiles.map((cp: any) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>

              <select
                value={gcLangFilter}
                onChange={(e) => {
                  setGcLangFilter(e.target.value);
                  setGcPage(1);
                }}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
              >
                <option value="">All Languages</option>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Hinglish">Hinglish</option>
                <option value="Spanish">Spanish</option>
              </select>
            </div>
          </div>

          {/* Content Gallery Grid */}
          {isGcError ? (
            <ErrorState
              title="Failed to load content gallery"
              message={(gcError as any)?.message || 'An error occurred while fetching generated content.'}
              onRetry={refetchGc}
              onRefresh={refetchGc}
            />
          ) : isGcLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : gcData.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No generated content records"
              description="Generated quotes, Shayari, and rendered video assets will appear here once pipeline jobs complete."
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {gcData.data.map((item: any) => (
                <div key={item.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-5 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-purple-950/40 border border-purple-800/40 text-purple-400 px-2 py-0.5 rounded font-mono">
                        {item.language}
                      </span>
                      <span className="text-xs text-[#6e6e80]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-white font-medium line-clamp-3 bg-[#151522] p-3 rounded-lg border border-[#222235]">
                      "{item.text}"
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-xs text-[#9c9cb0]">
                      {item.imageUrl && <ImageIcon size={14} className="text-emerald-400" />}
                      {item.videoUrl && <Video size={14} className="text-purple-400" />}
                      <span className="truncate">{item.caption || 'No caption'}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Eye}
                        onClick={() => setPreviewContentId(item.id)}
                      >
                        Preview
                      </Button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setErrorText(null);
                            setRegenerateContentId(item.id);
                          }}
                          title="Regenerate Content"
                          className="p-1.5 rounded-lg bg-[#161622] hover:bg-[#1d1d2e] text-[#6e6e80] hover:text-purple-400 transition cursor-pointer"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setErrorText(null);
                            setDuplicateContentId(item.id);
                          }}
                          title="Duplicate Content"
                          className="p-1.5 rounded-lg bg-[#161622] hover:bg-[#1d1d2e] text-[#6e6e80] hover:text-purple-400 transition cursor-pointer"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingContentId(item.id)}
                          title="Delete Content"
                          className="p-1.5 rounded-lg bg-[#161622] hover:bg-[#1d1d2e] text-[#6e6e80] hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content Gallery Pagination */}
          {gcData.data.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#0e0e12] p-4 rounded-xl">
              <span className="text-xs text-[#9c9cb0]">
                Showing <span className="font-semibold text-white">{gcData.data.length}</span> records
              </span>
              <div className="flex gap-2">
                <button
                  disabled={gcPage === 1}
                  onClick={() => setGcPage(p => Math.max(p - 1, 1))}
                  className="rounded border border-[#1a1a24] bg-[#161620] p-1.5 text-[#9c9cb0] hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={gcData.data.length < 6}
                  onClick={() => setGcPage(p => p + 1)}
                  className="rounded border border-[#1a1a24] bg-[#161620] p-1.5 text-[#9c9cb0] hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trigger Generation Modal */}
      {isTriggerGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Trigger Content Pipeline</h3>
              <button onClick={() => setIsTriggerGenOpen(false)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitGen((v) => createJobMutation.mutate(v))} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Select Channel
                </label>
                <select
                  {...registerGen('channelId')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="">Select a Channel</option>
                  {channels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                {genErrors.channelId && <p className="mt-1 text-xs text-red-400">{genErrors.channelId.message}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsTriggerGenOpen(false)} disabled={createJobMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createJobMutation.isPending} loadingText="Triggering...">
                  Start Pipeline
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monitor Pipeline Drawer */}
      {selectedJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-400" />
                  Job Monitor: <span className="font-mono text-purple-400">{selectedJobId.slice(0, 8)}...</span>
                </h3>
                <p className="text-xs text-[#9c9cb0]">Real-time pipeline stage monitor & retry engine</p>
              </div>
              <button onClick={() => setSelectedJobId(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {isJobDetailLoading || !selectedJob ? (
              <div className="flex h-48 items-center justify-center">
                <RefreshCw className="animate-spin text-purple-500" size={32} />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pipeline Stage Tracker */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Execution Pipeline Stages
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      'Draft',
                      'GeneratingContent',
                      'Validating',
                      'GeneratingImage',
                      'SelectingMusic',
                      'GeneratingVideo',
                      'GeneratingCaption',
                      'GeneratingHashtags',
                      'Queued',
                    ].map((stage) => {
                      const color = getStageColor(
                        stage,
                        selectedJob.pipelineStage,
                        selectedJob.pipelineStage === 'Failed'
                      );
                      return (
                        <div
                          key={stage}
                          className={`border p-2.5 rounded-lg text-center font-semibold transition ${color}`}
                        >
                          {stage}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Job Error Warning */}
                {selectedJob.pipelineStage === 'Failed' && (
                  <div className="rounded-xl bg-red-950/30 border border-red-500/40 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                      <AlertTriangle size={16} />
                      Pipeline Failed at Stage: {selectedJob.failureStage || 'Unknown'}
                    </div>
                    <p className="text-xs text-red-200 font-mono whitespace-pre-wrap bg-[#0e0e12] p-3 rounded border border-red-900/40">
                      {selectedJob.failureReason || 'No detailed failure reason recorded.'}
                    </p>
                  </div>
                )}

                {/* Media Preview Artifacts */}
                <div className="grid grid-cols-2 gap-4 border-t border-[#1a1a24] pt-4">
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                      Rendered Image Asset
                    </h5>
                    {selectedJob.imageUrl ? (
                      <img
                        src={formatMediaUrl(selectedJob.imageUrl)}
                        alt="Rendered Image"
                        className="h-44 w-full object-cover rounded-lg border border-[#1a1a24]"
                      />
                    ) : (
                      <div className="h-44 w-full bg-[#161620] rounded-lg border border-[#1a1a24] flex items-center justify-center text-xs text-[#6e6e80]">
                        Image Not Yet Compiled
                      </div>
                    )}
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                      Compiled Video Asset
                    </h5>
                    {selectedJob.videoUrl ? (
                      <video
                        src={formatMediaUrl(selectedJob.videoUrl)}
                        controls
                        className="h-44 w-full object-cover rounded-lg border border-[#1a1a24]"
                      />
                    ) : (
                      <div className="h-44 w-full bg-[#161620] rounded-lg border border-[#1a1a24] flex items-center justify-center text-xs text-[#6e6e80]">
                        Video Not Yet Compiled
                      </div>
                    )}
                  </div>
                </div>

                {/* Text Content */}
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Generated Text Quote / Shayari
                  </h5>
                  <p className="text-xs text-white bg-[#161620] p-3 rounded-lg border border-[#1a1a24] font-medium">
                    {selectedJob.generatedText || 'Text generation pending...'}
                  </p>
                </div>

                {/* Action Footer */}
                <div className="flex justify-between items-center border-t border-[#1a1a24] pt-4">
                  <span className="text-xs text-[#6e6e80]">
                    Total Attempts: {selectedJob.retryCount + 1}
                  </span>

                  <div className="flex gap-3">
                    {selectedJob.pipelineStage === 'Failed' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={RotateCcw}
                        isLoading={retryJobMutation.isPending}
                        loadingText="Retrying..."
                        onClick={() => retryJobMutation.mutate(selectedJob.id)}
                      >
                        Retry Job
                      </Button>
                    )}

                    {selectedJob.pipelineStage !== 'Completed' && selectedJob.pipelineStage !== 'Failed' && selectedJob.pipelineStage !== 'Archived' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={cancelJobMutation.isPending}
                        loadingText="Cancelling..."
                        onClick={() => cancelJobMutation.mutate(selectedJob.id)}
                      >
                        Cancel Job
                      </Button>
                    )}

                    <Button variant="secondary" size="sm" onClick={() => setSelectedJobId(null)}>
                      Close Monitor
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Content Modal */}
      {previewContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Content Preview Inspector</h3>
              <button onClick={() => setPreviewContentId(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {!previewContent ? (
              <div className="flex h-48 items-center justify-center">
                <RefreshCw className="animate-spin text-purple-500" size={32} />
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="bg-[#151522] border border-[#222235] p-4 rounded-xl">
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Quote Text</span>
                  <p className="text-white font-semibold text-base mt-2">"{previewContent.text}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {previewContent.imageUrl && (
                    <div>
                      <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Rendered PNG</span>
                      <img src={formatMediaUrl(previewContent.imageUrl)} alt="Rendered" className="mt-2 h-40 w-full object-cover rounded-lg border border-[#1a1a24]" />
                    </div>
                  )}
                  {previewContent.videoUrl && (
                    <div>
                      <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Rendered Video</span>
                      <video src={formatMediaUrl(previewContent.videoUrl)} controls className="mt-2 h-40 w-full object-cover rounded-lg border border-[#1a1a24]" />
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Caption & Hashtags</span>
                  <p className="text-xs text-[#9c9cb0] mt-1 bg-[#14141e] p-3 rounded-lg border border-[#1a1a24]">{previewContent.caption}</p>
                </div>

                <div className="flex justify-end border-t border-[#1a1a24] pt-4">
                  <Button variant="secondary" size="sm" onClick={() => setPreviewContentId(null)}>
                    Close Preview
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Content Modal */}
      {duplicateContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Duplicate Content</h3>
              <button onClick={() => setDuplicateContentId(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitAction((v) => duplicateContentMutation.mutate(v))} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Target Channel
                </label>
                <select
                  {...registerAction('channelId')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="">Select a Channel</option>
                  {channels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                {actionErrors.channelId && <p className="mt-1 text-xs text-red-400">{actionErrors.channelId.message}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setDuplicateContentId(null)} disabled={duplicateContentMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={duplicateContentMutation.isPending} loadingText="Duplicating...">
                  Duplicate & Run Pipeline
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regenerate Content Modal */}
      {regenerateContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Regenerate Content</h3>
              <button onClick={() => setRegenerateContentId(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitAction((v) => regenerateContentMutation.mutate(v))} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Target Channel
                </label>
                <select
                  {...registerAction('channelId')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="">Select a Channel</option>
                  {channels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                {actionErrors.channelId && <p className="mt-1 text-xs text-red-400">{actionErrors.channelId.message}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setRegenerateContentId(null)} disabled={regenerateContentMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={regenerateContentMutation.isPending} loadingText="Regenerating...">
                  Regenerate Pipeline
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Content Modal */}
      {deletingContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Content Record</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this generated content record? The rendered media files will remain in local storage archive.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingContentId(null)} disabled={deleteContentMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteContentMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteContentMutation.mutate(deletingContentId)}
              >
                Delete Content
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsView;
