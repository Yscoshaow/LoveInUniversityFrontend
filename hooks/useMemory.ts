import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memoryApi, scheduleSharingApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type {
  CreateMemoryRequest,
  UpdateMemoryRequest,
  InviteToMemoryRequest,
  ShareScheduleRequest,
  JoinByShareCodeRequest,
  RespondToInvitationRequest,
  PublishScheduleRequest,
  UpdateParticipantPermissionRequest,
} from '../types';

// ==================== Memory Hooks ====================

/**
 * Hook for fetching my memories
 */
export function useMyMemories(limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...queryKeys.memories.my(), limit, offset],
    queryFn: () => memoryApi.getMyMemories(limit, offset),
  });
}

/**
 * Hook for fetching memory stats
 */
export function useMemoryStats() {
  return useQuery({
    queryKey: queryKeys.memories.stats(),
    queryFn: () => memoryApi.getStats(),
  });
}

/**
 * Hook for fetching memories for a specific schedule
 */
export function useScheduleMemories(scheduleId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.memories.bySchedule(scheduleId),
    queryFn: () => memoryApi.getScheduleMemories(scheduleId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching memory detail
 */
export function useMemoryDetail(memoryId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.memories.detail(memoryId),
    queryFn: () => memoryApi.getMemory(memoryId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for creating a memory
 */
export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateMemoryRequest) => memoryApi.createMemory(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.bySchedule(variables.scheduleId) });
    },
  });
}

/**
 * Hook for updating a memory
 */
export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memoryId, request }: { memoryId: number; request: UpdateMemoryRequest }) =>
      memoryApi.updateMemory(memoryId, request),
    onSuccess: (data, { memoryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
      if (data.schedule) {
        queryClient.invalidateQueries({ queryKey: queryKeys.memories.bySchedule(data.schedule.id) });
      }
    },
  });
}

/**
 * Hook for deleting a memory
 */
export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoryId: number) => memoryApi.deleteMemory(memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.all });
    },
  });
}

/**
 * Hook for inviting users to view memory
 */
export function useInviteToMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memoryId, request }: { memoryId: number; request: InviteToMemoryRequest }) =>
      memoryApi.inviteUsers(memoryId, request),
    onSuccess: (_, { memoryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
    },
  });
}

/**
 * Hook for removing invitation
 */
export function useRemoveMemoryInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memoryId, userId }: { memoryId: number; userId: number }) =>
      memoryApi.removeInvitation(memoryId, userId),
    onSuccess: (_, { memoryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
    },
  });
}

/**
 * Hook for toggling like on memory
 */
export function useToggleMemoryLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoryId: number) => memoryApi.toggleLike(memoryId),
    onSuccess: (_, memoryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
    },
  });
}

/**
 * Hook for generating memory share code
 */
export function useGenerateMemoryShareCode() {
  return useMutation({
    mutationFn: (memoryId: number) => memoryApi.generateShareCode(memoryId),
  });
}

/**
 * Hook for joining memory by share code
 */
export function useJoinMemoryByShareCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareCode: string) => memoryApi.joinByShareCode(shareCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
    },
  });
}

/**
 * Hook for publishing memory to community
 */
export function usePublishMemoryToCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoryId: number) => memoryApi.publishToCommunity(memoryId),
    onSuccess: (_, memoryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

/**
 * Hook for unpublishing memory from community
 */
export function useUnpublishMemoryFromCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoryId: number) => memoryApi.unpublishFromCommunity(memoryId),
    onSuccess: (_, memoryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.detail(memoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.my() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.stats() });
    },
  });
}

// ==================== Schedule Sharing Hooks ====================

/**
 * Hook for fetching schedule participants
 */
export function useScheduleParticipants(scheduleId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.scheduleSharing.participants(scheduleId),
    queryFn: () => scheduleSharingApi.getParticipants(scheduleId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching shared schedules
 */
export function useSharedSchedules() {
  return useQuery({
    queryKey: queryKeys.scheduleSharing.shared(),
    queryFn: () => scheduleSharingApi.getSharedSchedules(),
  });
}

/**
 * Hook for fetching pending invitations
 */
export function usePendingScheduleInvitations() {
  return useQuery({
    queryKey: queryKeys.scheduleSharing.pending(),
    queryFn: () => scheduleSharingApi.getPendingInvitations(),
  });
}

/**
 * Hook for sharing schedule with users
 */
export function useShareSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, request }: { scheduleId: number; request: ShareScheduleRequest }) =>
      scheduleSharingApi.shareWithUsers(scheduleId, request),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.participants(scheduleId) });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
    },
  });
}

/**
 * Hook for generating share code
 */
export function useGenerateShareCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleSharingApi.generateShareCode(scheduleId),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
    },
  });
}

/**
 * Hook for joining by share code
 */
export function useJoinByShareCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: JoinByShareCodeRequest) => scheduleSharingApi.joinByShareCode(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.shared() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/**
 * Hook for responding to invitation
 */
export function useRespondToScheduleInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, request }: { scheduleId: number; request: RespondToInvitationRequest }) =>
      scheduleSharingApi.respondToInvitation(scheduleId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.pending() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.shared() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/**
 * Hook for removing participant
 */
export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, userId }: { scheduleId: number; userId: number }) =>
      scheduleSharingApi.removeParticipant(scheduleId, userId),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.participants(scheduleId) });
    },
  });
}

/**
 * Hook for updating participant permission
 */
export function useUpdateParticipantPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, userId, request }: { scheduleId: number; userId: number; request: UpdateParticipantPermissionRequest }) =>
      scheduleSharingApi.updateParticipantPermission(scheduleId, userId, request),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.participants(scheduleId) });
    },
  });
}

/**
 * Hook for leaving shared schedule
 */
export function useLeaveSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleSharingApi.leaveSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.shared() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/**
 * Hook for publishing schedule to community
 */
export function usePublishScheduleToCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, request }: { scheduleId: number; request?: PublishScheduleRequest }) =>
      scheduleSharingApi.publishToCommunity(scheduleId, request),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.shared() });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

/**
 * Hook for unpublishing schedule from community
 */
export function useUnpublishScheduleFromCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: number) => scheduleSharingApi.unpublishFromCommunity(scheduleId),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', 'detail', scheduleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSharing.shared() });
    },
  });
}
