import { useQuery } from '@tanstack/react-query';
import { stickerApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { StickerPack } from '../types';

/**
 * Shared hook for fetching sticker packs with React Query caching.
 * Sticker packs are very static data — cached for 30 minutes, shared across all components.
 */
export function useStickerPacks() {
  const { data: stickerPacks = [] } = useQuery<StickerPack[]>({
    queryKey: queryKeys.stickers.activePacks,
    queryFn: () => stickerApi.getActivePacks(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 1 hour
  });

  return stickerPacks;
}
