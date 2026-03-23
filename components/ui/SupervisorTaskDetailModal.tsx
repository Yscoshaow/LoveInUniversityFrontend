import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Target,
  CheckCircle,
  AlertCircle,
  Play,
  Calendar,
  Timer,
  Loader2,
  Plus,
  Lock,
  Shield,
  User,
  Camera,
  ImageIcon,
  FileText,
  Upload,
} from 'lucide-react';
import type { SupervisorTaskDetail, TaskStatus, TargetUnit, TaskType } from '../../types';
import { supervisionApi } from '../../lib/api';
import { ImageLightbox } from './ImageLightbox';
import { toast } from 'sonner';

interface SupervisorTaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: SupervisorTaskDetail;
  onStart?: (task: SupervisorTaskDetail) => Promise<void>;
  onComplete?: (task: SupervisorTaskDetail, actualValue?: number) => Promise<void>;
  onIncrement?: (task: SupervisorTaskDetail) => Promise<void>;
  onSubmitProof?: (task: SupervisorTaskDetail, proofImageKey?: string, proofText?: string) => Promise<void>;
  onReview?: (task: SupervisorTaskDetail, approved: boolean, rejectionReason?: string) => Promise<void>;
  isSupervisorView?: boolean; // 是否为监督者视角（只读查看证明）
}

// Get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'PENDING':
      return 'from-slate-500 to-slate-600';
    case 'IN_PROGRESS':
      return 'from-indigo-500 to-indigo-600';
    case 'COMPLETED':
      return 'from-emerald-500 to-emerald-600';
    case 'FAILED':
      return 'from-rose-500 to-rose-600';
    case 'PENDING_REVIEW':
      return 'from-amber-500 to-amber-600';
    case 'EXPIRED':
      return 'from-orange-500 to-orange-600';
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
    case 'PENDING_REVIEW':
      return '待审核';
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

// Get task type label
const getTaskTypeLabel = (taskType: TaskType): string => {
  switch (taskType) {
    case 'DURATION':
      return '计时任务';
    case 'COUNT':
      return '次数任务';
    case 'LOCK':
      return '锁任务';
    case 'MANUAL':
      return '手动确认';
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
    case 'LOCK':
      return Lock;
    case 'MANUAL':
      return CheckCircle;
    default:
      return Target;
  }
};

// Format unit
const formatUnit = (value: number, unit: TargetUnit): string => {
  switch (unit) {
    case 'KILOMETERS':
      return `${value} 公里`;
    case 'METERS':
      return `${value} 米`;
    case 'MINUTES':
      return `${value} 分钟`;
    case 'HOURS':
      return `${value} 小时`;
    case 'TIMES':
      return `${value} 次`;
    case 'NONE':
    default:
      return value > 0 ? `${value}` : '';
  }
};

