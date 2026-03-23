import React, { useState, useEffect, useCallback } from 'react';
import { FollowUserItem, FollowStats } from '../../types';
import { followApi } from '../../lib/api';
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserMinus,
  Loader2,
  Search,
  Crown,
} from 'lucide-react';
import { useUserProfileNavigation } from '../layout/MainLayout';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}个月前`;
};

type TabType = 'following' | 'followers';

interface FollowListPageProps {
  onBack: () => void;
  initialTab?: TabType;
}

export const FollowListPage: React.FC<FollowListPageProps> = ({
  onBack,
  initialTab = 'following',
}) => {
  const { viewUserProfile } = useUserProfileNavigation();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [followingList, setFollowingList] = useState<FollowUserItem[]>([]);
  const [followersList, setFollowersList] = useState<FollowUserItem[]>([]);
  const [stats, setStats] = useState<FollowStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<number>>(new Set());
  const [hasMoreFollowing, setHasMoreFollowing] = useState(false);
  const [hasMoreFollowers, setHasMoreFollowers] = useState(false);
  const [followingOffset, setFollowingOffset] = useState(0);
  const [followersOffset, setFollowersOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, followingData, followersData] = await Promise.all([
        followApi.getMyStats(),
        followApi.getMyFollowing(20, 0),
        followApi.getMyFollowers(20, 0),
      ]);
      setStats(statsData);
      setFollowingList(followingData.users);
      setFollowersList(followersData.users);
      setHasMoreFollowing(followingData.hasMore);
      setHasMoreFollowers(followersData.hasMore);
      setFollowingOffset(followingData.users.length);
      setFollowersOffset(followersData.users.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more
  const loadMoreFollowing = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await followApi.getMyFollowing(20, followingOffset);
      setFollowingList(prev => [...prev, ...data.users]);
      setHasMoreFollowing(data.hasMore);
      setFollowingOffset(prev => prev + data.users.length);
    } catch (err) {
      console.error('Failed to load more following:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [followingOffset, isLoadingMore]);

  const loadMoreFollowers = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await followApi.getMyFollowers(20, followersOffset);
      setFollowersList(prev => [...prev, ...data.users]);
      setHasMoreFollowers(data.hasMore);
      setFollowersOffset(prev => prev + data.users.length);
    } catch (err) {
      console.error('Failed to load more followers:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [followersOffset, isLoadingMore]);

  // Handle follow/unfollow
  const handleToggleFollow = async (userId: number, isCurrentlyFollowing: boolean) => {
    if (followLoadingIds.has(userId)) return;

    setFollowLoadingIds(prev => new Set(prev).add(userId));
    try {
      const result = await followApi.toggle(userId);

      // Update the list
      const updateUser = (user: FollowUserItem) =>
        user.id === userId ? { ...user, isFollowedByMe: result.isFollowing } : user;

      setFollowingList(prev => prev.map(updateUser));
      setFollowersList(prev => prev.map(updateUser));

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          followingCount: result.followingCount,
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setFollowLoadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Filter users by search query
  const filterUsers = (users: FollowUserItem[]) => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.firstName.toLowerCase().includes(query) ||
      (user.lastName?.toLowerCase().includes(query)) ||
      (user.username?.toLowerCase().includes(query))
    );
  };

  const filteredFollowing = filterUsers(followingList);
  const filteredFollowers = filterUsers(followersList);
  const currentList = activeTab === 'following' ? filteredFollowing : filteredFollowers;
  const hasMore = activeTab === 'following' ? hasMoreFollowing : hasMoreFollowers;
  const loadMore = activeTab === 'following' ? loadMoreFollowing : loadMoreFollowers;

  const sentinelRef = useIntersectionObserver(
    () => { if (hasMore && !isLoadingMore) loadMore(); },
    { enabled: hasMore && !isLoadingMore }
  );

  // Get display name
  const getDisplayName = (user: FollowUserItem) => {
    return user.firstName + (user.lastName ? ` ${user.lastName}` : '');
  };

  // Get avatar URL
  const getAvatarUrl = (user: FollowUserItem) => {
    return user.photoUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName)}&background=EE5A7C&color=fff`;
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">关注列表</h1>
          {stats && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.followingCount} 关注 · {stats.followersCount} 粉丝
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('following')}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'following'
                ? 'text-primary border-primary'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            关注 {stats ? `(${stats.followingCount})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'followers'
                ? 'text-primary border-primary'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            粉丝 {stats ? `(${stats.followersCount})` : ''}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索用户..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <Users size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
            >
              重试
            </button>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <Users size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {searchQuery
                ? '未找到匹配的用户'
                : activeTab === 'following'
                ? '还没有关注任何人'
                : '还没有粉丝'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {currentList.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <button
                    onClick={() => viewUserProfile(user.id)}
                    className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-slate-100"
                  >
                    <img
                      src={getAvatarUrl(user)}
                      alt={getDisplayName(user)}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {/* Info */}
                  <button
                    onClick={() => viewUserProfile(user.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {getDisplayName(user)}
                      </span>
                      {user.isPremium && (
                        <Crown size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
                      )}
                      {user.isFollowingMe && activeTab === 'following' && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                          互关
                        </span>
                      )}
                    </div>
                    {user.username && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">@{user.username}</p>
                    )}
                    {user.bio && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{user.bio}</p>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Lv.{user.level} · {formatRelativeTime(user.followedAt)}关注
                    </p>
                  </button>

                  {/* Follow Button */}
                  <button
                    onClick={() => handleToggleFollow(user.id, user.isFollowedByMe)}
                    disabled={followLoadingIds.has(user.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 disabled:opacity-50 ${
                      user.isFollowedByMe
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {followLoadingIds.has(user.id) ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : user.isFollowedByMe ? (
                      <span className="flex items-center gap-1">
                        <UserMinus size={14} />
                        已关注
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <UserPlus size={14} />
                        关注
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-4">
              {isLoadingMore && (
                <div className="flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
