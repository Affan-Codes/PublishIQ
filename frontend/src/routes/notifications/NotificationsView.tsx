import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Search,
  Filter,
  Trash2,
  Eye,
  ExternalLink,
  AlertTriangle,
  Info,
  Clock
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonTable } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import { NotificationDetailsModal, type NotificationItem } from '../../components/notifications/NotificationDetailsModal.js';

interface NotificationsResponse {
  success: boolean;
  data: NotificationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    unreadCount?: number;
  };
}

export const NotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast, resetUnreadCount } = useNotifications();

  // Search, Filter, Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals & Action States
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Compute date strings for backend filter
  const getDateRange = () => {
    if (!dateRangeFilter || dateRangeFilter === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    if (dateRangeFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: today.toISOString(), endDate: undefined };
    }
    if (dateRangeFilter === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: past7.toISOString(), endDate: undefined };
    }
    if (dateRangeFilter === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: past30.toISOString(), endDate: undefined };
    }
    return { startDate: undefined, endDate: undefined };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch paginated & filtered notifications query
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', 'history', page, statusFilter, typeFilter, severityFilter, dateRangeFilter, searchTerm],
    queryFn: async () => {
      const response = await axios.get('/api/v1/notifications', {
        params: {
          page,
          limit,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          type: typeFilter || undefined,
          search: searchTerm || undefined,
          startDate,
          endDate,
        },
        withCredentials: true,
      });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionId(id);
      await axios.post(`/api/v1/notifications/${id}/read`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('Notification marked as read', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to mark as read', 'error');
    },
    onSettled: () => setActionId(null),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await axios.post('/api/v1/notifications/read-all', {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      resetUnreadCount();
      addToast('All notifications marked as read', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to mark all as read', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionId(id);
      await axios.delete(`/api/v1/notifications/${id}`, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('Notification deleted', 'success');
      if (selectedNotification?.id === actionId) {
        setSelectedNotification(null);
      }
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete notification', 'error');
    },
    onSettled: () => setActionId(null),
  });

  const notifications = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Client-side Severity & Type filtering refinement
  const filteredNotifications = notifications.filter((notif) => {
    const eventType = notif.domainEvent?.type || 'Notification';
    const isErrorEvent = eventType.includes('Failed') || eventType.includes('Error');
    const isWarningEvent = eventType.includes('Approval') || eventType.includes('Warning');
    const severity = isErrorEvent ? 'Error' : isWarningEvent ? 'Warning' : 'Info';

    if (severityFilter && severityFilter !== 'ALL' && severity !== severityFilter) {
      return false;
    }
    return true;
  });

  const handleDeepLink = (notif: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notif.readAt) {
      markReadMutation.mutate(notif.id);
    }
    const eventType = notif.domainEvent?.type || '';
    const jobId = notif.domainEvent?.jobId || notif.domainEvent?.payload?.jobId;

    if (jobId) {
      navigate('/jobs');
    } else if (eventType.includes('Channel')) {
      navigate('/channels');
    } else if (eventType.includes('Publish')) {
      navigate('/publishing-history');
    } else if (eventType.includes('Profile')) {
      navigate('/content-profiles');
    } else {
      navigate('/jobs');
    }
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="h-6 w-6 text-purple-400" /> Notification History
            </h2>
            <p className="text-sm text-[#9c9cb0]">Audit trail of system events, operator warnings, and pipeline updates</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load notification history"
          message={(error as any)?.message || 'An error occurred while communicating with the notification server.'}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-purple-400" /> Notification History
          </h2>
          <p className="text-sm text-[#9c9cb0]">Audit trail of system events, operator warnings, and pipeline updates</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh history" />

          {notifications.some((n) => !n.readAt) && (
            <Button
              variant="outline"
              icon={CheckCheck}
              isLoading={markAllReadMutation.isPending}
              loadingText="Marking All..."
              onClick={() => markAllReadMutation.mutate()}
            >
              Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24]">
        {/* Search */}
        <div className="flex items-center gap-3 w-full lg:w-80 relative">
          <Search className="absolute left-3 text-[#6e6e80]" size={16} />
          <input
            type="text"
            placeholder="Search by Title, Message or Job ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-xs text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
          />
        </div>

        {/* Multi-Criteria Filters */}
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto text-xs">
          <div className="flex items-center gap-1.5 text-[#6e6e80]">
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
          >
            <option value="">All Event Types</option>
            <option value="JobFailed">Job Failed</option>
            <option value="ApprovalRequired">Approval Required</option>
            <option value="ContentGenerated">Content Generated</option>
            <option value="SchedulerError">Scheduler Error</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
          >
            <option value="ALL">All Severities</option>
            <option value="Error">Error</option>
            <option value="Warning">Warning</option>
            <option value="Info">Info</option>
          </select>

          <select
            value={dateRangeFilter}
            onChange={(e) => {
              setDateRangeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Notifications Table */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notification records match criteria"
          description="Try broadening your search term or filter parameters."
        />
      ) : (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#e0e0e6]">
              <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
                <tr>
                  <th className="px-6 py-4">Severity & Type</th>
                  <th className="px-6 py-4">Message</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Received Time</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {filteredNotifications.map((notif) => {
                  const eventType = notif.domainEvent?.type || 'Notification';
                  const isError = eventType.includes('Failed') || eventType.includes('Error');
                  const isWarning = eventType.includes('Approval') || eventType.includes('Warning');
                  const jobId = notif.domainEvent?.jobId || notif.domainEvent?.payload?.jobId;

                  return (
                    <tr
                      key={notif.id}
                      onClick={() => setSelectedNotification(notif)}
                      className={`hover:bg-[#161620]/40 transition cursor-pointer group ${
                        notif.readAt ? 'bg-transparent' : 'bg-purple-500/[0.03]'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isError ? (
                            <span className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle size={14} />
                            </span>
                          ) : isWarning ? (
                            <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle size={14} />
                            </span>
                          ) : (
                            <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Info size={14} />
                            </span>
                          )}
                          <span className="font-semibold text-xs text-white group-hover:text-purple-300 transition">
                            {eventType}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className={`text-xs max-w-lg line-clamp-2 ${notif.readAt ? 'text-[#9c9cb0]' : 'text-white font-medium'}`}>
                          {notif.message}
                        </p>
                        {jobId && (
                          <span className="inline-block mt-1 font-mono text-[10px] text-purple-400">
                            Job: {jobId.slice(0, 8)}...
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            notif.readAt
                              ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {notif.readAt ? 'Read' : 'Unread'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>{new Date(notif.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleDeepLink(notif, e)}
                            title="Navigate to related module"
                            className="p-1.5 text-purple-400 hover:text-purple-300 rounded hover:bg-purple-500/10 transition cursor-pointer"
                          >
                            <ExternalLink size={14} />
                          </button>

                          <button
                            onClick={() => setSelectedNotification(notif)}
                            title="View details"
                            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/5 transition cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>

                          {!notif.readAt && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Check}
                              isLoading={markReadMutation.isPending && actionId === notif.id}
                              loadingText="Marking..."
                              onClick={() => markReadMutation.mutate(notif.id)}
                            >
                              Mark Read
                            </Button>
                          )}

                          <button
                            onClick={() => deleteMutation.mutate(notif.id)}
                            title="Delete notification"
                            className="p-1.5 text-[#6e6e80] hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#161620] px-6 py-4">
              <span className="text-xs text-[#9c9cb0]">
                Showing page <span className="font-semibold text-white">{page}</span> of{' '}
                <span className="font-semibold text-white">{totalPages}</span> ({total} total notifications)
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

      {/* Details Modal */}
      {selectedNotification && (
        <NotificationDetailsModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onMarkRead={(id) => markReadMutation.mutate(id)}
          onDelete={(id) => deleteMutation.mutate(id)}
          isMarkingRead={markReadMutation.isPending && actionId === selectedNotification.id}
          isDeleting={deleteMutation.isPending && actionId === selectedNotification.id}
        />
      )}
    </div>
  );
};

export default NotificationsView;
