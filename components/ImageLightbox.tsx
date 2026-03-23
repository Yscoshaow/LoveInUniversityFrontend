import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLightboxRegister } from '../contexts/LightboxContext';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDist = useRef<number | null>(null);
  // Track single-touch swipe for navigation
  const touchStartX = useRef(0);
  const touchMoved = useRef(false);

  // Register with LightboxContext for BackButton support
  const lightboxCtx = useLightboxRegister();
  useEffect(() => {
    lightboxCtx?.register(onClose);
    return () => lightboxCtx?.unregister();
  }, [onClose, lightboxCtx]);

  const hasMultiple = images.length > 1;

  const resetTransform = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetTransform();
  }, [images.length, resetTransform]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetTransform();
  }, [images.length, resetTransform]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasMultiple) goNext();
      if (e.key === 'ArrowLeft' && hasMultiple) goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goNext, goPrev, hasMultiple]);

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (scale > 1) {
        resetTransform();
      } else {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          let clientX: number, clientY: number;
          if ('touches' in e) {
            // Won't fire for double-tap via onDoubleClick, but keep for safety
            clientX = (e as React.TouchEvent).touches[0]?.clientX ?? rect.left + rect.width / 2;
            clientY = (e as React.TouchEvent).touches[0]?.clientY ?? rect.top + rect.height / 2;
          } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
          }
          const x = clientX - rect.left - rect.width / 2;
          const y = clientY - rect.top - rect.height / 2;
          setScale(2.5);
          setTranslate({ x: -x * 1.5, y: -y * 1.5 });
        }
      }
    },
    [scale, resetTransform]
  );

  // Double-tap detection for mobile
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Start pinch
        lastTouchDist.current = null;
        touchMoved.current = true; // Mark as multi-touch
      } else if (e.touches.length === 1) {
        touchStartX.current = e.touches[0].clientX;
        touchMoved.current = false;

        if (scale > 1) {
          // Start panning when zoomed
          setIsPanning(true);
          panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          translateStart.current = { ...translate };
        }
      }
    },
    [scale, translate]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch-to-zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastTouchDist.current !== null) {
          const delta = dist - lastTouchDist.current;
          setScale((s) => Math.min(5, Math.max(1, s + delta * 0.01)));
        }
        lastTouchDist.current = dist;
        e.preventDefault();
        touchMoved.current = true;
      } else if (e.touches.length === 1) {
        const moveX = Math.abs(e.touches[0].clientX - touchStartX.current);
        if (moveX > 5) touchMoved.current = true;

        if (scale > 1 && isPanning) {
          // Pan when zoomed
          const dx = e.touches[0].clientX - panStart.current.x;
          const dy = e.touches[0].clientY - panStart.current.y;
          setTranslate({
            x: translateStart.current.x + dx,
            y: translateStart.current.y + dy,
          });
          e.preventDefault();
        }
      }
    },
    [scale, isPanning]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Double-tap detection
      if (e.changedTouches.length === 1 && !touchMoved.current) {
        const now = Date.now();
        const tapX = e.changedTouches[0].clientX;
        const tapY = e.changedTouches[0].clientY;
        const timeDiff = now - lastTapTime.current;
        const distDiff = Math.sqrt(
          (tapX - lastTapPos.current.x) ** 2 + (tapY - lastTapPos.current.y) ** 2
        );

        if (timeDiff < 300 && distDiff < 30) {
          // Double tap detected
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            if (scale > 1) {
              resetTransform();
            } else {
              const x = tapX - rect.left - rect.width / 2;
              const y = tapY - rect.top - rect.height / 2;
              setScale(2.5);
              setTranslate({ x: -x * 1.5, y: -y * 1.5 });
            }
          }
          lastTapTime.current = 0;
        } else {
          lastTapTime.current = now;
          lastTapPos.current = { x: tapX, y: tapY };
        }
      }

      // Swipe navigation (only when not zoomed)
      if (scale <= 1 && hasMultiple && touchMoved.current) {
        const endX = e.changedTouches[0]?.clientX ?? 0;
        const diff = touchStartX.current - endX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) goNext();
          else goPrev();
        }
      }

      lastTouchDist.current = null;
      setIsPanning(false);
    },
    [scale, hasMultiple, goNext, goPrev, resetTransform]
  );

  // Mouse pan when zoomed
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
        translateStart.current = { ...translate };
      }
    },
    [scale, translate]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && scale > 1) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setTranslate({
          x: translateStart.current.x + dx,
          y: translateStart.current.y + dy,
        });
      }
    },
    [isPanning, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(5, s + 0.5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(1, s - 0.5);
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Reset zoom when scale drops to 1
  useEffect(() => {
    if (scale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white/60 text-sm">
          {hasMultiple && `${currentIndex + 1} / ${images.length}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={zoomIn}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // Tap backdrop to close (only if not zoomed and not panning)
          if (scale <= 1 && e.target === e.currentTarget) onClose();
        }}
        style={{ cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      >
        <img
          src={images[currentIndex]}
          alt=""
          className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-200"
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Thumbnail strip at bottom */}
      {hasMultiple && (
        <div className="flex gap-2 px-4 py-3 justify-center overflow-x-auto z-10">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                resetTransform();
              }}
              className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex
                  ? 'border-white'
                  : 'border-white/20 opacity-50 hover:opacity-80'
              }`}
            >
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
