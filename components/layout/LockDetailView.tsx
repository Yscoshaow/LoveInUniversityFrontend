import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelfLock, SelfLockSummary, SelfLockDetail, LockExtensionData,
  LockKeyholder, LockTask, LOCK_TYPE_NAMES, ExtensionTriggerResult,
  HygieneOpeningResponse, UnlockRequest, UnlockVoteDetail,
  VerificationStatusResponse, VerificationPhotoData,
  LockBoxType, TakeoverRequestInfo
} from '../../types';
import {
  ArrowLeft, MoreHorizontal, Lock, Unlock,
  AlertTriangle, Snowflake, Sun, Clock, Users, Key, Settings, Info,
  Shield, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, ChevronRight,
  Droplets, Camera, CheckCircle, XCircle, Play, Timer, Dices, Upload, Image,
  Plus, Minus, RotateCcw, Check, X, MessageCircle, Bluetooth, Heart, Share2, Vote, ArrowUpCircle, UserMinus, Crown, BatteryMedium
} from 'lucide-react';
import { selfLockApi, keyholderApi, extensionApi, lockTaskApi, specialItemsApi, unlockRequestApi, verificationApi, unlockVoteApi } from '../../lib/api';
import { useSuojiLockBox } from '../../hooks/useSuojiLockBox';
import { useYiciyuanLockBox, hexToBytes } from '../../hooks/useYiciyuanLockBox';
import { useOkgssLockBox } from '../../hooks/useOkgssLockBox';
import { getBleAdapter, translateBleError } from '../../lib/ble';
import { yiciyuanApi } from '../../lib/api';
import { YiciyuanLoginModal } from '../features/YiciyuanLoginModal';
import { LockExtensionPanel, UnlockModal, LockCompletedModal, CameraCapture } from '../ui';
import { TimeChangeHistory } from '../ui/TimeChangeHistory';
import { BleEnvironmentWarning } from '../ui/BleEnvironmentWarning';
import { BleScanPicker } from '../ui/BleScanPicker';
import { KeyholderSettingsModal } from '../ui/KeyholderSettingsModal';
import { isBleAvailable } from '../../lib/environment';
import { platformShare, platformOpenTelegramChat, platformHaptic } from '../../lib/platform-actions';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-client';
import { useUserProfileNavigation } from './MainLayout';
import { useConfirm } from '@/hooks/useConfirm';

// Type guard
const isBackendLock = (lock: SelfLock | SelfLockSummary): lock is SelfLockSummary => {
  return typeof lock.id === 'number' && 'difficulty' in lock;
};

interface LockDetailViewProps {
  lock: SelfLock | SelfLockSummary;
  onBack: () => void;
  onEmergencyUnlock: () => void;
  onLockStatusChange?: () => void;
  /** If true, user is viewing as keyholder (manager), not as lock owner */
  isKeyholderView?: boolean;
  /** Telegram ID of the lock wearer, used by keyholder to initiate chat */
  wearerTelegramId?: number | null;
  /** Telegram username of the lock wearer, used for reliable t.me links */
  wearerUsername?: string | null;
  /** Navigate to PlaygroundLockDetail for community interaction (public locks only) */
  onViewInPlayground?: (lockId: number) => void;
}

// Open Telegram DM — works across TG Mini App / Capacitor / browser
const openTelegramChat = (telegramId: number, username?: string | null) => {
  platformOpenTelegramChat(username, telegramId);
};

