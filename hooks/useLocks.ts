import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { selfLockApi, keyholderApi, extensionApi, lockTaskApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type {
  CreateSelfLockRequest,
  FreezeRequest,
  AddKeyholderRequest,
  UpdateKeyholderRequest,
  ExtensionType,
  ExtensionConfigRequest,
  CreateLockTaskRequest,
  SubmitLockTaskProofRequest,
  ReviewLockTaskRequest,
  PostLockCommentRequest,
} from '../types';

// ==================== Lock Queries ====================

/**
 * Hook for fetching my locks
 */
export function useMyLocks(activeOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.locks.my(),
    queryFn: () => selfLockApi.getMyLocks(activeOnly),
  });
}

/**
 * Hook for fetching public locks
 */
export function usePublicLocks(limit?: number, offset?: number) {
  return useQuery({
    queryKey: queryKeys.locks.public(),
    queryFn: () => selfLockApi.getPublicLocks(limit, offset),
  });
}

/**
 * Hook for fetching playground locks (shared + public)
 */
export function usePlaygroundLocks(limit?: number) {
  return useQuery({
    queryKey: ['locks', 'playground'],
    queryFn: () => selfLockApi.getPlaygroundLocks(limit),
  });
}

/**
 * Hook for fetching managed locks (where I am keyholder)
 */
export function useManagedLocks() {
  return useQuery({
    queryKey: queryKeys.locks.managed(),
    queryFn: () => selfLockApi.getManagedLocks(),
  });
}

/**
 * Hook for fetching lock detail
 */
export function useLockDetail(lockId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.locks.detail(lockId),
    queryFn: () => selfLockApi.getLockDetail(lockId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching my lock stats
 */
export function useMyLockStats() {
  return useQuery({
    queryKey: ['locks', 'my', 'stats'],
    queryFn: () => selfLockApi.getMyStats(),
  });
}

/**
 * Hook for fetching lock history
 */
export function useLockHistory() {
  return useQuery({
    queryKey: queryKeys.locks.history(),
    queryFn: () => selfLockApi.getMyLocks(false), // Get all locks including inactive
  });
}

/**
 * Hook for checking if user has active lock
 */
export function useCheckActiveLock(minDuration?: number) {
  return useQuery({
    queryKey: ['locks', 'check-active', minDuration],
    queryFn: () => selfLockApi.checkActiveLock(minDuration),
  });
}

// ==================== Lock Mutations ====================

/**
 * Hook for creating a new lock
 */
export function useCreateLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateSelfLockRequest) => selfLockApi.createLock(request),
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      // If public or shared, refresh playground
      if (request.isPublic || request.lockType === 'SHARED') {
        queryClient.invalidateQueries({ queryKey: ['locks', 'playground'] });
      }
    },
  });
}

/**
 * Hook for creating a new lock V2 (with all new features)
 */
export function useCreateLockV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateSelfLockRequest) => selfLockApi.createLockV2(request),
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      // If public or shared, refresh playground
      if (request.isPublic || request.lockType === 'SHARED') {
        queryClient.invalidateQueries({ queryKey: ['locks', 'playground'] });
      }
    },
  });
}

/**
 * Hook for trying to unlock
 */
export function useUnlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.tryUnlock(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

/**
 * Hook for liking a lock (adds time)
 */
export function useLikeLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.like(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.public() });
    },
  });
}

/**
 * Hook for voting on a lock
 */
export function useVoteLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.vote(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.public() });
    },
  });
}

/**
 * Hook for guessing (time or key)
 */
export function useGuess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, guessType, guessValue }: { lockId: number; guessType: string; guessValue: string }) =>
      selfLockApi.guess(lockId, guessType, guessValue),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for emergency unlock
 */
export function useEmergencyUnlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.emergencyUnlock(lockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

/**
 * Hook for freezing a lock
 */
export function useFreezeLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, request }: { lockId: number; request?: FreezeRequest }) =>
      selfLockApi.freezeLock(lockId, request),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.managed() });
    },
  });
}

/**
 * Hook for unfreezing a lock
 */
export function useUnfreezeLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.unfreezeLock(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.managed() });
    },
  });
}

/**
 * Hook for using veto power
 */
export function useVeto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.useVeto(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

// ==================== Hygiene Opening ====================

/**
 * Hook for requesting hygiene opening
 */
export function useRequestHygieneOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.requestHygieneOpening(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for ending hygiene opening
 */
export function useEndHygieneOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => selfLockApi.endHygieneOpening(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for fetching hygiene image history
 */
export function useHygieneImageHistory(lockId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', lockId, 'hygiene', 'history'],
    queryFn: () => selfLockApi.getHygieneImageHistory(lockId),
    enabled: options?.enabled ?? true,
  });
}

// ==================== Lock Comments ====================

/**
 * Hook for fetching lock comments
 */
export function useLockComments(lockId: number, limit?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', lockId, 'comments'],
    queryFn: () => selfLockApi.getComments(lockId, limit),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for posting a comment on a lock
 */
export function usePostLockComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, request }: { lockId: number; request: PostLockCommentRequest }) =>
      selfLockApi.postComment(lockId, request),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'comments'] });
    },
  });
}

