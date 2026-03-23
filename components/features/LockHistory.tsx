import React, { useState, useEffect, useCallback } from 'react';
import {
  History, Clock, Calendar, Trophy, AlertCircle, ChevronRight,
  Lock, Unlock, Timer, Image as ImageIcon, ArrowLeft
} from 'lucide-react';
import { SelfLockSummary, SelfLockDetail, LockStatus } from '../../types';
import { selfLockApi } from '../../lib/api';
import { LockCompletedModal } from '../ui';

interface LockHistoryProps {
  onBack: () => void;
}

const LockHistory: React.FC<LockHistoryProps> = ({ onBack }) => {
  const [locks, setLocks] = useState<SelfLockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLockDetail, setSelectedLockDetail] = useState<SelfLockDetail | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Get all locks (not just active)
      const allLocks = await selfLockApi.getMyLocks(false);
      // Filter to show only completed locks (UNLOCKED, EXPIRED, CANCELLED)
      const completedLocks = allLocks.filter(
        lock => lock.status === 'UNLOCKED' || lock.status === 'EXPIRED' || lock.status === 'CANCELLED'
      );
      // Sort by createdAt descending (most recent first)
      completedLocks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLocks(completedLocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleViewDetail = async (lockId: number) => {
    try {
      const detail = await selfLockApi.getLockDetail(lockId);
      setSelectedLockDetail(detail);
      setShowCompletedModal(true);
    } catch (err) {
      console.error('Failed to load lock detail:', err);
    }
  };

  const formatDuration = (minutes: number): string => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    if (days > 0) {
      return `${days}天${hours > 0 ? ` ${hours}小时` : ''}`;
    } else if (hours > 0) {
      return `${hours}小时${mins > 0 ? ` ${mins}分` : ''}`;
    }
    return `${mins}分钟`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (status: LockStatus) => {
    switch (status) {
      case 'UNLOCKED':
        return {
          label: '已解锁',
          icon: Unlock,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        };
      case 'EXPIRED':
        return {
          label: '已过期',
          icon: Timer,
          color: 'text-amber-400 dark:text-amber-300',
          bgColor: 'bg-amber-500/20'
        };
      case 'CANCELLED':
        return {
          label: '已取消',
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20'
        };
      default:
        return {
          label: status,
          icon: Lock,
          color: 'text-slate-400 dark:text-slate-500',
          bgColor: 'bg-slate-500/20'
        };
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/10 dark:bg-slate-800/10 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/20 dark:bg-slate-800/20 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              锁定历史
            </h1>
            <p className="text-sm text-white/50">查看已完成的锁定记录</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
            <p className="text-white/60">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-4 px-4 py-2 bg-white/10 dark:bg-slate-800/10 rounded-xl text-white text-sm"
            >
              重试
            </button>
          </div>
        ) : locks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-white/5 dark:bg-slate-800/5 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60 mb-2">暂无历史记录</p>
            <p className="text-white/40 text-sm">完成锁定后将在这里显示</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locks.map((lock) => {
              const statusInfo = getStatusInfo(lock.status);
              const StatusIcon = statusInfo.icon;

              return (
                <button
                  key={lock.id}
                  onClick={() => handleViewDetail(lock.id)}
                  className="w-full bg-white/5 dark:bg-slate-800/5 hover:bg-white/10 dark:bg-slate-800/10 rounded-2xl p-4 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 ${statusInfo.bgColor} rounded-xl flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {lock.hasImage && (
                          <div className="flex items-center gap-1 text-white/40">
                            <ImageIcon size={12} />
                            <span className="text-[10px]">有图片</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                        <Calendar size={14} />
                        <span>{formatDate(lock.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-white/50 text-xs">
                          <Clock size={12} />
                          <span>
                            {lock.remainingMinutes !== null
                              ? formatDuration(lock.remainingMinutes)
                              : '时间隐藏'}
                          </span>
                        </div>
                        {lock.likesReceived > 0 && (
                          <div className="flex items-center gap-1 text-pink-400/70 text-xs">
                            <Trophy size={12} />
                            <span>{lock.likesReceived}赞</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Modal */}
      {selectedLockDetail && (
        <LockCompletedModal
          isOpen={showCompletedModal}
          onClose={() => {
            setShowCompletedModal(false);
            setSelectedLockDetail(null);
          }}
          lockDetail={selectedLockDetail}
        />
      )}
    </div>
  );
};

export default LockHistory;
