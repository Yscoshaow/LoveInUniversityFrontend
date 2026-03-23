import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  Plus,
  Timer,
  Lock,
  Loader2,
  Shield,
  User,
} from 'lucide-react';
import type { SupervisorTaskDetail, TaskStatus, TargetUnit, TaskType } from '../../types';

interface SupervisorTaskCardProps {
  task: SupervisorTaskDetail;
  onClick?: (task: SupervisorTaskDetail) => void;
  onStart?: (task: SupervisorTaskDetail) => void;
  onComplete?: (task: SupervisorTaskDetail, actualValue?: number) => void;
  onIncrement?: (task: SupervisorTaskDetail) => void;
}

// Get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-slate-500';
    case 'IN_PROGRESS':
      return 'bg-indigo-500';
    case 'COMPLETED':
      return 'bg-emerald-500';
    case 'FAILED':
      return 'bg-rose-500';
    case 'PENDING_REVIEW':
      return 'bg-amber-500';
    case 'EXPIRED':
      return 'bg-orange-500';
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
    case 'PENDING_REVIEW':
      return <Clock size={14} />;
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
    case 'LOCK':
      return <Lock size={12} />;
    case 'MANUAL':
      return <CheckCircle size={12} />;
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
    case 'LOCK':
      return '锁定';
    case 'MANUAL':
      return '手动';
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

