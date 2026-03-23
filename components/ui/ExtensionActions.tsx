import React, { useState, useCallback, useEffect } from 'react';
import { X, Loader2, Clock, Dices, RotateCcw } from 'lucide-react';
import { extensionApi } from '../../lib/api';
import { ExtensionType, LockExtensionData, ExtensionTriggerResult } from '../../types';
import FortuneWheel from './FortuneWheel';
import FunDice3D from './FunDice3D';

interface ExtensionActionsProps {
  lockId: number;
  extensions: LockExtensionData[];
  onActionComplete?: (result: ExtensionTriggerResult) => void;
}

interface WheelSegment {
  type: string;
  value: number;
  color: string;
  label: string;
}

// Fun dice result from client-side roll
interface FunDiceClientResult {
  playerDice: number;
  systemDice: number;
}

export const ExtensionActions: React.FC<ExtensionActionsProps> = ({
  lockId,
  extensions,
  onActionComplete
}) => {
  const [activeModal, setActiveModal] = useState<ExtensionType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wheel state
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSegments, setWheelSegments] = useState<WheelSegment[]>([]);
  const [wheelResult, setWheelResult] = useState<ExtensionTriggerResult | null>(null);

  // Dice state - new flow: client rolls first, then sends to backend
  const [diceClientResult, setDiceClientResult] = useState<FunDiceClientResult | null>(null);
  const [diceApiResult, setDiceApiResult] = useState<ExtensionTriggerResult | null>(null);

  // Get extension data (use 'type' field from backend)
  const wheelExtension = extensions.find(e => e.type === 'WHEEL_OF_FORTUNE');
  const diceExtension = extensions.find(e => e.type === 'DICE');

  // Get cooldown remaining (backend provides this directly)
  const getCooldownRemaining = (ext: LockExtensionData): number => {
    // Backend already calculates this for us
    return ext.cooldownRemainingSeconds || 0;
  };

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  // Handle wheel spin
  const handleSpinWheel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setWheelResult(null);

    try {
      const result = await extensionApi.triggerExtension(lockId, 'WHEEL_OF_FORTUNE');

      if (result.success && result.data) {
        // Extract wheel data from result
        const data = result.data as any;
        setWheelRotation(data.rotation || 1440);
        setWheelSegments(data.segments || []);
        setWheelSpinning(true);
        setWheelResult(result);
      } else {
        setError(result.message || '转轮盘失败');
      }
    } catch (err: any) {
      setError(err.message || '转轮盘失败');
    } finally {
      setIsLoading(false);
    }
  }, [lockId]);

  const handleWheelSpinComplete = useCallback(() => {
    // Use functional update to ensure we capture latest state
    setWheelSpinning(false);
  }, []);

  // Separate effect to handle completion notification
  useEffect(() => {
    if (!wheelSpinning && wheelResult) {
      onActionComplete?.(wheelResult);
    }
  }, [wheelSpinning, wheelResult, onActionComplete]);

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
        onActionComplete?.(result);
      } else {
        setError(result.message || '掷骰子失败');
      }
    } catch (err: any) {
      setError(err.message || '掷骰子失败');
    } finally {
      setIsLoading(false);
    }
  }, [lockId, onActionComplete]);

  // Close modal and reset state
  const closeModal = useCallback(() => {
    setActiveModal(null);
    setWheelSpinning(false);
    setWheelResult(null);
    setDiceClientResult(null);
    setDiceApiResult(null);
    setError(null);
  }, []);

  // If no extensions enabled, don't render
  if (!wheelExtension?.enabled && !diceExtension?.enabled) {
    return null;
  }

  const wheelCooldown = wheelExtension ? getCooldownRemaining(wheelExtension) : 0;
  const diceCooldown = diceExtension ? getCooldownRemaining(diceExtension) : 0;

  return (
    <>
      {/* Extension Action Buttons */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft mb-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">扩展功能</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Wheel of Fortune Button */}
          {wheelExtension?.enabled && (
            <button
              onClick={() => setActiveModal('WHEEL_OF_FORTUNE')}
              disabled={wheelCooldown > 0}
              className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 ${
                wheelCooldown > 0
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  : 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center">
                <RotateCcw size={24} />
              </div>
              <span className="text-xs font-bold">幸运轮盘</span>
              {wheelCooldown > 0 && (
                <span className="text-[10px] flex items-center gap-1">
                  <Clock size={10} />
                  {formatCooldown(wheelCooldown)}
                </span>
              )}
            </button>
          )}

          {/* Dice Button */}
          {diceExtension?.enabled && (
            <button
              onClick={() => setActiveModal('DICE')}
              disabled={diceCooldown > 0}
              className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 ${
                diceCooldown > 0
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  : 'bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center">
                <Dices size={24} />
              </div>
              <span className="text-xs font-bold">掷骰子</span>
              {diceCooldown > 0 && (
                <span className="text-[10px] flex items-center gap-1">
                  <Clock size={10} />
                  {formatCooldown(diceCooldown)}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Wheel of Fortune Modal */}
      {activeModal === 'WHEEL_OF_FORTUNE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!wheelSpinning ? closeModal : undefined}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">幸运轮盘</h3>
              {!wheelSpinning && (
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 2D Wheel */}
            <FortuneWheel
              segments={wheelSegments}
              isSpinning={wheelSpinning}
              targetRotation={wheelRotation}
              onSpinComplete={handleWheelSpinComplete}
            />

            {/* Result */}
            {wheelResult && !wheelSpinning && (
              <div className={`mt-4 p-4 rounded-2xl text-center ${
                (wheelResult.data as any)?.adjustedTimeChange < 0
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                  : (wheelResult.data as any)?.adjustedTimeChange > 0
                  ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}>
                <p className="font-bold text-lg">{wheelResult.message}</p>
                {(wheelResult.data as any)?.adjustedTimeChange !== 0 && (
                  <p className="text-sm mt-1">
                    时间变化: {(wheelResult.data as any)?.adjustedTimeChange > 0 ? '+' : ''}
                    {(wheelResult.data as any)?.adjustedTimeChange} 分钟
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
                className="mt-4 w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
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
                className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dice Modal */}
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
              <p>点击骰子开始投掷，你和系统各有一个骰子</p>
              <p className="mt-1">你的点数 &gt; 系统 = <span className="text-green-600 dark:text-green-400 font-bold">减少时间</span></p>
              <p>你的点数 ≤ 系统 = <span className="text-red-600 dark:text-red-400 font-bold">增加时间</span></p>
            </div>

            {/* 3D Fun Dice */}
            {!diceApiResult && (
              <FunDice3D
                onRollComplete={handleFunDiceRollComplete}
                disabled={isLoading}
              />
            )}

            {/* Loading indicator */}
            {isLoading && !diceApiResult && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-violet-500 dark:text-violet-400" size={24} />
                <span className="ml-2 text-slate-600 dark:text-slate-300">正在计算结果...</span>
              </div>
            )}

            {/* Result */}
            {diceApiResult && diceClientResult && (
              <div className={`mt-4 p-4 rounded-2xl text-center ${
                (diceApiResult.data as any)?.resultType === 'WIN'
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
              }`}>
                <div className="flex justify-center gap-4 mb-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-500 dark:text-pink-400">{diceClientResult.systemDice}</div>
                    <div className="text-xs">系统</div>
                  </div>
                  <div className="text-lg font-bold text-slate-400 dark:text-slate-500">VS</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-violet-500 dark:text-violet-400">{diceClientResult.playerDice}</div>
                    <div className="text-xs">你</div>
                  </div>
                </div>
                <p className="font-bold text-lg">{diceApiResult.message}</p>
                {(diceApiResult.data as any)?.timeChange != null && (diceApiResult.data as any)?.timeChange !== 0 && (
                  <p className="text-sm mt-1">
                    时间变化: {(diceApiResult.data as any)?.timeChange > 0 ? '+' : ''}
                    {(diceApiResult.data as any)?.timeChange} 分钟
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
                className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium"
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

export default ExtensionActions;
