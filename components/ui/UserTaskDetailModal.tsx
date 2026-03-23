import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Clock,
  Target,
  CheckCircle,
  AlertCircle,
  Play,
  Dumbbell,
  Calendar,
  Timer,
  Award,
  Loader2,
  Plus,
  Lock,
  RefreshCw
} from 'lucide-react';
import { UserTaskDetail, TaskStatus, TargetUnit, TaskType } from '../../types';

interface UserTaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: UserTaskDetail;
  onStart?: (task: UserTaskDetail) => Promise<UserTaskDetail | void>;
  onComplete?: (task: UserTaskDetail, actualValue?: number) => Promise<UserTaskDetail | void>;
  onUpdateProgress?: (task: UserTaskDetail, newValue: number) => Promise<UserTaskDetail | void>;
  onAbandon?: (task: UserTaskDetail) => Promise<UserTaskDetail | void>;
  onRefresh?: () => Promise<UserTaskDetail | void>;
}

// Get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'PENDING':
      return 'from-slate-500 to-slate-600';
    case 'IN_PROGRESS':
      return 'from-primary to-rose-500';
    case 'COMPLETED':
      return 'from-green-500 to-emerald-500';
    case 'FAILED':
      return 'from-red-500 to-rose-600';
    case 'EXPIRED':
      return 'from-amber-500 to-orange-500';
    default:
      return 'from-slate-400 to-slate-500';
  }
};

// Get status label
const getStatusLabel = (status: TaskStatus): string => {
  switch (status) {
    case 'PENDING':
      return '待开始';
    case 'IN_PROGRESS':
      return '进行中';
    case 'COMPLETED':
      return '已完成';
    case 'FAILED':
      return '未完成';
    case 'EXPIRED':
      return '已过期';
    default:
      return status;
  }
};

// Get status icon
const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'PENDING':
      return Clock;
    case 'IN_PROGRESS':
      return Play;
    case 'COMPLETED':
      return CheckCircle;
    case 'FAILED':
    case 'EXPIRED':
      return AlertCircle;
    default:
      return Target;
  }
};

// Get task type label
const getTaskTypeLabel = (taskType: TaskType): string => {
  switch (taskType) {
    case 'DURATION':
      return '计时任务';
    case 'COUNT':
      return '次数任务';
    case 'MANUAL':
      return '手动确认';
    case 'LOCK':
      return '锁定任务';
    default:
      return taskType;
  }
};

// Get task type icon
const getTaskTypeIcon = (taskType: TaskType) => {
  switch (taskType) {
    case 'DURATION':
      return Timer;
    case 'COUNT':
      return Target;
    case 'MANUAL':
      return CheckCircle;
    case 'LOCK':
      return Lock;
    default:
      return Target;
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
      return `${formatValue(value)} 公里`;
    case 'METERS':
      return `${formatValue(value)} 米`;
    case 'MINUTES':
      return `${formatValue(value)} 分钟`;
    case 'HOURS':
      return `${formatValue(value)} 小时`;
    case 'TIMES':
      return `${Math.round(value)} 次`;
    case 'NONE':
    default:
      return value > 0 ? `${formatValue(value)}` : '';
  }
};

// Format current value with unit for display
const formatCurrentValue = (value: number, unit: TargetUnit): string => {
  switch (unit) {
    case 'KILOMETERS':
      return `${formatValue(value)} 公里`;
    case 'METERS':
      return `${formatValue(value)} 米`;
    case 'MINUTES':
      return `${formatValue(value)} 分钟`;
    case 'HOURS':
      return `${formatValue(value)} 小时`;
    case 'TIMES':
      return `${Math.round(value)} 次`;
    case 'NONE':
    default:
      return `${formatValue(value)}`;
  }
};

// Convert a value in the task's target unit to seconds
const targetValueToSeconds = (value: number, unit: TargetUnit): number => {
  switch (unit) {
    case 'HOURS': return value * 3600;
    case 'MINUTES': return value * 60;
    default: return value * 60;
  }
};

// Convert seconds back to the task's target unit
const secondsToTargetUnit = (seconds: number, unit: TargetUnit): number => {
  switch (unit) {
    case 'HOURS': return seconds / 3600;
    case 'MINUTES': return seconds / 60;
    default: return seconds / 60;
  }
};

