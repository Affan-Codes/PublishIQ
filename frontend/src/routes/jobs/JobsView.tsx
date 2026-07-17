import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import {
  Plus,
  X,
  AlertTriangle,
  RefreshCw,
  Image,
  Video,
  FileText,
  RotateCcw,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers
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
  const { data: jobsData = { data: [], meta: { total: 0 } }, isLoading: isJobsLoading } = useQuery<any>({
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
    refetchInterval: activeTab === 'jobs' ? 5000 : false, // Poll jobs faster for real-time stage updates
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
    refetchInterval: !!selectedJobId ? 3000 : false, // Fast poll on detailed pipeline progress
  });

  // Fetch Generated Content list
  const { data: gcData = { data: [], meta: { total: 0 } }, isLoading: isGcLoading } = useQuery<any>({
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

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: async (values: TriggerGenValues) => {
      await apiClient.post('/jobs', { channelId: values.channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to retry job');
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.post(`/jobs/${jobId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', selectedJobId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to cancel job');
    },
  });

  const duplicateContentMutation = useMutation({
    mutationFn: async (values: { channelId: string }) => {
      await apiClient.post(`/generated-contents/${duplicateContentId}/duplicate`, { channelId: values.channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setDuplicateContentId(null);
      resetAction();
      setActiveTab('jobs'); // switch to jobs to see the rendering pipeline progress
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
      setDeletingContentId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to delete content');
    },
  });

  // Helpers
  const formatMediaUrl = (urlPath: string | null) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http')) return urlPath;
    // Resolve relative path to backend dev server address
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
        <button
          onClick={() => {
            setErrorText(null);
            setIsTriggerGenOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 cursor-pointer shadow-lg hover:shadow-purple-500/25"
        >
          <Plus size={16} />
          Trigger Generation
        </button>
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
          {isJobsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="animate-spin text-purple-500" size={32} />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#1a1a24] bg-[#0e0e12] py-16 text-center">
              <Layers size={48} className="text-[#6e6e80] mb-4" />
              <h3 className="text-lg font-bold text-white">No job executions found</h3>
              <p className="text-sm text-[#9c9cb0] max-w-sm mt-1">
                Trigger content generation or connect channels to run the automated rendering engines.
              </p>
            </div>
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
                <option value="Urdu">Urdu</option>
              </select>
            </div>
          </div>

          {/* Content Gallery Grid */}
          {isGcLoading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="animate-spin text-purple-500" size={32} />
            </div>
          ) : gcData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#1a1a24] bg-[#0e0e12] py-16 text-center">
              <Eye size={48} className="text-[#6e6e80] mb-4" />
              <h3 className="text-lg font-bold text-white">No generated content found</h3>
              <p className="text-sm text-[#9c9cb0] max-w-sm mt-1">
                Your pipeline outputs will be saved here as soon as a Content Pipeline Job executes successfully.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gcData.data.map((gc: any) => (
                  <div
                    key={gc.id}
                    className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:-translate-y-0.5 transition duration-300 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#9c9cb0] flex items-center gap-1.5">
                          <Layers size={12} />
                          {gc.contentProfile?.name || 'Direct Run'}
                        </span>
                        <span className="inline-flex rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400 border border-purple-500/20">
                          {gc.language}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg bg-[#161620] p-4 text-sm leading-relaxed border border-[#222230] text-white select-all font-medium ${
                          gc.language === 'Urdu' ? 'text-right font-serif text-lg leading-loose' : ''
                        }`}
                        dir={gc.language === 'Urdu' ? 'rtl' : 'ltr'}
                      >
                        {gc.text}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-[#1a1a24]/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6e6e80] flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(gc.createdAt).toLocaleDateString()}
                        </span>
                        
                        <div className="flex gap-1.5">
                          {gc.imageUrl && <Image size={14} className="text-purple-400" />}
                          {gc.videoUrl && <Video size={14} className="text-emerald-400" />}
                          {gc.caption && <FileText size={14} className="text-blue-400" />}
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 pt-1 text-xs">
                        <button
                          onClick={() => setPreviewContentId(gc.id)}
                          className="flex items-center gap-1 rounded bg-[#161620] hover:bg-[#222230] border border-[#222233] px-2.5 py-1.5 font-semibold text-white transition cursor-pointer"
                        >
                          <Eye size={12} />
                          Preview
                        </button>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setErrorText(null);
                              setDuplicateContentId(gc.id);
                            }}
                            className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              setErrorText(null);
                              setRegenerateContentId(gc.id);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                          >
                            Regen
                          </button>
                          <button
                            onClick={() => setDeletingContentId(gc.id)}
                            className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#0e0e12] px-6 py-4 rounded-xl">
                <span className="text-xs text-[#9c9cb0]">
                  Showing <span className="font-semibold text-white">{gcData.data.length}</span> items
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
            </div>
          )}
        </div>
      )}

      {/* Trigger Generation Dialog */}
      {isTriggerGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsTriggerGenOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <button
              onClick={() => setIsTriggerGenOpen(false)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-400" />
              Trigger Content Generation
            </h3>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitGen(onSubmitGen => createJobMutation.mutate(onSubmitGen))} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Target Channel
                </label>
                <select
                  {...registerGen('channelId')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="">Select an active channel...</option>
                  {channels
                    .filter((ch: any) => ch.status === 'Active')
                    .map((ch: any) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} ({ch.contentProfile?.language})
                      </option>
                    ))}
                </select>
                {genErrors.channelId && (
                  <p className="mt-1 text-xs text-red-400">{genErrors.channelId.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTriggerGenOpen(false)}
                  className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createJobMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 cursor-pointer shadow-md hover:shadow-purple-555/25"
                >
                  {createJobMutation.isPending ? 'Generating...' : 'Start Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Content Dialog */}
      {duplicateContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDuplicateContentId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <button
              onClick={() => setDuplicateContentId(null)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">
              Duplicate Quote to Channel
            </h3>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitAction(onSubmitAction => duplicateContentMutation.mutate(onSubmitAction))} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Target Channel
                </label>
                <select
                  {...registerAction('channelId')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="">Select channel...</option>
                  {channels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                {actionErrors.channelId && (
                  <p className="mt-1 text-xs text-red-400">{actionErrors.channelId.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setDuplicateContentId(null)}
                  className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={duplicateContentMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 cursor-pointer"
                >
                  Duplicate & Render
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regenerate Content Dialog */}
      {regenerateContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setRegenerateContentId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <button
              onClick={() => setRegenerateContentId(null)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">
              Regenerate Content
            </h3>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmitAction(onSubmitAction => regenerateContentMutation.mutate(onSubmitAction))} className="space-y-4">
              <p className="text-sm text-[#9c9cb0]">
                This will trigger content generation using the target channel's prompt version, calling the AI provider again for new text.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Target Channel
                </label>
                <select
                  {...registerAction('channelId')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="">Select channel...</option>
                  {channels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                {actionErrors.channelId && (
                  <p className="mt-1 text-xs text-red-400">{actionErrors.channelId.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setRegenerateContentId(null)}
                  className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regenerateContentMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  Generate Fresh Text
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Content Dialog */}
      {deletingContentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDeletingContentId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Delete Generated Content</h3>
            <p className="text-sm text-[#9c9cb0] mb-6">
              Are you sure you want to delete this content item? This action removes the database record and media files, and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingContentId(null)}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteContentMutation.mutate(deletingContentId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 cursor-pointer"
              >
                Delete Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Executions Progress Modal */}
      {selectedJobId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedJobId(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl max-h-[85vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setSelectedJobId(null)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            {isJobDetailLoading ? (
              <div className="flex h-48 items-center justify-center">
                <RefreshCw className="animate-spin text-purple-500" size={24} />
              </div>
            ) : selectedJob && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Pipeline Execution Status</h3>
                  <p className="text-xs font-mono text-[#6e6e80] mt-1">{selectedJob.id}</p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 bg-[#161620] p-4 rounded-lg border border-[#222230] text-xs">
                  <p className="text-[#9c9cb0]">Channel: <span className="font-semibold text-white">{selectedJob.channel?.name || 'Manual'}</span></p>
                  <p className="text-[#9c9cb0]">Profile: <span className="font-semibold text-white">{selectedJob.contentProfile?.name || 'Manual'}</span></p>
                  <p className="text-[#9c9cb0]">Attempts: <span className="font-semibold text-white">{selectedJob.retryCount + 1}</span></p>
                  <p className="text-[#9c9cb0]">Created: <span className="font-semibold text-white">{new Date(selectedJob.createdAt).toLocaleString()}</span></p>
                </div>

                {/* Pipeline visualizer */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Pipeline Stages</h4>
                  <div className="grid grid-cols-3 gap-2">
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
                    ].map((stg) => (
                      <div
                        key={stg}
                        className={`rounded border p-2 text-center text-[10px] font-mono leading-tight flex flex-col justify-center items-center h-16 ${getStageColor(stg, selectedJob.pipelineStage, !!selectedJob.failureReason)}`}
                      >
                        <span className="font-bold text-white mb-1">
                          {stg.replace('Generating', 'Gen ')}
                        </span>
                        {selectedJob.pipelineStage === stg && (
                          <span className="text-[8px] opacity-75">
                            {selectedJob.failureReason ? 'FAILED' : 'ACTIVE'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Failure card */}
                {selectedJob.failureReason && (
                  <div className="rounded-lg bg-red-950/20 border border-red-500/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                      <AlertTriangle size={16} />
                      Pipeline Failure
                    </div>
                    <p className="text-xs text-red-200">
                      Failed at Stage: <span className="font-mono text-white font-semibold">{selectedJob.failureStage}</span>
                    </p>
                    <p className="text-xs text-red-300 font-mono bg-black/30 p-2.5 rounded border border-red-500/10 whitespace-pre-wrap">
                      {selectedJob.failureReason}
                    </p>
                  </div>
                )}

                {/* Render output text preview */}
                {selectedJob.generatedText && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Generated Quote Text</h4>
                    <div className="bg-[#161620] border border-[#222230] p-4 rounded text-sm text-white select-all font-mono leading-relaxed">
                      {selectedJob.generatedText}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]/50">
                  {selectedJob.pipelineStage !== 'Queued' && selectedJob.pipelineStage !== 'Archived' && !selectedJob.failureReason && (
                    <button
                      onClick={() => cancelJobMutation.mutate(selectedJob.id)}
                      disabled={cancelJobMutation.isPending}
                      className="rounded-lg border border-red-900/50 hover:bg-red-950/20 bg-[#161620] px-4 py-2 text-sm font-semibold text-red-400 cursor-pointer disabled:opacity-50"
                    >
                      Cancel Job
                    </button>
                  )}
                  {selectedJob.failureReason && (
                    <button
                      onClick={() => retryJobMutation.mutate(selectedJob.id)}
                      disabled={retryJobMutation.isPending}
                      className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      Retry Failure
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedJobId(null)}
                    className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Content Preview Modal */}
      {previewContentId && previewContent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewContentId(null)} />
          <div className="relative z-10 w-full max-w-4xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setPreviewContentId(null)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Eye size={20} className="text-purple-400" />
                Pipeline Output Preview
              </h3>
              <p className="text-xs text-[#9c9cb0] font-mono mt-1">{previewContent.id}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Media rendering column */}
              <div className="space-y-4 flex flex-col items-center">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] self-start">Rendered Assets</h4>
                
                {/* 9:16 vertical ratio container */}
                <div className="relative w-[280px] h-[497px] rounded-xl border border-[#1a1a24] bg-[#000000] overflow-hidden shadow-inner flex items-center justify-center group">
                  {previewContent.videoUrl ? (
                    <video
                      src={formatMediaUrl(previewContent.videoUrl)}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : previewContent.imageUrl ? (
                    <img
                      src={formatMediaUrl(previewContent.imageUrl)}
                      alt="Rendered output"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="mx-auto text-[#6e6e80] mb-2 animate-bounce" size={32} />
                      <p className="text-xs text-[#6e6e80]">Rendering media...</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#6e6e80] text-center max-w-[280px]">
                  {previewContent.videoUrl 
                    ? '🎥 Video rendered successfully with zoom animation and background music' 
                    : '🖼️ Image rendering is complete (vertical 1080x1920 PNG)'
                  }
                </p>
              </div>

              {/* Text outputs column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Generated Quote Text</h4>
                  <div
                    className={`rounded-lg bg-[#161620] border border-[#222230] p-4 text-sm leading-relaxed text-white font-medium select-all ${
                      previewContent.language === 'Urdu' ? 'text-right font-serif text-lg leading-loose' : ''
                    }`}
                    dir={previewContent.language === 'Urdu' ? 'rtl' : 'ltr'}
                  >
                    {previewContent.text}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Social Caption</h4>
                  <div className="rounded-lg bg-[#161620] border border-[#222230] p-4 text-xs font-mono text-gray-200 select-all whitespace-pre-wrap leading-relaxed">
                    {previewContent.caption || 'No caption generated'}
                  </div>
                </div>

                {previewContent.hashtags && Array.isArray(previewContent.hashtags) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Hashtags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {previewContent.hashtags.map((h: string) => (
                        <span
                          key={h}
                          className="rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 font-mono text-xs text-purple-400 select-all"
                        >
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-[#161620] border border-[#222230] p-4 rounded-lg text-xs space-y-2 text-[#9c9cb0]">
                  <p className="font-semibold text-white uppercase text-[10px] tracking-wider mb-1">Provenance Details</p>
                  <p>Content Profile: <span className="text-white font-medium">{previewContent.contentProfile?.name}</span></p>
                  <p>Language: <span className="text-white font-medium">{previewContent.language}</span></p>
                  <p>Content Type: <span className="text-white font-medium">{previewContent.contentProfile?.contentType?.name}</span></p>
                  <p>Originating Job ID: <span className="font-mono text-white select-all">{previewContent.jobId}</span></p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#1a1a24]/50">
              <button
                onClick={() => setPreviewContentId(null)}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsView;
