import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, Check, CheckCheck, Calendar } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonList } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';

interface DomainEvent {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
}

interface Notification {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  domainEvent: DomainEvent;
}

interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export const NotificationsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast, resetUnreadCount } = useNotifications();
  const [page, setPage] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const limit = 20;

  // Fetch notifications
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', page],
    queryFn: async () => {
      const response = await axios.get('/api/v1/notifications', {
        params: { page, limit },
        withCredentials: true,
      });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      setMarkingId(id);
      await axios.post(`/api/v1/notifications/${id}/read`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('Notification marked as read', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to mark as read', 'error');
    },
    onSettled: () => setMarkingId(null),
  });

  // Mark all as read
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
      addToast(err.response?.data?.error?.message || err.message || 'Failed to mark all as read', 'error');
    },
  });

  const notifications = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="h-6 w-6 text-purple-400" /> In-App Notifications
            </h2>
            <p className="text-sm text-[#9c9cb0]">Monitor status changes, system warnings, and approval holds</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load notifications"
          message={(error as any)?.message || 'An error occurred while fetching system notifications.'}
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
            <Bell className="h-6 w-6 text-purple-400" /> In-App Notifications
          </h2>
          <p className="text-sm text-[#9c9cb0]">Monitor status changes, system warnings, and approval holds</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh notifications" />
          
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

      {/* Notifications List */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You are all caught up! Real-time notifications and system warnings will appear here."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] divide-y divide-[#1a1a24]">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start justify-between gap-4 p-5 transition-colors ${
                  notif.readAt ? 'bg-transparent' : 'bg-purple-500/[0.02]'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-400">
                      {notif.domainEvent?.type || 'System Notification'}
                    </span>
                    {!notif.readAt && (
                      <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm text-white font-medium">{notif.message}</p>
                  <div className="flex items-center gap-1.5 text-xs text-[#6e6e80]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(notif.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {!notif.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Check}
                    isLoading={markReadMutation.isPending && markingId === notif.id}
                    loadingText="Marking..."
                    onClick={() => markReadMutation.mutate(notif.id)}
                  >
                    Mark Read
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#1a1a24] bg-[#0e0e12] p-4 rounded-xl">
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
    </div>
  );
};

export default NotificationsView;
