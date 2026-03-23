import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Target,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Timer,
  Loader2,
  Plus,
  Lock,
  Dice5,
  Camera,
  FileText,
  Upload,
  SkipForward,
} from 'lucide-react';
import type { RouletteTaskInstance } from '../../types';
import { rouletteApi } from '../../lib/api';
import { toast } from 'sonner';

interface RouletteTaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: RouletteTaskInstance;
  onRefresh: () => void;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'PENDING': return 'from-slate-500 to-slate-600';
    case 'IN_PROGRESS': return 'from-indigo-500 to-indigo-600';
    case 'COMPLETED': return 'from-emerald-500 to-emerald-600';
    case 'FAILED': return 'from-rose-500 to-rose-600';
    case 'SKIPPED': return 'from-amber-500 to-amber-600';
    default: return 'from-slate-400 to-slate-500';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'PENDING': return '待开始';
    case 'IN_PROGRESS': return '进行中';
    case 'COMPLETED': return '已完成';
    case 'FAILED': return '未完成';
    case 'SKIPPED': return '已跳过';
    default: return status;
  }
};

const getTaskTypeLabel = (taskType: string): string => {
  switch (taskType) {
    case 'DURATION': return '计时任务';
    case 'COUNT': return '次数任务';
    case 'LOCK': return '锁任务';
    case 'MANUAL': return '手动确认';
    default: return taskType;
  }
};

