import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskRequestApi } from '../lib/api';
import type {
  TaskRequestStatus,
  CreateTaskRequestRequest,
  SubmitProposalRequest,
  SelectWinnerRequest,
} from '../types';

const PAGE_SIZE = 20;

export const taskRequestQueryKeys = {
  all: ['taskRequests'] as const,
  list: (status?: TaskRequestStatus) => ['taskRequests', 'list', status] as const,
  detail: (id: number) => ['taskRequests', 'detail', id] as const,
  proposals: (id: number) => ['taskRequests', id, 'proposals'] as const,
  my: () => ['taskRequests', 'my'] as const,
  myProposals: () => ['taskRequests', 'myProposals'] as const,
};

/**
 * Infinite scroll hook for task requests (explore tab)
 */
export function useInfiniteTaskRequests(status?: TaskRequestStatus) {
  return useInfiniteQuery({
    queryKey: ['taskRequests', 'infinite', status],
    queryFn: ({ pageParam = 0 }) =>
      taskRequestApi.getRequests({ status, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
  });
}

/**
 * Hook for fetching task request detail
 */
export function useTaskRequestDetail(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskRequestQueryKeys.detail(id),
    queryFn: () => taskRequestApi.getRequest(id),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching proposals for a task request (creator only)
 */
export function useTaskRequestProposals(requestId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskRequestQueryKeys.proposals(requestId),
    queryFn: () => taskRequestApi.getProposals(requestId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching my task requests
 */
export function useMyTaskRequests() {
  return useQuery({
    queryKey: taskRequestQueryKeys.my(),
    queryFn: () => taskRequestApi.getMyRequests(),
  });
}

/**
 * Hook for fetching my proposals
 */
export function useMyProposals() {
  return useQuery({
    queryKey: taskRequestQueryKeys.myProposals(),
    queryFn: () => taskRequestApi.getMyProposals(),
  });
}

/**
 * Hook for creating a task request
 */
export function useCreateTaskRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateTaskRequestRequest) => taskRequestApi.createRequest(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.my() });
    },
  });
}

/**
 * Hook for canceling a task request (refund)
 */
export function useCancelTaskRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => taskRequestApi.cancelRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.my() });
    },
  });
}

/**
 * Hook for submitting a proposal
 */
export function useSubmitProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, request }: { requestId: number; request: SubmitProposalRequest }) =>
      taskRequestApi.submitProposal(requestId, request),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.myProposals() });
    },
  });
}

/**
 * Hook for selecting a winner
 */
export function useSelectWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, request }: { requestId: number; request: SelectWinnerRequest }) =>
      taskRequestApi.selectWinner(requestId, request),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.proposals(requestId) });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskRequestQueryKeys.my() });
    },
  });
}
