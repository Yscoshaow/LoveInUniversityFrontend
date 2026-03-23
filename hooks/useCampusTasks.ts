import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campusTasksApi } from '../lib/api';
import type {
  CampusTaskStatus,
  CreateCampusTaskRequest,
  UpdateCampusTaskRequest,
  SubmitTaskRequest,
  ReviewSubmissionRequest,
  PostCommentRequest,
  TipTaskRequest,
} from '../types';

const PAGE_SIZE = 20;

// Query keys for campus tasks
export const campusTaskQueryKeys = {
  all: ['campusTasks'] as const,
  list: (status?: CampusTaskStatus) => ['campusTasks', 'list', status] as const,
  my: () => ['campusTasks', 'my'] as const,
  mySubmissions: () => ['campusTasks', 'mySubmissions'] as const,
  pendingReviews: () => ['campusTasks', 'pendingReviews'] as const,
  myFavorites: () => ['campusTasks', 'myFavorites'] as const,
  detail: (id: number) => ['campusTasks', 'detail', id] as const,
  comments: (id: number) => ['campusTasks', id, 'comments'] as const,
  submissions: (id: number) => ['campusTasks', id, 'submissions'] as const,
};

/**
 * Hook for fetching campus tasks list (simple, non-paginated)
 */
export function useCampusTasks(status?: CampusTaskStatus, limit?: number, offset?: number) {
  return useQuery({
    queryKey: campusTaskQueryKeys.list(status),
    queryFn: () => campusTasksApi.getTasks(status, limit, offset),
  });
}

/**
 * Infinite scroll hook for campus tasks (explore tab)
 */
export function useInfiniteCampusTasks(status?: CampusTaskStatus) {
  return useInfiniteQuery({
    queryKey: ['campusTasks', 'infinite', status],
    queryFn: ({ pageParam = 0 }) =>
      campusTasksApi.getTasks(status, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
  });
}

/**
 * Hook for fetching my created tasks
 */
export function useMyCampusTasks(limit?: number) {
  return useQuery({
    queryKey: campusTaskQueryKeys.my(),
    queryFn: () => campusTasksApi.getMyTasks(limit),
  });
}

/**
 * Hook for fetching my submissions
 */
export function useMySubmissions(limit?: number) {
  return useQuery({
    queryKey: campusTaskQueryKeys.mySubmissions(),
    queryFn: () => campusTasksApi.getMySubmissions(limit),
  });
}

/**
 * Hook for fetching pending reviews
 */
export function usePendingReviews(limit?: number) {
  return useQuery({
    queryKey: campusTaskQueryKeys.pendingReviews(),
    queryFn: () => campusTasksApi.getPendingReviews(limit),
  });
}

/**
 * Hook for fetching my favorite tasks
 */
export function useMyFavoriteTasks(limit?: number) {
  return useQuery({
    queryKey: campusTaskQueryKeys.myFavorites(),
    queryFn: () => campusTasksApi.getMyFavorites(limit),
  });
}

/**
 * Hook for fetching campus task detail
 */
export function useCampusTaskDetail(taskId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: campusTaskQueryKeys.detail(taskId),
    queryFn: () => campusTasksApi.getTask(taskId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for creating a campus task
 */
export function useCreateCampusTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCampusTaskRequest) => campusTasksApi.createTask(request),
    onSuccess: () => {
      // Invalidate all campus task queries including my tasks
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.my() });
    },
  });
}

/**
 * Hook for updating a campus task
 */
export function useUpdateCampusTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request: UpdateCampusTaskRequest }) =>
      campusTasksApi.updateTask(taskId, request),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.detail(taskId) });
    },
  });
}

/**
 * Hook for deleting a campus task
 */
export function useDeleteCampusTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => campusTasksApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
    },
  });
}

/**
 * Hook for submitting to a campus task
 */
export function useSubmitCampusTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request: SubmitTaskRequest }) =>
      campusTasksApi.submitTask(taskId, request),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.mySubmissions() });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.submissions(taskId) });
      // Also refresh my tasks tab
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.my() });
    },
  });
}

/**
 * Hook for reviewing a submission
 */
export function useReviewSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, request }: { submissionId: number; request: ReviewSubmissionRequest }) =>
      campusTasksApi.reviewSubmission(submissionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.pendingReviews() });
    },
  });
}

/**
 * Hook for toggling favorite on a task
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => campusTasksApi.toggleFavorite(taskId),
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.myFavorites() });
      // Also refresh my tasks tab
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.my() });
    },
  });
}

/**
 * Hook for posting a comment
 */
export function usePostCampusTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request: PostCommentRequest }) =>
      campusTasksApi.postComment(taskId, request),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.comments(taskId) });
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.detail(taskId) });
    },
  });
}

/**
 * Hook for tipping a task creator
 */
export function useTipTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request: TipTaskRequest }) =>
      campusTasksApi.tipTask(taskId, request),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.detail(taskId) });
    },
  });
}

/**
 * Hook for searching campus tasks
 */
export function useSearchCampusTasks(keyword: string, status?: CampusTaskStatus, limit?: number, offset?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['campusTasks', 'search', keyword, status],
    queryFn: () => campusTasksApi.searchTasks(keyword, status, limit, offset),
    enabled: (options?.enabled ?? true) && keyword.length > 0,
  });
}
