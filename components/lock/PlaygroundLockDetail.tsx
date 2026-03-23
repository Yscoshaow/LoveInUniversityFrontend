import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelfLockSummary, SelfLockDetail, LockComment, PostLockCommentRequest,
  LOCK_TYPE_NAMES, VerificationStatusResponse, VerificationPhotoData,
  CoinTossInfo,
} from '../../types';
import { selfLockApi, verificationApi, stickerApi } from '../../lib/api';
import { platformShare, platformHaptic } from '../../lib/platform-actions';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { Player } from '@lottiefiles/react-lottie-player';
import {
  ArrowLeft, Lock, Unlock, Users, Key, Timer, EyeOff, Heart,
  Snowflake, Droplets, Crown, Send, Reply, CornerDownRight, X,
  Loader2, MessageSquare, Clock, AlertTriangle, MoreHorizontal,
  Camera, Image, Share2, Check, ArrowUpCircle, Coins
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUserProfileNavigation } from '../layout/MainLayout';
import { TimeChangeHistory } from '../ui/TimeChangeHistory';

// Default avatar
const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
};

// Format duration
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
};

// Format remaining time with seconds
const formatRemainingTime = (seconds: number | null, minutes: number | null): string => {
  if (seconds !== null) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}分${s}秒`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h < 24) return m > 0 ? `${h}小时${m}分` : `${h}小时`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}天${rh}小时` : `${d}天`;
  }
  if (minutes !== null) {
    return formatDuration(minutes);
  }
  return '--';
};

interface PlaygroundLockDetailProps {
  lock: SelfLockSummary;
  onBack: () => void;
  currentUserId?: number;
  /** View code used to access a private lock (from lockcode_ deep link) */
  viewCode?: string;
}

