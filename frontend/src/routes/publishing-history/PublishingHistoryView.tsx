import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import apiClient from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonTable } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Play, 
  AlertTriangle,
  Video as Youtube,
  Camera as Instagram,
  Share2 as Facebook,
  X,
  History
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
  const { addToast } = useNotifications();
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected record detail modal
  const [selectedRecord, setSelectedRecord] = useState<PublishingRecord | null>(null);
  const [retryingRecordId, setRetryingRecordId] = useState<string | null>(null);
  
  // Republish Target Channel selection
  const [republishChannelId, setRepublishChannelId] = useState('');
  const [isRepublishingMode, setIsRepublishingMode] = useState(false);

  // Queries
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<PaginatedResponse>({
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
    placeholderData: keepPreviousData,
  });

  const { data: channelsData } = useQuery<{ data: Channel[] }>({
    queryKey: ['channels-list'],
    queryFn: async () => {
      const res = await apiClient.get('/channels');
      return res.data;
    }
  });

  const channelsList = channelsData?.data || [];

  // Mutations
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      setRetryingRecordId(id);
      await apiClient.post(`/publishing-history/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      addToast('Publish retry initiated successfully', 'success');
      setSelectedRecord(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Retry failed', 'error');
    },
    onSettled: () => {
      setRetryingRecordId(null);
    },
  });

  const republishMutation = useMutation({
    mutationFn: async ({ contentId, channelId }: { contentId: string; channelId: string }) => {
      await apiClient.post(`/generated-contents/${contentId}/republish`, { channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishing-history'] });
      addToast('Content republishing triggered successfully', 'success');
      setIsRepublishingMode(false);
      setSelectedRecord(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Republish failed', 'error');
    }
  });

  const records = data?.data || [];
  const totalItems = data?.meta?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'YouTube':
        return <Youtube className="h-4 w-4 text-red-500" />;
      case 'Instagram':
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'Facebook':
        return <Facebook className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

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
            <h2 className="text-2xl font-bold tracking-tight text-white">Publishing History</h2>
            <p className="text-sm text-[#9c9cb0]">Audit log of multi-platform post distributions and health events</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load publishing history"
          message={(error as any)?.message || 'An error occurred while fetching publishing records.'}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
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
            <History className="text-purple-400" />
            Publishing History
          </h2>
          <p className="text-sm text-[#9c9cb0]">Audit log of multi-platform post distributions and health events</p>
        </div>
        <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh publishing records" />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24]">
        <div className="flex items-center gap-3 w-full md:w-auto relative">
          <Search className="absolute left-3 text-[#6e6e80]" size={16} />
          <input
            type="text"
            placeholder="Search by Channel, Post ID or Error..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:w-80 rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={selectedPlatform}
            onChange={(e) => {
              setSelectedPlatform(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
          >
            <option value="">All Platforms</option>
            <option value="YouTube">YouTube</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Failure">Failure</option>
          </select>
        </div>
      </div>

      {/* Data Table / Empty / Loading */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={History}
          title="No publishing history records"
          description="Distribution logs, platform URLs, and failure audit trails will appear here as content is published."
        />
      ) : (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#e0e0e6]">
              <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
                <tr>
                  <th className="px-6 py-4">Platform & Channel</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Published At</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {records.map((record) => (
                  <tr 
                    key={record.id}
                    onClick={() => {
                      setSelectedRecord(record);
                      setIsRepublishingMode(false);
                    }}
                    className="hover:bg-[#161620]/30 transition cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#161620] border border-[#222234]">
                          {getPlatformIcon(record.platform)}
                        </div>
                        <div>
                          <div className="font-semibold text-white group-hover:text-purple-400 transition">
                            {record.channel?.name || 'Unknown Channel'}
                          </div>
                          <div className="text-xs text-[#6e6e80] font-mono">
                            {record.platformPostId ? `ID: ${record.platformPostId}` : record.platform}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded bg-[#161620] px-2 py-1 text-xs text-[#9c9cb0] border border-[#222234]">
                        {record.contentTypeSnapshot}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {record.status === 'Success' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle size={12} />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                          <XCircle size={12} />
                          Failed
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(record.publishedAt).toLocaleString()}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-[#9c9cb0] font-mono">
                      {record.duration ? `${(record.duration / 1000).toFixed(1)}s` : '-'}
                    </td>

                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {record.publishedUrl && (
                          <a
                            href={record.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-purple-400 hover:text-purple-300 rounded hover:bg-purple-500/10 transition"
                            title="View External Post"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}

                        {record.status === 'Failure' && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={Play}
                            isLoading={retryMutation.isPending && retryingRecordId === record.id}
                            loadingText="Retrying..."
                            onClick={() => retryMutation.mutate(record.id)}
                          >
                            Retry
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
                Showing page <span className="font-semibold text-white">{currentPage}</span> of{' '}
                <span className="font-semibold text-white">{totalPages}</span> ({totalItems} total records)
              </span>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Inspector Drawer */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#161620] border border-[#222234]">
                  {getPlatformIcon(selectedRecord.platform)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Publishing Inspection Log</h3>
                  <p className="text-xs text-[#9c9cb0]">
                    {selectedRecord.platform} • {selectedRecord.channel?.name || 'Channel'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="text-[#6e6e80] hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {selectedRecord.status === 'Failure' && selectedRecord.errorDetails && (
              <div className="rounded-xl bg-rose-950/30 border border-rose-500/40 p-4 space-y-1">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} />
                  Platform Execution Failure Error
                </div>
                <p className="text-xs text-rose-200 font-mono whitespace-pre-wrap bg-[#0b0b11] p-3 rounded border border-rose-900/40 mt-2">
                  {selectedRecord.errorDetails}
                </p>
              </div>
            )}

            {/* Content Preview */}
            {selectedRecord.generatedContent && (
              <div className="space-y-3 bg-[#13131d] p-4 rounded-xl border border-[#20202e]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Generated Content Output
                  </span>
                </div>

                <p className="text-xs text-white font-medium italic bg-[#0c0c12] p-3 rounded-lg border border-[#1b1b26]">
                  "{selectedRecord.generatedContent.text}"
                </p>

                {selectedRecord.generatedContent.caption && (
                  <div>
                    <span className="text-[10px] text-[#6e6e80] uppercase tracking-wider font-semibold">Caption & Tags</span>
                    <p className="text-xs text-[#9c9cb0] mt-1 bg-[#0c0c12] p-2.5 rounded border border-[#1b1b26] line-clamp-3">
                      {selectedRecord.generatedContent.caption}
                    </p>
                  </div>
                )}

                {/* Media Files */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {selectedRecord.generatedContent.imageUrl && (
                    <div>
                      <span className="text-[10px] text-[#6e6e80] uppercase tracking-wider font-semibold">Image Asset</span>
                      <img
                        src={formatMediaUrl(selectedRecord.generatedContent.imageUrl)}
                        alt="Rendered Image"
                        className="mt-1 h-28 w-full object-cover rounded-lg border border-[#1b1b26]"
                      />
                    </div>
                  )}

                  {selectedRecord.generatedContent.videoUrl && (
                    <div>
                      <span className="text-[10px] text-[#6e6e80] uppercase tracking-wider font-semibold">Video Asset</span>
                      <video
                        src={formatMediaUrl(selectedRecord.generatedContent.videoUrl)}
                        controls
                        className="mt-1 h-28 w-full object-cover rounded-lg border border-[#1b1b26]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Information */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-[#13131d] p-4 rounded-xl border border-[#20202e]">
              <div>
                <span className="text-[#6e6e80]">Post ID:</span>
                <p className="font-mono text-white mt-0.5">{selectedRecord.platformPostId || 'None'}</p>
              </div>
              <div>
                <span className="text-[#6e6e80]">Attempts Count:</span>
                <p className="font-mono text-white mt-0.5">{selectedRecord.retries} retries</p>
              </div>
              <div>
                <span className="text-[#6e6e80]">Execution Time:</span>
                <p className="font-mono text-white mt-0.5">
                  {selectedRecord.duration ? `${(selectedRecord.duration / 1000).toFixed(2)}s` : 'Instant'}
                </p>
              </div>
              <div>
                <span className="text-[#6e6e80]">Published At:</span>
                <p className="font-mono text-white mt-0.5">
                  {new Date(selectedRecord.publishedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Republish Form Mode */}
            {isRepublishingMode && (
              <div className="space-y-3 bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Select Target Channel for Manual Republish
                </span>
                <select
                  value={republishChannelId}
                  onChange={(e) => setRepublishChannelId(e.target.value)}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="">Select Channel</option>
                  {channelsList.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsRepublishingMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!republishChannelId}
                    isLoading={republishMutation.isPending}
                    loadingText="Publishing..."
                    onClick={() => {
                      if (selectedRecord.generatedContentId && republishChannelId) {
                        republishMutation.mutate({
                          contentId: selectedRecord.generatedContentId,
                          channelId: republishChannelId,
                        });
                      }
                    }}
                  >
                    Trigger Republish
                  </Button>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex justify-between items-center border-t border-[#1a1a24] pt-4">
              <div>
                {selectedRecord.publishedUrl && (
                  <a
                    href={selectedRecord.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Open Platform Post
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                {selectedRecord.status === 'Failure' && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Play}
                    isLoading={retryMutation.isPending}
                    loadingText="Retrying..."
                    onClick={() => retryMutation.mutate(selectedRecord.id)}
                  >
                    Retry Publish
                  </Button>
                )}

                {selectedRecord.generatedContentId && !isRepublishingMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRepublishChannelId(selectedRecord.channelId || '');
                      setIsRepublishingMode(true);
                    }}
                  >
                    Republish Content
                  </Button>
                )}

                <Button size="sm" variant="secondary" onClick={() => setSelectedRecord(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishingHistoryView;
