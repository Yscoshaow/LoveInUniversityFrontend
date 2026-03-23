import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supervisionApi } from '../lib/api';
import type {
  CreateSupervisorTaskDefinitionRequest,
  UpdateSupervisorTaskDefinitionRequest,
} from '../types';

// Query keys for supervision
export const supervisionQueryKeys = {
  all: ['supervision'] as const,
  homeOverview: () => ['supervision', 'homeOverview'] as const,
  summary: () => ['supervision', 'summary'] as const,
  mySupervisor: () => ['supervision', 'mySupervisor'] as const,
  mySupervisees: () => ['supervision', 'mySupervisees'] as const,
  pending: () => ['supervision', 'pending'] as const,
  myPending: () => ['supervision', 'myPending'] as const,
  signedAgreements: () => ['supervision', 'signedAgreements'] as const,
  taskDefinitions: (superviseeId: number) => ['supervision', 'taskDefinitions', superviseeId] as const,
  superviseeTasksOverview: (superviseeId: number, date?: string) =>
    ['supervision', 'superviseeTasksOverview', superviseeId, date] as const,
  myTasks: (date?: string) => ['supervision', 'myTasks', date] as const,
};

/**
 * Hook for fetching home overview (relationships with today's task stats)
 */
export function useSupervisionHomeOverview() {
  return useQuery({
    queryKey: supervisionQueryKeys.homeOverview(),
    queryFn: () => supervisionApi.getHomeOverview(),
  });
}

/**
 * Hook for fetching supervision summary
 */
export function useSupervisionSummary() {
  return useQuery({
    queryKey: supervisionQueryKeys.summary(),
    queryFn: () => supervisionApi.getSummary(),
  });
}

/**
 * Hook for fetching my supervisor
 */
export function useMySupervisor() {
  return useQuery({
    queryKey: supervisionQueryKeys.mySupervisor(),
    queryFn: () => supervisionApi.getMySupervisor(),
  });
}

/**
 * Hook for fetching my supervisees
 */
export function useMySupervisees() {
  return useQuery({
    queryKey: supervisionQueryKeys.mySupervisees(),
    queryFn: () => supervisionApi.getMySupervisees(),
  });
}

/**
 * Hook for fetching pending requests (need to respond)
 */
export function usePendingSupervisionRequests() {
  return useQuery({
    queryKey: supervisionQueryKeys.pending(),
    queryFn: () => supervisionApi.getPending(),
  });
}

/**
 * Hook for fetching my pending requests (I initiated)
 */
export function useMyPendingSupervisionRequests() {
  return useQuery({
    queryKey: supervisionQueryKeys.myPending(),
    queryFn: () => supervisionApi.getMyPending(),
  });
}

/**
 * Hook for fetching signed agreements
 */
export function useSignedAgreements() {
  return useQuery({
    queryKey: supervisionQueryKeys.signedAgreements(),
    queryFn: () => supervisionApi.getSignedAgreements(),
  });
}

/**
 * Hook for fetching task definitions for a supervisee
 */
export function useSuperviseeTaskDefinitions(superviseeId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: supervisionQueryKeys.taskDefinitions(superviseeId),
    queryFn: () => supervisionApi.getTaskDefinitions(superviseeId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching supervisee tasks overview (supervisor view)
 */
export function useSuperviseeTasksOverview(superviseeId: number, date?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: supervisionQueryKeys.superviseeTasksOverview(superviseeId, date),
    queryFn: () => supervisionApi.getSuperviseeTasksOverview(superviseeId, date),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching my supervisor tasks (supervisee view)
 */
export function useMySupervisorTasks(date?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: supervisionQueryKeys.myTasks(date),
    queryFn: () => supervisionApi.getMyTasks(date),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for searching users for supervision
 */
export function useSearchSupervisionUsers(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supervision', 'search', query],
    queryFn: () => supervisionApi.searchUsers(query),
    enabled: (options?.enabled ?? true) && query.length > 0,
  });
}

// ==================== Mutations ====================

/**
 * Hook for initiating a supervision agreement
 */
export function useInitiateSupervision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: supervisionApi.initiate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for responding to a supervision agreement
 */
export function useRespondToSupervision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agreementId, accept }: { agreementId: number; accept: boolean }) =>
      supervisionApi.respond(agreementId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for canceling a supervision agreement
 */
export function useCancelSupervision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agreementId: number) => supervisionApi.cancel(agreementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for creating a task definition
 */
export function useCreateTaskDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateSupervisorTaskDefinitionRequest) =>
      supervisionApi.createTaskDefinition(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.taskDefinitions(variables.superviseeId) });
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.homeOverview() });
      // Also invalidate supervisee tasks overview since ONCE type creates a task immediately
      queryClient.invalidateQueries({
        queryKey: ['supervision', 'superviseeTasksOverview', variables.superviseeId],
      });
      // Invalidate myTasks for the supervisee (in case they're viewing their tasks)
      queryClient.invalidateQueries({ queryKey: ['supervision', 'myTasks'] });
    },
  });
}

/**
 * Hook for updating a task definition
 */
export function useUpdateTaskDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ definitionId, request }: { definitionId: number; request: UpdateSupervisorTaskDefinitionRequest }) =>
      supervisionApi.updateTaskDefinition(definitionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for deleting a task definition
 */
export function useDeleteTaskDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definitionId: number) => supervisionApi.deleteTaskDefinition(definitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for manually dispatching a task from a template
 */
export function useDispatchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definitionId: number) => supervisionApi.dispatchTask(definitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for adding a note to a task (supervisor action)
 */
export function useAddTaskNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, note }: { taskId: number; note: string }) =>
      supervisionApi.addTaskNote(taskId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for starting a supervisor task (supervisee action)
 */
export function useStartSupervisorTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => supervisionApi.startTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for updating task progress (supervisee action)
 */
export function useUpdateSupervisorTaskProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, actualValue }: { taskId: number; actualValue: number }) =>
      supervisionApi.updateTaskProgress(taskId, actualValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for completing a supervisor task (supervisee action)
 */
export function useCompleteSupervisorTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, actualValue }: { taskId: number; actualValue?: number }) =>
      supervisionApi.completeTask(taskId, actualValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for abandoning a supervisor task (supervisee action)
 */
export function useAbandonSupervisorTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => supervisionApi.abandonTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for reviewing a supervisor task (supervisor approves or rejects)
 */
export function useReviewSupervisorTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ superviseeId, taskId, approved, rejectionReason }: {
      superviseeId: number;
      taskId: number;
      approved: boolean;
      rejectionReason?: string;
    }) => supervisionApi.reviewTask(superviseeId, taskId, approved, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}

/**
 * Hook for updating hygiene bypass approval (supervisor action)
 */
export function useUpdateHygieneBypassApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agreementId, bypass }: { agreementId: number; bypass: boolean }) =>
      supervisionApi.updateHygieneBypassApproval(agreementId, bypass),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.all });
    },
  });
}
