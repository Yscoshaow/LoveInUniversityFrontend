import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import { isRouletteCoverBgEnabled } from '../../lib/local-settings';
import { ImageLightbox } from '../ImageLightbox';
import type {
  RouletteGameType,
  WheelCategoryResult,
  ImageWheelConfig,
  TextWheelConfig,
  WheelCategory,
} from '../../types';

interface WheelPlayViewProps {
  gameId: number;
  gameType: RouletteGameType;
  wheelConfig: string;
  gameTitle: string;
  coverImageUrl: string | null;
  onBack: () => void;
}

interface AnimatingCategory {
  name: string;
  description: string | null;
  minPoints: number;
  maxPoints: number;
  displayValue: number;
  finalValue: number | null;
  pointDescription: string | null;
  stopped: boolean;
}

export const WheelPlayView: React.FC<WheelPlayViewProps> = ({
  gameId,
  gameType,
  wheelConfig,
  gameTitle,
  coverImageUrl,
  onBack,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [animCategories, setAnimCategories] = useState<AnimatingCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useCoverAsBg, setUseCoverAsBg] = useState(() => isRouletteCoverBgEnabled());
  const intervalRefs = useRef<ReturnType<typeof setInterval>[]>([]);

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitIndex, setLightboxInitIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const isImageWheel = gameType === 'IMAGE_WHEEL';

  // Parse config to get categories and images
  const parsedConfig = (() => {
    try {
      if (isImageWheel) {
        const config: ImageWheelConfig = JSON.parse(wheelConfig);
        const images = config.imageUrls?.length
          ? config.imageUrls
          : config.imageUrl
            ? [config.imageUrl]
            : [];
        return { images, categories: config.categories };
      } else {
        const config: TextWheelConfig = JSON.parse(wheelConfig);
        return { images: [] as string[], categories: config.categories };
      }
    } catch {
      return { images: [] as string[], categories: [] };
    }
  })();

  // Initialize display
  useEffect(() => {
    resetDisplay();
  }, [wheelConfig]);

  const resetDisplay = () => {
    setAnimCategories(
      parsedConfig.categories.map(cat => ({
        name: cat.name,
        description: cat.description || null,
        minPoints: cat.minPoints,
        maxPoints: cat.maxPoints,
        displayValue: cat.minPoints,
        finalValue: null,
        pointDescription: null,
        stopped: false,
      }))
    );
    setHasRolled(false);
  };

  const clearAllIntervals = useCallback(() => {
    intervalRefs.current.forEach(id => clearInterval(id));
    intervalRefs.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllIntervals();
  }, [clearAllIntervals]);

  const handleRoll = async () => {
    setError(null);
    setIsRolling(true);
    setHasRolled(false);
    clearAllIntervals();

    // Reset categories to animating state
    setAnimCategories(prev =>
      prev.map(c => ({
        ...c,
        finalValue: null,
        pointDescription: null,
        stopped: false,
        displayValue: c.minPoints,
      }))
    );

    // Start random cycling for each category
    const newIntervals: ReturnType<typeof setInterval>[] = [];
    parsedConfig.categories.forEach((cat, idx) => {
      const interval = setInterval(() => {
        setAnimCategories(prev => {
          const updated = [...prev];
          if (!updated[idx].stopped) {
            updated[idx] = {
              ...updated[idx],
              displayValue: Math.floor(Math.random() * (cat.maxPoints - cat.minPoints + 1)) + cat.minPoints,
            };
          }
          return updated;
        });
      }, 80);
      newIntervals.push(interval);
    });
    intervalRefs.current = newIntervals;

    try {
      const response = await rouletteApi.rollWheel(gameId);

      // Stagger stops for each category
      response.results.forEach((result, idx) => {
        setTimeout(() => {
          clearInterval(newIntervals[idx]);
          setAnimCategories(prev => {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              displayValue: result.rolledValue,
              finalValue: result.rolledValue,
              pointDescription: result.pointDescription,
              stopped: true,
            };
            return updated;
          });

          // If this is the last one, mark rolling as done
          if (idx === response.results.length - 1) {
            setTimeout(() => {
              setIsRolling(false);
              setHasRolled(true);
            }, 200);
          }
        }, 800 + idx * 300);
      });
    } catch (e: any) {
      setError(e.message || '投掷失败');
      clearAllIntervals();
      setIsRolling(false);
      resetDisplay();
    }
  };

  const handleReroll = () => {
    handleRoll();
  };

  // Carousel scroll tracking
  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentImageIndex(index);
  };

  const scrollToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxInitIndex(index);
    setLightboxOpen(true);
  };

  // Category colors for result badges
  const catColors = [
    { bg: 'from-teal-500 to-emerald-500', ring: 'ring-teal-400', text: 'text-teal-700', light: 'bg-teal-50 dark:bg-teal-950' },
    { bg: 'from-violet-500 to-purple-500', ring: 'ring-violet-400', text: 'text-violet-700 dark:text-violet-400', light: 'bg-violet-50 dark:bg-violet-950' },
    { bg: 'from-amber-500 to-orange-500', ring: 'ring-amber-400', text: 'text-amber-700 dark:text-amber-400', light: 'bg-amber-50 dark:bg-amber-950' },
    { bg: 'from-rose-500 to-pink-500', ring: 'ring-rose-400', text: 'text-rose-700', light: 'bg-rose-50 dark:bg-rose-950' },
    { bg: 'from-blue-500 to-indigo-500', ring: 'ring-blue-400', text: 'text-blue-700 dark:text-blue-400', light: 'bg-blue-50 dark:bg-blue-950' },
    { bg: 'from-cyan-500 to-teal-500', ring: 'ring-cyan-400', text: 'text-cyan-700', light: 'bg-cyan-50 dark:bg-cyan-950' },
  ];

  // ─── IMAGE WHEEL LAYOUT ───
  if (isImageWheel) {
    const images = parsedConfig.images;
    const hasImages = images.length > 0;
    const hasMultipleImages = images.length > 1;

    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full relative">
        {/* Background image overlay */}
        {useCoverAsBg && coverImageUrl && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverImageUrl})` }}
          >
            <div className="absolute inset-0 bg-black/30" />
          </div>
        )}
        {/* Header */}
        <div className={`border-b px-3 py-2.5 flex items-center gap-2 relative z-10 ${useCoverAsBg && coverImageUrl ? 'bg-black/20 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
          <button onClick={onBack} className={`p-1.5 rounded-full transition-colors shrink-0 ${useCoverAsBg && coverImageUrl ? 'hover:bg-white/20 dark:bg-slate-800/20 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            <ChevronLeft size={20} />
          </button>
          <h1 className={`text-base font-semibold truncate flex-1 ${useCoverAsBg && coverImageUrl ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{gameTitle}</h1>
          {coverImageUrl && (
            <button
              onClick={() => setUseCoverAsBg(!useCoverAsBg)}
              className={`p-1.5 rounded-full transition-colors shrink-0 ${useCoverAsBg ? 'bg-white/30 dark:bg-slate-800/30 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
              title="封面背景"
            >
              <ImageIcon size={18} />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Image Area — full background image + floating result overlay */}
        <div className="flex-1 flex flex-col min-h-0 relative z-10">
          {hasImages ? (
            <>
              {/* Full-bleed background image (current carousel image) */}
              <div
                className="absolute inset-0 bg-cover bg-center cursor-pointer"
                style={{ backgroundImage: `url(${images[currentImageIndex]})` }}
                onClick={() => openLightbox(images, currentImageIndex)}
              >
                <div className="absolute inset-0 bg-black/10" />
              </div>

              {/* Navigation arrows */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => scrollToImage(Math.max(0, currentImageIndex - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                  >
                    <ChevronLeft size={20} className="text-white" />
                  </button>
                  <button
                    onClick={() => scrollToImage(Math.min(images.length - 1, currentImageIndex + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                  >
                    <ChevronRight size={20} className="text-white" />
                  </button>
                </>
              )}

              {/* Dots indicator */}
              {hasMultipleImages && (
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToImage(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentImageIndex
                          ? 'bg-white dark:bg-slate-800 w-4'
                          : 'bg-white/50 dark:bg-slate-800/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              暂无图片
            </div>
          )}

          {/* Floating Result Overlay — numbers on top of image */}
          {(isRolling || hasRolled) && (
            <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3">
              <div className="flex items-center justify-center gap-3 overflow-x-auto no-scrollbar">
                {animCategories.map((cat, idx) => {
                  const isStopped = cat.stopped && cat.finalValue !== null;
                  return (
                    <div
                      key={idx}
                      className="shrink-0 flex flex-col items-center"
                    >
                      <span className="text-[10px] font-bold text-white whitespace-nowrap drop-shadow-md">{cat.name}</span>
                      <span
                        className={`text-4xl font-black tabular-nums transition-all duration-150 drop-shadow-lg ${
                          isStopped
                            ? 'text-emerald-400 [text-shadow:_0_0_12px_rgba(0,0,0,0.5),_0_0_24px_rgba(0,0,0,0.3)]'
                            : isRolling && !cat.stopped
                              ? 'text-emerald-300 animate-pulse'
                              : 'text-emerald-300/60'
                        }`}
                      >
                        {cat.displayValue}
                      </span>
                      <span className="text-[9px] font-medium text-white/70 drop-shadow-md">{cat.minPoints}-{cat.maxPoints}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Point descriptions (after roll) */}
        {hasRolled && animCategories.some(c => c.pointDescription) && (
          <div className="px-4 pb-2 space-y-1.5 relative z-10">
            {animCategories.filter(c => c.pointDescription).map((cat, idx) => (
              <div key={idx} className="px-3 py-2 bg-teal-50 dark:bg-teal-950 border border-teal-200 rounded-xl">
                <span className="text-xs font-semibold text-teal-700">{cat.name}: </span>
                <span className="text-sm text-teal-700">{cat.pointDescription}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Button */}
        <div className={`px-4 py-3 border-t relative z-10 ${useCoverAsBg && coverImageUrl ? 'bg-black/20 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
          <button
            onClick={hasRolled ? handleReroll : handleRoll}
            disabled={isRolling}
            className={`w-full py-3.5 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 ${
              hasRolled
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600'
            }`}
          >
            {isRolling ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                投掷中...
              </>
            ) : hasRolled ? (
              <>
                <RotateCcw size={20} />
                重新投掷
              </>
            ) : (
              <>
                <Dices size={20} />
                Roll!
              </>
            )}
          </button>
        </div>

        {/* Lightbox */}
        {lightboxOpen && hasImages && (
          <ImageLightbox
            images={images}
            initialIndex={lightboxInitIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    );
  }

  // ─── TEXT WHEEL LAYOUT ───
  const displayImageUrl = coverImageUrl;
  const textWheelLightboxImages = displayImageUrl ? [displayImageUrl] : [];

  const bgActive = useCoverAsBg && coverImageUrl;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full relative">
      {/* Background image overlay */}
      {bgActive && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverImageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      {/* Header */}
      <div className={`border-b px-4 py-3 flex items-center gap-3 relative z-10 ${bgActive ? 'bg-black/20 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
        <button onClick={onBack} className={`p-2 rounded-full transition-colors ${bgActive ? 'hover:bg-white/20 dark:bg-slate-800/20 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
          <ChevronLeft size={20} />
        </button>
        <h1 className={`text-lg font-semibold flex-1 truncate ${bgActive ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{gameTitle}</h1>
        {coverImageUrl && (
          <button
            onClick={() => setUseCoverAsBg(!useCoverAsBg)}
            className={`p-1.5 rounded-full transition-colors shrink-0 ${useCoverAsBg ? 'bg-white/30 dark:bg-slate-800/30 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
            title="封面背景"
          >
            <ImageIcon size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative z-10">
        {/* Cover Image — click to enlarge (hidden when used as background) */}
        {displayImageUrl && !bgActive && (
          <div className="px-4 pt-4">
            <img
              src={displayImageUrl}
              alt={gameTitle}
              className="w-full rounded-2xl object-cover max-h-64 cursor-pointer"
              onClick={() => openLightbox(textWheelLightboxImages, 0)}
            />
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Category Cards */}
        <div className="px-4 py-4 space-y-3">
          {animCategories.map((cat, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-4 transition-all duration-300 ${
                bgActive ? 'bg-white/15 dark:bg-slate-800/15' : 'bg-white dark:bg-slate-800'
              } ${
                cat.stopped && cat.finalValue !== null
                  ? bgActive
                    ? 'ring-2 ring-white/50 shadow-lg'
                    : 'ring-2 ring-teal-400 shadow-lg shadow-teal-100'
                  : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                      {cat.name.charAt(0) || String.fromCharCode(65 + idx)}
                    </div>
                    <h3 className={`font-semibold ${bgActive ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{cat.name}</h3>
                  </div>
                  {cat.description && (
                    <p className={`text-xs mt-1 ml-10 ${bgActive ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'}`}>{cat.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-3xl font-bold tabular-nums transition-all duration-150 ${
                      cat.stopped && cat.finalValue !== null
                        ? bgActive ? 'text-white scale-110' : 'text-teal-600 dark:text-teal-400 scale-110'
                        : isRolling
                          ? bgActive ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'
                          : bgActive ? 'text-white/40' : 'text-slate-300'
                    }`}
                  >
                    {cat.displayValue}
                  </div>
                  <p className={`text-[10px] ${bgActive ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>{cat.minPoints}-{cat.maxPoints}</p>
                </div>
              </div>

              {/* Point description reveal */}
              {cat.stopped && cat.pointDescription && (
                <div className={`mt-3 ml-10 px-3 py-2 rounded-xl animate-in fade-in slide-in-from-top-2 ${
                  bgActive ? 'bg-white/20 dark:bg-slate-800/20 border border-white/20' : 'bg-teal-50 dark:bg-teal-950 border border-teal-200'
                }`}>
                  <p className={`text-sm ${bgActive ? 'text-white' : 'text-teal-700'}`}>{cat.pointDescription}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className={`px-4 py-4 border-t relative z-10 ${bgActive ? 'bg-black/20 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
        <button
          onClick={hasRolled ? handleReroll : handleRoll}
          disabled={isRolling}
          className={`w-full py-3.5 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 ${
            hasRolled
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
              : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600'
          }`}
        >
          {isRolling ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              投掷中...
            </>
          ) : hasRolled ? (
            <>
              <RotateCcw size={20} />
              重新投掷
            </>
          ) : (
            <>
              <Dices size={20} />
              Roll!
            </>
          )}
        </button>
      </div>

      {/* Lightbox for cover image */}
      {lightboxOpen && textWheelLightboxImages.length > 0 && (
        <ImageLightbox
          images={textWheelLightboxImages}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};
