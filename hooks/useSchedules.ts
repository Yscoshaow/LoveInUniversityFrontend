import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '../types';

/**
 * Hook for fetching today's schedule overview
 */
export function useTodaySchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: () => scheduleApi.getTodayOverview(),
  });
}

/**
 * Hook for fetching schedule for a specific date
 */
export function useScheduleByDate(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.schedules.byDate(date),
    queryFn: () => scheduleApi.getDateOverview(date),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching upcoming schedules
 */
export function useUpcomingSchedules(limit?: number) {
  return useQuery({
    queryKey: ['schedules', 'upcoming', limit],
    queryFn: () => scheduleApi.getUpcoming(limit),
  });
}

/**
 * Hook for fetching schedule detail
 */
export function useScheduleDetail(scheduleId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['schedules', 'detail', scheduleId],
    queryFn: () => scheduleApi.getSchedule(scheduleId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for creating a new schedule
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateScheduleRequest) => scheduleApi.createSchedule(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/**
 * Hook for updating a schedule
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, request }: { scheduleId: number; request: UpdateScheduleRequest }) =>
      scheduleApi.updateSchedule(scheduleId, request),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
    },
  });
}

/**
 * Hook for deleting a schedule
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleApi.deleteSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/**
 * Hook for marking schedule as completed
 */
export function useCompleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleApi.markAsCompleted(scheduleId),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

/**
 * Hook for canceling a schedule
 */
export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleApi.cancelSchedule(scheduleId),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
    },
  });
}
