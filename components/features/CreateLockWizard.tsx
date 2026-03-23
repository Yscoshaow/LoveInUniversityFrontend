import React, { useState, useCallback, useEffect } from 'react';
import {
  Lock, Key, Users, Settings, ChevronLeft, ChevronRight, X,
  Dices, Shield, Eye, EyeOff, Snowflake, Heart, AlertCircle, Camera,
  Search, Loader2, Check, UserPlus, Vote, Plus, Minus, Clock, Bluetooth, Coins
} from 'lucide-react';
import {
  LockTypeV2, TimeConfigMode, LockDifficulty, UnlockMethod,
  KeyholderPermission, ExtensionType, CreateSelfLockRequest,
  LOCK_TYPE_NAMES, EXTENSION_NAMES,
  FollowUserItem, ExtensionEnableRequest, LockBoxType
} from '../../types';
import { selfLockApi, supervisionApi, followApi } from '../../lib/api';
import { CameraCapture } from '../ui';
import { TimePickerSheet } from '@/components/ui/mobile-picker';
import { BleEnvironmentWarning } from '../ui/BleEnvironmentWarning';
import { BleScanPicker } from '../ui/BleScanPicker';
import { useCreateLockV2 } from '../../hooks';
import { useMySupervisor } from '../../hooks/useSupervision';
import { useSuojiLockBox } from '../../hooks/useSuojiLockBox';
import { useYiciyuanLockBox, hexToBytes } from '../../hooks/useYiciyuanLockBox';
import { useOkgssLockBox } from '../../hooks/useOkgssLockBox';
import { getBleAdapter } from '../../lib/ble';
import { yiciyuanApi } from '../../lib/api';
import { YiciyuanLoginModal } from './YiciyuanLoginModal';

interface CreateLockWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'type' | 'duration' | 'options' | 'extensions' | 'review';

const STEPS: WizardStep[] = ['type', 'duration', 'options', 'extensions', 'review'];

const STEP_TITLES: Record<WizardStep, string> = {
  type: '锁类型',
  duration: '时长设置',
  options: '锁选项',
  extensions: '扩展功能',
  review: '确认创建'
};

const DIFFICULTIES: { value: LockDifficulty; label: string; desc: string }[] = [
  { value: 'EASY', label: '简单', desc: '±5% 偏差 · 点赞+10分钟' },
  { value: 'NORMAL', label: '普通', desc: '±15% 偏差 · 点赞+30分钟' },
  { value: 'HARD', label: '困难', desc: '±30% 偏差 · 点赞+1.5小时' },
  { value: 'EXTREME', label: '极限', desc: '±50% 偏差 · 点赞+4小时' },
];

// TODO: 扩展功能列表暂时禁用
// const AVAILABLE_EXTENSIONS: { type: ExtensionType; icon: React.ReactNode; desc: string; defaultCooldown: number }[] = [
//   { type: 'WHEEL_OF_FORTUNE', icon: <Dices size={20} />, desc: '转动轮盘获得随机奖惩（难度越高变化越大）', defaultCooldown: 3600 },
//   { type: 'DICE', icon: <Dices size={20} />, desc: '和系统掷骰子比大小，赢了减时间', defaultCooldown: 3600 },
//   { type: 'TASKS', icon: <Settings size={20} />, desc: 'Keyholder可以分配任务', defaultCooldown: 0 },
//   { type: 'RANDOM_EVENTS', icon: <AlertCircle size={20} />, desc: '系统随机触发事件影响锁', defaultCooldown: 0 }
// ];

// 阻止数字输入框中的科学计数法字符
const blockScientificNotation = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

// 将数字 clamp 到 [min, max] 范围
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// 解析数字输入，自动剔除前导零
const parseNumInput = (raw: string, min: number, max: number): number => {
  if (raw === '' || raw === '-') return min;
  const num = parseInt(raw, 10);
  if (isNaN(num)) return min;
  return clamp(num, min, max);
};

// 最大锁定时长：3年 = 26280小时
const MAX_LOCK_HOURS = 26280;

