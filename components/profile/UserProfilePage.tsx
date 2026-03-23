import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User as UserIcon,
  Tag,
  Calendar,
  MessageCircle,
  MessageSquare,
  Share2,
  Loader2,
  ExternalLink,
  FileText,
  Heart,
  Eye,
  Clock,
  Flame,
  Target,
  Star,
  Ban,
  Shield,
  ShieldOff,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Users,
  Lock,
  Palette,
  Film,
  BookOpen,
  MoreHorizontal,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { userProfileApi, UserPublicProfile, followApi, blockApi, postsApi, galleryApi, cinemaApi, booksApi } from '@/lib/api';
import { StudentCardDisplay } from '../ui/StudentCardDisplay';
import { ShareCardModal } from '../ui/ShareCardModal';
import { SelfLockCard } from '../ui/SelfLockCard';
import { useAuth } from '@/lib/auth-context';
import { UserRoleModal } from './UserRoleModal';
import { BoardSection } from '../board/BoardSection';
import { GuestbookSection } from './GuestbookSection';
import type { FollowStats, FollowStatusResponse, SelfLockSummary, PostItem, GalleryItemSummary, CinemaVideoSummary, BookSummary } from '../../types';
import { platformOpenTelegramChat } from '../../lib/platform-actions';
import { POST_CATEGORY_NAMES } from '../../types';
import { toast } from 'sonner';

