import { useQuery } from '@tanstack/react-query';
import { punishmentsApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';

/**
 * Hook for fetching pending punishments/penalties
 */
export function usePendingPunishments() {
  return useQuery({
    queryKey: queryKeys.behavior.penalties(),
    queryFn: () => punishmentsApi.getPending(),
  });
}

/**
 * Hook for fetching punishment history
 */
export function usePunishmentHistory() {
  return useQuery({
    queryKey: ['behavior', 'history'],
    queryFn: () => punishmentsApi.getHistory(),
  });
}
