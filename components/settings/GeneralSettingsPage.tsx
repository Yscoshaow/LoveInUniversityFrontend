import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  MessageCircle,
  Bell,
  Shield,
  Loader2,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Clock,
  Globe,
  Moon,
  Sun,
  Minus,
  Plus,
  FileSignature,
  Fingerprint,
  Settings,
  Box,
  Trophy,
  Smartphone,
  Pause,
  Play,
  Unlink,
  Image,
  ShieldOff,
  Key,
  Copy,
  Trash2,
  Check,
  Code,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { userProfileApi, yiciyuanApi, apiTokenApi, UserSettings, ApiTokenInfo } from '@/lib/api';
import type { YiciyuanAccountStatus, YiciyuanDeviceInfo } from '@/types';
import { isCard3DEffectEnabled, setCard3DEffectEnabled, isImmersiveInteractionEnabled, setImmersiveInteractionEnabled, isRouletteCoverBgEnabled, setRouletteCoverBgEnabled } from '@/lib/local-settings';

// ── API 文档子组件 ──
const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/open/profile',
    description: '个人资料',
    response: `{
  "id": 1,
  "username": "alice",
  "firstName": "Alice",
  "credits": 150,
  "campusPoints": 1200,
  "bio": "...",
  "tags": ["tag1", "tag2"]
}`,
  },
  {
    method: 'GET',
    path: '/open/locks',
    description: '我的锁列表',
    params: 'active=true 仅返回活跃锁',
    response: `[{
  "id": 42,
  "lockType": "SELF",
  "status": "ACTIVE",
  "remainingSeconds": 3600,
  "isFrozen": false,
  "hasKeyholder": true
}]`,
  },
  {
    method: 'GET',
    path: '/open/managed-locks',
    description: '我管理的锁',
    response: `[{
  "lockId": 42,
  "wearerUsername": "bob",
  "lockStatus": "ACTIVE",
  "remainingSeconds": 7200,
  "isFrozen": false
}]`,
  },
  {
    method: 'GET',
    path: '/open/credits',
    description: '学分与点数',
    response: `{
  "credits": 150,
  "campusPoints": 1200
}`,
  },
  {
    method: 'GET',
    path: '/open/tasks',
    description: '今日任务',
    params: 'date=2026-03-24 指定日期（可选）',
    response: `{
  "date": "2026-03-24",
  "totalTasks": 3,
  "completedTasks": 1,
  "inProgressTasks": 1,
  "pendingTasks": 1,
  "tasks": [{
    "id": 1,
    "courseName": "数学",
    "taskName": "每日练习",
    "status": "COMPLETED"
  }]
}`,
  },
  {
    method: 'GET',
    path: '/open/schedule',
    description: '课程日程',
    params: 'date=2026-03-24 指定日期（可选）',
    response: `[{
  "id": 1,
  "title": "高数课",
  "date": "2026-03-24",
  "startTime": "09:00",
  "endTime": "10:30",
  "location": "教学楼 A301",
  "status": "UPCOMING"
}]`,
  },
  {
    method: 'GET',
    path: '/open/supervision',
    description: '监督协议',
    response: `{
  "hasSupervisor": true,
  "supervisorName": "Alice",
  "superviseeCount": 2,
  "superviseesNames": ["Bob", "Carol"],
  "pendingRequestCount": 0
}`,
  },
  {
    method: 'GET',
    path: '/open/notifications',
    description: '未读通知',
    response: `{
  "unreadCount": 5,
  "byType": {
    "LOCK_READY_TO_UNLOCK": 2,
    "TASK_COMPLETED": 3
  }
}`,
  },
];