interface UserProfilePageProps {
  userId: number;
  onBack: () => void;
  onLockClick?: (lock: SelfLockSummary) => void;
  onPostClick?: (postId: number) => void;
  onGalleryItemClick?: (itemId: number) => void;
  onCinemaVideoClick?: (videoId: number) => void;
  onBookClick?: (bookId: number) => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  userId,
  onBack,
  onLockClick,
  onPostClick,
  onGalleryItemClick,
  onCinemaVideoClick,
  onBookClick,
}) => {
  const { user: currentUser, hasPermission } = useAuth();
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banLoading, setBanLoading] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);

  // Follow state
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatusResponse | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // More menu & role management
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const canManageRoles = hasPermission('user.role.manage');

  const isAdmin = hasPermission('user.ban');
  const isOwnProfile = currentUser?.id === userId;

  // Fetch user's public posts
  const { data: userPosts } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => postsApi.getUserPosts(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's gallery uploads
  const { data: galleryData } = useQuery({
    queryKey: ['user-gallery', userId],
    queryFn: () => galleryApi.getItems({ authorId: userId, pageSize: 6 }),
    staleTime: 5 * 60 * 1000,
  });
  const userGalleryItems = galleryData?.items ?? [];

  // Fetch user's cinema uploads
  const { data: cinemaData } = useQuery({
    queryKey: ['user-cinema', userId],
    queryFn: () => cinemaApi.getVideos({ authorId: userId, pageSize: 6 }),
    staleTime: 5 * 60 * 1000,
  });
  const userCinemaVideos = cinemaData?.videos ?? [];

  // Fetch user's book uploads
  const { data: booksData } = useQuery({
    queryKey: ['user-books', userId],
    queryFn: () => booksApi.getBooks({ authorId: userId, pageSize: 6 }),
    staleTime: 5 * 60 * 1000,
  });
  const userBooks = booksData?.books ?? [];

  // Real-time focus time
  const [focusTimeTick, setFocusTimeTick] = useState(0);
  const [profileFetchedAt, setProfileFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.activeLockStartedAt) return;
    const interval = setInterval(() => setFocusTimeTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [profile?.activeLockStartedAt]);

  const getLiveFocusHours = () => {
    if (!profile) return 0;
    if (!profile.activeLockStartedAt || !profileFetchedAt) return profile.focusHours;
    const extraHours = (Date.now() - profileFetchedAt) / 3_600_000;
    return profile.focusHours + extraHours;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await userProfileApi.getUser(userId);
        setProfile(data);
        setProfileFetchedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // Fetch follow stats and status
  useEffect(() => {
    const fetchFollowData = async () => {
      try {
        const [stats, status, blockStatus] = await Promise.all([
          followApi.getUserStats(userId),
          !isOwnProfile ? followApi.getStatus(userId) : Promise.resolve(null),
          !isOwnProfile ? blockApi.checkBlocked(userId) : Promise.resolve(null),
        ]);
        setFollowStats(stats);
        if (status) setFollowStatus(status);
        if (blockStatus) setIsBlocked(blockStatus.blocked);
      } catch (err) {
        console.error('Failed to fetch follow data:', err);
      }
    };

    if (userId) {
      fetchFollowData();
    }
  }, [userId, isOwnProfile]);

  // Handle follow/unfollow
  const handleToggleFollow = async () => {
    if (followLoading || isOwnProfile) return;
    try {
      setFollowLoading(true);
      const result = await followApi.toggle(userId);
      setFollowStatus(prev => prev ? { ...prev, isFollowing: result.isFollowing } : { isFollowing: result.isFollowing, isFollowedBy: false });
      setFollowStats(prev => prev ? { ...prev, followersCount: result.followersCount } : { followingCount: 0, followersCount: result.followersCount });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle block/unblock
  const handleToggleBlock = async () => {
    if (blockLoading || isOwnProfile) return;
    const action = isBlocked ? '取消拉黑' : '拉黑';
    if (!confirm(`确定要${action}该用户吗？`)) return;
    try {
      setBlockLoading(true);
      if (isBlocked) {
        await blockApi.unblock(userId);
        setIsBlocked(false);
        toast.success('已取消拉黑');
      } else {
        await blockApi.block(userId);
        setIsBlocked(true);
        toast.success('已拉黑');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBlockLoading(false);
    }
  };

  // Get display name
  const displayName = profile
    ? profile.firstName + (profile.lastName ? ` ${profile.lastName}` : '')
    : '';

  // Get avatar URL
  const avatarUrl = profile?.photoUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.firstName || 'U')}&background=EE5A7C&color=fff`;

  // Format registration date
  const formatJoinDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Handle ban user
  const handleBanUser = async () => {
    if (!profile || banLoading) return;
    try {
      setBanLoading(true);
      const result = await userProfileApi.banUser(profile.id, {
        reason: banReason || undefined,
      });
      if (result.success) {
        setProfile({
          ...profile,
          isBanned: result.isBanned,
          bannedAt: result.bannedAt,
          bannedReason: result.bannedReason,
        });
        setShowBanModal(false);
        setBanReason('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBanLoading(false);
    }
  };

  // Handle unban user
  const handleUnbanUser = async () => {
    if (!profile || banLoading) return;
    try {
      setBanLoading(true);
      const result = await userProfileApi.unbanUser(profile.id);
      if (result.success) {
        setProfile({
          ...profile,
          isBanned: result.isBanned,
          bannedAt: result.bannedAt,
          bannedReason: result.bannedReason,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto no-scrollbar lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header skeleton */}
        <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
        </div>

        <div className="p-6 pb-32 lg:pb-8">
          {/* Student card skeleton */}
          <div className="mb-6">
            <div className="w-full aspect-[86/54] bg-slate-200 dark:bg-slate-700 animate-pulse rounded-3xl" />
          </div>

          {/* Stats grid skeleton (4 columns) */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="text-center flex flex-col items-center gap-1">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
                  <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full mt-1" />
                  <div className="h-2.5 w-12 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Follow stats skeleton */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map(i => (
                <div key={i} className="text-center p-3">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                    <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                  </div>
                  <div className="h-3 w-8 mx-auto bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons skeleton */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
            <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
          </div>

          {/* Bio section skeleton */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
              <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
            </div>
            {/* Tags skeleton */}
            <div className="flex gap-2 mt-4">
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
              <div className="h-6 w-18 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
              <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
            </div>
          </div>

          {/* Board section skeleton */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft border border-slate-50 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
              <div className="h-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
        <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="font-bold text-slate-800 dark:text-slate-100">用户资料</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <UserIcon size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">{error || '用户不存在'}</p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto no-scrollbar lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-30">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="font-bold text-slate-800 dark:text-slate-100">用户资料</h1>
      </div>

      <div className="p-6 pb-32 lg:pb-8">
        {/* Student Card (at the top) */}
        <div className="mb-6">
          <StudentCardDisplay
            user={{
              id: profile.id,
              name: displayName,
              username: profile.username,
              avatar: avatarUrl,
              joinDate: new Date(profile.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' }),
              isPremium: profile.isPremium,
            }}
            disableQRClick={true}
            hideContactInfo={!profile.allowTelegramContact}
            cardFaceThemeKey={profile.equippedCardFace?.themeKey}
          />
        </div>

        {/* Personal Status */}
        {(profile.statusText || profile.statusImageUrl) && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-4 border border-slate-50 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-50 dark:bg-green-950 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={16} className="text-green-500 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                {profile.statusText && (
                  <p className="text-sm text-slate-700 dark:text-slate-200">{profile.statusText}</p>
                )}
                {profile.statusImageUrl && (
                  <img
                    src={profile.statusImageUrl}
                    alt="状态图片"
                    className="mt-2 w-full max-h-40 object-cover rounded-xl"
                  />
                )}
                {profile.statusUpdatedAt && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                    {(() => {
                      const diff = Date.now() - new Date(profile.statusUpdatedAt).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return '刚刚';
                      if (mins < 60) return `${mins}分钟前`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}小时前`;
                      const days = Math.floor(hours / 24);
                      return `${days}天前`;
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
          <div className="grid grid-cols-4 gap-2">
            {/* Level & XP */}
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center mb-1">
                <Star size={18} className="text-amber-500 dark:text-amber-400" />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Lv.{profile.level}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{profile.credits} XP</p>
            </div>
            {/* Focus Hours */}
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-1">
                <Clock size={18} className="text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{getLiveFocusHours().toFixed(1)}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">专注时长</p>
            </div>
            {/* Streak */}
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 dark:bg-orange-950 flex items-center justify-center mb-1">
                <Flame size={18} className="text-orange-500 dark:text-orange-400" />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.streakDays}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">连续天数</p>
            </div>
            {/* Tasks */}
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-green-50 dark:bg-green-950 flex items-center justify-center mb-1">
                <Target size={18} className="text-green-500 dark:text-green-400" />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.tasksCompleted}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">任务完成</p>
            </div>
          </div>
        </div>

        {/* Public Active Lock */}
        {profile.publicActiveLock && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={18} className="text-primary" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">正在专注中</h3>
            </div>
            <SelfLockCard
              lock={profile.publicActiveLock}
              onClick={() => onLockClick?.(profile.publicActiveLock!)}
            />
          </div>
        )}

        {/* Follow Stats Section */}
        {followStats && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  // TODO: Navigate to following list
                }}
                className="text-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Users size={16} className="text-primary" />
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{followStats.followingCount}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">关注</p>
              </button>
              <button
                onClick={() => {
                  // TODO: Navigate to followers list
                }}
                className="text-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Users size={16} className="text-secondary" />
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{followStats.followersCount}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">粉丝</p>
              </button>
            </div>
            {/* Mutual follow indicator */}
            {followStatus?.isFollowing && followStatus?.isFollowedBy && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
                <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-3 py-1 rounded-full">
                  <UserCheck size={12} />
                  互相关注
                </span>
              </div>
            )}
          </div>
        )}

        {/* Banned Status Banner (for admins or if user is banned) */}
        {profile.isBanned && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <Ban size={18} />
              <span className="font-semibold">该用户已被封禁</span>
            </div>
            {profile.bannedReason && (
              <p className="text-sm text-red-500 dark:text-red-400 mb-1">
                原因：{profile.bannedReason}
              </p>
            )}
            {profile.bannedAt && (
              <p className="text-xs text-red-400">
                封禁时间：{formatJoinDate(profile.bannedAt)}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5 mb-6">
          {/* Follow button */}
          {!isOwnProfile && !profile.isBanned && (
            <button
              onClick={handleToggleFollow}
              disabled={followLoading}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 ${
                followStatus?.isFollowing
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  : 'bg-primary text-white shadow-md hover:shadow-lg'
              }`}
            >
              {followLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : followStatus?.isFollowing ? (
                <>
                  <UserMinus size={16} />
                  已关注
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  关注
                </>
              )}
            </button>
          )}
          {/* Message button */}
          {profile.allowTelegramContact && profile.username && !profile.isBanned && (
            <button
              onClick={() => platformOpenTelegramChat(profile.username)}
              className="flex-1 py-2.5 bg-primary/10 text-primary rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-all active:scale-[0.98]"
            >
              <MessageCircle size={16} />
              发消息
              <ExternalLink size={12} className="opacity-50" />
            </button>
          )}
          {/* Share button (always visible) */}
          {isOwnProfile && (
            <button
              onClick={() => setIsShareCardOpen(true)}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
            >
              <Share2 size={16} />
              分享名片
            </button>
          )}
          {/* More menu (for non-own profiles) */}
          {!isOwnProfile && (
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                className="w-10 h-10 shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <MoreHorizontal size={18} />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-12 z-50 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => { setIsShareCardOpen(true); setShowMoreMenu(false); }}
                      className="w-full px-4 py-3 text-sm text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Share2 size={16} className="text-slate-400" />
                      分享名片
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700" />
                    <button
                      onClick={() => { handleToggleBlock(); setShowMoreMenu(false); }}
                      disabled={blockLoading}
                      className="w-full px-4 py-3 text-sm text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {blockLoading ? (
                        <Loader2 size={16} className="animate-spin text-slate-400" />
                      ) : isBlocked ? (
                        <>
                          <ShieldCheck size={16} className="text-green-500" />
                          <span className="text-green-600 dark:text-green-400">取消拉黑</span>
                        </>
                      ) : (
                        <>
                          <ShieldOff size={16} className="text-red-400" />
                          <span className="text-red-500 dark:text-red-400">拉黑用户</span>
                        </>
                      )}
                    </button>
                    {/* Admin section */}
                    {(isAdmin || canManageRoles) && (
                      <>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-750">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">管理员</span>
                        </div>
                        {/* Role management */}
                        {canManageRoles && (
                          <button
                            onClick={() => { setShowRoleModal(true); setShowMoreMenu(false); }}
                            className="w-full px-4 py-3 text-sm text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <Shield size={16} className="text-blue-400" />
                            管理角色
                          </button>
                        )}
                        {/* Ban/Unban */}
                        {isAdmin && (
                          <>
                            {profile.isBanned ? (
                              <button
                                onClick={() => { handleUnbanUser(); setShowMoreMenu(false); }}
                                disabled={banLoading}
                                className="w-full px-4 py-3 text-sm text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                              >
                                {banLoading ? (
                                  <Loader2 size={16} className="animate-spin text-slate-400" />
                                ) : (
                                  <>
                                    <UserCheck size={16} className="text-green-500" />
                                    <span className="text-green-600 dark:text-green-400">解除封禁</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setShowBanModal(true); setShowMoreMenu(false); }}
                                disabled={banLoading}
                                className="w-full px-4 py-3 text-sm text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                              >
                                <Ban size={16} className="text-red-400" />
                                <span className="text-red-500 dark:text-red-400">封禁用户</span>
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contact disabled notice */}
        {!profile.allowTelegramContact && !isOwnProfile && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 mb-6 border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              该用户未开启私信功能
            </p>
          </div>
        )}

        {/* Bio Section */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon size={18} className="text-primary" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">个人简介</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {profile.bio || (
              <span className="text-slate-400 dark:text-slate-500 italic">这个人很神秘，什么都没有写</span>
            )}
          </p>
        </div>

        {/* Tags Section */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={18} className="text-secondary" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">自我标签</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.tags && profile.tags.length > 0 ? (
              profile.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-secondary/10 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">还没有添加标签</span>
            )}
          </div>
        </div>

        {/* Guestbook */}
        <GuestbookSection profileUserId={userId} />

        {/* Showcase Board */}
        <BoardSection userId={userId} />

        {/* User Posts */}
        {userPosts && userPosts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileText size={16} className="text-secondary" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">发布的帖子</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">({userPosts.length})</span>
            </div>
            <div className="space-y-2">
              {userPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => onPostClick?.(post.id)}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full">
                      {POST_CATEGORY_NAMES[post.category]}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 mb-1">{post.title}</h4>
                  {post.contentPreview && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{post.contentPreview}</p>
                  )}
                  {post.imageUrls?.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {post.imageUrls.slice(0, 3).map((url, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                      {post.imageUrls.length > 3 && (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-xs text-slate-400 dark:text-slate-500">+{post.imageUrls.length - 3}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {post.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={12} className={post.isLikedByMe ? 'fill-rose-500 text-rose-500 dark:text-rose-400' : ''} />
                      {post.likeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {post.commentCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Uploads */}
        {userGalleryItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Palette size={16} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">美术馆作品</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">({galleryData?.total ?? userGalleryItems.length})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {userGalleryItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onGalleryItemClick?.(item.id)}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden active:scale-[0.97] transition-transform cursor-pointer"
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-700">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Palette size={20} className="text-slate-300" /></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {item.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Heart size={10} /> {item.likeCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cinema Uploads */}
        {userCinemaVideos.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Film size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">电影院作品</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">({cinemaData?.total ?? userCinemaVideos.length})</span>
            </div>
            <div className="space-y-2">
              {userCinemaVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => onCinemaVideoClick?.(video.id)}
                  className="flex gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-2 active:bg-slate-50 dark:active:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-24 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                    {video.coverImageUrl ? (
                      <img src={video.coverImageUrl} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-slate-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{video.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {video.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Heart size={10} /> {video.likeCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Book Uploads */}
        {userBooks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <BookOpen size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">图书馆作品</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">({booksData?.total ?? userBooks.length})</span>
            </div>
            <div className="space-y-2">
              {userBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => onBookClick?.(book.id)}
                  className="flex gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-2 active:bg-slate-50 dark:active:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                    {book.coverImageUrl ? (
                      <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><BookOpen size={14} className="text-slate-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{book.title}</p>
                    {book.categoryName && (
                      <span className="text-[10px] text-slate-400">{book.categoryName}</span>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {book.viewCount}</span>
                      {book.priceCampusPoints > 0 && (
                        <span className="text-amber-500">{book.priceCampusPoints} 点</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registration Info */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Calendar size={14} />
            加入于 {formatJoinDate(profile.createdAt)}
          </div>
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 mb-4">
              <Ban size={24} />
              <h3 className="text-lg font-bold">封禁用户</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              确定要封禁 <span className="font-semibold">{displayName}</span> 吗？
              封禁后该用户将无法登录应用。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                封禁原因（可选）
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="请输入封禁原因..."
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason('');
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleBanUser}
                disabled={banLoading}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {banLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  '确认封禁'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {showRoleModal && profile && (
        <UserRoleModal
          userId={userId}
          userName={displayName}
          onClose={() => setShowRoleModal(false)}
        />
      )}

      {profile && (
        <ShareCardModal
          isOpen={isShareCardOpen}
          onClose={() => setIsShareCardOpen(false)}
          userId={userId}
          cardData={{
            name: displayName,
            avatarUrl: avatarUrl,
            level: profile.level,
            xp: profile.credits % 10,
            nextLevelXp: 10,
            major: 'Student',
            studentId: String(profile.id).padStart(6, '0'),
            joinDate: (() => {
              const date = new Date(profile.createdAt);
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const year = String(date.getFullYear()).slice(-2);
              return `${month}/${year}`;
            })(),
            themeKey: profile.equippedCardFace?.themeKey,
          }}
        />
      )}
    </div>
  );
};