// Format time from seconds to readable format
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const SupervisorTaskCard: React.FC<SupervisorTaskCardProps> = ({
  task,
  onClick,
  onStart,
  onComplete,
  onIncrement,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(task.remainingSeconds ?? null);
  const [isActioning, setIsActioning] = useState(false);

  // Timer countdown for duration tasks
  useEffect(() => {
    if (task.status === 'IN_PROGRESS' && task.taskType === 'DURATION' && task.remainingSeconds !== null) {
      setRemainingSeconds(task.remainingSeconds);

      const interval = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev === null || prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [task.status, task.taskType, task.remainingSeconds]);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActioning || !onStart) return;
    setIsActioning(true);
    try {
      await onStart(task);
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActioning || !onComplete) return;

    setIsActioning(true);
    try {
      if (task.taskType === 'MANUAL') {
        // MANUAL tasks require actualValue >= targetValue to complete
        await onComplete(task, task.targetValue);
      } else {
        await onComplete(task);
      }
    } finally {
      setIsActioning(false);
    }
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActioning || !onIncrement) return;
    setIsActioning(true);
    try {
      await onIncrement(task);
    } finally {
      setIsActioning(false);
    }
  };

  // Calculate progress
  const progress = task.targetValue > 0 ? (task.actualValue / task.targetValue) * 100 : 0;
  const progressCapped = Math.min(progress, 100);

  // Can start? (not for MANUAL or LOCK tasks)
  const canStart = task.status === 'PENDING' && task.taskType !== 'MANUAL' && task.taskType !== 'LOCK' && onStart;

  // Can complete directly? (MANUAL tasks can complete from PENDING, others need IN_PROGRESS)
  const canCompleteDirectly = task.status === 'PENDING' && task.taskType === 'MANUAL' && onComplete;

  // Can complete? (IN_PROGRESS tasks, or DURATION tasks with timer complete)
  const canComplete = task.status === 'IN_PROGRESS' && task.taskType !== 'LOCK' && onComplete;

  // Can increment? (for COUNT tasks in progress)
  const canIncrement = task.status === 'IN_PROGRESS' && task.taskType === 'COUNT' && onIncrement;

  // Is timer complete?
  const isTimerComplete = task.taskType === 'DURATION' &&
    task.status === 'IN_PROGRESS' &&
    remainingSeconds !== null &&
    remainingSeconds <= 0;

  return (
    <div
      onClick={() => onClick?.(task)}
      className={`rounded-2xl p-4 shadow-soft border-l-4 ${
        task.status === 'COMPLETED' ? 'bg-emerald-50/50 dark:bg-emerald-950/50 border-emerald-500' :
        task.status === 'IN_PROGRESS' ? 'bg-indigo-50/50 dark:bg-indigo-950/50 border-indigo-500' :
        task.status === 'PENDING_REVIEW' ? 'bg-amber-50/50 dark:bg-amber-950/50 border-amber-500' :
        task.status === 'FAILED' || task.status === 'EXPIRED' ? 'bg-rose-50/50 dark:bg-rose-950/50 border-rose-500' :
        'bg-white dark:bg-slate-800 border-indigo-300'
      } ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon/Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
          task.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' :
          task.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
          task.status === 'FAILED' || task.status === 'EXPIRED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
          'bg-indigo-100 text-indigo-600 dark:text-indigo-400'
        }`}>
          {task.iconUrl ? (
            <img src={task.iconUrl} className="w-6 h-6 rounded" alt="" />
          ) : (
            <Shield size={20} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {task.taskName}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
              task.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' :
              task.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
              task.status === 'FAILED' || task.status === 'EXPIRED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
              'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {task.status === 'PENDING' ? '待开始' :
               task.status === 'IN_PROGRESS' ? '进行中' :
               task.status === 'PENDING_REVIEW' ? '待审核' :
               task.status === 'COMPLETED' ? '已完成' :
               task.status === 'FAILED' ? '未完成' : '已过期'}
            </span>
          </div>

          {/* Supervisor badge */}
          <div className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 mb-2">
            <Shield size={10} />
            <span>来自 {task.supervisorName}</span>
          </div>

          {/* Task description */}
          {task.taskDescription && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
              {task.taskDescription}
            </p>
          )}

          {/* Progress bar for non-manual tasks */}
          {task.taskType !== 'MANUAL' && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  {getTaskTypeIcon(task.taskType)}
                  {getTaskTypeLabel(task.taskType)}
                </span>
                <span>
                  {formatTarget(task.actualValue, task.targetUnit)} / {formatTarget(task.targetValue, task.targetUnit)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-indigo-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${progressCapped}%` }}
                />
              </div>
            </div>
          )}

          {/* Timer display for duration tasks */}
          {task.taskType === 'DURATION' && task.status === 'IN_PROGRESS' && remainingSeconds !== null && (
            <div className="flex items-center gap-2 mb-2">
              <Timer size={14} className="text-indigo-500 dark:text-indigo-400" />
              <span className={`text-lg font-mono font-bold ${
                remainingSeconds <= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                {remainingSeconds <= 0 ? '完成!' : formatTime(remainingSeconds)}
              </span>
            </div>
          )}

          {/* Due time */}
          {task.dueAt && task.status !== 'COMPLETED' && (
            <div className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400">
              <Clock size={10} />
              截止 {new Date(task.dueAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Supervisor note */}
          {task.supervisorNote && (
            <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg text-[10px] text-indigo-600 dark:text-indigo-400">
              <User size={10} className="inline mr-1" />
              {task.supervisorNote}
            </div>
          )}

        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {/* LOCK tasks show system-auto badge */}
          {task.taskType === 'LOCK' && (
            <span className="px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg whitespace-nowrap">
              系统自动
            </span>
          )}

          {/* Start button (not for MANUAL or LOCK tasks) */}
          {canStart && (
            <button
              onClick={handleStart}
              disabled={isActioning}
              className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {isActioning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            </button>
          )}

          {/* Direct complete button for MANUAL tasks */}
          {canCompleteDirectly && (
            <button
              onClick={handleComplete}
              disabled={isActioning}
              className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            </button>
          )}

          {/* Increment button (for COUNT tasks) */}
          {canIncrement && (
            <button
              onClick={handleIncrement}
              disabled={isActioning}
              className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 transition-colors disabled:opacity-50"
              title="+1"
            >
              {isActioning ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          )}

          {/* Complete button for IN_PROGRESS tasks */}
          {(canComplete || isTimerComplete) && !canIncrement && (
            <button
              onClick={handleComplete}
              disabled={isActioning}
              className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
