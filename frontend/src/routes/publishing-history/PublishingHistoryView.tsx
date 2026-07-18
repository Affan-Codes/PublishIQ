import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client.js';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  ChevronRight, 
  Play, 
  AlertTriangle,
  Youtube,
  Instagram,
  Facebook,
  X,
  FileText
} from 'lucide-react';

interface Channel {
  id: string;
  name: string;
}

interface PlatformConnection {
  id: string;
  scopes: string[];
  healthStatus: 'Healthy' | 'Unhealthy' | 'Expired' | 'Unknown';
}

interface GeneratedContent {
  id: string;
  text: string;
  imageUrl: string | null;
  videoUrl: string | null;
  caption: string | null;
}

interface PublishingRecord {
  id: string;
  workspaceId: string;
  jobId: string;
  channelId: string;
  platformConnectionId: string;
  contentTypeSnapshot: string;
  status: 'Success' | 'Failure';
  platformResponse: any;
  publishedAt: string;
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  generatedContentId: string | null;
  publishedUrl: string | null;
  platformPostId: string | null;
  duration: number | null;
  retries: number;
  providerMetadata: any;
  errorDetails: string | null;
  channel: Channel;
  platformConnection: PlatformConnection;
  generatedContent: GeneratedContent | null;
}

interface PaginatedResponse {
  success: boolean;
  data: PublishingRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export const PublishingHistoryView: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected record detail modal
  const [selectedRecord, setSelectedRecord] = useState<PublishingRecord | null>(null);
  
  // Republish Target Channel selection
  const [republishChannelId, setRepublishChannelId] = useState('');
  const [isRepublishingMode, setIsRepublishingMode] = useState(false);

