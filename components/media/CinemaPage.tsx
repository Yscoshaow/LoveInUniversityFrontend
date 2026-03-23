import React, { useState, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Film, Search, Eye, Heart, Upload, Coins, Play, X, User, Loader2, Trash2, ShoppingBag, Tag } from 'lucide-react';
import { cinemaApi, mediaTagsApi } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import type { CinemaVideoSummary } from '../../types';

type SortBy = 'latest' | 'hot' | 'likes';
const PAGE_SIZE = 20;

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface CinemaPageProps {
  onBack: () => void;
  onVideoClick: (id: number) => void;
  onUploadClick: () => void;
  onAuthorClick?: (authorId: number) => void;
}

export const CinemaPage: React.FC<CinemaPageProps> = ({ onBack, onVideoClick, onUploadClick, onAuthorClick }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<'browse' | 'my' | 'purchased'>('browse');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: popularTags } = useQuery({
    queryKey: ['media-tags', 'popular'],
    queryFn: () => mediaTagsApi.getPopular(),
  });

  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  }, []);

  const browseQuery = useInfiniteQuery({
    queryKey: ['cinema', 'browseInfinite', { search: debouncedSearch || undefined, sortBy, tag: selectedTag || undefined }],
    queryFn: ({ pageParam }) => cinemaApi.getVideos({ search: debouncedSearch || undefined, sortBy, tag: selectedTag || undefined, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: tab === 'browse',
  });

  const { data: myUploads, isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.cinema.myUploads(),
    queryFn: () => cinemaApi.getMyUploads(),
    enabled: tab === 'my',
  });

  const { data: myPurchases, isLoading: isPurchasedLoading } = useQuery({
    queryKey: queryKeys.cinema.myPurchases(),
    queryFn: () => cinemaApi.getMyPurchases(),
    enabled: tab === 'purchased',
  });

  const videos = tab === 'browse'
    ? (browseQuery.data?.pages.flatMap(p => p.videos) ?? [])
    : tab === 'my' ? myUploads : myPurchases;
  const loading = tab === 'browse' ? browseQuery.isLoading : tab === 'my' ? isMyLoading : isPurchasedLoading;
  const total = browseQuery.data?.pages[0]?.total ?? 0;

  const sentinelRef = useIntersectionObserver(
    () => { if (browseQuery.hasNextPage && !browseQuery.isFetchingNextPage) browseQuery.fetchNextPage(); },
    { enabled: tab === 'browse' && browseQuery.hasNextPage === true && !browseQuery.isFetchingNextPage }
  );

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'latest', label: '最新' },
    { key: 'hot', label: '最热' },
    { key: 'likes', label: '最多点赞' },
  ];

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个视频吗？删除后无法恢复。')) return;
    setDeletingId(id);
    try {
      await cinemaApi.deleteMyVideo(id);
      queryClient.invalidateQueries({ queryKey: queryKeys.cinema.myUploads() });
    } catch (e: any) {
      alert(e?.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Minimal Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">电影院</h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors ${showSearch ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
          >
            <Search size={18} />
          </button>
        </div>
        {showSearch && (
          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索视频..."
              autoFocus
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setDebouncedSearch(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs + Sort */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-2 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('browse')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'browse' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            浏览视频
          </button>
          <button
            onClick={() => setTab('my')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'my' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            我的视频
          </button>
          <button
            onClick={() => setTab('purchased')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'purchased' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            已购买
          </button>
          <button
            onClick={onUploadClick}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-md"
          >
            <Upload size={16} />
            上传
          </button>
        </div>

        {/* Sort pills */}
        {tab === 'browse' && (
          <div className="flex gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  sortBy === opt.key
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Tag filter (browse tab) */}
        {tab === 'browse' && popularTags?.tags && popularTags.tags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1"
              >
                <X size={10} /> 清除
              </button>
            )}
            {popularTags.tags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Tag size={10} />{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          </div>
        ) : !videos?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            {tab === 'purchased' ? <ShoppingBag size={48} className="mb-3 opacity-50" /> : <Film size={48} className="mb-3 opacity-50" />}
            <p>{tab === 'my' ? '你还没有上传视频' : tab === 'purchased' ? '你还没有购买过视频' : '暂无视频'}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {videos.map((video: CinemaVideoSummary) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={() => onVideoClick(video.id)}
                  onAuthorClick={onAuthorClick}
                  onDelete={tab === 'my' ? handleDelete : undefined}
                  isDeleting={deletingId === video.id}
                />
              ))}
            </div>

            {tab === 'browse' && (
              <div ref={sentinelRef} className="py-4">
                {browseQuery.isFetchingNextPage && (
                  <div className="flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                  </div>
                )}
                {!browseQuery.hasNextPage && total > 0 && (
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500">共 {total} 个视频</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const VideoCard: React.FC<{
  video: CinemaVideoSummary;
  onClick: () => void;
  onAuthorClick?: (authorId: number) => void;
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
}> = ({ video, onClick, onAuthorClick, onDelete, isDeleting }) => {
  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex gap-3 p-3">
      {/* Thumbnail */}
      <button onClick={onClick} className="w-28 h-20 bg-slate-100 dark:bg-slate-700 rounded-lg flex-shrink-0 relative overflow-hidden">
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
        {video.muxAssetStatus && video.muxAssetStatus !== 'ready' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs">处理中</span>
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <button onClick={onClick} className="w-full text-left">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{video.title}</h3>
        </button>
        {/* Author row */}
        <button
          onClick={() => onAuthorClick?.(video.authorId)}
          className="flex items-center gap-1.5 mt-0.5 group"
        >
          {video.authorAvatar ? (
            <img src={video.authorAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User size={8} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate group-hover:text-amber-600 dark:text-amber-400 transition-colors">
            {video.authorName || '匿名用户'}
          </span>
        </button>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-0.5"><Eye size={12} /> {video.viewCount}</span>
          <span className="flex items-center gap-0.5"><Heart size={12} /> {video.likeCount}</span>
          {video.priceCampusPoints > 0 && (
            <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400"><Coins size={12} /> {video.priceCampusPoints}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {video.reviewStatus !== 'APPROVED' && (
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
              video.reviewStatus === 'PENDING_REVIEW' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
            }`}>
              {video.reviewStatus === 'PENDING_REVIEW' ? '审核中' : '未通过'}
            </span>
          )}
          {onDelete && video.reviewStatus !== 'APPROVED' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
              disabled={isDeleting}
              className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {video.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded text-[10px]">{tag}</span>
            ))}
            {video.tags.length > 3 && (
              <span className="text-[10px] text-slate-400">+{video.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CinemaPage;
