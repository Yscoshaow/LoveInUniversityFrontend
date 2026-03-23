import { useInfiniteQuery } from '@tanstack/react-query';
import { selfLockApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';

const PAGE_SIZE = 20;

export function useTimeHistory(lockId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.locks.timeHistory(lockId),
    queryFn: ({ pageParam = 0 }) =>
      selfLockApi.getTimeHistory(lockId, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
    enabled,
  });
}