// Format time from seconds
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const SupervisorTaskDetailModal: React.FC<SupervisorTaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  onStart,
  onComplete,
  onIncrement,
  onSubmitProof,
  onReview,
  isSupervisorView = false,
}) => {
  const [isActioning, setIsActioning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(task.remainingSeconds ?? null);

  // 证明上传相关状态
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofText, setProofText] = useState('');
  const [proofImageKey, setProofImageKey] = useState<string | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [showProofLightbox, setShowProofLightbox] = useState(false);
  // 审核相关状态
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (!isOpen) return null;

  const progress = task.targetValue > 0 ? (task.actualValue / task.targetValue) * 100 : 0;
  const progressCapped = Math.min(progress, 100);

  const canStart = task.status === 'PENDING' && task.taskType !== 'MANUAL' && task.taskType !== 'LOCK' && onStart;
  const canCompleteDirectly = task.status === 'PENDING' && task.taskType === 'MANUAL' && onComplete;
  const canComplete = task.status === 'IN_PROGRESS' && task.taskType !== 'LOCK' && onComplete;
  const canIncrement = task.status === 'IN_PROGRESS' && task.taskType === 'COUNT' && onIncrement;
  const isTimerComplete = task.taskType === 'DURATION' &&
    task.status === 'IN_PROGRESS' &&
    remainingSeconds !== null &&
    remainingSeconds <= 0;

  const StatusIcon = task.status === 'COMPLETED' ? CheckCircle :
                     task.status === 'IN_PROGRESS' ? Play :
                     task.status === 'PENDING_REVIEW' ? Clock :
                     task.status === 'FAILED' || task.status === 'EXPIRED' ? AlertCircle :
                     Clock;
  const TaskTypeIcon = getTaskTypeIcon(task.taskType);

  const handleStart = async () => {
    if (isActioning || !onStart) return;
    setIsActioning(true);
    try {
      await onStart(task);
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async () => {
    if (isActioning || !onComplete) return;
    setIsActioning(true);
    try {
      await onComplete(task);
    } finally {
      setIsActioning(false);
    }
  };

  const handleIncrement = async () => {
    if (isActioning || !onIncrement) return;
    setIsActioning(true);
    try {
      await onIncrement(task);
    } finally {
      setIsActioning(false);
    }
  };

  // 处理证明图片上传
  const handleProofImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.warning('请选择图片文件');
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('图片大小不能超过 5MB');
      return;
    }

    setIsUploadingProof(true);
    try {
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setProofImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // 上传文件
      const result = await supervisionApi.uploadProofImage(file);
      setProofImageKey(result.objectKey);
    } catch (error) {
      console.error('Failed to upload proof image:', error);
      toast.error('上传图片失败，请重试');
      setProofImagePreview(null);
    } finally {
      setIsUploadingProof(false);
    }
  };

  // 提交证明
  const handleSubmitProof = async () => {
    if (isActioning || !onSubmitProof) return;
    if (!proofImageKey && !proofText.trim()) {
      toast.warning('请提供图片或文字证明');
      return;
    }

    setIsActioning(true);
    try {
      await onSubmitProof(task, proofImageKey || undefined, proofText.trim() || undefined);
      setShowProofUpload(false);
      setProofImageKey(null);
      setProofImagePreview(null);
      setProofText('');
    } finally {
      setIsActioning(false);
    }
  };

  // 可以提交证明的条件：进行中、待审核或已完成的任务（非监督者视角）
  const canSubmitProof = !isSupervisorView &&
    onSubmitProof &&
    (task.status === 'IN_PROGRESS' || task.status === 'PENDING_REVIEW' || task.status === 'COMPLETED');

  // 监督者可以审核待审核的任务
  const canReview = isSupervisorView && onReview && task.status === 'PENDING_REVIEW';

  // 审核处理
  const handleApprove = async () => {
    if (isActioning || !onReview) return;
    setIsActioning(true);
    try {
      await onReview(task, true);
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (isActioning || !onReview) return;
    setIsActioning(true);
    try {
      await onReview(task, false, rejectionReasonInput.trim() || undefined);
      setShowRejectModal(false);
      setRejectionReasonInput('');
    } finally {
      setIsActioning(false);
    }
  };

  // 是否有已提交的证明
  const hasProof = task.proofImageUrl || task.proofText;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center lg:justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className={`bg-gradient-to-br ${getStatusColor(task.status)} p-6 pb-12 relative`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center text-white"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
            <Shield size={14} />
            <span>来自 {task.supervisorName} 的任务</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">{task.taskName}</h2>

          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 bg-white/20 dark:bg-slate-800/20 px-2 py-0.5 rounded-full text-white">
              <StatusIcon size={14} />
              {getStatusLabel(task.status)}
            </span>
            <span className="flex items-center gap-1 bg-white/20 dark:bg-slate-800/20 px-2 py-0.5 rounded-full text-white">
              <TaskTypeIcon size={14} />
              {getTaskTypeLabel(task.taskType)}
            </span>
          </div>
        </div>

        {/* Stats card overlapping header */}
        {task.taskType !== 'MANUAL' && (
          <div className="px-4 -mt-8 relative z-10">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">任务进度</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(progressCapped)}%</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-indigo-500' : 'bg-slate-300'
                  }`}
                  style={{ width: `${progressCapped}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">当前</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {formatUnit(task.actualValue, task.targetUnit)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">目标</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {formatUnit(task.targetValue, task.targetUnit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Timer display for duration tasks */}
          {task.taskType === 'DURATION' && task.status === 'IN_PROGRESS' && remainingSeconds !== null && (
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-2xl p-4 text-center">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 mb-1">剩余时间</div>
              <div className={`text-3xl font-mono font-bold ${
                remainingSeconds <= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                {remainingSeconds <= 0 ? '完成!' : formatTime(remainingSeconds)}
              </div>
            </div>
          )}

          {/* Task description */}
          {task.taskDescription && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">任务说明</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{task.taskDescription}</p>
            </div>
          )}

          {/* Supervisor note */}
          {task.supervisorNote && (
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <User size={14} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">监督者备注</h3>
              </div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">{task.supervisorNote}</p>
            </div>
          )}

          {/* Rejection reason (shown when task was rejected and sent back) */}
          {task.rejectionReason && (
            <div className="bg-rose-50 dark:bg-rose-950 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-rose-500 dark:text-rose-400" />
                <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">打回原因</h3>
              </div>
              <p className="text-sm text-rose-600 dark:text-rose-400">{task.rejectionReason}</p>
            </div>
          )}

          {/* Pending review notice (supervisee view) */}
          {!isSupervisorView && task.status === 'PENDING_REVIEW' && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 text-center">
              <Clock size={20} className="text-amber-500 dark:text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">等待监督者审核</p>
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">监督者确认后任务才算完成</p>
            </div>
          )}

          {/* Time info */}
          <div className="grid grid-cols-2 gap-3">
            {task.createdAt && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs mb-1">
                  <Calendar size={12} />
                  创建时间
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {new Date(task.createdAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
            {task.dueAt && (
              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-3">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 text-xs mb-1">
                  <Clock size={12} />
                  截止时间
                </div>
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {new Date(task.dueAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
            {task.startedAt && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-3">
                <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 text-xs mb-1">
                  <Play size={12} />
                  开始时间
                </div>
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  {new Date(task.startedAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
            {task.completedAt && (
              <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-3">
                <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400 text-xs mb-1">
                  <CheckCircle size={12} />
                  完成时间
                </div>
                <div className="text-sm font-medium text-emerald-700">
                  {new Date(task.completedAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
          </div>

          {/* LOCK task note */}
          {task.taskType === 'LOCK' && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">系统自动判定</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">此任务由系统根据今日锁定时长自动判定</p>
            </div>
          )}

          {/* 已提交的证明展示 */}
          {hasProof && (
            <div className="bg-teal-50 dark:bg-teal-950 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera size={14} className="text-teal-500 dark:text-teal-400" />
                <h3 className="text-sm font-semibold text-teal-700">任务证明</h3>
                {task.proofSubmittedAt && (
                  <span className="text-[10px] text-teal-500 dark:text-teal-400 ml-auto">
                    {new Date(task.proofSubmittedAt).toLocaleString('zh-CN', {
                      month: 'short',
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
                  className="w-full rounded-xl mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowProofLightbox(true)}
                />
              )}
              {task.proofText && (
                <p className="text-sm text-teal-600 dark:text-teal-400">{task.proofText}</p>
              )}
            </div>
          )}

          {/* 证明上传区域（被监督者视角） */}
          {canSubmitProof && !hasProof && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Camera size={14} className="text-slate-500 dark:text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">上传任务证明</h3>
                </div>
                {!showProofUpload && (
                  <button
                    onClick={() => setShowProofUpload(true)}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400"
                  >
                    添加证明
                  </button>
                )}
              </div>

              {showProofUpload && (
                <div className="space-y-3">
                  {/* 图片上传 */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProofImageSelect}
                      className="hidden"
                    />
                    {proofImagePreview ? (
                      <div className="relative">
                        <img
                          src={proofImagePreview}
                          alt="证明预览"
                          className="w-full rounded-xl"
                        />
                        <button
                          onClick={() => {
                            setProofImagePreview(null);
                            setProofImageKey(null);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingProof}
                        className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-500 dark:text-indigo-400 transition-colors flex flex-col items-center gap-2"
                      >
                        {isUploadingProof ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          <>
                            <ImageIcon size={24} />
                            <span className="text-sm">点击上传图片</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* 文字说明 */}
                  <div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <FileText size={12} />
                      <span>文字说明（可选）</span>
                    </div>
                    <textarea
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder="描述你完成任务的情况..."
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowProofUpload(false);
                        setProofImagePreview(null);
                        setProofImageKey(null);
                        setProofText('');
                      }}
                      className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-300"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitProof}
                      disabled={isActioning || (!proofImageKey && !proofText.trim())}
                      className="flex-1 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isActioning ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Upload size={14} />
                          提交证明
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          {/* Start button */}
          {canStart && (
            <button
              onClick={handleStart}
              disabled={isActioning}
              className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActioning ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Play size={18} />
                  开始任务
                </>
              )}
            </button>
          )}

          {/* Direct complete for MANUAL tasks */}
          {canCompleteDirectly && (
            <button
              onClick={handleComplete}
              disabled={isActioning}
              className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActioning ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} />
                  完成任务
                </>
              )}
            </button>
          )}

          {/* Increment button for COUNT tasks */}
          {canIncrement && (
            <div className="flex gap-3">
              <button
                onClick={handleIncrement}
                disabled={isActioning}
                className="flex-1 py-3 bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActioning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={18} />
                    +1 次
                  </>
                )}
              </button>
              {task.actualValue >= task.targetValue && (
                <button
                  onClick={handleComplete}
                  disabled={isActioning}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isActioning ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      完成
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Complete button for IN_PROGRESS tasks (non-COUNT) */}
          {(canComplete || isTimerComplete) && task.taskType !== 'COUNT' && (
            <button
              onClick={handleComplete}
              disabled={isActioning}
              className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActioning ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} />
                  完成任务
                </>
              )}
            </button>
          )}

          {/* Review buttons (supervisor view, PENDING_REVIEW status) */}
          {canReview && !showRejectModal && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isActioning}
                className="flex-1 py-3 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-xl font-medium hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <AlertCircle size={18} />
                打回
              </button>
              <button
                onClick={handleApprove}
                disabled={isActioning}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActioning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={18} />
                    通过
                  </>
                )}
              </button>
            </div>
          )}

          {/* Reject modal (inline) */}
          {canReview && showRejectModal && (
            <div className="bg-rose-50 dark:bg-rose-950 rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">打回任务</h4>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="请输入打回原因（可选）..."
                className="w-full px-3 py-2 border border-rose-200 dark:border-rose-800 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white dark:bg-slate-800"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReasonInput('');
                  }}
                  className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  取消
                </button>
                <button
                  onClick={handleReject}
                  disabled={isActioning}
                  className="flex-1 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isActioning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    '确认打回'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>

      {/* Proof Image Lightbox */}
      {showProofLightbox && task.proofImageUrl && (
        <ImageLightbox
          images={[{ imageUrl: task.proofImageUrl }]}
          onClose={() => setShowProofLightbox(false)}
        />
      )}
    </div>
  );
};
