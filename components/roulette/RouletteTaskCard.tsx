import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Dice5,
  Play,
  Pause,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  Timer,
  Lock,
  FileText,
  SkipForward,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import type { RouletteTaskInstance } from '../../types';

const TASK_TYPE_LABELS: Record<string, string> = {
  MANUAL: '手动',
  COUNT: '计数',
  DURATION: '计时',
  LOCK: '锁定',
};

const getTaskTypeIcon = (taskType: string) => {
  switch (taskType) {
    case 'DURATION': return <Timer size={12} />;
    case 'COUNT': return <Target size={12} />;
    case 'LOCK': return <Lock size={12} />;
    default: return <CheckCircle size={12} />;
  }
};

interface RouletteTaskCardProps {
  instance: RouletteTaskInstance;
  onRefresh: () => void;
  onClick?: (instance: RouletteTaskInstance) => void;
  showGameTitle?: boolean;
  readOnly?: boolean;
}

export const RouletteTaskCard: React.FC<RouletteTaskCardProps> = ({
  instance,
  onRefresh,
  onClick,
  showGameTitle = false,
  readOnly = false,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const isActive = instance.status === 'PENDING' || instance.status === 'IN_PROGRESS';
  const taskType = instance.taskType || 'MANUAL';
  const hasTarget = !!instance.targetValue;

  // Progress for COUNT
  const progress = taskType === 'COUNT' && hasTarget
    ? Math.min(100, ((instance.currentValue || 0) / (instance.targetValue || 1)) * 100)
    : 0;

  // DURATION: timer state
  const targetUnit = instance.targetUnit || '分钟';
  const targetSeconds = taskType === 'DURATION' && hasTarget
    ? (targetUnit === '小时'
        ? (instance.targetValue || 0) * 3600
        : targetUnit === '秒'
          ? (instance.targetValue || 0)
          : (instance.targetValue || 0) * 60)
    : 0;
  const [elapsed, setElapsed] = useState(() => {
    if (taskType === 'DURATION') return instance.currentValue || 0;
    return 0;
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const durationProgress = targetSeconds > 0 ? Math.min(100, (elapsed / targetSeconds) * 100) : 0;

  // Timer effect for DURATION
  useEffect(() => {
    if (taskType !== 'DURATION' || !timerRunning) return;
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= targetSeconds) {
          setTimerRunning(false);
          if (timerRef.current) clearInterval(timerRef.current);
          rouletteApi.updateTaskProgress(instance.id, { currentValue: next }).then(() => onRefresh());
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, taskType, targetSeconds, instance.id]);

  const handleTimerToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRunning) {
      setTimerRunning(false);
      setIsUpdating(true);
      try {
        await rouletteApi.updateTaskProgress(instance.id, { currentValue: elapsedRef.current });
        onRefresh();
      } catch (err) {
        console.error('Failed to save timer progress', err);
      } finally {
        setIsUpdating(false);
      }
    } else {
      // If task is PENDING, start it first
      if (instance.status === 'PENDING') {
        setIsUpdating(true);
        try {
          await rouletteApi.startTaskInstance(instance.id);
        } catch (err) {
          console.error('Failed to start task', err);
          setIsUpdating(false);
          return;
        }
        setIsUpdating(false);
      }
      setTimerRunning(true);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await rouletteApi.startTaskInstance(instance.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to start task', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async (e: React.MouseEvent, success: boolean) => {
    e.stopPropagation();
    if (timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsUpdating(true);
    try {
      await rouletteApi.completeTaskInstance(instance.id, { success });
      onRefresh();
    } catch (err) {
      console.error('Failed to complete task', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsUpdating(true);
    try {
      await rouletteApi.skipTaskInstance(instance.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to skip task', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIncrement = async (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      // If task is PENDING, start it first
      if (instance.status === 'PENDING') {
        await rouletteApi.startTaskInstance(instance.id);
      }
      const newVal = (instance.currentValue || 0) + amount;
      await rouletteApi.updateTaskProgress(instance.id, { currentValue: newVal });
      onRefresh();
    } catch (err) {
      console.error('Failed to update progress', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Can start? (non-MANUAL, non-LOCK PENDING tasks)
  const canStart = instance.status === 'PENDING' && taskType !== 'MANUAL' && taskType !== 'LOCK' && !readOnly;
  // Can complete directly? (MANUAL tasks from PENDING)
  const canCompleteDirectly = instance.status === 'PENDING' && taskType === 'MANUAL' && !readOnly;
  // Can increment? (COUNT tasks, PENDING or IN_PROGRESS)
  const canIncrement = (instance.status === 'IN_PROGRESS' || instance.status === 'PENDING') &&
    taskType === 'COUNT' && !readOnly;
  // Timer complete?
  const isTimerComplete = taskType === 'DURATION' &&
    instance.status === 'IN_PROGRESS' &&
    elapsed >= targetSeconds && targetSeconds > 0;

  // Border color based on status
  const borderColor = instance.status === 'COMPLETED' ? 'border-emerald-500' :
    instance.status === 'IN_PROGRESS' ? 'border-indigo-500' :
    instance.status === 'FAILED' ? 'border-rose-500' :
    instance.status === 'SKIPPED' ? 'border-amber-500' :
    'border-indigo-300';

  const bgColor = instance.status === 'COMPLETED' ? 'bg-emerald-50/50 dark:bg-emerald-950/50' :
    instance.status === 'IN_PROGRESS' ? 'bg-indigo-50/50 dark:bg-indigo-950/50' :
    instance.status === 'FAILED' ? 'bg-rose-50/50 dark:bg-rose-950/50' :
    instance.status === 'SKIPPED' ? 'bg-amber-50/50 dark:bg-amber-950/50' :
    'bg-white dark:bg-slate-800';

  const iconBg = instance.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
    instance.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' :
    instance.status === 'FAILED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
    instance.status === 'SKIPPED' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
    'bg-indigo-100 text-indigo-600 dark:text-indigo-400';

  return (
    <div
      onClick={() => onClick?.(instance)}
      className={`rounded-2xl p-4 shadow-soft border-l-4 ${borderColor} ${bgColor} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Dice5 size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{instance.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              instance.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
              instance.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' :
              instance.status === 'FAILED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
              instance.status === 'SKIPPED' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
              'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {instance.status === 'PENDING' ? '待开始' :
               instance.status === 'IN_PROGRESS' ? '进行中' :
               instance.status === 'COMPLETED' ? '已完成' :
               instance.status === 'SKIPPED' ? '已跳过' : '未完成'}
            </span>
          </div>

          {/* Game title badge */}
          {showGameTitle && instance.gameTitle && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 mb-1.5">
              <Dice5 size={10} />
              <span className="truncate">{instance.gameTitle}</span>
            </div>
          )}

          {/* Description */}
          {instance.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{instance.description}</p>
          )}

          {/* Progress bar for COUNT */}
          {taskType === 'COUNT' && hasTarget && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  {getTaskTypeIcon(taskType)}
                  {TASK_TYPE_LABELS[taskType] || taskType}
                </span>
                <span>{instance.currentValue || 0} / {instance.targetValue} {instance.targetUnit || ''}</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    instance.status === 'COMPLETED' ? 'bg-emerald-500' :
                    instance.status === 'IN_PROGRESS' ? 'bg-indigo-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* DURATION progress bar + timer */}
          {taskType === 'DURATION' && targetSeconds > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Timer size={12} />
                  计时
                </span>
                <span className="font-mono">{formatTime(elapsed)} / {formatTime(targetSeconds)}</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isTimerComplete ? 'bg-emerald-500' :
                    timerRunning ? 'bg-indigo-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${durationProgress}%` }}
                />
              </div>
              {/* Live timer display */}
              {(instance.status === 'IN_PROGRESS' || timerRunning) && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Timer size={14} className="text-indigo-500 dark:text-indigo-400" />
                  <span className={`text-lg font-mono font-bold ${
                    isTimerComplete ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {isTimerComplete ? '完成!' : formatTime(Math.max(0, targetSeconds - elapsed))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* LOCK progress display */}
          {taskType === 'LOCK' && hasTarget && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Lock size={12} />
                  锁定
                </span>
                <span>{instance.currentValue || 0} / {instance.targetValue} {instance.targetUnit || ''}</span>
              </div>
            </div>
          )}

          {/* Proof submitted indicator */}
          {instance.proofSubmittedAt && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 mt-1">
              <FileText size={10} />
              <span>已提交证明</span>
            </div>
          )}
        </div>

        {/* Action buttons (right side, circular) */}
        {isActive && !readOnly && taskType !== 'LOCK' && (
          <div className="flex flex-col gap-2 shrink-0">
            {/* DURATION: play/pause toggle */}
            {taskType === 'DURATION' && isActive && !isTimerComplete && (
              <>
                <button
                  onClick={handleTimerToggle}
                  disabled={isUpdating}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                    timerRunning
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                      : 'bg-indigo-500 text-white hover:bg-indigo-600'
                  }`}
                >
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> :
                    timerRunning ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={isUpdating}
                  className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50"
                  title="跳过"
                >
                  <SkipForward size={16} />
                </button>
              </>
            )}

            {/* COUNT: +1 button */}
            {canIncrement && (
              <button
                onClick={(e) => handleIncrement(e, 1)}
                disabled={isUpdating}
                className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 transition-colors disabled:opacity-50"
                title="+1"
              >
                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            )}

            {/* MANUAL: complete button from PENDING */}
            {canCompleteDirectly && (
              <button
                onClick={(e) => handleComplete(e, true)}
                disabled={isUpdating}
                className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              </button>
            )}

            {/* Complete button for timer-complete or general IN_PROGRESS */}
            {(isTimerComplete || (instance.status === 'IN_PROGRESS' && taskType !== 'DURATION')) && (
              <button
                onClick={(e) => handleComplete(e, true)}
                disabled={isUpdating}
                className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              </button>
            )}

            {/* Fail/give up button */}
            <button
              onClick={(e) => handleComplete(e, false)}
              disabled={isUpdating}
              className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-200 transition-colors disabled:opacity-50"
              title="放弃"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteTaskCard;
