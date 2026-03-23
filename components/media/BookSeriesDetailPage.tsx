import React from 'react';
import {
  ChevronLeft,
  BookOpen,
  Loader2,
  User,
  Tag,
  Coins,
  CheckCircle,
  BookMarked,
} from 'lucide-react';
import { useBookSeriesDetail } from '../../hooks';
import type { BookSummary } from '../../types';

interface BookSeriesDetailPageProps {
  seriesId: number;
  onBack: () => void;
  onBookClick: (bookId: number) => void;
}

export const BookSeriesDetailPage: React.FC<BookSeriesDetailPageProps> = ({ seriesId, onBack, onBookClick }) => {
  const { data: series, isLoading, error } = useBookSeriesDetail(seriesId);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center justify-center flex-1">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="px-4 pt-14 pb-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">系列不存在或已被删除</p>
        </div>
      </div>
    );
  }

  const sortedBooks = [...series.books].sort((a, b) => (a.orderInSeries ?? 0) - (b.orderInSeries ?? 0));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{series.name}</h1>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{series.books.length} 卷</span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Series cover & info */}
        <div className="relative lg:flex lg:gap-8 lg:p-6">
          <div className="h-48 relative overflow-hidden lg:h-auto lg:w-48 lg:shrink-0 lg:rounded-2xl lg:shadow-lg lg:aspect-2/3">
            {series.coverImageUrl ? (
              <img
                src={series.coverImageUrl}
                alt={series.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-700 flex items-center justify-center">
                <BookMarked size={48} className="text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-slate-900 dark:via-slate-900/30 lg:hidden" />
          </div>

          <div className="px-5 -mt-16 relative z-10 pb-4 lg:mt-0 lg:px-0 lg:flex-1">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">{series.name}</h2>

            {series.authorName && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                <User size={12} className="inline mr-1 -mt-0.5" />
                {series.authorName}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-3">
              {series.categoryName && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                  <Tag size={10} />
                  {series.categoryName}
                </span>
              )}
              {series.isUserUploaded && (
                <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-2 py-0.5 rounded-full">
                  用户作品
                </span>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                共 {series.books.length} 卷
              </span>
            </div>

            {series.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{series.description}</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-5" />

        {/* Volume list */}
        <div className="px-5 py-4">
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">卷列表</h3>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {sortedBooks.map((book, index) => (
              <VolumeCard
                key={book.id}
                book={book}
                index={index}
                onClick={() => onBookClick(book.id)}
              />
            ))}
          </div>

          {sortedBooks.length === 0 && (
            <div className="text-center py-12">
              <BookOpen size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">暂无卷</p>
            </div>
          )}
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
};

const VolumeCard: React.FC<{
  book: BookSummary;
  index: number;
  onClick: () => void;
}> = ({ book, index, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
    >
      {/* Mini cover */}
      <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden shadow-sm">
        {book.coverImageUrl ? (
          <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            <BookOpen size={14} className="text-white/40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
            第{book.orderInSeries ?? index + 1}卷
          </span>
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{book.title}</p>
        {book.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{book.description}</p>
        )}
      </div>

      {/* Price / status */}
      <div className="shrink-0 text-right">
        {book.priceCampusPoints === 0 ? (
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
            免费
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
            <Coins size={9} />
            {book.priceCampusPoints}
          </span>
        )}
      </div>
    </button>
  );
};