export const CreateLockWizard: React.FC<CreateLockWizardProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');
  const [error, setError] = useState<string | null>(null);

  // Use React Query mutation for creating lock
  const createLockMutation = useCreateLockV2();

  // Check if user has active supervisor (supervision agreement)
  const { data: supervisorData } = useMySupervisor();
  const activeSupervisor = supervisorData?.supervisor?.status === 'ACTIVE' ? supervisorData.supervisor : null;

  // Form state
  const [lockType, setLockType] = useState<LockTypeV2>('SELF');
  const [timeConfigMode, setTimeConfigMode] = useState<TimeConfigMode>('FIXED_VARIANCE');
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [minDurationHours, setMinDurationHours] = useState(1);
  const [maxDurationHours, setMaxDurationHours] = useState(2);
  const [difficulty, setDifficulty] = useState<LockDifficulty>('NORMAL');
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>('TIME_ONLY');
  const [hideRemainingTime, setHideRemainingTime] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [allowKeyholderFreeze, setAllowKeyholderFreeze] = useState(false);
  const wearerHasVeto = false;
  const [maxTotalDaysEnabled, setMaxTotalDaysEnabled] = useState(false);
  const [maxTotalDays, setMaxTotalDays] = useState(30);
  const [hygieneOpeningEnabled, setHygieneOpeningEnabled] = useState(false);
  const [hygieneOpeningDuration, setHygieneOpeningDuration] = useState(30);
  const [hygieneOpeningLimitMode, setHygieneOpeningLimitMode] = useState<'DAILY' | 'COOLDOWN'>('DAILY');
  const [hygieneOpeningDailyLimit, setHygieneOpeningDailyLimit] = useState(1);
  const [hygieneOpeningCooldownHours, setHygieneOpeningCooldownHours] = useState(8);
  const [hygieneImageRequired, setHygieneImageRequired] = useState(true); // 默认需要图片验证
  const [hygieneBypassKeyholder, setHygieneBypassKeyholder] = useState(false); // 卫生开启免监督者审批
  // 点赞解锁扩展
  const [likeUnlockEnabled, setLikeUnlockEnabled] = useState(false);
  const [likeUnlockRequiredLikes, setLikeUnlockRequiredLikes] = useState(10);
  // 投票解锁扩展
  const [voteUnlockEnabled, setVoteUnlockEnabled] = useState(false);
  const [voteUnlockConfig, setVoteUnlockConfig] = useState({
    votesRequired: 10,
    voteTimeoutMinutes: 15,
    penaltyPercent: 10
  });
  // 趣味骰子扩展
  const [diceEnabled, setDiceEnabled] = useState(false);
  const [diceConfig, setDiceConfig] = useState({
    minPercentage: 1,
    maxPercentage: 5,
    cooldownMinutes: 30
  });
  // 验证照片扩展
  const [verificationPictureEnabled, setVerificationPictureEnabled] = useState(false);
  const [verificationPictureConfig, setVerificationPictureConfig] = useState<{
    scheduleTimes: string[];
    toleranceMinutes: number;
    shareToCommunity: boolean;
    penaltyMinutes: number | null;
  }>({
    scheduleTimes: ['10:00', '14:00', '18:00'],
    toleranceMinutes: 60,
    shareToCommunity: false,
    penaltyMinutes: null
  });
  // 投币扩展
  const [coinTossEnabled, setCoinTossEnabled] = useState(false);
  const [coinTossConfig, setCoinTossConfig] = useState({
    maxCoinsPerPlayer: 10,
    usePercentage: false,
    minutesPerCoin: 30,
    percentagePerCoin: 1
  });
  const [primaryKeyholderId, setPrimaryKeyholderId] = useState<number | undefined>();
  const primaryKeyholderPermission: KeyholderPermission = 'FULL_CONTROL';

  // Keyholder search state
  const [keyholderSearchQuery, setKeyholderSearchQuery] = useState('');
  const [keyholderSearchResults, setKeyholderSearchResults] = useState<{ id: number; firstName: string; lastName?: string; username?: string; photoUrl?: string }[]>([]);
  const [isSearchingKeyholder, setIsSearchingKeyholder] = useState(false);
  const [selectedKeyholder, setSelectedKeyholder] = useState<{ id: number; firstName: string; lastName?: string; username?: string; photoUrl?: string } | null>(null);
  const [followedUsers, setFollowedUsers] = useState<FollowUserItem[]>([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);

  // Photo capture state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Lock box state
  const [lockBoxType, setLockBoxType] = useState<LockBoxType>('NONE');
  const [lockBoxDeviceName, setLockBoxDeviceName] = useState<string | null>(null);
  const [lockBoxLocked, setLockBoxLocked] = useState(false);
  const [suojiUnlocked, setSuojiUnlocked] = useState(false); // Suoji: unlocked for key placement
  const [suojiUnlocking, setSuojiUnlocking] = useState(false);
  const suojiLockBox = useSuojiLockBox();

  // 役次元 lock box state (YS0x + OKGSS, both under YICIYUAN type)
  const yiciyuanLockBox = useYiciyuanLockBox();
  const okgssLockBox = useOkgssLockBox();
  const [showYiciyuanLogin, setShowYiciyuanLogin] = useState(false);
  const [yiciyuanLoggedIn, setYiciyuanLoggedIn] = useState(false);
  const [yiciyuanBinding, setYiciyuanBinding] = useState(false);
  const [yiciyuanMac, setYiciyuanMac] = useState<string | null>(null);
  const [yiciyuanBound, setYiciyuanBound] = useState(false); // 已绑定但还没锁好
  const [yiciyuanCredentials, setYiciyuanCredentials] = useState<{ keyA: Uint8Array; tokenB: Uint8Array } | null>(null);
  const [yiciyuanUnlocking, setYiciyuanUnlocking] = useState(false);

  // BLE scan picker for Yiciyuan device selection
  const [showBlePicker, setShowBlePicker] = useState(false);

  // 点赞解锁/投币时强制公开
  useEffect(() => {
    if (likeUnlockEnabled || coinTossEnabled) {
      setIsPublic(true);
    }
  }, [likeUnlockEnabled, coinTossEnabled]);

  // Auto-configure for supervision agreement: force PRIVATE lock with supervisor as keyholder
  useEffect(() => {
    if (activeSupervisor && isOpen) {
      setLockType('PRIVATE');
      setPrimaryKeyholderId(activeSupervisor.supervisorId);
      setSelectedKeyholder({
        id: activeSupervisor.supervisorId,
        firstName: activeSupervisor.supervisorName,
        username: activeSupervisor.supervisorUsername ?? undefined,
        photoUrl: activeSupervisor.supervisorAvatar ?? undefined
      });
    }
  }, [activeSupervisor, isOpen]);

  // Fetch followed users for quick select when PRIVATE lock type is selected
  useEffect(() => {
    if (lockType === 'PRIVATE' && followedUsers.length === 0 && isOpen) {
      const fetchFollowedUsers = async () => {
        setIsLoadingFollowed(true);
        try {
          const users = await followApi.getQuickSelect(50);
          setFollowedUsers(users);
        } catch (err) {
          console.error('Failed to fetch followed users:', err);
        } finally {
          setIsLoadingFollowed(false);
        }
      };
      fetchFollowedUsers();
    }
  }, [lockType, isOpen]);

  // Debounced keyholder search
  useEffect(() => {
    if (keyholderSearchQuery.length < 2) {
      setKeyholderSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingKeyholder(true);
      try {
        const results = await supervisionApi.searchUsers(keyholderSearchQuery);
        setKeyholderSearchResults(results);
      } catch (err) {
        console.error('Failed to search users:', err);
        setKeyholderSearchResults([]);
      } finally {
        setIsSearchingKeyholder(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [keyholderSearchQuery]);

  // Auto-check 役次元 login status when wizard opens with YICIYUAN lock box
  useEffect(() => {
    if (lockBoxType === 'YICIYUAN' && isOpen && !yiciyuanLoggedIn) {
      yiciyuanApi.getAccount().then(status => {
        if (status.hasAccount) {
          setYiciyuanLoggedIn(true);
        }
      }).catch(() => {});
    }
  }, [lockBoxType, isOpen, yiciyuanLoggedIn]);

  // Handle selecting a keyholder
  const handleSelectKeyholder = (user: { id: number; firstName: string; lastName?: string; username?: string; photoUrl?: string }) => {
    setSelectedKeyholder(user);
    setPrimaryKeyholderId(user.id);
    setKeyholderSearchQuery('');
    setKeyholderSearchResults([]);
  };

  // Handle clearing selected keyholder
  const handleClearKeyholder = () => {
    setSelectedKeyholder(null);
    setPrimaryKeyholderId(undefined);
  };

  const currentStepIndex = STEPS.indexOf(currentStep);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  }, [currentStepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex]);

  // TODO: 扩展功能暂时禁用
  // const toggleExtension = useCallback((ext: ExtensionType) => {
  //   setSelectedExtensions(prev =>
  //     prev.includes(ext)
  //       ? prev.filter(e => e !== ext)
  //       : [...prev, ext]
  //   );
  // }, []);

  // Handle camera capture - original for upload, blurred for preview
  const handleCameraCapture = useCallback((originalImage: string, blurredPreview: string) => {
    // Show blurred preview to user
    setImagePreview(blurredPreview);
    // Convert original (unblurred) image to File for upload
    const byteString = atob(originalImage.split(',')[1]);
    const mimeString = originalImage.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8ClampedArray(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], 'reward-image.jpg', { type: mimeString });
    setSelectedImage(file);
  }, []);

  // Clear captured image
  const handleClearImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
  }, []);

  const buildRequest = useCallback((): CreateSelfLockRequest => {
    const totalMinutes = durationHours * 60 + durationMinutes;

    const request: CreateSelfLockRequest = {
      lockType,
      timeConfigMode,
      difficulty,
      unlockMethod,
      hideRemainingTime,
      isPublic,
      allowKeyholderFreeze,
      wearerHasVeto,
      hygieneOpeningEnabled,
      hygieneOpeningDurationMinutes: hygieneOpeningEnabled ? hygieneOpeningDuration : undefined,
      hygieneOpeningLimitMode: hygieneOpeningEnabled ? hygieneOpeningLimitMode : undefined,
      hygieneOpeningDailyLimit: hygieneOpeningEnabled && hygieneOpeningLimitMode === 'DAILY' ? hygieneOpeningDailyLimit : undefined,
      hygieneOpeningCooldownHours: hygieneOpeningEnabled && hygieneOpeningLimitMode === 'COOLDOWN' ? hygieneOpeningCooldownHours : undefined,
      hygieneBypassKeyholder: hygieneOpeningEnabled ? hygieneBypassKeyholder : undefined,
      maxTotalDays: maxTotalDaysEnabled ? maxTotalDays : undefined
    };

    if (timeConfigMode === 'FIXED_VARIANCE') {
      request.durationMinutes = totalMinutes;
    } else {
      request.minDurationMinutes = minDurationHours * 60;
      request.maxDurationMinutes = maxDurationHours * 60;
    }

    if (lockType === 'PRIVATE' && primaryKeyholderId) {
      request.primaryKeyholderId = primaryKeyholderId;
      request.primaryKeyholderPermission = primaryKeyholderPermission;
    }

    // 扩展功能
    const extensions: ExtensionEnableRequest[] = [];

    // 点赞解锁扩展
    if (likeUnlockEnabled) {
      extensions.push({
        type: 'LIKE_UNLOCK',
        config: {
          requiredLikes: likeUnlockRequiredLikes
        },
        cooldownSeconds: 0
      });
    }

    // 投票解锁扩展
    if (voteUnlockEnabled) {
      extensions.push({
        type: 'VOTE_UNLOCK',
        config: {
          votesRequired: voteUnlockConfig.votesRequired,
          voteTimeoutMinutes: voteUnlockConfig.voteTimeoutMinutes,
          penaltyPercent: voteUnlockConfig.penaltyPercent
        },
        cooldownSeconds: 0  // 投票解锁没有冷却
      });
    }

    // 趣味骰子扩展
    if (diceEnabled) {
      extensions.push({
        type: 'DICE',
        config: {
          mode: 'FUN_DICE',
          usePercentage: true,
          minPercentage: diceConfig.minPercentage,
          maxPercentage: diceConfig.maxPercentage,
          trustClient: true
        },
        cooldownSeconds: diceConfig.cooldownMinutes * 60
      });
    }

    // 验证照片扩展
    if (verificationPictureEnabled) {
      extensions.push({
        type: 'VERIFICATION_PICTURE',
        config: {
          scheduleTimes: verificationPictureConfig.scheduleTimes,
          toleranceMinutes: verificationPictureConfig.toleranceMinutes,
          shareToCommunity: verificationPictureConfig.shareToCommunity,
          ...(verificationPictureConfig.penaltyMinutes !== null ? { penaltyMinutes: verificationPictureConfig.penaltyMinutes } : {})
        },
        cooldownSeconds: 0
      });
    }

    // 投币扩展
    if (coinTossEnabled) {
      extensions.push({
        type: 'COIN_TOSS',
        config: {
          maxCoinsPerPlayer: coinTossConfig.maxCoinsPerPlayer,
          usePercentage: coinTossConfig.usePercentage,
          minutesPerCoin: coinTossConfig.minutesPerCoin,
          percentagePerCoin: coinTossConfig.percentagePerCoin
        },
        cooldownSeconds: 0
      });
    }

    if (extensions.length > 0) {
      request.enabledExtensions = extensions;
    }

    // Lock box
    if (lockBoxType !== 'NONE') {
      request.lockBoxType = lockBoxType;
      if ((lockBoxType === 'SUOJI' || lockBoxType === 'YICIYUAN') && lockBoxDeviceName) {
        request.lockBoxDeviceName = lockBoxDeviceName;
      }
    }

    return request;
  }, [
    lockType, timeConfigMode, durationHours, durationMinutes,
    minDurationHours, maxDurationHours, difficulty, unlockMethod,
    hideRemainingTime, isPublic, allowKeyholderFreeze, wearerHasVeto,
    maxTotalDaysEnabled, maxTotalDays,
    hygieneOpeningEnabled, hygieneOpeningDuration, hygieneOpeningLimitMode,
    hygieneOpeningDailyLimit, hygieneOpeningCooldownHours, hygieneBypassKeyholder,
    primaryKeyholderId, primaryKeyholderPermission,
    lockBoxType, lockBoxDeviceName,
    likeUnlockEnabled, likeUnlockRequiredLikes,
    voteUnlockEnabled, voteUnlockConfig,
    diceEnabled, diceConfig,
    verificationPictureEnabled, verificationPictureConfig,
    coinTossEnabled, coinTossConfig
  ]);

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate lock box
    if (lockBoxType === 'SUOJI' && !lockBoxLocked) {
      setError('请先连接锁盒并发送上锁命令');
      return;
    }
    if (lockBoxType === 'YICIYUAN' && !lockBoxLocked) {
      setError('请先连接并绑定役次元锁盒');
      return;
    }

    try {
      const request = buildRequest();
      const result = await createLockMutation.mutateAsync(request);

      // Upload image if selected (only for PHOTO mode)
      if (lockBoxType === 'PHOTO' && selectedImage && result.lock?.id) {
        try {
          await selfLockApi.uploadLockImage(result.lock.id, selectedImage);
        } catch (imgError) {
          console.error('Failed to upload image:', imgError);
          // Continue even if image upload fails
        }
      }

      // Bind Yiciyuan device to the newly created lock
      if (lockBoxType === 'YICIYUAN' && yiciyuanMac && result.lock?.id) {
        try {
          await yiciyuanApi.bindDeviceToLock(yiciyuanMac, result.lock.id);
        } catch (bindError) {
          console.error('Failed to bind device to lock:', bindError);
          // Continue even if binding fails - device can be re-bound later
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }, [buildRequest, selectedImage, lockBoxType, lockBoxLocked, yiciyuanMac, onSuccess, onClose, createLockMutation]);

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return (
          <div className="space-y-4">
            {activeSupervisor && (
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-xl p-3 flex items-start gap-3">
                <Shield size={20} className="text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-400">监督协议生效中</p>
                  <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                    你的监督者 <b>{activeSupervisor.supervisorName}</b> 将自动成为 Keyholder，锁类型已设为私有锁
                  </p>
                </div>
              </div>
            )}
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">选择锁的类型</p>
            <div className="grid grid-cols-1 gap-3">
              {(['SELF', 'SHARED', 'PRIVATE'] as LockTypeV2[]).map(type => (
                <button
                  key={type}
                  onClick={() => !activeSupervisor && setLockType(type)}
                  disabled={!!activeSupervisor}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    lockType === type
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                  } ${activeSupervisor ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {type === 'SELF' && <Lock className="text-primary" size={24} />}
                    {type === 'SHARED' && <Users className="text-primary" size={24} />}
                    {type === 'PRIVATE' && <Key className="text-primary" size={24} />}
                    <div>
                      <h4 className="font-semibold">{LOCK_TYPE_NAMES[type]}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {type === 'SELF' && '只有自己可以控制'}
                        {type === 'SHARED' && '任何人都可以成为Keyholder'}
                        {type === 'PRIVATE' && '指定Keyholder控制'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {lockType === 'PRIVATE' && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {activeSupervisor ? 'Keyholder（由监督协议指定）' : '选择 Keyholder'}
                  </label>

                  {/* Selected Keyholder Display */}
                  {selectedKeyholder ? (
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-primary/30">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        {selectedKeyholder.photoUrl ? (
                          <img src={selectedKeyholder.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white font-bold">
                            {selectedKeyholder.firstName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {selectedKeyholder.firstName}{selectedKeyholder.lastName ? ` ${selectedKeyholder.lastName}` : ''}
                        </p>
                        {selectedKeyholder.username && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{selectedKeyholder.username}</p>
                        )}
                      </div>
                      {!activeSupervisor && (
                        <button
                          type="button"
                          onClick={handleClearKeyholder}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Quick Select from Followed Users */}
                      {followedUsers.length > 0 && !keyholderSearchQuery && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                            <Users size={12} />
                            快速选择关注的人
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {followedUsers.slice(0, 6).map(user => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleSelectKeyholder({
                                  id: user.id,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  username: user.username,
                                  photoUrl: user.photoUrl
                                })}
                                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all"
                              >
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                  {user.photoUrl ? (
                                    <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white text-xs font-bold">
                                      {user.firstName.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <span className="truncate max-w-[80px]">{user.firstName}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {isLoadingFollowed && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-slate-500" />
                        </div>
                      )}

                      {/* Divider */}
                      {followedUsers.length > 0 && !keyholderSearchQuery && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                          <span className="text-xs text-slate-400 dark:text-slate-500">或搜索</span>
                          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        </div>
                      )}

                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={keyholderSearchQuery}
                          onChange={(e) => setKeyholderSearchQuery(e.target.value)}
                          placeholder="搜索用户名..."
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        {isSearchingKeyholder && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400 dark:text-slate-500" />
                        )}
                      </div>

                      {/* Search Results */}
                      {keyholderSearchResults.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                          {keyholderSearchResults.map(user => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectKeyholder(user)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                {user.photoUrl ? (
                                  <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white text-sm font-bold">
                                    {user.firstName.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                                  {user.firstName}{user.lastName ? ` ${user.lastName}` : ''}
                                </p>
                                {user.username && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user.username}</p>
                                )}
                              </div>
                              <UserPlus size={16} className="text-primary shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {keyholderSearchQuery.length >= 2 && keyholderSearchResults.length === 0 && !isSearchingKeyholder && (
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">未找到用户</p>
                      )}

                      {keyholderSearchQuery.length < 2 && followedUsers.length === 0 && !isLoadingFollowed && (
                        <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-2">输入用户名搜索</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        );

      case 'duration':
        return (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTimeConfigMode('FIXED_VARIANCE')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  timeConfigMode === 'FIXED_VARIANCE'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                固定时长
              </button>
              <button
                onClick={() => setTimeConfigMode('MIN_MAX_RANGE')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  timeConfigMode === 'MIN_MAX_RANGE'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                随机范围
              </button>
            </div>

            {timeConfigMode === 'FIXED_VARIANCE' ? (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">小时</label>
                    <input
                      type="number"
                      min="0"
                      max={MAX_LOCK_HOURS}
                      value={durationHours}
                      onChange={e => setDurationHours(parseNumInput(e.target.value, 0, MAX_LOCK_HOURS))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">分钟</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes}
                      onChange={e => setDurationMinutes(parseNumInput(e.target.value, 0, 59))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">难度（影响时间偏差）</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDifficulty(d.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          difficulty === d.value
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{d.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">最短时长（小时）</label>
                  <input
                    type="number"
                    min="0"
                    max={MAX_LOCK_HOURS}
                    value={minDurationHours}
                    onChange={e => setMinDurationHours(parseNumInput(e.target.value, 0, MAX_LOCK_HOURS))}
                    onKeyDown={blockScientificNotation}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">最长时长（小时）</label>
                  <input
                    type="number"
                    min="0"
                    max={MAX_LOCK_HOURS}
                    value={maxDurationHours}
                    onChange={e => setMaxDurationHours(parseNumInput(e.target.value, 0, MAX_LOCK_HOURS))}
                    onKeyDown={blockScientificNotation}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  实际锁定时间将在 {minDurationHours} - {maxDurationHours} 小时之间随机
                </p>
              </div>
            )}
          </div>
        );

      case 'options':
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <EyeOff size={20} className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="font-medium text-sm">隐藏剩余时间</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">锁主人看不到倒计时</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hideRemainingTime}
                  onChange={e => setHideRemainingTime(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="font-medium text-sm">公开锁</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">其他用户可以看到并互动</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  disabled={likeUnlockEnabled}
                  className="w-5 h-5 accent-primary disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <Snowflake size={20} className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="font-medium text-sm">允许Keyholder冻结</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Keyholder可以暂停计时</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowKeyholderFreeze}
                  onChange={e => setAllowKeyholderFreeze(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="font-medium text-sm">最大锁定天数</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">设置锁定时间上限（安全网）</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={maxTotalDaysEnabled}
                  onChange={e => setMaxTotalDaysEnabled(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              {maxTotalDaysEnabled && (
                <div className="ml-8 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block text-sm font-medium mb-1">最大锁定天数</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={maxTotalDays}
                    onChange={e => setMaxTotalDays(parseNumInput(e.target.value, 1, 365))}
                    onKeyDown={blockScientificNotation}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">超过此天数后，任何时间增加操作（投币、骰子、惩罚等）都不再生效</p>
                </div>
              )}

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="font-medium text-sm">卫生开启</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">允许临时解锁进行清洁</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hygieneOpeningEnabled}
                  onChange={e => setHygieneOpeningEnabled(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              {hygieneOpeningEnabled && (
                <div className="ml-8 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">卫生开启时长（分钟）</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={hygieneOpeningDuration}
                      onChange={e => setHygieneOpeningDuration(parseNumInput(e.target.value, 5, 120))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">限制模式</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setHygieneOpeningLimitMode('DAILY')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          hygieneOpeningLimitMode === 'COOLDOWN'
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        冷却间隔
                      </button>
                    </div>
                    {hygieneOpeningLimitMode === 'DAILY' ? (
                      <>
                        <label className="block text-sm font-medium mb-2">每日次数上限</label>
                        <input
                          type="number"
                          min="1"
                          max="3"
                          value={hygieneOpeningDailyLimit}
                          onChange={e => setHygieneOpeningDailyLimit(parseNumInput(e.target.value, 1, 3))}
                          onKeyDown={blockScientificNotation}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每天最多可临时开启 1-3 次</p>
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium mb-2">冷却时间（小时）</label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={hygieneOpeningCooldownHours}
                          onChange={e => setHygieneOpeningCooldownHours(parseNumInput(e.target.value, 1, 168))}
                          onKeyDown={blockScientificNotation}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每次开启后需等待冷却时间，不积累次数</p>
                      </>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hygieneBypassKeyholder}
                      onChange={e => setHygieneBypassKeyholder(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span>免监督者审批</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">（卫生开启无需监督者同意）</span>
                  </label>
                </div>
              )}
            </div>

            {/* Lock Box / Reward Mode */}
            <div className="mt-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">锁盒模式</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {([
                  { type: 'NONE' as LockBoxType, icon: X, label: '无' },
                  { type: 'PHOTO' as LockBoxType, icon: Camera, label: '拍照' },
                  { type: 'SUOJI' as LockBoxType, icon: Bluetooth, label: '索迹' },
                  { type: 'YICIYUAN' as LockBoxType, icon: Bluetooth, label: '役次元' },
                ] as const).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setLockBoxType(type);
                      if (type !== 'PHOTO') { handleClearImage(); }
                      if (type !== 'SUOJI') { setLockBoxDeviceName(null); setLockBoxLocked(false); setSuojiUnlocked(false); suojiLockBox.disconnect(); }
                      if (type !== 'YICIYUAN') { yiciyuanLockBox.disconnect(); okgssLockBox.disconnect(); setYiciyuanMac(null); }
                    }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      lockBoxType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={18} className={lockBoxType === type ? 'text-primary' : 'text-slate-400 dark:text-slate-500'} />
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Photo mode: camera capture */}
              {lockBoxType === 'PHOTO' && (
                <>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">可选 - 中央区域将被模糊，解锁后可查看完整图片</p>
                  {imagePreview ? (
                    <div className="relative w-full h-40 rounded-2xl overflow-hidden">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                        <button type="button" onClick={() => setIsCameraOpen(true)} className="flex-1 py-2 bg-white/90 dark:bg-slate-800/90 rounded-xl text-slate-800 dark:text-slate-100 text-xs font-semibold">重拍</button>
                        <button type="button" onClick={handleClearImage} className="flex-1 py-2 bg-red-500/90 rounded-xl text-white text-xs font-semibold">删除</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all bg-slate-50 dark:bg-slate-900"
                    >
                      <Camera size={20} />
                      <span className="text-xs font-medium">拍摄奖励图片</span>
                    </button>
                  )}
                </>
              )}

              {/* Suoji lock box mode: BLE pairing */}
              {lockBoxType === 'SUOJI' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3">
                  {!suojiLockBox.isSupported ? (
                    <BleEnvironmentWarning compact />
                  ) : lockBoxLocked ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <Check size={20} className="text-green-500 dark:text-green-400 shrink-0" />
                      <div>
                        <div className="font-medium text-sm text-green-700 dark:text-green-400">锁盒已上锁</div>
                        <div className="text-xs text-green-500 dark:text-green-400">{lockBoxDeviceName}</div>
                      </div>
                    </div>
                  ) : suojiLockBox.connectionState === 'connected' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Bluetooth size={16} className="text-blue-500 dark:text-blue-400" />
                        <span className="text-sm text-blue-700 dark:text-blue-400">已连接: <b>{suojiLockBox.deviceName}</b></span>
                      </div>
                      {!suojiUnlocked ? (
                        <>
                          <p className="text-xs text-slate-500 dark:text-slate-400">先开锁放入钥匙，再发送上锁命令</p>
                          <button
                            type="button"
                            disabled={suojiUnlocking}
                            onClick={async () => {
                              setSuojiUnlocking(true);
                              try {
                                const success = await suojiLockBox.sendUnlockCommand();
                                if (success) setSuojiUnlocked(true);
                              } finally {
                                setSuojiUnlocking(false);
                              }
                            }}
                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                          >
                            {suojiUnlocking ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                开锁中...
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-2">
                                <Key size={16} />
                                打开锁盒
                              </span>
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Key size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
                            <span className="text-sm text-amber-700 dark:text-amber-400">锁盒已打开，请放入钥匙后上锁</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const success = await suojiLockBox.sendLockCommand();
                              if (success) {
                                setLockBoxLocked(true);
                                setLockBoxDeviceName(suojiLockBox.deviceName);
                              }
                            }}
                            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <Lock size={16} />
                              已放入钥匙，上锁
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowBlePicker(true)}
                        disabled={suojiLockBox.connectionState === 'connecting'}
                        className="w-full py-3 border-2 border-dashed border-primary/50 text-primary rounded-xl font-semibold text-sm hover:bg-primary/5 disabled:opacity-50"
                      >
                        {suojiLockBox.connectionState === 'connecting' ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            连接中...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Bluetooth size={16} />
                            搜索并连接锁盒
                          </span>
                        )}
                      </button>
                      <BleScanPicker
                        open={showBlePicker && lockBoxType === 'SUOJI'}
                        namePrefixes={[suojiLockBox.namePrefix]}
                        onSelect={async (device) => {
                          setShowBlePicker(false);
                          await suojiLockBox.connectToDevice(device);
                        }}
                        onCancel={() => setShowBlePicker(false)}
                      />
                    </>
                  )}
                  {suojiLockBox.error && (
                    <div className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle size={12} />
                      {suojiLockBox.error}
                    </div>
                  )}
                </div>
              )}

              {/* Yiciyuan lock box mode */}
              {lockBoxType === 'YICIYUAN' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3">
                  {!yiciyuanLockBox.isSupported ? (
                    <BleEnvironmentWarning compact />
                  ) : lockBoxLocked ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <Check size={20} className="text-green-500 dark:text-green-400 shrink-0" />
                      <div>
                        <div className="font-medium text-sm text-green-700 dark:text-green-400">锁盒已绑定并上锁</div>
                        <div className="text-xs text-green-500 dark:text-green-400">{lockBoxDeviceName}</div>
                      </div>
                    </div>
                  ) : yiciyuanBound ? (
                    (() => {
                      const activeBox = okgssLockBox.connectionState === 'connected' ? okgssLockBox : yiciyuanLockBox;
                      const isOkgss = lockBoxDeviceName?.startsWith('OKGSS');
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Check size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-blue-700 dark:text-blue-400">设备已绑定: {lockBoxDeviceName}</div>
                              <div className="text-xs text-blue-500 dark:text-blue-400">请先开锁放入钥匙，再关上{isOkgss ? '挂锁' : '盒子'}</div>
                            </div>
                          </div>
                          {yiciyuanCredentials && (
                            <button
                              type="button"
                              disabled={yiciyuanUnlocking}
                              onClick={async () => {
                                setYiciyuanUnlocking(true);
                                try {
                                  if (isOkgss) {
                                    if (okgssLockBox.connectionState !== 'connected') {
                                      const name = await okgssLockBox.scanAndConnect();
                                      if (!name) { setYiciyuanUnlocking(false); return; }
                                    }
                                    const tokenA = await okgssLockBox.handshake(yiciyuanCredentials.keyA);
                                    if (!tokenA) { setYiciyuanUnlocking(false); return; }
                                    const ok = await okgssLockBox.openLock(yiciyuanCredentials.keyA, yiciyuanCredentials.tokenB, tokenA);
                                    if (!ok) { setError('开锁失败'); }
                                  } else {
                                    if (yiciyuanLockBox.connectionState !== 'connected') {
                                      const name = await yiciyuanLockBox.scanAndConnect();
                                      if (!name) { setYiciyuanUnlocking(false); return; }
                                    }
                                    const tokenA = await yiciyuanLockBox.handshake(yiciyuanCredentials.keyA);
                                    if (!tokenA) { setYiciyuanUnlocking(false); return; }
                                    const ok = await yiciyuanLockBox.openLockBox(yiciyuanCredentials.keyA, yiciyuanCredentials.tokenB, tokenA);
                                    if (!ok) { setError('开锁失败'); }
                                  }
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : '开锁失败');
                                } finally {
                                  setYiciyuanUnlocking(false);
                                }
                              }}
                              className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                            >
                              {yiciyuanUnlocking ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  开锁中...
                                </span>
                              ) : (
                                <span className="flex items-center justify-center gap-2">
                                  <Lock size={16} />
                                  {isOkgss ? '打开挂锁' : '打开盒子'}
                                </span>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setLockBoxLocked(true)}
                            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <Check size={16} />
                              已放入钥匙并{isOkgss ? '锁好' : '关好盒子'}
                            </span>
                          </button>
                        </div>
                      );
                    })()
                  ) : (yiciyuanLockBox.connectionState === 'connected' || okgssLockBox.connectionState === 'connected') && !yiciyuanMac ? (
                    (() => {
                      const activeBox = okgssLockBox.connectionState === 'connected' ? okgssLockBox : yiciyuanLockBox;
                      const isOkgss = okgssLockBox.connectionState === 'connected';
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Bluetooth size={16} className="text-blue-500 dark:text-blue-400" />
                            <div>
                              <span className="text-sm text-blue-700 dark:text-blue-400">已连接: <b>{activeBox.deviceName}</b></span>
                            </div>
                          </div>
                          {/* MAC address — 自动提取或手动输入 */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              设备 MAC 地址
                              {activeBox.macAddress && <span className="text-green-600 dark:text-green-400 ml-1">（已自动获取）</span>}
                              {!activeBox.macAddress && <span className="text-amber-600 dark:text-amber-400 ml-1">（请手动输入，印在设备上）</span>}
                            </label>
                            <input
                              type="text"
                              value={activeBox.macAddress || ''}
                              onChange={(e) => activeBox.setMacAddress(e.target.value.toUpperCase())}
                              placeholder="XX:XX:XX:XX:XX:XX"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary"
                              maxLength={17}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={yiciyuanBinding || !activeBox.macAddress}
                            onClick={async () => {
                              if (!activeBox.macAddress || !activeBox.deviceName) return;
                              setYiciyuanBinding(true);
                              setError(null);
                              try {
                                // 1. 先查本地数据库是否已有该设备的凭据
                                const existingCreds = await yiciyuanApi.getDeviceCredentialsByMac(activeBox.macAddress);
                                setYiciyuanMac(activeBox.macAddress);
                                setLockBoxDeviceName(activeBox.deviceName);
                                setYiciyuanCredentials({ keyA: hexToBytes(existingCreds.keyA), tokenB: hexToBytes(existingCreds.tokenB) });
                                setYiciyuanBound(true);
                              } catch {
                                // 2. 本地无凭据，需要登录役次元并绑定
                                try {
                                  // 检查是否已登录
                                  if (!yiciyuanLoggedIn) {
                                    const status = await yiciyuanApi.getAccount();
                                    if (status.hasAccount) {
                                      setYiciyuanLoggedIn(true);
                                    } else {
                                      setShowYiciyuanLogin(true);
                                      setYiciyuanBinding(false);
                                      return;
                                    }
                                  }
                                  const result = await yiciyuanApi.bindDevice(activeBox.macAddress, activeBox.deviceName);
                                  setYiciyuanMac(activeBox.macAddress);
                                  setLockBoxDeviceName(activeBox.deviceName);
                                  if (result.keyA && result.tokenB) {
                                    setYiciyuanCredentials({ keyA: hexToBytes(result.keyA), tokenB: hexToBytes(result.tokenB) });
                                  }
                                  setYiciyuanBound(true);
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : '绑定设备失败';
                                  setError(msg);
                                  if (msg.includes('过期') || msg.includes('重新登录')) {
                                    setYiciyuanLoggedIn(false);
                                    setShowYiciyuanLogin(true);
                                  } else if (msg.includes('登录')) {
                                    setShowYiciyuanLogin(true);
                                  }
                                }
                              } finally {
                                setYiciyuanBinding(false);
                              }
                            }}
                            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                          >
                            {yiciyuanBinding ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                绑定中...
                              </span>
                            ) : (
                              '绑定设备'
                            )}
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">搜索附近的役次元锁盒设备（YS0x 钥匙盒 / OKGSS 挂锁）</p>
                      <button
                        type="button"
                        onClick={() => setShowBlePicker(true)}
                        disabled={yiciyuanLockBox.connectionState === 'connecting' || okgssLockBox.connectionState === 'connecting'}
                        className="w-full py-3 border-2 border-dashed border-primary/50 text-primary rounded-xl font-semibold text-sm hover:bg-primary/5 disabled:opacity-50"
                      >
                        {(yiciyuanLockBox.connectionState === 'connecting' || okgssLockBox.connectionState === 'connecting') ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            连接中...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Bluetooth size={16} />
                            搜索锁盒设备
                          </span>
                        )}
                      </button>
                      <BleScanPicker
                        open={showBlePicker}
                        namePrefixes={['YS0', 'OKGSS']}
                        optionalServices={[
                          '00009000-0000-1000-8000-57616c6b697a',
                          '0000fee7-0000-1000-8000-00805f9b34fb',
                        ]}
                        onSelect={async (device) => {
                          setShowBlePicker(false);
                          if (!device.name) return;
                          setLockBoxDeviceName(device.name);
                          try {
                            if (device.name.startsWith('OKGSS')) {
                              await okgssLockBox.connectToDevice(device);
                            } else {
                              await yiciyuanLockBox.connectToDevice(device);
                            }
                          } catch {
                            // hooks handle their own error state
                          }
                        }}
                        onCancel={() => setShowBlePicker(false)}
                      />
                    </div>
                  )}
                  {(yiciyuanLockBox.error || okgssLockBox.error) && (
                    <div className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle size={12} />
                      {yiciyuanLockBox.error || okgssLockBox.error}
                    </div>
                  )}
                  {error && lockBoxType === 'YICIYUAN' && (
                    <div className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle size={12} />
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'extensions':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">选择要启用的扩展功能</p>

            {/* 点赞解锁扩展 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Heart size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">点赞解锁</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">需要收集社区点赞才能解锁（强制公开）</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={likeUnlockEnabled}
                  onChange={e => setLikeUnlockEnabled(e.target.checked)}
                  className="w-5 h-5 accent-rose-500"
                />
              </label>

              {likeUnlockEnabled && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    启用后锁将强制公开。社区成员的点赞将计为解锁进度，达到所需数量后才能尝试解锁。
                    {voteUnlockEnabled && '同时启用投票解锁时，点赞需先达标才能发起投票。'}
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">所需点赞数</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={likeUnlockRequiredLikes}
                      onChange={e => setLikeUnlockRequiredLikes(parseNumInput(e.target.value, 1, 10000))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">收集到此数量的点赞后才能尝试解锁</p>
                  </div>
                </div>
              )}
            </div>

            {/* 投票解锁扩展 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Vote size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">投票解锁</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">解锁时需社区投票决定结果</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={voteUnlockEnabled}
                  onChange={e => setVoteUnlockEnabled(e.target.checked)}
                  className="w-5 h-5 accent-violet-500"
                />
              </label>

              {voteUnlockEnabled && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    当你尝试解锁时，会在Telegram群组发起投票。先得到指定票数的一方决定结果。
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">所需票数</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={voteUnlockConfig.votesRequired}
                      onChange={e => setVoteUnlockConfig(prev => ({ ...prev, votesRequired: parseNumInput(e.target.value, 1, 100) }))}
                      onKeyDown={blockScientificNotation}
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
                      value={voteUnlockConfig.voteTimeoutMinutes}
                      onChange={e => setVoteUnlockConfig(prev => ({ ...prev, voteTimeoutMinutes: parseNumInput(e.target.value, 1, 1440) }))}
                      onKeyDown={blockScientificNotation}
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
                      value={voteUnlockConfig.penaltyPercent}
                      onChange={e => setVoteUnlockConfig(prev => ({ ...prev, penaltyPercent: parseNumInput(e.target.value, 0, 100) }))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">投票失败时增加总时长的此百分比作为惩罚</p>
                  </div>
                </div>
              )}
            </div>

            {/* 趣味骰子扩展 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Dices size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">趣味骰子</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">和系统掷骰子比大小，赢了减时间</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={diceEnabled}
                  onChange={e => setDiceEnabled(e.target.checked)}
                  className="w-5 h-5 accent-pink-500"
                />
              </label>

              {diceEnabled && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    你和系统各掷一个骰子，你的点数大于系统则减少时间，否则增加时间。时间变化基于锁的总时长百分比计算。
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">最小百分比</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={diceConfig.minPercentage}
                        onChange={e => setDiceConfig(prev => ({ ...prev, minPercentage: parseNumInput(e.target.value, 1, 100) }))}
                        onKeyDown={blockScientificNotation}
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">最大百分比</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={diceConfig.maxPercentage}
                        onChange={e => setDiceConfig(prev => ({ ...prev, maxPercentage: parseNumInput(e.target.value, 1, 100) }))}
                        onKeyDown={blockScientificNotation}
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">每次掷骰子时，时间变化为总时长的 {diceConfig.minPercentage}% ~ {diceConfig.maxPercentage}%</p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">冷却时间（分钟）</label>
                    <input
                      type="number"
                      min="1"
                      max="10080"
                      value={diceConfig.cooldownMinutes}
                      onChange={e => setDiceConfig(prev => ({ ...prev, cooldownMinutes: parseNumInput(e.target.value, 1, 10080) }))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">两次掷骰子之间的最短间隔（最大7天）</p>
                  </div>
                </div>
              )}
            </div>

            {/* 验证照片扩展 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Camera size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">验证照片</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">定时拍照验证，确保佩戴状态</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={verificationPictureEnabled}
                  onChange={e => setVerificationPictureEnabled(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500"
                />
              </label>

              {verificationPictureEnabled && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    在指定时间点要求拍照验证。未按时提交将受到惩罚。
                  </p>

                  {/* 计划时间列表 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <Clock size={14} />
                      验证时间
                    </label>
                    <div className="space-y-2">
                      {verificationPictureConfig.scheduleTimes.map((time, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <TimePickerSheet
                            value={time}
                            onChange={(v) => {
                              const newTimes = [...verificationPictureConfig.scheduleTimes];
                              newTimes[index] = v;
                              setVerificationPictureConfig(prev => ({ ...prev, scheduleTimes: newTimes }));
                            }}
                          />
                          {verificationPictureConfig.scheduleTimes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newTimes = verificationPictureConfig.scheduleTimes.filter((_, i) => i !== index);
                                setVerificationPictureConfig(prev => ({ ...prev, scheduleTimes: newTimes }));
                              }}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationPictureConfig(prev => ({
                          ...prev,
                          scheduleTimes: [...prev.scheduleTimes, '12:00']
                        }));
                      }}
                      className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium px-2 py-1 hover:bg-emerald-50 dark:bg-emerald-950 rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      添加时间
                    </button>
                  </div>

                  {/* 容差时间 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">容差时间（±分钟）</label>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={verificationPictureConfig.toleranceMinutes}
                      onChange={e => setVerificationPictureConfig(prev => ({ ...prev, toleranceMinutes: parseNumInput(e.target.value, 5, 180) }))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">在计划时间前后此分钟数内提交均有效</p>
                  </div>

                  {/* 分享到社区（仅公开锁时显示） */}
                  {isPublic && (
                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer">
                      <div>
                        <div className="font-medium text-sm text-slate-700 dark:text-slate-200">分享到社区</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">验证照片将对社区可见</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={verificationPictureConfig.shareToCommunity}
                        onChange={e => setVerificationPictureConfig(prev => ({ ...prev, shareToCommunity: e.target.checked }))}
                        className="w-5 h-5 accent-emerald-500"
                      />
                    </label>
                  )}

                  {/* 自定义惩罚 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">自定义惩罚（分钟）</label>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={verificationPictureConfig.penaltyMinutes ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        setVerificationPictureConfig(prev => ({
                          ...prev,
                          penaltyMinutes: val === '' ? null : clamp(Number(val) || 0, 0, 1440)
                        }));
                      }}
                      onKeyDown={blockScientificNotation}
                      placeholder="留空则使用难度默认值"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">未按时提交时增加的惩罚时间，留空使用难度默认值</p>
                  </div>
                </div>
              )}
            </div>

            {/* 投币扩展 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Coins size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">投币</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">其他玩家可投币为你加时间（强制公开）</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={coinTossEnabled}
                  onChange={e => setCoinTossEnabled(e.target.checked)}
                  className="w-5 h-5 accent-amber-500"
                />
              </label>

              {coinTossEnabled && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    启用后锁将强制公开。其他玩家可以用校园点数投币，每枚硬币增加设定的时间。投入的校园点数全额转给你。
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">每人最多投币数</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={coinTossConfig.maxCoinsPerPlayer}
                      onChange={e => setCoinTossConfig(prev => ({ ...prev, maxCoinsPerPlayer: parseNumInput(e.target.value, 1, 10000) }))}
                      onKeyDown={blockScientificNotation}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每位玩家对此锁最多可投的硬币数量</p>
                  </div>

                  {/* 时间模式选择 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">每币增加时间</label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setCoinTossConfig(prev => ({ ...prev, usePercentage: false }))}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          !coinTossConfig.usePercentage
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        固定时间
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoinTossConfig(prev => ({ ...prev, usePercentage: true }))}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          coinTossConfig.usePercentage
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        百分比
                      </button>
                    </div>

                    {coinTossConfig.usePercentage ? (
                      <div>
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={coinTossConfig.percentagePerCoin}
                          onChange={e => setCoinTossConfig(prev => ({ ...prev, percentagePerCoin: Math.max(0.1, Math.min(100, Number(e.target.value) || 0.1)) }))}
                          onKeyDown={blockScientificNotation}
                          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每枚硬币增加总时长的 {coinTossConfig.percentagePerCoin}%</p>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={coinTossConfig.minutesPerCoin}
                          onChange={e => setCoinTossConfig(prev => ({ ...prev, minutesPerCoin: parseNumInput(e.target.value, 1, 1440) }))}
                          onKeyDown={blockScientificNotation}
                          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">每枚硬币增加 {coinTossConfig.minutesPerCoin} 分钟</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'review':
        const totalMins = timeConfigMode === 'FIXED_VARIANCE'
          ? durationHours * 60 + durationMinutes
          : `${minDurationHours * 60} - ${maxDurationHours * 60}`;
        return (
          <div className="space-y-4">
            {activeSupervisor && (
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-xl p-3 flex items-start gap-3">
                <Shield size={18} className="text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  监督协议生效：Keyholder 为 <b>{activeSupervisor.supervisorName}</b>
                </p>
              </div>
            )}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">锁类型</span>
                <span className="font-medium">{LOCK_TYPE_NAMES[lockType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">时长</span>
                <span className="font-medium">
                  {typeof totalMins === 'number' ? `${totalMins} 分钟` : `${totalMins} 分钟`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">难度</span>
                <span className="font-medium">
                  {DIFFICULTIES.find(d => d.value === difficulty)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">公开</span>
                <span className="font-medium">{isPublic ? '是' : '否'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">隐藏时间</span>
                <span className="font-medium">{hideRemainingTime ? '是' : '否'}</span>
              </div>
              {maxTotalDaysEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">最大锁定天数</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">{maxTotalDays} 天</span>
                </div>
              )}
              {likeUnlockEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">点赞解锁</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">已启用</span>
                </div>
              )}
              {voteUnlockEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">投票解锁</span>
                  <span className="font-medium text-violet-600 dark:text-violet-400">已启用</span>
                </div>
              )}
              {diceEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">趣味骰子</span>
                  <span className="font-medium text-pink-600 dark:text-pink-400">已启用</span>
                </div>
              )}
              {verificationPictureEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">验证照片</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">已启用</span>
                </div>
              )}
              {coinTossEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">投币</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">已启用</span>
                </div>
              )}
            </div>

            {likeUnlockEnabled && (
              <div className="bg-rose-50 dark:bg-rose-950 rounded-xl p-4 space-y-2 border border-rose-100 dark:border-rose-900">
                <div className="text-sm font-medium text-rose-700 mb-2">点赞解锁配置</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">所需点赞数</span>
                  <span className="font-medium">{likeUnlockRequiredLikes} 个</span>
                </div>
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">锁将强制公开，点赞不会增加时间</p>
              </div>
            )}

            {voteUnlockEnabled && (
              <div className="bg-violet-50 dark:bg-violet-950 rounded-xl p-4 space-y-2 border border-violet-100">
                <div className="text-sm font-medium text-violet-700 dark:text-violet-400 mb-2">投票解锁配置</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">所需票数</span>
                  <span className="font-medium">{voteUnlockConfig.votesRequired} 票</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">投票超时</span>
                  <span className="font-medium">{voteUnlockConfig.voteTimeoutMinutes} 分钟</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">失败惩罚</span>
                  <span className="font-medium">{voteUnlockConfig.penaltyPercent}%</span>
                </div>
              </div>
            )}

            {diceEnabled && (
              <div className="bg-pink-50 dark:bg-pink-950 rounded-xl p-4 space-y-2 border border-pink-100">
                <div className="text-sm font-medium text-pink-700 mb-2">趣味骰子配置</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">时间变化范围</span>
                  <span className="font-medium">{diceConfig.minPercentage}% ~ {diceConfig.maxPercentage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">冷却时间</span>
                  <span className="font-medium">{diceConfig.cooldownMinutes} 分钟</span>
                </div>
              </div>
            )}

            {verificationPictureEnabled && (
              <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-4 space-y-2 border border-emerald-100">
                <div className="text-sm font-medium text-emerald-700 mb-2">验证照片配置</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">验证时间</span>
                  <span className="font-medium">{verificationPictureConfig.scheduleTimes.join(', ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">容差时间</span>
                  <span className="font-medium">±{verificationPictureConfig.toleranceMinutes} 分钟</span>
                </div>
                {isPublic && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">分享到社区</span>
                    <span className="font-medium">{verificationPictureConfig.shareToCommunity ? '是' : '否'}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">自定义惩罚</span>
                  <span className="font-medium">
                    {verificationPictureConfig.penaltyMinutes !== null
                      ? `${verificationPictureConfig.penaltyMinutes} 分钟`
                      : '使用难度默认值'}
                  </span>
                </div>
              </div>
            )}

            {coinTossEnabled && (
              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-4 space-y-2 border border-amber-100 dark:border-amber-900">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">投币配置</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">每人最多投币</span>
                  <span className="font-medium">{coinTossConfig.maxCoinsPerPlayer} 枚</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">每币增加时间</span>
                  <span className="font-medium">
                    {coinTossConfig.usePercentage
                      ? `${coinTossConfig.percentagePerCoin}%`
                      : `${coinTossConfig.minutesPerCoin} 分钟`}
                  </span>
                </div>
                <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">锁将强制公开，投入的校园点数全额转给你</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl lg:rounded-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X size={20} />
          </button>
          <h2 className="font-bold text-lg">{STEP_TITLES[currentStep]}</h2>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Progress */}
        <div className="px-4 py-2">
          <div className="flex gap-1">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  index <= currentStepIndex ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          {currentStepIndex > 0 && (
            <button
              onClick={goBack}
              className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} />
              上一步
            </button>
          )}
          {currentStepIndex < STEPS.length - 1 ? (
            <button
              onClick={goNext}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              下一步
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createLockMutation.isPending}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createLockMutation.isPending ? '创建中...' : '确认创建'}
              <Lock size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        blurRadius={20}
      />

      {/* Yiciyuan Login Modal */}
      <YiciyuanLoginModal
        isOpen={showYiciyuanLogin}
        onClose={() => setShowYiciyuanLogin(false)}
        onLoginSuccess={() => {
          setShowYiciyuanLogin(false);
          setYiciyuanLoggedIn(true);
        }}
      />
    </div>
  );
};

export default CreateLockWizard;
