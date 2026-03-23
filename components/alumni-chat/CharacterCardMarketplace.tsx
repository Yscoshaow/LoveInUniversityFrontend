import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, X, Eye, Heart, MessageCircle, Coins } from 'lucide-react';
import { useMarketplaceInfinite } from '../../hooks/useAlumniChat';
import type { CharacterCardSummary } from '../../types';

interface CharacterCardMarketplaceProps {
  onCardDetail: (cardId: number) => void;
  onStartChat: (cardId: number) => void;
}

const SORT_OPTIONS = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门' },
  { key: 'likes', label: '最多赞' },
];

const CharacterCardMarketplace: React.FC<CharacterCardMarketplaceProps> = ({
  onCardDetail,
  onStartChat,
}) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMarketplaceInfinite({
    search: debouncedSearch || undefined,
    sortBy,
    pageSize: 20,
  });

  // Infinite scroll
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [observerCallback]);

  const cards = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col">
      {/* Search & Sort */}
      <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 px-4 pt-3 pb-2 space-y-2">
        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索角色卡..."
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-slate-800 dark:text-slate-100"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort pills */}
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sortBy === opt.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="text-5xl mb-4">🔍</span>
          <p className="text-slate-500 dark:text-slate-400">暂无角色卡</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => (
            <MarketplaceCard
              key={card.id}
              card={card}
              onDetail={() => onCardDetail(card.id)}
              onChat={() => onStartChat(card.id)}
            />
          ))}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

const MarketplaceCard: React.FC<{
  card: CharacterCardSummary;
  onDetail: () => void;
  onChat: () => void;
}> = ({ card, onDetail, onChat }) => {
  const tags = card.tags ? (() => { try { return JSON.parse(card.tags) as string[]; } catch { return []; } })() : [];

  return (
    <div
      onClick={onDetail}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center overflow-hidden relative">
        {card.avatarUrl ? (
          <img src={card.avatarUrl} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl">🤖</span>
        )}
        {card.priceCampusPoints > 0 && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
            <Coins size={10} /> {card.priceCampusPoints}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{card.name}</h3>
        {card.introduction && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{card.introduction}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 2).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-0.5"><Eye size={10} /> {card.viewCount}</span>
          <span className="flex items-center gap-0.5"><Heart size={10} /> {card.likeCount}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {card.chatCount}</span>
        </div>

        {card.creatorName && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {card.creatorAvatar ? (
              <img src={card.creatorAvatar} className="w-4 h-4 rounded-full" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600" />
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{card.creatorName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterCardMarketplace;
