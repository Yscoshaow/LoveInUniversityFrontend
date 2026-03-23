import React, { useState, useCallback } from 'react';
import {
  Dices, Settings, AlertCircle, Camera, Gift, Heart, Key, Users,
  Play, Pause, Loader2, X, RotateCcw, Clock, Vote, Coins
} from 'lucide-react';
import {
  ExtensionType, LockExtensionData, ExtensionTriggerResult,
  EXTENSION_NAMES
} from '../../types';
import { extensionApi } from '../../lib/api';
import FortuneWheel from './FortuneWheel';
import FunDice3D from './FunDice3D';

interface LockExtensionPanelProps {
  lockId: number;
  extensions: LockExtensionData[];
  isOwner: boolean;
  isKeyholder: boolean;
  onExtensionTriggered?: (result: ExtensionTriggerResult) => void;
  onRefresh?: () => void;
}

interface WheelSegment {
  type: string;
  value: number;
  color: string;
  label: string;
}

const EXTENSION_ICONS: Partial<Record<ExtensionType, React.ReactNode>> = {
  WHEEL_OF_FORTUNE: <Gift size={20} />,
  DICE: <Dices size={20} />,
  TASKS: <Settings size={20} />,
  RANDOM_EVENTS: <AlertCircle size={20} />,
  PILLORY: <Users size={20} />,
  SHARE_LINKS: <Key size={20} />,
  VERIFICATION_PICTURE: <Camera size={20} />,
  PENALTIES: <AlertCircle size={20} />,
  ROLE: <Heart size={20} />,
  VOTE_UNLOCK: <Vote size={20} />,
  COIN_TOSS: <Coins size={20} />
};

const EXTENSION_COLORS: Partial<Record<ExtensionType, string>> = {
  WHEEL_OF_FORTUNE: 'from-pink-500 to-rose-500',
  DICE: 'from-violet-500 to-purple-500',
  TASKS: 'from-emerald-500 to-teal-500',
  RANDOM_EVENTS: 'from-amber-500 to-orange-500',
  PILLORY: 'from-red-500 to-rose-500',
  SHARE_LINKS: 'from-indigo-500 to-violet-500',
  VERIFICATION_PICTURE: 'from-pink-500 to-rose-500',
  PENALTIES: 'from-red-600 to-red-500',
  ROLE: 'from-pink-400 to-purple-400',
  VOTE_UNLOCK: 'from-violet-500 to-indigo-500',
  COIN_TOSS: 'from-amber-500 to-yellow-500'
};

