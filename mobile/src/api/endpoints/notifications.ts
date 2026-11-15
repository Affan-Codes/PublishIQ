import apiClient from '../client';
import { unwrap, unwrapWithMeta } from '../unwrap';
import { ApiSuccess, Notification, PaginationMeta } from '../../types/domain';

export interface NotificationsQueryParams {
  status?: 'unread' | 'read' | 'all';
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getNotifications(
  params?: NotificationsQueryParams,
  signal?: AbortSignal
): Promise<{ data: Notification[]; meta?: PaginationMeta }> {
  const res = await apiClient.get<ApiSuccess<Notification[], PaginationMeta>>('/notifications', {
    params,
    signal,
  });
  return unwrapWithMeta(res);
}

export async function getUnreadCount(signal?: AbortSignal): Promise<{ unreadCount: number }> {
  const res = await apiClient.get<ApiSuccess<{ unreadCount: number }>>('/notifications/unread-count', { signal });
  return unwrap(res);
}

export async function getNotificationById(id: string, signal?: AbortSignal): Promise<Notification> {
  const res = await apiClient.get<ApiSuccess<Notification>>(`/notifications/${id}`, { signal });
  return unwrap(res);
}

export async function markAsRead(id: string): Promise<{ message?: string }> {
  const res = await apiClient.post<ApiSuccess<{ message?: string }>>(`/notifications/${id}/read`);
  return unwrap(res);
}

export async function markAllAsRead(): Promise<{ message?: string }> {
  const res = await apiClient.post<ApiSuccess<{ message?: string }>>('/notifications/read-all');
  return unwrap(res);
}

export async function deleteNotification(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/notifications/${id}`);
  return unwrap(res);
}
