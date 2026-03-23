import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlaygroundLockSkeleton, TaskCardSkeleton, PostCardSkeleton } from '../ui/Skeleton';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { SelfLockSummary, LOCK_TYPE_NAMES, PostItem, TaskRequestSummary, TaskRequestStatus, TaskRequestProposalDetail
 } from '../../types';
import { selfLockApi, postsApi, keyholderApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { platformOpenTelegramChat } from '../../lib/platform-actions';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
// Campus task hooks removed - only task requests remain
import { useInfiniteTaskRequests, useMyTaskRequests, useMyProposals, taskRequestQueryKeys } from '../../hooks/useTaskRequests';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { CommunityTab } from './CommunityTab';
import {
  Search,
  Plus,
  Coins,
  Loader2,
  RefreshCw,
  PackageOpen,
  Users,
  MessageSquare,
  Heart,
  EyeOff,
  Lock,
  Key,
  Timer,
  Snowflake,
  Droplets,
  Crown,
  X,
  ArrowLeft,
  UserX,
  Trophy,
  FileText,
  Megaphone,
  Compass,
  Dumbbell,
  UserCircle,
  MessageCircle,
  Trash2,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { FloatingDock } from '@/src/components/ui/floating-dock';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { ImageLightbox } from '../ui/ImageLightbox';
import { MarqueeText } from '../ui/MarqueeText';
import { useUserProfileNavigation } from '../layout/MainLayout';

interface CampusTasksProps {
  onLockClick?: (lock: SelfLockSummary) => void;
  onPostClick?: (postId: number) => void;
  onPostCreateModalChange?: (isOpen: boolean) => void;
  onTaskRequestClick?: (requestId: number) => void;
  onCreateTaskRequest?: () => void;
}

// Default avatar when none provided
const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

// Format relative time
/** Compact duration format: 45m, 5h 30m, 3d 12h, 15d, 2mo, 1y 3mo */
const formatCompactDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m > 0 ? `${hours}h ${m}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    const h = hours % 24;
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    const d = days % 30;
    return d > 0 ? `${months}mo ${d}d` : `${months}mo`;
  }
  const years = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${years}y ${mo}mo` : `${years}y`;
};

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

export const CampusTasks: React.FC<CampusTasksProps> = ({ onLockClick, onPostClick, onPostCreateModalChange, onTaskRequestClick, onCreateTaskRequest }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const confirm = useConfirm();
  const isDesktop = useIsDesktop();
  const { viewUserProfile } = useUserProfileNavigation();
  const currentUserId = user?.id ?? 0;
  const [activeSegment, setActiveSegment] = useState<'explore' | 'playground' | 'my-tasks' | 'community'>('playground');
  const [topBarVisible, setTopBarVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDirection(scrollRef, setTopBarVisible);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<{ imageUrl: string }[] | null>(null);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  const PLAYGROUND_PAGE_SIZE = 20;

  // My posts state
  const [myPosts, setMyPosts] = useState<PostItem[]>([]);
  const [isLoadingMyPosts, setIsLoadingMyPosts] = useState(false);
  const [myPostsLoaded, setMyPostsLoaded] = useState(false);

  const fetchMyPosts = useCallback(async () => {
    setIsLoadingMyPosts(true);
    try {
      const response = await postsApi.getMyPosts(50, 0);
      setMyPosts(response);
      setMyPostsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch my posts:', err);
    } finally {
      setIsLoadingMyPosts(false);
    }
  }, []);

  useEffect(() => {
    if (activeSegment === 'my-tasks' && !myPostsLoaded) {
      fetchMyPosts();
    }
  }, [activeSegment, myPostsLoaded, fetchMyPosts]);

  // Task request queries
  const taskRequestsQuery = useInfiniteTaskRequests(undefined);
  const myTaskRequestsQuery = useMyTaskRequests();
  const myProposalsQuery = useMyProposals();

  // Playground infinite query
  const playgroundQuery = useInfiniteQuery({
    queryKey: ['playground', 'infinite'],
    queryFn: ({ pageParam = 0 }) =>
      selfLockApi.getPlaygroundLocks(PLAYGROUND_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PLAYGROUND_PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
    enabled: activeSegment === 'playground',
  });

  // Derived data from React Query
  const playgroundLocks = (() => {
    const all = playgroundQuery.data?.pages.flat() ?? [];
    const seen = new Set<number>();
    return all.filter(lock => {
      if (seen.has(lock.id)) return false;
      seen.add(lock.id);
      return true;
    });
  })();
  const taskRequests = taskRequestsQuery.data?.pages.flat() ?? [];
  const myTaskRequests = myTaskRequestsQuery.data ?? [];
  const myProposals = myProposalsQuery.data ?? [];

  // Loading states from React Query
  const isLoadingPlayground = playgroundQuery.isLoading;

  // Infinite scroll sentinels
  const playgroundSentinelRef = useIntersectionObserver(
    () => { if (playgroundQuery.hasNextPage && !playgroundQuery.isFetchingNextPage) playgroundQuery.fetchNextPage(); },
    { enabled: playgroundQuery.hasNextPage === true && !playgroundQuery.isFetchingNextPage }
  );
  const taskRequestsSentinelRef = useIntersectionObserver(
    () => { if (taskRequestsQuery.hasNextPage && !taskRequestsQuery.isFetchingNextPage) taskRequestsQuery.fetchNextPage(); },
    { enabled: taskRequestsQuery.hasNextPage === true && !taskRequestsQuery.isFetchingNextPage }
  );

  // Review modal state

  // Like state
  const [likingLockId, setLikingLockId] = useState<number | null>(null);

  // Claim lock state
  const [claimingLockId, setClaimingLockId] = useState<number | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    locks: SelfLockSummary[];
    posts: PostItem[];
  }>({ locks: [], posts: [] });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Community create post trigger
  const [createPostTrigger, setCreatePostTrigger] = useState(0);

  // Handle like lock
  const handleLikeLock = async (lockId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikingLockId(lockId);
    try {
      await selfLockApi.like(lockId);
      queryClient.invalidateQueries({ queryKey: ['playground', 'infinite'] });
    } catch (err: any) {
      setError(err.message || '点赞失败');
    } finally {
      setLikingLockId(null);
    }
  };

  // Open Telegram chat with lock owner
  const openChatWithOwner = (username: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!username) return;
    platformOpenTelegramChat(username);
  };

  // Handle apply for lock (申请制 - creates PENDING application)
  const handleApplyLock = async (lockId: number, ownerUsername: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimingLockId(lockId);
    try {
      await keyholderApi.applyForLock(lockId);
      queryClient.invalidateQueries({ queryKey: ['playground', 'infinite'] });
    } catch (err: any) {
      setError(err.message || '申请失败');
    } finally {
      setClaimingLockId(null);
    }
  };

  // Handle cancel application
  const handleCancelApplication = async (lockId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimingLockId(lockId);
    try {
      await keyholderApi.cancelApplication(lockId);
      queryClient.invalidateQueries({ queryKey: ['playground', 'infinite'] });
    } catch (err: any) {
      setError(err.message || '取消失败');
    } finally {
      setClaimingLockId(null);
    }
  };

  // Handle delete my post
  const handleDeleteMyPost = async (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirm({ title: '确认删除', description: '确定要删除这篇帖子吗？', destructive: true }))) return;
    try {
      await postsApi.deletePost(postId);
      setMyPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  // Playground data is loaded automatically by the infinite query when enabled

  // Search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ locks: [], posts: [] });
      return;
    }

    setIsSearching(true);
    try {
      // Search based on current active segment
      if (activeSegment === 'playground') {
        const locks = await selfLockApi.searchPlaygroundLocks(query, 20);
        setSearchResults({ locks, posts: [] });
      } else if (activeSegment === 'community') {
        const response = await postsApi.searchPosts(query, undefined, 20);
        setSearchResults({ locks: [], posts: response.posts });
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [activeSegment]);

  // Debounced search
  useEffect(() => {
    if (!isSearchOpen) return;

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchOpen, performSearch]);

  // Focus search input when opening
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Clear search when closing
  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ locks: [], posts: [] });
  };

  // --- Render Helpers ---

  const renderLockCard = (lock: SelfLockSummary, onClick: () => void) => (
    <div
      key={lock.id}
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-soft active:scale-[0.98] transition-transform cursor-pointer border border-slate-50 dark:border-slate-700 relative overflow-hidden"
    >
      {/* Lock Type Stripe or Cover Thumbnail */}
      {lock.coverImageUrl ? (
        <div
          className="absolute left-0 top-0 bottom-0 w-16 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(lock.coverImageUrl); }}
        >
          <img src={lock.coverImageUrl} alt="" className="w-full h-full object-cover rounded-l-3xl" />
        </div>
      ) : (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
          lock.punishmentMode ? 'bg-red-500' :
          lock.lockType === 'SHARED' ? 'bg-violet-500' :
          lock.lockType === 'PRIVATE' ? 'bg-amber-500' : 'bg-rose-500'
        }`}></div>
      )}

      <div className={lock.coverImageUrl ? 'pl-18' : 'pl-2'}>
        {/* Header */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* User Avatar */}
            <div className="relative shrink-0">
              <img
                src={lock.userPhotoUrl || DEFAULT_AVATAR}
                alt={lock.username || 'User'}
                className="w-10 h-10 rounded-xl object-cover"
              />
              {/* Lock Type Indicator */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center ${
                lock.isFrozen ? 'bg-blue-500' :
                lock.isHygieneOpening ? 'bg-emerald-500' :
                lock.lockType === 'SHARED' ? 'bg-violet-500' :
                lock.lockType === 'PRIVATE' ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                {lock.isFrozen ? <Snowflake size={10} className="text-white" /> :
                 lock.isHygieneOpening ? <Droplets size={10} className="text-white" /> :
                 lock.lockType === 'SHARED' ? <Users size={10} className="text-white" /> :
                 lock.lockType === 'PRIVATE' ? <Key size={10} className="text-white" /> :
                 <Lock size={10} className="text-white" />}
              </div>
            </div>
            <div className="min-w-0">
              <MarqueeText className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {lock.username || `用户 #${lock.userId}`}
              </MarqueeText>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {formatRelativeTime(lock.createdAt)}
              </span>
            </div>
          </div>

          {/* Time Badge */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl shrink-0">
            {lock.hideRemainingTime ? (
              <EyeOff size={12} className="text-slate-400 dark:text-slate-500" />
            ) : (
              <Timer size={12} className="text-slate-400 dark:text-slate-500" />
            )}
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
              {lock.hideRemainingTime ? '???' :
               lock.remainingMinutes !== null ? formatCompactDuration(lock.remainingMinutes) : '--'}
            </span>
          </div>
        </div>

        {/* Status Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {lock.punishmentMode && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-1 rounded-full flex items-center gap-1 border border-red-200 dark:border-red-800">
              <AlertTriangle size={10} />
              惩罚模式
            </span>
          )}
          {lock.isFrozen && (
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-full flex items-center gap-1">
              <Snowflake size={10} />
              已冻结
            </span>
          )}
          {lock.isHygieneOpening && (
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-full flex items-center gap-1">
              <Droplets size={10} />
              卫生开启中
            </span>
          )}
          {lock.primaryKeyholderId && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-full flex items-center gap-1">
              <Key size={10} />
              有管理员
            </span>
          )}
          {!lock.primaryKeyholderId && lock.lockType === 'SHARED' && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-2 py-1 rounded-full flex items-center gap-1">
              <Crown size={10} />
              {lock.userId === currentUserId && lock.pendingApplicationCount > 0
                ? `${lock.pendingApplicationCount}人申请`
                : '等待申请'}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className={`w-2 h-2 rounded-full ${
              lock.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
            }`}></div>
            <span className="text-xs font-medium">
              {lock.status === 'ACTIVE' ? '锁定中' : lock.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Apply/Chat Button for Unclaimed Shared Locks (hide for own locks) */}
            {!lock.primaryKeyholderId && lock.lockType === 'SHARED' && lock.userId !== currentUserId && (
              lock.myApplicationStatus === 'PENDING' ? (
                <button
                  onClick={(e) => openChatWithOwner(lock.telegramUsername, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800"
                >
                  <MessageCircle size={12} />
                  <span className="text-xs font-bold">私聊</span>
                </button>
              ) : (
                <button
                  onClick={(e) => handleApplyLock(lock.id, lock.telegramUsername, e)}
                  disabled={claimingLockId === lock.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 hover:bg-violet-100 dark:bg-violet-950 border border-violet-200"
                >
                  {claimingLockId === lock.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Crown size={12} />
                  )}
                  <span className="text-xs font-bold">申请</span>
                </button>
              )
            )}

            {/* Like Button for Public Locks or Punishment Mode */}
            {(lock.isPublic || lock.punishmentMode) && (
              <button
                onClick={(e) => handleLikeLock(lock.id, e)}
                disabled={likingLockId === lock.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                  lock.isLikedByMe
                    ? 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-400'
                }`}
              >
                {likingLockId === lock.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Heart size={12} className={lock.isLikedByMe ? 'fill-current' : ''} />
                )}
                <span className="text-xs font-bold">{lock.likesReceived || '点赞'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTaskRequestCard = (request: TaskRequestSummary) => (
    <div
      key={request.id}
      onClick={() => onTaskRequestClick?.(request.id)}
      className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-soft mb-4 active:scale-[0.98] transition-transform cursor-pointer border border-slate-50 dark:border-slate-700 relative overflow-hidden"
    >
      {/* Amber stripe for task requests */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${request.status === 'OPEN' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>

      {/* Header */}
      <div className="flex justify-between items-start mb-3 pl-2">
        <div className="flex items-center gap-2">
          <img
            src={request.creatorAvatar || DEFAULT_AVATAR}
            className="w-8 h-8 rounded-full object-cover border border-slate-100 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
            alt="avatar"
            onClick={(e) => { e.stopPropagation(); viewUserProfile(request.creatorId); }}
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); viewUserProfile(request.creatorId); }}>{request.creatorName || '匿名用户'}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(request.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            request.status === 'OPEN' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
            request.status === 'COMPLETED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
            'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {request.status === 'OPEN' ? '悬赏中' : request.status === 'COMPLETED' ? '已结束' : '已取消'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="pl-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-3 line-clamp-2">
          {request.title}
        </h3>

        <div className="flex justify-between items-end">
          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
            {request.proposalCount > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <FileText size={12} />
                <span>{request.proposalCount} 个提案</span>
              </div>
            )}
          </div>

          {/* Reward Badge */}
          <div className="px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm bg-amber-100 text-amber-600 dark:text-amber-400">
            <Coins size={12} />
            {request.rewardAmount}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
    </div>
  );

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <PackageOpen size={48} className="mb-4" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
      <div className="p-6 pb-32 lg:pb-28 lg:max-w-[1200px] lg:mx-auto lg:w-full">
        {/* --- Top Bar (auto-hide on scroll) --- */}
        <div className={`sticky top-0 z-20 -mx-6 px-6 pt-0 pb-4 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ${topBarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">校园 <span className="text-primary">任务</span></h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">发布悬赏或赚取奖励</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (activeSegment === 'community') {
                    setCreatePostTrigger(prev => prev + 1);
                  } else if (activeSegment === 'explore') {
                    onCreateTaskRequest?.();
                  }
                }}
                className="h-10 px-4 rounded-full bg-slate-900 flex items-center justify-center gap-1.5 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
              >
                <Plus size={16} />
                <span className="text-xs font-bold">{
                  activeSegment === 'community' ? '发帖' :
                  activeSegment === 'explore' ? '悬赏' :
                  '发布'
                }</span>
              </button>
              <button
                onClick={async () => {
                  if (isRefreshing) return;
                  setIsRefreshing(true);
                  try {
                    if (activeSegment === 'explore') {
                      await taskRequestsQuery.refetch();
                    }
                    else if (activeSegment === 'playground') await playgroundQuery.refetch();
                    else if (activeSegment === 'my-tasks') {
                      await Promise.all([
                        myTaskRequestsQuery.refetch(),
                        myProposalsQuery.refetch(),
                        fetchMyPosts(),
                      ]);
                    }
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <Search size={20} />
              </button>
            </div>
          </div>

          {/* Segmented Control (mobile only) */}
          <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-2xl flex relative lg:hidden">
            <button
              onClick={() => setActiveSegment('playground')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeSegment === 'playground' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              操场
            </button>
            <button
              onClick={() => setActiveSegment('community')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeSegment === 'community' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              社区
            </button>
            <button
              onClick={() => setActiveSegment('explore')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeSegment === 'explore' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              探索
            </button>
            <button
              onClick={() => setActiveSegment('my-tasks')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeSegment === 'my-tasks' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              我的
            </button>

            {/* Animated Slider Background */}
            <div className={`absolute top-1 bottom-1 w-[calc(25%-3px)] bg-white dark:bg-slate-800 rounded-xl shadow-sm transition-transform duration-300 ease-spring ${
              activeSegment === 'playground' ? 'left-1 translate-x-0' :
              activeSegment === 'community' ? 'left-1 translate-x-[calc(100%+4px)]' :
              activeSegment === 'explore' ? 'left-1 translate-x-[calc(200%+8px)]' :
              'left-1 translate-x-[calc(300%+12px)]'
            }`}></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* --- Main Content --- */}

        {activeSegment === 'explore' ? (
          <>
            {/* Task Requests List */}
            {taskRequestsQuery.isLoading ? renderLoading() :
              taskRequests.length === 0 ? renderEmpty('暂无求任务') :
              <div className="space-y-4">
                {taskRequests.map(renderTaskRequestCard)}
                {/* Infinite scroll sentinel */}
                <div ref={taskRequestsSentinelRef} className="py-2">
                  {taskRequestsQuery.isFetchingNextPage && (
                    <div className="flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    </div>
                  )}
                  {!taskRequestsQuery.hasNextPage && taskRequests.length > 0 && (
                    <p className="text-center text-xs text-slate-300">已加载全部</p>
                  )}
                </div>
              </div>
            }
          </>
        ) : activeSegment === 'playground' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Playground Locks */}
            {isLoadingPlayground ? <div className="space-y-4"><PlaygroundLockSkeleton /><PlaygroundLockSkeleton /><PlaygroundLockSkeleton /></div> :
              playgroundLocks.length === 0 ? renderEmpty('暂无公开的锁') :
              <div className="space-y-4">
                {playgroundLocks.map(lock => renderLockCard(lock, () => onLockClick?.(lock)))}
                {/* Infinite scroll sentinel */}
                <div ref={playgroundSentinelRef} className="py-2">
                  {playgroundQuery.isFetchingNextPage && (
                    <div className="flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    </div>
                  )}
                  {!playgroundQuery.hasNextPage && playgroundLocks.length > 0 && (
                    <p className="text-center text-xs text-slate-300">已加载全部</p>
                  )}
                </div>
              </div>
            }
          </div>
        ) : activeSegment === 'community' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 -mx-6 -mb-6">
            <CommunityTab
              onPostClick={onPostClick}
              onCreateModalChange={onPostCreateModalChange}
              createModalTrigger={createPostTrigger}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            {/* Section: My Task Requests (求任务) */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Megaphone size={16} className="text-amber-500 dark:text-amber-400" />
                我的求任务
              </h2>
              {myTaskRequestsQuery.isLoading ? (
                <div className="space-y-3"><TaskCardSkeleton /><TaskCardSkeleton /></div>
              ) : myTaskRequests.length > 0 ? (
                <div className="space-y-3">
                  {myTaskRequests.map(req => (
                    <div
                      key={req.id}
                      onClick={() => onTaskRequestClick?.(req.id)}
                      className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{req.title}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                            <span>{formatRelativeTime(req.createdAt)}</span>
                            <span>{req.proposalCount} 个提案</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'OPEN' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
                            req.status === 'COMPLETED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {req.status === 'OPEN' ? '悬赏中' : req.status === 'COMPLETED' ? '已结束' : '已取消'}
                          </span>
                          <div className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-0.5">
                            <Coins size={10} />
                            {req.rewardAmount}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">你还没有发布过求任务</p>
                </div>
              )}
            </div>

            {/* Section: My Proposals (我的提案) */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-violet-500 dark:text-violet-400" />
                我的提案
              </h2>
              {myProposalsQuery.isLoading ? (
                <div className="space-y-3"><TaskCardSkeleton /><TaskCardSkeleton /></div>
              ) : myProposals.length > 0 ? (
                <div className="space-y-3">
                  {myProposals.map(proposal => (
                    <div
                      key={proposal.id}
                      onClick={() => onTaskRequestClick?.(proposal.requestId)}
                      className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{proposal.title}</h3>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">提交于 {formatRelativeTime(proposal.createdAt)}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          proposal.status === 'SELECTED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
                          proposal.status === 'REJECTED' ? 'bg-red-100 text-red-600 dark:text-red-400' :
                          'bg-amber-100 text-amber-600 dark:text-amber-400'
                        }`}>
                          {proposal.status === 'SELECTED' ? '获胜' : proposal.status === 'REJECTED' ? '未选中' : '待审核'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">你还没有提交过提案</p>
                </div>
              )}
            </div>

            {/* Section: My Posts (我的帖子) */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <MessageCircle size={16} className="text-primary" />
                我的帖子
              </h2>
              {isLoadingMyPosts ? (
                <div className="space-y-3"><PostCardSkeleton /><PostCardSkeleton /></div>
              ) : myPosts.length > 0 ? (
                <div className="space-y-3">
                  {myPosts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => onPostClick?.(post.id)}
                      className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 line-clamp-1">{post.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">{post.contentPreview}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                            <span>{formatRelativeTime(post.createdAt)}</span>
                            <span className="flex items-center gap-0.5"><Eye size={10} /> {post.viewCount}</span>
                            <span className="flex items-center gap-0.5"><Heart size={10} /> {post.likeCount}</span>
                            <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {post.commentCount}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteMyPost(post.id, e)}
                          className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2 shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">你还没有发布过帖子</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col">
          {/* Search Header */}
          <div className="bg-white dark:bg-slate-800 shadow-sm p-4 safe-area-inset-top">
            <div className="flex items-center gap-3">
              <button
                onClick={closeSearch}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeSegment === 'explore' ? '搜索任务标题或描述...' :
                    activeSegment === 'playground' ? '搜索用户名...' :
                    activeSegment === 'community' ? '搜索帖子标题或内容...' :
                    '搜索...'
                  }
                  className="w-full h-10 pl-10 pr-10 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            {/* Current search scope indicator */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">搜索范围:</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                activeSegment === 'explore' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
                activeSegment === 'playground' ? 'bg-violet-100 text-violet-600 dark:text-violet-400' :
                'bg-blue-100 text-blue-600 dark:text-blue-400'
              }`}>
                {activeSegment === 'explore' ? '探索任务' :
                 activeSegment === 'playground' ? '操场锁' : '社区帖子'}
              </span>
            </div>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {isSearching ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <Search size={48} className="mb-4 opacity-50" />
                <p className="text-sm">输入关键词开始搜索</p>
              </div>
            ) : (
              <>
                {/* Lock Search Results */}
                {activeSegment === 'playground' && (
                  searchResults.locks.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">找到 {searchResults.locks.length} 个锁</p>
                      {searchResults.locks.map(lock => renderLockCard(lock, () => {
                        closeSearch();
                        onLockClick?.(lock);
                      }))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                      <PackageOpen size={48} className="mb-4" />
                      <p className="text-sm">未找到相关用户的锁</p>
                    </div>
                  )
                )}

                {/* Post Search Results */}
                {activeSegment === 'community' && (
                  searchResults.posts.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">找到 {searchResults.posts.length} 个帖子</p>
                      {searchResults.posts.map(post => (
                        <div
                          key={post.id}
                          onClick={() => {
                            closeSearch();
                            onPostClick?.(post.id);
                          }}
                          className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-soft active:scale-[0.98] transition-transform cursor-pointer border border-slate-50 dark:border-slate-700"
                        >
                          <div className="flex items-start gap-3">
                            {/* 匿名帖子：显示匿名头像 */}
                            {post.isAnonymous ? (
                              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                <UserX size={18} className="text-slate-400 dark:text-slate-500" />
                              </div>
                            ) : (
                              <img
                                src={post.authorAvatar || DEFAULT_AVATAR}
                                alt={post.authorName}
                                className="w-10 h-10 rounded-xl object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {/* 匿名帖子：显示"匿名用户" */}
                                <span className={`text-xs font-bold ${post.isAnonymous ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {post.isAnonymous ? '匿名用户' : post.authorName}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(post.createdAt)}</span>
                              </div>
                              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-1">{post.title}</h3>
                              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 text-xs">
                                <span className="flex items-center gap-1">
                                  <Heart size={12} />
                                  {post.likeCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare size={12} />
                                  {post.commentCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                      <PackageOpen size={48} className="mb-4" />
                      <p className="text-sm">未找到相关帖子</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

      </div>{/* end scroll wrapper */}

      {/* Desktop FloatingDock */}
      {isDesktop && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <FloatingDock
            items={[
              {
                title: '操场',
                icon: <Dumbbell className="h-full w-full text-slate-500 dark:text-slate-400" />,
                onClick: () => setActiveSegment('playground'),
                active: activeSegment === 'playground',
              },
              {
                title: '社区',
                icon: <Users className="h-full w-full text-slate-500 dark:text-slate-400" />,
                onClick: () => setActiveSegment('community'),
                active: activeSegment === 'community',
              },
              {
                title: '探索',
                icon: <Compass className="h-full w-full text-slate-500 dark:text-slate-400" />,
                onClick: () => setActiveSegment('explore'),
                active: activeSegment === 'explore',
              },
              {
                title: '我的',
                icon: <UserCircle className="h-full w-full text-slate-500 dark:text-slate-400" />,
                onClick: () => setActiveSegment('my-tasks'),
                active: activeSegment === 'my-tasks',
              },
            ]}
          />
        </div>
      )}

      {/* Submission Image Lightbox */}
      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxInitialIndex}
          onClose={() => setLightboxImages(null)}
        />
      )}

      {/* Cover Image Full Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewImageUrl(null)}
        >
          <img src={previewImageUrl} alt="封面预览" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-6 right-6 text-white bg-white/20 dark:bg-slate-800/20 rounded-full p-2 hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
            onClick={() => setPreviewImageUrl(null)}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
