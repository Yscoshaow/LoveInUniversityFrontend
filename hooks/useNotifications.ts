import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { UpdateNotificationSettingsRequest } from '../types';

/**
 * Hook for fetching notifications
 */
export function useNotifications(limit?: number, offset?: number) {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationApi.getNotifications(limit, offset),
  });
}

/**
 * Hook for fetching unread notifications
 */
export function useUnreadNotifications(limit?: number) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationApi.getUnread(limit),
  });
}

/**
 * Hook for fetching unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    // Poll every 30 seconds for real-time updates
    refetchInterval: 30 * 1000,
  });
}

/**
 * Hook for fetching notification stats
 */
export function useNotificationStats() {
  return useQuery({
    queryKey: ['notifications', 'stats'],
    queryFn: () => notificationApi.getStats(),
  });
}

/**
 * Hook for marking a notification as read
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

/**
 * Hook for marking multiple notifications as read
 */
export function useMarkMultipleNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: number[]) => notificationApi.markMultipleAsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

/**
 * Hook for marking all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

/**
 * Hook for deleting a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => notificationApi.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
}

/**
 * Hook for fetching notification settings
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notifications', 'settings'],
    queryFn: () => notificationApi.getSettings(),
  });
}

/**
 * Hook for updating notification settings
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateNotificationSettingsRequest) => notificationApi.updateSettings(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'settings'] });
    },
  });
}
