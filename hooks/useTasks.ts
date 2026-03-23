import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userTasksApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { DailyTaskOverview, UserTaskDetail } from '../types';

/**
 * Hook for fetching today's task overview
 */
export function useTodayTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.today(),
    queryFn: () => userTasksApi.getTodayOverview(),
  });
}

/**
 * Hook for fetching tasks by date
 */
export function useTasksByDate(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tasks.byDate(date),
    queryFn: () => userTasksApi.getDateOverview(date),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for starting a task
 */
export function useStartTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => userTasksApi.startTask(taskId),
    onSuccess: () => {
      // Invalidate task queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook for updating task progress
 */
export function useUpdateTaskProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, actualValue }: { taskId: number; actualValue: number }) =>
      userTasksApi.updateProgress(taskId, actualValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      // Progress update might affect course points display
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

/**
 * Hook for completing a task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, actualValue }: { taskId: number; actualValue?: number }) =>
      userTasksApi.completeTask(taskId, actualValue),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      // Invalidate course queries (completing tasks earns course points)
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      // Invalidate behavior/punishment queries (completing a punishment task marks it done)
      queryClient.invalidateQueries({ queryKey: queryKeys.behavior.all });
    },
  });
}

/**
 * Hook for abandoning a task
 */
export function useAbandonTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => userTasksApi.abandonTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      // Abandoning tasks might affect course progress
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      // Abandoning tasks may trigger behavior penalties
      queryClient.invalidateQueries({ queryKey: queryKeys.behavior.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}
