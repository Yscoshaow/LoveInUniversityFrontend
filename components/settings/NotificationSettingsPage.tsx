import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Lock,
  Key,
  ListTodo,
  Zap,
  Camera,
  Moon,
  Clock,
  Minus,
  Plus,
  Send,
  Smartphone,
  Eye,
  Users,
} from 'lucide-react';
import { notificationApi } from '@/lib/api';
import { NotificationSettings } from '@/types';

interface NotificationSettingsPageProps {
  onBack: () => void;
}

export const NotificationSettingsPage: React.FC<NotificationSettingsPageProps> = ({
  onBack,
}) => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await notificationApi.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Toggle boolean setting
  const handleToggle = async (key: keyof NotificationSettings) => {
    if (!settings || saving) return;

    const newValue = !settings[key];
    setSaving(true);
    setSavingField(key);

    try {
      const updated = await notificationApi.updateSettings({
        [key]: newValue,
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update notification setting:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  // Update quiet hours
  const handleQuietHoursChange = async (field: 'quietHoursStart' | 'quietHoursEnd', value: number | null) => {
    if (!settings || saving) return;

    setSaving(true);
    setSavingField(field);

    try {
      const updated = await notificationApi.updateSettings({
        [field]: value,
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update quiet hours:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  // Format hour for display
  const formatHour = (hour: number | null): string => {
    if (hour === null) return '未设置';
    return `${String(hour).padStart(2, '0')}:00`;
  };

  // Check if quiet hours are enabled
  const quietHoursEnabled = settings?.quietHoursStart !== null && settings?.quietHoursEnd !== null;

  // Toggle quiet hours
  const handleToggleQuietHours = async () => {
    if (!settings || saving) return;

    setSaving(true);
    setSavingField('quietHours');

    try {
      if (quietHoursEnabled) {
        // Disable quiet hours
        const updated = await notificationApi.updateSettings({
          quietHoursStart: null,
          quietHoursEnd: null,
        });
        setSettings(updated);
      } else {
        // Enable with default values (22:00 - 08:00)
        const updated = await notificationApi.updateSettings({
          quietHoursStart: 22,
          quietHoursEnd: 8,
        });
        setSettings(updated);
      }
    } catch (err) {
      console.error('Failed to toggle quiet hours:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto no-scrollbar lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="font-bold text-slate-800 dark:text-slate-100">通知设置</h1>
      </div>

      <div className="p-6 pb-32 lg:pb-8">
        {/* Push Notification Channels */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Send size={18} className="text-primary" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">推送方式</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Telegram Push */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('enableTelegram')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                  <Send size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">Telegram 推送</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    通过 Telegram 机器人接收通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'enableTelegram' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.enableTelegram ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* In-App Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => handleToggle('enableInApp')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950 text-green-500 dark:text-green-400 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">应用内通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    在应用内显示通知消息
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'enableInApp' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.enableInApp ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notification Categories */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Bell size={18} className="text-secondary" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">通知类型</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Lock Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('lockNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                  <Lock size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">锁定通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    锁创建、解锁、时间变化等通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'lockNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.lockNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Task Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('taskNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <ListTodo size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">任务通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    任务分配、提交、审核结果通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'taskNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.taskNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Keyholder Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('keyholderNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">Keyholder 通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Keyholder 添加、移除、请求通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'keyholderNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.keyholderNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Extension Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('extensionNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">扩展通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    轮盘、骰子、随机事件等扩展通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'extensionNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.extensionNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Verification Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('verificationNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950 text-pink-500 dark:text-pink-400 flex items-center justify-center">
                  <Camera size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">验证通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    验证请求、验证结果通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'verificationNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.verificationNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Supervision Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('supervisionNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-500 dark:text-teal-400 flex items-center justify-center">
                  <Eye size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">监督通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    监督请求、监督任务相关通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'supervisionNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.supervisionNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Social Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => handleToggle('socialNotifications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">社交通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    评论回复、日程分享、回忆相关通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'socialNotifications' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.socialNotifications ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Hours Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Moon size={18} className="text-indigo-500 dark:text-indigo-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">静默时段</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Quiet Hours Toggle */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={handleToggleQuietHours}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Moon size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">启用静默时段</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    在指定时间段内不发送 Telegram 通知
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'quietHours' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : quietHoursEnabled ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Quiet Hours Time Settings */}
            {quietHoursEnabled && (
              <div className="p-4 border-t border-slate-50 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-100">静默时间范围</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      设置开始和结束时间
                    </div>
                  </div>
                </div>

                {/* Start Time */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">开始时间</span>
                    {savingField === 'quietHoursStart' && (
                      <Loader2 size={16} className="animate-spin text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const current = settings?.quietHoursStart ?? 22;
                        const newValue = current <= 0 ? 23 : current - 1;
                        handleQuietHoursChange('quietHoursStart', newValue);
                      }}
                      disabled={saving}
                      className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {formatHour(settings?.quietHoursStart ?? null)}
                    </div>
                    <button
                      onClick={() => {
                        const current = settings?.quietHoursStart ?? 22;
                        const newValue = current >= 23 ? 0 : current + 1;
                        handleQuietHoursChange('quietHoursStart', newValue);
                      }}
                      disabled={saving}
                      className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {/* End Time */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">结束时间</span>
                    {savingField === 'quietHoursEnd' && (
                      <Loader2 size={16} className="animate-spin text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const current = settings?.quietHoursEnd ?? 8;
                        const newValue = current <= 0 ? 23 : current - 1;
                        handleQuietHoursChange('quietHoursEnd', newValue);
                      }}
                      disabled={saving}
                      className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {formatHour(settings?.quietHoursEnd ?? null)}
                    </div>
                    <button
                      onClick={() => {
                        const current = settings?.quietHoursEnd ?? 8;
                        const newValue = current >= 23 ? 0 : current + 1;
                        handleQuietHoursChange('quietHoursEnd', newValue);
                      }}
                      disabled={saving}
                      className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 px-1">
                  在 {formatHour(settings?.quietHoursStart ?? null)} 到 {formatHour(settings?.quietHoursEnd ?? null)} 之间，不会发送 Telegram 推送通知
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-4 border border-blue-100 dark:border-blue-900">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <Bell size={18} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-1">通知提示</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                Telegram 推送需要您已关联 Telegram 账号。关闭某类通知后，您将不会收到该类别的任何推送，但应用内通知记录仍会保留。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
