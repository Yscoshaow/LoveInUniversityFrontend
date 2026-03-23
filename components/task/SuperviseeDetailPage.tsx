import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Settings,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  Timer,
  Target,
  Lock,
  Trash2,
  Edit2,
  MoreVertical,
  MessageSquare,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  Send,
} from 'lucide-react';
import {
  useSuperviseeTasksOverview,
  useSuperviseeTaskDefinitions,
  useDeleteTaskDefinition,
  useDispatchTask,
  useAddTaskNote,
  useMySupervisees,
  useUpdateHygieneBypassApproval,
  useReviewSupervisorTask,
} from '../../hooks';
import type { SupervisorTaskDetail, SupervisorTaskDefinition, TaskStatus, TaskType, TargetUnit, TaskRepeatType } from '../../types';

interface SuperviseeDetailPageProps {
  superviseeId: number;
  superviseeName: string;
  superviseeAvatar?: string;
  onBack: () => void;
  onCreateTask: (superviseeId: number) => void;
  onEditTaskDefinition?: (definition: SupervisorTaskDefinition) => void;
}

// Format date to YYYY-MM-DD using local timezone
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  MANUAL: '手动',
  DURATION: '时长',
  COUNT: '计数',
  LOCK: '锁定',
};

const TARGET_UNIT_LABELS: Record<TargetUnit, string> = {
  NONE: '',
  MINUTES: '分钟',
  HOURS: '小时',
  TIMES: '次',
  KILOMETERS: '公里',
  METERS: '米',
};

const REPEAT_TYPE_LABELS: Record<TaskRepeatType, string> = {
  ONCE: '单次',
  DAILY: '每天',
  WEEKLY: '每周',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  PENDING_REVIEW: '待审核',
  COMPLETED: '已完成',
  FAILED: '未完成',
  EXPIRED: '已过期',
};

const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'COMPLETED':
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950';
    case 'IN_PROGRESS':
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950';
    case 'PENDING_REVIEW':
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950';
    case 'PENDING':
      return 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900';
    case 'FAILED':
    case 'EXPIRED':
      return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950';
    default:
      return 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900';
  }
};

const getTaskTypeIcon = (type: TaskType) => {
  switch (type) {
    case 'DURATION':
      return <Timer size={14} />;
    case 'COUNT':
      return <Target size={14} />;
    case 'LOCK':
      return <Lock size={14} />;
    default:
      return <CheckCircle size={14} />;
  }
};

