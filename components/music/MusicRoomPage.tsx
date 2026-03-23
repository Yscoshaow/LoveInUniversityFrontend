import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, Search, Star, Clock, Subtitles,
  Heart, ChevronRight, X, Flame, Sparkles, Music,
  ListMusic, UserCheck, Plus, Mic2, Building2,
  Compass, Shuffle, Tag, Loader2, Download,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  useAsmrWorks, useAsmrPopular, useMusicLikes,
  useAsmrWorksInfinite, useAsmrSearchInfinite,
  useAsmrTagWorksInfinite, useAsmrVAWorksInfinite, useAsmrCircleWorksInfinite,
  useMusicPlaylists, useCreatePlaylist, useFollowedVAs, useFollowedCircles,
  useMusicHistory, useRandomWork, useMusicTags, useMusicCircles, useMusicVAs,
  useImportPlaylist, useWatchLaterPlaylist,
} from '../../hooks/useMusic';
import { asmrCoverUrl } from '../../lib/api';
import type { AsmrWork, AsmrTag, MusicPlaylist } from '../../types';

interface MusicRoomPageProps {
  onBack: () => void;
  onWorkClick: (workId: number) => void;
  onPlaylistClick?: (playlist: MusicPlaylist) => void;
  initialSearch?: string;
  initialBrowse?: { type: 'va'; id: string; name: string } | { type: 'circle'; id: number; name: string };
}

type Tab = 'discover' | 'subtitle' | 'popular' | 'likes' | 'playlists' | 'follows' | 'history' | 'browse';
type SortOrder = 'create_date' | 'rating' | 'rate_average_2dp' | 'dl_count' | 'release' | 'review_count' | 'price' | 'id';
type BrowseMode = 'default' | 'tag' | 'va' | 'circle';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

