import React, { useState } from 'react';
import { ChevronRight, ChevronUp, Clock, Loader2, User, Settings } from 'lucide-react';
import { useTimeHistory } from '../../hooks/useTimeHistory';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import type { TimeChangeHistoryEntry } from '../../types';

interface TimeChangeHistoryProps {
  lockId: number;
  hideRemainingTime?: boolean;
  isOwnerView?: boolean;
  onViewProfile?: (userId: number) => void;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

const formatDurationMinutes = (minutes: number): string => {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}分钟`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (abs < 1440) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  const d = Math.floor(abs / 1440);
  const remainH = Math.floor((abs % 1440) / 60);
  return remainH > 0 ? `${d}天${remainH}小时` : `${d}天`;
};

const ActorAvatar: React.FC<{ entry: TimeChangeHistoryEntry; onViewProfile?: (userId: number) => void }> = ({ entry, onViewProfile }) => {
  const canClick = entry.actorId != null && entry.actorType !== 'SYSTEM' && onViewProfile;
  const handleClick = () => {
    if (canClick) onViewProfile(entry.actorId!);
  };

  if (entry.actorAvatar) {
    return (
      <img
        src={entry.actorAvatar}
        alt={entry.actorName || ''}
        className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${canClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={handleClick}
      />
    );
  }
  if (entry.actorType === 'SYSTEM') {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
        <Settings size={14} className="text-slate-400 dark:text-slate-500" />
      </div>
    );
  }
  return (
    <div
      className={`w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-950 flex items-center justify-center flex-shrink-0 ${canClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={handleClick}
    >
      <User size={14} className="text-orange-400" />
    </div>
  );
};

const EntryRow: React.FC<{ entry: TimeChangeHistoryEntry; hideRemainingTime?: boolean; isOwnerView?: boolean; onViewProfile?: (userId: number) => void }> = ({
  entry,
  hideRemainingTime,
  isOwnerView,
  onViewProfile,
}) => {
  const actorName = entry.actorName || (entry.actorType === 'SYSTEM' ? '系统' : '未知用户');
  const isHidden = hideRemainingTime && entry.timeChange === 0;
  const isAdd = entry.timeChange > 0;
  const canClick = entry.actorId != null && entry.actorType !== 'SYSTEM' && onViewProfile;

  let actionText: string;
  if (isHidden) {
    actionText = '改变了锁的时间';
  } else if (isAdd) {
    actionText = isOwnerView
      ? `为你增加了 ${formatDurationMinutes(entry.timeChange)}`
      : `增加了 ${formatDurationMinutes(entry.timeChange)}`;
  } else {
    actionText = isOwnerView
      ? `为你减少了 ${formatDurationMinutes(entry.timeChange)}`
      : `减少了 ${formatDurationMinutes(entry.timeChange)}`;
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <ActorAvatar entry={entry} onViewProfile={onViewProfile} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">
          <span
            className={canClick ? 'font-medium cursor-pointer hover:text-rose-500 dark:text-rose-400 transition-colors' : ''}
            onClick={() => canClick && onViewProfile(entry.actorId!)}
          >
            {actorName}
          </span>
          {' '}{actionText}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatRelativeTime(entry.createdAt)}</p>
      </div>
      {isHidden ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex-shrink-0">?</span>
      ) : isAdd ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 flex-shrink-0">
          +{formatDurationMinutes(entry.timeChange)}
        </span>
      ) : (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex-shrink-0">
          -{formatDurationMinutes(entry.timeChange)}
        </span>
      )}
    </div>
  );
};

export const TimeChangeHistory: React.FC<TimeChangeHistoryProps> = ({
  lockId,
  hideRemainingTime,
  isOwnerView,
  onViewProfile,
}) => {
  const [expanded, setExpanded] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useTimeHistory(lockId, expanded);

  const sentinelRef = useIntersectionObserver(
    () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    { enabled: expanded && hasNextPage && !isFetchingNextPage }
  );

  const entries = data?.pages.flatMap((page) => page) ?? [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left"
      >
        <Clock size={18} className="text-orange-500 dark:text-orange-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">时间变化记录</span>
        {expanded ? (
          <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" />
        ) : (
          <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-300" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">暂无记录</p>
            ) : (
              <>
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    hideRemainingTime={hideRemainingTime}
                    isOwnerView={isOwnerView}
                    onViewProfile={onViewProfile}
                  />
                ))}
                {isFetchingNextPage && (
                  <div className="flex justify-center py-3">
                    <Loader2 size={16} className="animate-spin text-slate-300" />
                  </div>
                )}
                <div ref={sentinelRef} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
