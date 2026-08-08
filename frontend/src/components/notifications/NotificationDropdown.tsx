import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, CheckCheck, RefreshCw, ExternalLink, Trash2, Check, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.js';
import { SkeletonList } from '../ui/Skeleton.js';
import { ErrorState } from '../ui/ErrorState.js';
import { NotificationDetailsModal, type NotificationItem } from './NotificationDetailsModal.js';

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export const NotificationDropdown: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unreadCount, addToast, resetUnreadCount } = useNotifications();
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Query latest notifications for dropdown
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/notifications', {
        params: { page: 1, limit: 10 },
        withCredentials: true,
      });
      return res.data;
    },
    enabled: isOpen,
    placeholderData: keepPreviousData,
  });

  const notifications: NotificationItem[] = data?.data || [];

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`/api/v1/notifications/${id}/read`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('Marked as read', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to mark as read', 'error');
    },
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
      await axios.delete(`/api/v1/notifications/${id}`, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('Notification deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete notification', 'error');
    },
  });

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.readAt) {
      markReadMutation.mutate(notif.id);
    }
    setSelectedNotification(notif);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open Notifications Dropdown"
        className="relative rounded-full p-2 text-[#9c9cb0] transition hover:bg-[#161620] hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-96 rounded-2xl border border-[#1d1d2d] bg-[#0e0e14] shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1a1a26] bg-[#12121c] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh notifications"
                className="p-1 rounded text-[#9c9cb0] hover:text-white hover:bg-[#1c1c2a] transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-purple-400' : ''}`} />
              </button>

              {notifications.some((n) => !n.readAt) && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  title="Mark all as read"
                  className="p-1 rounded text-[#9c9cb0] hover:text-purple-400 hover:bg-[#1c1c2a] transition cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[#1a1a26]">
            {isLoading ? (
              <div className="p-4">
                <SkeletonList count={3} />
              </div>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title="Failed to load"
                  message={(error as any)?.message || 'Communication error.'}
                  onRetry={() => refetch()}
                />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#161622] text-[#6e6e80] mb-3">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-white">All caught up!</p>
                <p className="text-[11px] text-[#6e6e80] mt-1">No new notifications to display.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const eventType = notif.domainEvent?.type || 'Notification';
                const isError = eventType.includes('Failed') || eventType.includes('Error');
                const isWarning = eventType.includes('Approval') || eventType.includes('Warning');

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`group flex items-start justify-between gap-3 p-3.5 transition-colors cursor-pointer ${
                      notif.readAt ? 'bg-transparent hover:bg-[#151522]' : 'bg-purple-500/[0.04] hover:bg-purple-500/[0.08]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {isError ? (
                          <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                        ) : isWarning ? (
                          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                        ) : (
                          <Info className="h-4 w-4 text-purple-400 flex-shrink-0" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-purple-300 truncate">
                            {eventType}
                          </span>
                          <span className="text-[10px] text-[#6e6e80] flex-shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <p className={`text-xs leading-snug line-clamp-2 ${notif.readAt ? 'text-[#9c9cb0]' : 'text-white font-medium'}`}>
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {!notif.readAt && (
                        <button
                          onClick={() => markReadMutation.mutate(notif.id)}
                          title="Mark read"
                          className="p-1 rounded text-[#6e6e80] hover:text-emerald-400 hover:bg-[#1a1a26] transition cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(notif.id)}
                        title="Delete notification"
                        className="p-1 rounded text-[#6e6e80] hover:text-rose-400 hover:bg-[#1a1a26] transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Link */}
          <div className="border-t border-[#1a1a26] bg-[#12121c] px-4 py-2.5 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1.5 w-full cursor-pointer"
            >
              <span>View All Notifications</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Item Details Inspector Modal */}
      {selectedNotification && (
        <NotificationDetailsModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onMarkRead={(id) => markReadMutation.mutate(id)}
          onDelete={(id) => deleteMutation.mutate(id)}
          isMarkingRead={markReadMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
};

export default NotificationDropdown;
