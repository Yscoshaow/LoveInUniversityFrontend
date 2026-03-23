import React, { useState, useEffect, useCallback } from 'react';
import {
  SelfLockSummary, SelfLockDetail, SelfLockStats, LOCK_TYPE_NAMES,
  HygieneImageHistoryItem, VerificationPhotoData, VerificationStatusResponse
} from '../../types';
import { selfLockApi, verificationApi } from '../../lib/api';
import {
  ArrowLeft, Lock, Unlock, Timer, Clock, ChevronRight,
  Loader2, Filter, Calendar, Trophy, AlertCircle,
  Droplets, Snowflake, Users, Key, Image, Camera
} from 'lucide-react';

// Format duration
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}个月前`;
};

type FilterType = 'all' | 'active' | 'completed' | 'failed';

interface LockHistoryPageProps {
  onBack: () => void;
  onSelectLock?: (lock: SelfLockSummary) => void;
  refreshTrigger?: number;
}

export const LockHistoryPage: React.FC<LockHistoryPageProps> = ({
  onBack,
  onSelectLock,
  refreshTrigger = 0
}) => {
  const [locks, setLocks] = useState<SelfLockSummary[]>([]);
  const [stats, setStats] = useState<SelfLockStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedLock, setSelectedLock] = useState<SelfLockSummary | null>(null);

  // Fetch all locks and stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [locksData, statsData] = await Promise.all([
        selfLockApi.getMyLocks(false), // Get all locks, not just active
        selfLockApi.getMyStats()
      ]);
      setLocks(locksData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Filter locks
  const filteredLocks = locks.filter(lock => {
    switch (filter) {
      case 'active':
        // ACTIVE = normal locked, UNLOCKING = vote unlock in progress
        return lock.status === 'ACTIVE' || lock.status === 'UNLOCKING';
      case 'completed':
        // UNLOCKED = manually unlocked, EXPIRED = auto-expired (both are successful completions)
        return lock.status === 'UNLOCKED' || lock.status === 'EXPIRED';
      case 'failed':
        // CANCELLED = emergency unlocked (failed/aborted)
        return lock.status === 'CANCELLED';
      default:
        return true;
    }
  });

  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'bg-green-100 text-green-600 dark:text-green-400', icon: Lock, label: '进行中' };
      case 'UNLOCKED':
        return { color: 'bg-blue-100 text-blue-600 dark:text-blue-400', icon: Trophy, label: '已完成' };
      case 'EXPIRED':
        return { color: 'bg-blue-100 text-blue-600 dark:text-blue-400', icon: Trophy, label: '已过期' };
      case 'CANCELLED':
        return { color: 'bg-red-100 text-red-600 dark:text-red-400', icon: AlertCircle, label: '已取消' };
      default:
        return { color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', icon: Unlock, label: status };
    }
  };

  // Get lock type icon
  const getLockTypeIcon = (lock: SelfLockSummary) => {
    if (lock.isFrozen) return Snowflake;
    if (lock.isHygieneOpening) return Droplets;
    if (lock.lockType === 'SHARED') return Users;
    if (lock.lockType === 'PRIVATE') return Key;
    return Lock;
  };

  if (selectedLock) {
    return (
      <LockHistoryDetail
        lock={selectedLock}
        onBack={() => setSelectedLock(null)}
      />
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">锁定历史</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500">查看所有锁定记录</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-300">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-medium"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Stats Summary */}
          {stats && (
            <div className="p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">统计概览</h3>
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalLocks}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">总锁定</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500 dark:text-green-400">{stats.completedLocks}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">已完成</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">
                      {formatDuration(stats.totalLockedMinutes)}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">总时长</div>
                  </div>
                  {/* Desktop: inline these stats */}
                  <div className="hidden lg:flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                      <Timer size={16} className="text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatDuration(stats.longestLockMinutes)}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">最长锁定</div>
                    </div>
                  </div>
                  <div className="hidden lg:flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                      <Clock size={16} className="text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatDuration(stats.averageLockMinutes)}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">平均时长</div>
                    </div>
                  </div>
                </div>

                {/* Additional Stats Row - mobile only */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 lg:hidden">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                      <Timer size={16} className="text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatDuration(stats.longestLockMinutes)}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">最长锁定</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                      <Clock size={16} className="text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatDuration(stats.averageLockMinutes)}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">平均时长</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="px-4 mb-2">
            <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 lg:max-w-md">
              {[
                { key: 'all', label: '全部' },
                { key: 'active', label: '进行中' },
                { key: 'completed', label: '已完成' },
                { key: 'failed', label: '紧急解锁' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as FilterType)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    filter === key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lock List */}
          <div className="px-4 pb-6">
            {filteredLocks.length === 0 ? (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">暂无锁定记录</p>
              </div>
            ) : (
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                {filteredLocks.map(lock => {
                  const statusInfo = getStatusInfo(lock.status);
                  const LockIcon = getLockTypeIcon(lock);

                  return (
                    <div
                      key={lock.id}
                      onClick={() => {
                        if (onSelectLock) {
                          onSelectLock(lock);
                        } else {
                          setSelectedLock(lock);
                        }
                      }}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        {/* Lock Type Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          lock.status === 'ACTIVE' ? 'bg-linear-to-br from-rose-500 to-pink-500' :
                          (lock.status === 'UNLOCKED' || lock.status === 'EXPIRED') ? 'bg-linear-to-br from-blue-500 to-cyan-500' :
                          'bg-linear-to-br from-slate-400 to-slate-500'
                        }`}>
                          <LockIcon size={24} className="text-white" />
                        </div>

                        {/* Lock Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {LOCK_TYPE_NAMES[lock.lockType]}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {formatRelativeTime(lock.createdAt)}
                            </span>
                            {lock.hygieneImageRequired && (
                              <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                                <Camera size={12} />
                                有图片
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={20} className="text-slate-300" />
                      </div>

                      {/* Tags */}
                      {(lock.isFrozen || lock.isHygieneOpening || lock.hygieneOpeningEnabled) && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700">
                          {lock.isFrozen && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-full flex items-center gap-1">
                              <Snowflake size={10} />
                              冻结中
                            </span>
                          )}
                          {lock.isHygieneOpening && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-full flex items-center gap-1">
                              <Droplets size={10} />
                              卫生开启
                            </span>
                          )}
                          {lock.hygieneOpeningEnabled && !lock.isHygieneOpening && (
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                              支持卫生开启
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Lock History Detail Component
interface LockHistoryDetailProps {
  lock: SelfLockSummary;
  onBack: () => void;
}

const LockHistoryDetail: React.FC<LockHistoryDetailProps> = ({ lock, onBack }) => {
  const [lockDetail, setLockDetail] = useState<SelfLockDetail | null>(null);
  const [imageHistory, setImageHistory] = useState<HygieneImageHistoryItem[]>([]);
  const [verificationPhotos, setVerificationPhotos] = useState<VerificationPhotoData[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const [detail, history, vStatus] = await Promise.all([
          selfLockApi.getLockDetail(lock.id),
          // Always try to fetch hygiene image history for locks with hygiene opening enabled
          // or when hygieneImageRequired is set
          (lock.hygieneOpeningEnabled || lock.hygieneImageRequired)
            ? selfLockApi.getHygieneImageHistory(lock.id).catch(() => [])
            : Promise.resolve([]),
          // Fetch verification status
          verificationApi.getStatus(lock.id).catch(() => null)
        ]);
        setLockDetail(detail);
        setImageHistory(history);
        setVerificationStatus(vStatus);

        // Fetch verification photos if enabled
        if (vStatus?.enabled) {
          const photos = await verificationApi.getPhotos(lock.id).catch(() => []);
          setVerificationPhotos(photos);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [lock.id, lock.hygieneOpeningEnabled, lock.hygieneImageRequired]);

  const statusInfo = (() => {
    switch (lock.status) {
      case 'ACTIVE':
        return { color: 'from-green-500 to-emerald-500', label: '进行中' };
      case 'UNLOCKED':
        return { color: 'from-blue-500 to-cyan-500', label: '已完成' };
      case 'EXPIRED':
        return { color: 'from-blue-500 to-cyan-500', label: '已过期' };
      case 'CANCELLED':
        return { color: 'from-red-500 to-orange-500', label: '已取消' };
      default:
        return { color: 'from-slate-500 to-slate-600', label: lock.status };
    }
  })();

  return (
    <div className="h-full bg-white dark:bg-slate-800 flex flex-col lg:bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col h-full lg:max-w-3xl lg:mx-auto lg:w-full lg:bg-white dark:bg-slate-800 lg:shadow-sm lg:my-4 lg:rounded-2xl lg:overflow-hidden lg:h-auto lg:max-h-[calc(100%-2rem)]">
      {/* Header */}
      <div className={`h-48 relative bg-linear-to-br ${statusInfo.color} shrink-0 lg:rounded-t-2xl overflow-hidden`}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/20 dark:bg-slate-800/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-white/10 dark:bg-slate-800/10 blur-3xl" />
        </div>

        {/* Back Button */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-8 z-20">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-white/10 dark:bg-slate-800/10 backdrop-blur-sm flex items-center justify-center">
            {(lock.status === 'UNLOCKED' || lock.status === 'EXPIRED') ? (
              <Trophy size={40} className="text-white/80" />
            ) : lock.status === 'CANCELLED' ? (
              <AlertCircle size={40} className="text-white/80" />
            ) : (
              <Lock size={40} className="text-white/80" />
            )}
          </div>
        </div>

        {/* Status Label */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/40 to-transparent pointer-events-none">
          <div className="text-center">
            <span className="text-white/80 text-sm">{LOCK_TYPE_NAMES[lock.lockType]}</span>
            <h1 className="text-xl font-bold text-white">{statusInfo.label}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar -mt-4 bg-white dark:bg-slate-800 rounded-t-[32px] relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-300">{error}</p>
          </div>
        ) : lockDetail && (
          <div className="p-6 space-y-6">
            {/* Time Info */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">时间信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">开始时间</span>
                  <span className="text-slate-800 dark:text-slate-100 text-sm font-medium">
                    {formatDate(lockDetail.lock.startedAt)}
                  </span>
                </div>
                {/* 隐藏时间模式下，只有正式解锁后才显示计划时长 */}
                {(!lockDetail.lock.hideRemainingTime ||
                  lockDetail.lock.status === 'UNLOCKED' ||
                  lockDetail.lock.status === 'EXPIRED' ||
                  lockDetail.lock.status === 'CANCELLED') && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">计划时长</span>
                    <span className="text-slate-800 dark:text-slate-100 text-sm font-medium">
                      {formatDuration(lockDetail.lock.actualDurationMinutes)}
                    </span>
                  </div>
                )}
                {lockDetail.lock.actualUnlockAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">实际解锁</span>
                    <span className="text-slate-800 dark:text-slate-100 text-sm font-medium">
                      {formatDate(lockDetail.lock.actualUnlockAt)}
                    </span>
                  </div>
                )}
                {lockDetail.lock.actualUnlockAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">实际锁时</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      {formatDuration(Math.round((new Date(lockDetail.lock.actualUnlockAt).getTime() - new Date(lockDetail.lock.startedAt).getTime()) / 60000))}
                    </span>
                  </div>
                )}
                {/* 隐藏时间模式下，只有正式解锁后才显示时间增减 */}
                {(!lockDetail.lock.hideRemainingTime ||
                  lockDetail.lock.status === 'UNLOCKED' ||
                  lockDetail.lock.status === 'EXPIRED' ||
                  lockDetail.lock.status === 'CANCELLED') && lockDetail.lock.addedDurationMinutes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">增加时间</span>
                    <span className="text-red-500 dark:text-red-400 text-sm font-medium">
                      +{formatDuration(lockDetail.lock.addedDurationMinutes)}
                    </span>
                  </div>
                )}
                {(!lockDetail.lock.hideRemainingTime ||
                  lockDetail.lock.status === 'UNLOCKED' ||
                  lockDetail.lock.status === 'EXPIRED' ||
                  lockDetail.lock.status === 'CANCELLED') && lockDetail.lock.removedDurationMinutes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">减少时间</span>
                    <span className="text-green-500 dark:text-green-400 text-sm font-medium">
                      -{formatDuration(lockDetail.lock.removedDurationMinutes)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lock Settings */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">锁定设置</h3>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {LOCK_TYPE_NAMES[lockDetail.lock.lockType]}
                </span>
                {lockDetail.lock.hideRemainingTime && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-1.5 rounded-full">
                    隐藏时间
                  </span>
                )}
                {lockDetail.lock.hygieneOpeningEnabled && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-full">
                    卫生开启
                  </span>
                )}
                {lockDetail.lock.hygieneImageRequired && (
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-3 py-1.5 rounded-full">
                    需要图片
                  </span>
                )}
                {lockDetail.lock.allowKeyholderFreeze && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-full">
                    允许冻结
                  </span>
                )}
              </div>
            </div>

            {/* Main Lock Image - Only visible after unlock */}
            {lockDetail.imageUrl && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Image size={16} />
                  锁定图片
                </h3>
                <div className="relative rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 aspect-video">
                  <img
                    src={lockDetail.imageUrl}
                    alt="Lock image"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                  此图片仅在解锁后可见
                </p>
              </div>
            )}

            {/* Hygiene Image History */}
            {imageHistory.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Image size={16} />
                  卫生开启图片历史 ({imageHistory.length})
                </h3>
                <div className="space-y-3">
                  {imageHistory.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          item.imageType === 'INITIAL'
                            ? 'bg-blue-100 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-100 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <Camera size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {item.imageType === 'INITIAL' ? '初始图片' : '重新上锁图片'}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            第 {item.sessionNumber} 次 · {formatDate(item.createdAt)}
                          </div>
                        </div>
                      </div>
                      {item.imageUrl && (() => {
                        const isLockCompleted = lock.status === 'UNLOCKED' || lock.status === 'EXPIRED' || lock.status === 'CANCELLED';
                        const isCurrentPassword = index === 0 && !lock.isHygieneOpening && !isLockCompleted;
                        return (
                          <div className="relative rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 aspect-video">
                            <img
                              src={item.imageUrl}
                              alt={`Image ${index + 1}`}
                              className={`w-full h-full object-cover ${isCurrentPassword ? 'blur-md' : ''}`}
                            />
                            {isCurrentPassword && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
                                  当前密码
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Photos */}
            {verificationStatus?.enabled && verificationPhotos.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Camera size={16} />
                  验证照片 ({verificationPhotos.length})
                  {verificationStatus.missedCount > 0 && (
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                      错过 {verificationStatus.missedCount} 次
                    </span>
                  )}
                </h3>
                <div className="space-y-4">
                  {/* Group photos by date */}
                  {(() => {
                    const grouped: Record<string, VerificationPhotoData[]> = {};
                    verificationPhotos.forEach(photo => {
                      const dateKey = new Date(photo.uploadedAt).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                      if (!grouped[dateKey]) grouped[dateKey] = [];
                      grouped[dateKey].push(photo);
                    });

                    return Object.entries(grouped).map(([dateLabel, photos]) => (
                      <div key={dateLabel}>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={12} className="text-slate-400 dark:text-slate-500" />
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dateLabel}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">({photos.length} 张)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {photos.map((photo) => {
                            const scheduledTime = photo.scheduledTime; // already "HH:mm" format
                            const uploadedTime = new Date(photo.uploadedAt).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            });

                            return (
                              <div
                                key={photo.id}
                                className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700"
                              >
                                <div className="relative aspect-square bg-slate-200 dark:bg-slate-700">
                                  {photo.imageUrl ? (
                                    <img
                                      src={photo.imageUrl}
                                      alt={`验证照片 ${scheduledTime}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Camera size={24} className="text-slate-300" />
                                    </div>
                                  )}
                                  {/* Shared indicator */}
                                  {photo.isShared && (
                                    <div className="absolute top-1 right-1">
                                      <span className="text-[8px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full">
                                        公开
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-1.5">
                                  <div className="flex items-center gap-1 justify-center">
                                    <Clock size={10} className="text-slate-400 dark:text-slate-500" />
                                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{scheduledTime}</span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500 text-center">
                                    提交于 {uploadedTime}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Today's Windows Status Summary */}
                {verificationStatus.todayWindows.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={12} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">今日验证窗口</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {verificationStatus.todayWindows.map((window) => {
                        const time = window.scheduledTime; // already "HH:mm" format
                        const statusColor =
                          window.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400'
                            : window.status === 'MISSED'
                              ? 'bg-red-100 text-red-600 dark:text-red-400'
                              : 'bg-amber-100 text-amber-600 dark:text-amber-400';
                        const statusLabel =
                          window.status === 'COMPLETED'
                            ? '已完成'
                            : window.status === 'MISSED'
                              ? '已错过'
                              : '待验证';

                        return (
                          <span
                            key={window.id}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusColor}`}
                          >
                            {time} {statusLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification Photos - empty state when enabled but no photos */}
            {verificationStatus?.enabled && verificationPhotos.length === 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Camera size={16} />
                  验证照片
                </h3>
                <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                  <Camera size={32} className="mb-2" />
                  <span className="text-sm">暂无验证照片</span>
                </div>
              </div>
            )}

            {/* Stats */}
            {lockDetail.lock.isPublic && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">互动统计</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                    <div className="text-lg font-bold text-rose-500 dark:text-rose-400">{lockDetail.lock.likesReceived}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">收到点赞</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                    <div className="text-lg font-bold text-blue-500 dark:text-blue-400">{lockDetail.lock.currentVotes}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">投票数</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default LockHistoryPage;