const ApiDocSection: React.FC = () => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopyCurl = async (path: string, idx: number) => {
    const cmd = `curl -H "Authorization: Bearer lvu_你的token" ${API_BASE}/api/v1${path}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="mt-3 bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Code size={16} className="text-cyan-500" />
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">API 文档</h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          所有请求需在 Header 中携带 <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[11px]">Authorization: Bearer lvu_xxx</code>
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Base URL: <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[11px] break-all">{API_BASE}/api/v1</code>
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          速率限制: 60 次/分钟
        </p>
      </div>

      {/* Endpoints */}
      {API_ENDPOINTS.map((ep, idx) => (
        <div key={ep.path} className="border-b last:border-b-0 border-slate-50 dark:border-slate-700">
          {/* Endpoint row */}
          <button
            className="w-full p-3 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
              {ep.method}
            </span>
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{ep.path}</code>
            <span className="ml-auto shrink-0 text-xs text-slate-400">{ep.description}</span>
            <ChevronRight size={14} className={`shrink-0 text-slate-300 transition-transform ${expandedIdx === idx ? 'rotate-90' : ''}`} />
          </button>

          {/* Expanded detail */}
          {expandedIdx === idx && (
            <div className="px-3 pb-3 space-y-2">
              {/* curl */}
              <div className="relative">
                <code className="block text-[11px] bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg p-3 font-mono break-all whitespace-pre-wrap leading-relaxed">
                  {`curl -H "Authorization: Bearer lvu_xxx" \\\n  ${API_BASE}/api/v1${ep.path}${ep.params ? `?${ep.params.split(' ')[0]}` : ''}`}
                </code>
                <button
                  onClick={() => handleCopyCurl(ep.path, idx)}
                  className="absolute top-2 right-2 p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              {/* Params */}
              {ep.params && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium">参数:</span> {ep.params}
                </p>
              )}

              {/* Response */}
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-medium">响应示例:</p>
                <code className="block text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg p-3 font-mono break-all whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {ep.response}
                </code>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── API Token 管理子组件 ──
const ApiTokenSection: React.FC = () => {
  const [tokens, setTokens] = useState<ApiTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTokenPlain, setNewTokenPlain] = useState<string | null>(null); // 明文 token，仅创建后显示一次
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    apiTokenApi.list().then(setTokens).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newTokenName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await apiTokenApi.create(newTokenName.trim());
      setNewTokenPlain(res.token);
      setTokens(prev => [res.tokenInfo, ...prev]);
      setNewTokenName('');
      toast.success('Token 已创建');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleRevoke = async (tokenId: number) => {
    setRevokingId(tokenId);
    try {
      await apiTokenApi.revoke(tokenId);
      setTokens(prev => prev.filter(t => t.id !== tokenId));
      toast.success('Token 已吊销');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '吊销失败');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Code size={18} className="text-cyan-500" />
        <h2 className="font-bold text-slate-800 dark:text-slate-100">开放 API</h2>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
        {/* 说明 */}
        <div className="p-4 border-b border-slate-50 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            生成 API Token 后，你可以通过 HTTP 请求查询自己的锁状态、学分等数据。Token 仅在创建时显示一次，请妥善保存。
          </p>
        </div>

        {/* 新创建的 Token 明文展示 */}
        {newTokenPlain && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950 border-b border-slate-50 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Key size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Token 已创建 — 请立即复制保存</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-slate-900 rounded-lg px-3 py-2 font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                {newTokenPlain}
              </code>
              <button
                onClick={() => handleCopy(newTokenPlain)}
                className="shrink-0 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={() => setNewTokenPlain(null)}
              className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 underline"
            >
              我已保存，关闭提示
            </button>
          </div>
        )}

        {/* 创建新 Token */}
        {showCreateForm ? (
          <div className="p-4 border-b border-slate-50 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder={'Token 名称，如"我的脚本"'}
                maxLength={100}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-primary"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newTokenName.trim()}
                className="shrink-0 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : '创建'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewTokenName(''); }}
                className="shrink-0 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div
            className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
            onClick={() => setShowCreateForm(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-500 dark:text-cyan-400 flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div className="font-medium text-sm text-slate-800 dark:text-slate-100">创建新 Token</div>
          </div>
        )}

        {/* Token 列表 */}
        {loading ? (
          <div className="p-6 flex justify-center">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
            暂无 API Token
          </div>
        ) : (
          tokens.map(token => (
            <div key={token.id} className="p-4 flex items-center justify-between border-b last:border-b-0 border-slate-50 dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                  <Key size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{token.name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{token.tokenPrefix}••••••</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {token.lastUsedAt
                      ? `最后使用: ${new Date(token.lastUsedAt).toLocaleDateString()}`
                      : '尚未使用'
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(token.id)}
                disabled={revokingId === token.id}
                className="shrink-0 p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition-colors"
              >
                {revokingId === token.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          ))
        )}
      </div>

      {/* API 使用文档 */}
      <ApiDocSection />
    </div>
  );
};

interface GeneralSettingsPageProps {
  onBack: () => void;
  onNavigateToNotificationSettings?: () => void;
  onNavigateToBlockedUsers?: () => void;
}

export const GeneralSettingsPage: React.FC<GeneralSettingsPageProps> = ({
  onBack,
  onNavigateToNotificationSettings,
  onNavigateToBlockedUsers,
}) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  // Local settings (stored in cookie)
  const [card3DEffect, setCard3DEffect] = useState(true);
  const [immersiveInteraction, setImmersiveInteraction] = useState(false);
  const [rouletteCoverBg, setRouletteCoverBg] = useState(false);

  // 账号与设备
  const [coursesPausedUntil, setCoursesPausedUntil] = useState<string | null>(null);
  const [pausingCourses, setPausingCourses] = useState(false);
  const [yiciyuanAccount, setYiciyuanAccount] = useState<YiciyuanAccountStatus | null>(null);
  const [yiciyuanDevices, setYiciyuanDevices] = useState<YiciyuanDeviceInfo[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ type: string; deviceId?: number } | null>(null);

  // Common timezones for display
  const commonTimezones = [
    { value: 'UTC', label: 'UTC (协调世界时)' },
    { value: 'Asia/Shanghai', label: '中国 (UTC+8)' },
    { value: 'Asia/Tokyo', label: '日本 (UTC+9)' },
    { value: 'Asia/Seoul', label: '韩国 (UTC+9)' },
    { value: 'Asia/Singapore', label: '新加坡 (UTC+8)' },
    { value: 'Asia/Hong_Kong', label: '香港 (UTC+8)' },
    { value: 'Asia/Taipei', label: '台北 (UTC+8)' },
    { value: 'America/New_York', label: '美东 (UTC-5/-4)' },
    { value: 'America/Los_Angeles', label: '美西 (UTC-8/-7)' },
    { value: 'Europe/London', label: '伦敦 (UTC+0/+1)' },
    { value: 'Europe/Paris', label: '巴黎 (UTC+1/+2)' },
    { value: 'Australia/Sydney', label: '悉尼 (UTC+10/+11)' },
  ];

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const [data, userData] = await Promise.all([
          userProfileApi.getSettings(),
          userProfileApi.getMe(),
        ]);
        setSettings(data);
        setCoursesPausedUntil((userData as any).coursesPausedUntil || null);
        // Load local settings from cookie
        setCard3DEffect(isCard3DEffectEnabled());
        setImmersiveInteraction(isImmersiveInteractionEnabled());
        setRouletteCoverBg(isRouletteCoverBgEnabled());

        // Load yiciyuan data
        try {
          const [accountStatus, devices] = await Promise.all([
            yiciyuanApi.getAccount(),
            yiciyuanApi.getDevices(),
          ]);
          setYiciyuanAccount(accountStatus);
          setYiciyuanDevices(devices);
        } catch {
          // Yiciyuan data is optional
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Toggle 3D effect (local setting)
  const handleToggle3DEffect = () => {
    const newValue = !card3DEffect;
    setCard3DEffect(newValue);
    setCard3DEffectEnabled(newValue);
  };

  // Toggle immersive interaction (local setting)
  const handleToggleImmersiveInteraction = () => {
    const newValue = !immersiveInteraction;
    setImmersiveInteraction(newValue);
    setImmersiveInteractionEnabled(newValue);
  };

  // Toggle roulette cover background (local setting)
  const handleToggleRouletteCoverBg = () => {
    const newValue = !rouletteCoverBg;
    setRouletteCoverBg(newValue);
    setRouletteCoverBgEnabled(newValue);
  };

  // Toggle boolean setting
  const handleToggle = async (key: keyof UserSettings) => {
    if (!settings || saving) return;

    const newValue = !settings[key];
    setSaving(true);
    setSavingField(key);

    try {
      const updated = await userProfileApi.updateSettings({
        [key]: newValue,
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update setting:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  // Update timezone
  const handleTimezoneChange = async (timezone: string) => {
    if (!settings || saving) return;

    setSaving(true);
    setSavingField('timezone');

    try {
      const updated = await userProfileApi.updateSettings({ timezone });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update timezone:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  // Update day start offset
  const handleDayStartOffsetChange = async (offset: number) => {
    if (!settings || saving) return;
    // Clamp to valid range
    const clampedOffset = Math.max(-12, Math.min(12, offset));

    setSaving(true);
    setSavingField('dayStartOffset');

    try {
      const updated = await userProfileApi.updateSettings({ dayStartOffsetHours: clampedOffset });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update day start offset:', err);
    } finally {
      setSaving(false);
      setSavingField(null);
    }
  };

  // 课程暂停/恢复
  const handlePauseCourses = async () => {
    setPausingCourses(true);
    setConfirmDialog(null);
    try {
      const res = await userProfileApi.pauseCourses();
      setCoursesPausedUntil(res.coursesPausedUntil);
    } catch (err: any) {
      toast.error(err?.message || '暂停失败');
    } finally {
      setPausingCourses(false);
    }
  };

  const handleUnpauseCourses = async () => {
    setPausingCourses(true);
    setConfirmDialog(null);
    try {
      await userProfileApi.unpauseCourses();
      setCoursesPausedUntil(null);
    } catch (err: any) {
      toast.error(err?.message || '恢复失败');
    } finally {
      setPausingCourses(false);
    }
  };

  // 异次元账户退出
  const handleLogoutYiciyuan = async () => {
    setConfirmDialog(null);
    try {
      await yiciyuanApi.deleteAccount();
      setYiciyuanAccount(null);
      setYiciyuanDevices([]);
    } catch (err: any) {
      toast.error(err?.message || '退出失败');
    }
  };

  // 解绑设备
  const handleUnbindDevice = async (deviceId: number) => {
    setConfirmDialog(null);
    try {
      await yiciyuanApi.unbindDevice(deviceId);
      setYiciyuanDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err: any) {
      toast.error(err?.message || '解绑失败');
    }
  };

  const isPaused = coursesPausedUntil && new Date(coursesPausedUntil) > new Date();
  const canUnpause = coursesPausedUntil && new Date(coursesPausedUntil) <= new Date();

  // Format offset for display
  const formatOffset = (offset: number): string => {
    if (offset === 0) return '午夜 00:00';
    if (offset > 0) return `凌晨 ${String(offset).padStart(2, '0')}:00`;
    return `前一天 ${String(24 + offset).padStart(2, '0')}:00`;
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
        <h1 className="font-bold text-slate-800 dark:text-slate-100">通用设置</h1>
      </div>

      <div className="p-6 pb-32 lg:pb-8">
        {/* Basic Settings Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Settings size={18} className="text-slate-600 dark:text-slate-300" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">基础设置</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* 3D Card Effect Toggle */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={handleToggle3DEffect}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Box size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">校园卡3D效果</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，校园卡将有3D倾斜和陀螺仪效果
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {card3DEffect ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Moon size={18} className="text-slate-600 dark:text-slate-300" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">外观设置</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-500 dark:text-violet-400 flex items-center justify-center">
                  <Moon size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">主题模式</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    选择你偏好的显示模式
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                {([
                  { value: 'system', label: '跟随系统', Icon: Globe },
                  { value: 'light', label: '浅色', Icon: Sun },
                  { value: 'dark', label: '深色', Icon: Moon },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                      theme === value
                        ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Shield size={18} className="text-primary" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">隐私设置</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Allow Telegram Contact */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('allowTelegramContact')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">允许通过Telegram联系</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，其他用户可以看到你的Telegram用户名和二维码
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'allowTelegramContact' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.allowTelegramContact ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Allow Supervision Request */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('allowSupervisionRequest')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <FileSignature size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">允许签订监督协议</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，其他用户可以向你发起监督协议签订请求
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'allowSupervisionRequest' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.allowSupervisionRequest ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Hide from Leaderboard */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={() => handleToggle('hideFromLeaderboard')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                  <Trophy size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">不参与排名</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，你将不会出现在学分排行榜上
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {savingField === 'hideFromLeaderboard' ? (
                  <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : settings?.hideFromLeaderboard ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Immersive Interaction */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={handleToggleImmersiveInteraction}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400 flex items-center justify-center">
                  <Fingerprint size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">沉浸式交互</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，签署监督协议等操作将唤起指纹验证
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {immersiveInteraction ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Roulette Cover Background */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-700"
              onClick={handleToggleRouletteCoverBg}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                  <Image size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">轮盘游戏封面背景</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    开启后，轮盘游戏默认将封面图作为游玩背景
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {rouletteCoverBg ? (
                  <ToggleRight size={32} className="text-primary" />
                ) : (
                  <ToggleLeft size={32} className="text-slate-300" />
                )}
              </div>
            </div>

            {/* Blocked Users */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={onNavigateToBlockedUsers}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 flex items-center justify-center">
                  <ShieldOff size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">拉黑列表</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    管理被拉黑的用户
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 dark:text-slate-600 shrink-0 ml-3" />
            </div>
          </div>
        </div>

        {/* API Token Section */}
        <ApiTokenSection />

        {/* Time Settings Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock size={18} className="text-secondary" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">时间设置</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Timezone */}
            <div className="p-4 border-b border-slate-50 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                  <Globe size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">时区</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    选择你所在的时区
                  </div>
                </div>
                {savingField === 'timezone' && (
                  <Loader2 size={18} className="animate-spin text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <select
                value={settings?.timezone || 'UTC'}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                disabled={saving}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-200 border-0 focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                {commonTimezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Day Start Offset */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <Moon size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">一天开始时间</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    夜猫子可以调整新一天的开始时间
                  </div>
                </div>
                {savingField === 'dayStartOffset' && (
                  <Loader2 size={18} className="animate-spin text-slate-400 dark:text-slate-500" />
                )}
              </div>

              {/* Offset Control */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => handleDayStartOffsetChange((settings?.dayStartOffsetHours || 0) - 1)}
                    disabled={saving || (settings?.dayStartOffsetHours || 0) <= -12}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {formatOffset(settings?.dayStartOffsetHours || 0)}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      偏移: {settings?.dayStartOffsetHours || 0} 小时
                    </div>
                  </div>
                  <button
                    onClick={() => handleDayStartOffsetChange((settings?.dayStartOffsetHours || 0) + 1)}
                    disabled={saving || (settings?.dayStartOffsetHours || 0) >= 12}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Visual Timeline */}
                <div className="relative h-8 bg-gradient-to-r from-indigo-900 via-blue-500 to-amber-400 rounded-full overflow-hidden">
                  {/* Current marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-white dark:bg-slate-800 rounded-full shadow-md transition-all"
                    style={{
                      left: `${((settings?.dayStartOffsetHours || 0) + 12) / 24 * 100}%`,
                    }}
                  />
                  {/* Labels */}
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] text-white/70 font-medium">
                    <span>-12h</span>
                    <span className="flex items-center gap-1"><Moon size={10} /> 0h</span>
                    <span className="flex items-center gap-1"><Sun size={10} /> +12h</span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 px-1">
                {settings?.dayStartOffsetHours === 0 ? (
                  '新的一天从午夜 00:00 开始（默认）'
                ) : (settings?.dayStartOffsetHours || 0) < 0 ? (
                  `新的一天从凌晨 ${String(24 + (settings?.dayStartOffsetHours || 0)).padStart(2, '0')}:00 开始。
                  例如：如果今天是周一，在凌晨 ${String(24 + (settings?.dayStartOffsetHours || 0)).padStart(2, '0')}:00 之前，系统仍然认为是周日。`
                ) : (
                  `新的一天从前一天的 ${String(24 - (settings?.dayStartOffsetHours || 0)).padStart(2, '0')}:00 开始。
                  例如：周一的任务会在周日 ${String(24 - (settings?.dayStartOffsetHours || 0)).padStart(2, '0')}:00 就可以执行。`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* 账号与设备 Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Smartphone size={18} className="text-blue-500 dark:text-blue-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">账号与设备</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* 课程暂停 */}
            <div className="p-4 border-b border-slate-50 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPaused ? 'bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-400' : canUnpause ? 'bg-green-50 dark:bg-green-950 text-green-500 dark:text-green-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                  {isPaused ? <Pause size={20} /> : canUnpause ? <Play size={20} /> : <Pause size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">课程暂停</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {isPaused
                      ? `暂停中，${new Date(coursesPausedUntil!).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 后可恢复`
                      : canUnpause
                        ? '暂停期已满，可以恢复课程'
                        : '暂停所有课程任务（至少 21 天）'}
                  </div>
                </div>
                {isPaused ? (
                  <div className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-400 dark:text-amber-300">
                    暂停中
                  </div>
                ) : canUnpause ? (
                  <button
                    onClick={() => setConfirmDialog({ type: 'unpause' })}
                    disabled={pausingCourses}
                    className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 transition-colors disabled:opacity-50"
                  >
                    {pausingCourses ? <Loader2 size={14} className="animate-spin" /> : '恢复课程'}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDialog({ type: 'pause' })}
                    disabled={pausingCourses}
                    className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50"
                  >
                    {pausingCourses ? <Loader2 size={14} className="animate-spin" /> : '暂停课程'}
                  </button>
                )}
              </div>
            </div>

            {/* 异次元账户 */}
            <div className={`p-4 ${yiciyuanDevices.length > 0 ? 'border-b border-slate-50 dark:border-slate-700' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Fingerprint size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">异次元账户</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {yiciyuanAccount?.hasAccount
                      ? `已登录: ${yiciyuanAccount.phone}`
                      : '未登录异次元账户'}
                  </div>
                </div>
                {yiciyuanAccount?.hasAccount && (
                  <button
                    onClick={() => setConfirmDialog({ type: 'logoutYiciyuan' })}
                    className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                  >
                    退出登录
                  </button>
                )}
              </div>
            </div>

            {/* 绑定设备列表 */}
            {yiciyuanDevices.length > 0 && (
              <div className="p-4">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">绑定设备</div>
                <div className="space-y-2">
                  {yiciyuanDevices.map(device => (
                    <div key={device.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                        <Box size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 dark:text-slate-200 truncate">{device.deviceName}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{device.mac}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (device.hasActiveLock || device.lockId) {
                            toast.error('当前有活跃锁正在使用此设备，解绑后将无法通过蓝牙解锁！请先完成解锁流程再解绑。');
                            return;
                          }
                          setConfirmDialog({ type: 'unbindDevice', deviceId: device.id });
                        }}
                        className="shrink-0 p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="解绑设备"
                      >
                        <Unlink size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Dialog */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDialog(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
              {confirmDialog.type === 'pause' && (
                <>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">确定暂停课程？</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    暂停期间将不会生成新任务，当前未完成的任务将被自动取消。最少暂停 21 天。
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">取消</button>
                    <button onClick={handlePauseCourses} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors">确定暂停</button>
                  </div>
                </>
              )}
              {confirmDialog.type === 'unpause' && (
                <>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">确定恢复课程？</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    暂停期已满，恢复后任务将在次日开始生成。
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">取消</button>
                    <button onClick={handleUnpauseCourses} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors">确定恢复</button>
                  </div>
                </>
              )}
              {confirmDialog.type === 'logoutYiciyuan' && (
                <>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">确定退出异次元账户？</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    退出后将无法使用异次元锁盒相关功能，所有设备绑定也将被解除。
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">取消</button>
                    <button onClick={handleLogoutYiciyuan} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">确定退出</button>
                  </div>
                </>
              )}
              {confirmDialog.type === 'unbindDevice' && confirmDialog.deviceId && (
                <>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">确定解绑设备？</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    解绑后该设备的蓝牙凭据将被清除，若有锁正在使用此设备将<span className="font-semibold text-red-500">无法通过蓝牙解锁</span>。请确认当前没有活跃锁在使用此设备。
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">取消</button>
                    <button onClick={() => handleUnbindDevice(confirmDialog.deviceId!)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">确定解绑</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notification Settings Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Bell size={18} className="text-amber-500 dark:text-amber-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">通知设置</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {/* Push Notifications */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={onNavigateToNotificationSettings}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 flex items-center justify-center">
                  <Bell size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-100">推送通知</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    设置 Telegram 推送和通知偏好
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-4 border border-blue-100 dark:border-blue-900">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <Shield size={18} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-1">隐私提示</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                你的隐私设置会即时生效。关闭"允许通过Telegram联系"后，其他用户将无法看到你的Telegram用户名，你的学生卡也不会显示二维码。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
