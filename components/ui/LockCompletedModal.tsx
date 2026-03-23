import React from 'react';
import { X, Trophy, Clock, Calendar, Star, PartyPopper, AlertTriangle, Image } from 'lucide-react';
import { SelfLockDetail } from '../../types';

interface LockCompletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockDetail: SelfLockDetail;
}

export const LockCompletedModal: React.FC<LockCompletedModalProps> = ({
  isOpen,
  onClose,
  lockDetail
}) => {
  if (!isOpen) return null;

  const { lock, imageUrl, totalDurationMinutes } = lockDetail;

  // Determine if this is a cancelled/emergency unlock
  const isCancelled = lock.status === 'CANCELLED';
  const isSuccess = lock.status === 'UNLOCKED' || lock.status === 'EXPIRED';

  // Format duration
  const formatDuration = (minutes: number): string => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    if (days > 0) {
      return `${days}天 ${hours}小时 ${mins}分钟`;
    } else if (hours > 0) {
      return `${hours}小时 ${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status config
  const statusConfig = isCancelled
    ? {
        title: '锁定已终止',
        subtitle: '紧急解锁',
        icon: AlertTriangle,
        iconBg: 'bg-red-100',
        iconColor: 'text-red-500 dark:text-red-400',
        statusColor: 'text-red-500 dark:text-red-400',
        buttonBg: 'bg-slate-600 hover:bg-slate-700',
      }
    : {
        title: '锁定完成！',
        subtitle: lock.status === 'UNLOCKED' ? '成功解锁' : '已过期',
        icon: Trophy,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-500 dark:text-amber-400',
        statusColor: lock.status === 'UNLOCKED' ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400',
        buttonBg: 'bg-primary hover:bg-primary/90',
      };

  const IconComponent = statusConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="relative pt-8 pb-6 px-6 text-center">
          {/* Confetti effect for success */}
          {isSuccess && (
            <div className="absolute inset-x-0 top-0 flex justify-center gap-8 overflow-hidden">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          <div className={`inline-flex items-center justify-center w-16 h-16 ${statusConfig.iconBg} rounded-full mb-4`}>
            <IconComponent className={`w-8 h-8 ${statusConfig.iconColor}`} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            {isSuccess && <PartyPopper className="inline w-5 h-5 mr-2 text-amber-500 dark:text-amber-400" />}
            {statusConfig.title}
          </h2>
          <p className={`text-sm font-medium ${statusConfig.statusColor}`}>{statusConfig.subtitle}</p>
        </div>

        {/* Reward/Lock Image */}
        {imageUrl && (
          <div className="px-6 pb-4">
            <div className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700">
              <img
                src={imageUrl}
                alt={isCancelled ? "锁定图片" : "奖励图片"}
                className="w-full h-56 object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
                <span className="text-xs text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5">
                  {isCancelled ? (
                    <>
                      <Image className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      锁定图片
                    </>
                  ) : (
                    <>
                      <Star className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      解锁奖励
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="px-6 pb-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Clock size={16} />
                <span className="text-sm">{isCancelled ? '已锁定时长' : '锁定时长'}</span>
              </div>
              <span className="text-slate-800 dark:text-slate-100 font-medium">{formatDuration(totalDurationMinutes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Calendar size={16} />
                <span className="text-sm">开始时间</span>
              </div>
              <span className="text-slate-800 dark:text-slate-100 font-medium text-sm">{formatDate(lock.startedAt)}</span>
            </div>
            {lock.actualUnlockAt && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Calendar size={16} />
                  <span className="text-sm">{isCancelled ? '终止时间' : '解锁时间'}</span>
                </div>
                <span className="text-slate-800 dark:text-slate-100 font-medium text-sm">{formatDate(lock.actualUnlockAt)}</span>
              </div>
            )}
            {lock.penaltyCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="text-sm">惩罚次数</span>
                </div>
                <span className="text-red-500 dark:text-red-400 font-medium">{lock.penaltyCount}次 (+{lock.totalPenaltyMinutes}分钟)</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className={`w-full py-3.5 ${statusConfig.buttonBg} text-white rounded-2xl font-semibold shadow-lg transition-all active:scale-[0.98]`}
          >
            {isCancelled ? '关闭' : '完成'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockCompletedModal;
