import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Key, Lock, Users, Snowflake, Droplets, EyeOff, Heart, Bluetooth, ImageIcon } from 'lucide-react';
import { SelfLock, SelfLockSummary, LOCK_TYPE_NAMES } from '../../types';

// Support both legacy SelfLock and new SelfLockSummary
interface SelfLockCardProps {
  lock: SelfLock | SelfLockSummary;
  onClick?: (lock: SelfLock | SelfLockSummary) => void;
}

// Type guard to check if it's the backend type
const isBackendLock = (lock: SelfLock | SelfLockSummary): lock is SelfLockSummary => {
  return typeof lock.id === 'number' && 'difficulty' in lock;
};

const DOUBLE_CLICK_DELAY = 300;

export const SelfLockCard: React.FC<SelfLockCardProps> = ({ lock, onClick }) => {
  const isActive = isBackendLock(lock)
    ? lock.status === 'ACTIVE'
    : lock.status === 'active';

  // Use seconds precision if available, fallback to minutes * 60
  const initialRemainingSeconds = isBackendLock(lock)
    ? (lock.remainingSeconds ?? (lock.remainingMinutes !== null ? lock.remainingMinutes * 60 : null))
    : (lock.durationMinutes !== undefined ? lock.durationMinutes * 60 : null);

  const hideTime = isBackendLock(lock) ? lock.hideRemainingTime : false;
  const isFrozen = isBackendLock(lock) ? lock.isFrozen : false;
  const isHygieneOpening = isBackendLock(lock) ? lock.isHygieneOpening : false;
  const lockType = isBackendLock(lock) ? lock.lockType : 'SELF';
  const hasKeyholder = isBackendLock(lock) ? !!lock.primaryKeyholderId : false;
  const isBlePending = isBackendLock(lock)
    && (lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN')
    && !lock.lockBoxUnlocked
    && (lock.status === 'UNLOCKED' || lock.status === 'EXPIRED' || lock.status === 'CANCELLED');

  const coverImageUrl = isBackendLock(lock) ? lock.coverImageUrl : null;

  // Flip state & double-click detection
  const [isFlipped, setIsFlipped] = useState(false);
  const lastClickRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < DOUBLE_CLICK_DELAY) {
      // Double-click detected → flip (only if cover exists)
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (coverImageUrl) setIsFlipped(prev => !prev);
      lastClickRef.current = 0; // reset to avoid triple-click triggering again
    } else {
      // First click → delay navigation to distinguish from double-click
      lastClickRef.current = now;
      clickTimerRef.current = setTimeout(() => {
        if (!isFlipped) {
          onClick?.(lock);
        } else {
          // When flipped, single click flips back instead of navigating
          setIsFlipped(false);
        }
      }, DOUBLE_CLICK_DELAY);
    }
  }, [coverImageUrl, isFlipped, lock, onClick]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // Real-time countdown state (in seconds)
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (initialRemainingSeconds === null || initialRemainingSeconds === undefined) return 0;
    return initialRemainingSeconds;
  });

  // Update countdown every second
  useEffect(() => {
    if (!isActive || hideTime || isFrozen || isHygieneOpening) return;
    if (remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, hideTime, isFrozen, isHygieneOpening, remainingSeconds]);

  // Sync with prop changes (using seconds precision)
  useEffect(() => {
    if (initialRemainingSeconds !== null && initialRemainingSeconds !== undefined) {
      setRemainingSeconds(initialRemainingSeconds);
    }
  }, [initialRemainingSeconds]);

  // Determine lock type icon
  const getLockIcon = () => {
    if (isBlePending) return <Bluetooth size={22} className="text-cyan-200" />;
    if (isFrozen) return <Snowflake size={22} className="text-blue-300" />;
    if (isHygieneOpening) return <Droplets size={22} className="text-emerald-300" />;

    if (isBackendLock(lock)) {
      switch (lock.lockType) {
        case 'SHARED':
          return <Users size={22} />;
        case 'PRIVATE':
          return <Key size={22} />;
        default:
          return <Lock size={22} />;
      }
    }
    return lock.type === 'timer' ? <Timer size={22} /> : <Key size={22} />;
  };

  // Format remaining time with seconds
  const formatRemainingTime = useCallback(() => {
    if (hideTime) return '???';
    if (remainingSeconds <= 0) return '00:00';

    const totalSeconds = remainingSeconds;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format based on duration
    if (days > 0) {
      return `${days}天 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, [hideTime, remainingSeconds]);

  // Get status text and color
  const getStatusInfo = () => {
    if (isBlePending) return { text: '待解锁锁盒', color: 'text-cyan-300' };
    if (isFrozen) return { text: '已冻结', color: 'text-blue-400' };
    if (isHygieneOpening) return { text: '卫生开启中', color: 'text-emerald-400' };

    if (isBackendLock(lock)) {
      switch (lock.status) {
        case 'ACTIVE': return { text: '锁定中', color: 'text-white' };
        case 'UNLOCKING': return { text: '解锁中...', color: 'text-amber-300' };
        case 'UNLOCKED': return { text: '已解锁', color: 'text-green-400' };
        case 'EXPIRED': return { text: '已过期', color: 'text-slate-400 dark:text-slate-500' };
        case 'CANCELLED': return { text: '已取消', color: 'text-red-400' };
        default: return { text: '未知', color: 'text-slate-400 dark:text-slate-500' };
      }
    }
    return lock.status === 'active'
      ? { text: '锁定中', color: 'text-white' }
      : { text: lock.status, color: 'text-slate-400 dark:text-slate-500' };
  };

  // Get card theme based on state
  const getCardTheme = () => {
    if (isBlePending) return {
      bg: 'from-blue-600 via-blue-500 to-cyan-500',
      accent: 'bg-cyan-400/30',
      glow: 'shadow-cyan-500/30'
    };
    if (isFrozen) return {
      bg: 'from-blue-600 via-blue-500 to-cyan-500',
      accent: 'bg-blue-400/30',
      glow: 'shadow-blue-500/30'
    };
    if (isHygieneOpening) return {
      bg: 'from-emerald-600 via-emerald-500 to-teal-500',
      accent: 'bg-emerald-400/30',
      glow: 'shadow-emerald-500/30'
    };
    if (lockType === 'SHARED') return {
      bg: 'from-violet-600 via-purple-500 to-fuchsia-500',
      accent: 'bg-purple-400/30',
      glow: 'shadow-purple-500/30'
    };
    if (lockType === 'PRIVATE') return {
      bg: 'from-orange-600 via-amber-500 to-yellow-500',
      accent: 'bg-amber-400/30',
      glow: 'shadow-amber-500/30'
    };
    return {
      bg: 'from-rose-600 via-pink-500 to-rose-400',
      accent: 'bg-rose-400/30',
      glow: 'shadow-rose-500/30'
    };
  };

  const theme = getCardTheme();
  const statusInfo = getStatusInfo();

  return (
    <div className={`w-full h-[200px] [perspective:1000px] cursor-pointer`}>
      <div
        className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]
          ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
        onClick={handleClick}
      >
        {/* ===== FRONT FACE ===== */}
        <div
          className={`absolute inset-0 [backface-visibility:hidden] rounded-3xl overflow-hidden
            active:scale-[0.97] transition-all duration-300 ease-out
            shadow-lg ${theme.glow} hover:shadow-xl group`}
        >
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <div className={`w-full h-full bg-gradient-to-br ${theme.bg}`}></div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-slate-800/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full p-5 flex flex-col justify-between">
            {/* Top Row */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {/* Icon with glass effect */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white
                  ${theme.accent} backdrop-blur-md border border-white/20
                  group-hover:scale-110 transition-transform duration-300`}>
                  {getLockIcon()}
                </div>
                <div>
                  {/* Lock Type Badge */}
                  <span className="text-[11px] font-bold text-white/90 bg-white/20 dark:bg-slate-800/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    {LOCK_TYPE_NAMES[lockType]}
                  </span>
                </div>
              </div>

              {/* Time Badge / BLE Pending Badge */}
              {isBlePending ? (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  <Bluetooth size={14} className="text-cyan-300" />
                  <span className="text-sm font-bold text-white">待解锁</span>
                </div>
              ) : isActive ? (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  {hideTime ? (
                    <EyeOff size={14} className="text-white/80" />
                  ) : (
                    <Timer size={14} className="text-white/80" />
                  )}
                  <span className="text-sm font-bold text-white font-mono tabular-nums">
                    {formatRemainingTime()}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Bottom Row */}
            <div>
              {/* Status Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {isFrozen && (
                  <span className="text-[11px] font-semibold text-white bg-blue-500/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 border border-blue-400/30">
                    <Snowflake size={12} />
                    计时暂停
                  </span>
                )}
                {isHygieneOpening && (
                  <span className="text-[11px] font-semibold text-white bg-emerald-500/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-400/30">
                    <Droplets size={12} />
                    临时解锁
                  </span>
                )}
                {hasKeyholder && (
                  <span className="text-[11px] font-semibold text-white bg-amber-500/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-400/30">
                    <Key size={12} />
                    有管理员
                  </span>
                )}
                {isBlePending && (
                  <span className="text-[11px] font-semibold text-white bg-cyan-500/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 border border-cyan-400/30">
                    <Bluetooth size={12} />
                    请蓝牙解锁
                  </span>
                )}
              </div>

              {/* Status and Likes */}
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${statusInfo.color}`}>
                  {isActive ? (
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                  ) : (
                    <Lock size={14} />
                  )}
                  <span className="text-sm font-semibold">{statusInfo.text}</span>
                </div>

                {isBackendLock(lock) && lock.likesReceived > 0 && (
                  <div className="flex items-center gap-1.5 text-white/90 bg-white/15 dark:bg-slate-800/15 backdrop-blur-sm px-3 py-1 rounded-full">
                    <Heart size={12} className="fill-current text-rose-300" />
                    <span className="text-xs font-bold">{lock.likesReceived}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cover image indicator (front face, bottom-right) */}
          {coverImageUrl && (
            <div className="absolute bottom-3 right-3 z-20 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm p-1.5 rounded-full">
              <ImageIcon size={12} className="text-white/80" />
            </div>
          )}

          {/* Shine effect on hover */}
          <div className="absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/10 to-transparent
            -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"></div>
        </div>

        {/* ===== BACK FACE (Cover Image) ===== */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl overflow-hidden shadow-lg"
        >
          {coverImageUrl ? (
            <>
              <img
                src={coverImageUrl}
                alt="封面"
                className="w-full h-full object-cover"
              />
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
              {/* Lock info overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className={`text-[11px] font-bold text-white/90 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full`}>
                  {LOCK_TYPE_NAMES[lockType]}
                </div>
                <div className={`text-[11px] font-semibold ${statusInfo.color} bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full`}>
                  {statusInfo.text}
                </div>
              </div>
              {/* Hint to flip back */}
              <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-white text-xs">双击翻回</span>
              </div>
            </>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${theme.bg} flex items-center justify-center`}>
              <ImageIcon size={48} className="text-white/20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
