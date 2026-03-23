import { useEffect, useRef } from 'react';

interface SwipeBackOptions {
  /** Callback when swipe-back gesture completes */
  onBack: () => void;
  /** Whether the gesture is currently enabled */
  enabled?: boolean;
  /** Max distance from left edge to start the gesture (px). Default: 30 */
  edgeThreshold?: number;
  /** Min horizontal distance to trigger back (px). Default: 80 */
  swipeThreshold?: number;
}

/**
 * Hook that detects a swipe-right gesture from the left edge of the screen
 * and calls onBack. Works on touch devices (Android, iOS, mobile browsers).
 */
export function useSwipeBack({
  onBack,
  enabled = true,
  edgeThreshold = 30,
  swipeThreshold = 80,
}: SwipeBackOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only start if touch begins near the left edge
      if (touch.clientX <= edgeThreshold) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        isSwiping.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // Must be a mostly-horizontal swipe to the right
      if (deltaX >= swipeThreshold && deltaX > deltaY * 1.5) {
        onBack();
      }
    };

    const handleTouchCancel = () => {
      isSwiping.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, onBack, edgeThreshold, swipeThreshold]);
}
