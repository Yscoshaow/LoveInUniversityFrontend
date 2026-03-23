import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, AlertCircle, Target, Dumbbell, Plus, Timer, Loader2, Lock } from 'lucide-react';
import { UserTaskDetail, TaskStatus, TargetUnit, TaskType } from '../../types';

interface TaskCardProps {
  task: UserTaskDetail;
  onClick?: (task: UserTaskDetail) => void;
  onStart?: (task: UserTaskDetail) => void;
  onComplete?: (task: UserTaskDetail, actualValue?: number) => void;
  onIncrement?: (task: UserTaskDetail) => void;
  dayStartOffsetHours?: number;  // 用户的日开始时间偏移（-12 到 +12）
}

// Get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-slate-500';
    case 'IN_PROGRESS':
      return 'bg-primary';
    case 'COMPLETED':
      return 'bg-green-500';
    case 'FAILED':
      return 'bg-red-500';
    case 'EXPIRED':
      return 'bg-amber-500';
    default:
      return 'bg-slate-400';
  }
};

// Get status icon
const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'PENDING':
      return <Clock size={14} />;
    case 'IN_PROGRESS':
      return <Play size={14} />;
    case 'COMPLETED':
      return <CheckCircle size={14} />;
    case 'FAILED':
    case 'EXPIRED':
      return <AlertCircle size={14} />;
    default:
      return <Target size={14} />;
  }
};

// Get task type icon
const getTaskTypeIcon = (taskType: TaskType) => {
  switch (taskType) {
    case 'DURATION':
      return <Timer size={12} />;
    case 'COUNT':
      return <Target size={12} />;
    case 'MANUAL':
      return <CheckCircle size={12} />;
    case 'LOCK':
      return <Lock size={12} />;
    default:
      return <Target size={12} />;
  }
};

// Get task type label (Chinese)
const getTaskTypeLabel = (taskType: TaskType): string => {
  switch (taskType) {
    case 'DURATION':
      return '计时';
    case 'COUNT':
      return '次数';
    case 'MANUAL':
      return '手动';
    case 'LOCK':
      return '锁定';
    default:
      return taskType;
  }
};

// Format target value with unit
const formatValue = (value: number): string => {
  if (Number.isInteger(value)) return `${value}`;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
};

const formatTarget = (value: number, unit: TargetUnit): string => {
  switch (unit) {
    case 'KILOMETERS':
      return `${formatValue(value)} km`;
    case 'METERS':
      return `${formatValue(value)} m`;
    case 'MINUTES':
      return `${formatValue(value)} min`;
    case 'HOURS':
      return `${formatValue(value)} h`;
    case 'TIMES':
      return `${Math.round(value)} 次`;
    case 'NONE':
    default:
      return value > 0 ? `${formatValue(value)}` : '';
  }
};

// Format lock duration nicely (converts to minutes, then formats as Xh Ym / Y分钟)
const formatLockDuration = (value: number, unit: string): string => {
  const totalMinutes = unit === 'HOURS' ? Math.round(value * 60) : Math.round(value);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  }
  return `${totalMinutes}min`;
};

// Format elapsed time for duration tasks (in seconds for more precision)
const formatElapsedTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// Format remaining time
const formatRemainingTime = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// Convert a value in the task's target unit to seconds
const targetValueToSeconds = (value: number, unit: TargetUnit): number => {
  switch (unit) {
    case 'HOURS': return value * 3600;
    case 'MINUTES': return value * 60;
    default: return value * 60;
  }
};

// Format date to YYYY-MM-DD using local timezone (NOT UTC)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 获取用户的有效日期（考虑 dayStartOffsetHours）
 * 例如：如果 dayStartOffsetHours = 3，则凌晨 0:00-2:59 仍属于"昨天"
 * @param dayStartOffsetHours 用户的日开始时间偏移（-12 到 +12）
 * @returns 用户视角的"今天"日期字符串 (YYYY-MM-DD)
 */
const getEffectiveToday = (dayStartOffsetHours: number = 0): string => {
  const now = new Date();
  // 减去偏移小时数来计算有效日期
  // 例如：offset=3 表示一天从 3:00 开始，所以 0:00-2:59 应该算作前一天
  const adjustedTime = new Date(now.getTime() - dayStartOffsetHours * 60 * 60 * 1000);
  return formatLocalDate(adjustedTime);
};

