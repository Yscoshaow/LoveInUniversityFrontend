'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  ArrowLeft,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Loader2,
  Lock,
  Key,
  ListTodo,
  Zap,
  Camera,
  Link as LinkIcon,
  Settings,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { NotificationItem, NotificationType, NotificationSettings } from '../../types';
import { notificationApi } from '../../lib/api';

interface NotificationsPageProps {
  onBack?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToLink?: (linkUrl: string, data?: string) => void;
}

// Notification type configuration
const NOTIFICATION_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  // Lock related
  LOCK_CREATED: { icon: '🔒', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  LOCK_READY_TO_UNLOCK: { icon: '🔓', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },
  LOCK_EXPIRED: { icon: '⏰', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  LOCK_UNLOCKED: { icon: '🔓', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },
  LOCK_FROZEN: { icon: '🧊', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
  LOCK_UNFROZEN: { icon: '☀️', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  LOCK_EMERGENCY_UNLOCKED: { icon: '🚨', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },

  // Time changes
  TIME_ADDED: { icon: '➕', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  TIME_REMOVED: { icon: '➖', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },

  // Keyholder
  KEYHOLDER_ADDED: { icon: '🔑', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  KEYHOLDER_REMOVED: { icon: '🔑', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-900' },
  KEYHOLDER_REQUEST: { icon: '📨', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },

  // Task
  TASK_ASSIGNED: { icon: '📋', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-950' },
  TASK_SUBMITTED: { icon: '📝', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  TASK_APPROVED: { icon: '✅', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },
  TASK_REJECTED: { icon: '❌', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  TASK_EXPIRED: { icon: '⏰', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },

  // Extension
  EXTENSION_TRIGGERED: { icon: '⚡', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  WHEEL_SPIN_RESULT: { icon: '🎡', color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-950' },
  DICE_ROLL_RESULT: { icon: '🎲', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  RANDOM_EVENT_OCCURRED: { icon: '🎲', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-950' },

  // Pillory
  PILLORY_VOTE_RECEIVED: { icon: '🗳️', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  PILLORY_STARTED: { icon: '📢', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  PILLORY_ENDED: { icon: '📢', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-900' },

  // Verification
  VERIFICATION_REQUIRED: { icon: '📸', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  VERIFICATION_OVERDUE: { icon: '⚠️', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  VERIFICATION_APPROVED: { icon: '✅', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },

  // Hygiene
  HYGIENE_OPENING_STARTED: { icon: '🚿', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
  HYGIENE_OPENING_ENDED: { icon: '🚿', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-900' },
  HYGIENE_OPENING_OVERDUE: { icon: '⚠️', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },

  // Share link
  SHARE_LINK_USED: { icon: '🔗', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },

  // Comment
  COMMENT_NEW: { icon: '💬', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  COMMENT_REPLY: { icon: '💬', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
};

// Category configuration
const CATEGORIES = [
  { key: 'all', label: '全部', icon: Bell },
  { key: 'lock', label: '锁', icon: Lock },
  { key: 'keyholder', label: '管理者', icon: Key },
  { key: 'task', label: '任务', icon: ListTodo },
  { key: 'extension', label: '扩展', icon: Zap },
  { key: 'verification', label: '验证', icon: Camera },
  { key: 'social', label: '社交', icon: MessageSquare },
];

// Map notification types to categories
const TYPE_TO_CATEGORY: Record<string, string> = {
  LOCK_CREATED: 'lock', LOCK_READY_TO_UNLOCK: 'lock', LOCK_EXPIRED: 'lock',
  LOCK_UNLOCKED: 'lock', LOCK_FROZEN: 'lock', LOCK_UNFROZEN: 'lock',
  LOCK_EMERGENCY_UNLOCKED: 'lock', TIME_ADDED: 'lock', TIME_REMOVED: 'lock',
  KEYHOLDER_ADDED: 'keyholder', KEYHOLDER_REMOVED: 'keyholder', KEYHOLDER_REQUEST: 'keyholder',
  TASK_ASSIGNED: 'task', TASK_SUBMITTED: 'task', TASK_APPROVED: 'task',
  TASK_REJECTED: 'task', TASK_EXPIRED: 'task',
  EXTENSION_TRIGGERED: 'extension', WHEEL_SPIN_RESULT: 'extension',
  DICE_ROLL_RESULT: 'extension', RANDOM_EVENT_OCCURRED: 'extension',
  PILLORY_VOTE_RECEIVED: 'extension', PILLORY_STARTED: 'extension', PILLORY_ENDED: 'extension',
  VERIFICATION_REQUIRED: 'verification', VERIFICATION_OVERDUE: 'verification',
  VERIFICATION_APPROVED: 'verification', HYGIENE_OPENING_STARTED: 'verification',
  HYGIENE_OPENING_ENDED: 'verification', HYGIENE_OPENING_OVERDUE: 'verification',
  SHARE_LINK_USED: 'extension',
  COMMENT_NEW: 'social', COMMENT_REPLY: 'social',
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onBack,
  onNavigateToSettings,
  onNavigateToLink,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationApi.getNotifications(100);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (showUnreadOnly && n.isRead) return false;
    if (selectedCategory === 'all') return true;
    return TYPE_TO_CATEGORY[n.type] === selectedCategory;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = '今天';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = '昨天';
    } else {
      groupKey = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, NotificationItem[]>);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold">通知</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} 条未读</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300"
                title="全部标为已读"
              >
                <CheckCheck size={20} />
              </button>
            )}
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300"
                title="通知设置"
              >
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.key;
            const count = cat.key === 'all'
              ? notifications.length
              : notifications.filter(n => TYPE_TO_CATEGORY[n.type] === cat.key).length;

            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 dark:bg-slate-800/20' : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Unread Toggle */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              showUnreadOnly
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Filter size={14} />
            <span>仅显示未读</span>
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            共 {filteredNotifications.length} 条通知
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchNotifications}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              重试
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">暂无通知</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {showUnreadOnly ? '没有未读通知' : '您还没有收到任何通知'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedNotifications).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                  {date}
                </h3>
                <div className="space-y-2">
                  {items.map(notification => {
                    const config = NOTIFICATION_CONFIG[notification.type] || {
                      icon: '📢',
                      color: 'text-slate-600 dark:text-slate-300',
                      bgColor: 'bg-slate-50 dark:bg-slate-900'
                    };

                    return (
                      <div
                        key={notification.id}
                        className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border transition-all ${
                          !notification.isRead
                            ? 'border-primary/20 shadow-primary/5'
                            : 'border-slate-100 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center text-xl shrink-0`}>
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`font-semibold text-sm ${!notification.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                {notification.title}
                              </h4>
                              <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                                {formatTime(notification.createdAt)}
                              </span>
                            </div>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-3 mt-3">
                              {!notification.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/80 transition-colors"
                                >
                                  <Check size={14} />
                                  已读
                                </button>
                              )}
                              {notification.linkUrl && onNavigateToLink && (
                                <button
                                  onClick={() => onNavigateToLink(notification.linkUrl!, notification.data ?? undefined)}
                                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                >
                                  <LinkIcon size={14} />
                                  查看
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(notification.id)}
                                className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Unread indicator */}
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
