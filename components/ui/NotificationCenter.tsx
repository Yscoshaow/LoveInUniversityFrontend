import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Settings, Loader2 } from 'lucide-react';
import { NotificationItem, NotificationType } from '../../types';
import { notificationApi } from '../../lib/api';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLink?: (linkUrl: string, data?: string) => void;
}

const NOTIFICATION_ICONS: Partial<Record<NotificationType, string>> = {
  LOCK_CREATED: '🔒',
  LOCK_EXPIRED: '⏰',
  LOCK_UNLOCKED: '🔓',
  LOCK_FROZEN: '🧊',
  LOCK_UNFROZEN: '☀️',
  LOCK_EMERGENCY_UNLOCKED: '🚨',
  TIME_ADDED: '➕',
  TIME_REMOVED: '➖',
  KEYHOLDER_ADDED: '🔑',
  KEYHOLDER_REMOVED: '🔑',
  KEYHOLDER_REQUEST: '📨',
  TASK_ASSIGNED: '📋',
  TASK_SUBMITTED: '📝',
  TASK_APPROVED: '✅',
  TASK_REJECTED: '❌',
  TASK_EXPIRED: '⏰',
  EXTENSION_TRIGGERED: '⚡',
  WHEEL_SPIN_RESULT: '🎡',
  DICE_ROLL_RESULT: '🎲',
  RANDOM_EVENT_OCCURRED: '🎲',
  PILLORY_VOTE_RECEIVED: '🗳️',
  PILLORY_STARTED: '📢',
  PILLORY_ENDED: '📢',
  VERIFICATION_REQUIRED: '📸',
  VERIFICATION_OVERDUE: '⚠️',
  VERIFICATION_APPROVED: '✅',
  HYGIENE_OPENING_STARTED: '🚿',
  HYGIENE_OPENING_ENDED: '🚿',
  HYGIENE_OPENING_OVERDUE: '⚠️',
  SHARE_LINK_USED: '🔗'
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNavigateToLink
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationApi.getNotifications(50);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await notificationApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            <h2 className="font-bold text-lg">通知</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300"
                title="全部标为已读"
              >
                <CheckCheck size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <Bell size={48} className="mx-auto mb-2 opacity-50" />
              <p>暂无通知</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl">
                      {NOTIFICATION_ICONS[notification.type] || '📢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium ${!notification.isRead ? 'text-primary' : ''}`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs text-primary flex items-center gap-1"
                          >
                            <Check size={14} />
                            标为已读
                          </button>
                        )}
                        {notification.linkUrl && onNavigateToLink && (
                          <button
                            onClick={() => {
                              onNavigateToLink(notification.linkUrl!, notification.data ?? undefined);
                              onClose();
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            查看详情
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 ml-auto"
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
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