export const LockDetailView: React.FC<LockDetailViewProps> = ({
  lock: initialLock,
  onBack,
  onEmergencyUnlock,
  onLockStatusChange,
  isKeyholderView = false,
  wearerTelegramId,
  wearerUsername,
  onViewInPlayground,
}) => {
  const queryClient = useQueryClient();
  const { viewUserProfile } = useUserProfileNavigation();
  const confirm = useConfirm();
  const [lockDetail, setLockDetail] = useState<SelfLockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showExtensions, setShowExtensions] = useState(false);
  const [showKeyholders, setShowKeyholders] = useState(false);
  const [keyholders, setKeyholders] = useState<LockKeyholder[]>([]);
  const [extensions, setExtensions] = useState<LockExtensionData[]>([]);
  const [pendingTasks, setPendingTasks] = useState<LockTask[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  // Active vote session (shown as banner outside modal for easy re-sharing)
  const [activeVoteSession, setActiveVoteSession] = useState<UnlockVoteDetail | null>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showMasterKeyConfirm, setShowMasterKeyConfirm] = useState(false);
  const [masterKeyCount, setMasterKeyCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  // Private view code (6-digit share code for private lock access)
  const [viewCode, setViewCode] = useState<string | null | undefined>(undefined); // undefined = not yet synced
  const [isGeneratingViewCode, setIsGeneratingViewCode] = useState(false);
  const [isDeletingViewCode, setIsDeletingViewCode] = useState(false);
  const [viewCodeCopied, setViewCodeCopied] = useState(false);

  // Pending unlock request state (for lock owner - their own requests)
  const [pendingUnlockRequest, setPendingUnlockRequest] = useState<UnlockRequest | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // Applicant list (for shared lock owner - pending applications)
  const [applications, setApplications] = useState<TakeoverRequestInfo[]>([]);
  const [acceptingApplicationId, setAcceptingApplicationId] = useState<number | null>(null);

  // Pending requests to approve (for keyholder - requests from lock wearer)
  const [requestToApprove, setRequestToApprove] = useState<UnlockRequest | null>(null);
  const [respondingToRequest, setRespondingToRequest] = useState(false);

  // Hygiene image state
  const [showHygieneImageModal, setShowHygieneImageModal] = useState(false);
  const [hygieneImageUrl, setHygieneImageUrl] = useState<string | null>(null);
  const [relockImageFile, setRelockImageFile] = useState<File | null>(null);
  const [relockImagePreview, setRelockImagePreview] = useState<string | null>(null);
  const [isUploadingRelockImage, setIsUploadingRelockImage] = useState(false);
  const [isHygieneCameraOpen, setIsHygieneCameraOpen] = useState(false);
  const [isLoadingHygieneImage, setIsLoadingHygieneImage] = useState(false);

  // BLE lock box state
  const suojiLockBox = useSuojiLockBox();
  const yiciyuanLockBox = useYiciyuanLockBox();
  const okgssLockBox = useOkgssLockBox();
  // Track hygiene BLE flow: 'idle' → user needs to unlock, 'unlocked' → can relock, 'relocked' → can end hygiene
  const [hygieneBlePhase, setHygieneBlePhase] = useState<'idle' | 'unlocked' | 'relocked'>('idle');
  const [lockBoxActionLoading, setLockBoxActionLoading] = useState(false);
  // BLE unlock sent but not yet confirmed by user (user needs to verify lock actually opened)
  const [lockBoxBleUnlockSent, setLockBoxBleUnlockSent] = useState(false);
  // Yiciyuan-specific state
  const [showYiciyuanLogin, setShowYiciyuanLogin] = useState(false);
  const [yiciyuanDiagnosticInfo, setYiciyuanDiagnosticInfo] = useState<string | null>(null);
  const [showLockBlePicker, setShowLockBlePicker] = useState(false);
  const [blePickerPrefixes, setBlePickerPrefixes] = useState<string[]>([]);
  const blePickerResolveRef = useRef<((device: import('../../lib/ble/types').BleDevice | null) => void) | null>(null);

  // Helper: open BLE picker and await user selection
  const pickBleDevice = useCallback((prefixes: string[]) => {
    return new Promise<import('../../lib/ble/types').BleDevice | null>((resolve) => {
      blePickerResolveRef.current = resolve;
      setBlePickerPrefixes(prefixes);
      setShowLockBlePicker(true);
    });
  }, []);
  const [yiciyuanCredentials, setYiciyuanCredentials] = useState<{ keyA: Uint8Array; tokenB: Uint8Array } | null>(null);
  const [yiciyuanTokenA, setYiciyuanTokenA] = useState<Uint8Array | null>(null);

  const lockId = isBackendLock(initialLock) ? initialLock.id : parseInt(initialLock.id);

  // Verification photo state
  const [showVerificationPhotos, setShowVerificationPhotos] = useState(false);
  const [showVerificationUploadSheet, setShowVerificationUploadSheet] = useState(false);
  const [showVerificationCamera, setShowVerificationCamera] = useState(false);
  const verificationFileInputRef = React.useRef<HTMLInputElement>(null);
  const verificationVideoRef = React.useRef<HTMLVideoElement>(null);
  const verificationCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [verificationStream, setVerificationStream] = useState<MediaStream | null>(null);
  const [verificationCaptured, setVerificationCaptured] = useState<string | null>(null);
  const [verificationCameraFacing, setVerificationCameraFacing] = useState<'user' | 'environment'>('environment');
  const [verificationCameraError, setVerificationCameraError] = useState<string | null>(null);
  const [verificationPhotoPreview, setVerificationPhotoPreview] = useState<string | null>(null);

  // Verification status query
  const {
    data: verificationStatus,
    refetch: refetchVerificationStatus,
  } = useQuery<VerificationStatusResponse>({
    queryKey: ['verification-status', lockId],
    queryFn: () => verificationApi.getStatus(lockId),
    enabled: !!lockId,
    refetchInterval: 60000, // Refresh every minute to catch window changes
  });

  // Verification photos query
  const {
    data: verificationPhotos,
    refetch: refetchVerificationPhotos,
  } = useQuery<VerificationPhotoData[]>({
    queryKey: ['verification-photos', lockId],
    queryFn: () => verificationApi.getPhotos(lockId),
    enabled: !!lockId && !!verificationStatus?.enabled,
  });

  // Verification upload mutation
  const verificationUploadMutation = useMutation({
    mutationFn: (file: File) => verificationApi.upload(lockId, file),
    onSuccess: () => {
      refetchVerificationStatus();
      refetchVerificationPhotos();
    },
  });

  // Handle verification photo file selection
  const handleVerificationFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      verificationUploadMutation.mutate(file);
    }
    // Reset input so the same file can be re-selected
    if (e.target) e.target.value = '';
  };

  // Verification camera functions
  const startVerificationCamera = async (facing: 'user' | 'environment' = verificationCameraFacing) => {
    try {
      setVerificationCameraError(null);
      if (verificationStream) {
        verificationStream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setVerificationStream(mediaStream);
      if (verificationVideoRef.current) {
        verificationVideoRef.current.srcObject = mediaStream;
      }
    } catch {
      setVerificationCameraError('无法访问相机，请确保已授予相机权限。');
    }
  };

  const stopVerificationCamera = () => {
    if (verificationStream) {
      verificationStream.getTracks().forEach(track => track.stop());
      setVerificationStream(null);
    }
  };

  const openVerificationCamera = () => {
    setShowVerificationUploadSheet(false);
    setShowVerificationCamera(true);
    setVerificationCaptured(null);
    setTimeout(() => startVerificationCamera(), 100);
  };

  const closeVerificationCamera = () => {
    stopVerificationCamera();
    setShowVerificationCamera(false);
    setVerificationCaptured(null);
    setVerificationCameraError(null);
  };

  const captureVerificationPhoto = () => {
    if (!verificationVideoRef.current || !verificationCanvasRef.current) return;
    const video = verificationVideoRef.current;
    const canvas = verificationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    setVerificationCaptured(canvas.toDataURL('image/jpeg', 0.9));
  };

  const confirmVerificationPhoto = () => {
    if (!verificationCaptured) return;
    // Convert data URL to File
    fetch(verificationCaptured)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `verification_${Date.now()}.jpg`, { type: 'image/jpeg' });
        verificationUploadMutation.mutate(file);
        closeVerificationCamera();
      });
  };

  // Fetch full lock details
  const fetchLockDetail = useCallback(async () => {
    try {
      setLoading(true);
      const detail = await selfLockApi.getLockDetail(lockId);
      setLockDetail(detail);
      // Sync view code from lock backend data (owner-only field)
      if (detail.lock.viewCode !== undefined) {
        setViewCode(detail.lock.viewCode ?? null);
      }

      // Fetch keyholders, extensions, and tasks in parallel
      // For keyholder view, skip fetching special items and unlock requests (not needed)
      const basePromises: Promise<unknown>[] = [
        keyholderApi.getKeyholders(lockId).catch(() => []),
        extensionApi.getExtensions(lockId).catch(() => []),
        lockTaskApi.getTasks(lockId, 'PENDING').catch(() => []),
      ];

      if (!isKeyholderView) {
        // Only fetch these for lock owner view
        basePromises.push(specialItemsApi.getInventory().catch(() => []));
        basePromises.push(unlockRequestApi.getMyPendingRequests().catch(() => ({ requests: [], total: 0 })));
      } else {
        // For keyholder view, fetch pending requests to approve
        basePromises.push(unlockRequestApi.getPendingRequests().catch(() => ({ requests: [], total: 0 })));
      }

      const results = await Promise.all(basePromises);
      setKeyholders(results[0] as LockKeyholder[]);
      setExtensions(results[1] as LockExtensionData[]);
      setPendingTasks(results[2] as LockTask[]);

      if (!isKeyholderView) {
        // Check for master key
        const specialItems = results[3] as { itemType: string; quantity: number }[];
        const masterKey = specialItems.find(item => item.itemType === 'MASTER_KEY');
        setMasterKeyCount(masterKey?.quantity ?? 0);

        // Check for pending unlock request for this lock
        const myPendingRequests = results[4] as { requests: UnlockRequest[]; total: number };
        const pendingRequest = myPendingRequests.requests.find(r => r.lockId === lockId);
        setPendingUnlockRequest(pendingRequest || null);

        // Fetch pending applications for shared locks without keyholder
        if (detail.lock.lockType === 'SHARED' && !detail.lock.primaryKeyholderId) {
          const apps = await keyholderApi.getApplications(lockId).catch(() => []);
          setApplications(apps);
        } else {
          setApplications([]);
        }
      } else {
        // For keyholder, check for pending requests from lock wearer for this lock
        const pendingToApprove = results[3] as { requests: UnlockRequest[]; total: number };
        const request = pendingToApprove.requests.find(r => r.lockId === lockId);
        setRequestToApprove(request || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [lockId, isKeyholderView]);

  useEffect(() => {
    fetchLockDetail();
  }, [fetchLockDetail]);

  // Check for active vote session and poll it for real-time updates
  // Skip polling when UnlockModal is open (it has its own polling)
  const hasVoteUnlock = extensions.some(e => e.type === 'VOTE_UNLOCK' && e.enabled);
  useEffect(() => {
    if (!hasVoteUnlock || !lockDetail || showUnlockModal) return;

    const checkAndPoll = async () => {
      try {
        const session = await unlockVoteApi.getActiveSession(lockDetail.lock.id);
        setActiveVoteSession(session);
      } catch {
        setActiveVoteSession(null);
      }
    };

    checkAndPoll();
    const interval = setInterval(checkAndPoll, 5000);
    return () => clearInterval(interval);
  }, [hasVoteUnlock, lockDetail?.lock.id, showUnlockModal]);

  const handleGenerateViewCode = async () => {
    if (!lockId || isGeneratingViewCode) return;
    setIsGeneratingViewCode(true);
    try {
      const { viewCode: code } = await selfLockApi.generateViewCode(lockId);
      setViewCode(code);
    } catch (err) {
      console.error('Failed to generate view code', err);
    } finally {
      setIsGeneratingViewCode(false);
    }
  };

  const handleDeleteViewCode = async () => {
    if (!lockId || isDeletingViewCode) return;
    setIsDeletingViewCode(true);
    try {
      await selfLockApi.deleteViewCode(lockId);
      setViewCode(null);
    } catch (err) {
      console.error('Failed to delete view code', err);
    } finally {
      setIsDeletingViewCode(false);
    }
  };

  const handleCopyViewCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setViewCodeCopied(true);
      setTimeout(() => setViewCodeCopied(false), 2000);
    });
  };

  const lock = lockDetail?.lock;
  const initialRemainingSeconds = lockDetail?.remainingSeconds;
  // Keyholders can see hidden time, only hide for lock owner
  const hideTime = (lock?.hideRemainingTime ?? false) && !isKeyholderView;
  const isFrozen = lock?.isFrozen ?? false;
  const isHygieneOpening = lock?.isHygieneOpening ?? false;
  const isActive = lock?.status === 'ACTIVE';

  // Real-time countdown state (in seconds)
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Initialize and sync countdown with fetched data (now using seconds precision)
  useEffect(() => {
    if (initialRemainingSeconds !== null && initialRemainingSeconds !== undefined) {
      setRemainingSeconds(initialRemainingSeconds);
    }
  }, [initialRemainingSeconds]);

  // Update countdown every second
  useEffect(() => {
    if (!isActive || hideTime || isFrozen || isHygieneOpening) return;
    if (remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, hideTime, isFrozen, isHygieneOpening, remainingSeconds]);

  // Format remaining time with seconds
  const formatTime = useCallback(() => {
    if (hideTime) return '??:??:??';
    if (remainingSeconds <= 0) return '00:00:00';

    const totalSeconds = remainingSeconds;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}天 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [hideTime, remainingSeconds]);

  // Handle unlock success - show completed modal with reward
  const handleUnlockSuccess = useCallback(async () => {
    setShowUnlockModal(false);
    setActiveVoteSession(null);
    // Refetch to get updated lock with imageUrl
    await fetchLockDetail();
    // Invalidate locks queries to refresh Dashboard
    queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    // Notify parent to refresh lock history
    onLockStatusChange?.();
    // Show completion modal
    setShowCompletedModal(true);
  }, [fetchLockDetail, queryClient, onLockStatusChange]);

  // Handle bump lock
  const handleBumpLock = useCallback(async () => {
    try {
      setActionLoading('bump');
      await selfLockApi.bumpLock(lockId);
      await fetchLockDetail();
      queryClient.invalidateQueries({ queryKey: ['playground', 'infinite'] });
    } catch (err: any) {
      setError(err.message || '顶锁失败');
    } finally {
      setActionLoading(null);
    }
  }, [lockId, fetchLockDetail, queryClient]);

  // Handle cancel pending unlock request
  const handleCancelUnlockRequest = async () => {
    if (!pendingUnlockRequest) return;
    setCancellingRequest(true);
    try {
      await unlockRequestApi.cancelRequest(pendingUnlockRequest.id);
      setPendingUnlockRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消请求失败');
    } finally {
      setCancellingRequest(false);
    }
  };

  // Handle approve/reject unlock request (keyholder)
  const handleRespondToRequest = async (approved: boolean) => {
    if (!requestToApprove) return;
    setRespondingToRequest(true);
    try {
      await unlockRequestApi.respondToRequest(requestToApprove.id, {
        approved,
        responseNote: approved ? '已批准' : '已拒绝'
      });
      setRequestToApprove(null);
      // Refresh lock detail to see the updated state
      await fetchLockDetail();
      // Refresh the locks list
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setRespondingToRequest(false);
    }
  };

  // Handle freeze/unfreeze
  const handleFreeze = async () => {
    if (!lock) return;
    setActionLoading('freeze');
    try {
      if (lock.isFrozen) {
        await selfLockApi.unfreezeLock(lock.id);
      } else {
        await selfLockApi.freezeLock(lock.id);
      }
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Keyholder time control state
  const [timeChangeMinutes, setTimeChangeMinutes] = useState(30);

  // Handle add time (keyholder)
  const handleAddTime = async () => {
    if (!lock || timeChangeMinutes <= 0) return;
    setActionLoading('addTime');
    try {
      await keyholderApi.addTime(lockId, timeChangeMinutes);
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '增加时间失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle remove time (keyholder)
  const handleRemoveTime = async () => {
    if (!lock || timeChangeMinutes <= 0) return;
    setActionLoading('removeTime');
    try {
      await keyholderApi.removeTime(lockId, timeChangeMinutes);
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '减少时间失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle keyholder freeze/unfreeze (using keyholder control endpoint)
  const handleKeyholderFreeze = async () => {
    if (!lock) return;
    setActionLoading('freeze');
    try {
      if (lock.isFrozen) {
        await keyholderApi.unfreezeLock(lockId);
      } else {
        await keyholderApi.freezeLock(lockId);
      }
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 管理员放弃管理 / 私有锁监督者退出
  const handleUnclaimKeyholder = async () => {
    const isPrivate = lock?.lockType === 'PRIVATE';
    if (!lock || !(await confirm({
      title: isPrivate ? '确认退出监督' : '确认放弃管理',
      description: isPrivate ? '退出后该锁将变为自锁，确定要退出吗？' : '确定要放弃管理这把锁吗？',
      destructive: true,
    }))) return;
    setActionLoading('unclaim');
    try {
      await keyholderApi.unclaimLock(lockId);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 锁创建者移除不活跃管理员
  const handleRemoveInactiveKeyholder = async () => {
    if (!lock || !(await confirm({ title: '确认删除', description: '确定要移除不活跃的管理员吗？', destructive: true }))) return;
    setActionLoading('removeKeyholder');
    try {
      await keyholderApi.removeInactiveKeyholder(lockId);
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 选择申请者为管理者
  const handleAcceptApplication = async (requestId: number) => {
    if (!(await confirm({ title: '确认操作', description: '确定选择该用户为管理者吗？其他申请将被自动拒绝。', destructive: false }))) return;
    setAcceptingApplicationId(requestId);
    try {
      await keyholderApi.acceptApplication(lockId, requestId);
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setAcceptingApplicationId(null);
    }
  };

  // Fetch latest hygiene image
  const fetchLatestHygieneImage = useCallback(async () => {
    setIsLoadingHygieneImage(true);
    try {
      const history = await selfLockApi.getHygieneImageHistory(lockId);
      if (history.length > 0) {
        // Get the most recent image (could be INITIAL or RELOCK)
        const latest = history.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        if (latest?.imageUrl) {
          setHygieneImageUrl(latest.imageUrl);
        }
      }
    } catch (err) {
      console.error('Failed to fetch hygiene image:', err);
    } finally {
      setIsLoadingHygieneImage(false);
    }
  }, [lockId]);

  // Auto-fetch hygiene image when lock is in hygiene opening mode
  useEffect(() => {
    if (lock?.isHygieneOpening && lock?.hygieneImageRequired) {
      fetchLatestHygieneImage();
    }
  }, [lock?.isHygieneOpening, lock?.hygieneImageRequired, fetchLatestHygieneImage]);

  // Handle hygiene opening request
  const handleRequestHygieneOpening = async () => {
    if (!lock) return;
    setActionLoading('hygiene');
    try {
      const response = await selfLockApi.requestHygieneOpening(lock.id);

      // If approval is required, refetch pending requests
      if (response.requiresApproval && response.requestId) {
        // Refetch my pending requests to update the UI
        const myPendingRequests = await unlockRequestApi.getMyPendingRequests();
        const pendingRequest = myPendingRequests.requests.find(r => r.lockId === lock.id);
        setPendingUnlockRequest(pendingRequest || null);
      } else {
        // Store the image URL from response
        if (response.hygieneImageUrl) {
          setHygieneImageUrl(response.hygieneImageUrl);
        }

        await fetchLockDetail();

        // If image is required, fetch latest image to display in detail view
        if (response.hygieneImageRequired) {
          await fetchLatestHygieneImage();
        }
      }

      // Refresh home page lock list
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle ending hygiene opening (requires image if hygieneImageRequired)
  const handleEndHygieneOpening = async () => {
    if (!lock) return;

    // BLE lock box mode skips image requirement
    const isBleBox = lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN';

    // If image is required and not uploaded yet, show modal (skip for BLE lockbox)
    if (!isBleBox && lock.hygieneImageRequired && !relockImageFile) {
      setShowHygieneImageModal(true);
      return;
    }

    setActionLoading('hygiene');
    try {
      // Upload relock image first if required (skip for BLE lockbox)
      if (!isBleBox && lock.hygieneImageRequired && relockImageFile) {
        setIsUploadingRelockImage(true);
        await selfLockApi.uploadHygieneRelockImage(lock.id, relockImageFile);
        setIsUploadingRelockImage(false);
      }

      await selfLockApi.endHygieneOpening(lock.id);

      // Clear image state
      setRelockImageFile(null);
      setRelockImagePreview(null);
      setHygieneImageUrl(null);
      setShowHygieneImageModal(false);
      // Reset BLE hygiene phase
      setHygieneBlePhase('idle');

      await fetchLockDetail();

      // Refresh home page lock list
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
    } catch (err) {
      setIsUploadingRelockImage(false);
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle camera capture for relock image
  const handleHygieneCameraCapture = useCallback((originalImage: string, blurredPreview: string) => {
    // Show blurred preview to user
    setRelockImagePreview(blurredPreview);
    // Convert original (unblurred) image to File for upload
    const byteString = atob(originalImage.split(',')[1]);
    const mimeString = originalImage.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8ClampedArray(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], `hygiene-relock-${Date.now()}.jpg`, { type: mimeString });
    setRelockImageFile(file);
    setIsHygieneCameraOpen(false);
  }, []);

  // Clear relock image
  const handleClearRelockImage = () => {
    setRelockImageFile(null);
    setRelockImagePreview(null);
  };

  // Sync hygiene BLE phase with server state
  useEffect(() => {
    if (lock?.isHygieneOpening && (lock?.lockBoxType === 'SUOJI' || lock?.lockBoxType === 'YICIYUAN')) {
      if (lock.lockBoxUnlocked) {
        setHygieneBlePhase('unlocked');
      }
      // If lockBoxUnlocked is false and we were in 'unlocked', we've relocked
      // But we only set this if we were previously in 'unlocked' phase
    }
  }, [lock?.isHygieneOpening, lock?.lockBoxType, lock?.lockBoxUnlocked]);

  // BLE lock box: connect and send unlock command (does NOT confirm with server)
  const handleLockBoxUnlock = async () => {
    if (!lock) return;
    setLockBoxActionLoading(true);
    setError(null);
    try {
      if (lock.lockBoxType === 'SUOJI') {
        // SUOJI: simple BLE unlock
        if (suojiLockBox.connectionState !== 'connected') {
          const device = await pickBleDevice([suojiLockBox.namePrefix]);
          if (!device) { setLockBoxActionLoading(false); return; }
          const name = await suojiLockBox.connectToDevice(device);
          if (!name) { setLockBoxActionLoading(false); return; }
        }
        const ok = await suojiLockBox.sendUnlockCommand();
        if (!ok) { setLockBoxBleUnlockSent(true); setLockBoxActionLoading(false); return; }
      } else if (lock.lockBoxType === 'YICIYUAN') {
        // YICIYUAN: connect BLE first → get MAC → lookup credentials by MAC → handshake → open

        // Step 1: Generic scan with both prefixes, then connect with the right hook
        let isOkgss: boolean;
        if (okgssLockBox.connectionState === 'connected') {
          isOkgss = true;
        } else if (yiciyuanLockBox.connectionState === 'connected') {
          isOkgss = false;
        } else {
          // Open BLE scan picker and await user selection
          const device = await pickBleDevice(['YS0', 'OKGSS']);
          if (!device?.name) { setLockBoxActionLoading(false); return; }

          // Determine type from actual device name, then connect with the right hook
          isOkgss = device.name.startsWith('OKGSS');
          const name = isOkgss
            ? await okgssLockBox.connectToDevice(device)
            : await yiciyuanLockBox.connectToDevice(device);
          if (!name) { setLockBoxActionLoading(false); return; }
        }

        // Step 2: Get credentials — try MAC → user's only device → lockId → login
        let creds = yiciyuanCredentials;
        if (!creds) {
          const mac = isOkgss ? okgssLockBox.macAddress : yiciyuanLockBox.macAddress;
          const errors: string[] = [];
          // 1) Try MAC-based lookup (Android can get MAC directly)
          if (mac) {
            try {
              const resp = await yiciyuanApi.getDeviceCredentialsByMac(mac);
              creds = { keyA: hexToBytes(resp.keyA), tokenB: hexToBytes(resp.tokenB) };
              setYiciyuanCredentials(creds);
            } catch (e: any) { errors.push(`MAC(${mac}): ${e.message}`); }
          } else {
            errors.push('MAC: 当前平台无法获取蓝牙MAC地址');
          }
          // 2) No MAC (Web/iOS) — try user's only device
          if (!creds) {
            try {
              const resp = await yiciyuanApi.getDeviceCredentialsForUser();
              creds = { keyA: hexToBytes(resp.keyA), tokenB: hexToBytes(resp.tokenB) };
              setYiciyuanCredentials(creds);
            } catch (e: any) { errors.push(`用户设备: ${e.message}`); }
          }
          // 3) Fall back to lockId-based lookup
          if (!creds) {
            try {
              const resp = await yiciyuanApi.getDeviceCredentials(lock.id as number);
              creds = { keyA: hexToBytes(resp.keyA), tokenB: hexToBytes(resp.tokenB) };
              setYiciyuanCredentials(creds);
            } catch (e: any) { errors.push(`锁ID(${lock.id}): ${e.message}`); }
          }
          // All lookups failed
          if (!creds) {
            const diagInfo = `锁ID: ${lock.id}\n设备类型: ${lock.lockBoxType}\n设备名: ${lock.lockBoxDeviceName ?? '未知'}\nMAC: ${mac ?? '无'}\n平台: ${typeof window !== 'undefined' && (window as any).Capacitor ? 'Native' : 'Web'}\n失败详情:\n${errors.map(e => `- ${e}`).join('\n')}`;
            console.error('[YCY] All credential lookups failed:', diagInfo);
            setYiciyuanDiagnosticInfo(diagInfo);
            setShowYiciyuanLogin(true);
            setLockBoxActionLoading(false);
            return;
          }
        }

        // Step 3: Handshake and open
        if (isOkgss) {
          const tokenA = await okgssLockBox.handshake(creds.keyA);
          if (!tokenA) { setLockBoxActionLoading(false); return; }
          await okgssLockBox.queryBattery(creds.keyA, tokenA);
          const ok = await okgssLockBox.openLock(creds.keyA, creds.tokenB, tokenA);
          if (!ok) { setLockBoxBleUnlockSent(true); setLockBoxActionLoading(false); return; }
        } else {
          const tokenA = await yiciyuanLockBox.handshake(creds.keyA);
          if (!tokenA) { setLockBoxActionLoading(false); return; }
          setYiciyuanTokenA(tokenA);
          await yiciyuanLockBox.queryBattery(creds.keyA, tokenA);
          const ok = await yiciyuanLockBox.openLockBox(creds.keyA, creds.tokenB, tokenA);
          if (!ok) { setLockBoxBleUnlockSent(true); setLockBoxActionLoading(false); return; }
        }
      }
      // BLE command sent — wait for user manual confirmation
      setLockBoxBleUnlockSent(true);
    } catch (err) {
      setLockBoxBleUnlockSent(true);
      setError(err instanceof Error ? err.message : 'BLE解锁失败，请检查锁是否已打开');
    } finally {
      setLockBoxActionLoading(false);
    }
  };

  // User confirms the lock actually opened → notify server
  const handleConfirmBleUnlock = async () => {
    if (!lock) return;
    setLockBoxActionLoading(true);
    try {
      await selfLockApi.confirmLockBoxUnlock(lock.id);
      setLockBoxBleUnlockSent(false);
      if (lock.isHygieneOpening) {
        setHygieneBlePhase('unlocked');
      }
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认解锁失败');
    } finally {
      setLockBoxActionLoading(false);
    }
  };

  // BLE lock box: connect and send lock command, then confirm relock with server
  const handleLockBoxRelock = async () => {
    if (!lock) return;
    setLockBoxActionLoading(true);
    try {
      if (lock.lockBoxType === 'SUOJI') {
        // SUOJI: BLE lock command required
        if (suojiLockBox.connectionState !== 'connected') {
          const device = await pickBleDevice([suojiLockBox.namePrefix]);
          if (!device) { setLockBoxActionLoading(false); return; }
          const name = await suojiLockBox.connectToDevice(device);
          if (!name) { setLockBoxActionLoading(false); return; }
        }
        const ok = await suojiLockBox.sendLockCommand();
        if (!ok) { setLockBoxActionLoading(false); return; }
      }
      // YICIYUAN: no BLE lock command needed — physical auto-latch
      // Just confirm relock with server
      await selfLockApi.confirmLockBoxRelock(lock.id);
      setHygieneBlePhase('relocked');
      await fetchLockDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BLE上锁失败');
    } finally {
      setLockBoxActionLoading(false);
    }
  };

  // Handle extension trigger
  const handleExtensionTriggered = (result: ExtensionTriggerResult) => {
    // Refresh lock detail to get updated time
    fetchLockDetail();
  };

  // Handle emergency unlock - now requires master key
  const handleEmergencyUnlock = async () => {
    setActionLoading('emergency');
    try {
      // Emergency unlock now uses master key
      await specialItemsApi.useMasterKey(lockId);
      setShowEmergencyConfirm(false);
      // Refetch lock detail to get updated status and imageUrl
      const updatedDetail = await selfLockApi.getLockDetail(lockId);
      setLockDetail(updatedDetail);
      // Update master key count
      setMasterKeyCount(prev => Math.max(0, prev - 1));
      // Invalidate locks queries to refresh Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      // Show completed modal with the cancelled lock info
      setShowCompletedModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '紧急解锁失败');
      setShowEmergencyConfirm(false);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle master key unlock
  const handleMasterKeyUnlock = async () => {
    setActionLoading('masterKey');
    try {
      await specialItemsApi.useMasterKey(lockId);
      setShowMasterKeyConfirm(false);
      // Refetch lock detail to get updated status and imageUrl
      const updatedDetail = await selfLockApi.getLockDetail(lockId);
      setLockDetail(updatedDetail);
      // Update master key count
      setMasterKeyCount(prev => Math.max(0, prev - 1));
      // Invalidate locks queries to refresh Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      // Show completed modal with the cancelled lock info
      setShowCompletedModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '万能钥匙解锁失败');
      setShowMasterKeyConfirm(false);
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate progress percentage (use remainingSeconds converted to minutes)
  const remainingMinutesCalc = Math.floor(remainingSeconds / 60);
  const progressPercent = lockDetail
    ? Math.max(0, Math.min(100, ((lockDetail.totalDurationMinutes - remainingMinutesCalc) / lockDetail.totalDurationMinutes) * 100))
    : 0;

  // Cover image upload handler
  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lock) return;
    if (e.target) e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      setError('图片不能超过5MB');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('仅支持 JPEG/PNG/GIF/WebP 格式');
      return;
    }

    setIsUploadingCover(true);
    try {
      await selfLockApi.uploadCoverImage(lockId, file);
      await fetchLockDetail();
    } catch (err: any) {
      setError(err.message || '上传封面失败');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Get header color based on lock type and state
  const getHeaderTheme = () => {
    if (isFrozen) return 'from-blue-500 to-cyan-500';
    if (isHygieneOpening) return 'from-emerald-500 to-teal-500';
    if (lock?.lockType === 'SHARED') return 'from-violet-500 to-purple-500';
    if (lock?.lockType === 'PRIVATE') return 'from-orange-500 to-amber-500';
    return 'from-rose-500 to-pink-500';
  };

  if (loading) {
    return (
      <div className="h-full bg-bgMain flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error || !lock) {
    return (
      <div className="h-full bg-bgMain flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500 dark:text-red-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-center mb-4">{error || '无法加载锁信息'}</p>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-primary text-white rounded-xl font-medium"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-bgMain flex flex-col overflow-hidden lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Colored Header Area */}
      <div className={`relative h-[32%] lg:h-[220px] lg:shrink-0 ${!lockDetail?.coverImageUrl ? `bg-gradient-to-br ${getHeaderTheme()}` : ''} rounded-b-[40px] shadow-lg flex flex-col p-6 overflow-hidden`}>
        {/* Cover image background or gradient */}
        {lockDetail?.coverImageUrl ? (
          <>
            <img src={lockDetail.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          </>
        ) : (
          <>
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-800 opacity-10 rounded-full translate-x-12 -translate-y-12 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-5 rounded-full -translate-x-8 translate-y-8 blur-xl"></div>
          </>
        )}

        {/* Navbar within Header */}
        <div className="relative z-10 flex justify-between items-center pt-4 mb-auto">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-white hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white/80 font-medium tracking-wide text-sm">
              {LOCK_TYPE_NAMES[lock.lockType]}
            </span>
            {lock.isFrozen && (
              <span className="px-2 py-0.5 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1">
                <Snowflake size={10} />
                已冻结
              </span>
            )}
            {lock.isHygieneOpening && (
              <span className={`px-2 py-0.5 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1 ${lock.hygieneOpeningEndsAt === null ? 'bg-red-500/40' : 'bg-white/20 dark:bg-slate-800/20'}`}>
                <Droplets size={10} />
                {lock.hygieneOpeningEndsAt === null ? '卫生超时' : '卫生开启'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Hidden file input for cover image upload */}
            {!isKeyholderView && lock.status === 'ACTIVE' && (
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleCoverImageUpload}
              />
            )}
            <button
              className="p-2 -mr-2 rounded-full bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-white hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
              onClick={() => setShowMoreMenu(true)}
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        {/* Header Content - Timer Display */}
        <div className="relative z-10 flex flex-col items-center pb-6">
          {/* Lock Icon */}
          <div className="w-16 h-16 rounded-full bg-white/20 dark:bg-slate-800/20 backdrop-blur-md flex items-center justify-center mb-3 border border-white/30">
            {lock.isFrozen ? (
              <Snowflake size={28} className="text-white" />
            ) : lock.isHygieneOpening ? (
              <Unlock size={28} className="text-white" />
            ) : (
              <Lock size={28} className="text-white" />
            )}
          </div>

          {/* Timer */}
          <div className="text-4xl font-mono font-bold text-white tracking-wider mb-1">
            {formatTime()}
          </div>
          {hideTime && (
            <div className="flex items-center gap-1.5 text-white/70 text-xs">
              <EyeOff size={12} />
              <span>时间已隐藏</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto -mt-6 z-20 px-6 pb-28 lg:pb-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* -- Left: Progress + Stats -- */}
        <div className="lg:col-span-2">
        {/* Progress Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-soft mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">进度</span>
            <span className="text-slate-800 dark:text-slate-100 font-bold">
              {hideTime ? '???' : `${Math.round(progressPercent)}%`}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            {hideTime ? (
              // 时间隐藏时显示神秘的动画条纹
              <div className="h-full w-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse" />
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${getHeaderTheme()}`}
                style={{ width: `${progressPercent}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-2">
            <span>开始</span>
            <span>{hideTime ? '???' : '结束'}</span>
          </div>
        </div>

        {/* Quick Stats - hidden when time is hidden for lock owner */}
        {!hideTime && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft text-center">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Clock size={20} className="text-primary" />
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">已添加</div>
              <div className="text-slate-800 dark:text-slate-100 font-bold">+{lock.addedDurationMinutes}分</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft text-center">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Timer size={20} className="text-amber-500 dark:text-amber-400" />
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">已减少</div>
              <div className="text-slate-800 dark:text-slate-100 font-bold">-{lock.removedDurationMinutes || 0}分</div>
            </div>
          </div>
        )}
        </div>{/* end left: progress+stats */}

        {/* -- Right: Action Panel -- */}
        <div className="lg:col-span-1">
        {/* Action Buttons */}
        <div className="space-y-3 mb-4">
          {/* Request to Approve - only show to keyholder */}
          {isKeyholderView && requestToApprove && lock.status === 'ACTIVE' && (
            <div className={`rounded-2xl p-4 border ${
              requestToApprove.requestType === 'TEMPORARY'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  requestToApprove.requestType === 'TEMPORARY'
                    ? 'bg-emerald-100 dark:bg-emerald-950'
                    : 'bg-amber-100'
                }`}>
                  {requestToApprove.requestType === 'TEMPORARY' ? (
                    <Droplets size={20} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Unlock size={20} className="text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold mb-1 ${
                    requestToApprove.requestType === 'TEMPORARY'
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-amber-800 dark:text-amber-200'
                  }`}>
                    {requestToApprove.requestType === 'TEMPORARY' ? '卫生开启请求' : '解锁请求'}
                  </h4>
                  <p className={`text-sm mb-2 ${
                    requestToApprove.requestType === 'TEMPORARY'
                      ? 'text-emerald-700'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {requestToApprove.requesterName || '佩戴者'} 请求{requestToApprove.requestType === 'TEMPORARY' ? '卫生开启' : '解锁'}
                  </p>
                  {requestToApprove.reason && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      理由: {requestToApprove.reason}
                    </p>
                  )}
                  <p className={`text-xs ${
                    requestToApprove.requestType === 'TEMPORARY'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    请求将在 {new Date(requestToApprove.expiresAt).toLocaleString('zh-CN')} 过期
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleRespondToRequest(true)}
                  disabled={respondingToRequest}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors active:scale-[0.98] ${
                    requestToApprove.requestType === 'TEMPORARY'
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {respondingToRequest ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  <span>批准</span>
                </button>
                <button
                  onClick={() => handleRespondToRequest(false)}
                  disabled={respondingToRequest}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors active:scale-[0.98] bg-red-100 text-red-600 dark:text-red-400 hover:bg-red-200"
                >
                  {respondingToRequest ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>拒绝</span>
                </button>
              </div>
            </div>
          )}

          {/* Pending Unlock Request Notice - only show to lock owner, not keyholders */}
          {!isKeyholderView && pendingUnlockRequest && lock.status === 'ACTIVE' && (
            <div className={`rounded-2xl p-4 border ${
              pendingUnlockRequest.requestType === 'TEMPORARY'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  pendingUnlockRequest.requestType === 'TEMPORARY'
                    ? 'bg-emerald-100 dark:bg-emerald-950'
                    : 'bg-amber-100'
                }`}>
                  {pendingUnlockRequest.requestType === 'TEMPORARY' ? (
                    <Droplets size={20} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Clock size={20} className="text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold mb-1 ${
                    pendingUnlockRequest.requestType === 'TEMPORARY'
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-amber-800 dark:text-amber-200'
                  }`}>
                    {pendingUnlockRequest.requestType === 'TEMPORARY' ? '卫生开启请求待审批' : '解锁请求待审批'}
                  </h4>
                  <p className={`text-sm mb-2 ${
                    pendingUnlockRequest.requestType === 'TEMPORARY'
                      ? 'text-emerald-700'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    已向管理者 {pendingUnlockRequest.keyholderName || '未知'} 发送{pendingUnlockRequest.requestType === 'TEMPORARY' ? '卫生开启' : '解锁'}请求，等待审批中...
                  </p>
                  <p className={`text-xs ${
                    pendingUnlockRequest.requestType === 'TEMPORARY'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    请求将在 {new Date(pendingUnlockRequest.expiresAt).toLocaleString('zh-CN')} 过期
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelUnlockRequest}
                disabled={cancellingRequest}
                className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors active:scale-[0.98] ${
                  pendingUnlockRequest.requestType === 'TEMPORARY'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                }`}
              >
                {cancellingRequest ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                <span>取消请求</span>
              </button>
            </div>
          )}

          {/* Like Unlock Progress */}
          {!isKeyholderView && lock.status === 'ACTIVE' && lockDetail?.unlockProgress?.likeUnlockEnabled && (
            <div className="bg-gradient-to-r from-rose-50 dark:from-rose-950 to-pink-50 dark:to-pink-950 rounded-2xl p-4 border border-rose-100 dark:border-rose-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Heart size={18} className="text-rose-500 dark:text-rose-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">点赞解锁进度</span>
                </div>
                <span className={`text-sm font-bold ${lockDetail.unlockProgress.likeThresholdMet ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {lockDetail.unlockProgress.likesCurrent} / {lockDetail.unlockProgress.likesRequired}
                </span>
              </div>
              <div className="w-full bg-rose-200/50 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    lockDetail.unlockProgress.likeThresholdMet
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                      : 'bg-gradient-to-r from-rose-400 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(100, (lockDetail.unlockProgress.likesCurrent / lockDetail.unlockProgress.likesRequired) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {lockDetail.unlockProgress.likeThresholdMet
                  ? '点赞已达标！可以尝试解锁。'
                  : `还需要 ${lockDetail.unlockProgress.likesRequired - lockDetail.unlockProgress.likesCurrent} 个点赞`
                }
              </p>
            </div>
          )}

          {/* Active Vote Session Banner - shown outside modal for easy re-sharing */}
          {!isKeyholderView && activeVoteSession && activeVoteSession.session.status === 'PENDING' && (
            <div className="bg-violet-50 dark:bg-violet-950 border border-violet-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Vote size={18} className="text-violet-500 dark:text-violet-400" />
                <span className="font-semibold text-violet-700 dark:text-violet-400 text-sm">投票进行中</span>
                <span className="ml-auto text-xs text-violet-400">
                  {activeVoteSession.session.approveVotes + activeVoteSession.session.rejectVotes}/{activeVoteSession.session.votesRequired} 票
                </span>
              </div>
              {/* Compact progress */}
              <div className="flex gap-2 items-center">
                <div className="flex-1 h-2 bg-violet-100 dark:bg-violet-950 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${Math.min(100, (activeVoteSession.session.approveVotes / activeVoteSession.session.votesRequired) * 100)}%` }}
                  />
                  <div
                    className="h-full bg-red-400 transition-all"
                    style={{ width: `${Math.min(100, (activeVoteSession.session.rejectVotes / activeVoteSession.session.votesRequired) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">{activeVoteSession.session.approveVotes}</span>
                <span className="text-xs text-slate-300">/</span>
                <span className="text-xs text-red-500 dark:text-red-400 font-medium">{activeVoteSession.session.rejectVotes}</span>
              </div>
              {/* Share to more groups button */}
              <button
                onClick={() => {
                  platformShare({
                    text: '来投票决定要不要开锁吧！',
                    url: `https://t.me/lovein_university_bot/university?startapp=vote_${activeVoteSession.session.id}`,
                    inlineQuery: `vote:${activeVoteSession.session.id}`,
                    inlineChatTypes: ['groups', 'channels'],
                  });
                }}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Share2 size={16} />
                分享到更多群组
              </button>
              <button
                onClick={() => setShowUnlockModal(true)}
                className="w-full py-2 text-violet-500 dark:text-violet-400 text-sm font-medium rounded-xl hover:bg-violet-100 dark:bg-violet-950 transition-colors"
              >
                查看投票详情
              </button>
            </div>
          )}

          {/* Unlock Button - Show when canUnlock is true OR when time is hidden (user needs to try) */}
          {/* Hide if there's a pending unlock request or if viewing as keyholder */}
          {/* If like unlock is enabled, like threshold must be met first */}
          {!isKeyholderView && lock.status === 'ACTIVE' && (lockDetail?.canUnlock || (hideTime && (!lockDetail?.unlockProgress?.likeUnlockEnabled || lockDetail?.unlockProgress?.likeThresholdMet))) && !pendingUnlockRequest && (
            <button
              onClick={() => setShowUnlockModal(true)}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold transition-all active:scale-[0.98] ${
                hideTime
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40'
              }`}
            >
              {hideTime ? (
                <>
                  <Eye size={20} />
                  <span>尝试解锁</span>
                </>
              ) : (
                <>
                  <Unlock size={20} />
                  <span>解锁</span>
                </>
              )}
            </button>
          )}

          {/* Freeze/Unfreeze (if allowed) - owner view only, keyholder has its own panel */}
          {!isKeyholderView && lock.allowKeyholderFreeze && (
            <button
              onClick={handleFreeze}
              disabled={actionLoading === 'freeze'}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] ${
                lock.isFrozen
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              }`}
            >
              {actionLoading === 'freeze' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : lock.isFrozen ? (
                <>
                  <Sun size={18} />
                  <span>解冻计时</span>
                </>
              ) : (
                <>
                  <Snowflake size={18} />
                  <span>冻结计时</span>
                </>
              )}
            </button>
          )}

          {/* Keyholder Time Control Panel - only show to keyholder */}
          {isKeyholderView && lock.status === 'ACTIVE' && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={16} className="text-slate-600 dark:text-slate-300" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">时间控制</span>
              </div>

              {/* Time preset buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[10, 30, 60, 120, 360].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setTimeChangeMinutes(mins)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      timeChangeMinutes === mins
                        ? 'bg-slate-700 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {mins < 60 ? `${mins}分钟` : `${mins / 60}小时`}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min="1"
                  max="10080"
                  value={timeChangeMinutes}
                  onChange={e => setTimeChangeMinutes(Math.max(1, Number(e.target.value)))}
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">分钟</span>
              </div>

              {/* Punishment Mode Warning */}
              {'punishmentMode' in lock && (lock as any).punishmentMode && (
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2 mb-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">惩罚模式</span>：增加时间 x10（当前 {timeChangeMinutes} 分钟 → 实际 {timeChangeMinutes * 10} 分钟），减少时间不变
                  </div>
                </div>
              )}

              {/* Add / Remove buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleRemoveTime}
                  disabled={actionLoading === 'removeTime'}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 font-medium text-sm transition-all active:scale-[0.98] hover:bg-emerald-100 dark:bg-emerald-950"
                >
                  {actionLoading === 'removeTime' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Minus size={16} />
                      减少时间
                    </>
                  )}
                </button>
                <button
                  onClick={handleAddTime}
                  disabled={actionLoading === 'addTime'}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-medium text-sm transition-all active:scale-[0.98] hover:bg-rose-100"
                >
                  {actionLoading === 'addTime' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      {'punishmentMode' in lock && (lock as any).punishmentMode
                        ? `增加 ${timeChangeMinutes * 10} 分钟`
                        : '增加时间'}
                    </>
                  )}
                </button>
              </div>

              {/* Keyholder Freeze/Unfreeze */}
              {lock.allowKeyholderFreeze && (
                <button
                  onClick={handleKeyholderFreeze}
                  disabled={actionLoading === 'freeze'}
                  className={`w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] ${
                    lock.isFrozen
                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900'
                      : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900'
                  }`}
                >
                  {actionLoading === 'freeze' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : lock.isFrozen ? (
                    <>
                      <Sun size={16} />
                      解冻计时
                    </>
                  ) : (
                    <>
                      <Snowflake size={16} />
                      冻结计时
                    </>
                  )}
                </button>
              )}

              {/* 放弃管理（共享锁/私有锁） */}
              {(lock.lockType === 'SHARED' || lock.lockType === 'PRIVATE') && (
                <button
                  onClick={handleUnclaimKeyholder}
                  disabled={actionLoading === 'unclaim'}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 font-medium text-sm transition-all active:scale-[0.98] hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {actionLoading === 'unclaim' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <UserMinus size={16} />
                      {lock.lockType === 'PRIVATE' ? '退出监督' : '放弃管理'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Hygiene Opening - only show to lock owner, not keyholders */}
          {!isKeyholderView && lock.hygieneOpeningEnabled && (
            <div className="space-y-3">
              {/* BLE lock box hygiene flow (SUOJI + YICIYUAN) — only when lock is still active */}
              {lock.isHygieneOpening && lock.status === 'ACTIVE' && (lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN') ? (
                <div className="space-y-3">
                  <div className={`rounded-2xl p-4 border ${lock.hygieneOpeningEndsAt === null ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets size={16} className={lock.hygieneOpeningEndsAt === null ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
                      <span className={`text-sm font-medium ${lock.hygieneOpeningEndsAt === null ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {lock.hygieneOpeningEndsAt === null ? '卫生开启已超时 — 请尽快上锁' : '卫生开启中 — 蓝牙锁盒'}
                      </span>
                    </div>
                    {/* Step indicators */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={hygieneBlePhase === 'idle' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>
                        {hygieneBlePhase !== 'idle' ? '✓ ' : '① '}解锁锁盒
                      </span>
                      <span>→</span>
                      <span className={hygieneBlePhase === 'unlocked' ? 'text-blue-600 dark:text-blue-400 font-semibold' : hygieneBlePhase === 'relocked' ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                        {hygieneBlePhase === 'relocked' ? '✓ ' : '② '}
                        {lock.lockBoxType === 'YICIYUAN' ? (lock.lockBoxDeviceName?.startsWith('OKGSS') ? '锁上挂锁' : '关上盒子') : '重新上锁'}
                      </span>
                      <span>→</span>
                      <span className={hygieneBlePhase === 'relocked' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}>
                        ③ 结束卫生开启
                      </span>
                    </div>
                  </div>

                  {/* BLE availability check */}
                  {!isBleAvailable() ? (
                    <BleEnvironmentWarning compact />
                  ) : (
                    <>
                      {/* BLE connection status */}
                      {lock.lockBoxType === 'SUOJI' && suojiLockBox.connectionState === 'connected' && suojiLockBox.deviceName && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                          <Bluetooth size={14} />
                          <span>已连接: {suojiLockBox.deviceName}</span>
                        </div>
                      )}
                      {lock.lockBoxType === 'YICIYUAN' && (
                        lock.lockBoxDeviceName?.startsWith('OKGSS')
                          ? (okgssLockBox.connectionState === 'connected' && okgssLockBox.deviceName && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                                <Bluetooth size={14} />
                                <span>已连接: {okgssLockBox.deviceName}</span>
                                {okgssLockBox.battery !== null && (
                                  <span className="ml-auto flex items-center gap-1 text-blue-500 dark:text-blue-400">
                                    <BatteryMedium size={14} />
                                    {okgssLockBox.battery}%
                                  </span>
                                )}
                              </div>
                            ))
                          : (yiciyuanLockBox.connectionState === 'connected' && yiciyuanLockBox.deviceName && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                                <Bluetooth size={14} />
                                <span>已连接: {yiciyuanLockBox.deviceName}</span>
                                {yiciyuanLockBox.battery !== null && (
                                  <span className="ml-auto flex items-center gap-1 text-blue-500 dark:text-blue-400">
                                    <BatteryMedium size={14} />
                                    {yiciyuanLockBox.battery}%
                                  </span>
                                )}
                              </div>
                            ))
                      )}
                      {lock.lockBoxType === 'SUOJI' && suojiLockBox.error && (
                        <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                          {suojiLockBox.error}
                        </div>
                      )}
                      {lock.lockBoxType === 'YICIYUAN' && (
                        lock.lockBoxDeviceName?.startsWith('OKGSS')
                          ? (okgssLockBox.error && (
                              <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                                {okgssLockBox.error}
                              </div>
                            ))
                          : (yiciyuanLockBox.error && (
                              <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                                {yiciyuanLockBox.error}
                              </div>
                            ))
                      )}

                      {/* Phase-specific actions */}
                      {hygieneBlePhase === 'idle' && (
                        lockBoxBleUnlockSent ? (
                          <div className="space-y-2">
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">蓝牙信号已发送，请检查锁盒是否已打开</p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleLockBoxUnlock}
                                disabled={lockBoxActionLoading || lock.isFrozen}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 disabled:opacity-50"
                              >
                                {lockBoxActionLoading ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Bluetooth size={18} />
                                    <span>重试解锁</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={handleConfirmBleUnlock}
                                disabled={lockBoxActionLoading || lock.isFrozen}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                              >
                                {lockBoxActionLoading ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle size={18} />
                                    <span>确认已打开</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleLockBoxUnlock}
                            disabled={lockBoxActionLoading || lock.isFrozen}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 disabled:opacity-50"
                          >
                            {lockBoxActionLoading ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <>
                                <Bluetooth size={18} />
                                <span>连接锁盒并解锁</span>
                              </>
                            )}
                          </button>
                        )
                      )}
                      {hygieneBlePhase === 'unlocked' && (
                        lock.lockBoxType === 'YICIYUAN' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">{lock.lockBoxDeviceName?.startsWith('OKGSS') ? '请锁上挂锁，确认已锁好后点击下方按钮' : '请关上盒子，确认已锁好后点击下方按钮'}</p>
                            <button
                              onClick={handleLockBoxRelock}
                              disabled={lockBoxActionLoading || lock.isFrozen}
                              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 disabled:opacity-50"
                            >
                              {lockBoxActionLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <>
                                  <Lock size={18} />
                                  <span>确认已关上盒子</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleLockBoxUnlock}
                              disabled={lockBoxActionLoading || lock.isFrozen}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                            >
                              {lockBoxActionLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <>
                                  <Bluetooth size={16} />
                                  <span>锁没开？重新开锁</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={handleLockBoxRelock}
                              disabled={lockBoxActionLoading || lock.isFrozen}
                              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 disabled:opacity-50"
                            >
                              {lockBoxActionLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <>
                                  <Lock size={18} />
                                  <span>重新上锁锁盒</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleLockBoxUnlock}
                              disabled={lockBoxActionLoading || lock.isFrozen}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                            >
                              {lockBoxActionLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <>
                                  <Bluetooth size={16} />
                                  <span>锁没开？重新开锁</span>
                                </>
                              )}
                            </button>
                          </div>
                        )
                      )}
                      {hygieneBlePhase === 'relocked' && (
                        <button
                          onClick={handleEndHygieneOpening}
                          disabled={actionLoading === 'hygiene' || lock.isFrozen}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 disabled:opacity-50"
                        >
                          {actionLoading === 'hygiene' ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Lock size={18} />
                              <span>结束卫生开启</span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Original image-based hygiene flow */}
                  {/* Current hygiene image display (when in hygiene opening mode and image required) */}
                  {lock.isHygieneOpening && lock.hygieneImageRequired && (
                    <div className="bg-emerald-50 dark:bg-emerald-950 rounded-2xl p-4 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Droplets size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-700">卫生开启中 - 请核对图片</span>
                      </div>
                      {hygieneImageUrl ? (
                        <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                          <img
                            src={hygieneImageUrl}
                            alt="Hygiene reference"
                            className="w-full h-auto"
                          />
                        </div>
                      ) : isLoadingHygieneImage ? (
                        <div className="h-32 flex items-center justify-center">
                          <Loader2 size={24} className="animate-spin text-emerald-500 dark:text-emerald-400" />
                        </div>
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                          <Image size={32} className="mb-2" />
                          <span>暂无图片</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status when in hygiene opening mode without image requirement */}
                  {lock.isHygieneOpening && !lock.hygieneImageRequired && lock.lockBoxType !== 'SUOJI' && lock.lockBoxType !== 'YICIYUAN' && (
                    <div className={`rounded-2xl p-4 border ${lock.hygieneOpeningEndsAt === null ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'}`}>
                      <div className="flex items-center gap-2">
                        <Droplets size={16} className={lock.hygieneOpeningEndsAt === null ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
                        <span className={`text-sm font-medium ${lock.hygieneOpeningEndsAt === null ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {lock.hygieneOpeningEndsAt === null ? '卫生开启已超时，请尽快上锁' : '卫生开启中'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {lock.isHygieneOpening ? (
                    // When in hygiene opening mode
                    lock.hygieneImageRequired ? (
                      // With image required - show upload button
                      <button
                        onClick={() => setShowHygieneImageModal(true)}
                        disabled={actionLoading === 'hygiene' || lock.isFrozen}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 disabled:opacity-50"
                      >
                        {actionLoading === 'hygiene' ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Camera size={18} />
                            <span>上传图片并结束卫生开启</span>
                          </>
                        )}
                      </button>
                    ) : (
                      // Without image required - direct end button
                      <button
                        onClick={handleEndHygieneOpening}
                        disabled={actionLoading === 'hygiene' || lock.isFrozen}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 disabled:opacity-50"
                      >
                        {actionLoading === 'hygiene' ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Lock size={18} />
                            <span>结束卫生开启</span>
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    // When not in hygiene opening mode - show request button (hide if there's a pending hygiene request)
                    pendingUnlockRequest?.requestType !== 'TEMPORARY' && (() => {
                      const limitMode = lock.hygieneOpeningLimitMode ?? 'DAILY';
                      const dailyLimit = lock.hygieneOpeningDailyLimit ?? 1;
                      const usedToday = lock.hygieneOpeningsUsedToday ?? 0;
                      const remaining = Math.max(0, dailyLimit - usedToday);
                      const exhausted = limitMode === 'DAILY' && remaining <= 0;
                      return (
                        <div className="space-y-2">
                          <button
                            onClick={handleRequestHygieneOpening}
                            disabled={actionLoading === 'hygiene' || lock.isFrozen || exhausted}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 disabled:opacity-50"
                          >
                            {actionLoading === 'hygiene' ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <>
                                <Droplets size={18} />
                                <span>请求卫生开启 ({lock.hygieneOpeningDurationMinutes}分钟)</span>
                              </>
                            )}
                          </button>
                          <p className={`text-xs text-center ${exhausted ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {limitMode === 'COOLDOWN'
                              ? `冷却间隔: ${lock.hygieneOpeningCooldownHours ?? 8} 小时`
                              : exhausted
                                ? '今日卫生开启次数已用完'
                                : `今日剩余 ${remaining}/${dailyLimit} 次`}
                          </p>
                        </div>
                      );
                    })()
                  )}
                </>
              )}

            </div>
          )}
        </div>

        {/* BLE Lock Box — pending physical unlock info banner */}
        {!isKeyholderView && (lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN') &&
          lock.status !== 'ACTIVE' && !lock.lockBoxUnlocked && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-3xl mb-4 p-5">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                  {lock.status === 'UNLOCKED' ? '解锁已批准' : lock.status === 'EXPIRED' ? '锁已到期' : '锁已取消'}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  请通过蓝牙连接锁盒完成物理解锁。解锁后此锁将移入历史记录。
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BLE Lock Box Unlock Panel — shown when lock ended and lockbox needs unlocking */}
        {!isKeyholderView && (lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN') &&
          lock.status !== 'ACTIVE' && !lock.lockBoxUnlocked && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Bluetooth size={20} className="text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">解锁锁盒</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    通过蓝牙解锁你的{lock.lockBoxType === 'YICIYUAN' ? '役次元' : '索迹'}锁盒
                  </div>
                </div>
              </div>

              {!isBleAvailable() ? (
                <BleEnvironmentWarning compact />
              ) : (
                <>
                  {lock.lockBoxType === 'SUOJI' && suojiLockBox.connectionState === 'connected' && suojiLockBox.deviceName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                      <Bluetooth size={14} />
                      <span>已连接: {suojiLockBox.deviceName}</span>
                    </div>
                  )}
                  {lock.lockBoxType === 'YICIYUAN' && (
                    lock.lockBoxDeviceName?.startsWith('OKGSS')
                      ? (okgssLockBox.connectionState === 'connected' && okgssLockBox.deviceName && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                            <Bluetooth size={14} />
                            <span>已连接: {okgssLockBox.deviceName}</span>
                            {okgssLockBox.battery !== null && (
                              <span className="ml-auto flex items-center gap-1 text-blue-500 dark:text-blue-400">
                                <BatteryMedium size={14} />
                                {okgssLockBox.battery}%
                              </span>
                            )}
                          </div>
                        ))
                      : (yiciyuanLockBox.connectionState === 'connected' && yiciyuanLockBox.deviceName && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                            <Bluetooth size={14} />
                            <span>已连接: {yiciyuanLockBox.deviceName}</span>
                            {yiciyuanLockBox.battery !== null && (
                              <span className="ml-auto flex items-center gap-1 text-blue-500 dark:text-blue-400">
                                <BatteryMedium size={14} />
                                {yiciyuanLockBox.battery}%
                              </span>
                            )}
                          </div>
                        ))
                  )}
                  {lock.lockBoxType === 'SUOJI' && suojiLockBox.error && (
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                      {suojiLockBox.error}
                    </div>
                  )}
                  {lock.lockBoxType === 'YICIYUAN' && (
                    lock.lockBoxDeviceName?.startsWith('OKGSS')
                      ? (okgssLockBox.error && (
                          <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                            {okgssLockBox.error}
                          </div>
                        ))
                      : (yiciyuanLockBox.error && (
                          <div className="px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
                            {yiciyuanLockBox.error}
                          </div>
                        ))
                  )}

                  {lockBoxBleUnlockSent ? (
                    <div className="space-y-2">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">蓝牙信号已发送，请检查锁盒是否已打开</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleLockBoxUnlock}
                          disabled={lockBoxActionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-blue-500 text-white shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                          {lockBoxActionLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Bluetooth size={18} />
                              <span>重试解锁</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleConfirmBleUnlock}
                          disabled={lockBoxActionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                        >
                          {lockBoxActionLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <CheckCircle size={18} />
                              <span>确认已打开</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleLockBoxUnlock}
                        disabled={lockBoxActionLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] bg-blue-500 text-white shadow-lg shadow-blue-500/30 disabled:opacity-50"
                      >
                        {lockBoxActionLoading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Unlock size={18} />
                            <span>连接并解锁锁盒</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleConfirmBleUnlock}
                        disabled={lockBoxActionLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        {lockBoxActionLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <span>无法连接蓝牙？手动确认已解锁</span>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* BLE Lock Box — already unlocked confirmation */}
        {!isKeyholderView && (lock.lockBoxType === 'SUOJI' || lock.lockBoxType === 'YICIYUAN') &&
          lock.status !== 'ACTIVE' && lock.lockBoxUnlocked && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 rounded-xl flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">锁盒已解锁</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">蓝牙锁盒已成功解锁</div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>{/* end right: action panel */}

        {/* -- Left continued: Info sections -- */}
        <div className="lg:col-span-2">
        {/* Extensions Section */}
        {extensions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            <button
              onClick={() => setShowExtensions(!showExtensions)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Settings size={20} className="text-purple-500 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">扩展功能</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {extensions.filter(e => e.enabled).length} 个已启用
                  </div>
                </div>
              </div>
              {showExtensions ? (
                <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
              ) : (
                <ChevronRight size={20} className="text-slate-400 dark:text-slate-500" />
              )}
            </button>
            {showExtensions && (
              <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">
                <LockExtensionPanel
                  lockId={lock.id}
                  extensions={extensions}
                  isOwner={true}
                  isKeyholder={false}
                  onExtensionTriggered={handleExtensionTriggered}
                  onRefresh={fetchLockDetail}
                />
              </div>
            )}
          </div>
        )}

        {/* Time Change History */}
        {!isKeyholderView && lock.status === 'ACTIVE' && (
          <TimeChangeHistory
            lockId={lock.id}
            hideRemainingTime={lock.hideRemainingTime}
            isOwnerView={true}
            onViewProfile={viewUserProfile}
          />
        )}

        {/* Applicant List - for shared lock owner when no keyholder yet */}
        {!isKeyholderView && lock.lockType === 'SHARED' && !lock.primaryKeyholderId && applications.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-100 dark:bg-violet-950 rounded-xl flex items-center justify-center">
                    <Crown size={20} className="text-violet-500 dark:text-violet-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">申请者列表</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{applications.length} 人申请</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {applications.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                    <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => viewUserProfile(app.requester.id)}>
                      {app.requester.photoUrl ? (
                        <img
                          src={app.requester.photoUrl}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          alt={app.requester.firstName || '申请者'}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:to-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users size={18} className="text-violet-500 dark:text-violet-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {app.requester.firstName
                            ? `${app.requester.firstName}${app.requester.lastName ? ' ' + app.requester.lastName : ''}`
                            : app.requester.username || `用户${app.requester.id}`}
                        </div>
                        {app.requester.username && (
                          <div className="text-xs text-slate-400 dark:text-slate-500">@{app.requester.username}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {app.requester.telegramId && (
                        <button
                          onClick={() => openTelegramChat(app.requester.telegramId!, app.requester.username)}
                          className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all active:scale-95"
                          title="私聊"
                        >
                          <MessageCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleAcceptApplication(app.id)}
                        disabled={acceptingApplicationId === app.id}
                        className="px-3 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                      >
                        {acceptingApplicationId === app.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        选择
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Keyholders Section - hide when viewing as keyholder (they already know) */}
        {!isKeyholderView && keyholders.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            {/* Single keyholder - show directly without collapsible */}
            {keyholders.length === 1 ? (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Key size={20} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">管理者</div>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl ${keyholders[0].telegramId ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.99] transition-all' : ''}`}
                  onClick={() => keyholders[0].telegramId && openTelegramChat(keyholders[0].telegramId, keyholders[0].username)}
                >
                  <div className="flex items-center gap-3">
                    {keyholders[0].photoUrl ? (
                      <img
                        src={keyholders[0].photoUrl}
                        className="w-10 h-10 rounded-full object-cover"
                        alt={keyholders[0].firstName || '管理者'}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                        <Users size={18} className="text-primary" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {keyholders[0].firstName ? `${keyholders[0].firstName}${keyholders[0].lastName ? ' ' + keyholders[0].lastName : ''}` : keyholders[0].username || `用户${keyholders[0].userId}`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{keyholders[0].permissionLevel}</div>
                    </div>
                  </div>
                  {keyholders[0].telegramId && (
                    <MessageCircle size={18} className="text-primary/60" />
                  )}
                </div>
              </div>
            ) : (
              /* Multiple keyholders - use collapsible */
              <>
                <button
                  onClick={() => setShowKeyholders(!showKeyholders)}
                  className="w-full flex items-center justify-between p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Key size={20} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">Keyholders</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{keyholders.length} 位持钥人</div>
                    </div>
                  </div>
                  {showKeyholders ? (
                    <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                {showKeyholders && (
                  <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
                    {keyholders.map(kh => (
                      <div
                        key={kh.id}
                        className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl ${kh.telegramId ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.99] transition-all' : ''}`}
                        onClick={() => kh.telegramId && openTelegramChat(kh.telegramId, kh.username)}
                      >
                        <div className="flex items-center gap-3">
                          {kh.photoUrl ? (
                            <img
                              src={kh.photoUrl}
                              className="w-10 h-10 rounded-full object-cover"
                              alt={kh.firstName || '管理者'}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                              <Users size={18} className="text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {kh.firstName ? `${kh.firstName}${kh.lastName ? ' ' + kh.lastName : ''}` : kh.username || `用户${kh.userId}`}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{kh.permissionLevel}</div>
                          </div>
                        </div>
                        {kh.telegramId && (
                          <MessageCircle size={18} className="text-primary/60" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 锁创建者移除不活跃管理员 */}
        {!isKeyholderView && lock.primaryKeyholderId && lock.keyholderInactiveDays != null && lock.keyholderInactiveDays >= 15 && lock.lockType === 'SHARED' && lock.status === 'ACTIVE' && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-3xl p-4 shadow-soft mb-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">管理员已 {lock.keyholderInactiveDays} 天未上线</div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">您可以移除不活跃的管理员</div>
              </div>
              <button
                onClick={handleRemoveInactiveKeyholder}
                disabled={actionLoading === 'removeKeyholder'}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium transition-all active:scale-[0.98] hover:bg-amber-600 disabled:opacity-50"
              >
                {actionLoading === 'removeKeyholder' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  '移除管理员'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Pending Tasks */}
        {pendingTasks.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950 rounded-3xl p-5 shadow-soft mb-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-3">
              <AlertTriangle size={18} />
              <span className="font-semibold">待完成任务</span>
            </div>
            {pendingTasks.slice(0, 2).map(task => (
              <div key={task.id} className="text-slate-700 dark:text-slate-200 text-sm py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                {task.title}
              </div>
            ))}
            {pendingTasks.length > 2 && (
              <div className="text-orange-500 dark:text-orange-400 text-xs mt-2 font-medium">
                还有 {pendingTasks.length - 2} 个任务...
              </div>
            )}
          </div>
        )}

        {/* Verification Photos Section */}
        {verificationStatus?.enabled && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mb-4 overflow-hidden">
            {/* Header - always visible, toggles expanded view */}
            <button
              onClick={() => setShowVerificationPhotos(!showVerificationPhotos)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  verificationStatus.currentWindow
                    ? 'bg-amber-100'
                    : lock.verificationOverdue
                      ? 'bg-red-100'
                      : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <Camera size={20} className={
                    verificationStatus.currentWindow
                      ? 'text-amber-500 dark:text-amber-400'
                      : lock.verificationOverdue
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400'
                  } />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">验证照片</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    已提交 {verificationStatus.totalPhotos} 张
                    {verificationStatus.missedCount > 0 && (
                      <span className="text-red-500 dark:text-red-400 ml-1">· 错过 {verificationStatus.missedCount} 次</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {verificationStatus.currentWindow && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setShowVerificationUploadSheet(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full hover:bg-amber-600 transition-colors"
                  >
                    <Camera size={14} />
                    上传验证
                  </span>
                )}
                {lock.verificationOverdue && !verificationStatus.currentWindow && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">
                    需要验证!
                  </span>
                )}
                {showVerificationPhotos ? (
                  <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
                ) : (
                  <ChevronRight size={20} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
            </button>

            {/* Expanded content */}
            {showVerificationPhotos && (
              <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">

                {/* Today's Verification Windows */}
                {verificationStatus.todayWindows.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">今日验证窗口</span>
                    </div>
                    <div className="space-y-2">
                      {verificationStatus.todayWindows.map((window) => {
                        const scheduledTime = window.scheduledTime; // already "HH:mm" format
                        const isCurrentWindow = verificationStatus.currentWindow?.id === window.id;

                        return (
                          <div
                            key={window.id}
                            className={`flex items-center justify-between p-3 rounded-2xl border ${
                              window.status === 'COMPLETED'
                                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                                : window.status === 'MISSED'
                                  ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                                  : isCurrentWindow
                                    ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {window.status === 'COMPLETED' ? (
                                <CheckCircle size={18} className="text-green-500 dark:text-green-400 shrink-0" />
                              ) : window.status === 'MISSED' ? (
                                <XCircle size={18} className="text-red-500 dark:text-red-400 shrink-0" />
                              ) : isCurrentWindow ? (
                                <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 shrink-0" />
                              ) : (
                                <Clock size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
                              )}
                              <div>
                                <div className={`text-sm font-medium ${
                                  window.status === 'COMPLETED'
                                    ? 'text-green-700 dark:text-green-400'
                                    : window.status === 'MISSED'
                                      ? 'text-red-700 dark:text-red-400'
                                      : isCurrentWindow
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-slate-600 dark:text-slate-300'
                                }`}>
                                  {scheduledTime}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {window.windowStartLocal ?? ''} - {window.windowEndLocal ?? ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {window.status === 'COMPLETED' && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">已完成</span>
                              )}
                              {window.status === 'MISSED' && (
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">已错过</span>
                              )}
                              {window.status === 'PENDING' && !isCurrentWindow && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">待验证</span>
                              )}
                              {isCurrentWindow && window.status === 'PENDING' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowVerificationUploadSheet(true);
                                  }}
                                  disabled={verificationUploadMutation.isPending}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full hover:bg-amber-600 transition-colors disabled:opacity-50"
                                >
                                  {verificationUploadMutation.isPending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Camera size={14} />
                                  )}
                                  上传
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upload error message */}
                {verificationUploadMutation.isError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl">
                    <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0" />
                    <span className="text-sm text-red-600 dark:text-red-400">
                      上传失败: {verificationUploadMutation.error instanceof Error ? verificationUploadMutation.error.message : '未知错误'}
                    </span>
                  </div>
                )}

                {/* Upload success message */}
                {verificationUploadMutation.isSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl">
                    <CheckCircle size={16} className="text-green-500 dark:text-green-400 shrink-0" />
                    <span className="text-sm text-green-600 dark:text-green-400">验证照片上传成功!</span>
                  </div>
                )}

                {/* Photo Gallery */}
                {verificationPhotos && verificationPhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Image size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">最近照片</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {verificationPhotos.slice(0, 9).map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95 transition-transform"
                          onClick={() => photo.imageUrl && setVerificationPhotoPreview(photo.imageUrl)}
                        >
                          {photo.imageUrl ? (
                            <img
                              src={photo.imageUrl}
                              alt={`验证照片 ${new Date(photo.uploadedAt).toLocaleDateString('zh-CN')}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image size={24} className="text-slate-300" />
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1">
                            <span className="text-white text-[10px] leading-tight">
                              {new Date(photo.uploadedAt).toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {verificationPhotos.length > 9 && (
                      <div className="text-center mt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          还有 {verificationPhotos.length - 9} 张照片
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state for photos */}
                {verificationPhotos && verificationPhotos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                    <Image size={32} className="mb-2" />
                    <span className="text-sm">暂无验证照片</span>
                  </div>
                )}

                {/* Hidden file input for gallery upload */}
                <input
                  ref={verificationFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVerificationFileSelect}
                />

                {/* Upload action sheet */}
                {showVerificationUploadSheet && (
                  <div
                    className="fixed inset-0 z-[100] flex items-end justify-center"
                    onClick={() => setShowVerificationUploadSheet(false)}
                  >
                    <div className="absolute inset-0 bg-black/40" />
                    <div
                      className="relative w-full max-w-sm mx-4 mb-6 animate-in slide-in-from-bottom"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden mb-2">
                        <button
                          onClick={openVerificationCamera}
                          className="w-full py-4 text-center text-base font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                        >
                          拍照
                        </button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700" />
                        <button
                          onClick={() => {
                            setShowVerificationUploadSheet(false);
                            verificationFileInputRef.current?.click();
                          }}
                          className="w-full py-4 text-center text-base font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                        >
                          从相册选择
                        </button>
                      </div>
                      <button
                        onClick={() => setShowVerificationUploadSheet(false)}
                        className="w-full py-4 bg-white dark:bg-slate-800 rounded-2xl text-center text-base font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {/* Fullscreen camera view */}
                {showVerificationCamera && (
                  <div className="fixed inset-0 z-[200] bg-black flex flex-col">
                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center">
                      <button
                        onClick={closeVerificationCamera}
                        className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
                      >
                        <X size={24} />
                      </button>
                      <div className="text-white font-semibold text-sm">拍摄验证照片</div>
                      {!verificationCaptured ? (
                        <button
                          onClick={() => {
                            const next = verificationCameraFacing === 'user' ? 'environment' : 'user';
                            setVerificationCameraFacing(next);
                            startVerificationCamera(next);
                          }}
                          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
                        >
                          <RotateCcw size={20} />
                        </button>
                      ) : (
                        <div className="w-10" />
                      )}
                    </div>

                    {/* Camera / Preview */}
                    <div className="flex-1 relative overflow-hidden">
                      {verificationCameraError ? (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
                          <div>
                            <Camera size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg">{verificationCameraError}</p>
                            <button
                              onClick={() => startVerificationCamera()}
                              className="mt-4 px-6 py-2 bg-amber-500 rounded-full text-sm font-semibold"
                            >
                              重试
                            </button>
                          </div>
                        </div>
                      ) : verificationCaptured ? (
                        <img
                          src={verificationCaptured}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          ref={verificationVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Hidden canvas */}
                    <canvas ref={verificationCanvasRef} className="hidden" />

                    {/* Bottom Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-8 pb-12">
                      {verificationCaptured ? (
                        <div className="flex items-center justify-center gap-12">
                          <button
                            onClick={() => {
                              setVerificationCaptured(null);
                            }}
                            className="w-16 h-16 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center text-white"
                          >
                            <RotateCcw size={28} />
                          </button>
                          <button
                            onClick={confirmVerificationPhoto}
                            disabled={verificationUploadMutation.isPending}
                            className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg disabled:opacity-50"
                          >
                            {verificationUploadMutation.isPending ? (
                              <Loader2 size={36} className="animate-spin" />
                            ) : (
                              <Check size={36} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <button
                            onClick={captureVerificationPhoto}
                            disabled={!verificationStream}
                            className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center disabled:opacity-50"
                          >
                            <div className="w-16 h-16 rounded-full border-4 border-slate-800" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Veto Power Button - only show to lock owner */}
        {!isKeyholderView && lock.wearerHasVeto && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-soft mb-4">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-600 dark:text-amber-400 transition-colors">
              <Shield size={20} />
              <span className="text-sm font-medium">使用否决权</span>
            </button>
          </div>
        )}

        {/* Emergency Unlock - requires master key, only for lock owner */}
        {!isKeyholderView && masterKeyCount > 0 && lock.status === 'ACTIVE' && (
          <button
            onClick={() => setShowEmergencyConfirm(true)}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-500 dark:hover:text-red-400 text-xs font-semibold py-4 hover:bg-red-50 dark:hover:bg-red-950 rounded-2xl transition-colors"
          >
            <AlertTriangle size={14} />
            紧急解锁 (消耗万能钥匙)
          </button>
        )}
        </div>{/* end left-continued */}
        </div>{/* end grid */}
      </div>

      {/* Hygiene Relock Image Upload Modal */}
      {showHygieneImageModal && lock && lock.isHygieneOpening && lock.hygieneImageRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHygieneImageModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">上传新图片</h3>
                <button
                  onClick={() => setShowHygieneImageModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <XCircle size={20} className="text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  结束卫生开启前，请拍摄新的确认图片（此图片将在下次卫生开启时显示）
                </p>

                {/* Preview or camera button */}
                {relockImagePreview ? (
                  <div className="relative">
                    <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                      <img
                        src={relockImagePreview}
                        alt="Relock preview"
                        className="w-full h-auto"
                      />
                    </div>
                    <button
                      onClick={handleClearRelockImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsHygieneCameraOpen(true)}
                    className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera size={32} />
                    <span className="text-sm font-medium">点击拍照</span>
                  </button>
                )}

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleEndHygieneOpening}
                    disabled={!relockImageFile || actionLoading === 'hygiene' || isUploadingRelockImage}
                    className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(actionLoading === 'hygiene' || isUploadingRelockImage) ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Lock size={18} />
                        确认结束卫生开启
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowHygieneImageModal(false)}
                    disabled={actionLoading === 'hygiene'}
                    className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture for Hygiene Relock */}
      <CameraCapture
        isOpen={isHygieneCameraOpen}
        onClose={() => setIsHygieneCameraOpen(false)}
        onCapture={handleHygieneCameraCapture}
        blurRadius={20}
      />

      {/* Master Key Unlock Confirmation Modal */}
      {showMasterKeyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMasterKeyConfirm(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <Key size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">使用万能钥匙？</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                使用万能钥匙将立即解锁，钥匙会被消耗。此操作不会影响你的锁定记录完整性。
              </p>
              <div className="w-full space-y-3">
                <button
                  onClick={handleMasterKeyUnlock}
                  disabled={actionLoading === 'masterKey'}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {actionLoading === 'masterKey' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Key size={18} />
                      确认使用
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMasterKeyConfirm(false)}
                  disabled={actionLoading === 'masterKey'}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Unlock Confirmation Modal */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEmergencyConfirm(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">确认紧急解锁？</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                紧急解锁将立即终止锁定，你将失去本次锁定的所有进度和奖励。此操作不可撤销！
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 mb-4">
                <p className="text-amber-700 dark:text-amber-400 text-xs flex items-center gap-1.5">
                  <Key size={14} />
                  将消耗 1 把万能钥匙（剩余 {masterKeyCount} 把）
                </p>
              </div>
              <div className="w-full space-y-3">
                <button
                  onClick={handleEmergencyUnlock}
                  disabled={actionLoading === 'emergency'}
                  className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'emergency' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle size={18} />
                      确认紧急解锁
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowEmergencyConfirm(false)}
                  disabled={actionLoading === 'emergency'}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {lockDetail && (
        <UnlockModal
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          lockDetail={lockDetail}
          onUnlockSuccess={handleUnlockSuccess}
          extensions={extensions}
        />
      )}

      {/* Lock Completed Modal */}
      {lockDetail && (
        <LockCompletedModal
          isOpen={showCompletedModal}
          onClose={() => {
            setShowCompletedModal(false);
            onBack(); // Go back to list after viewing completion
          }}
          lockDetail={lockDetail}
        />
      )}

      {/* More Menu (Bottom Action Sheet) */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMoreMenu(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl pb-safe max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-2 shrink-0" />
            <div className="px-4 pb-4 space-y-1 overflow-y-auto">
              {isKeyholderView && (
                <button
                  onClick={() => { setShowMoreMenu(false); setShowSettings(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                >
                  <Settings size={20} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">锁设置</span>
                </button>
              )}
              {isKeyholderView && wearerTelegramId && (
                <button
                  onClick={() => { setShowMoreMenu(false); openTelegramChat(wearerTelegramId, wearerUsername); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                >
                  <MessageCircle size={20} className="text-primary" />
                  <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">发起私聊</span>
                </button>
              )}
              {lock?.isPublic && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    platformShare({
                      text: '来看看这个锁吧！',
                      url: `https://t.me/lovein_university_bot/university?startapp=lock_${lock.id}`,
                      inlineQuery: `lock:${lock.id}`,
                    });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                >
                  <Share2 size={20} className="text-blue-500 dark:text-blue-400" />
                  <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">分享</span>
                </button>
              )}
              {lock?.isPublic && onViewInPlayground && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onViewInPlayground(lock.id as number);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                >
                  <MessageCircle size={20} className="text-emerald-500 dark:text-emerald-400" />
                  <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">社区互动</span>
                </button>
              )}
              {!isKeyholderView && (lock?.isPublic || lock?.lockType === 'SHARED') && lock?.status === 'ACTIVE' && (() => {
                const bumpedRecently = lock.lastBumpedAt && (Date.now() - new Date(lock.lastBumpedAt).getTime()) < 24 * 60 * 60 * 1000;
                return (
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleBumpLock();
                    }}
                    disabled={!!bumpedRecently || actionLoading === 'bump'}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
                      bumpedRecently
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700'
                    }`}
                  >
                    <ArrowUpCircle size={20} className={bumpedRecently ? 'text-slate-300' : 'text-orange-500 dark:text-orange-400'} />
                    <div className="flex flex-col items-start">
                      <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
                        {actionLoading === 'bump' ? '顶锁中...' : '顶锁'}
                      </span>
                      {bumpedRecently && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">今日已顶过</span>
                      )}
                    </div>
                  </button>
                );
              })()}
              {!isKeyholderView && lock.status === 'ACTIVE' && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    coverFileInputRef.current?.click();
                  }}
                  disabled={isUploadingCover}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:bg-slate-700 transition-colors"
                >
                  {isUploadingCover ? (
                    <Loader2 size={20} className="animate-spin text-slate-500 dark:text-slate-400" />
                  ) : (
                    <Camera size={20} className="text-indigo-500 dark:text-indigo-400" />
                  )}
                  <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
                    {lockDetail?.coverImageUrl ? '更换封面' : '上传封面'}
                  </span>
                </button>
              )}
              {/* 私密分享码（仅锁所有者，非 keyholder 视图）*/}
              {!isKeyholderView && (
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-2 px-1">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5 px-3">私密分享码 · 持码者可查看此锁</p>
                  {viewCode ? (
                    <div className="flex flex-col gap-2">
                      {/* Code display + copy */}
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/60 rounded-xl px-4 py-2.5">
                        <span className="font-mono text-xl font-bold tracking-[0.3em] text-slate-800 dark:text-slate-100 flex-1 text-center">{viewCode}</span>
                        <button
                          onClick={() => handleCopyViewCode(viewCode)}
                          className="text-xs text-blue-500 dark:text-blue-400 font-medium shrink-0"
                        >
                          {viewCodeCopied ? '已复制' : '复制'}
                        </button>
                      </div>
                      {/* Share via Telegram */}
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          platformShare({
                            text: `我的私密锁分享码：${viewCode}\n点击查看 👉`,
                            url: `https://t.me/lovein_university_bot/university?startapp=lockcode_${viewCode}`,
                          });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors"
                      >
                        <Share2 size={18} className="text-blue-500 dark:text-blue-400" />
                        <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">分享私密链接</span>
                      </button>
                      {/* Regenerate / revoke */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateViewCode}
                          disabled={isGeneratingViewCode}
                          className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingViewCode ? '生成中…' : '刷新码'}
                        </button>
                        <button
                          onClick={handleDeleteViewCode}
                          disabled={isDeletingViewCode}
                          className="flex-1 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                        >
                          {isDeletingViewCode ? '撤销中…' : '撤销分享'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateViewCode}
                      disabled={isGeneratingViewCode}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingViewCode ? (
                        <Loader2 size={18} className="animate-spin text-slate-400" />
                      ) : (
                        <Key size={18} className="text-violet-500 dark:text-violet-400" />
                      )}
                      <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
                        {isGeneratingViewCode ? '生成中…' : '生成私密分享码'}
                      </span>
                    </button>
                  )}
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full py-3 text-[15px] font-medium text-slate-400 dark:text-slate-500 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyholder Settings Modal */}
      {isKeyholderView && lockDetail && (
        <KeyholderSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          lockId={lock.id as number}
          lock={lockDetail.lock}
          extensions={extensions}
          onSettingsUpdated={() => {
            fetchLockDetail();
            queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
          }}
        />
      )}

      {/* Yiciyuan Login Modal */}
      <YiciyuanLoginModal
        isOpen={showYiciyuanLogin}
        onClose={() => { setShowYiciyuanLogin(false); setYiciyuanDiagnosticInfo(null); }}
        onLoginSuccess={() => {
          setShowYiciyuanLogin(false);
          setYiciyuanDiagnosticInfo(null);
          // Clear cached credentials so they're re-fetched with new token
          setYiciyuanCredentials(null);
          setYiciyuanTokenA(null);
        }}
        diagnosticInfo={yiciyuanDiagnosticInfo}
      />

      <BleScanPicker
        open={showLockBlePicker}
        namePrefixes={blePickerPrefixes}
        onSelect={(device) => {
          setShowLockBlePicker(false);
          blePickerResolveRef.current?.(device);
          blePickerResolveRef.current = null;
        }}
        onCancel={() => {
          setShowLockBlePicker(false);
          blePickerResolveRef.current?.(null);
          blePickerResolveRef.current = null;
        }}
      />

      {/* Verification Photo Lightbox */}
      {verificationPhotoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setVerificationPhotoPreview(null)}
        >
          <img
            src={verificationPhotoPreview}
            alt="验证照片"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setVerificationPhotoPreview(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"
          >
            <XCircle size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
