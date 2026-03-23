import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Check,
  X,
  Loader2,
  Image,
  Trophy,
  MapPin,
  History,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sparkles,
  Play,
  Pause,
  Plus,
  Target,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import { isRouletteCoverBgEnabled } from '../../lib/local-settings';
import { ImageLightbox } from '../ImageLightbox';
import type { PlaySessionResponse, RouletteRollRecord, RouletteTaskInstance, RollDiceResponse } from '../../types';
import { RouletteTaskCard } from './RouletteTaskCard';

const NumberDice: React.FC<{ value: number; size?: number; className?: string }> = ({ value, size = 64, className = '' }) => (
  <div
    className={`inline-flex items-center justify-center rounded-2xl bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm ${className}`}
    style={{ width: size, height: size }}
  >
    <span className="font-bold text-white" style={{ fontSize: size * 0.5 }}>{value}</span>
  </div>
);

interface RoulettePlayViewProps {
  sessionId: number;
  onBack: () => void;
  onFinished: () => void;
}

export const RoulettePlayView: React.FC<RoulettePlayViewProps> = ({
  sessionId,
  onBack,
  onFinished,
}) => {
  const [session, setSession] = useState<PlaySessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [rollingDice, setRollingDice] = useState<number | null>(null); // animation value
  const [showHistory, setShowHistory] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [rollNotification, setRollNotification] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [useCoverAsBg, setUseCoverAsBg] = useState(() => isRouletteCoverBgEnabled());

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const result = await rouletteApi.getSession(sessionId);
      setSession(result);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollDice = async () => {
    setError(null);
    setIsRolling(true);

    // Dice animation
    let animCount = 0;
    const animInterval = setInterval(() => {
      const dMin = session.currentSection.diceRangeMin ?? 1;
      const dMax = session.currentSection.diceRangeMax ?? 6;
      setRollingDice(Math.floor(Math.random() * (dMax - dMin + 1)) + dMin);
      animCount++;
      if (animCount > 10) clearInterval(animInterval);
    }, 100);

    try {
      const result: RollDiceResponse = await rouletteApi.rollDice(sessionId);
      clearInterval(animInterval);
      setRollingDice(result.roll.rollValue);

      // Round target notification
      if (result.roundTargetSet != null) {
        setRollNotification(`轮次目标已设定：需要完成 ${result.roundTargetSet} 轮`);
      }
      // Build notification for special actions
      else if (result.isSpecialRule && result.specialRuleActionType) {
        if (result.specialRuleActionType === 'JUMP_SECTION') {
          const sectionName = result.jumpedToSection?.name || '下一关卡';
          setRollNotification(`跳转到关卡: ${sectionName}`);
        } else if (result.specialRuleActionType === 'MODIFY_DICE_RESULT') {
          const modifyLabels: Record<string, string> = {
            SWAP_SUCCESS_FAILURE: '成功/失败互换',
            FORCE_SUCCESS: '强制成功',
            FORCE_FAILURE: '强制失败',
          };
          const actionLabel = modifyLabels[result.modifyAction || ''] || result.modifyAction;
          setRollNotification(`骰子结果修改: ${actionLabel}`);
        }
      } else {
        setRollNotification(null);
      }

      // Wait a moment for the final dice to show, then refresh
      setTimeout(async () => {
        setRollingDice(null);
        setIsRolling(false);
        const refreshed = await rouletteApi.getSession(sessionId);
        setSession(refreshed);
      }, 800);
    } catch (e: any) {
      clearInterval(animInterval);
      setRollingDice(null);
      setIsRolling(false);
      setError(e.message || '投骰子失败');
    }
  };

  const handleComplete = async (success: boolean) => {
    if (!session?.currentRoll) return;
    setError(null);
    setIsCompleting(true);
    try {
      const result = await rouletteApi.completeRoll(sessionId, session.currentRoll.id, {
        success,
        imageUrl: proofImage || undefined,
      });
      setSession(result);
      setProofImage(null);
    } catch (e: any) {
      setError(e.message || '操作失败');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const result = await rouletteApi.uploadImage(file);
      setProofImage(result.imageUrl);
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAbandon = async () => {
    setIsAbandoning(true);
    try {
      await rouletteApi.abandonSession(sessionId);
      onFinished();
    } catch (e: any) {
      setError(e.message || '操作失败');
      setIsAbandoning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={32} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-6">
        <p className="text-slate-500 dark:text-slate-400">{error || '加载失败'}</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm">
          返回
        </button>
      </div>
    );
  }

  const isCompleted = session.session.status === 'COMPLETED';
  const isAbandoned = session.session.status === 'ABANDONED';
  const isGameOver = isCompleted || isAbandoned;
  const hasPendingRoll = session.currentRoll != null;

  // Game over screen
  if (isGameOver) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="px-4 pt-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {isCompleted ? (
            <>
              <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <Trophy size={48} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">游戏完成！</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-2">{session.gameTitle}</p>
              {session.roundExitEnabled && session.session.targetRounds != null ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-2">
                  已完成 {session.session.completedRounds} / {session.session.targetRounds} 轮
                </p>
              ) : null}
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-8">
                共完成 {session.rollHistory?.length || 0} 次投骰
              </p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
                <LogOut size={48} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">已放弃游戏</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-8">{session.gameTitle}</p>
            </>
          )}
          <button
            onClick={onFinished}
            className="px-8 py-3 bg-teal-500 text-white font-semibold rounded-2xl hover:bg-teal-600 transition-colors"
          >
            返回游戏室
          </button>
        </div>

        {/* History for completed games */}
        {session.rollHistory && session.rollHistory.length > 0 && (
          <div className="px-4 pb-6">
            <RollHistorySection history={session.rollHistory} />
          </div>
        )}
      </div>
    );
  }

  const sectionBgUrl = session.currentSection.backgroundImageUrl;
  const coverImageUrl = session.coverImageUrl;
  const bgImageUrl = sectionBgUrl || (useCoverAsBg ? coverImageUrl : null);
  const bgActive = !!bgImageUrl;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 relative">
      {/* Background image overlay */}
      {bgActive && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center gap-3 relative z-10 ${bgActive ? 'bg-black/20 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
        <button onClick={onBack} className={`p-1 rounded-full transition-colors ${bgActive ? 'hover:bg-white/20 dark:bg-slate-800/20 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
          <ChevronLeft size={24} className={bgActive ? 'text-white' : 'text-slate-600 dark:text-slate-300'} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-semibold truncate text-sm ${bgActive ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{session.gameTitle || '轮盘赌游戏'}</h1>
          <div className={`flex items-center gap-1 text-xs ${bgActive ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
            <MapPin size={12} />
            <span className="truncate">{session.currentSection.name}</span>
          </div>
        </div>
        {coverImageUrl && !sectionBgUrl && (
          <button
            onClick={() => setUseCoverAsBg(!useCoverAsBg)}
            className={`p-1.5 rounded-full transition-colors shrink-0 ${useCoverAsBg ? 'bg-white/30 dark:bg-slate-800/30 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
            title="封面背景"
          >
            <Image size={18} />
          </button>
        )}
        <button
          onClick={() => setShowAbandonConfirm(true)}
          className={`p-2 transition-colors ${bgActive ? 'text-white/60 hover:text-rose-300' : 'text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400'}`}
          title="放弃游戏"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Round progress */}
      {session.roundExitEnabled && (
        <div className={`px-4 py-2 border-b flex items-center gap-2 relative z-10 ${bgActive ? 'bg-black/10 border-white/10' : 'bg-violet-50 dark:bg-violet-950 border-violet-100'}`}>
          <Target size={14} className={bgActive ? 'text-white/70' : 'text-violet-500 dark:text-violet-400'} />
          {session.session.targetRounds != null ? (
            <>
              <span className={`text-xs font-medium ${bgActive ? 'text-white/80' : 'text-violet-700 dark:text-violet-400'}`}>
                轮次进度：{session.session.completedRounds} / {session.session.targetRounds}
              </span>
              <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${bgActive ? 'bg-white/20 dark:bg-slate-800/20' : 'bg-violet-200'}`}>
                <div
                  className={`h-full rounded-full transition-all ${bgActive ? 'bg-white/70 dark:bg-slate-800/70' : 'bg-violet-500'}`}
                  style={{ width: `${Math.min(100, (session.session.completedRounds / session.session.targetRounds) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className={`text-xs ${bgActive ? 'text-white/60' : 'text-violet-500 dark:text-violet-400'}`}>轮次目标：待掷骰决定</span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto flex flex-col relative z-10">
        {/* Current section */}
        <div className="p-4">
          <div className={`rounded-2xl p-4 text-white text-center ${bgActive ? 'bg-white/15 dark:bg-slate-800/15' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
            <div className="text-xs text-white/70 mb-1">当前关卡</div>
            <h2 className="text-lg font-bold">{session.currentSection.name}</h2>
          </div>
        </div>

        {/* Roll notification */}
        {rollNotification && (
          <div className="px-4">
            <div className={`rounded-xl p-3 flex items-center justify-between ${bgActive ? 'bg-white/15 dark:bg-slate-800/15 border border-white/20' : 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>
              <div className={`flex items-center gap-2 text-sm ${bgActive ? 'text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                <Sparkles size={16} className={bgActive ? 'text-amber-300' : 'text-amber-500 dark:text-amber-400'} />
                {rollNotification}
              </div>
              <button onClick={() => setRollNotification(null)} className={bgActive ? 'text-white/50 hover:text-white' : 'text-amber-400 dark:text-amber-300 hover:text-amber-600 dark:text-amber-400'}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Dice area */}
        {!hasPendingRoll ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            {/* Dice display */}
            <div className={`w-28 h-28 rounded-2xl flex items-center justify-center mb-8 transition-all duration-200 ${
              rollingDice != null
                ? 'bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg scale-110'
                : bgActive ? 'bg-white/15 dark:bg-slate-800/15' : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              {rollingDice != null ? (
                <NumberDice value={rollingDice} size={64} />
              ) : (
                <span className={`text-5xl font-bold ${bgActive ? 'text-white/40' : 'text-slate-300'}`}>?</span>
              )}
            </div>

            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="px-10 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.96] disabled:opacity-60 text-lg"
            >
              {isRolling ? '投掷中...' : '投骰子 🎲'}
            </button>

            {error && (
              <div className={`mt-4 rounded-xl p-3 text-sm ${bgActive ? 'bg-rose-500/20 text-rose-200' : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'}`}>{error}</div>
            )}
          </div>
        ) : (
          /* Task display */
          <div className="flex-1 px-4 py-2">
            <TaskDisplay
              roll={session.currentRoll!}
              isCompleting={isCompleting}
              proofImage={proofImage}
              isUploadingImage={isUploadingImage}
              error={error}
              onComplete={handleComplete}
              onImageUpload={handleImageUpload}
              onRemoveImage={() => setProofImage(null)}
              onOpenLightbox={setLightboxImages}
            />
          </div>
        )}

        {/* Pending task instances */}
        {session.taskInstances && session.taskInstances.length > 0 && (
          <div className="px-4 pb-2">
            <TaskInstancesSection
              instances={session.taskInstances}
              onRefresh={loadSession}
            />
          </div>
        )}

        {/* Roll history */}
        {session.rollHistory && session.rollHistory.length > 0 && (
          <div className="px-4 pb-4">
            <RollHistorySection history={session.rollHistory} />
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={0}
          onClose={() => setLightboxImages([])}
        />
      )}

      {/* Abandon confirmation modal */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAbandonConfirm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mx-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg mb-2">放弃游戏？</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">放弃后你的进度将不会被保留。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAbandonConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
              >
                继续游戏
              </button>
              <button
                onClick={handleAbandon}
                disabled={isAbandoning}
                className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {isAbandoning ? '放弃中...' : '确认放弃'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Task Display ====================

interface TaskDisplayProps {
  roll: RouletteRollRecord;
  isCompleting: boolean;
  proofImage: string | null;
  isUploadingImage: boolean;
  error: string | null;
  onComplete: (success: boolean) => void;
  onImageUpload: (file: File) => void;
  onRemoveImage: () => void;
  onOpenLightbox: (images: string[]) => void;
}

const TaskDisplay: React.FC<TaskDisplayProps> = ({
  roll, isCompleting, proofImage, isUploadingImage, error, onComplete, onImageUpload, onRemoveImage, onOpenLightbox,
}) => {
  const isSpecial = roll.specialRuleId != null;
  const taskType = roll.taskType || 'MANUAL';

  // COUNT task state
  const [count, setCount] = useState(0);
  const targetCount = roll.targetValue || 0;

  // DURATION task state
  const [elapsed, setElapsed] = useState(0); // seconds
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duration target in seconds
  const targetUnit = roll.targetUnit || '分钟';
  const targetSeconds = targetUnit === '小时'
    ? (roll.targetValue || 0) * 3600
    : targetUnit === '秒'
      ? (roll.targetValue || 0)
      : (roll.targetValue || 0) * 60; // default: 分钟

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= targetSeconds) {
            // Auto-complete on reaching target
            setTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            onComplete(true);
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, targetSeconds]);

  // Auto-complete COUNT when target reached
  useEffect(() => {
    if (taskType === 'COUNT' && targetCount > 0 && count >= targetCount) {
      onComplete(true);
    }
  }, [count, targetCount, taskType]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const TASK_TYPE_LABELS: Record<string, string> = {
    MANUAL: '手动',
    COUNT: '计数',
    DURATION: '计时',
    LOCK: '锁定',
  };

  return (
    <div className="space-y-4">
      {/* Dice result */}
      <div className="flex items-center justify-center gap-3">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
          isSpecial
            ? 'bg-gradient-to-br from-amber-400 to-orange-500'
            : 'bg-gradient-to-br from-teal-400 to-emerald-500'
        }`}>
          <NumberDice value={roll.rollValue} size={32} />
        </div>
        {isSpecial && (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-medium bg-amber-50 dark:bg-amber-950 px-3 py-1 rounded-full">
            <Sparkles size={14} />
            特殊规则触发！
          </div>
        )}
      </div>

      {/* Task card */}
      <div className={`rounded-2xl p-5 ${
        isSpecial
          ? 'bg-gradient-to-br from-amber-50 dark:from-amber-950 to-orange-50 dark:to-orange-950 border border-amber-200 dark:border-amber-800'
          : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <h3 className={`font-bold text-lg ${isSpecial ? 'text-amber-800 dark:text-amber-200' : 'text-slate-800 dark:text-slate-100'}`}>
            {roll.taskTitle || '任务'}
          </h3>
          {taskType !== 'MANUAL' && (
            <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-medium">
              {TASK_TYPE_LABELS[taskType] || taskType}
            </span>
          )}
        </div>
        {roll.taskDescription && (
          <p className={`text-sm leading-relaxed ${isSpecial ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
            {roll.taskDescription}
          </p>
        )}

        {/* COUNT progress */}
        {taskType === 'COUNT' && targetCount > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{count} / {targetCount} {roll.targetUnit || ''}</span>
              <span>{Math.round((count / targetCount) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (count / targetCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* DURATION progress */}
        {taskType === 'DURATION' && targetSeconds > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{formatTime(elapsed)} / {formatTime(targetSeconds)}</span>
              <span>{Math.round((elapsed / targetSeconds) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (elapsed / targetSeconds) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Image upload (if required) */}
      {roll.imageRequired && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">图片证明</label>
          {proofImage ? (
            <div className="relative inline-block">
              <img
                src={proofImage}
                alt="Proof"
                className="w-24 h-24 rounded-xl object-cover cursor-pointer"
                onClick={() => onOpenLightbox([proofImage])}
              />
              <button
                onClick={onRemoveImage}
                className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 transition-colors">
              {isUploadingImage ? (
                <Loader2 size={20} className="animate-spin text-slate-400 dark:text-slate-500" />
              ) : (
                <>
                  <Image size={20} className="text-slate-300 mb-1" />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">上传图片</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onImageUpload(file);
                }}
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950 rounded-xl p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
      )}

      {/* Action buttons — varies by task type */}
      {taskType === 'COUNT' ? (
        <div className="flex gap-3">
          <button
            onClick={() => onComplete(false)}
            disabled={isCompleting}
            className="py-3 px-6 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
            失败
          </button>
          <button
            onClick={() => setCount(c => c + 1)}
            disabled={isCompleting || count >= targetCount}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:from-teal-600 hover:to-emerald-600 transition-all disabled:opacity-50 active:scale-[0.98] text-lg"
          >
            <Plus size={20} />
            +1
          </button>
        </div>
      ) : taskType === 'DURATION' ? (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setTimerRunning(false);
              onComplete(false);
            }}
            disabled={isCompleting}
            className="py-3 px-6 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
            失败
          </button>
          <button
            onClick={() => setTimerRunning(r => !r)}
            disabled={isCompleting || elapsed >= targetSeconds}
            className={`flex-1 py-3 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98] text-lg ${
              timerRunning
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600'
            }`}
          >
            {timerRunning ? (
              <><Pause size={20} /> 暂停</>
            ) : (
              <><Play size={20} /> {elapsed > 0 ? '继续' : '开始'}</>
            )}
          </button>
        </div>
      ) : (
        /* MANUAL — default Success/Fail */
        <div className="flex gap-3">
          <button
            onClick={() => onComplete(false)}
            disabled={isCompleting || (roll.imageRequired && !proofImage)}
            className="flex-1 py-3 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
            失败
          </button>
          <button
            onClick={() => onComplete(true)}
            disabled={isCompleting || (roll.imageRequired && !proofImage)}
            className="flex-1 py-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-100 dark:bg-emerald-950 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            成功
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== Roll History ====================

interface RollHistorySectionProps {
  history: RouletteRollRecord[];
}

const RollHistorySection: React.FC<RollHistorySectionProps> = ({ history }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-50 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-400 dark:text-slate-500" />
          投骰历史 ({history.length})
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {history.map((roll, idx) => {
            return (
              <div key={roll.id} className="flex items-center gap-3 py-2 border-t border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-6">{idx + 1}</span>
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{roll.rollValue}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate block">{roll.taskTitle || '任务'}</span>
                  {roll.sectionName && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{roll.sectionName}</span>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  roll.status === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' :
                  roll.status === 'FAILURE' ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400' :
                  'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                }`}>
                  {roll.status === 'SUCCESS' ? '成功' : roll.status === 'FAILURE' ? '失败' : '进行中'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== Task Instances Section ====================

interface TaskInstancesSectionProps {
  instances: RouletteTaskInstance[];
  onRefresh: () => void;
}

const TaskInstancesSection: React.FC<TaskInstancesSectionProps> = ({ instances, onRefresh }) => {
  const [expanded, setExpanded] = useState(true);
  const pendingCount = instances.filter(t =>
    t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-50 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        <div className="flex items-center gap-2">
          <Check size={16} className="text-teal-500 dark:text-teal-400" />
          任务列表
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full min-w-[18px] text-center">
              {pendingCount}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {instances.map(instance => (
            <RouletteTaskCard key={instance.id} instance={instance} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoulettePlayView;