/* ─── Hero Card: Featured work at top of Discover tab ─── */
function HeroCard({ work, onClick }: { work: AsmrWork; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="relative w-full h-[220px] lg:h-80 rounded-2xl overflow-hidden group active:scale-[0.99] transition-transform duration-200"
    >
      {!imgError ? (
        <img
          src={asmrCoverUrl(work.id, 'main')}
          alt={work.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute top-3 left-3 bg-white/20 dark:bg-slate-800/20 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
        <Sparkles size={10} />
        编辑精选
      </div>
      {work.has_subtitle && (
        <div className="absolute top-3 right-3 bg-purple-500/70 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-0.5">
          <Subtitles size={10} />
          字幕
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h2 className="text-white font-bold text-lg lg:text-xl leading-tight line-clamp-2 mb-1 drop-shadow-lg">
          {work.title}
        </h2>
        <div className="flex items-center gap-2 text-white/80 text-xs">
          {work.circle?.name && (
            <span className="truncate max-w-[120px]">{work.circle.name}</span>
          )}
          {work.rate_count > 0 && (
            <span className="flex items-center gap-0.5">
              <Star size={10} className="text-amber-400 dark:text-amber-300 fill-amber-400" />
              {work.rate_average_2dp}
            </span>
          )}
          {work.duration > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {formatDuration(work.duration)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Scroll Row: Section title + horizontal scroll list ─── */
function ScrollRow({
  title,
  icon,
  onViewAll,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-4 mb-2.5">
        <h3 className="text-[15px] lg:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-0.5 hover:text-purple-700 dark:text-purple-400 transition-colors"
          >
            查看全部
            <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

/* ─── Scroll Card: Small card for horizontal scroll rows ─── */
function ScrollCard({ work, onClick }: { work: AsmrWork; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[140px] lg:w-44 snap-start group text-left hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 shadow-sm group-hover:shadow-md transition-shadow relative">
        {!imgError ? (
          <img
            src={asmrCoverUrl(work.id, 'main')}
            alt={work.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={28} className="text-purple-300" />
          </div>
        )}
        {work.duration > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Clock size={8} />
            {formatDuration(work.duration)}
          </div>
        )}
        {work.has_subtitle && (
          <div className="absolute top-1.5 left-1.5 bg-purple-500/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
            字幕
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100 line-clamp-1 leading-tight">
        {work.title}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
        {work.circle?.name}
      </p>
    </button>
  );
}

/* ─── Work Card: Grid card for full browse view ─── */
function WorkCard({ work, onClick }: { work: AsmrWork; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md lg:hover:shadow-lg lg:hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
    >
      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900">
        {!imgError ? (
          <img
            src={asmrCoverUrl(work.id, 'main')}
            alt={work.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles size={32} className="text-purple-300" />
          </div>
        )}
        {work.duration > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock size={10} />
            {formatDuration(work.duration)}
          </div>
        )}
        {work.has_subtitle && (
          <div className="absolute top-2 left-2 bg-purple-500/80 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Subtitles size={10} />
            字幕
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight mb-1">
          {work.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1.5">
          {work.circle?.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          {work.rate_count > 0 && (
            <span className="flex items-center gap-0.5">
              <Star size={10} className="text-amber-400 dark:text-amber-300 fill-amber-400" />
              {work.rate_average_2dp}
            </span>
          )}
          {work.tags?.slice(0, 2).map(tag => (
            <span key={tag.id} className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full truncate max-w-[60px]">
              {tag.i18n?.['zh-cn']?.name || tag.name}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

/* ─── Liked Work Card ─── */
function LikedWorkCard({ workId, onClick }: { workId: number; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left"
    >
      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900">
        {!imgError ? (
          <img
            src={asmrCoverUrl(workId, 'main')}
            alt={`RJ${String(workId).padStart(8, '0')}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Heart size={32} className="text-purple-300" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">RJ{String(workId).padStart(8, '0')}</p>
      </div>
    </button>
  );
}

/* ─── Skeleton loaders ─── */
function HeroSkeleton() {
  return (
    <div className="w-full h-[220px] lg:h-80 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
  );
}

function ScrollCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[140px]">
      <div className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
      <div className="mt-1.5 h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-4/5 animate-pulse" />
      <div className="mt-1 h-3 bg-slate-100 dark:bg-slate-700 rounded w-3/5 animate-pulse" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm animate-pulse">
          <div className="aspect-square bg-slate-200 dark:bg-slate-700" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */
const MusicRoomPage: React.FC<MusicRoomPageProps> = ({ onBack, onWorkClick, onPlaylistClick, initialSearch, initialBrowse }) => {
  const [tab, setTab] = useState<Tab>('discover');
  const [sortOrder, setSortOrder] = useState<SortOrder>('create_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState(initialSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch || '');
  const [showSearch, setShowSearch] = useState(!!initialSearch);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Sync when initialSearch changes (e.g. clicking different tags from detail page)
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setDebouncedSearch(initialSearch);
      setShowSearch(true);
    }
  }, [initialSearch]);

  // Sync when initialBrowse changes (e.g. clicking circle/VA from detail page)
  useEffect(() => {
    if (initialBrowse) {
      setSearch('');
      setDebouncedSearch('');
      setShowSearch(false);
      if (initialBrowse.type === 'va') {
        setBrowseMode('va');
        setBrowseVAId(initialBrowse.id);
        setBrowseVAName(initialBrowse.name);
      } else {
        setBrowseMode('circle');
        setBrowseCircleId(initialBrowse.id);
        setBrowseCircleName(initialBrowse.name);
      }
    }
  }, [initialBrowse]);

  // Browse mode for tag/va/circle filtering
  const [browseMode, setBrowseMode] = useState<BrowseMode>('default');
  const [browseTagId, setBrowseTagId] = useState<number | null>(null);
  const [browseTagName, setBrowseTagName] = useState('');
  const [browseVAId, setBrowseVAId] = useState<string | null>(null);
  const [browseVAName, setBrowseVAName] = useState('');
  const [browseCircleId, setBrowseCircleId] = useState<number | null>(null);
  const [browseCircleName, setBrowseCircleName] = useState('');

  // Browse tab state
  type BrowseCategory = 'tags' | 'circles' | 'vas';
  const [browseCategory, setBrowseCategory] = useState<BrowseCategory>('tags');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDebouncedSearch, setCatalogDebouncedSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0); // offset-based
  const catalogPageSize = 50;

  // Debounce catalog search
  useEffect(() => {
    const timer = setTimeout(() => { setCatalogDebouncedSearch(catalogSearch); setCatalogPage(0); }, 400);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const pageSize = 20;

  // ── Data: Discover tab editorial sections ──
  const popularQuery = useAsmrPopular();
  const latestQuery = useAsmrWorks({ page: 1, pageSize: 10, order: 'create_date', sort: 'desc' });
  const subtitleQuery = useAsmrWorks({ page: 1, pageSize: 10, order: 'create_date', sort: 'desc', subtitle: 1 });

  // Featured work = first popular work
  const featuredWork = popularQuery.data?.works?.[0];
  const popularWorks = popularQuery.data?.works?.slice(1, 11) || [];
  const latestWorks = latestQuery.data?.works || [];
  const subtitleWorks = subtitleQuery.data?.works || [];

  // ── Data: Grid browse (infinite scroll) ──
  const needsBrowseInfinite = (tab === 'subtitle' || tab === 'popular') && browseMode === 'default' && !debouncedSearch;
  const browseInfinite = useAsmrWorksInfinite(
    { pageSize, order: sortOrder, sort: sortDirection, subtitle: tab === 'subtitle' ? 1 : undefined },
    needsBrowseInfinite
  );
  const searchInfinite = useAsmrSearchInfinite(
    debouncedSearch,
    { pageSize, order: sortOrder, sort: sortDirection }
  );
  const tagWorksInfinite = useAsmrTagWorksInfinite(
    browseMode === 'tag' ? browseTagId : null,
    { pageSize, order: sortOrder, sort: sortDirection }
  );
  const vaWorksInfinite = useAsmrVAWorksInfinite(
    browseMode === 'va' ? browseVAId : null,
    { pageSize, order: sortOrder, sort: sortDirection }
  );
  const circleWorksInfinite = useAsmrCircleWorksInfinite(
    browseMode === 'circle' ? browseCircleId : null,
    { pageSize, order: sortOrder, sort: sortDirection }
  );

  const likesQuery = useMusicLikes();
  const playlistsQuery = useMusicPlaylists();
  const createPlaylist = useCreatePlaylist();
  const watchLaterQuery = useWatchLaterPlaylist();
  const followedVAsQuery = useFollowedVAs();
  const followedCirclesQuery = useFollowedCircles();
  const historyQuery = useMusicHistory();
  const randomWork = useRandomWork();

  // Catalog queries (browse tab)
  const catalogParams = useMemo(() => ({
    search: catalogDebouncedSearch || undefined,
    limit: catalogPageSize,
    offset: catalogPage,
    sort: 'count',
  }), [catalogDebouncedSearch, catalogPage]);
  const tagsQuery = useMusicTags(catalogParams, tab === 'browse' && browseCategory === 'tags');
  const circlesQuery = useMusicCircles(catalogParams, tab === 'browse' && browseCategory === 'circles');
  const vasQuery = useMusicVAs(catalogParams, tab === 'browse' && browseCategory === 'vas');

  // Determine active infinite query + flattened works
  const activeInfinite = useMemo(() => {
    if (debouncedSearch) return searchInfinite;
    if (browseMode === 'tag') return tagWorksInfinite;
    if (browseMode === 'va') return vaWorksInfinite;
    if (browseMode === 'circle') return circleWorksInfinite;
    if (needsBrowseInfinite) return browseInfinite;
    return null;
  }, [debouncedSearch, searchInfinite, browseMode, tagWorksInfinite, vaWorksInfinite, circleWorksInfinite, needsBrowseInfinite, browseInfinite]);

  const works = useMemo(() => {
    if (activeInfinite?.data) return activeInfinite.data.pages.flatMap(p => p.works);
    return [] as AsmrWork[];
  }, [activeInfinite?.data]);

  const totalCount = useMemo(() => {
    if (activeInfinite?.data?.pages?.[0]) return activeInfinite.data.pages[0].pagination.totalCount;
    return 0;
  }, [activeInfinite?.data]);

  const isLoading = activeInfinite?.isLoading ?? false;
  const isFetchingNextPage = activeInfinite?.isFetchingNextPage ?? false;
  const hasNextPage = activeInfinite?.hasNextPage ?? false;
  const fetchNextPage = activeInfinite?.fetchNextPage;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const clearBrowseFilter = useCallback(() => {
    setBrowseMode('default');
    setBrowseTagId(null);
    setBrowseVAId(null);
    setBrowseCircleId(null);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'discover', label: '发现', icon: <Sparkles size={14} /> },
    { key: 'subtitle', label: '字幕', icon: <Subtitles size={14} /> },
    { key: 'popular', label: '热门', icon: <Flame size={14} /> },
    { key: 'likes', label: '收藏', icon: <Heart size={14} /> },
    { key: 'playlists', label: '歌单', icon: <ListMusic size={14} /> },
    { key: 'follows', label: '关注', icon: <UserCheck size={14} /> },
    { key: 'history', label: '历史', icon: <Clock size={14} /> },
    { key: 'browse', label: '浏览', icon: <Compass size={14} /> },
  ];

  const sortOptions: { key: SortOrder; label: string }[] = [
    { key: 'create_date', label: '最新' },
    { key: 'release', label: '发售' },
    { key: 'rate_average_2dp', label: '评分' },
    { key: 'dl_count', label: '下载' },
    { key: 'review_count', label: '评论' },
    { key: 'price', label: '价格' },
    { key: 'rating', label: '综合' },
  ];

  // Whether we should show the grid browse view (non-discover tabs, search, or filtered)
  const showGridView = (tab !== 'discover' && tab !== 'likes' && tab !== 'playlists' && tab !== 'follows' && tab !== 'history' && tab !== 'browse') || debouncedSearch || browseMode !== 'default';

  // New playlist creation
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const handleCreatePlaylist = useCallback(() => {
    if (!newPlaylistName.trim()) return;
    createPlaylist.mutate({ name: newPlaylistName.trim() }, {
      onSuccess: () => { setShowNewPlaylist(false); setNewPlaylistName(''); },
    });
  }, [newPlaylistName, createPlaylist]);

  // Import playlist
  const [showImportPlaylist, setShowImportPlaylist] = useState(false);
  const [importCode, setImportCode] = useState('');
  const importPlaylist = useImportPlaylist();

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，来点助眠';
    if (h < 12) return '早安，来点好听的';
    if (h < 18) return '午后时光，放松一下';
    return '晚上好，听点什么？';
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-50/80 dark:bg-slate-900/80 lg:max-w-300 lg:mx-auto lg:w-full">
      {/* ── Header: Apple Music style ── */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
        {/* Top bar: minimal — back + search */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors lg:hidden">
            <ChevronLeft size={24} className="text-slate-700 dark:text-slate-200" />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-full transition-colors lg:hidden ${showSearch ? 'bg-purple-100 text-purple-600 dark:text-purple-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
          >
            <Search size={20} />
          </button>
        </div>

        {/* Search bar (expandable) */}
        {showSearch ? (
          <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200 lg:hidden">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索作品、社团、声优..."
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:bg-white dark:bg-slate-800 transition-colors"
                autoFocus
              />
              {search && (
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={16} className="text-slate-400 dark:text-slate-500" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Large title + greeting */}
            {browseMode === 'default' && !debouncedSearch && (
              <div className="px-5 pt-1 pb-3">
                <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">音乐室</h1>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{greeting}</p>
              </div>
            )}

            {/* Browse filter chip (when filtering by tag/va/circle) */}
            {browseMode !== 'default' && (
              <div className="px-5 pt-1 pb-3">
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">音乐室</h1>
                <button
                  onClick={clearBrowseFilter}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors"
                >
                  <X size={14} />
                  {browseMode === 'tag' && browseTagName}
                  {browseMode === 'va' && browseVAName}
                  {browseMode === 'circle' && browseCircleName}
                </button>
              </div>
            )}

            {/* Desktop: always-visible search bar */}
            <div className="hidden lg:block px-5 pb-3">
              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索作品、社团、声优..."
                  className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:bg-white dark:bg-slate-800 transition-colors"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={16} className="text-slate-400 dark:text-slate-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Horizontally scrollable tabs */}
            {!debouncedSearch && browseMode === 'default' && (
              <div className="overflow-x-auto scrollbar-hide border-b border-slate-200/60 dark:border-slate-700/60 lg:overflow-x-visible">
                <div className="flex gap-1 px-5 pb-3 min-w-max lg:min-w-0 lg:flex-wrap lg:gap-2">
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                        tab === t.key
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 active:bg-slate-300'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sort bar (grid view + search) ── */}
      {showGridView && tab !== 'likes' && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-1 shrink-0">排序</span>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {sortOptions.map(s => (
              <button
                key={s.key}
                onClick={() => setSortOrder(s.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  sortOrder === s.key
                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
            className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={sortDirection === 'desc' ? '降序（点击切换升序）' : '升序（点击切换降序）'}
          >
            {sortDirection === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
            <span>{sortDirection === 'desc' ? '降序' : '升序'}</span>
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ===== Discover Tab: Editorial Layout ===== */}
        {tab === 'discover' && !debouncedSearch && browseMode === 'default' && (
          <div className="pt-4 pb-6">
            {/* Hero Featured Card */}
            <div className="px-4 mb-6">
              {featuredWork ? (
                <HeroCard work={featuredWork} onClick={() => onWorkClick(featuredWork.id)} />
              ) : popularQuery.isLoading ? (
                <HeroSkeleton />
              ) : null}
            </div>

            {/* Row 1: Popular */}
            <ScrollRow
              title="热门推荐"
              icon={<Flame size={16} className="text-orange-500 dark:text-orange-400" />}
              onViewAll={() => setTab('popular')}
            >
              {popularQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => <ScrollCardSkeleton key={i} />)
                : popularWorks.map(w => (
                    <ScrollCard key={w.id} work={w} onClick={() => onWorkClick(w.id)} />
                  ))
              }
            </ScrollRow>

            {/* Row 2: Latest */}
            <ScrollRow
              title="最新上架"
              icon={<Sparkles size={16} className="text-blue-500 dark:text-blue-400" />}
            >
              {latestQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => <ScrollCardSkeleton key={i} />)
                : latestWorks.map(w => (
                    <ScrollCard key={w.id} work={w} onClick={() => onWorkClick(w.id)} />
                  ))
              }
            </ScrollRow>

            {/* Row 3: With Subtitles */}
            <ScrollRow
              title="字幕作品"
              icon={<Subtitles size={16} className="text-purple-500 dark:text-purple-400" />}
              onViewAll={() => setTab('subtitle')}
            >
              {subtitleQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => <ScrollCardSkeleton key={i} />)
                : subtitleWorks.map(w => (
                    <ScrollCard key={w.id} work={w} onClick={() => onWorkClick(w.id)} />
                  ))
              }
            </ScrollRow>

            {/* Random Listen */}
            <div className="px-4 mt-3 mb-1 flex items-center gap-2">
              <button
                onClick={() => {
                  if (randomWork.isPending) return;
                  randomWork.mutate(undefined, {
                    onSuccess: (data) => {
                      const w = data?.works?.[0];
                      if (w) onWorkClick(w.id);
                    },
                  });
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-500 text-white text-sm font-medium shadow-sm active:scale-95 lg:hover:bg-purple-600 lg:hover:shadow-md transition-all"
              >
                {randomWork.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Shuffle size={16} />
                )}
                <span>随心听</span>
              </button>
              <span className="text-xs text-slate-400 dark:text-slate-500">随机发现一部作品</span>
            </div>
          </div>
        )}

        {/* ===== Search results header ===== */}
        {debouncedSearch && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              搜索 "<span className="text-slate-700 dark:text-slate-200 font-medium">{debouncedSearch}</span>"
              {totalCount > 0 && ` · ${totalCount} 个结果`}
            </p>
          </div>
        )}

        {/* ===== Likes tab ===== */}
        {tab === 'likes' && !debouncedSearch && (
          <div className="px-4 pt-4">
            {likesQuery.isLoading ? (
              <GridSkeleton />
            ) : likesQuery.data?.workIds?.length ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  共 {likesQuery.data.total} 个收藏作品
                </p>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
                  {likesQuery.data.workIds.map(id => (
                    <LikedWorkCard key={id} workId={id} onClick={() => onWorkClick(id)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Heart size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">还没有收藏作品</p>
                <p className="text-slate-300 text-xs mt-1">浏览作品时点击心形图标即可收藏</p>
              </div>
            )}
          </div>
        )}

        {/* ===== Playlists tab ===== */}
        {tab === 'playlists' && !debouncedSearch && (
          <div className="px-4 pt-4 pb-24 lg:pb-8">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowNewPlaylist(true)}
                className="flex-1 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Plus size={18} className="text-purple-500 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">新建歌单</span>
              </button>
              <button
                onClick={() => setShowImportPlaylist(true)}
                className="flex-1 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Download size={18} className="text-blue-500 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">导入歌单</span>
              </button>
            </div>

            {/* Watch Later card */}
            {watchLaterQuery.data && (
              <button
                onClick={() => onPlaylistClick?.(watchLaterQuery.data!)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900 transition-all text-left active:scale-[0.98] mb-3"
              >
                <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock size={22} className="text-amber-500 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">稍后再听</p>
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">{watchLaterQuery.data.itemCount} 首作品 · 听完自动移除</p>
                </div>
                <ChevronRight size={16} className="text-amber-400 dark:text-amber-300 shrink-0" />
              </button>
            )}

            {playlistsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 py-2 space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (playlistsQuery.data || []).length > 0 ? (
              <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {(playlistsQuery.data || []).map(pl => (
                  <PlaylistCard key={pl.id} playlist={pl} onClick={() => onPlaylistClick?.(pl)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ListMusic size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">还没有歌单</p>
                <p className="text-slate-300 text-xs mt-1">点击上方按钮创建你的第一个歌单</p>
              </div>
            )}
          </div>
        )}

        {/* ===== Follows tab ===== */}
        {tab === 'follows' && !debouncedSearch && (
          <div className="px-4 pt-4 pb-24 lg:pb-8">
            {/* Followed VAs */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Mic2 size={14} className="text-purple-500 dark:text-purple-400" />
                关注的声优
              </h3>
              {followedVAsQuery.isLoading ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-20 animate-pulse">
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
                      <div className="mt-1.5 h-3 bg-slate-200 dark:bg-slate-700 rounded w-14 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (followedVAsQuery.data || []).length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide lg:flex-wrap lg:overflow-x-visible">
                  {(followedVAsQuery.data || []).map(va => (
                    <button
                      key={va.vaId}
                      onClick={() => {
                        setBrowseMode('va');
                        setBrowseVAId(va.vaId);
                        setBrowseVAName(va.vaName);
                        setTab('discover');

                      }}
                      className="flex-shrink-0 w-20 text-center group"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 mx-auto flex items-center justify-center group-hover:shadow-md transition-shadow">
                        <Mic2 size={20} className="text-purple-400" />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{va.vaName}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4">在作品详情页关注声优</p>
              )}
            </div>

            {/* Followed Circles */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Building2 size={14} className="text-blue-500 dark:text-blue-400" />
                关注的社团
              </h3>
              {followedCirclesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (followedCirclesQuery.data || []).length > 0 ? (
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                  {(followedCirclesQuery.data || []).map(circle => (
                    <button
                      key={circle.circleId}
                      onClick={() => {
                        setBrowseMode('circle');
                        setBrowseCircleId(circle.circleId);
                        setBrowseCircleName(circle.circleName);
                        setTab('discover');

                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm transition-all text-left active:scale-[0.98]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:to-indigo-900 flex items-center justify-center shrink-0">
                        <Building2 size={16} className="text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{circle.circleName}</span>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4">在作品详情页关注社团</p>
              )}
            </div>
          </div>
        )}

        {/* ===== History tab ===== */}
        {tab === 'history' && !debouncedSearch && (
          <div className="px-4 pt-4">
            {historyQuery.isLoading ? (
              <GridSkeleton />
            ) : historyQuery.data?.workIds?.length ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  共 {historyQuery.data.total} 个播放记录
                </p>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
                  {historyQuery.data.workIds.map(id => (
                    <LikedWorkCard key={id} workId={id} onClick={() => onWorkClick(id)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Clock size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">还没有播放记录</p>
                <p className="text-slate-300 text-xs mt-1">播放作品后会自动记录</p>
              </div>
            )}
          </div>
        )}

        {/* ===== Browse tab ===== */}
        {tab === 'browse' && !debouncedSearch && (
          <div className="px-4 pt-4 pb-24 lg:pb-8">
            {/* Sub-category tabs */}
            <div className="flex gap-2 mb-4">
              {([
                { key: 'tags' as BrowseCategory, label: '标签', icon: <Tag size={13} /> },
                { key: 'circles' as BrowseCategory, label: '社团', icon: <Building2 size={13} /> },
                { key: 'vas' as BrowseCategory, label: '声优', icon: <Mic2 size={13} /> },
              ]).map(c => (
                <button
                  key={c.key}
                  onClick={() => { setBrowseCategory(c.key); setCatalogSearch(''); setCatalogPage(0); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    browseCategory === c.key
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.icon}
                  {c.label}
                </button>
              ))}
            </div>

            {/* Catalog search */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder={`搜索${browseCategory === 'tags' ? '标签' : browseCategory === 'circles' ? '社团' : '声优'}...`}
                className="w-full bg-white dark:bg-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm"
              />
            </div>

            {/* Catalog list */}
            {browseCategory === 'tags' && (
              tagsQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}</div>
              ) : (tagsQuery.data?.items?.length ?? 0) > 0 ? (
                <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {tagsQuery.data!.items.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setBrowseMode('tag');
                        setBrowseTagId(tag.id);
                        setBrowseTagName(tag.i18n?.['zh-cn']?.name || tag.name);
                        setTab('discover');

                      }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm transition-all text-left active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Tag size={14} className="text-purple-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {tag.i18n?.['zh-cn']?.name || tag.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{tag.count}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Tag size={40} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 dark:text-slate-500 text-sm">没有找到标签</p>
                </div>
              )
            )}

            {browseCategory === 'circles' && (
              circlesQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}</div>
              ) : (circlesQuery.data?.items?.length ?? 0) > 0 ? (
                <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {circlesQuery.data!.items.map(circle => (
                    <button
                      key={circle.id}
                      onClick={() => {
                        setBrowseMode('circle');
                        setBrowseCircleId(circle.id);
                        setBrowseCircleName(circle.name);
                        setTab('discover');

                      }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm transition-all text-left active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 size={14} className="text-blue-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{circle.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{circle.count}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building2 size={40} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 dark:text-slate-500 text-sm">没有找到社团</p>
                </div>
              )
            )}

            {browseCategory === 'vas' && (
              vasQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}</div>
              ) : (vasQuery.data?.items?.length ?? 0) > 0 ? (
                <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {vasQuery.data!.items.map(va => (
                    <button
                      key={va.id}
                      onClick={() => {
                        setBrowseMode('va');
                        setBrowseVAId(va.id);
                        setBrowseVAName(va.name);
                        setTab('discover');

                      }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm transition-all text-left active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mic2 size={14} className="text-purple-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{va.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{va.count}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Mic2 size={40} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 dark:text-slate-500 text-sm">没有找到声优</p>
                </div>
              )
            )}

            {/* Catalog pagination */}
            {(() => {
              const q = browseCategory === 'tags' ? tagsQuery : browseCategory === 'circles' ? circlesQuery : vasQuery;
              const total = q.data?.total ?? 0;
              if (total <= catalogPageSize) return null;
              const totalPages = Math.ceil(total / catalogPageSize);
              const currentPage = Math.floor(catalogPage / catalogPageSize) + 1;
              return (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setCatalogPage(p => Math.max(0, p - catalogPageSize))}
                    disabled={catalogPage <= 0}
                    className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm disabled:opacity-30 transition-all"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCatalogPage(p => p + catalogPageSize)}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm disabled:opacity-30 transition-all"
                  >
                    下一页
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== Grid browse (subtitle/popular/search/filter tabs) — infinite scroll ===== */}
        {showGridView && (
          <div className="px-4 pt-3 pb-4">
            {isLoading && works.length === 0 ? (
              <GridSkeleton />
            ) : works.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
                  {works.map(work => (
                    <WorkCard
                      key={work.id}
                      work={work}
                      onClick={() => onWorkClick(work.id)}
                    />
                  ))}
                </div>
                {/* Infinite scroll sentinel */}
                <div ref={scrollSentinelRef} className="h-1" />
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 size={18} className="animate-spin text-purple-400" />
                    <span className="text-sm text-slate-400 dark:text-slate-500">加载中...</span>
                  </div>
                )}
                {!hasNextPage && works.length > 0 && (
                  <p className="text-center text-xs text-slate-300 py-4">已加载全部 {totalCount} 个结果</p>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Search size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">没有找到作品</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New playlist modal — portal to escape transform stacking context */}
      {showNewPlaylist && createPortal(
        <div className="fixed inset-0 bg-black/40 z-70 flex items-end justify-center lg:items-center" onClick={() => setShowNewPlaylist(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300 lg:rounded-2xl lg:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">新建歌单</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="歌单名称"
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewPlaylist(false); setNewPlaylistName(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || createPlaylist.isPending}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {createPlaylist.isPending ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import playlist modal */}
      {showImportPlaylist && createPortal(
        <div className="fixed inset-0 bg-black/40 z-70 flex items-end justify-center lg:items-center" onClick={() => setShowImportPlaylist(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300 lg:rounded-2xl lg:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">导入歌单</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">输入好友分享的歌单码，导入为自己的歌单副本</p>
            <input
              type="text"
              value={importCode}
              onChange={e => setImportCode(e.target.value.trim())}
              placeholder="输入分享码..."
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4 font-mono tracking-widest text-center"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowImportPlaylist(false); setImportCode(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!importCode) return;
                  importPlaylist.mutate(importCode, {
                    onSuccess: () => { setShowImportPlaylist(false); setImportCode(''); },
                  });
                }}
                disabled={!importCode || importPlaylist.isPending}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {importPlaylist.isPending ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ─── Playlist Card for the playlists tab ─── */
function PlaylistCard({ playlist, onClick }: { playlist: MusicPlaylist; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98]"
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 flex items-center justify-center shrink-0">
        <ListMusic size={20} className="text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{playlist.name}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{playlist.itemCount} 首作品</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );
}

export default MusicRoomPage;