  // Queries
  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['publishing-history', searchTerm, selectedPlatform, selectedStatus, currentPage],
    queryFn: async () => {
      const res = await apiClient.get('/publishing-history', {
        params: {
          search: searchTerm || undefined,
          platform: selectedPlatform || undefined,
          status: selectedStatus || undefined,
          page: currentPage,
          limit: itemsPerPage,
        }
      });
      return res.data;
    },
  });

  const { data: channels = [] } = useQuery<{ data: Channel[] }>({
    queryKey: ['channels-list'],
    queryFn: async () => {
      const res = await apiClient.get('/channels');
      return res.data;
    }
  });

  // Mutations
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/publishing-history/${id}/retry`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      // Update selected record view
      if (selectedRecord && selectedRecord.id === variables) {
        setSelectedRecord(prev => prev ? { ...prev, status: 'Success', errorDetails: null } : null);
      }
      alert('Retry completed successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to retry publishing');
    }
  });

  const republishMutation = useMutation({
    mutationFn: async (payload: { generatedContentId: string; channelId: string }) => {
      await apiClient.post('/publishing-history/republish', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      setIsRepublishingMode(false);
      setRepublishChannelId('');
      alert('Republish queued successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to republish content');
    }
  });

  const handleRetry = (record: PublishingRecord) => {
    if (confirm('Are you sure you want to retry publishing this record?')) {
      retryMutation.mutate(record.id);
    }
  };

  const handleRepublish = () => {
    if (!selectedRecord?.generatedContentId || !republishChannelId) return;
    republishMutation.mutate({
      generatedContentId: selectedRecord.generatedContentId,
      channelId: republishChannelId,
    });
  };

  const renderPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'YouTube':
        return <Youtube className="h-5 w-5 text-red-500" />;
      case 'Instagram':
        return <Instagram className="h-5 w-5 text-pink-500" />;
      case 'Facebook':
        return <Facebook className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const cleanMediaUrl = (url: string | null) => {
    if (!url) return '';
    // If it's a relative path, prefix with backend endpoint
    if (url.startsWith('media/') || url.startsWith('jobs/')) {
      return `http://localhost:4000/${url}`;
    }
    return url;
  };

  const totalRecords = data?.meta?.total || 0;
  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  return (
    <div className="space-y-8 p-6 text-white min-h-screen bg-[#0b0b0f]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            Publishing History
          </h2>
          <p className="text-sm text-[#9c9cb0] mt-1">Track, retry, and analyze platform upload jobs and logs.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-[#111118]/80 border border-[#1d1d2b] p-4 rounded-2xl backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-5 w-5 text-[#6e6e80]" />
          <input
            type="text"
            placeholder="Search by ID, URL, error details..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#161622] border border-[#222235] pl-11 pr-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-44 bg-[#161622] border border-[#222235] px-4 py-2.5 rounded-xl text-sm text-[#9c9cb0] focus:outline-none focus:border-purple-500 transition-colors appearance-none"
            >
              <option value="">All Platforms</option>
              <option value="YouTube">YouTube</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
            </select>
          </div>

          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-44 bg-[#161622] border border-[#222235] px-4 py-2.5 rounded-xl text-sm text-[#9c9cb0] focus:outline-none focus:border-purple-500 transition-colors appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Failure">Failure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : totalRecords === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#1d1d2b] rounded-2xl bg-[#0e0e14]">
          <FileText className="h-12 w-12 text-[#4e4e66] mb-4" />
          <h3 className="text-lg font-medium text-white">No records found</h3>
          <p className="text-sm text-[#8c8c9e] mt-1">Try relaxing your filter parameters or publish content first.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1d1d2b] bg-[#0e0e14] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#e0e0e6]">
              <thead className="bg-[#151522] text-xs font-semibold uppercase tracking-wider text-[#8c8c9e] border-b border-[#1d1d2b]">
                <tr>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Platform</th>
                  <th className="px-6 py-4">Publish Status</th>
                  <th className="px-6 py-4">Metrics</th>
                  <th className="px-6 py-4">Published At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1d1d2b]">
                {data?.data.map((rec) => (
                  <tr 
                    key={rec.id} 
                    className="hover:bg-[#151524]/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedRecord(rec)}
                  >
                    <td className="px-6 py-4 font-semibold text-white">
                      {rec.channel?.name || 'Unknown Channel'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {renderPlatformIcon(rec.platform)}
                        <span>{rec.platform}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {rec.status === 'Success' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="h-3 w-3" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">
                          <XCircle className="h-3 w-3" />
                          Failure
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                      <div className="space-y-1">
                        <div>Duration: {formatDuration(rec.duration)}</div>
                        <div>Attempts: {rec.retries + 1}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                      {new Date(rec.publishedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="p-2 hover:bg-[#1a1a2e] rounded-lg text-purple-400 hover:text-purple-300 transition-colors"
                          title="View Log Details"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        {rec.status === 'Failure' && (
                          <button
                            onClick={() => handleRetry(rec)}
                            disabled={retryMutation.isPending}
                            className="px-3 py-1 bg-rose-600/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-medium hover:bg-rose-600/30 transition-colors disabled:opacity-50"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 bg-[#111118]/80 border-t border-[#1d1d2b]">
              <span className="text-xs text-[#8c8c9e]">
                Showing page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-3.5 py-1.5 bg-[#161622] text-[#e0e0e6] rounded-lg text-xs font-medium hover:bg-[#1d1d2e] disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3.5 py-1.5 bg-[#161622] text-[#e0e0e6] rounded-lg text-xs font-medium hover:bg-[#1d1d2e] disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Slide-out Panel */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0f0f16] border-l border-[#1d1d2d] h-full overflow-y-auto p-8 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center border-b border-[#1d1d2b] pb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {renderPlatformIcon(selectedRecord.platform)}
                    Publishing Log Detail
                  </h3>
                  <p className="text-xs text-[#8c8c9e] mt-1">ID: {selectedRecord.id}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setIsRepublishingMode(false);
                  }}
                  className="p-2 hover:bg-[#1a1a2e] rounded-xl text-[#9c9cb0] hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Media Preview Section */}
              {selectedRecord.generatedContent && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-xs uppercase font-bold text-[#8c8c9e] tracking-wider">Generated Asset Preview</h4>
                  <div className="flex justify-center bg-[#07070b] p-4 rounded-2xl border border-[#1d1d2d]">
                    {selectedRecord.generatedContent.videoUrl ? (
                      <video
                        src={cleanMediaUrl(selectedRecord.generatedContent.videoUrl)}
                        controls
                        className="max-h-72 w-auto rounded-xl shadow-lg border border-[#2d2d3e]"
                      />
                    ) : selectedRecord.generatedContent.imageUrl ? (
                      <img
                        src={cleanMediaUrl(selectedRecord.generatedContent.imageUrl)}
                        alt="Publish preview"
                        className="max-h-72 object-contain rounded-xl shadow-lg border border-[#2d2d3e]"
                      />
                    ) : (
                      <div className="text-sm text-[#6e6e80] py-10">No Media Files Available</div>
                    )}
                  </div>

                  {/* Caption box */}
                  <div className="bg-[#151522] border border-[#222235] p-4 rounded-xl">
                    <span className="text-xs font-semibold text-[#8c8c9e]">Caption & Transcript:</span>
                    <p className="text-sm text-[#e0e0e6] mt-2 whitespace-pre-wrap">
                      {selectedRecord.generatedContent.caption || selectedRecord.generatedContent.text}
                    </p>
                  </div>
                </div>
              )}

              {/* Status details */}
              <div className="mt-6 space-y-4">
                <h4 className="text-xs uppercase font-bold text-[#8c8c9e] tracking-wider">Upload Telemetry</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#151522] border border-[#222235] p-4 rounded-xl">
                    <div className="text-xs text-[#8c8c9e]">Publishing Duration</div>
                    <div className="text-lg font-bold text-white flex items-center gap-1.5 mt-1">
                      <Clock className="h-4 w-4 text-purple-400" />
                      {formatDuration(selectedRecord.duration)}
                    </div>
                  </div>
                  <div className="bg-[#151522] border border-[#222235] p-4 rounded-xl">
                    <div className="text-xs text-[#8c8c9e]">Total Attempts</div>
                    <div className="text-lg font-bold text-white flex items-center gap-1.5 mt-1">
                      <RefreshCw className="h-4 w-4 text-purple-400" />
                      {selectedRecord.retries + 1}
                    </div>
                  </div>
                </div>

                {selectedRecord.status === 'Success' ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-400">Successfully Published</div>
                      {selectedRecord.publishedUrl && (
                        <a
                          href={selectedRecord.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-300 underline hover:text-emerald-200 mt-1"
                        >
                          View live post
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-rose-400">Publish Failure Exception</div>
                      <p className="text-xs text-rose-300 mt-1 whitespace-pre-wrap">
                        {selectedRecord.errorDetails || 'Unknown transient platform error.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Raw response metadata */}
              {selectedRecord.providerMetadata && (
                <div className="mt-6 space-y-2">
                  <h4 className="text-xs uppercase font-bold text-[#8c8c9e] tracking-wider">Raw Provider Metadata</h4>
                  <pre className="bg-[#07070b] border border-[#1d1d2d] p-4 rounded-xl text-xs font-mono text-[#a5a5b5] max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedRecord.providerMetadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="border-t border-[#1d1d2b] pt-6 mt-8 flex flex-col gap-4">
              {isRepublishingMode ? (
                <div className="space-y-3">
                  <label className="text-xs text-[#8c8c9e] font-semibold">Select Target Channel for Campaign:</label>
                  <div className="flex gap-3">
                    <select
                      value={republishChannelId}
                      onChange={(e) => setRepublishChannelId(e.target.value)}
                      className="flex-1 bg-[#161622] border border-[#222235] px-4 py-2.5 rounded-xl text-sm text-[#9c9cb0] focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Choose Channel --</option>
                      {channels.data?.map((ch: any) => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleRepublish}
                      disabled={!republishChannelId || republishMutation.isPending}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setIsRepublishingMode(false)}
                      className="px-4 py-2.5 bg-[#1c1c2b] text-[#9c9cb0] rounded-xl text-sm font-semibold hover:bg-[#252538] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  {selectedRecord.status === 'Failure' && (
                    <button
                      onClick={() => handleRetry(selectedRecord)}
                      disabled={retryMutation.isPending}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                      Retry Publishing Log
                    </button>
                  )}
                  {selectedRecord.generatedContentId && (
                    <button
                      onClick={() => setIsRepublishingMode(true)}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Play className="h-4 w-4" />
                      Republish Generated Content
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishingHistoryView;
