import React, { useState, useCallback } from 'react';
import {
  ChevronLeft,
  Search,
  BookOpen,
  Coins,
  Loader2,
  X,
  Plus,
  Library,
  Clock,
  Upload,
  User,
  BookMarked,
} from 'lucide-react';
import { useBooks, useBookCategories, useBookSeries, useRecentlyRead, useMyUploads } from '../../hooks';
import type { BookSummary, BookSeriesSummary, ReadingProgressData } from '../../types';

type LibraryTab = 'all' | 'series' | 'continue' | 'myUploads';

interface LibraryPageProps {
  onBack: () => void;
  onBookClick: (bookId: number) => void;
  onSeriesClick?: (seriesId: number) => void;
  onUploadClick?: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ onBack, onBookClick, onSeriesClick, onUploadClick }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const pageSize = 20;

  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const { data: categoriesData } = useBookCategories();
  const { data: booksData, isLoading: booksLoading, isFetching: booksFetching } = useBooks({
    categoryId: selectedCategoryId,
    search: debouncedSearch || undefined,
    excludeSeriesBooks: true,
    page,
    pageSize,
  });
  const { data: seriesData, isLoading: seriesLoading } = useBookSeries({
    categoryId: selectedCategoryId,
    search: debouncedSearch || undefined,
  });
  const { data: recentlyRead, isLoading: recentLoading } = useRecentlyRead();
  const { data: myUploads, isLoading: uploadsLoading } = useMyUploads();

  const books = booksData?.books ?? [];
  const total = booksData?.total ?? 0;
  const hasMore = page * pageSize < total;

  // Build progress map from recently read data
  const progressMap = new Map<number, number>();
  recentlyRead?.forEach(item => {
    progressMap.set(item.bookId, item.scrollPosition);
  });

  const handleCategoryClick = (catId: number | undefined) => {
    setSelectedCategoryId(catId);
    setPage(1);
  };

  const getCoverGradient = (id: number) => {
    const gradients = [
      'from-blue-400 to-indigo-600',
      'from-emerald-400 to-teal-600',
      'from-orange-400 to-red-500',
      'from-purple-400 to-pink-600',
      'from-cyan-400 to-blue-600',
      'from-rose-400 to-fuchsia-600',
      'from-amber-400 to-orange-600',
      'from-lime-400 to-green-600',
    ];
    return gradients[id % gradients.length];
  };

  const REVIEW_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    PENDING_REVIEW: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', label: '待审核' },
    APPROVED: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', label: '已通过' },
    REJECTED: { bg: 'bg-rose-50 dark:bg-rose-950', text: 'text-rose-600 dark:text-rose-400', label: '已拒绝' },
  };

  // ===== Portrait Book Card =====
  const BookCard: React.FC<{ book: BookSummary; showStatus?: boolean; progress?: number }> = ({ book, showStatus, progress }) => (
    <button
      onClick={() => onBookClick(book.id)}
      className="group flex flex-col w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 ease-out overflow-hidden border border-slate-100 dark:border-slate-700 text-left active:scale-[0.97]"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        {book.coverImageUrl ? (
          <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book.id)} flex items-center justify-center`}>
            <BookOpen size={28} className="text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div className="h-full bg-indigo-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {showStatus && book.reviewStatus !== 'APPROVED' && (
          <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${REVIEW_STATUS_BADGE[book.reviewStatus]?.bg} ${REVIEW_STATUS_BADGE[book.reviewStatus]?.text}`}>
            {REVIEW_STATUS_BADGE[book.reviewStatus]?.label}
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight line-clamp-2 mb-0.5 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">{book.title}</h3>
        {book.authorName && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mb-2">{book.authorName}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-1">
          {book.categoryName ? (
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md uppercase tracking-wider truncate">
              {book.categoryName}
            </span>
          ) : <span />}
          {progress != null && progress > 0 ? (
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium shrink-0">{Math.round(progress * 100)}%</span>
          ) : book.priceCampusPoints <= 0 ? (
            <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium shrink-0 flex items-center gap-0.5"><BookOpen size={10} /> 免费</span>
          ) : (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5 shrink-0">
              <Coins size={9} />{book.priceCampusPoints}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  // ===== Portrait Series Card =====
  const SeriesCard: React.FC<{ series: BookSeriesSummary }> = ({ series }) => (
    <button
      onClick={() => onSeriesClick?.(series.id)}
      className="group flex flex-col w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 ease-out overflow-hidden border border-slate-100 dark:border-slate-700 text-left active:scale-[0.97]"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        {series.coverImageUrl ? (
          <img src={series.coverImageUrl} alt={series.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(series.id)} flex items-center justify-center`}>
            <Library size={28} className="text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
          {series.bookCount} 卷
        </span>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight line-clamp-2 mb-0.5 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">{series.name}</h3>
        <div className="mt-auto flex items-center justify-between gap-1">
          {series.categoryName ? (
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md uppercase tracking-wider truncate">
              {series.categoryName}
            </span>
          ) : <span />}
          {series.authorName && series.isUserUploaded ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 shrink-0">
              <User size={9} /> {series.authorName}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );

  // ===== Portrait Continue Reading Card =====
  const ContinueReadingCard: React.FC<{ item: ReadingProgressData }> = ({ item }) => (
    <button
      onClick={() => onBookClick(item.bookId)}
      className="group flex flex-col w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 ease-out overflow-hidden border border-slate-100 dark:border-slate-700 text-left active:scale-[0.97]"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        {item.bookCoverImageUrl ? (
          <img src={item.bookCoverImageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(item.bookId)} flex items-center justify-center`}>
            <BookOpen size={28} className="text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full bg-indigo-500 rounded-r-full transition-all"
            style={{ width: `${Math.round(item.scrollPosition * 100)}%` }}
          />
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight line-clamp-2 mb-0.5 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">{item.bookTitle || '未知书籍'}</h3>
        <div className="mt-auto flex items-center justify-between gap-1">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {item.lastReadAt && new Date(item.lastReadAt).toLocaleDateString('zh-CN')}
          </span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium shrink-0">{Math.round(item.scrollPosition * 100)}%</span>
        </div>
      </div>
    </button>
  );

  const TABS: { key: LibraryTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: '全部', icon: <BookOpen size={14} /> },
    { key: 'series', label: '系列', icon: <Library size={14} /> },
    { key: 'continue', label: '在读', icon: <BookMarked size={14} /> },
    { key: 'myUploads', label: '我的', icon: <Upload size={14} /> },
  ];

  const GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Header — Minimal */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">图书馆</h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors ${
              showSearch ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
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
              placeholder="搜索图书..."
              autoFocus
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-2">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills (only for all & series tabs) */}
      {(activeTab === 'all' || activeTab === 'series') && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => handleCategoryClick(undefined)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                selectedCategoryId === undefined
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              全部
            </button>
            {categoriesData?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {/* ===== ALL TAB ===== */}
        {activeTab === 'all' && (
          <>
            {(booksLoading || seriesLoading) ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : (books.length === 0 && (!seriesData?.series?.length)) ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <BookOpen size={40} className="mb-3 opacity-50" />
                <p className="text-sm">{debouncedSearch ? '未找到相关图书' : '暂无图书'}</p>
              </div>
            ) : (
              <>
                <div className={GRID_CLASS}>
                  {/* Series cards first (only on page 1) */}
                  {page === 1 && seriesData?.series?.map((s) => (
                    <SeriesCard key={`series-${s.id}`} series={s} />
                  ))}
                  {/* Standalone books */}
                  {books.map((book) => (
                    <BookCard key={book.id} book={book} progress={progressMap.get(book.id)} />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  {hasMore ? (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={booksFetching}
                      className="px-6 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-xl hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 transition-colors disabled:opacity-50"
                    >
                      {booksFetching ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" /> 加载中...
                        </span>
                      ) : `加载更多 (${books.length}/${total})`}
                    </button>
                  ) : (total > 0 || (seriesData?.series?.length ?? 0) > 0) ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {(seriesData?.series?.length ?? 0) > 0 && `${seriesData!.series.length} 个系列`}
                      {(seriesData?.series?.length ?? 0) > 0 && total > 0 && ' + '}
                      {total > 0 && `${total} 本图书`}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}

        {/* ===== SERIES TAB ===== */}
        {activeTab === 'series' && (
          <>
            {seriesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : !seriesData?.series?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <Library size={40} className="mb-3 opacity-50" />
                <p className="text-sm">暂无系列</p>
              </div>
            ) : (
              <div className={GRID_CLASS}>
                {seriesData.series.map((s) => <SeriesCard key={s.id} series={s} />)}
              </div>
            )}
          </>
        )}

        {/* ===== CONTINUE READING TAB ===== */}
        {activeTab === 'continue' && (
          <>
            {recentLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : !recentlyRead?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <Clock size={40} className="mb-3 opacity-50" />
                <p className="text-sm">暂无阅读记录</p>
                <p className="text-xs mt-1">开始阅读后，这里会显示你的阅读进度</p>
              </div>
            ) : (
              <div className={GRID_CLASS}>
                {recentlyRead.map((item) => <ContinueReadingCard key={item.bookId} item={item} />)}
              </div>
            )}
          </>
        )}

        {/* ===== MY UPLOADS TAB ===== */}
        {activeTab === 'myUploads' && (
          <>
            {uploadsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : !myUploads?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <Upload size={40} className="mb-3 opacity-50" />
                <p className="text-sm">还没有上传过作品</p>
                <p className="text-xs mt-1">点击右下角按钮开始上传你的小说</p>
              </div>
            ) : (
              <div className={GRID_CLASS}>
                {myUploads.map((book) => <BookCard key={book.id} book={book} showStatus />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload FAB */}
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="fixed bottom-20 lg:bottom-8 right-4 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
};