// Check if a date string (YYYY-MM-DD) is the user's effective "today"
const isEffectiveToday = (dateStr: string, dayStartOffsetHours: number = 0): boolean => {
  const effectiveToday = getEffectiveToday(dayStartOffsetHours);
  return dateStr === effectiveToday;
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onStart, onComplete, onIncrement, dayStartOffsetHours = 0 }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(targetValueToSeconds(task.actualValue, task.targetUnit));

  // Check if task can be executed
  // 有截止时间(dueAt)时：scheduledDate 当天起到 dueAt 截止都可执行
  // 没有截止时间时：仅当天（考虑 dayStartOffsetHours）可执行
  const isTaskFuture = task.scheduledDate > getEffectiveToday(dayStartOffsetHours);
  const isTaskPast = task.dueAt
    ? new Date() > new Date(task.dueAt)
    : task.scheduledDate < getEffectiveToday(dayStartOffsetHours);
  const canExecuteTask = !isTaskFuture && !isTaskPast;

  // Timer for DURATION tasks - updates every second
  useEffect(() => {
    if (task.status !== 'IN_PROGRESS' || task.taskType !== 'DURATION') {
      setElapsedSeconds(targetValueToSeconds(task.actualValue, task.targetUnit));
      return;
    }

    const calculateElapsed = () => {
      if (task.startedAt) {
        const startTime = new Date(task.startedAt).getTime();
        const now = Date.now();
        const elapsedMs = now - startTime;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        setElapsedSeconds(elapsedSecs);
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [task.status, task.taskType, task.startedAt, task.actualValue]);

  const statusColor = getStatusColor(task.status);

  // For DURATION tasks, calculate target in seconds for comparison
  const targetTotalSeconds = targetValueToSeconds(task.targetValue, task.targetUnit);

  // For DURATION tasks, use calculated elapsed time
  const displayedProgress = task.taskType === 'DURATION' && task.status === 'IN_PROGRESS'
    ? Math.min((elapsedSeconds / targetTotalSeconds) * 100, 100)
    : task.progressPercent;
  const progressWidth = Math.min(displayedProgress, 100);

  // Check if DURATION task is ready to complete (time reached)
  const isDurationReady = task.taskType === 'DURATION' &&
    task.status === 'IN_PROGRESS' &&
    elapsedSeconds >= targetTotalSeconds;

  const handleActionClick = async (e: React.MouseEvent, action: () => Promise<void> | void, actionName: string) => {
    e.stopPropagation();
    setIsLoading(true);
    setLoadingAction(actionName);
    try {
      await action();
    } catch (error) {
      console.error(`Failed to ${actionName}:`, error);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div
      onClick={() => onClick?.(task)}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Course Icon */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {task.courseIconUrl ? (
            <img src={task.courseIconUrl} alt="" className="w-6 h-6 object-contain" />
          ) : (
            <Dumbbell size={20} className="text-primary" />
          )}
        </div>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{task.taskName}</h4>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{task.courseName}</p>
            {/* Task Type Badge */}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
              {getTaskTypeIcon(task.taskType)}
              {getTaskTypeLabel(task.taskType)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`${statusColor} text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
          {getStatusIcon(task.status)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {task.taskType === 'DURATION' && task.status === 'IN_PROGRESS'
              ? `${formatElapsedTime(elapsedSeconds)} / ${formatTarget(task.targetValue, task.targetUnit)}`
              : task.taskType === 'LOCK'
                ? `${formatLockDuration(task.actualValue, task.targetUnit)} / ${formatLockDuration(task.targetValue, task.targetUnit)}`
                : `${formatTarget(task.actualValue, task.targetUnit)} / ${formatTarget(task.targetValue, task.targetUnit)}`
            }
          </span>
          <span className="text-xs font-semibold text-primary">{Math.round(displayedProgress)}%</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${statusColor} rounded-full transition-all duration-300`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Time/Status info */}
        <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          {/* DURATION task - show elapsed time with timer indicator */}
          {task.status === 'IN_PROGRESS' && task.taskType === 'DURATION' && (
            <span className="flex items-center gap-1 text-primary">
              <Timer size={12} className={isDurationReady ? '' : 'animate-pulse'} />
              {isDurationReady ? '已完成' : `还需 ${formatRemainingTime(targetTotalSeconds - elapsedSeconds)}`}
            </span>
          )}
          {/* COUNT task - show count */}
          {task.status === 'IN_PROGRESS' && task.taskType === 'COUNT' && (
            <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
              <Target size={12} />
              {task.actualValue}/{task.targetValue}
            </span>
          )}
          {/* MANUAL task - show status */}
          {task.status === 'IN_PROGRESS' && task.taskType === 'MANUAL' && (
            <span className="flex items-center gap-1 text-green-500 dark:text-green-400">
              <CheckCircle size={12} />
              待确认
            </span>
          )}
          {/* LOCK task - show lock time progress (automatic, no user actions) */}
          {task.taskType === 'LOCK' && task.status !== 'COMPLETED' && task.status !== 'FAILED' && task.status !== 'EXPIRED' && (
            <span className="flex items-center gap-1 text-purple-500 dark:text-purple-400">
              <Lock size={12} />
              {task.actualValue >= task.targetValue ? '已达标' : `已锁 ${formatLockDuration(task.actualValue, task.targetUnit)}/${formatLockDuration(task.targetValue, task.targetUnit)}`}
            </span>
          )}
          {task.status === 'COMPLETED' && (
            <span className="text-green-500 dark:text-green-400">+{task.pointsEarned} pts</span>
          )}
          {task.isExamAttempt && (
            <span className="text-amber-500 dark:text-amber-400 font-semibold">考试</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* LOCK task - automatic, no user actions */}
          {task.taskType === 'LOCK' && (task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <span className="px-2 py-1 bg-purple-100 text-purple-600 dark:text-purple-400 text-[10px] font-medium rounded-lg flex items-center gap-1">
              <Lock size={10} />
              自动检测
            </span>
          )}

          {/* Show date restriction indicator for non-today tasks */}
          {!canExecuteTask && task.taskType !== 'LOCK' && (task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] font-medium rounded-lg">
              {isTaskPast ? '已过期' : '未到日期'}
            </span>
          )}

          {/* PENDING - Only DURATION tasks need start button */}
          {task.status === 'PENDING' && task.taskType === 'DURATION' && onStart && canExecuteTask && (
            <button
              onClick={(e) => handleActionClick(e, () => onStart(task), 'start')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loadingAction === 'start' ? <Loader2 size={12} className="animate-spin" /> : '开始'}
            </button>
          )}

          {/* PENDING - COUNT task can directly increment (will auto-start) */}
          {task.status === 'PENDING' && task.taskType === 'COUNT' && onIncrement && canExecuteTask && (
            <button
              onClick={(e) => handleActionClick(e, () => onIncrement(task), 'increment')}
              disabled={isLoading}
              className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loadingAction === 'increment' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
            </button>
          )}

          {/* PENDING - MANUAL can directly complete (will auto-start) */}
          {task.status === 'PENDING' && task.taskType === 'MANUAL' && onComplete && canExecuteTask && (
            <button
              onClick={(e) => handleActionClick(e, () => onComplete(task, task.targetValue), 'complete')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {loadingAction === 'complete' ? <Loader2 size={12} className="animate-spin" /> : '完成'}
            </button>
          )}

          {/* IN_PROGRESS - Different actions based on task type */}
          {task.status === 'IN_PROGRESS' && canExecuteTask && (
            <>
              {/* COUNT Task - Increment button (not yet reached target) */}
              {task.taskType === 'COUNT' && onIncrement && task.actualValue < task.targetValue && (
                <button
                  onClick={(e) => handleActionClick(e, () => onIncrement(task), 'increment')}
                  disabled={isLoading}
                  className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {loadingAction === 'increment' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
                </button>
              )}

              {/* COUNT Task - Complete button (target reached but not auto-completed) */}
              {task.taskType === 'COUNT' && onComplete && task.actualValue >= task.targetValue && (
                <button
                  onClick={(e) => handleActionClick(e, () => onComplete(task, task.actualValue), 'complete')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {loadingAction === 'complete' ? <Loader2 size={12} className="animate-spin" /> : '完成'}
                </button>
              )}

              {/* MANUAL Task - Complete button */}
              {task.taskType === 'MANUAL' && onComplete && (
                <button
                  onClick={(e) => handleActionClick(e, () => onComplete(task, task.targetValue), 'complete')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {loadingAction === 'complete' ? <Loader2 size={12} className="animate-spin" /> : '完成'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
