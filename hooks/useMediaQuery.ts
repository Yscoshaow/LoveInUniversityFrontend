import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** lg breakpoint (1024px) — sidebar visible, desktop layout */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** md breakpoint (768px) — tablet, some grid adjustments */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
