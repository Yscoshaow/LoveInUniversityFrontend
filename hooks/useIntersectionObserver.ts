import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that triggers a callback when a sentinel element becomes visible.
 * Used for infinite scroll - place the returned ref on a div at the bottom of the list.
 */
export function useIntersectionObserver(
  onIntersect: () => void,
  options?: {
    enabled?: boolean;
    rootMargin?: string;
  }
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const enabled = options?.enabled ?? true;
  const rootMargin = options?.rootMargin ?? '200px';

  const stableOnIntersect = useCallback(onIntersect, [onIntersect]);

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          stableOnIntersect();
        }
      },
      { rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, rootMargin, stableOnIntersect]);

  return sentinelRef;
}
