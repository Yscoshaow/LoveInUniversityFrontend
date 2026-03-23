import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
  ListChecks,
  Target,
  Timer,
  Loader2,
  XCircle
} from 'lucide-react';
import {
  UserOptionalTaskGroupDisplay,
  OptionalTaskItemDisplay,
  SelectedTaskDisplay,
  OptionalTaskGroupStatus,
  TaskType,
  TargetUnit
} from '../../types';

interface OptionalTaskGroupCardProps {
  group: UserOptionalTaskGroupDisplay;
  onSelect?: (groupId: number, selectedTaskIds: number[]) => Promise<void>;
  onTaskClick?: (taskId: number) => void;
}

// Get status color
const getStatusColor = (status: OptionalTaskGroupStatus): string => {
  switch (status) {
    case 'PENDING_SELECTION':
      return 'bg-amber-500';
    case 'IN_PROGRESS':
      return 'bg-primary';
    case 'COMPLETED':
      return 'bg-green-500';
    case 'FAILED':
      return 'bg-red-500';
    case 'EXPIRED':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
};

// Get status label
const getStatusLabel = (status: OptionalTaskGroupStatus): string => {
  switch (status) {
    case 'PENDING_SELECTION':
      return '待选择';
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
const getStatusIcon = (status: OptionalTaskGroupStatus) => {
  switch (status) {
    case 'PENDING_SELECTION':
      return <ListChecks size={14} />;
    case 'IN_PROGRESS':
      return <Clock size={14} />;
    case 'COMPLETED':
      return <CheckCircle size={14} />;
    case 'FAILED':
      return <XCircle size={14} />;
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
    default:
      return <Target size={12} />;
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

export const OptionalTaskGroupCard: React.FC<OptionalTaskGroupCardProps> = ({
  group,
  onSelect,
  onTaskClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const isPendingSelection = group.status === 'PENDING_SELECTION';
  const isInProgress = group.status === 'IN_PROGRESS';
  const hasSelectedTasks = group.selectedTasks && group.selectedTasks.length > 0;

  const toggleTaskSelection = (taskId: number) => {
    if (!isPendingSelection) return;

    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      }
      if (prev.length >= group.requiredCount) {
        // Replace the first selected task
        return [...prev.slice(1), taskId];
      }
      return [...prev, taskId];
    });
  };

  const handleSubmitSelection = async () => {
    if (!onSelect || selectedTaskIds.length !== group.requiredCount) return;

    setIsSubmitting(true);
    try {
      await onSelect(group.id, selectedTaskIds);
      setSelectedTaskIds([]);
    } catch (error) {
      console.error('Failed to select tasks:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTaskItem = (task: OptionalTaskItemDisplay) => {
    const isSelected = selectedTaskIds.includes(task.taskDefinitionId) || task.isSelected;
    const isDetailOpen = expandedTaskId === task.taskDefinitionId;

    return (
      <div
        key={task.taskDefinitionId}
        className={`
          rounded-xl border-2 transition-all overflow-hidden
          ${isSelected
            ? 'border-primary bg-primary/5'
            : 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
          }
        `}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Checkbox area — toggles selection */}
          {isPendingSelection && (
            <div
              onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.taskDefinitionId); }}
              className="cursor-pointer p-0.5"
            >
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                ${isSelected
                  ? 'border-primary bg-primary'
                  : 'border-slate-300 dark:border-slate-600'
                }
              `}>
                {isSelected && <CheckCircle size={12} className="text-white" />}
              </div>
            </div>
          )}

          {/* Task info area — expands detail */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => setExpandedTaskId(isDetailOpen ? null : task.taskDefinitionId)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {task.name}
              </span>
              <span className={`
                shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full
                bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400
              `}>
                {getTaskTypeIcon(task.taskType)}
                {formatTarget(task.targetValue, task.targetUnit)}
              </span>
            </div>
            {task.description && !isDetailOpen && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {task.description}
              </p>
            )}
          </div>

          <ChevronRight
            size={14}
            className={`shrink-0 text-slate-300 transition-transform ${isDetailOpen ? 'rotate-90' : ''}`}
          />
        </div>

        {/* Expanded detail area */}
        {isDetailOpen && (
          <div className="px-3 pb-3 pt-0 border-t border-slate-100/80 dark:border-slate-700/80 mt-0">
            <div className="pt-2.5 space-y-2">
              {task.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  {getTaskTypeIcon(task.taskType)}
                  {task.taskType === 'DURATION' ? '计时' : task.taskType === 'COUNT' ? '计数' : task.taskType === 'MANUAL' ? '手动' : task.taskType === 'LOCK' ? '锁定' : task.taskType}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  目标: {formatTarget(task.targetValue, task.targetUnit)}
                </span>
              </div>
              {/* Quick select button when not yet selected */}
              {isPendingSelection && !isSelected && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.taskDefinitionId); }}
                  className="w-full mt-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  选择此任务
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSelectedTask = (task: SelectedTaskDisplay) => {
    const progress = task.targetValue > 0
      ? Math.min(100, (task.currentValue / task.targetValue) * 100)
      : 0;

    return (
      <div
        key={task.taskDefinitionId}
        onClick={() => task.userTaskId && onTaskClick?.(task.userTaskId)}
        className={`
          p-3 rounded-xl border-2 transition-all
          ${task.userTaskId ? 'cursor-pointer hover:border-primary/30' : ''}
          ${task.isCompleted
            ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50'
            : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'
          }
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-5 h-5 rounded-full flex items-center justify-center
            ${task.isCompleted
              ? 'bg-green-500'
              : 'bg-slate-200 dark:bg-slate-700'
            }
          `}>
            {task.isCompleted
              ? <CheckCircle size={12} className="text-white" />
              : <span className="text-[10px] text-slate-500 dark:text-slate-400">{Math.round(progress)}%</span>
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${
                task.isCompleted ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'
              }`}>
                {task.name}
              </span>
              <span className={`
                flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full
                ${task.isCompleted
                  ? 'bg-green-100 text-green-600 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }
              `}>
                {task.currentValue}/{task.targetValue}
              </span>
            </div>

            {/* Progress bar */}
            {!task.isCompleted && (
              <div className="mt-1.5 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {task.userTaskId && (
            <ChevronRight size={16} className="text-slate-300" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`
                flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white
                ${getStatusColor(group.status)}
              `}>
                {getStatusIcon(group.status)}
                {getStatusLabel(group.status)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {group.courseName}
              </span>
            </div>

            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
              {group.groupName}
            </h3>

            {group.groupDescription && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {group.groupDescription}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Progress indicator */}
            <div className="text-right">
              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                {isInProgress || group.status === 'COMPLETED' || group.status === 'FAILED'
                  ? `${group.completedCount}/${group.requiredCount}`
                  : `选${group.requiredCount}`
                }
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                共{group.totalCount}个任务
              </div>
            </div>

            {isExpanded
              ? <ChevronUp size={20} className="text-slate-300" />
              : <ChevronDown size={20} className="text-slate-300" />
            }
          </div>
        </div>

      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            {/* Task selection mode */}
            {isPendingSelection && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  请选择 <span className="font-semibold text-primary">{group.requiredCount}</span> 个任务完成
                  （已选 {selectedTaskIds.length}/{group.requiredCount}）
                </p>
                <div className="space-y-2 mb-4">
                  {group.availableTasks.map(renderTaskItem)}
                </div>

                <button
                  onClick={handleSubmitSelection}
                  disabled={selectedTaskIds.length !== group.requiredCount || isSubmitting}
                  className={`
                    w-full py-2.5 rounded-xl font-semibold text-sm transition-all
                    flex items-center justify-center gap-2
                    ${selectedTaskIds.length === group.requiredCount
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      确认选择
                    </>
                  )}
                </button>
              </>
            )}

            {/* In progress / completed mode */}
            {hasSelectedTasks && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {isInProgress ? '完成以下选定任务:' : '选定的任务:'}
                </p>
                <div className="space-y-2">
                  {group.selectedTasks!.map(renderSelectedTask)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionalTaskGroupCard;
