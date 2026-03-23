import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { majorsApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { EnrollMajorRequest } from '../types';

/**
 * Hook for fetching majors with user enrollment status
 */
export function useMajorsWithStatus() {
  return useQuery({
    queryKey: queryKeys.majors.withStatus(),
    queryFn: () => majorsApi.getMajorsWithStatus(),
  });
}

/**
 * Hook for fetching major detail
 */
export function useMajorDetail(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.majors.detail(id),
    queryFn: () => majorsApi.getMajorDetailWithStatus(id),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching current major progress
 */
export function useMyMajorProgress() {
  return useQuery({
    queryKey: queryKeys.majors.myProgress(),
    queryFn: () => majorsApi.getMyProgress(),
  });
}

/**
 * Hook for fetching major enrollment history
 */
export function useMajorHistory() {
  return useQuery({
    queryKey: queryKeys.majors.history(),
    queryFn: () => majorsApi.getHistory(),
  });
}

/**
 * Hook for enrolling in a major
 */
export function useEnrollMajor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: EnrollMajorRequest) => majorsApi.enrollMajor(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.majors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

/**
 * Hook for dropping current major
 */
export function useDropMajor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => majorsApi.dropMajor(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.majors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}
