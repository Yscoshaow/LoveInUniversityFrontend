import React, { useState, useCallback, useEffect } from 'react';
import {
  X, Lock, Unlock, Key, Clock, AlertCircle, Loader2,
  ChevronUp, ChevronDown, CheckCircle, Vote, Users, Share2, AlertTriangle
} from 'lucide-react';
import { SelfLockDetail, UnlockMethod, GuessResult, UnlockVoteDetail, LockExtensionData } from '../../types';
import { selfLockApi, unlockVoteApi } from '../../lib/api';
import { platformShare } from '../../lib/platform-actions';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockDetail: SelfLockDetail;
  onUnlockSuccess: () => void;
  extensions?: LockExtensionData[];
}

export const UnlockModal: React.FC<UnlockModalProps> = ({
  isOpen,
  onClose,
  lockDetail,
  onUnlockSuccess,
  extensions = []
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guessResult, setGuessResult] = useState<GuessResult | null>(null);

  // For TIME guessing
  const [guessedHours, setGuessedHours] = useState(0);
  const [guessedMinutes, setGuessedMinutes] = useState(0);

  // For KEY guessing
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);

  // Vote unlock state
  const [voteUnlockStatus, setVoteUnlockStatus] = useState<'idle' | 'checking' | 'starting' | 'active' | 'cannot' | 'cooldown'>('idle');
  const [voteSession, setVoteSession] = useState<UnlockVoteDetail | null>(null);
  const [canStartReason, setCanStartReason] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<string>('');

  const { lock, canUnlock, unlockProgress } = lockDetail;
  const unlockMethod = lock.unlockMethod;

  // Check if vote unlock extension is enabled
  const voteUnlockExtension = extensions.find(e => e.type === 'VOTE_UNLOCK' && e.enabled);
  const hasVoteUnlock = !!voteUnlockExtension;

  // Generate key array for GUESS_KEY mode
  const keyCount = lock.keyCount || 3;
  const keys = Array.from({ length: keyCount }, (_, i) => i);

  // Check vote unlock status when modal opens with vote unlock enabled
  useEffect(() => {
    if (!isOpen || !hasVoteUnlock) return;

    const checkVoteStatus = async () => {
      setVoteUnlockStatus('checking');
      try {
        // First check if there's an active session
        try {
          const activeSession = await unlockVoteApi.getActiveSession(lock.id);
          setVoteSession(activeSession);
          setVoteUnlockStatus('active');
          return;
        } catch {
          // No active session, check if we can start one
        }

        // Check if we can start a new vote
        const canStartResult = await unlockVoteApi.canStartVote(lock.id);
        if (canStartResult.canStart) {
          setVoteUnlockStatus('idle');
        } else if (canStartResult.cooldownUntil) {
          setCooldownUntil(canStartResult.cooldownUntil);
          setVoteUnlockStatus('cooldown');
        } else {
          setVoteUnlockStatus('cannot');
          setCanStartReason(canStartResult.reason);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '检查投票状态失败');
        setVoteUnlockStatus('idle');
      }
    };

    checkVoteStatus();
  }, [isOpen, hasVoteUnlock, lock.id]);

  // Poll active vote session every 5s to keep vote counts fresh
  useEffect(() => {
    if (!isOpen || voteUnlockStatus !== 'active' || !voteSession) return;

    const poll = async () => {
      try {
        const updated = await unlockVoteApi.getActiveSession(lock.id);
        setVoteSession(updated);
        // Auto-detect if vote ended
        if (updated.session.status === 'APPROVED') {
          onUnlockSuccess();
        }
      } catch {
        // Session may have expired/ended, re-check status
        try {
          const canStartResult = await unlockVoteApi.canStartVote(lock.id);
          if (canStartResult.canStart) {
            setVoteUnlockStatus('idle');
          } else if (canStartResult.cooldownUntil) {
            setCooldownUntil(canStartResult.cooldownUntil);
            setVoteUnlockStatus('cooldown');
          } else {
            setVoteUnlockStatus('cannot');
            setCanStartReason(canStartResult.reason);
          }
        } catch { /* ignore */ }
      }
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isOpen, voteUnlockStatus, voteSession, lock.id, onUnlockSuccess]);

  // Cooldown countdown timer
  useEffect(() => {
    if (voteUnlockStatus !== 'cooldown' || !cooldownUntil) return;

    const updateCountdown = () => {
      const now = Date.now();
      const end = new Date(cooldownUntil).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setCooldownRemaining('');
        setCooldownUntil(null);
        setVoteUnlockStatus('idle');
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setCooldownRemaining(`${hours}小时 ${minutes}分钟 ${seconds}秒`);
      } else if (minutes > 0) {
        setCooldownRemaining(`${minutes}分钟 ${seconds}秒`);
      } else {
        setCooldownRemaining(`${seconds}秒`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [voteUnlockStatus, cooldownUntil]);

  // Handle starting vote unlock
  const handleStartVoteUnlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await unlockVoteApi.startVote(lock.id);
      // Refresh the session detail
      const activeSession = await unlockVoteApi.getActiveSession(lock.id);
      setVoteSession(activeSession);
      setVoteUnlockStatus('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起投票失败');
    } finally {
      setLoading(false);
    }
  }, [lock.id]);

  // Handle casting vote (for in-app voting)
  const handleCastVote = useCallback(async (isApprove: boolean) => {
    if (!voteSession) return;
    setLoading(true);
    setError(null);
    try {
      await unlockVoteApi.castVote(voteSession.session.id, isApprove);
      // Refresh session detail
      const updated = await unlockVoteApi.getActiveSession(lock.id);
      setVoteSession(updated);

      // Check if vote resulted in unlock
      if (updated.session.status === 'APPROVED') {
        onUnlockSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '投票失败');
    } finally {
      setLoading(false);
    }
  }, [voteSession, lock.id, onUnlockSuccess]);

  const handleDirectUnlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await selfLockApi.tryUnlock(lock.id);
      onUnlockSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解锁失败');
    } finally {
      setLoading(false);
    }
  }, [lock.id, onUnlockSuccess]);

  const handleGuessTime = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGuessResult(null);
    try {
      const guessValue = `${guessedHours}:${guessedMinutes.toString().padStart(2, '0')}`;
      const result = await selfLockApi.guess(lock.id, 'TIME', guessValue);
      setGuessResult(result);
      if (result.correct) {
        // Unlock after correct guess
        await selfLockApi.tryUnlock(lock.id);
        onUnlockSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '猜测失败');
    } finally {
      setLoading(false);
    }
  }, [lock.id, guessedHours, guessedMinutes, onUnlockSuccess]);

  const handleGuessKey = useCallback(async () => {
    if (selectedKeyIndex === null) return;
    setLoading(true);
    setError(null);
    setGuessResult(null);
    try {
      const result = await selfLockApi.guess(lock.id, 'KEY', selectedKeyIndex.toString());
      setGuessResult(result);
      if (result.correct) {
        // Unlock after correct guess
        await selfLockApi.tryUnlock(lock.id);
        onUnlockSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '猜测失败');
    } finally {
      setLoading(false);
    }
  }, [lock.id, selectedKeyIndex, onUnlockSuccess]);

  if (!isOpen) return null;

  // Check if time is reached (required for all unlock methods)
  const timeReached = unlockProgress?.timeReached ?? canUnlock;

  // Check if hidden time mode allows early vote unlock attempt
  const isHiddenTimeMode = lock.hideRemainingTime;
  // In hidden time mode with vote unlock, allow vote even if time not reached
  const canAttemptVoteUnlock = hasVoteUnlock && (timeReached || isHiddenTimeMode);

  const renderContent = () => {
    // If vote unlock is enabled (and time reached OR hidden time mode), show vote unlock UI first
    if (canAttemptVoteUnlock) {
      if (voteUnlockStatus === 'checking') {
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500 dark:text-violet-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">检查投票状态...</p>
          </div>
        );
      }

      if (voteUnlockStatus === 'cooldown') {
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-500 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">投票冷却中</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">上次投票失败后需要等待冷却期结束</p>
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 inline-block">
              <p className="text-amber-700 dark:text-amber-400 font-medium text-lg">{cooldownRemaining}</p>
            </div>
          </div>
        );
      }

      if (voteUnlockStatus === 'cannot') {
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">无法发起投票</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{canStartReason || '投票解锁不可用'}</p>
          </div>
        );
      }

      if (voteUnlockStatus === 'active' && voteSession) {
        const { session } = voteSession;
        const totalVotes = session.approveVotes + session.rejectVotes;
        const approvePercent = totalVotes > 0 ? (session.approveVotes / session.votesRequired) * 100 : 0;
        const rejectPercent = totalVotes > 0 ? (session.rejectVotes / session.votesRequired) * 100 : 0;

        // Check if session ended
        if (session.status === 'APPROVED') {
          return (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">投票通过！</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                社区投票已通过，锁已解锁。
              </p>
              <button
                onClick={onUnlockSuccess}
                className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Unlock size={18} />
                查看解锁奖励
              </button>
            </div>
          );
        }

        if (session.status === 'REJECTED' || session.status === 'EXPIRED') {
          return (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {session.status === 'REJECTED' ? '投票被拒绝' : '投票已超时'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                {session.status === 'REJECTED'
                  ? '社区投票未通过，解锁失败。'
                  : '投票时间已过，解锁失败。'}
              </p>
              {session.penaltyMinutes > 0 && (
                <p className="text-red-500 dark:text-red-400 text-sm font-medium">
                  +{session.penaltyMinutes} 分钟惩罚时间
                </p>
              )}
            </div>
          );
        }

        // Active voting session
        return (
          <div className="py-4">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-violet-100 dark:bg-violet-950 rounded-full flex items-center justify-center mx-auto mb-3">
                <Vote className="w-7 h-7 text-violet-500 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">投票进行中</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                先达到 {session.votesRequired} 票的一方获胜
              </p>
            </div>

            {/* Vote progress */}
            <div className="mb-6 space-y-3">
              {/* Approve bar */}
              <div className="flex items-center gap-3">
                <span className="text-green-600 dark:text-green-400 text-sm font-medium w-12">同意</span>
                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, approvePercent)}%` }}
                  />
                </div>
                <span className="text-slate-600 dark:text-slate-300 text-sm font-bold w-12 text-right">
                  {session.approveVotes}/{session.votesRequired}
                </span>
              </div>

              {/* Reject bar */}
              <div className="flex items-center gap-3">
                <span className="text-red-600 dark:text-red-400 text-sm font-medium w-12">拒绝</span>
                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, rejectPercent)}%` }}
                  />
                </div>
                <span className="text-slate-600 dark:text-slate-300 text-sm font-bold w-12 text-right">
                  {session.rejectVotes}/{session.votesRequired}
                </span>
              </div>
            </div>

            {/* Timer */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <Clock size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-slate-600 dark:text-slate-300 text-sm">
                  剩余 {Math.max(0, voteSession.remainingSeconds)} 秒
                </span>
              </div>
            </div>

            {/* In-app voting buttons (if user can vote) */}
            {voteSession.canVote && voteSession.myVote === null && (
              <div className="space-y-2">
                <p className="text-center text-slate-500 dark:text-slate-400 text-xs mb-2">你也可以在这里投票</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCastVote(true)}
                    disabled={loading}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    同意
                  </button>
                  <button
                    onClick={() => handleCastVote(false)}
                    disabled={loading}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    拒绝
                  </button>
                </div>
              </div>
            )}

            {voteSession.myVote !== null && (
              <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
                你已投票: {voteSession.myVote ? '同意' : '拒绝'}
              </p>
            )}

            {/* Share to group button */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => {
                  platformShare({
                    text: '来投票决定要不要开锁吧！',
                    url: `https://t.me/lovein_university_bot/university?startapp=vote_${session.id}`,
                    inlineQuery: `vote:${session.id}`,
                    inlineChatTypes: ['groups', 'channels'],
                  });
                }}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 size={18} />
                分享到群组投票
              </button>
              <p className="text-slate-400 dark:text-slate-500 text-xs text-center mt-2">
                点击后选择群组，让群友帮你投票
              </p>
            </div>
          </div>
        );
      }

      // Can start a new vote
      return (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-violet-100 dark:bg-violet-950 rounded-full flex items-center justify-center mx-auto mb-4">
            <Vote className="w-8 h-8 text-violet-500 dark:text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">发起投票解锁</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            需要社区投票来决定是否解锁。投票将发送到 Telegram 群组。
          </p>
          <div className="bg-violet-50 dark:bg-violet-950 rounded-2xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 text-sm mb-2">
              <Users size={16} />
              <span className="font-medium">投票规则</span>
            </div>
            <ul className="text-violet-600 dark:text-violet-400 text-xs space-y-1">
              <li>• 先达到票数的一方获胜（同意/拒绝）</li>
              <li>• 投票超时视为失败</li>
              <li>• 失败将增加惩罚时间</li>
              {isHiddenTimeMode && !timeReached && (
                <li className="text-amber-600 dark:text-amber-400">• 隐藏时间模式：即使投票通过，若时间未到也会增加额外惩罚</li>
              )}
            </ul>
          </div>
          <button
            onClick={handleStartVoteUnlock}
            disabled={loading}
            className="w-full py-3.5 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Vote size={18} />
                发起投票
              </>
            )}
          </button>
        </div>
      );
    }

    // If time not reached yet (and vote unlock not applicable)
    // In hidden time mode, allow unlock attempt but show warning
    if (!timeReached && !isHiddenTimeMode) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">时间未到</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            锁定时间尚未到达，请等待计时结束后再解锁。
          </p>
        </div>
      );
    }

    // Hidden time mode warning component
    const HiddenTimePenaltyWarning = () => (
      !timeReached && isHiddenTimeMode ? (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">隐藏时间模式</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                时间可能未到，尝试解锁将增加 {lock.wrongGuessPenaltyPercent}% 的惩罚时间
              </p>
            </div>
          </div>
        </div>
      ) : null
    );

    // Based on unlock method
    switch (unlockMethod) {
      case 'TIME_ONLY':
        return (
          <div className="text-center py-6">
            <HiddenTimePenaltyWarning />
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Unlock className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {timeReached ? '可以解锁了！' : '尝试解锁'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              {timeReached
                ? '恭喜！你已完成锁定时间，点击下方按钮解锁。'
                : '隐藏时间模式下，你可以尝试解锁，但如果时间未到会有惩罚。'}
            </p>
            <button
              onClick={handleDirectUnlock}
              disabled={loading}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock size={18} />
                  确认解锁
                </>
              )}
            </button>
          </div>
        );

      case 'GUESS_TIME':
        return (
          <div className="py-4">
            <HiddenTimePenaltyWarning />
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-7 h-7 text-purple-500 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">猜测剩余时间</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                猜对即可解锁，猜错将增加 {lock.wrongGuessPenaltyPercent}% 时间
              </p>
            </div>

            {/* Time picker */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setGuessedHours(Math.min(99, guessedHours + 1))}
                  className="w-12 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronUp size={20} />
                </button>
                <div className="text-4xl font-mono font-bold text-slate-800 dark:text-slate-100 my-2 w-16 text-center">
                  {guessedHours.toString().padStart(2, '0')}
                </div>
                <button
                  onClick={() => setGuessedHours(Math.max(0, guessedHours - 1))}
                  className="w-12 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronDown size={20} />
                </button>
                <span className="text-slate-400 dark:text-slate-500 text-xs mt-1">小时</span>
              </div>
              <span className="text-4xl font-bold text-slate-300">:</span>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setGuessedMinutes(Math.min(59, guessedMinutes + 5))}
                  className="w-12 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronUp size={20} />
                </button>
                <div className="text-4xl font-mono font-bold text-slate-800 dark:text-slate-100 my-2 w-16 text-center">
                  {guessedMinutes.toString().padStart(2, '0')}
                </div>
                <button
                  onClick={() => setGuessedMinutes(Math.max(0, guessedMinutes - 5))}
                  className="w-12 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronDown size={20} />
                </button>
                <span className="text-slate-400 dark:text-slate-500 text-xs mt-1">分钟</span>
              </div>
            </div>

            {/* Guess result */}
            {guessResult && !guessResult.correct && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-2xl text-center">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {guessResult.message}
                </p>
                <p className="text-red-400 text-xs mt-1">
                  +{guessResult.penaltyMinutes} 分钟惩罚
                </p>
              </div>
            )}

            <button
              onClick={handleGuessTime}
              disabled={loading}
              className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Clock size={18} />
                  确认猜测
                </>
              )}
            </button>

            <p className="text-slate-400 dark:text-slate-500 text-xs text-center mt-3">
              已猜测 {lock.guessAttempts} 次
            </p>
          </div>
        );

      case 'GUESS_KEY':
        return (
          <div className="py-4">
            <HiddenTimePenaltyWarning />
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Key className="w-7 h-7 text-amber-500 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">选择正确的钥匙</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                选对即可解锁，选错将增加 {lock.wrongGuessPenaltyPercent}% 时间
              </p>
            </div>

            {/* Key selection */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {keys.map((keyIndex) => (
                <button
                  key={keyIndex}
                  onClick={() => setSelectedKeyIndex(keyIndex)}
                  className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                    selectedKeyIndex === keyIndex
                      ? 'bg-amber-500 text-white scale-105 shadow-lg shadow-amber-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Key size={24} />
                </button>
              ))}
            </div>

            {/* Guess result */}
            {guessResult && !guessResult.correct && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-2xl text-center">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {guessResult.message}
                </p>
                <p className="text-red-400 text-xs mt-1">
                  +{guessResult.penaltyMinutes} 分钟惩罚
                </p>
              </div>
            )}

            <button
              onClick={handleGuessKey}
              disabled={loading || selectedKeyIndex === null}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Key size={18} />
                  确认选择
                </>
              )}
            </button>

            <p className="text-slate-400 dark:text-slate-500 text-xs text-center mt-3">
              剩余钥匙: {unlockProgress?.keysRemaining ?? keyCount}
            </p>
          </div>
        );

      case 'VOTE':
        const votesNeeded = unlockProgress?.votesNeeded ?? lock.voteRequired;
        const votesCurrent = unlockProgress?.votesCurrent ?? lock.currentVotes;
        const votesReached = votesCurrent >= votesNeeded;

        if (!votesReached) {
          return (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">需要更多投票</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                还需要 {votesNeeded - votesCurrent} 票才能解锁
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${(votesCurrent / votesNeeded) * 100}%` }}
                />
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-xs">{votesCurrent}/{votesNeeded} 票</p>
            </div>
          );
        }

        return (
          <div className="text-center py-6">
            <HiddenTimePenaltyWarning />
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">投票已达标！</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              已获得足够投票，点击下方按钮解锁。
            </p>
            <button
              onClick={handleDirectUnlock}
              disabled={loading}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock size={18} />
                  确认解锁
                </>
              )}
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center py-6">
            <HiddenTimePenaltyWarning />
            <button
              onClick={handleDirectUnlock}
              disabled={loading}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock size={18} />
                  确认解锁
                </>
              )}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">解锁</h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-2xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default UnlockModal;