const getTaskTypeIcon = (taskType: string) => {
  switch (taskType) {
    case 'DURATION': return Timer;
    case 'COUNT': return Target;
    case 'LOCK': return Lock;
    default: return CheckCircle;
  }
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const RouletteTaskDetailModal: React.FC<RouletteTaskDetailModalProps> = ({
  isOpen,
  onClose,
  instance,
  onRefresh,
}) => {
  const [isActioning, setIsActioning] = useState(false);
  const [proofText, setProofText] = useState('');
  const [proofImageKey, setProofImageKey] = useState<string | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DURATION timer state
  const taskType = instance.taskType || 'MANUAL';
  const hasTarget = !!instance.targetValue;
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

  // Reset state when instance changes
  useEffect(() => {
    if (taskType === 'DURATION') setElapsed(instance.currentValue || 0);
  }, [instance.id, instance.currentValue]);

  if (!isOpen) return null;

  const isActive = instance.status === 'PENDING' || instance.status === 'IN_PROGRESS';
  const progress = taskType === 'COUNT' && hasTarget
    ? Math.min(100, ((instance.currentValue || 0) / (instance.targetValue || 1)) * 100)
    : 0;
  const durationProgress = targetSeconds > 0 ? Math.min(100, (elapsed / targetSeconds) * 100) : 0;
  const isTimerComplete = taskType === 'DURATION' && elapsed >= targetSeconds && targetSeconds > 0;

  const StatusIcon = instance.status === 'COMPLETED' ? CheckCircle :
                     instance.status === 'IN_PROGRESS' ? Play :
                     instance.status === 'FAILED' ? AlertCircle :
                     Clock;
  const TaskTypeIcon = getTaskTypeIcon(taskType);

  const handleStart = async () => {
    if (isActioning) return;
    setIsActioning(true);
    try {
      await rouletteApi.startTaskInstance(instance.id);
      onRefresh();
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async (success: boolean) => {
    if (isActioning) return;
    if (timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsActioning(true);
    try {
      await rouletteApi.completeTaskInstance(instance.id, { success });
      onRefresh();
    } finally {
      setIsActioning(false);
    }
  };

  const handleSkip = async () => {
    if (isActioning) return;
    if (timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsActioning(true);
    try {
      await rouletteApi.skipTaskInstance(instance.id);
      onRefresh();
    } finally {
      setIsActioning(false);
    }
  };

  const handleIncrement = async (amount: number = 1) => {
    if (isActioning) return;
    setIsActioning(true);
    try {
      if (instance.status === 'PENDING') {
        await rouletteApi.startTaskInstance(instance.id);
      }
      const newVal = (instance.currentValue || 0) + amount;
      await rouletteApi.updateTaskProgress(instance.id, { currentValue: newVal });
      onRefresh();
    } finally {
      setIsActioning(false);
    }
  };

  const handleTimerToggle = async () => {
    if (timerRunning) {
      setTimerRunning(false);
      setIsActioning(true);
      try {
        await rouletteApi.updateTaskProgress(instance.id, { currentValue: elapsedRef.current });
        onRefresh();
      } finally {
        setIsActioning(false);
      }
    } else {
      if (instance.status === 'PENDING') {
        setIsActioning(true);
        try {
          await rouletteApi.startTaskInstance(instance.id);
        } finally {
          setIsActioning(false);
        }
      }
      setTimerRunning(true);
    }
  };

  const handleProofImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warning('请选择图片文件'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.warning('图片大小不能超过 5MB'); return; }

    setIsUploadingProof(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setProofImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      const result = await rouletteApi.uploadImage(file);
      setProofImageKey(result.imageUrl);
    } catch (error) {
      console.error('Failed to upload proof image:', error);
      toast.error('上传图片失败，请重试');
      setProofImagePreview(null);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleSubmitProof = async () => {
    if (isActioning) return;
    if (!proofImageKey && !proofText.trim()) { toast.warning('请提供图片或文字证明'); return; }

    setIsActioning(true);
    try {
      await rouletteApi.submitTaskProof(instance.id, {
        proofImageKey: proofImageKey || undefined,
        proofText: proofText.trim() || undefined,
      });
      setShowProofUpload(false);
      setProofImageKey(null);
      setProofImagePreview(null);
      setProofText('');
      onRefresh();
    } finally {
      setIsActioning(false);
    }
  };

  const canSubmitProof = instance.status === 'IN_PROGRESS' || instance.status === 'COMPLETED';
  const hasProof = instance.proofImageKey || instance.proofText;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 dark:bg-slate-800/20 text-white flex items-center justify-center hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Gradient header */}
        <div className={`bg-gradient-to-r ${getStatusColor(instance.status)} p-6 pt-8 rounded-t-3xl`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 dark:bg-slate-800/20 flex items-center justify-center">
              <Dice5 size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{instance.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusIcon size={14} className="text-white/80" />
                <span className="text-sm text-white/80">{getStatusLabel(instance.status)}</span>
                <span className="text-sm text-white/60">·</span>
                <TaskTypeIcon size={14} className="text-white/80" />
                <span className="text-sm text-white/80">{getTaskTypeLabel(taskType)}</span>
              </div>
            </div>
          </div>

          {instance.gameTitle && (
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              <Dice5 size={14} />
              <span>{instance.gameTitle}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Description */}
          {instance.description && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">任务描述</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{instance.description}</p>
            </div>
          )}

          {/* Progress card for non-MANUAL tasks */}
          {taskType !== 'MANUAL' && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <h4 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">进度</h4>

              {/* COUNT progress */}
              {taskType === 'COUNT' && hasTarget && (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-300">
                      {instance.currentValue || 0} / {instance.targetValue} {instance.targetUnit || ''}
                    </span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        instance.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              )}

              {/* DURATION timer */}
              {taskType === 'DURATION' && targetSeconds > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-300 font-mono">
                      {formatTime(elapsed)} / {formatTime(targetSeconds)}
                    </span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{Math.round(durationProgress)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isTimerComplete ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${durationProgress}%` }}
                    />
                  </div>

                  {/* Live countdown */}
                  {isActive && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <Timer size={24} className="text-indigo-500 dark:text-indigo-400" />
                      <span className={`text-3xl font-mono font-bold ${
                        isTimerComplete ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {isTimerComplete ? '完成!' : formatTime(Math.max(0, targetSeconds - elapsed))}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* LOCK progress */}
              {taskType === 'LOCK' && hasTarget && (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <Lock size={14} className="text-indigo-500 dark:text-indigo-400" />
                      锁定时长
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {instance.currentValue || 0} / {instance.targetValue} {instance.targetUnit || ''}
                    </span>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    此任务由系统根据今日锁定时长自动判定
                  </div>
                </>
              )}
            </div>
          )}

          {/* Proof section */}
          {hasProof && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">已提交证明</h4>
              <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-3 space-y-2">
                {instance.proofText && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{instance.proofText}</p>
                )}
                {instance.proofImageKey && (
                  <img
                    src={instance.proofImageKey}
                    alt="证明图片"
                    className="w-full rounded-lg max-h-48 object-cover cursor-pointer"
                  />
                )}
              </div>
            </div>
          )}

          {/* Proof upload section */}
          {canSubmitProof && !hasProof && (
            <div>
              {!showProofUpload ? (
                <button
                  onClick={() => setShowProofUpload(true)}
                  className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-500 dark:text-indigo-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  提交证明
                </button>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">提交任务证明</h4>

                  {/* Image upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 transition-colors"
                  >
                    {proofImagePreview ? (
                      <img src={proofImagePreview} alt="预览" className="max-h-32 mx-auto rounded-lg" />
                    ) : isUploadingProof ? (
                      <Loader2 size={24} className="mx-auto text-slate-400 dark:text-slate-500 animate-spin" />
                    ) : (
                      <div className="text-slate-400 dark:text-slate-500">
                        <Upload size={24} className="mx-auto mb-1" />
                        <span className="text-xs">点击上传图片</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProofImageSelect}
                    className="hidden"
                  />

                  {/* Text proof */}
                  <textarea
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    placeholder="添加文字说明（可选）"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowProofUpload(false);
                        setProofImageKey(null);
                        setProofImagePreview(null);
                        setProofText('');
                      }}
                      className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-xl hover:bg-slate-300 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitProof}
                      disabled={isActioning || isUploadingProof || (!proofImageKey && !proofText.trim())}
                      className="flex-1 py-2 text-sm text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isActioning ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      提交
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[11px] text-slate-400 dark:text-slate-500 space-y-1">
            <div>创建于 {new Date(instance.createdAt).toLocaleString('zh-CN')}</div>
            {instance.startedAt && (
              <div>开始于 {new Date(instance.startedAt).toLocaleString('zh-CN')}</div>
            )}
            {instance.completedAt && (
              <div>完成于 {new Date(instance.completedAt).toLocaleString('zh-CN')}</div>
            )}
          </div>
        </div>

        {/* Action buttons at bottom */}
        {isActive && (
          <div className="sticky bottom-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 space-y-2">
            {/* MANUAL: complete directly */}
            {taskType === 'MANUAL' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={isActioning}
                  className="flex-1 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <X size={16} /> 放弃
                </button>
                <button
                  onClick={() => handleComplete(true)}
                  disabled={isActioning}
                  className="flex-1 py-3 text-sm font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  完成任务
                </button>
              </div>
            )}

            {/* DURATION: timer controls */}
            {taskType === 'DURATION' && !isTimerComplete && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={isActioning}
                  className="py-3 px-4 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSkip}
                  disabled={isActioning}
                  className="py-3 px-4 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <SkipForward size={16} /> 跳过
                </button>
                <button
                  onClick={handleTimerToggle}
                  disabled={isActioning}
                  className={`flex-1 py-3 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    timerRunning
                      ? 'text-amber-700 dark:text-amber-400 bg-amber-100 hover:bg-amber-200'
                      : 'text-white bg-indigo-500 hover:bg-indigo-600'
                  }`}
                >
                  {isActioning ? <Loader2 size={16} className="animate-spin" /> :
                    timerRunning ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> {elapsed > 0 ? '继续计时' : '开始计时'}</>}
                </button>
              </div>
            )}

            {/* DURATION: timer complete */}
            {taskType === 'DURATION' && isTimerComplete && (
              <button
                onClick={() => handleComplete(true)}
                disabled={isActioning}
                className="w-full py-3 text-sm font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                完成任务
              </button>
            )}

            {/* COUNT: increment + complete */}
            {taskType === 'COUNT' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={isActioning}
                  className="py-3 px-4 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={() => handleIncrement(1)}
                  disabled={isActioning}
                  className="flex-1 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 rounded-xl hover:bg-indigo-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isActioning ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  +1
                </button>
                {instance.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleComplete(true)}
                    disabled={isActioning}
                    className="py-3 px-4 text-sm font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
              </div>
            )}

            {/* LOCK: system auto-processes, no action buttons */}
            {taskType === 'LOCK' && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Lock size={16} className="text-indigo-500 dark:text-indigo-400" />
                  <span className="font-medium">锁定时长</span>
                  <span className="ml-auto font-mono">
                    {instance.currentValue || 0} / {instance.targetValue} {instance.targetUnit || ''}
                  </span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  此任务由系统根据今日锁定时长自动判定
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
