import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Eye, Heart, Coins, Image as ImageIcon, Play, User, UserPlus, UserCheck, Film } from 'lucide-react';
import { galleryApi, cinemaApi, followApi, userProfileApi } from '../../lib/api';
import type { UserPublicProfile } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';
import { useUserProfileNavigation } from '../layout/MainLayout';
import type { GalleryItemSummary, CinemaVideoSummary, FollowStats, FollowStatusResponse } from '../../types';

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface CreatorProfilePageProps {
  authorId: number;
  source: 'gallery' | 'cinema';
  onBack: () => void;
  onGalleryItemClick?: (id: number) => void;
  onVideoClick?: (id: number) => void;
}

export const CreatorProfilePage: React.FC<CreatorProfilePageProps> = ({
  authorId,
  source,
  onBack,
  onGalleryItemClick,
  onVideoClick,
}) => {
  const { viewUserProfile } = useUserProfileNavigation();
  const [activeTab, setActiveTab] = useState<'gallery' | 'cinema'>(source);
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatusResponse | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);

  // Load profile, follow stats and status
  useEffect(() => {
    const load = async () => {
      try {
        const [profileData, stats, status] = await Promise.all([
          userProfileApi.getUser(authorId),
          followApi.getUserStats(authorId),
          followApi.getStatus(authorId),
        ]);
        setProfile(profileData);
        setFollowStats(stats);
        setFollowStatus(status);
      } catch {
        // ignore
      }
    };
    load();
  }, [authorId]);

  // Gallery items
  const { data: galleryData, isLoading: galleryLoading } = useQuery({
    queryKey: queryKeys.gallery.list({ page: 1, sortBy: 'latest', authorId }),
    queryFn: () => galleryApi.getItems({ authorId, page: 1, pageSize: 50 }),
    enabled: activeTab === 'gallery',
  });

  // Cinema videos
  const { data: cinemaData, isLoading: cinemaLoading } = useQuery({
    queryKey: queryKeys.cinema.list({ page: 1, sortBy: 'latest', authorId }),
    queryFn: () => cinemaApi.getVideos({ authorId, page: 1, pageSize: 50 }),
    enabled: activeTab === 'cinema',
  });

  const handleToggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const res = await followApi.toggle(authorId);
      setFollowStatus({ isFollowing: res.isFollowing, isFollowedBy: followStatus?.isFollowedBy ?? false });
      setFollowStats({ followingCount: res.followingCount, followersCount: res.followersCount });
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  };

  const authorName = profile?.firstName || '用户';
  const authorAvatar = profile?.photoUrl;
  const isFollowing = followStatus?.isFollowing ?? false;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">创作者主页</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-5">
        <div className="flex items-center gap-4">
          <button onClick={() => viewUserProfile(authorId)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
            {authorAvatar ? (
              <img src={authorAvatar} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <User size={28} className="text-slate-400 dark:text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{authorName}</h2>
              {profile?.bio && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{profile.bio}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span><span className="font-semibold text-slate-700 dark:text-slate-200">{followStats?.followersCount ?? 0}</span> 粉丝</span>
                <span><span className="font-semibold text-slate-700 dark:text-slate-200">{followStats?.followingCount ?? 0}</span> 关注</span>
              </div>
            </div>
          </button>
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              isFollowing
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
            }`}
          >
            {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
            {isFollowing ? '已关注' : '关注'}
          </button>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gallery' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ImageIcon size={16} />
            美术作品
          </button>
          <button
            onClick={() => setActiveTab('cinema')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cinema' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Film size={16} />
            视频作品
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'gallery' ? (
          galleryLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : !galleryData?.items?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <ImageIcon size={48} className="mb-3 opacity-50" />
              <p>暂无美术作品</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {galleryData.items.map((item: GalleryItemSummary) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onGalleryItemClick?.(item.id)}
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-700 relative overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={32} className="text-slate-300" />
                      </div>
                    )}
                    {item.priceCampusPoints > 0 && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Coins size={12} /> {item.priceCampusPoints}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{item.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-0.5"><Eye size={12} /> {item.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Heart size={12} /> {item.likeCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          cinemaLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
            </div>
          ) : !cinemaData?.videos?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <Film size={48} className="mb-3 opacity-50" />
              <p>暂无视频作品</p>
            </div>
          ) : (
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {cinemaData.videos.map((video: CinemaVideoSummary) => (
                <div
                  key={video.id}
                  className="w-full bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex gap-3 p-3 cursor-pointer"
                  onClick={() => onVideoClick?.(video.id)}
                >
                  <div className="w-28 h-20 bg-slate-100 dark:bg-slate-700 rounded-lg flex-shrink-0 relative overflow-hidden">
                    {video.coverImageUrl ? (
                      <img src={video.coverImageUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={24} className="text-slate-300" />
                      </div>
                    )}
                    {video.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{video.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-0.5"><Eye size={12} /> {video.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Heart size={12} /> {video.likeCount}</span>
                      {video.priceCampusPoints > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400"><Coins size={12} /> {video.priceCampusPoints}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default CreatorProfilePage;