// Format lock duration nicely (converts to minutes, then formats as Xh Ym / Y分钟)
const formatLockDuration = (value: number, unit: TargetUnit): string => {
  const totalMinutes = unit === 'HOURS' ? Math.round(value * 60) : Math.round(value);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }
  return `${totalMinutes} 分钟`;
};

// Format remaining time
const formatRemainingTime = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}小时 ${remainingMins}分钟`;
  }
  return mins > 0 ? `${mins}分 ${secs}秒` : `${secs}秒`;
};

// Format elapsed time (for duration tasks, input in seconds)
const formatElapsedTime = (totalSeconds: number): string => {
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    return `${hours}小时 ${remainingMins}分钟`;
  }
  return `${totalMinutes} 分钟`;
};

// Format date
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date to YYYY-MM-DD using local timezone (NOT UTC)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Check if a date string (YYYY-MM-DD) is today (using local timezone)
const isToday = (dateStr: string): boolean => {
  const today = new Date();
  const todayStr = formatLocalDate(today);
  return dateStr === todayStr;
};

// Check if a date string is in the past
const isPastDate = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateStr);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate < today;
};

// Check if a date string is in the future
const isFutureDate = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateStr);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate > today;
};

export const UserTaskDetailModal: React.FC<UserTaskDetailModalProps> = ({
  isOpen,
  onClose,
  task: initialTask,
  onStart,
  onComplete,
  onUpdateProgress,
  onAbandon,
  onRefresh
}) => {
  // Local task state for real-time updates
  const [task, setTask] = useState(initialTask);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const autoCompleteTriggeredRef = useRef(false);

  // Check if task can be executed
  // 有截止时间(dueAt)时：scheduledDate 当天起到 dueAt 截止都可执行
  // 没有截止时间时：仅 scheduledDate 当天可执行
  const isTaskFuture = isFutureDate(task.scheduledDate);
  const isTaskPast = task.dueAt
    ? new Date() > new Date(task.dueAt)
    : isPastDate(task.scheduledDate);
  const canExecuteTask = !isTaskFuture && !isTaskPast;

  // Sync with external task prop
  useEffect(() => {
    setTask(initialTask);
    autoCompleteTriggeredRef.current = false;
  }, [initialTask]);

  // Calculate elapsed time for DURATION tasks (in seconds)
  useEffect(() => {
    if (task.taskType === 'DURATION' && task.status === 'IN_PROGRESS' && task.startedAt) {
      const calculateElapsed = () => {
        const startTime = new Date(task.startedAt!).getTime();
        const now = Date.now();
        const elapsedMs = now - startTime;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        setElapsedSeconds(elapsedSecs);
      };

      calculateElapsed();
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(targetValueToSeconds(task.actualValue, task.targetUnit));
    }
  }, [task.taskType, task.status, task.startedAt, task.actualValue, task.targetUnit]);

  // Auto-complete DURATION task when time reached
  useEffect(() => {
    if (!isOpen || autoCompleteTriggeredRef.current) return;
    if (task.taskType !== 'DURATION' || task.status !== 'IN_PROGRESS') return;
    const targetSecs = targetValueToSeconds(task.targetValue, task.targetUnit);
    if (elapsedSeconds < targetSecs) return;
    if (!onComplete) return;

    // Auto-complete
    autoCompleteTriggeredRef.current = true;
    (async () => {
      setIsLoading(true);
      setLoadingAction('auto-complete');
      try {
        const actualValueInUnit = secondsToTargetUnit(elapsedSeconds, task.targetUnit);
        await onComplete(task, actualValueInUnit);
        await onRefresh?.();
        onClose();
      } catch (error) {
        console.error('Failed to auto-complete duration task:', error);
        autoCompleteTriggeredRef.current = false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    })();
  }, [isOpen, task, elapsedSeconds, onComplete, onRefresh, onClose]);

  // Auto-refresh LOCK task progress when modal is open
  // Refreshes every 30 seconds to show updated lock duration
  useEffect(() => {
    if (!isOpen || !onRefresh) return;
    if (task.taskType !== 'LOCK') return;
    if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'EXPIRED') return;

    // Refresh immediately when modal opens
    onRefresh();

    // Then refresh every 30 seconds
    const interval = setInterval(() => {
      onRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen, task.taskType, task.status, onRefresh]);

  // Handle start (only for DURATION tasks)
  const handleStart = useCallback(async () => {
    if (!onStart) return;
    setIsLoading(true);
    setLoadingAction('start');
    try {
      await onStart(task);
      await onRefresh?.();
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [onStart, task, onRefresh]);

  // Handle complete (for MANUAL tasks)
  const handleComplete = useCallback(async (actualValue?: number) => {
    if (!onComplete) return;
    setIsLoading(true);
    setLoadingAction('complete');
    try {
      await onComplete(task, actualValue);
      await onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to complete task:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [onComplete, task, onRefresh, onClose]);

  // Handle increment for COUNT tasks - auto-complete when target reached
  const handleIncrement = useCallback(async () => {
    if (!onUpdateProgress) return;
    setIsLoading(true);
    setLoadingAction('increment');
    try {
      const newValue = task.actualValue + 1;
      await onUpdateProgress(task, newValue);

      // Update local state immediately for better UX
      setTask(prev => ({ ...prev, actualValue: newValue, progressPercent: Math.round((newValue / prev.targetValue) * 100) }));

      // Auto-complete if target reached
      if (newValue >= task.targetValue && onComplete) {
        await onComplete({ ...task, actualValue: newValue }, newValue);
        await onRefresh?.();
        onClose();
      } else {
        await onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to increment task:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [onUpdateProgress, task, onComplete, onRefresh, onClose]);

  // Handle abandon task
  const handleAbandon = useCallback(async () => {
    if (!onAbandon) return;
    setIsLoading(true);
    setLoadingAction('abandon');
    try {
      await onAbandon(task);
      await onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to abandon task:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [onAbandon, task, onRefresh, onClose]);

  // Handle manual refresh for LOCK tasks
  const handleRefreshLockProgress = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh lock progress:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  if (!isOpen) return null;

  const statusColor = getStatusColor(task.status);
  const StatusIcon = getStatusIcon(task.status);
  const TaskTypeIcon = getTaskTypeIcon(task.taskType);

  // For DURATION tasks in progress, use calculated elapsed time
  const targetTotalSeconds = targetValueToSeconds(task.targetValue, task.targetUnit);
  const displayedProgress = task.taskType === 'DURATION' && task.status === 'IN_PROGRESS'
    ? Math.min((elapsedSeconds / targetTotalSeconds) * 100, 100)
    : task.progressPercent;
  const progressWidth = Math.min(displayedProgress, 100);

  // Check if DURATION task time reached
  const isDurationTimeReached = task.taskType === 'DURATION' &&
    task.status === 'IN_PROGRESS' &&
    elapsedSeconds >= targetTotalSeconds;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${statusColor} p-6 pb-8 relative`}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 dark:bg-slate-800/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Course Icon */}
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            {task.courseIconUrl ? (
              <img src={task.courseIconUrl} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <Dumbbell size={28} className="text-primary" />
            )}
          </div>

          {/* Task Title + Course Name */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-xl font-bold text-white flex-1">{task.taskName}</h2>
            <p className="text-white/80 text-xs bg-white/20 dark:bg-slate-800/20 px-2 py-1 rounded-lg shrink-0">{task.courseName}</p>
          </div>

          {/* Task Type + Status Badge (same row) */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <TaskTypeIcon size={14} className="text-white" />
              <span className="text-white text-xs font-semibold">{getTaskTypeLabel(task.taskType)}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <StatusIcon size={14} className="text-white" />
              <span className="text-white text-xs font-semibold">{getStatusLabel(task.status)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Progress Section */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">完成进度</span>
              <span className="text-sm font-bold text-primary">{Math.round(displayedProgress)}%</span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full bg-gradient-to-r ${statusColor} rounded-full transition-all duration-500`}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                当前: {task.taskType === 'DURATION' && task.status === 'IN_PROGRESS'
                  ? formatElapsedTime(elapsedSeconds)
                  : task.taskType === 'LOCK'
                    ? formatLockDuration(task.actualValue, task.targetUnit)
                    : formatCurrentValue(task.actualValue, task.targetUnit)}
              </span>
              <span>目标: {task.taskType === 'LOCK'
                ? formatLockDuration(task.targetValue, task.targetUnit)
                : formatTarget(task.targetValue, task.targetUnit)}</span>
            </div>
          </div>

          {/* Task Type Specific Controls */}
          {task.status === 'IN_PROGRESS' && canExecuteTask && (
            <div className="space-y-3">
              {/* DURATION Task - Show timer */}
              {task.taskType === 'DURATION' && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">已用时间</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatElapsedTime(elapsedSeconds)}
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {isDurationTimeReached ? (
                        <CheckCircle size={32} className="text-green-500 dark:text-green-400" />
                      ) : (
                        <Timer size={32} className="text-primary animate-pulse" />
                      )}
                    </div>
                  </div>
                  {isDurationTimeReached ? (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                      已达到目标时间，正在完成...
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      任务正在计时中，达到目标时间后自动完成
                    </p>
                  )}
                </div>
              )}

              {/* COUNT Task - Show counter with increment button */}
              {task.taskType === 'COUNT' && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">完成次数</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {task.actualValue} / {task.targetValue}
                      </div>
                    </div>
                    <button
                      onClick={handleIncrement}
                      disabled={isLoading || task.actualValue >= task.targetValue}
                      className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAction === 'increment' ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <Plus size={32} strokeWidth={3} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    点击 + 按钮记录完成一次，达到目标后自动完成
                  </p>
                </div>
              )}

              {/* MANUAL Task - Show manual confirmation message */}
              {task.taskType === 'MANUAL' && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <CheckCircle size={24} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-amber-700 dark:text-amber-400">手动确认任务</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        完成任务后点击下方按钮确认
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LOCK Task - Show lock time progress (automatic, no user actions) */}
          {task.taskType === 'LOCK' && (task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-2">
                    今日锁定时长
                    <button
                      onClick={handleRefreshLockProgress}
                      disabled={isRefreshing}
                      className="p-1 hover:bg-purple-200 rounded-full transition-colors disabled:opacity-50"
                      title="刷新进度"
                    >
                      <RefreshCw size={14} className={`text-purple-500 dark:text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatLockDuration(task.actualValue, task.targetUnit)} / {formatLockDuration(task.targetValue, task.targetUnit)}
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                  {task.actualValue >= task.targetValue ? (
                    <CheckCircle size={32} className="text-green-500 dark:text-green-400" />
                  ) : (
                    <Lock size={32} className="text-purple-600 dark:text-purple-400 animate-pulse" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {task.actualValue >= task.targetValue
                  ? '已达成目标！正在刷新...'
                  : `还需锁定 ${formatLockDuration(task.targetValue - task.actualValue, task.targetUnit)}`}
              </p>
              {task.actualValue < task.targetValue && (
                <div className="mt-3 bg-purple-100/50 rounded-lg p-2">
                  <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <Clock size={12} />
                    达标后自动完成，每30秒自动刷新进度
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Task Description */}
          {task.taskDescription && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">任务描述</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{task.taskDescription}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Scheduled Date */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                <Calendar size={14} />
                <span className="text-xs">计划日期</span>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{task.scheduledDate}</p>
            </div>

            {/* Due Time */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                <Timer size={14} />
                <span className="text-xs">截止时间</span>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {task.dueAt ? formatDate(task.dueAt) : '无限制'}
              </p>
            </div>

            {/* Started At */}
            {task.startedAt && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                  <Play size={14} />
                  <span className="text-xs">开始时间</span>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(task.startedAt)}</p>
              </div>
            )}

            {/* Completed At */}
            {task.completedAt && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                  <CheckCircle size={14} />
                  <span className="text-xs">完成时间</span>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(task.completedAt)}</p>
              </div>
            )}

            {/* Points Earned */}
            {task.pointsEarned > 0 && (
              <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3">
                <div className="flex items-center gap-2 text-green-500 dark:text-green-400 mb-1">
                  <Award size={14} />
                  <span className="text-xs">获得积分</span>
                </div>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">+{task.pointsEarned} pts</p>
              </div>
            )}

            {/* Remaining Time (for deadline) */}
            {task.status === 'IN_PROGRESS' && task.remainingSeconds !== null && task.remainingSeconds > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-3">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-1">
                  <Clock size={14} />
                  <span className="text-xs">截止倒计时</span>
                </div>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatRemainingTime(task.remainingSeconds)}</p>
              </div>
            )}
          </div>

          {/* Exam Task Badge */}
          {task.isExamAttempt && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">这是一个考试任务</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
          {/* Date restriction message */}
          {!canExecuteTask && (task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                <Calendar size={16} />
                <span className="text-sm font-medium">
                  {isTaskPast ? '该任务已过期，无法执行' : '该任务尚未到执行日期'}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                计划日期: {task.scheduledDate}
              </p>
            </div>
          )}

          {/* PENDING - Only DURATION tasks need start button */}
          {task.status === 'PENDING' && task.taskType === 'DURATION' && onStart && canExecuteTask && (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-rose-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loadingAction === 'start' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Play size={18} />
                  开始计时
                </>
              )}
            </button>
          )}

          {/* PENDING - COUNT task can directly increment (will auto-start on backend) */}
          {task.status === 'PENDING' && task.taskType === 'COUNT' && canExecuteTask && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">完成次数</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {task.actualValue} / {task.targetValue}
                  </div>
                </div>
                <button
                  onClick={handleIncrement}
                  disabled={isLoading}
                  className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAction === 'increment' ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <Plus size={32} strokeWidth={3} />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                点击 + 按钮记录完成一次，达到目标后自动完成
              </p>
            </div>
          )}

          {/* PENDING - MANUAL task can directly complete */}
          {task.status === 'PENDING' && task.taskType === 'MANUAL' && onComplete && canExecuteTask && (
            <button
              onClick={() => handleComplete()}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loadingAction === 'complete' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} />
                  完成任务
                </>
              )}
            </button>
          )}

          {/* IN_PROGRESS Actions */}
          {task.status === 'IN_PROGRESS' && canExecuteTask && (
            <>
              {/* DURATION Task - Shows timer status, auto-completes */}
              {task.taskType === 'DURATION' && (
                <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                  {isDurationTimeReached ? (
                    <span className="text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      正在完成任务...
                    </span>
                  ) : (
                    `还需 ${formatRemainingTime(targetTotalSeconds - elapsedSeconds)} 后自动完成`
                  )}
                </div>
              )}

              {/* COUNT Task - Shows increment status, auto-completes when target reached */}
              {task.taskType === 'COUNT' && task.actualValue < task.targetValue && (
                <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                  还需完成 {task.targetValue - task.actualValue} 次
                </div>
              )}

              {/* MANUAL Task - Manual complete */}
              {task.taskType === 'MANUAL' && onComplete && (
                <button
                  onClick={() => handleComplete()}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {loadingAction === 'complete' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      完成任务
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Abandon button - for PENDING or IN_PROGRESS tasks (not LOCK tasks) */}
          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && onAbandon && canExecuteTask && task.taskType !== 'LOCK' && (
            <button
              onClick={handleAbandon}
              disabled={isLoading}
              className="w-full py-3 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900 transition-all disabled:opacity-50"
            >
              {loadingAction === 'abandon' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <X size={18} />
                  放弃任务
                </>
              )}
            </button>
          )}

          {/* Warning text for abandon */}
          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && onAbandon && canExecuteTask && task.taskType !== 'LOCK' && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              放弃任务可能会触发惩罚
            </p>
          )}

          {/* LOCK Task - Show automatic detection message */}
          {task.taskType === 'LOCK' && (task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <div className="text-center text-sm text-purple-600 dark:text-purple-400 py-2 flex items-center justify-center gap-2">
              <Lock size={16} />
              此任务由系统自动检测，无需手动操作
            </div>
          )}

          {/* COMPLETED/FAILED/EXPIRED - Close button */}
          {(task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'EXPIRED') && (
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserTaskDetailModal;