export const SuperviseeDetailPage: React.FC<SuperviseeDetailPageProps> = ({
  superviseeId,
  superviseeName,
  superviseeAvatar,
  onBack,
  onCreateTask,
  onEditTaskDefinition,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'tasks' | 'definitions'>('tasks');
  const [noteModalTask, setNoteModalTask] = useState<SupervisorTaskDetail | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [reviewingTaskId, setReviewingTaskId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const dateStr = formatDateKey(selectedDate);

  // Queries
  const tasksQuery = useSuperviseeTasksOverview(superviseeId, dateStr);
  const definitionsQuery = useSuperviseeTaskDefinitions(superviseeId);
  const superviseesQuery = useMySupervisees();

  // Find the agreement for this supervisee
  const agreement = superviseesQuery.data?.find(a => a.superviseeId === superviseeId);

  // Mutations
  const deleteDefinitionMutation = useDeleteTaskDefinition();
  const dispatchTaskMutation = useDispatchTask();
  const addNoteMutation = useAddTaskNote();
  const updateBypassMutation = useUpdateHygieneBypassApproval();
  const reviewTaskMutation = useReviewSupervisorTask();

  const overview = tasksQuery.data;
  const definitions = definitionsQuery.data ?? [];
  const isLoadingTasks = tasksQuery.isLoading;
  const isLoadingDefinitions = definitionsQuery.isLoading;

  // Calculate stats
  const stats = useMemo(() => {
    if (!overview) return null;
    return {
      total: overview.totalTasks,
      completed: overview.completedTasks,
      inProgress: overview.inProgressTasks,
      pending: overview.pendingTasks,
      failed: overview.failedTasks,
      completionRate: overview.totalTasks > 0
        ? Math.round((overview.completedTasks / overview.totalTasks) * 100)
        : 0,
    };
  }, [overview]);

  // Date navigation
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Handle delete definition
  const handleDeleteDefinition = async (definitionId: number) => {
    try {
      await deleteDefinitionMutation.mutateAsync(definitionId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete definition:', error);
    }
  };

  // Handle toggle hygiene bypass approval
  const handleToggleHygieneBypass = async () => {
    if (!agreement) return;
    try {
      await updateBypassMutation.mutateAsync({
        agreementId: agreement.id,
        bypass: !agreement.hygieneBypassApproval,
      });
    } catch (error) {
      console.error('Failed to toggle hygiene bypass:', error);
    }
  };

  // Handle add note
  const handleAddNote = async () => {
    if (!noteModalTask || !noteText.trim()) return;
    try {
      await addNoteMutation.mutateAsync({ taskId: noteModalTask.id, note: noteText });
      setNoteModalTask(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  // Handle review (approve/reject)
  const handleApproveTask = async (taskId: number) => {
    try {
      await reviewTaskMutation.mutateAsync({
        superviseeId,
        taskId,
        approved: true,
      });
    } catch (error) {
      console.error('Failed to approve task:', error);
    }
  };

  const handleRejectTask = async (taskId: number) => {
    try {
      await reviewTaskMutation.mutateAsync({
        superviseeId,
        taskId,
        approved: false,
        rejectionReason: rejectReason.trim() || undefined,
      });
      setReviewingTaskId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject task:', error);
    }
  };

  const isToday = formatDateKey(selectedDate) === formatDateKey(new Date());

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1">
            <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            {superviseeAvatar ? (
              <img
                src={superviseeAvatar}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-800"
                alt={superviseeName}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                {superviseeName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{superviseeName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">被监督者详情</p>
            </div>
          </div>
          <button
            onClick={() => onCreateTask(superviseeId)}
            className="p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Hygiene Bypass Toggle */}
      {agreement && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500 dark:text-emerald-400" />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">卫生开启免同意</span>
                <p className="text-xs text-slate-400 dark:text-slate-500">开启后对方卫生解锁无需你审批</p>
              </div>
            </div>
            <button
              onClick={handleToggleHygieneBypass}
              disabled={updateBypassMutation.isPending}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                agreement.hygieneBypassApproval ? 'bg-emerald-500' : 'bg-slate-300'
              } ${updateBypassMutation.isPending ? 'opacity-50' : ''}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${
                agreement.hygieneBypassApproval ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4">
        <div className="flex">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tasks'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <ListTodo size={16} className="inline mr-1" />
            今日任务
          </button>
          <button
            onClick={() => setActiveTab('definitions')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'definitions'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Settings size={16} className="inline mr-1" />
            任务模板
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' ? (
          <>
            {/* Date Navigation */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <button onClick={handlePrevDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                    {isToday && <span className="ml-1 text-indigo-500 dark:text-indigo-400">(今天)</span>}
                  </span>
                  {!isToday && (
                    <button
                      onClick={handleToday}
                      className="ml-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                    >
                      回到今天
                    </button>
                  )}
                </div>
                <button onClick={handleNextDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            {stats && (
              <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{stats.total}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">总任务</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">已完成</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400">进行中</div>
                  </div>
                  <div className="text-center p-2 bg-rose-50 dark:bg-rose-950 rounded-lg">
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{stats.failed}</div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400">未完成</div>
                  </div>
                </div>
                {stats.total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">完成进度</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">{stats.completionRate}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tasks List */}
            <div className="p-4 space-y-3">
              {isLoadingTasks ? (
                <div className="p-8 flex justify-center">
                  <Loader2 size={24} className="text-slate-300 animate-spin" />
                </div>
              ) : overview?.tasks && overview.tasks.length > 0 ? (
                overview.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600 dark:text-blue-400' :
                        task.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
                        task.status === 'FAILED' || task.status === 'EXPIRED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {task.iconUrl ? (
                          <img src={task.iconUrl} className="w-6 h-6" alt="" />
                        ) : (
                          getTaskTypeIcon(task.taskType)
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {task.taskName}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(task.status)}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>

                        {task.taskDescription && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                            {task.taskDescription}
                          </p>
                        )}

                        {/* Progress */}
                        {(task.taskType === 'COUNT' || task.taskType === 'DURATION' || task.taskType === 'LOCK') && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500 dark:text-slate-400">
                                {task.actualValue} / {task.targetValue} {TARGET_UNIT_LABELS[task.targetUnit]}
                              </span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">{task.progressPercent}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  task.status === 'COMPLETED' ? 'bg-emerald-500' :
                                  task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                  task.status === 'PENDING_REVIEW' ? 'bg-amber-500' : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(task.progressPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Time info */}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                          {task.startedAt && (
                            <span className="flex items-center gap-1">
                              <Play size={10} />
                              {new Date(task.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {task.completedAt && (
                            <span className="flex items-center gap-1">
                              <CheckCircle size={10} />
                              {new Date(task.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {task.dueAt && task.status !== 'COMPLETED' && (
                            <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                              <Clock size={10} />
                              截止 {new Date(task.dueAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Supervisor note */}
                        {task.supervisorNote && (
                          <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg text-xs text-indigo-700 dark:text-indigo-400">
                            <MessageSquare size={10} className="inline mr-1" />
                            {task.supervisorNote}
                          </div>
                        )}

                        {/* Proof display */}
                        {(task.proofImageUrl || task.proofText) && (
                          <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-950 rounded-lg">
                            <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 mb-1.5">
                              <Camera size={10} />
                              <span className="font-medium">任务证明</span>
                              {task.proofSubmittedAt && (
                                <span className="ml-auto text-teal-500 dark:text-teal-400">
                                  {new Date(task.proofSubmittedAt).toLocaleString('zh-CN', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                            {task.proofImageUrl && (
                              <img
                                src={task.proofImageUrl}
                                alt="任务证明"
                                className="w-full rounded-lg mb-1.5 cursor-pointer"
                                onClick={() => window.open(task.proofImageUrl!, '_blank')}
                              />
                            )}
                            {task.proofText && (
                              <p className="text-xs text-teal-600 dark:text-teal-400">{task.proofText}</p>
                            )}
                          </div>
                        )}

                        {/* Rejection reason display */}
                        {task.rejectionReason && task.status === 'IN_PROGRESS' && (
                          <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950 rounded-lg">
                            <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 mb-0.5">
                              <AlertTriangle size={10} />
                              <span className="font-medium">上次打回原因</span>
                            </div>
                            <p className="text-xs text-rose-600 dark:text-rose-400">{task.rejectionReason}</p>
                          </div>
                        )}

                        {/* Review buttons for PENDING_REVIEW tasks */}
                        {task.status === 'PENDING_REVIEW' && (
                          <div className="mt-3">
                            {reviewingTaskId === task.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="打回原因（可选）"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRejectTask(task.id)}
                                    disabled={reviewTaskMutation.isPending}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    确认打回
                                  </button>
                                  <button
                                    onClick={() => { setReviewingTaskId(null); setRejectReason(''); }}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveTask(task.id)}
                                  disabled={reviewTaskMutation.isPending}
                                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle size={12} className="inline mr-1" />
                                  通过
                                </button>
                                <button
                                  onClick={() => setReviewingTaskId(task.id)}
                                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                                >
                                  <AlertTriangle size={12} className="inline mr-1" />
                                  打回
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => {
                          setNoteModalTask(task);
                          setNoteText(task.supervisorNote || '');
                        }}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-950 rounded-lg transition-colors"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  该日期暂无任务
                </div>
              )}
            </div>
          </>
        ) : (
          /* Task Definitions Tab */
          <div className="p-4 space-y-3">
            {isLoadingDefinitions ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 animate-spin" />
              </div>
            ) : definitions.length > 0 ? (
              definitions.map((def) => (
                <div
                  key={def.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      def.isActive ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}>
                      {def.iconUrl ? (
                        <img src={def.iconUrl} className="w-6 h-6" alt="" />
                      ) : (
                        getTaskTypeIcon(def.taskType)
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${def.isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                          {def.name}
                        </span>
                        {!def.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            已停用
                          </span>
                        )}
                      </div>

                      {def.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                          {def.description}
                        </p>
                      )}

                      {/* Task info badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {TASK_TYPE_LABELS[def.taskType]}
                        </span>
                        {def.targetValue > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            目标: {def.targetValue} {TARGET_UNIT_LABELS[def.targetUnit]}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          def.repeatType === 'DAILY' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
                          def.repeatType === 'WEEKLY' ? 'bg-blue-100 text-blue-600 dark:text-blue-400' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {REPEAT_TYPE_LABELS[def.repeatType]}
                          {def.repeatType === 'WEEKLY' && def.repeatDays && ` (${def.repeatDays})`}
                        </span>
                        {def.timeoutMinutes > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:text-amber-400">
                            限时 {def.timeoutMinutes} 分钟
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => dispatchTaskMutation.mutate(def.id)}
                        disabled={dispatchTaskMutation.isPending}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition-colors disabled:opacity-50"
                        title="下发任务"
                      >
                        <Send size={16} />
                      </button>
                      {onEditTaskDefinition && (
                        <button
                          onClick={() => onEditTaskDefinition(def)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-950 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(def.id)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <div className="text-slate-300 mb-2">
                  <Settings size={40} className="mx-auto" />
                </div>
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">暂无任务模板</p>
                <button
                  onClick={() => onCreateTask(superviseeId)}
                  className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  <Plus size={16} className="inline mr-1" />
                  创建任务
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {noteModalTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">添加备注</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{noteModalTask.taskName}</p>
            </div>
            <div className="p-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="输入备注内容..."
                className="w-full h-24 p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
              <button
                onClick={() => setNoteModalTask(null)}
                className="flex-1 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                disabled={addNoteMutation.isPending}
                className="flex-1 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {addNoteMutation.isPending ? (
                  <Loader2 size={16} className="inline animate-spin" />
                ) : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} className="text-rose-500 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">删除任务模板</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                删除后无法恢复，确定要删除吗？
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteDefinition(showDeleteConfirm)}
                disabled={deleteDefinitionMutation.isPending}
                className="flex-1 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {deleteDefinitionMutation.isPending ? (
                  <Loader2 size={16} className="inline animate-spin" />
                ) : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