/**
 * Hook for deleting a lock comment
 */
export function useDeleteLockComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, lockId }: { commentId: number; lockId: number }) =>
      selfLockApi.deleteComment(commentId),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'comments'] });
    },
  });
}

// ==================== Keyholder Management ====================

/**
 * Hook for fetching keyholders of a lock
 */
export function useLockKeyholders(lockId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', lockId, 'keyholders'],
    queryFn: () => keyholderApi.getKeyholders(lockId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for adding a keyholder
 */
export function useAddKeyholder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, request }: { lockId: number; request: AddKeyholderRequest }) =>
      keyholderApi.addKeyholder(lockId, request),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'keyholders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for updating keyholder permission
 */
export function useUpdateKeyholder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, userId, request }: { lockId: number; userId: number; request: UpdateKeyholderRequest }) =>
      keyholderApi.updateKeyholder(lockId, userId, request),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'keyholders'] });
    },
  });
}

/**
 * Hook for removing a keyholder
 */
export function useRemoveKeyholder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, userId }: { lockId: number; userId: number }) =>
      keyholderApi.removeKeyholder(lockId, userId),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'keyholders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for taking over a shared lock
 */
export function useTakeOverLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => keyholderApi.claimLock(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: ['locks', 'playground'] });
    },
  });
}

// ==================== Extensions ====================

/**
 * Hook for fetching enabled extensions
 */
export function useLockExtensions(lockId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', lockId, 'extensions'],
    queryFn: () => extensionApi.getExtensions(lockId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for enabling an extension
 */
export function useEnableExtension() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, extensionType, config }: { lockId: number; extensionType: ExtensionType; config?: ExtensionConfigRequest }) =>
      extensionApi.enableExtension(lockId, extensionType, config),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'extensions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for disabling an extension
 */
export function useDisableExtension() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, extensionType }: { lockId: number; extensionType: ExtensionType }) =>
      extensionApi.disableExtension(lockId, extensionType),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'extensions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
    },
  });
}

/**
 * Hook for spinning the wheel of fortune
 */
export function useSpinWheel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => extensionApi.spinWheel(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'extensions'] });
    },
  });
}

/**
 * Hook for rolling dice
 */
export function useRollDice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => extensionApi.rollDice(lockId),
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.detail(lockId) });
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'extensions'] });
    },
  });
}

// ==================== Lock Tasks (Keyholder assigned) ====================

/**
 * Hook for fetching lock tasks
 */
export function useLockTasks(lockId: number, status?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', lockId, 'tasks', status],
    queryFn: () => lockTaskApi.getTasks(lockId, status),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching my assigned tasks (as wearer)
 */
export function useMyLockTasks() {
  return useQuery({
    queryKey: ['locks', 'tasks', 'my'],
    queryFn: () => lockTaskApi.getMyTasks(),
  });
}

/**
 * Hook for fetching tasks I've assigned (as keyholder)
 */
export function useAssignedLockTasks() {
  return useQuery({
    queryKey: ['locks', 'tasks', 'assigned'],
    queryFn: () => lockTaskApi.getAssignedTasks(),
  });
}

/**
 * Hook for creating a lock task
 */
export function useCreateLockTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, request }: { lockId: number; request: CreateLockTaskRequest }) =>
      lockTaskApi.createTask(lockId, request),
    onSuccess: (_, { lockId }) => {
      queryClient.invalidateQueries({ queryKey: ['locks', lockId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['locks', 'tasks', 'assigned'] });
    },
  });
}

/**
 * Hook for submitting lock task proof
 */
export function useSubmitLockTaskProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request?: SubmitLockTaskProofRequest }) =>
      lockTaskApi.submitProof(taskId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks', 'tasks'] });
    },
  });
}

/**
 * Hook for reviewing a lock task
 */
export function useReviewLockTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, request }: { taskId: number; request: ReviewLockTaskRequest }) =>
      lockTaskApi.reviewTask(taskId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
    },
  });
}

/**
 * Hook for voting on a lock task
 */
export function useVoteOnLockTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, approve }: { taskId: number; approve: boolean }) =>
      lockTaskApi.voteOnTask(taskId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks', 'tasks'] });
    },
  });
}

// ==================== Search ====================

/**
 * Hook for searching playground locks
 */
export function useSearchPlaygroundLocks(keyword: string, limit?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['locks', 'playground', 'search', keyword],
    queryFn: () => selfLockApi.searchPlaygroundLocks(keyword, limit),
    enabled: (options?.enabled ?? true) && keyword.length > 0,
  });
}
