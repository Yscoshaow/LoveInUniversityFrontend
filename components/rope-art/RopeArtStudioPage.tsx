import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Search, Star, MapPin, Filter, Calendar,
  Clock, MessageCircle, ChevronRight, Loader2, X, Image as ImageIcon,
  Pause, Play, AlertCircle,
} from 'lucide-react';
import { ropeArtistApi } from '../../lib/api';
import type {
  RopeArtistListItem, RopeArtistDetail, RopeReview, RopeAvailabilityResponse,
  RopeBookingData, PriceListItem, PortfolioImage,
} from '../../types';

const PAGE_SIZE = 20;

interface RopeArtStudioPageProps {
  onBack: () => void;
  onManage: () => void; // navigate to artist management page
}

type SortBy = 'rating' | 'reviewCount' | 'newest';

// ==================== Artist List View ====================

const ArtistListView: React.FC<{
  onArtistClick: (id: number) => void;
  onManage: () => void;
  onBack: () => void;
  onMyBookings: () => void;
}> = ({ onArtistClick, onManage, onBack, onMyBookings }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [cityFilter, setCityFilter] = useState('');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [showFilter, setShowFilter] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['ropeArtists', 'list', { sortBy, city: cityFilter || undefined, minRating, offset }],
    queryFn: () => ropeArtistApi.listArtists({ sortBy, city: cityFilter || undefined, minRating, offset, limit: PAGE_SIZE }),
  });

  // Check if current user is an artist
  const { data: myProfile } = useQuery({
    queryKey: ['ropeArtists', 'myProfile'],
    queryFn: () => ropeArtistApi.getMyProfile(),
    retry: false,
  });

  const artists = data?.artists ?? [];
  const total = data?.total ?? 0;

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'rating', label: '评分最高' },
    { key: 'reviewCount', label: '评价最多' },
    { key: 'newest', label: '最新入驻' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1">
              <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">绳艺室</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onManage} className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full font-medium">
              {myProfile ? '管理我的绳艺屋' : '申请成为绳艺师'}
            </button>
            <button onClick={onMyBookings} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full font-medium">
              我的预约
            </button>
            <button onClick={() => setShowFilter(!showFilter)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <Filter size={18} className={showFilter ? 'text-purple-500' : 'text-gray-400'} />
            </button>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setSortBy(opt.key); setOffset(0); }}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                sortBy === opt.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        {showFilter && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="按城市筛选..."
              value={cityFilter}
              onChange={e => { setCityFilter(e.target.value); setOffset(0); }}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <select
              value={minRating ?? ''}
              onChange={e => { setMinRating(e.target.value ? Number(e.target.value) : undefined); setOffset(0); }}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">最低评分</option>
              <option value="3">3星以上</option>
              <option value="4">4星以上</option>
              <option value="4.5">4.5星以上</option>
            </select>
          </div>
        )}
      </div>

      {/* Artist cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-purple-500" size={32} />
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ImageIcon size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无绳艺师入驻</p>
          </div>
        ) : (
          <>
            {artists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} onClick={() => onArtistClick(artist.id)} />
            ))}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex justify-center gap-2 pt-4">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-4 py-2 text-sm text-gray-500">
                  {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ==================== Artist Card ====================

const ArtistCard: React.FC<{ artist: RopeArtistListItem; onClick: () => void }> = ({ artist, onClick }) => (
  <button onClick={onClick} className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    {/* Preview images */}
    {artist.previewImages.length > 0 && (
      <div className="flex h-32 overflow-hidden">
        {artist.previewImages.slice(0, 3).map((url, i) => (
          <div key={i} className="flex-1 min-w-0">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )}

    <div className="p-3">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 overflow-hidden flex-shrink-0">
          {artist.avatarUrl ? (
            <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-purple-500 font-bold text-sm">
              {artist.displayName.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{artist.displayName}</h3>
            {artist.isPaused && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">休息中</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {artist.city}
            </span>
            <span className="flex items-center gap-1">
              <Star size={12} className="text-yellow-500 fill-yellow-500" />
              {(artist.averageRating ?? 0).toFixed(1)} ({artist.reviewCount})
            </span>
            {artist.minPrice && (
              <span className="text-purple-500">{artist.minPrice}起</span>
            )}
          </div>
        </div>

        <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
      </div>
    </div>
  </button>
);

// ==================== Artist Detail View ====================

const ArtistDetailView: React.FC<{
  artistId: number;
  onBack: () => void;
  onBook: (artistId: number, priceList: PriceListItem) => void;
}> = ({ artistId, onBack, onBook }) => {
  const [tab, setTab] = useState<'portfolio' | 'reviews'>('portfolio');
  const [showPriceList, setShowPriceList] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: artist, isLoading } = useQuery({
    queryKey: ['ropeArtists', 'detail', artistId],
    queryFn: () => ropeArtistApi.getArtistDetail(artistId),
  });

  const { data: availability } = useQuery({
    queryKey: ['ropeArtists', 'availability', artistId],
    queryFn: () => ropeArtistApi.getAvailability(artistId),
  });

  if (isLoading || !artist) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{artist.displayName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 overflow-hidden flex-shrink-0">
              {artist.avatarUrl ? (
                <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-purple-500 font-bold text-xl">
                  {artist.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={14} /> {artist.city}
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-gray-900 dark:text-white font-medium">{(artist.averageRating ?? 0).toFixed(1)}</span>
                  <span className="text-gray-400">({artist.reviewCount}评价)</span>
                </span>
                {artist.isPaused && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full">休息中</span>
                )}
              </div>
              {artist.specialties && (
                <p className="text-xs text-purple-500 mt-1">{artist.specialties}</p>
              )}
              {artist.experienceYears > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{artist.experienceYears}年经验</p>
              )}
            </div>
          </div>
          {artist.bio && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{artist.bio}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setTab('portfolio')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              tab === 'portfolio' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'
            }`}
          >
            作品 ({artist.portfolioImages.length})
          </button>
          <button
            onClick={() => setTab('reviews')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              tab === 'reviews' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'
            }`}
          >
            评价 ({artist.reviewCount})
          </button>
        </div>

        {/* Tab content */}
        <div className="px-4 py-3">
          {tab === 'portfolio' ? (
            <div className="grid grid-cols-3 gap-2">
              {artist.portfolioImages.map(img => (
                <button key={img.id} onClick={() => setSelectedImage(img.imageUrl)} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img src={img.imageUrl} alt={img.caption} className="w-full h-full object-cover" />
                </button>
              ))}
              {artist.portfolioImages.length === 0 && (
                <p className="col-span-3 text-center text-gray-400 py-8">暂无作品</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {artist.recentReviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {artist.recentReviews.length === 0 && (
                <p className="text-center text-gray-400 py-8">暂无评价</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-4 right-4 p-2 text-white" onClick={() => setSelectedImage(null)}>
            <X size={24} />
          </button>
          <img src={selectedImage} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Bottom actions */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex gap-3">
        <button
          onClick={() => setShowPriceList(true)}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm disabled:opacity-50"
          disabled={artist.isPaused}
        >
          {artist.isPaused ? '绳艺师休息中' : '查看价目表 & 预约'}
        </button>
        {artist.contactTelegram && (
          <a
            href={`https://t.me/${artist.contactTelegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-sm font-medium flex items-center gap-1"
          >
            <MessageCircle size={16} /> 私聊
          </a>
        )}
      </div>

      {/* Price list modal */}
      {showPriceList && (
        <PriceListModal
          priceLists={artist.priceLists}
          onClose={() => setShowPriceList(false)}
          onSelect={(pl) => {
            setShowPriceList(false);
            onBook(artistId, pl);
          }}
        />
      )}
    </div>
  );
};

// ==================== Review Card ====================

const ReviewCard: React.FC<{ review: RopeReview }> = ({ review }) => (
  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 overflow-hidden flex-shrink-0">
        {review.clientAvatar ? (
          <img src={review.clientAvatar} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-purple-500 text-xs font-bold">
            {review.clientName.charAt(0)}
          </div>
        )}
      </div>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{review.clientName}</span>
      <span className="text-xs text-gray-400">Lv.{review.clientLevel}</span>
      <div className="flex items-center gap-0.5 ml-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={12} className={i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'} />
        ))}
      </div>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>
    <p className="text-xs text-gray-400 mt-1">{new Date(review.createdAt).toLocaleDateString()}</p>
  </div>
);

// ==================== Price List Modal ====================

const PriceListModal: React.FC<{
  priceLists: PriceListItem[];
  onClose: () => void;
  onSelect: (pl: PriceListItem) => void;
}> = ({ priceLists, onClose, onSelect }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
    <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white">价目表</h3>
        <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {priceLists.length === 0 ? (
          <p className="text-center text-gray-400 py-8">暂无价目</p>
        ) : (
          priceLists.map(pl => (
            <button
              key={pl.id}
              onClick={() => onSelect(pl)}
              className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{pl.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pl.description}</p>
                </div>
                <span className="text-purple-600 dark:text-purple-400 font-bold whitespace-nowrap ml-3">{pl.priceText}</span>
              </div>
              {pl.images.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {pl.images.slice(0, 3).map((url, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end mt-2 text-xs text-purple-500">
                选择此项并预约 <ChevronRight size={14} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  </div>
);

// ==================== Booking View ====================

const BookingView: React.FC<{
  artistId: number;
  priceList: PriceListItem;
  onBack: () => void;
  onSuccess: () => void;
}> = ({ artistId, priceList, onBack, onSuccess }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data: availability } = useQuery({
    queryKey: ['ropeArtists', 'availability', artistId],
    queryFn: () => ropeArtistApi.getAvailability(artistId),
  });

  const bookMutation = useMutation({
    mutationFn: () => ropeArtistApi.createBooking({
      artistId,
      priceListId: priceList.id,
      bookingDate: selectedDate,
      note: note || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ropeArtists'] });
      onSuccess();
    },
  });

  const busyDateSet = new Set(availability?.busyDates.map(d => d.date) ?? []);
  const maxDays = availability?.maxBookingDaysAhead ?? 30;

  // Generate available dates
  const today = new Date();
  const dates: { date: string; label: string; isBusy: boolean }[] = [];
  for (let i = 1; i <= maxDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    dates.push({
      date: dateStr,
      label: `${d.getMonth() + 1}/${d.getDate()} ${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}`,
      isBusy: busyDateSet.has(dateStr),
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">预约</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Selected price list */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">{priceList.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{priceList.description}</p>
          <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">{priceList.priceText}</p>
        </div>

        {/* Date selection */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1">
            <Calendar size={16} /> 选择日期
          </h3>
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
            {dates.map(d => (
              <button
                key={d.date}
                disabled={d.isBusy}
                onClick={() => setSelectedDate(d.date)}
                className={`py-2 px-1 rounded-lg text-xs text-center transition-colors ${
                  d.isBusy
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed line-through'
                    : selectedDate === d.date
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">备注（可选）</h3>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="有什么想说的..."
            rows={3}
            maxLength={500}
            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          />
        </div>

        {bookMutation.error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <AlertCircle size={16} />
            {(bookMutation.error as Error).message}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <button
          onClick={() => bookMutation.mutate()}
          disabled={!selectedDate || bookMutation.isPending}
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {bookMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
          确认预约
        </button>
      </div>
    </div>
  );
};

// ==================== My Bookings View ====================

const MyBookingsView: React.FC<{
  onBack: () => void;
  onReview: (booking: RopeBookingData) => void;
}> = ({ onBack, onReview }) => {
  const queryClient = useQueryClient();
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['ropeArtists', 'myBookings'],
    queryFn: () => ropeArtistApi.getMyBookings(),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) => ropeArtistApi.cancelBooking(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待确认', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    CONFIRMED: { label: '已确认', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    REVIEWED: { label: '已评价', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    CANCELLED_BY_CLIENT: { label: '已取消', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">我的预约</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
        ) : !bookings?.length ? (
          <p className="text-center text-gray-400 py-12">暂无预约</p>
        ) : (
          bookings.map(b => {
            const st = statusLabels[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{b.artistName}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                </div>
                <p className="text-sm text-gray-500">{b.priceListTitle}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Calendar size={14} /> {b.bookingDate}
                </p>
                {b.note && <p className="text-xs text-gray-400 mt-1">备注: {b.note}</p>}
                {b.rejectionReason && <p className="text-xs text-red-400 mt-1">拒绝原因: {b.rejectionReason}</p>}

                <div className="flex gap-2 mt-3">
                  {b.status === 'PENDING' && (
                    <button
                      onClick={() => cancelMutation.mutate(b.id)}
                      disabled={cancelMutation.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      取消预约
                    </button>
                  )}
                  {b.status === 'COMPLETED' && (
                    <button
                      onClick={() => onReview(b)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white"
                    >
                      去评价
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ==================== Review Form ====================

const ReviewForm: React.FC<{
  booking: RopeBookingData;
  onBack: () => void;
  onSuccess: () => void;
}> = ({ booking, onBack, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: () => ropeArtistApi.reviewBooking(booking.id, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ropeArtists'] });
      onSuccess();
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">评价</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">评价 {booking.artistName} 的服务</p>
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} onClick={() => setRating(i + 1)}>
                <Star size={28} className={i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'} />
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-1">{rating} / 5</p>
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="写下你的体验..."
          rows={5}
          maxLength={1000}
          className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
        />

        {submitMutation.error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <AlertCircle size={16} />
            {(submitMutation.error as Error).message}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <button
          onClick={() => submitMutation.mutate()}
          disabled={!comment.trim() || submitMutation.isPending}
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          提交评价
        </button>
      </div>
    </div>
  );
};

// ==================== Main Page ====================

type View =
  | { type: 'list' }
  | { type: 'detail'; artistId: number }
  | { type: 'booking'; artistId: number; priceList: PriceListItem }
  | { type: 'my-bookings' }
  | { type: 'review'; booking: RopeBookingData };

const RopeArtStudioPage: React.FC<RopeArtStudioPageProps> = ({ onBack, onManage }) => {
  const [view, setView] = useState<View>({ type: 'list' });

  const handleBack = () => {
    switch (view.type) {
      case 'list': onBack(); break;
      case 'detail': setView({ type: 'list' }); break;
      case 'booking': setView({ type: 'detail', artistId: view.artistId }); break;
      case 'my-bookings': setView({ type: 'list' }); break;
      case 'review': setView({ type: 'my-bookings' }); break;
    }
  };

  switch (view.type) {
    case 'list':
      return (
        <ArtistListView
          onArtistClick={id => setView({ type: 'detail', artistId: id })}
          onManage={onManage}
          onBack={onBack}
          onMyBookings={() => setView({ type: 'my-bookings' })}
        />
      );

    case 'detail':
      return (
        <ArtistDetailView
          artistId={view.artistId}
          onBack={handleBack}
          onBook={(artistId, priceList) => setView({ type: 'booking', artistId, priceList })}
        />
      );

    case 'booking':
      return (
        <BookingView
          artistId={view.artistId}
          priceList={view.priceList}
          onBack={handleBack}
          onSuccess={() => setView({ type: 'my-bookings' })}
        />
      );

    case 'my-bookings':
      return (
        <MyBookingsView
          onBack={handleBack}
          onReview={booking => setView({ type: 'review', booking })}
        />
      );

    case 'review':
      return (
        <ReviewForm
          booking={view.booking}
          onBack={handleBack}
          onSuccess={() => setView({ type: 'my-bookings' })}
        />
      );
  }
};

export default RopeArtStudioPage;