export const LockExtensionPanel: React.FC<LockExtensionPanelProps> = ({
  lockId,
  extensions,
  isOwner,
  isKeyholder,
  onExtensionTriggered,
  onRefresh
}) => {
  const [triggeringExt, setTriggeringExt] = useState<ExtensionType | null>(null);
  const [lastResult, setLastResult] = useState<ExtensionTriggerResult | null>(null);

  // 3D Modal states
  const [activeModal, setActiveModal] = useState<'WHEEL_OF_FORTUNE' | 'DICE' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wheel state
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSegments, setWheelSegments] = useState<WheelSegment[]>([]);
  const [wheelResult, setWheelResult] = useState<ExtensionTriggerResult | null>(null);

  // Dice state - new flow: client rolls first via FunDice3D, then sends to backend
  const [diceClientResult, setDiceClientResult] = useState<{ playerDice: number; systemDice: number } | null>(null);
  const [diceApiResult, setDiceApiResult] = useState<ExtensionTriggerResult | null>(null);

  const canTrigger = useCallback((ext: LockExtensionData) => {
    if (!ext.enabled) return false;
    if (!ext.canTrigger) return false;
    if (isOwner) return true;
    if (isKeyholder && ext.type === 'TASKS') return true;
    return false;
  }, [isOwner, isKeyholder]);

  // Handle wheel spin with 3D animation
  const handleSpinWheel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setWheelResult(null);

    try {
      const result = await extensionApi.spinWheel(lockId);

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        setWheelRotation((data.rotation as number) || 1440);
        setWheelSegments((data.segments as WheelSegment[]) || []);
        setWheelSpinning(true);
        setWheelResult(result);
      } else {
        setError(result.message || '转轮盘失败');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '转轮盘失败');
    } finally {
      setIsLoading(false);
    }
  }, [lockId]);

  const handleWheelSpinComplete = useCallback(() => {
    setWheelSpinning(false);
    // Don't call onExtensionTriggered or onRefresh here - they will be called when modal closes
  }, []);

  // Handle fun dice roll complete - called by FunDice3D when physics simulation finishes
  const handleFunDiceRollComplete = useCallback(async (playerDice: number, systemDice: number) => {
    // Store client result
    setDiceClientResult({ playerDice, systemDice });
    setIsLoading(true);
    setError(null);

    try {
      // Send client dice results to backend for time calculation
      const result = await extensionApi.triggerExtension(lockId, 'DICE', {
        playerDice,
        systemDice
      });

      if (result.success) {
        setDiceApiResult(result);
        // Don't call onExtensionTriggered or onRefresh here - they will be called when modal closes
      } else {
        setError(result.message || '掷骰子失败');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '掷骰子失败');
    } finally {
      setIsLoading(false);
    }
  }, [lockId]);

  // Handle other extensions (non-3D)
  const handleTrigger = useCallback(async (ext: LockExtensionData) => {
    if (!canTrigger(ext)) return;

    // For wheel and dice, open 3D modal instead
    if (ext.type === 'WHEEL_OF_FORTUNE' || ext.type === 'DICE') {
      setActiveModal(ext.type);
      return;
    }

    setTriggeringExt(ext.type);
    setLastResult(null);

    try {
      const result = await extensionApi.triggerExtension(lockId, ext.type);
      setLastResult(result);
      onExtensionTriggered?.(result);
      onRefresh?.();
    } catch (err) {
      setLastResult({
        success: false,
        message: err instanceof Error ? err.message : '触发失败'
      });
    } finally {
      setTriggeringExt(null);
    }
  }, [lockId, canTrigger, onExtensionTriggered, onRefresh]);

  // Close modal and reset state
  const closeModal = useCallback(() => {
    // Notify parent of result and refresh data when modal closes
    if (diceApiResult) {
      onExtensionTriggered?.(diceApiResult);
      onRefresh?.();
    } else if (wheelResult) {
      onExtensionTriggered?.(wheelResult);
      onRefresh?.();
    }
    setActiveModal(null);
    setWheelSpinning(false);
    setWheelResult(null);
    setDiceClientResult(null);
    setDiceApiResult(null);
    setError(null);
  }, [diceApiResult, wheelResult, onExtensionTriggered, onRefresh]);

  const getRemainingCooldown = (ext: LockExtensionData) => {
    return ext.cooldownRemainingSeconds || 0;
  };

  const formatCooldown = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`;
    return `${Math.ceil(seconds / 3600)}小时`;
  };

  if (extensions.length === 0) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-center text-slate-500 dark:text-slate-400">
        <Settings size={32} className="mx-auto mb-2 opacity-50" />
        <p>暂无启用的扩展</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Result Display */}
        {lastResult && (
          <div className={`p-4 rounded-xl ${
            lastResult.success ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
          }`}>
            <p className="font-medium">{lastResult.message}</p>
            {lastResult.timeChange && (
              <p className="text-sm mt-1">
                时间变化: {lastResult.timeChange > 0 ? '+' : ''}{lastResult.timeChange} 分钟
              </p>
            )}
          </div>
        )}

        {/* Extension Cards */}
        {extensions.map(ext => {
          const cooldownRemaining = getRemainingCooldown(ext);
          const isOnCooldown = cooldownRemaining > 0;
          const isTriggerAllowed = canTrigger(ext) && !isOnCooldown;
          const isTriggering = triggeringExt === ext.type;
          // Passive extensions are not directly triggerable by the user
          const isPassiveExtension = ext.type === 'VOTE_UNLOCK' || ext.type === 'VERIFICATION_PICTURE'
            || ext.type === 'LIKE_UNLOCK' || ext.type === 'COIN_TOSS' || ext.type === 'GAME_HOOK';

          return (
            <div
              key={ext.id}
              className={`rounded-xl overflow-hidden ${
                ext.enabled ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <div className={`bg-gradient-to-r ${EXTENSION_COLORS[ext.type] || 'from-slate-500 to-slate-600'} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 dark:bg-slate-800/20 rounded-lg">
                      {EXTENSION_ICONS[ext.type] || <Settings size={20} />}
                    </div>
                    <div>
                      <h4 className="font-semibold">
                        {ext.displayName || EXTENSION_NAMES[ext.type]}
                      </h4>
                      {!isPassiveExtension && (
                        <p className="text-xs opacity-80">
                          已触发 {ext.triggerCount} 次
                        </p>
                      )}
                      {isPassiveExtension && ext.type === 'VOTE_UNLOCK' && (
                        <p className="text-xs opacity-80">
                          解锁时自动触发
                        </p>
                      )}
                      {isPassiveExtension && ext.type === 'VERIFICATION_PICTURE' && (
                        <p className="text-xs opacity-80">
                          定时验证拍照
                        </p>
                      )}
                      {isPassiveExtension && ext.type === 'LIKE_UNLOCK' && (
                        <p className="text-xs opacity-80">
                          收集社区点赞解锁
                        </p>
                      )}
                      {isPassiveExtension && ext.type === 'COIN_TOSS' && (
                        <p className="text-xs opacity-80">
                          已投 {ext.triggerCount} 次币
                        </p>
                      )}
                      {isPassiveExtension && ext.type === 'GAME_HOOK' && (
                        <p className="text-xs opacity-80">
                          游戏联动自动触发
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Only show trigger button for active extensions (not passive ones like VOTE_UNLOCK) */}
                  {ext.enabled && !isPassiveExtension && (
                    <button
                      onClick={() => handleTrigger(ext)}
                      disabled={!isTriggerAllowed || isTriggering}
                      className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                        isTriggerAllowed
                          ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:bg-slate-800/90 active:scale-95'
                          : 'bg-white/30 dark:bg-slate-800/30 text-white/70 cursor-not-allowed'
                      }`}
                    >
                      {isTriggering ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isOnCooldown ? (
                        <>
                          <Clock size={14} />
                          {formatCooldown(cooldownRemaining)}
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          触发
                        </>
                      )}
                    </button>
                  )}

                  {/* Show enabled badge for passive extensions */}
                  {ext.enabled && isPassiveExtension && (
                    <span className="px-3 py-1.5 bg-white/20 dark:bg-slate-800/20 text-white text-xs font-medium rounded-lg">
                      已启用
                    </span>
                  )}
                </div>
              </div>

              {/* Extension specific content */}
              {ext.enabled && ext.type === 'VERIFICATION_PICTURE' && (
                <div className="bg-white dark:bg-slate-800 p-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ext.description || '需要在指定时间内拍摄验证照片，逾期将受到惩罚'}
                  </p>
                  {ext.config && (
                    <div className="space-y-1.5">
                      {/* Schedule Times */}
                      {Array.isArray((ext.config as Record<string, unknown>).scheduleTimes) &&
                        ((ext.config as Record<string, unknown>).scheduleTimes as string[]).length > 0 && (
                        <div className="flex items-start gap-2 text-xs">
                          <Clock size={13} className="text-pink-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">拍照时间：</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {((ext.config as Record<string, unknown>).scheduleTimes as string[]).join('、')}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Tolerance Window */}
                      {typeof (ext.config as Record<string, unknown>).toleranceMinutes === 'number' && (
                        <div className="flex items-center gap-2 text-xs">
                          <Clock size={13} className="text-pink-400 shrink-0" />
                          <span className="text-slate-400 dark:text-slate-500">容差窗口：</span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            &plusmn;{(ext.config as Record<string, unknown>).toleranceMinutes as number}分钟
                          </span>
                        </div>
                      )}

                      {/* Share to Community */}
                      <div className="flex items-center gap-2 text-xs">
                        <Users size={13} className="text-pink-400 shrink-0" />
                        <span className="text-slate-400 dark:text-slate-500">社区分享：</span>
                        <span className={`font-medium ${
                          (ext.config as Record<string, unknown>).shareToCommunity
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {(ext.config as Record<string, unknown>).shareToCommunity ? '已开启' : '未开启'}
                        </span>
                      </div>

                      {/* Penalty */}
                      <div className="flex items-center gap-2 text-xs">
                        <AlertCircle size={13} className="text-pink-400 shrink-0" />
                        <span className="text-slate-400 dark:text-slate-500">逾期惩罚：</span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {typeof (ext.config as Record<string, unknown>).penaltyMinutes === 'number'
                            ? `+${(ext.config as Record<string, unknown>).penaltyMinutes as number}分钟`
                            : '难度默认'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {ext.enabled && ext.type !== 'VERIFICATION_PICTURE' && (
                <div className="bg-white dark:bg-slate-800 p-3 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ext.description || (
                      ext.type === 'WHEEL_OF_FORTUNE' ? '转动轮盘获得随机奖惩，难度越高变化越大' :
                      ext.type === 'DICE' ? '和系统比大小，赢了减时间，输了加时间' :
                      ext.type === 'TASKS' ? 'Keyholder可分配任务' :
                      ext.type === 'RANDOM_EVENTS' ? '系统随机触发事件' :
                      ext.type === 'VOTE_UNLOCK' ? '解锁时需要社区投票，先得到指定票数的一方决定是否允许解锁' :
                      '扩展功能'
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Wheel of Fortune 3D Modal */}
      {activeModal === 'WHEEL_OF_FORTUNE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!wheelSpinning ? closeModal : undefined}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">🎡 幸运轮盘</h3>
              {!wheelSpinning && (
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 3D Wheel */}
            <FortuneWheel
              segments={wheelSegments}
              isSpinning={wheelSpinning}
              targetRotation={wheelRotation}
              onSpinComplete={handleWheelSpinComplete}
            />

            {/* Result */}
            {wheelResult && !wheelSpinning && (
              <div className={`mt-4 p-4 rounded-2xl text-center ${
                (wheelResult.data as Record<string, unknown>)?.adjustedTimeChange as number < 0
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700'
                  : ((wheelResult.data as Record<string, unknown>)?.adjustedTimeChange as number) > 0
                  ? 'bg-rose-50 dark:bg-rose-950 text-rose-700'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}>
                <p className="font-bold text-lg">{wheelResult.message}</p>
                {((wheelResult.data as Record<string, unknown>)?.adjustedTimeChange as number) !== 0 && (
                  <p className="text-sm mt-1">
                    时间变化: {((wheelResult.data as Record<string, unknown>)?.adjustedTimeChange as number) > 0 ? '+' : ''}
                    {(wheelResult.data as Record<string, unknown>)?.adjustedTimeChange as number} 分钟
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            {/* Spin Button */}
            {!wheelResult && (
              <button
                onClick={handleSpinWheel}
                disabled={isLoading || wheelSpinning}
                className="mt-4 w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-pink-500/30"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <RotateCcw size={20} />
                    转动轮盘
                  </>
                )}
              </button>
            )}

            {/* Close after result */}
            {wheelResult && !wheelSpinning && (
              <button
                onClick={closeModal}
                className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dice 3D Modal */}
      {activeModal === 'DICE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isLoading ? closeModal : undefined}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">趣味骰子</h3>
              {!isLoading && (
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Rules */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 mb-4 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-medium mb-1">游戏规则：</p>
              <p>拖拽骰子然后松开投掷，你和系统各有一个骰子</p>
              <p className="mt-1">你的点数 &gt; 系统 = <span className="text-green-600 dark:text-green-400 font-bold">减少时间</span></p>
              <p>你的点数 ≤ 系统 = <span className="text-red-600 dark:text-red-400 font-bold">增加时间</span></p>
            </div>

            {/* 3D Fun Dice - always visible */}
            <FunDice3D
              onRollComplete={handleFunDiceRollComplete}
              disabled={isLoading || !!diceApiResult}
            />

            {/* Loading indicator */}
            {isLoading && !diceApiResult && (
              <div className="flex items-center justify-center py-3 mt-2">
                <Loader2 className="animate-spin text-violet-500 dark:text-violet-400" size={20} />
                <span className="ml-2 text-slate-600 dark:text-slate-300 text-sm">正在计算结果...</span>
              </div>
            )}

            {/* Result - shown below dice */}
            {diceApiResult && diceClientResult && (
              <div className={`mt-3 p-3 rounded-2xl text-center ${
                (diceApiResult.data as Record<string, unknown>)?.resultType === 'WIN'
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
              }`}>
                <p className="font-bold">{diceApiResult.message}</p>
                {(diceApiResult.data as Record<string, unknown>)?.timeChange != null && ((diceApiResult.data as Record<string, unknown>)?.timeChange as number) !== 0 && (
                  <p className="text-sm mt-1">
                    时间变化: {((diceApiResult.data as Record<string, unknown>)?.timeChange as number) > 0 ? '+' : ''}
                    {(diceApiResult.data as Record<string, unknown>)?.timeChange as number} 分钟
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            {/* Close after result */}
            {diceApiResult && (
              <button
                onClick={closeModal}
                className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LockExtensionPanel;
