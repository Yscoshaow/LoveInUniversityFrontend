import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi, examsApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';

/**
 * Hook for fetching all courses with user status
 */
export function useCoursesWithStatus() {
  return useQuery({
    queryKey: queryKeys.courses.withStatus(),
    queryFn: () => coursesApi.getCoursesWithStatus(),
  });
}

/**
 * Hook for fetching user's course progress
 */
export function useMyCourseProgress() {
  return useQuery({
    queryKey: queryKeys.courses.myProgress(),
    queryFn: () => coursesApi.getMyProgress(),
  });
}

/**
 * Hook for fetching today's courses
 */
export function useTodayCourses() {
  return useQuery({
    queryKey: ['courses', 'today'],
    queryFn: () => coursesApi.getTodayCourses(),
  });
}

/**
 * Hook for fetching course detail
 */
export function useCourseDetail(courseId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: () => coursesApi.getCourseDetail(courseId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching course tasks overview
 */
export function useCourseTasksOverview(courseId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.courses.tasks(courseId),
    queryFn: () => coursesApi.getCourseTasksOverview(courseId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for enrolling in a course
 */
export function useEnrollCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: number) => coursesApi.enrollCourse({ courseId }),
    onSuccess: () => {
      // Invalidate course-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: ['optionalTaskGroups'] });
    },
  });
}

/**
 * Hook for dropping a course
 */
export function useDropCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: number) => coursesApi.dropCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook for checking exam eligibility
 */
export function useExamEligibility(courseId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['exams', 'eligibility', courseId],
    queryFn: () => examsApi.checkEligibility(courseId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for starting an exam
 */
export function useStartExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: number) => examsApi.startExam(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.myProgress() });
    },
  });
}

/**
 * Hook for checking exam result (used after completing exam tasks)
 */
export function useCheckExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: number) => examsApi.checkResult(courseId),
    onSuccess: () => {
      // Refresh user stats (XP, credits)
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
      // Refresh course progress
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}
