import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rouletteApi } from '../lib/api';

export const rouletteTaskQueryKeys = {
  all: ['rouletteTasks'] as const,
  pending: () => ['rouletteTasks', 'pending'] as const,
};

/**
 * Hook for fetching pending roulette task instances (for Dashboard)
 */
export function usePendingRouletteTasks() {
  return useQuery({
    queryKey: rouletteTaskQueryKeys.pending(),
    queryFn: () => rouletteApi.getPendingTasks(),
  });
}

/**
 * Hook to get invalidation helper for roulette tasks
 */
export function useInvalidateRouletteTasks() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: rouletteTaskQueryKeys.pending() });
  };
}
