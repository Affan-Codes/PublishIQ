import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, Check, CheckCheck, Calendar } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.js';

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
  const { resetUnreadCount } = useNotifications();
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch notifications
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', page],
    queryFn: async () => {
      const response = await axios.get('/api/v1/notifications', {
        params: { page, limit },
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/notifications/${id}/read`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await axios.post('/api/v1/notifications/read-all', {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      resetUnreadCount();
    },
  });

  const notifications = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / limit);

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

        {notifications.some((n) => !n.readAt) && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="flex items-center gap-2 rounded-lg bg-purple-600/10 px-4 py-2 text-sm font-medium text-purple-400 border border-purple-500/20 hover:bg-purple-600 hover:text-white transition duration-200"
          >
            <CheckCheck className="h-4 w-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#161620] text-[#6e6e80]">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">No notifications</h3>
          <p className="mt-2 text-sm text-[#6e6e80]">You are all caught up! No notifications to show.</p>
        </div>
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        notif.domainEvent?.type === 'JobFailed'
                          ? 'bg-red-500/15 text-red-400'
                          : notif.domainEvent?.type === 'ApprovalRequired'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {notif.domainEvent?.type || 'SystemEvent'}
                    </span>
                    <span className="text-xs text-[#6e6e80] flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className={`text-sm ${notif.readAt ? 'text-[#9c9cb0]' : 'text-white font-medium'}`}>
                    {notif.message}
                  </p>
                </div>

                {!notif.readAt && (
                  <button
                    onClick={() => markReadMutation.mutate(notif.id)}
                    title="Mark as read"
                    className="rounded-lg p-1.5 text-[#9c9cb0] border border-transparent hover:border-[#1a1a24] hover:bg-[#161620] hover:text-emerald-400 transition"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="rounded-lg border border-[#1a1a24] bg-[#0e0e12] px-4 py-2 text-sm text-[#9c9cb0] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition"
              >
                Previous
              </button>
              <span className="text-sm text-[#9c9cb0]">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="rounded-lg border border-[#1a1a24] bg-[#0e0e12] px-4 py-2 text-sm text-[#9c9cb0] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
