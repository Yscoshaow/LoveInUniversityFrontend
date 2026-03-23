import React, { useState, useEffect } from 'react';
import {
  X, Settings, Puzzle, Loader2,
  EyeOff, Globe, Snowflake, Droplets, Camera, Timer, ShieldOff, Hash,
  Vote, Gift, Dices, Plus, Trash2, Heart, Coins, AlertTriangle
} from 'lucide-react';
import {
  SelfLock, SelfLockSummary, SelfLockBackend, LockExtensionData,
  UpdateLockSettingsRequest, ExtensionConfigRequest
} from '../../types';
import { keyholderApi, extensionApi } from '../../lib/api';
import { TimePickerSheet } from '@/components/ui/mobile-picker';

interface KeyholderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockId: number;
  lock: SelfLock | SelfLockSummary | SelfLockBackend;
  extensions: LockExtensionData[];
  onSettingsUpdated: () => void;
}

type TabType = 'settings' | 'extensions';

export const KeyholderSettingsModal: React.FC<KeyholderSettingsModalProps> = ({
  isOpen,
  onClose,
  lockId,
  lock,
  extensions,
  onSettingsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Settings form state (matches creation wizard options)
  const [hideRemainingTime, setHideRemainingTime] = useState(lock.hideRemainingTime);
  const [isPublic, setIsPublic] = useState(lock.isPublic);
  const [allowKeyholderFreeze, setAllowKeyholderFreeze] = useState(lock.allowKeyholderFreeze);
  const [hygieneOpeningEnabled, setHygieneOpeningEnabled] = useState(lock.hygieneOpeningEnabled);
  const [hygieneOpeningDurationMinutes, setHygieneOpeningDurationMinutes] = useState(lock.hygieneOpeningDurationMinutes);
  const [hygieneOpeningLimitMode, setHygieneOpeningLimitMode] = useState<'DAILY' | 'COOLDOWN'>(lock.hygieneOpeningLimitMode ?? 'DAILY');
  const [hygieneOpeningDailyLimit, setHygieneOpeningDailyLimit] = useState(lock.hygieneOpeningDailyLimit ?? 1);
  const [hygieneOpeningCooldownHours, setHygieneOpeningCooldownHours] = useState(lock.hygieneOpeningCooldownHours ?? 8);
  const [hygieneImageRequired, setHygieneImageRequired] = useState(lock.hygieneImageRequired);
  const [hygieneBypassKeyholder, setHygieneBypassKeyholder] = useState(lock.hygieneBypassKeyholder);
  const [punishmentMode, setPunishmentMode] = useState('punishmentMode' in lock ? (lock as any).punishmentMode ?? false : false);
  const [punishmentModeHours, setPunishmentModeHours] = useState(1);

  // Extension toggle loading state
  const [togglingExt, setTogglingExt] = useState<string | null>(null);
  // 惩罚模式续费
  const [extendingPunishment, setExtendingPunishment] = useState(false);

  // Like unlock extension state
  const likeUnlockExt = extensions.find(e => e.type === 'LIKE_UNLOCK');
  const isLikeUnlockEnabled = likeUnlockExt?.enabled ?? false;
  const [likeUnlockConfig, setLikeUnlockConfig] = useState({ requiredLikes: 10 });

  // Vote unlock extension state
  const voteUnlockExt = extensions.find(e => e.type === 'VOTE_UNLOCK');
  const isVoteUnlockEnabled = voteUnlockExt?.enabled ?? false;
  const [voteUnlockConfig, setVoteUnlockConfig] = useState({
    votesRequired: 10,
    voteTimeoutMinutes: 15,
    penaltyPercent: 10
  });

  // Dice extension state (趣味骰子)
  const diceExt = extensions.find(e => e.type === 'DICE');
  const isDiceEnabled = diceExt?.enabled ?? false;
  const [diceConfig, setDiceConfig] = useState({
    minPercentage: 1,
    maxPercentage: 5,
    cooldownMinutes: 30
  });

  // Verification Picture extension state (验证照片)
  const verificationPictureExt = extensions.find(e => e.type === 'VERIFICATION_PICTURE');
  const isVerificationPictureEnabled = verificationPictureExt?.enabled ?? false;
  const [verificationPictureConfig, setVerificationPictureConfig] = useState({
    scheduleTimes: ['10:00', '14:00', '18:00'] as string[],
    toleranceMinutes: 60,
    shareToCommunity: false,
    penaltyMinutes: null as number | null
  });

  // Coin Toss extension state (投币)
  const coinTossExt = extensions.find(e => e.type === 'COIN_TOSS');
  const isCoinTossEnabled = coinTossExt?.enabled ?? false;
  const [coinTossConfig, setCoinTossConfig] = useState({
    maxCoinsPerPlayer: 10,
    usePercentage: false,
    minutesPerCoin: 30,
    percentagePerCoin: 1.0
  });

  // Reset form when lock changes
  useEffect(() => {
    setHideRemainingTime(lock.hideRemainingTime);
    setIsPublic(lock.isPublic);
    setAllowKeyholderFreeze(lock.allowKeyholderFreeze);
    setHygieneOpeningEnabled(lock.hygieneOpeningEnabled);
    setHygieneOpeningDurationMinutes(lock.hygieneOpeningDurationMinutes);
    setHygieneOpeningLimitMode(lock.hygieneOpeningLimitMode ?? 'DAILY');
    setHygieneOpeningDailyLimit(lock.hygieneOpeningDailyLimit ?? 1);
    setHygieneOpeningCooldownHours(lock.hygieneOpeningCooldownHours ?? 8);
    setHygieneImageRequired(lock.hygieneImageRequired);
    setHygieneBypassKeyholder(lock.hygieneBypassKeyholder);
    setPunishmentMode('punishmentMode' in lock ? (lock as any).punishmentMode ?? false : false);
    setPunishmentModeHours(1);
  }, [lock]);

  // Load existing like unlock config
  useEffect(() => {
    if (likeUnlockExt?.config) {
      const cfg = likeUnlockExt.config as Record<string, unknown>;
      setLikeUnlockConfig({
        requiredLikes: (cfg.requiredLikes as number) ?? 10
      });
    }
  }, [likeUnlockExt]);

  // Load existing vote unlock config
  useEffect(() => {
    if (voteUnlockExt?.config) {
      const cfg = voteUnlockExt.config as Record<string, unknown>;
      setVoteUnlockConfig({
        votesRequired: (cfg.votesRequired as number) ?? 10,
        voteTimeoutMinutes: (cfg.voteTimeoutMinutes as number) ?? 15,
        penaltyPercent: (cfg.penaltyPercent as number) ?? 10
      });
    }
  }, [voteUnlockExt]);

  // Load existing dice config
  useEffect(() => {
    if (diceExt?.config) {
      const cfg = diceExt.config as Record<string, unknown>;
      setDiceConfig({
        minPercentage: (cfg.minPercentage as number) ?? 1,
        maxPercentage: (cfg.maxPercentage as number) ?? 5,
        cooldownMinutes: Math.floor(((diceExt.cooldownSeconds ?? 1800) / 60))
      });
    }
  }, [diceExt]);

  // Load existing verification picture config
  useEffect(() => {
    if (verificationPictureExt?.config) {
      const cfg = verificationPictureExt.config as Record<string, unknown>;
      setVerificationPictureConfig({
        scheduleTimes: (cfg.scheduleTimes as string[]) ?? ['10:00', '14:00', '18:00'],
        toleranceMinutes: (cfg.toleranceMinutes as number) ?? 60,
        shareToCommunity: (cfg.shareToCommunity as boolean) ?? false,
        penaltyMinutes: (cfg.penaltyMinutes as number) ?? null
      });
    }
  }, [verificationPictureExt]);

  // Load existing coin toss config
  useEffect(() => {
    if (coinTossExt?.config) {
      const cfg = coinTossExt.config as Record<string, unknown>;
      setCoinTossConfig({
        maxCoinsPerPlayer: (cfg.maxCoinsPerPlayer as number) ?? 10,
        usePercentage: (cfg.usePercentage as boolean) ?? false,
        minutesPerCoin: (cfg.minutesPerCoin as number) ?? 30,
        percentagePerCoin: (cfg.percentagePerCoin as number) ?? 1.0
      });
    }
  }, [coinTossExt]);

  // Clear messages on tab change
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [activeTab]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Build partial update with only changed fields
    const updates: UpdateLockSettingsRequest = {};
    if (hideRemainingTime !== lock.hideRemainingTime) updates.hideRemainingTime = hideRemainingTime;
    if (isPublic !== lock.isPublic) updates.isPublic = isPublic;
    if (allowKeyholderFreeze !== lock.allowKeyholderFreeze) updates.allowKeyholderFreeze = allowKeyholderFreeze;
    if (hygieneOpeningEnabled !== lock.hygieneOpeningEnabled) updates.hygieneOpeningEnabled = hygieneOpeningEnabled;
    if (hygieneOpeningDurationMinutes !== lock.hygieneOpeningDurationMinutes) updates.hygieneOpeningDurationMinutes = hygieneOpeningDurationMinutes;
    if (hygieneOpeningLimitMode !== (lock.hygieneOpeningLimitMode ?? 'DAILY')) updates.hygieneOpeningLimitMode = hygieneOpeningLimitMode;
    if (hygieneOpeningDailyLimit !== (lock.hygieneOpeningDailyLimit ?? 1)) updates.hygieneOpeningDailyLimit = hygieneOpeningDailyLimit;
    if (hygieneOpeningCooldownHours !== (lock.hygieneOpeningCooldownHours ?? 8)) updates.hygieneOpeningCooldownHours = hygieneOpeningCooldownHours;
    if (hygieneImageRequired !== lock.hygieneImageRequired) updates.hygieneImageRequired = hygieneImageRequired;
    if (hygieneBypassKeyholder !== lock.hygieneBypassKeyholder) updates.hygieneBypassKeyholder = hygieneBypassKeyholder;
    const lockPunishmentMode = 'punishmentMode' in lock ? (lock as any).punishmentMode ?? false : false;
    if (punishmentMode !== lockPunishmentMode) {
      updates.punishmentMode = punishmentMode;
      if (punishmentMode) {
        updates.punishmentModeHours = punishmentModeHours;
      }
    }

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      setSuccess('没有修改');
      return;
    }

    try {
      await keyholderApi.updateSettings(lockId, updates);
      setSuccess('设置已保存');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExtendPunishment = async () => {
    if (punishmentModeHours < 1) return;
    setExtendingPunishment(true);
    setError(null);
    setSuccess(null);
    try {
      await keyholderApi.updateSettings(lockId, {
        punishmentMode: true,
        punishmentModeHours: punishmentModeHours
      });
      setSuccess(`续费成功！已延长 ${punishmentModeHours} 小时`);
      setPunishmentModeHours(1);
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '续费失败');
    } finally {
      setExtendingPunishment(false);
    }
  };

  const handleToggleLikeUnlock = async () => {
    setTogglingExt('LIKE_UNLOCK');
    setError(null);
    try {
      if (isLikeUnlockEnabled) {
        await extensionApi.disableExtension(lockId, 'LIKE_UNLOCK');
      } else {
        const config: ExtensionConfigRequest = {
          config: {
            requiredLikes: likeUnlockConfig.requiredLikes
          },
          cooldownSeconds: 0
        };
        await extensionApi.enableExtension(lockId, 'LIKE_UNLOCK', config);
      }
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingExt(null);
    }
  };

  const handleUpdateLikeUnlockConfig = async () => {
    setTogglingExt('LIKE_UNLOCK_CONFIG');
    setError(null);
    try {
      await extensionApi.updateExtensionConfig(lockId, 'LIKE_UNLOCK', {
        config: {
          requiredLikes: likeUnlockConfig.requiredLikes
        }
      });
      setSuccess('点赞解锁配置已更新');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    } finally {
      setTogglingExt(null);
    }
  };

  const handleToggleVoteUnlock = async () => {
    setTogglingExt('VOTE_UNLOCK');
    setError(null);
    try {
      if (isVoteUnlockEnabled) {
        await extensionApi.disableExtension(lockId, 'VOTE_UNLOCK');
      } else {
        const config: ExtensionConfigRequest = {
          config: {
            votesRequired: voteUnlockConfig.votesRequired,
            voteTimeoutMinutes: voteUnlockConfig.voteTimeoutMinutes,
            penaltyPercent: voteUnlockConfig.penaltyPercent
          },
          cooldownSeconds: 0
        };
        await extensionApi.enableExtension(lockId, 'VOTE_UNLOCK', config);
      }
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingExt(null);
    }
  };

  const handleUpdateVoteUnlockConfig = async () => {
    setTogglingExt('VOTE_UNLOCK_CONFIG');
    setError(null);
    try {
      await extensionApi.updateExtensionConfig(lockId, 'VOTE_UNLOCK', {
        config: {
          votesRequired: voteUnlockConfig.votesRequired,
          voteTimeoutMinutes: voteUnlockConfig.voteTimeoutMinutes,
          penaltyPercent: voteUnlockConfig.penaltyPercent
        }
      });
      setSuccess('拓展配置已更新');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Toggle dice extension
  const handleToggleDice = async () => {
    setTogglingExt('DICE');
    setError(null);
    try {
      if (isDiceEnabled) {
        await extensionApi.disableExtension(lockId, 'DICE');
      } else {
        const config: ExtensionConfigRequest = {
          config: {
            mode: 'FUN_DICE',
            usePercentage: true,
            minPercentage: diceConfig.minPercentage,
            maxPercentage: diceConfig.maxPercentage,
            trustClient: true
          },
          cooldownSeconds: diceConfig.cooldownMinutes * 60
        };
        await extensionApi.enableExtension(lockId, 'DICE', config);
      }
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Update dice config
  const handleUpdateDiceConfig = async () => {
    setTogglingExt('DICE_CONFIG');
    setError(null);
    try {
      await extensionApi.updateExtensionConfig(lockId, 'DICE', {
        config: {
          mode: 'FUN_DICE',
          usePercentage: true,
          minPercentage: diceConfig.minPercentage,
          maxPercentage: diceConfig.maxPercentage,
          trustClient: true
        },
        cooldownSeconds: diceConfig.cooldownMinutes * 60
      });
      setSuccess('趣味骰子配置已更新');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Toggle verification picture extension
  const handleToggleVerificationPicture = async () => {
    setTogglingExt('VERIFICATION_PICTURE');
    setError(null);
    try {
      if (isVerificationPictureEnabled) {
        await extensionApi.disableExtension(lockId, 'VERIFICATION_PICTURE');
      } else {
        const config: ExtensionConfigRequest = {
          config: {
            scheduleTimes: verificationPictureConfig.scheduleTimes,
            toleranceMinutes: verificationPictureConfig.toleranceMinutes,
            shareToCommunity: verificationPictureConfig.shareToCommunity,
            ...(verificationPictureConfig.penaltyMinutes != null
              ? { penaltyMinutes: verificationPictureConfig.penaltyMinutes }
              : {})
          },
          cooldownSeconds: 0
        };
        await extensionApi.enableExtension(lockId, 'VERIFICATION_PICTURE', config);
      }
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Update verification picture config
  const handleUpdateVerificationPictureConfig = async () => {
    setTogglingExt('VERIFICATION_PICTURE_CONFIG');
    setError(null);
    try {
      await extensionApi.updateExtensionConfig(lockId, 'VERIFICATION_PICTURE', {
        config: {
          scheduleTimes: verificationPictureConfig.scheduleTimes,
          toleranceMinutes: verificationPictureConfig.toleranceMinutes,
          shareToCommunity: verificationPictureConfig.shareToCommunity,
          ...(verificationPictureConfig.penaltyMinutes != null
            ? { penaltyMinutes: verificationPictureConfig.penaltyMinutes }
            : {})
        }
      });
      setSuccess('验证照片配置已更新');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Toggle coin toss extension
  const handleToggleCoinToss = async () => {
    setTogglingExt('COIN_TOSS');
    setError(null);
    try {
      if (isCoinTossEnabled) {
        await extensionApi.disableExtension(lockId, 'COIN_TOSS');
      } else {
        const config: ExtensionConfigRequest = {
          config: {
            maxCoinsPerPlayer: coinTossConfig.maxCoinsPerPlayer,
            usePercentage: coinTossConfig.usePercentage,
            minutesPerCoin: coinTossConfig.minutesPerCoin,
            percentagePerCoin: coinTossConfig.percentagePerCoin
          },
          cooldownSeconds: 0
        };
        await extensionApi.enableExtension(lockId, 'COIN_TOSS', config);
      }
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingExt(null);
    }
  };

  // Update coin toss config
  const handleUpdateCoinTossConfig = async () => {
    setTogglingExt('COIN_TOSS_CONFIG');
    setError(null);
    try {
      await extensionApi.updateExtensionConfig(lockId, 'COIN_TOSS', {
        config: {
          maxCoinsPerPlayer: coinTossConfig.maxCoinsPerPlayer,
          usePercentage: coinTossConfig.usePercentage,
          minutesPerCoin: coinTossConfig.minutesPerCoin,
          percentagePerCoin: coinTossConfig.percentagePerCoin
        }
      });
      setSuccess('投币配置已更新');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    } finally {
      setTogglingExt(null);
    }
  };

  const hasChanges =
    hideRemainingTime !== lock.hideRemainingTime ||
    isPublic !== lock.isPublic ||
    allowKeyholderFreeze !== lock.allowKeyholderFreeze ||
    hygieneOpeningEnabled !== lock.hygieneOpeningEnabled ||
    hygieneOpeningDurationMinutes !== lock.hygieneOpeningDurationMinutes ||
    hygieneOpeningLimitMode !== (lock.hygieneOpeningLimitMode ?? 'DAILY') ||
    hygieneOpeningDailyLimit !== (lock.hygieneOpeningDailyLimit ?? 1) ||
    hygieneOpeningCooldownHours !== (lock.hygieneOpeningCooldownHours ?? 8) ||
    hygieneImageRequired !== lock.hygieneImageRequired ||
    hygieneBypassKeyholder !== lock.hygieneBypassKeyholder ||
    punishmentMode !== ('punishmentMode' in lock ? (lock as any).punishmentMode ?? false : false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-slate-600 dark:text-slate-300" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">锁设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'text-slate-800 dark:text-slate-100 border-b-2 border-slate-800'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Settings size={14} />
            基础设置
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'extensions'
                ? 'text-slate-800 dark:text-slate-100 border-b-2 border-slate-800'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Puzzle size={14} />
            拓展管理
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Error / Success messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 text-sm p-3 rounded-xl border border-green-200 dark:border-green-800">
              {success}
            </div>
          )}

          {activeTab === 'settings' ? (
            <>
              {/* Display Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">显示</h3>
                <div className="space-y-2">
                  <ToggleRow
                    icon={<EyeOff size={16} className="text-slate-500 dark:text-slate-400" />}
                    label="隐藏剩余时间"
                    description="佩戴者无法看到剩余时间"
                    checked={hideRemainingTime}
                    onChange={setHideRemainingTime}
                  />
                  <ToggleRow
                    icon={<Globe size={16} className="text-slate-500 dark:text-slate-400" />}
                    label="公开锁"
                    description="其他用户可以看到并互动"
                    checked={isPublic}
                    onChange={setIsPublic}
                  />
                </div>
              </div>

              {/* Controls Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">控制</h3>
                <div className="space-y-2">
                  <ToggleRow
                    icon={<Snowflake size={16} className="text-slate-500 dark:text-slate-400" />}
                    label="允许管理者冻结"
                    description="管理者可以冻结/解冻锁计时"
                    checked={allowKeyholderFreeze}
                    onChange={setAllowKeyholderFreeze}
                  />
                </div>
              </div>

              {/* Punishment Mode Section */}
              <div>
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">惩罚模式</h3>
                <div className="space-y-2">
                  {(() => {
                    const expiresAt = 'punishmentModeExpiresAt' in lock ? (lock as any).punishmentModeExpiresAt : null;
                    const lockPunishmentMode = 'punishmentMode' in lock ? (lock as any).punishmentMode ?? false : false;
                    const isActive = lockPunishmentMode && expiresAt;
                    const coinCost = punishmentModeHours * 3;

                    return (
                      <>
                        {/* Toggle (only show when not active) */}
                        {!isActive && (
                          <label className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-xl transition-colors border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-red-700 dark:text-red-400">开启惩罚模式</div>
                                <div className="text-xs text-red-400">强制公开到操场并置顶，增加时间效果x10</div>
                              </div>
                            </div>
                            <div
                              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
                                punishmentMode ? 'bg-red-500' : 'bg-slate-300'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                setPunishmentMode(!punishmentMode);
                              }}
                            >
                              <div
                                className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${
                                  punishmentMode ? 'translate-x-5.5' : 'translate-x-0.5'
                                }`}
                              />
                            </div>
                          </label>
                        )}

                        {/* Active status */}
                        {isActive && (
                          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />
                              <span className="text-sm font-medium text-red-700 dark:text-red-400">惩罚模式生效中</span>
                            </div>
                            <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                              到期时间：{new Date(expiresAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}

                        {/* Hours selector & coin cost (show when enabling or extending) */}
                        {(punishmentMode || isActive) && (
                          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                {isActive ? '续费时长' : '购买时长'}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="w-7 h-7 rounded-lg bg-red-100 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold hover:bg-red-200 transition-colors"
                                  onClick={() => setPunishmentModeHours(Math.max(1, punishmentModeHours - 1))}
                                >-</button>
                                <input
                                  type="number"
                                  min="1"
                                  value={punishmentModeHours}
                                  onChange={(e) => setPunishmentModeHours(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-14 text-center text-sm font-medium bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg py-1 text-red-700 dark:text-red-400"
                                />
                                <button
                                  type="button"
                                  className="w-7 h-7 rounded-lg bg-red-100 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold hover:bg-red-200 transition-colors"
                                  onClick={() => setPunishmentModeHours(punishmentModeHours + 1)}
                                >+</button>
                                <span className="text-xs text-red-500 dark:text-red-400">小时</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-red-400">费用：3 校园币/小时</span>
                              <span className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                <Coins size={14} /> {coinCost} 校园币
                              </span>
                            </div>
                            {/* Quick select buttons */}
                            <div className="flex gap-1.5">
                              {[1, 3, 6, 12, 24].map(h => (
                                <button
                                  key={h}
                                  type="button"
                                  className={`flex-1 py-1 text-xs rounded-lg transition-colors ${
                                    punishmentModeHours === h
                                      ? 'bg-red-500 text-white'
                                      : 'bg-red-100 text-red-600 dark:text-red-400 hover:bg-red-200'
                                  }`}
                                  onClick={() => setPunishmentModeHours(h)}
                                >{h}h</button>
                              ))}
                            </div>
                            {/* Extend button (only when already active) */}
                            {isActive && (
                              <button
                                type="button"
                                className="w-full py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                onClick={handleExtendPunishment}
                                disabled={extendingPunishment}
                              >
                                {extendingPunishment ? (
                                  <><Loader2 size={14} className="animate-spin" /> 续费中...</>
                                ) : (
                                  <><Coins size={14} /> 续费 {punishmentModeHours} 小时（{coinCost} 校园币）</>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Rules info */}
                        {(punishmentMode || isActive) && (
                          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 space-y-1">
                            <p>• 锁将被强制公开到操场（无论公开设置）</p>
                            <p>• 锁将在操场中置顶显示</p>
                            <p>• 管理者增加时间效果 x10 倍</p>
                            <p>• 减少时间不受影响</p>
                            <p>• 投币时间用完后自动关闭，可随时续费</p>
                          </div>
                        )}

                        {/* Manual disable when active */}
                        {isActive && (
                          <button
                            type="button"
                            className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            onClick={() => setPunishmentMode(false)}
                          >
                            手动关闭惩罚模式（不退币）
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Hygiene Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">卫生开启</h3>
                <div className="space-y-2">
                  <ToggleRow
                    icon={<Droplets size={16} className="text-slate-500 dark:text-slate-400" />}
                    label="启用卫生开启"
                    description="允许佩戴者申请临时卫生开启"
                    checked={hygieneOpeningEnabled}
                    onChange={setHygieneOpeningEnabled}
                  />
                  {hygieneOpeningEnabled && (
                    <>
                      <NumberRow
                        icon={<Timer size={16} className="text-slate-500 dark:text-slate-400" />}
                        label="开启时长"
                        suffix="分钟"
                        value={hygieneOpeningDurationMinutes}
                        min={5}
                        max={120}
                        onChange={setHygieneOpeningDurationMinutes}
                      />
                      <div className="px-4 py-2">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">限制模式</div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => setHygieneOpeningLimitMode('DAILY')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              hygieneOpeningLimitMode === 'DAILY'
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            每日次数
                          </button>
                          <button
                            type="button"
                            onClick={() => setHygieneOpeningLimitMode('COOLDOWN')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              hygieneOpeningLimitMode === 'COOLDOWN'
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            冷却间隔
                          </button>
                        </div>
                      </div>
                      {hygieneOpeningLimitMode === 'DAILY' ? (
                        <NumberRow
                          icon={<Hash size={16} className="text-slate-500 dark:text-slate-400" />}
                          label="每日次数上限"
                          suffix="次"
                          value={hygieneOpeningDailyLimit}
                          min={1}
                          max={3}
                          onChange={setHygieneOpeningDailyLimit}
                        />
                      ) : (
                        <NumberRow
                          icon={<Timer size={16} className="text-slate-500 dark:text-slate-400" />}
                          label="冷却时间"
                          suffix="小时"
                          value={hygieneOpeningCooldownHours}
                          min={1}
                          max={168}
                          onChange={setHygieneOpeningCooldownHours}
                        />
                      )}
                      <ToggleRow
                        icon={<Camera size={16} className="text-slate-500 dark:text-slate-400" />}
                        label="要求拍照"
                        description="卫生开启时需要拍照证明"
                        checked={hygieneImageRequired}
                        onChange={setHygieneImageRequired}
                      />
                      <ToggleRow
                        icon={<ShieldOff size={16} className="text-slate-500 dark:text-slate-400" />}
                        label="免监督者审批"
                        description="卫生开启时无需监督者同意"
                        checked={hygieneBypassKeyholder}
                        onChange={setHygieneBypassKeyholder}
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Like Unlock Extension */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center shadow-sm">
                      <Heart size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">点赞解锁</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">需要社区点赞达标才能解锁</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleLikeUnlock}
                    disabled={togglingExt === 'LIKE_UNLOCK'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isLikeUnlockEnabled
                        ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950'
                    }`}
                  >
                    {togglingExt === 'LIKE_UNLOCK' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isLikeUnlockEnabled ? '关闭' : '启用'}
                  </button>
                </div>

                {!isLikeUnlockEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      启用后锁将强制公开，社区点赞计为解锁进度，不再增加时间。
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">所需点赞数</label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={likeUnlockConfig.requiredLikes}
                        onChange={e => setLikeUnlockConfig({ requiredLikes: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                  </div>
                )}

                {isLikeUnlockEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      修改所需点赞数后点击保存即可生效。
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">所需点赞数</label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={likeUnlockConfig.requiredLikes}
                        onChange={e => setLikeUnlockConfig({ requiredLikes: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                    <button
                      onClick={handleUpdateLikeUnlockConfig}
                      disabled={togglingExt === 'LIKE_UNLOCK_CONFIG'}
                      className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-medium text-sm hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {togglingExt === 'LIKE_UNLOCK_CONFIG' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : '保存拓展配置'}
                    </button>
                  </div>
                )}
              </div>

              {/* Vote Unlock Extension */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-sm">
                      <Vote size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">投票解锁</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">解锁时需社区投票决定结果</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleVoteUnlock}
                    disabled={togglingExt === 'VOTE_UNLOCK'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isVoteUnlockEnabled
                        ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950'
                    }`}
                  >
                    {togglingExt === 'VOTE_UNLOCK' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isVoteUnlockEnabled ? '关闭' : '启用'}
                  </button>
                </div>

                {/* Config form - show when not yet enabled (for setting config before enabling) */}
                {!isVoteUnlockEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      启用前请先配置参数，启用后会立即生效。
                    </p>
                    <VoteUnlockConfigForm config={voteUnlockConfig} onChange={setVoteUnlockConfig} />
                  </div>
                )}

                {/* Config form - show when enabled (for updating config) */}
                {isVoteUnlockEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      当佩戴者尝试解锁时，会在Telegram群组发起投票。先得到指定票数的一方决定结果。
                    </p>
                    <VoteUnlockConfigForm config={voteUnlockConfig} onChange={setVoteUnlockConfig} />
                    <button
                      onClick={handleUpdateVoteUnlockConfig}
                      disabled={togglingExt === 'VOTE_UNLOCK_CONFIG'}
                      className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {togglingExt === 'VOTE_UNLOCK_CONFIG' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : '保存拓展配置'}
                    </button>
                  </div>
                )}
              </div>

              {/* Dice Extension (趣味骰子) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-sm">
                      <Dices size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">趣味骰子</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">掷骰子与系统对决，赢减时输加时</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleDice}
                    disabled={togglingExt === 'DICE'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isDiceEnabled
                        ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950'
                    }`}
                  >
                    {togglingExt === 'DICE' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isDiceEnabled ? '关闭' : '启用'}
                  </button>
                </div>

                {/* Config form - show when not yet enabled */}
                {!isDiceEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      启用前请先配置参数。玩家点数大于系统=减少时间，小于等于=增加时间。
                    </p>
                    <DiceConfigForm config={diceConfig} onChange={setDiceConfig} />
                  </div>
                )}

                {/* Config form - show when enabled */}
                {isDiceEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      时间变化按总锁定时长的百分比计算，在设定范围内随机。
                    </p>
                    <DiceConfigForm config={diceConfig} onChange={setDiceConfig} />
                    <button
                      onClick={handleUpdateDiceConfig}
                      disabled={togglingExt === 'DICE_CONFIG'}
                      className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {togglingExt === 'DICE_CONFIG' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : '保存拓展配置'}
                    </button>
                  </div>
                )}
              </div>

              {/* Coin Toss Extension (投币) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-sm">
                      <Coins size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">投币</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">其他玩家可投币为锁加时间</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleCoinToss}
                    disabled={togglingExt === 'COIN_TOSS'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isCoinTossEnabled
                        ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950'
                    }`}
                  >
                    {togglingExt === 'COIN_TOSS' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isCoinTossEnabled ? '关闭' : '启用'}
                  </button>
                </div>

                {/* Config form - show when not yet enabled */}
                {!isCoinTossEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      启用后锁将强制公开。其他玩家可以用校园点数投币，投入的校园点数全额转给锁主人。
                    </p>
                    <CoinTossConfigForm config={coinTossConfig} onChange={setCoinTossConfig} />
                  </div>
                )}

                {/* Config form - show when enabled */}
                {isCoinTossEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      每枚硬币消耗1校园点数，增加设定的时间。修改配置后点击保存即可生效。
                    </p>
                    <CoinTossConfigForm config={coinTossConfig} onChange={setCoinTossConfig} />
                    <button
                      onClick={handleUpdateCoinTossConfig}
                      disabled={togglingExt === 'COIN_TOSS_CONFIG'}
                      className="w-full py-2.5 rounded-xl bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {togglingExt === 'COIN_TOSS_CONFIG' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : '保存拓展配置'}
                    </button>
                  </div>
                )}
              </div>

              {/* Verification Picture Extension (验证照片) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
                      <Camera size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">验证照片</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">按计划要求佩戴者提交验证照片</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleVerificationPicture}
                    disabled={togglingExt === 'VERIFICATION_PICTURE'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isVerificationPictureEnabled
                        ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950'
                    }`}
                  >
                    {togglingExt === 'VERIFICATION_PICTURE' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isVerificationPictureEnabled ? '关闭' : '启用'}
                  </button>
                </div>

                {/* Config form - show when not yet enabled */}
                {!isVerificationPictureEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      启用前请先配置参数。佩戴者需在指定时间段内提交验证照片，逾期将受到惩罚。
                    </p>
                    <VerificationPictureConfigForm
                      config={verificationPictureConfig}
                      onChange={setVerificationPictureConfig}
                      isPublicLock={isPublic}
                    />
                  </div>
                )}

                {/* Config form - show when enabled */}
                {isVerificationPictureEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      佩戴者需在每个计划时间的容差范围内提交验证照片。未按时提交将增加锁定时间。
                    </p>
                    <VerificationPictureConfigForm
                      config={verificationPictureConfig}
                      onChange={setVerificationPictureConfig}
                      isPublicLock={isPublic}
                    />
                    <button
                      onClick={handleUpdateVerificationPictureConfig}
                      disabled={togglingExt === 'VERIFICATION_PICTURE_CONFIG'}
                      className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {togglingExt === 'VERIFICATION_PICTURE_CONFIG' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : '保存拓展配置'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer - Save button (only for settings tab) */}
        {activeTab === 'settings' && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleSaveSettings}
              disabled={saving || !hasChanges}
              className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium text-sm transition-all hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                '保存设置'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Dice config form (趣味骰子)
const DiceConfigForm: React.FC<{
  config: { minPercentage: number; maxPercentage: number; cooldownMinutes: number };
  onChange: (config: { minPercentage: number; maxPercentage: number; cooldownMinutes: number }) => void;
}> = ({ config, onChange }) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">最小百分比</label>
        <div className="relative">
          <input
            type="number"
            min="0.5"
            max="50"
            step="0.5"
            value={config.minPercentage}
            onChange={e => onChange({ ...config, minPercentage: Number(e.target.value) })}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">%</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">最大百分比</label>
        <div className="relative">
          <input
            type="number"
            min="0.5"
            max="50"
            step="0.5"
            value={config.maxPercentage}
            onChange={e => onChange({ ...config, maxPercentage: Number(e.target.value) })}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">%</span>
        </div>
      </div>
    </div>
    <p className="text-xs text-slate-400 dark:text-slate-500">时间变化将在此百分比范围内随机（基于总锁定时长）</p>
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">冷却时间（分钟）</label>
      <input
        type="number"
        min="1"
        max="1440"
        value={config.cooldownMinutes}
        onChange={e => onChange({ ...config, cooldownMinutes: Number(e.target.value) })}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">两次投掷之间的间隔时间</p>
    </div>
  </>
);

// Verification Picture config form (验证照片)
const VerificationPictureConfigForm: React.FC<{
  config: { scheduleTimes: string[]; toleranceMinutes: number; shareToCommunity: boolean; penaltyMinutes: number | null };
  onChange: (config: { scheduleTimes: string[]; toleranceMinutes: number; shareToCommunity: boolean; penaltyMinutes: number | null }) => void;
  isPublicLock: boolean;
}> = ({ config, onChange, isPublicLock }) => {
  const addScheduleTime = () => {
    onChange({ ...config, scheduleTimes: [...config.scheduleTimes, '12:00'] });
  };

  const removeScheduleTime = (index: number) => {
    const newTimes = config.scheduleTimes.filter((_, i) => i !== index);
    onChange({ ...config, scheduleTimes: newTimes });
  };

  const updateScheduleTime = (index: number, value: string) => {
    const newTimes = [...config.scheduleTimes];
    newTimes[index] = value;
    onChange({ ...config, scheduleTimes: newTimes });
  };

  return (
    <>
      {/* Schedule Times */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">计划时间</label>
          <button
            type="button"
            onClick={addScheduleTime}
            className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:text-violet-400 font-medium transition-colors"
          >
            <Plus size={12} />
            添加时间
          </button>
        </div>
        <div className="space-y-2">
          {config.scheduleTimes.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <TimePickerSheet
                value={time}
                onChange={(v) => updateScheduleTime(index, v)}
              />
              <button
                type="button"
                onClick={() => removeScheduleTime(index)}
                disabled={config.scheduleTimes.length <= 1}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">佩戴者需在每个计划时间附近提交验证照片</p>
      </div>

      {/* Tolerance Minutes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">容差时间（±分钟）</label>
        <input
          type="number"
          min="5"
          max="480"
          value={config.toleranceMinutes}
          onChange={e => onChange({ ...config, toleranceMinutes: Number(e.target.value) })}
          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">在计划时间前后此分钟数内提交均有效</p>
      </div>

      {/* Share to Community - only for public locks */}
      {isPublicLock && (
        <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Globe size={16} className="text-slate-500 dark:text-slate-400" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">分享到社区</div>
              <div className="text-xs text-slate-400 dark:text-slate-500 truncate">验证照片将在社区公开展示</div>
            </div>
          </div>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
              config.shareToCommunity ? 'bg-slate-800' : 'bg-slate-300'
            }`}
            onClick={(e) => {
              e.preventDefault();
              onChange({ ...config, shareToCommunity: !config.shareToCommunity });
            }}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${
                config.shareToCommunity ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </label>
      )}

      {/* Custom Penalty Minutes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">自定义惩罚（分钟）</label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-slate-400 dark:text-slate-500">使用默认</span>
            <input
              type="checkbox"
              checked={config.penaltyMinutes == null}
              onChange={e => onChange({
                ...config,
                penaltyMinutes: e.target.checked ? null : 60
              })}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-violet-600 dark:text-violet-400 focus:ring-violet-500/20"
            />
          </label>
        </div>
        {config.penaltyMinutes != null && (
          <input
            type="number"
            min="0"
            max="10080"
            value={config.penaltyMinutes}
            onChange={e => onChange({ ...config, penaltyMinutes: Number(e.target.value) })}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
          />
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {config.penaltyMinutes == null
            ? '将使用难度等级的默认惩罚时间'
            : '未按时提交验证照片时增加的锁定时间'}
        </p>
      </div>
    </>
  );
};

// Coin toss config form (投币)
const CoinTossConfigForm: React.FC<{
  config: { maxCoinsPerPlayer: number; usePercentage: boolean; minutesPerCoin: number; percentagePerCoin: number };
  onChange: (config: { maxCoinsPerPlayer: number; usePercentage: boolean; minutesPerCoin: number; percentagePerCoin: number }) => void;
}> = ({ config, onChange }) => (
  <>
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">每人最多投币数</label>
      <input
        type="number"
        min="1"
        max="10000"
        value={config.maxCoinsPerPlayer}
        onChange={e => onChange({ ...config, maxCoinsPerPlayer: Math.max(1, Math.min(10000, Number(e.target.value))) })}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每位玩家对此锁最多可投的硬币数量</p>
    </div>

    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">每币增加时间</label>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => onChange({ ...config, usePercentage: false })}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
            !config.usePercentage
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          固定时间
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, usePercentage: true })}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
            config.usePercentage
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          百分比
        </button>
      </div>

      {config.usePercentage ? (
        <div>
          <div className="relative">
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={config.percentagePerCoin}
              onChange={e => onChange({ ...config, percentagePerCoin: Math.max(0.1, Math.min(100, Number(e.target.value))) })}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">%</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每枚硬币增加总时长的 {config.percentagePerCoin}%</p>
        </div>
      ) : (
        <div>
          <input
            type="number"
            min="1"
            max="1440"
            value={config.minutesPerCoin}
            onChange={e => onChange({ ...config, minutesPerCoin: Math.max(1, Math.min(1440, Number(e.target.value))) })}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每枚硬币增加 {config.minutesPerCoin} 分钟</p>
        </div>
      )}
    </div>
  </>
);

// Vote unlock config form
const VoteUnlockConfigForm: React.FC<{
  config: { votesRequired: number; voteTimeoutMinutes: number; penaltyPercent: number };
  onChange: (config: { votesRequired: number; voteTimeoutMinutes: number; penaltyPercent: number }) => void;
}> = ({ config, onChange }) => (
  <>
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">所需票数</label>
      <input
        type="number"
        min="1"
        max="100"
        value={config.votesRequired}
        onChange={e => onChange({ ...config, votesRequired: Number(e.target.value) })}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">先得到此票数的一方获胜（同意/拒绝）</p>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">投票超时（分钟）</label>
      <input
        type="number"
        min="1"
        max="1440"
        value={config.voteTimeoutMinutes}
        onChange={e => onChange({ ...config, voteTimeoutMinutes: Number(e.target.value) })}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">超时视为投票失败</p>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">失败惩罚（%）</label>
      <input
        type="number"
        min="0"
        max="100"
        value={config.penaltyPercent}
        onChange={e => onChange({ ...config, penaltyPercent: Number(e.target.value) })}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">投票失败时增加总时长的此百分比作为惩罚</p>
    </div>
  </>
);

// Toggle row component
const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ icon, label, description, checked, onChange }) => (
  <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
        {description && <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{description}</div>}
      </div>
    </div>
    <div
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
        checked ? 'bg-slate-800' : 'bg-slate-300'
      }`}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </div>
  </label>
);

// Number input row component
const NumberRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}> = ({ icon, label, suffix, value, min, max, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{suffix}</span>
    </div>
  </div>
);

export default KeyholderSettingsModal;
