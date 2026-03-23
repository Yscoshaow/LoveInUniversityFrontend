import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { optionalTaskGroupApi } from '../lib/api';
import type { UserOptionalTaskGroupDisplay } from '../types';

// Query keys
const OPTIONAL_TASK_GROUPS_KEYS = {
  all: ['optionalTaskGroups'] as const,
  pending: () => [...OPTIONAL_TASK_GROUPS_KEYS.all, 'pending'] as const,
  history: () => [...OPTIONAL_TASK_GROUPS_KEYS.all, 'history'] as const,
  detail: (id: number) => [...OPTIONAL_TASK_GROUPS_KEYS.all, 'detail', id] as const,
  byDate: (date: string) => [...OPTIONAL_TASK_GROUPS_KEYS.all, 'byDate', date] as const,
};

// Hook to fetch pending optional task groups
export function usePendingOptionalTaskGroups() {
  return useQuery({
    queryKey: OPTIONAL_TASK_GROUPS_KEYS.pending(),
    queryFn: () => optionalTaskGroupApi.getPending(),
    staleTime: 1000 * 60, // 1 minute
  });
}

// Hook to fetch optional task group history
export function useOptionalTaskGroupHistory() {
  return useQuery({
    queryKey: OPTIONAL_TASK_GROUPS_KEYS.history(),
    queryFn: () => optionalTaskGroupApi.getHistory(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to fetch a single optional task group detail
export function useOptionalTaskGroupDetail(id: number | null) {
  return useQuery({
    queryKey: OPTIONAL_TASK_GROUPS_KEYS.detail(id || 0),
    queryFn: () => optionalTaskGroupApi.getDetail(id!),
    enabled: !!id,
  });
}

// Hook to fetch optional task groups for a specific date (preview, no DB writes)
export function useOptionalTaskGroupsByDate(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: OPTIONAL_TASK_GROUPS_KEYS.byDate(date),
    queryFn: () => optionalTaskGroupApi.getByDate(date),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutation to select tasks
export function useSelectTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, taskDefinitionIds }: { groupId: number; taskDefinitionIds: number[] }) =>
      optionalTaskGroupApi.selectTasks(groupId, taskDefinitionIds),
    onSuccess: (updatedGroup) => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: OPTIONAL_TASK_GROUPS_KEYS.pending() });
      queryClient.invalidateQueries({ queryKey: OPTIONAL_TASK_GROUPS_KEYS.detail(updatedGroup.id) });

      // Also invalidate daily tasks since new tasks were created
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