export const PlaygroundLockDetail: React.FC<PlaygroundLockDetailProps> = ({
  lock: lockSummary,
  onBack,
  currentUserId,
  viewCode,
}) => {
  const { viewUserProfile } = useUserProfileNavigation();
  const [lockDetail, setLockDetail] = useState<SelfLockDetail | null>(null);
  const [comments, setComments] = useState<LockComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment input
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; parentId: number | null; userName: string } | null>(null);
  const [detailSheetComment, setDetailSheetComment] = useState<LockComment | null>(null);

  // Like
  const [isLiking, setIsLiking] = useState(false);
  const [likesReceived, setLikesReceived] = useState(lockSummary.likesReceived);
  const [isLikedByMe, setIsLikedByMe] = useState(lockSummary.isLikedByMe);

  // Remaining time countdown
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(lockSummary.remainingSeconds);

  // Check if current user is the lock owner
  const isOwner = currentUserId === lockSummary.userId;

  // Verification photo state for the photo viewer
  const [selectedPhoto, setSelectedPhoto] = useState<VerificationPhotoData | null>(null);

  // Share menu state
  const [showMenu, setShowMenu] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Sticker reaction state
  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  // Coin toss state
  const [coinTossInfo, setCoinTossInfo] = useState<CoinTossInfo | null>(null);
  const [coinTossAmount, setCoinTossAmount] = useState(1);
  const [isTossingCoin, setIsTossingCoin] = useState(false);
  const [coinTossMessage, setCoinTossMessage] = useState<string | null>(null);

  // Verification status query - check if verification is enabled and shared to community
  const {
    data: verificationStatus,
  } = useQuery<VerificationStatusResponse>({
    queryKey: ['verification-status', lockSummary.id],
    queryFn: () => verificationApi.getStatus(lockSummary.id),
    enabled: !!lockSummary.id,
  });

  // Verification photos query - only fetch if enabled AND shared to community
  const {
    data: verificationPhotos,
    isLoading: isLoadingPhotos,
  } = useQuery<VerificationPhotoData[]>({
    queryKey: ['verification-photos', lockSummary.id],
    queryFn: () => verificationApi.getPhotos(lockSummary.id),
    enabled: !!lockSummary.id && lockSummary.isPublic && !!verificationStatus?.enabled && !!verificationStatus?.config?.shareToCommunity,
  });

  // Filter to only shared photos
  const sharedPhotos = verificationPhotos?.filter(p => p.isShared) ?? [];

  // Fetch lock detail — use view code endpoint for private locks accessed via share link
  const fetchLockDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const detail = viewCode
        ? await selfLockApi.getLockDetailByViewCode(viewCode)
        : await selfLockApi.getLockDetail(lockSummary.id);
      setLockDetail(detail);
      if (detail.remainingSeconds !== null) {
        setRemainingSeconds(detail.remainingSeconds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [lockSummary.id, viewCode]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const data = await selfLockApi.getComments(lockSummary.id);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [lockSummary.id]);

  useEffect(() => {
    fetchLockDetail();
    fetchComments();
    // Fetch coin toss info
    selfLockApi.getCoinTossInfo(lockSummary.id).then(setCoinTossInfo).catch(() => {});
  }, [fetchLockDetail, fetchComments, lockSummary.id]);

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;
    if (lockSummary.hideRemainingTime && !isOwner) return; // Don't countdown if hidden for non-owners

    const timer = setInterval(() => {
      setRemainingSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, lockSummary.hideRemainingTime, isOwner]);

  // Post comment
  const handlePostComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;

    // If in detail sheet and no explicit replyingTo, treat as replying to parent
    const effectiveReply = replyingTo ?? (detailSheetComment ? { id: detailSheetComment.id, parentId: null, userName: detailSheetComment.userName || '匿名' } : null);

    setIsSubmittingComment(true);
    try {
      const topLevelId = effectiveReply ? (effectiveReply.parentId ?? effectiveReply.id) : undefined;
      const request: PostLockCommentRequest = {
        content: commentText.trim(),
        parentId: topLevelId,
        replyToCommentId: effectiveReply?.parentId ? effectiveReply.id : undefined,
      };
      const newComment = await selfLockApi.postComment(lockSummary.id, request);

      if (topLevelId) {
        // Add as reply to top-level comment
        setComments(prev => prev.map(c =>
          c.id === topLevelId
            ? { ...c, replies: [...c.replies, newComment] }
            : c
        ));
        // Also update detailSheetComment if open
        if (detailSheetComment?.id === topLevelId) {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: [...prev.replies, newComment],
          } : null);
        }
      } else {
        // Add as new top-level comment
        setComments(prev => [...prev, { ...newComment, replies: [] }]);
      }

      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Cancel reply
  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  // Like lock (optimistic update)
  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    // 乐观更新：立即反馈
    const prevLikes = likesReceived;
    const prevIsLiked = isLikedByMe;
    setLikesReceived(prev => prev + 1);
    setIsLikedByMe(true);

    try {
      const result = await selfLockApi.like(lockSummary.id);
      setLikesReceived(result.currentLikes); // 以后端为准
    } catch (err) {
      // 失败回滚
      setLikesReceived(prevLikes);
      setIsLikedByMe(prevIsLiked);
      console.error('Failed to like:', err);
    } finally {
      setIsLiking(false);
    }
  };

  // Coin toss
  const handleCoinToss = async () => {
    if (isTossingCoin || !coinTossInfo || coinTossAmount < 1) return;
    setIsTossingCoin(true);
    setCoinTossMessage(null);
    try {
      const result = await selfLockApi.tossCoin(lockSummary.id, coinTossAmount);
      setCoinTossMessage(
        lockSummary.hideRemainingTime
          ? `投入 ${result.coinsUsed} 枚硬币，时间已变化`
          : `投入 ${result.coinsUsed} 枚硬币，增加了 ${result.timeAddedMinutes} 分钟`
      );
      setCoinTossInfo(prev => prev ? {
        ...prev,
        userCoinsTossed: result.totalCoinsTossed,
        totalCoinsTossed: prev.totalCoinsTossed + result.coinsUsed
      } : prev);
      // Refresh lock detail to update time
      fetchLockDetail();
    } catch (err: any) {
      setCoinTossMessage(err?.message || '投币失败');
    } finally {
      setIsTossingCoin(false);
    }
  };

  const startLongPress = (commentId: number, x: number, y: number) => {
    if (stickerPacks.length === 0) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      setShowStickerPicker(commentId);
      longPressTimer.current = null;
      platformHaptic('medium');
    }, 500);
  };

  const moveLongPress = (x: number, y: number) => {
    if (!longPressStartPos.current || !longPressTimer.current) return;
    const dx = x - longPressStartPos.current.x;
    const dy = y - longPressStartPos.current.y;
    if (dx * dx + dy * dy > 100) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStartPos.current = null;
  };

  const longPressHandlers = (commentId: number) => ({
    onTouchStart: (e: React.TouchEvent) => startLongPress(commentId, e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => e.touches[0] && moveLongPress(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: endLongPress,
    onMouseDown: (e: React.MouseEvent) => startLongPress(commentId, e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => moveLongPress(e.clientX, e.clientY),
    onMouseUp: endLongPress,
    onMouseLeave: endLongPress,
  });

  // Toggle sticker reaction on a comment
  const handleToggleReaction = async (commentId: number, stickerId: number) => {
    try {
      const res = await stickerApi.toggleLockReaction(commentId, stickerId);
      const updateReactions = (list: LockComment[]): LockComment[] =>
        list.map(c => {
          const updated = { ...c };
          if (c.id === commentId) {
            updated.reactions = res.reactions;
          }
          if (c.replies?.length) {
            updated.replies = updateReactions(c.replies);
          }
          return updated;
        });
      setComments(prev => updateReactions(prev));
      // Also update detailSheetComment if open
      if (detailSheetComment) {
        if (detailSheetComment.id === commentId) {
          setDetailSheetComment(prev => prev ? { ...prev, reactions: res.reactions } : null);
        } else {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: prev.replies.map(r => r.id === commentId ? { ...r, reactions: res.reactions } : r),
          } : null);
        }
      }
      setShowStickerPicker(null);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Bump lock
  const [isBumping, setIsBumping] = useState(false);
  const [bumpedAt, setBumpedAt] = useState<string | null>(lockSummary.lastBumpedAt);
  const handleBumpLock = async () => {
    if (isBumping) return;
    setIsBumping(true);
    try {
      await selfLockApi.bumpLock(lockSummary.id);
      setBumpedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || '顶锁失败');
    } finally {
      setIsBumping(false);
    }
  };

  // Calculate locked duration
  const getLockedDuration = (): number => {
    if (!lockDetail) return 0;
    const createdAt = new Date(lockDetail.lock.createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
  };

  // Determine if time should be visible
  // Owner can always see if hideRemainingTime is false
  // Others can see if hideRemainingTime is false, OR if they're not the owner (they can see hidden time)
  const canSeeTime = !lockSummary.hideRemainingTime || !isOwner;

  // Get gradient color based on lock state
  const getHeaderGradient = () => {
    if (lockSummary.isFrozen) return 'from-blue-600 to-cyan-600';
    if (lockSummary.isHygieneOpening) return 'from-emerald-600 to-teal-600';
    if (lockSummary.lockType === 'SHARED') return 'from-violet-600 to-purple-600';
    if (lockSummary.lockType === 'PRIVATE') return 'from-amber-600 to-orange-600';
    return 'from-rose-600 to-pink-600';
  };

  // Get status color
  const getStatusColor = () => {
    if (lockSummary.isFrozen) return 'bg-blue-500/20 text-blue-300';
    if (lockSummary.isHygieneOpening) return 'bg-emerald-500/20 text-emerald-300';
    return 'bg-green-500/20 text-green-300';
  };

  // Get status text
  const getStatusText = () => {
    if (lockSummary.isFrozen) return '已冻结';
    if (lockSummary.isHygieneOpening) return '卫生开启中';
    return lockSummary.status === 'ACTIVE' ? '锁定中' : lockSummary.status;
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col overflow-hidden lg:max-w-[1000px] lg:mx-auto lg:w-full">
        {/* Header gradient skeleton */}
        <div className="h-56 lg:h-48 bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0 relative">
          <div className="absolute top-8 left-6">
            <div className="bg-white/20 animate-pulse rounded-full h-10 w-10" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/20 animate-pulse rounded-full h-20 w-20" />
          </div>
        </div>
        {/* Lock info skeleton */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-6 w-40" />
          <div className="flex gap-3">
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-10 w-24" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-10 w-24" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-10 w-24" />
          </div>
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-full" />
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-2/3" />
        </div>
        {/* Comments skeleton */}
        <div className="px-5 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-8 w-8 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-20" />
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-600 dark:text-slate-300">{error}</p>
        <button onClick={onBack} className="mt-4 text-rose-500 dark:text-rose-400 font-bold">返回</button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-slate-800 flex flex-col relative overflow-hidden lg:max-w-[1000px] lg:mx-auto lg:w-full">
      {/* Image Header */}
      <div className={`h-56 lg:h-48 relative bg-gradient-to-br ${getHeaderGradient()} shrink-0`}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/20 dark:bg-slate-800/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-white/10 dark:bg-slate-800/10 blur-3xl" />
        </div>

        {/* Center lock icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white/10 dark:bg-slate-800/10 backdrop-blur-sm flex items-center justify-center">
            {lockSummary.isFrozen ? <Snowflake size={40} className="text-white/80" /> :
             lockSummary.isHygieneOpening ? <Droplets size={40} className="text-white/80" /> :
             lockSummary.lockType === 'SHARED' ? <Users size={40} className="text-white/80" /> :
             lockSummary.lockType === 'PRIVATE' ? <Key size={40} className="text-white/80" /> :
             <Lock size={40} className="text-white/80" />}
          </div>
        </div>

        {/* Overlay Controls */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-8 flex justify-between items-center text-white">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/30 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/30 transition-colors"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden min-w-35">
                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      const miniAppLink = `https://t.me/lovein_university_bot/university?startapp=lock_${lockSummary.id}`;
                      const shared = await platformShare({
                        text: '来看看这个锁吧！',
                        url: miniAppLink,
                        inlineQuery: `lock:${lockSummary.id}`,
                      });
                      if (!shared) {
                        setShareSuccess(true);
                        setTimeout(() => setShareSuccess(false), 2000);
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
                  >
                    {shareSuccess ? <Check size={16} className="text-green-500 dark:text-green-400" /> : <Share2 size={16} />}
                    <span className="text-sm font-medium">{shareSuccess ? '已复制' : '分享'}</span>
                  </button>
                  {isOwner && (() => {
                    const bumpedRecently = bumpedAt && (Date.now() - new Date(bumpedAt).getTime()) < 24 * 60 * 60 * 1000;
                    return (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleBumpLock();
                        }}
                        disabled={!!bumpedRecently || isBumping}
                        className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-slate-700 dark:text-slate-200 ${
                          bumpedRecently ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ArrowUpCircle size={16} className={bumpedRecently ? 'text-slate-300' : 'text-orange-500 dark:text-orange-400'} />
                        <span className="text-sm font-medium">{bumpedRecently ? '今日已顶' : '顶锁'}</span>
                      </button>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status Tag */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/20 ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
                <span className="text-white/80 text-xs flex items-center gap-1">
                  <Clock size={12} /> {formatRelativeTime(lockSummary.createdAt)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {LOCK_TYPE_NAMES[lockSummary.lockType]}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-28 lg:pb-8 -mt-4 bg-white dark:bg-slate-800 rounded-t-[32px] relative z-10">
        {/* Creator Profile */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => viewUserProfile(lockSummary.userId)}
              className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img
                src={lockSummary.userPhotoUrl || DEFAULT_AVATAR}
                className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                alt="user"
              />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
                lockSummary.isFrozen ? 'bg-blue-500' :
                lockSummary.isHygieneOpening ? 'bg-emerald-500' :
                lockSummary.lockType === 'SHARED' ? 'bg-violet-500' :
                lockSummary.lockType === 'PRIVATE' ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                {lockSummary.isFrozen ? <Snowflake size={10} className="text-white" /> :
                 lockSummary.isHygieneOpening ? <Droplets size={10} className="text-white" /> :
                 lockSummary.lockType === 'SHARED' ? <Users size={10} className="text-white" /> :
                 lockSummary.lockType === 'PRIVATE' ? <Key size={10} className="text-white" /> :
                 <Lock size={10} className="text-white" />}
              </div>
            </button>
            <button
              onClick={() => viewUserProfile(lockSummary.userId)}
              className="text-left hover:opacity-80 transition-opacity"
            >
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {lockSummary.username || `用户 #${lockSummary.userId}`}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Heart size={10} /> {likesReceived} 点赞
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <MessageSquare size={10} /> {comments.length} 评论
                </button>
              </div>
            </button>
          </div>
          <button
            onClick={handleLike}
            disabled={isLiking}
            className="text-rose-500 dark:text-rose-400 text-xs font-bold bg-rose-50 dark:bg-rose-950 px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-rose-100 transition-colors"
          >
            {isLiking ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} className={isLikedByMe ? 'fill-rose-500' : ''} />}
            {lockSummary.likeUnlockEnabled ? '助力解锁' : '点赞'}
          </button>
        </div>

        {/* Like Unlock Progress */}
        {lockSummary.likeUnlockEnabled && (
          <div className="bg-gradient-to-r from-rose-50 dark:from-rose-950 to-pink-50 dark:to-pink-950 rounded-2xl p-4 mb-6 border border-rose-100 dark:border-rose-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">点赞解锁进度</span>
              <span className={`text-xs font-bold ${likesReceived >= lockSummary.likeUnlockRequired ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}>
                {likesReceived} / {lockSummary.likeUnlockRequired}
              </span>
            </div>
            <div className="w-full bg-rose-200/50 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  likesReceived >= lockSummary.likeUnlockRequired
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                    : 'bg-gradient-to-r from-rose-400 to-pink-500'
                }`}
                style={{ width: `${Math.min(100, (likesReceived / lockSummary.likeUnlockRequired) * 100)}%` }}
              />
            </div>
            {likesReceived >= lockSummary.likeUnlockRequired ? (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">点赞已达标！</p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">还需要 {lockSummary.likeUnlockRequired - likesReceived} 个点赞</p>
            )}
          </div>
        )}

        {/* Coin Toss Section */}
        {coinTossInfo && !isOwner && (
          <div className="bg-gradient-to-r from-amber-50 dark:from-amber-950 to-yellow-50 dark:to-yellow-950 rounded-2xl p-4 mb-6 border border-amber-100 dark:border-amber-900">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">投币加时间</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              每枚硬币 = 1 校园点数，增加 {coinTossInfo.usePercentage
                ? `${coinTossInfo.percentagePerCoin}% 总时长`
                : `${coinTossInfo.minutesPerCoin} 分钟`}。
              已投 {coinTossInfo.userCoinsTossed}/{coinTossInfo.maxCoinsPerPlayer} 枚
            </p>
            {coinTossInfo.userCoinsTossed < coinTossInfo.maxCoinsPerPlayer ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={coinTossInfo.maxCoinsPerPlayer - coinTossInfo.userCoinsTossed}
                  value={coinTossAmount}
                  onChange={e => setCoinTossAmount(Math.max(1, Math.min(coinTossInfo.maxCoinsPerPlayer - coinTossInfo.userCoinsTossed, Number(e.target.value) || 1)))}
                  className="w-20 px-3 py-2 border border-amber-200 dark:border-amber-800 rounded-xl text-center text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  onClick={handleCoinToss}
                  disabled={isTossingCoin}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-yellow-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isTossingCoin ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                  投币
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">已达到最大投币数</p>
            )}
            {coinTossMessage && (
              <p className={`text-xs mt-2 font-medium ${coinTossMessage.includes('失败') ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {coinTossMessage}
              </p>
            )}
            {coinTossInfo.totalCoinsTossed > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">此锁已收到 {coinTossInfo.totalCoinsTossed} 枚硬币</p>
            )}
          </div>
        )}

        {/* Coin toss info for owner */}
        {coinTossInfo && isOwner && (
          <div className="bg-gradient-to-r from-amber-50 dark:from-amber-950 to-yellow-50 dark:to-yellow-950 rounded-2xl p-4 mb-6 border border-amber-100 dark:border-amber-900">
            <div className="flex items-center gap-2 mb-2">
              <Coins size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">投币拓展</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>每人最多 {coinTossInfo.maxCoinsPerPlayer} 枚 · 每枚 {coinTossInfo.usePercentage
                ? `${coinTossInfo.percentagePerCoin}%`
                : `${coinTossInfo.minutesPerCoin} 分钟`}</p>
              <p className="font-medium text-amber-600 dark:text-amber-400">已收到 {coinTossInfo.totalCoinsTossed} 枚硬币</p>
            </div>
          </div>
        )}

        {/* Time Stats Box */}
        <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 mb-6 shadow-sm">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block mb-3">锁定时间</span>
          <div className="grid grid-cols-2 gap-4">
            {/* Locked Duration */}
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">已锁定</span>
              <div className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1">
                <Timer size={20} className="text-slate-400 dark:text-slate-500" />
                {formatDuration(getLockedDuration())}
              </div>
            </div>

            {/* Remaining Time */}
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">剩余时间</span>
              {lockSummary.hideRemainingTime && isOwner ? (
                <div className="text-2xl font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <EyeOff size={20} />
                  隐藏
                </div>
              ) : canSeeTime ? (
                <div className="text-2xl font-bold text-rose-500 dark:text-rose-400 font-mono">
                  {formatRemainingTime(remainingSeconds, lockSummary.remainingMinutes)}
                </div>
              ) : (
                <div className="text-2xl font-bold text-slate-400 dark:text-slate-500">--</div>
              )}
            </div>
          </div>
        </div>

        {/* Status Tags */}
        <div className="mb-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 text-sm uppercase tracking-wider opacity-60">状态标签</h3>
          <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            {lockSummary.isFrozen && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Snowflake size={12} />
                已冻结
              </span>
            )}
            {lockSummary.isHygieneOpening && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Droplets size={12} />
                卫生开启中
              </span>
            )}
            {lockSummary.primaryKeyholderId && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Key size={12} />
                有管理员
              </span>
            )}
            {!lockSummary.primaryKeyholderId && lockSummary.lockType === 'SHARED' && (
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Crown size={12} />
                {lockSummary.pendingApplicationCount > 0
                  ? `${lockSummary.pendingApplicationCount}人申请`
                  : '等待申请'}
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 ${
              lockSummary.status === 'ACTIVE' ? 'bg-green-100 text-green-600 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                lockSummary.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
              }`} />
              {lockSummary.status === 'ACTIVE' ? '锁定中' : lockSummary.status}
            </span>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
              lockSummary.lockType === 'SHARED' ? 'bg-violet-100 text-violet-600 dark:text-violet-400' :
              lockSummary.lockType === 'PRIVATE' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' : 'bg-rose-100 text-rose-600 dark:text-rose-400'
            }`}>
              {LOCK_TYPE_NAMES[lockSummary.lockType]}
            </span>
          </div>
        </div>

        {/* Shared Verification Photos Section */}
        {lockSummary.isPublic && verificationStatus?.enabled && verificationStatus?.config?.shareToCommunity && (
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 text-sm uppercase tracking-wider opacity-60 flex items-center gap-2">
              <Camera size={14} />
              验证照片 ({sharedPhotos.length})
            </h3>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
              {isLoadingPhotos ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : sharedPhotos.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {sharedPhotos.slice(0, 9).map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo)}
                        className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-rose-300 transition-colors group"
                      >
                        {photo.imageUrl ? (
                          <img
                            src={photo.imageUrl}
                            alt={`验证照片 ${new Date(photo.uploadedAt).toLocaleDateString('zh-CN')}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image size={24} className="text-slate-300" />
                          </div>
                        )}
                        {/* Timestamp overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                          <span className="text-[9px] text-white/90 font-medium">
                            {new Date(photo.uploadedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {sharedPhotos.length > 9 && (
                    <div className="text-center mt-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        还有 {sharedPhotos.length - 9} 张照片
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                  <Image size={32} className="mb-2" />
                  <span className="text-xs">暂无共享验证照片</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Viewer Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div
              className="relative max-w-lg w-full bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <X size={16} />
              </button>
              {/* Photo */}
              {selectedPhoto.imageUrl ? (
                <img
                  src={selectedPhoto.imageUrl}
                  alt="验证照片"
                  className="w-full max-h-[60vh] object-contain bg-slate-100 dark:bg-slate-700"
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                  <Image size={48} className="text-slate-300" />
                </div>
              )}
              {/* Info bar */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Camera size={14} className="text-slate-400 dark:text-slate-500" />
                    <span>上传于 {new Date(selectedPhoto.uploadedAt).toLocaleString('zh-CN', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                    <span>计划 {new Date(selectedPhoto.scheduledTime).toLocaleString('zh-CN', {
                      month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Change History */}
        {lockSummary.status === 'ACTIVE' && (
          <TimeChangeHistory
            lockId={lockSummary.id}
            hideRemainingTime={lockSummary.hideRemainingTime}
            isOwnerView={isOwner}
            onViewProfile={viewUserProfile}
          />
        )}

        {/* Comments Section (bilibili-style) */}
        <div id="comments-section">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-sm uppercase tracking-wider opacity-60">
            评论 ({comments.length})
          </h3>

          {isLoadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-5 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={comment.userAvatar || DEFAULT_AVATAR}
                    className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover shrink-0 cursor-pointer"
                    alt="u"
                    onClick={() => viewUserProfile(comment.userId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm cursor-pointer hover:text-rose-500 dark:text-rose-400" onClick={() => viewUserProfile(comment.userId)}>
                        {comment.userName || '匿名'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">{formatRelativeTime(comment.createdAt)}</span>
                    </div>

                    {comment.isDeleted ? (
                      <span className="text-sm text-slate-400 dark:text-slate-500 italic">此评论已删除</span>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap select-none" {...longPressHandlers(comment.id)}>{comment.content}</p>
                    )}

                    {/* Reactions + Actions */}
                    {!comment.isDeleted && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {comment.reactions?.map(r => (
                          <button key={r.stickerId} onClick={() => handleToggleReaction(comment.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted ? 'border-rose-300 bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-rose-200 dark:border-rose-800'
                            }`}>
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button onClick={() => setReplyingTo({ id: comment.id, parentId: null, userName: comment.userName || '匿名' })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 flex items-center gap-1 transition-colors ml-1">
                          <MessageSquare size={10} /> 回复
                        </button>
                      </div>
                    )}

                    {/* Reply Preview (max 3 inline, bilibili-style) */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                        {comment.replies.slice(0, 3).map(reply => (
                          <div key={reply.id} className="text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{reply.userName || '匿名'}</span>
                            {reply.replyToUserName && (
                              <>
                                <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                                <span className="text-rose-500 dark:text-rose-400">@{reply.replyToUserName}</span>
                              </>
                            )}
                            <span className="text-slate-300 mx-1">:</span>
                            <span>{reply.isDeleted ? <em className="text-slate-400 dark:text-slate-500">此回复已删除</em> : reply.content}</span>
                          </div>
                        ))}
                        {comment.replies.length > 3 ? (
                          <button onClick={() => setDetailSheetComment(comment)}
                            className="text-[11px] text-rose-500 dark:text-rose-400 hover:text-rose-400 flex items-center gap-0.5 transition-colors">
                            共{comment.replies.length}条回复 &gt;
                          </button>
                        ) : (
                          <button onClick={() => setDetailSheetComment(comment)}
                            className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 flex items-center gap-0.5 transition-colors">
                            查看全部回复
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-8">暂无评论，来说点什么吧~</p>
          )}
        </div>
      </div>

      {/* Bottom Comment Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-4 pb-6 z-20">
        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400 px-3 py-2 rounded-xl text-xs mb-3">
            <div className="flex items-center gap-2">
              <CornerDownRight size={12} />
              <span>回复 <strong>{replyingTo.userName}</strong></span>
            </div>
            <button
              onClick={handleCancelReply}
              className="p-1 hover:bg-rose-100 rounded-full transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
              isLikedByMe
                ? 'bg-rose-100 text-rose-500 dark:text-rose-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950'
            }`}
          >
            {isLiking ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Heart size={18} className={isLikedByMe ? 'fill-rose-500' : ''} />
            )}
          </button>

          {/* Comment Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
              placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : "发表评论..."}
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all"
            />
            <button
              onClick={handlePostComment}
              disabled={isSubmittingComment || !commentText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-rose-500 text-white rounded-full disabled:opacity-50 transition-opacity"
            >
              {isSubmittingComment ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Comment Detail Sheet */}
      {detailSheetComment && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <button
              onClick={() => {
                setDetailSheetComment(null);
                setReplyingTo(null);
                setCommentText('');
              }}
              className="p-1"
            >
              <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
              评论详情 ({(detailSheetComment.replies?.length || 0) + 1})
            </span>
            <div className="w-7" />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
            {/* Parent Comment */}
            <div className="flex gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <img
                src={detailSheetComment.userAvatar || DEFAULT_AVATAR}
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                alt="u"
                onClick={() => viewUserProfile(detailSheetComment.userId)}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{detailSheetComment.userName || '匿名'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detailSheetComment.createdAt)}</span>
                </div>
                {detailSheetComment.isDeleted ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">此评论已删除</span>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(detailSheetComment.id)}>{detailSheetComment.content}</p>
                )}
                {!detailSheetComment.isDeleted && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {detailSheetComment.reactions?.map(r => (
                      <button
                        key={r.stickerId}
                        onClick={() => handleToggleReaction(detailSheetComment.id, r.stickerId)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                          r.hasReacted
                            ? 'border-rose-300 bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                        <span>{r.count}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setReplyingTo({ id: detailSheetComment.id, parentId: null, userName: detailSheetComment.userName || '匿名' })}
                      className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 flex items-center gap-1 transition-colors ml-1"
                    >
                      <Reply size={10} /> 回复
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* All Replies */}
            <div className="space-y-3">
              {detailSheetComment.replies?.map(reply => (
                <div key={reply.id} className="flex gap-3">
                  <img
                    src={reply.userAvatar || DEFAULT_AVATAR}
                    className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                    alt="u"
                    onClick={() => viewUserProfile(reply.userId)}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{reply.userName || '匿名'}</span>
                        {reply.replyToUserName && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                            <span className="text-rose-500 dark:text-rose-400">@{reply.replyToUserName}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                    </div>
                    {reply.isDeleted ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">此回复已删除</span>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(reply.id)}>{reply.content}</p>
                    )}
                    {!reply.isDeleted && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {reply.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(reply.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted
                                ? 'border-rose-300 bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: reply.id, parentId: detailSheetComment.id, userName: reply.userName || '匿名' })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} /> 回复
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Reply Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 pb-6 space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400 px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1.5">
                  <CornerDownRight size={11} />
                  <span>回复 <strong>{replyingTo.userName}</strong></span>
                </div>
                <button onClick={handleCancelReply} className="p-0.5 hover:bg-rose-100 rounded-full transition-colors">
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : `回复 ${detailSheetComment.userName || '匿名'}...`}
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all"
              />
              <button
                onClick={handlePostComment}
                disabled={isSubmittingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-rose-500 text-white rounded-full disabled:opacity-50"
              >
                {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticker Picker Overlay */}
      {showStickerPicker !== null && stickerPacks.length > 0 && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center"
          onClick={() => setShowStickerPicker(null)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl max-h-[40vh] flex flex-col animate-in slide-in-from-bottom duration-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
              {stickerPacks.map((pack, idx) => (
                <button
                  key={pack.id}
                  onClick={() => setActivePackIndex(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    activePackIndex === idx
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {pack.stickers[0] && (
                    <Player src={pack.stickers[0].fileUrl} style={{ width: 14, height: 14, pointerEvents: 'none' }} />
                  )}
                  {pack.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {stickerPacks[activePackIndex]?.stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => handleToggleReaction(showStickerPicker!, sticker.id)}
                    className="aspect-square rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950 p-1.5 transition-all active:scale-90"
                  >
                    <Player
                      src={sticker.fileUrl}
                      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                    />
                  </button>
                ))}
              </div>
              {(!stickerPacks[activePackIndex]?.stickers.length) && (
                <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-6">此贴纸组暂无贴纸</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaygroundLockDetail;
