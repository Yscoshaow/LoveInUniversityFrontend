import { useEffect, useRef, useCallback, type RefObject } from 'react';

/**
 * Tracks scroll direction on a scrollable element.
 * Dispatches a global 'scroll-direction' CustomEvent so that parent layouts
 * (e.g. MainLayout) can hide/show the bottom nav bar.
 *
 * Returns a handler to attach to the element's onScroll.
 */
export function useScrollDirection(
  ref: RefObject<HTMLElement | null>,
  /** Called with true when scrolling up (or near top), false when scrolling down */
  onVisibilityChange?: (visible: boolean) => void,
) {
  const lastY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) { ticking.current = false; return; }

      const y = el.scrollTop;
      const isNearTop = y < 60;
      const isUp = y < lastY.current;

      const visible = isNearTop || isUp;
      onVisibilityChange?.(visible);

      // Broadcast for bottom nav bar
      window.dispatchEvent(new CustomEvent('scroll-direction', { detail: { visible } }));

      lastY.current = y;
      ticking.current = false;
    });
  }, [ref, onVisibilityChange]);

  // Attach scroll listener
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [ref, handleScroll]);

  // Also listen for scroll-to-top events
  useEffect(() => {
    const handler = () => ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.addEventListener('scroll-to-top', handler);
    return () => window.removeEventListener('scroll-to-top', handler);
  }, [ref]);
}
