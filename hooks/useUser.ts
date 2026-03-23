import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userProfileApi, userStatsApi, itemsApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { UpdateProfileRequest, UpdateSettingsRequest } from '../lib/api';

/**
 * Hook for fetching current user profile
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      const data = await userProfileApi.getMe();
      return data.user;
    },
  });
}

/**
 * Hook for fetching user stats
 */
export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.user.stats(),
    queryFn: () => userStatsApi.getStats(),
  });
}

/**
 * Hook for fetching another user's public profile
 */
export function useUserProfile(userId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    queryFn: () => userProfileApi.getUser(userId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching user settings
 */
export function useUserSettings() {
  return useQuery({
    queryKey: ['user', 'settings'],
    queryFn: () => userProfileApi.getSettings(),
  });
}

/**
 * Hook for updating user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateProfileRequest) => userProfileApi.updateProfile(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

/**
 * Hook for updating user settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => userProfileApi.updateSettings(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'settings'] });
    },
  });
}

/**
 * Hook for fetching user's currency info
 */
export function useUserCurrency() {
  return useQuery({
    queryKey: ['user', 'currency'],
    queryFn: () => itemsApi.getCurrency(),
  });
}

/**
 * Hook for fetching user's inventory
 */
export function useUserInventory() {
  return useQuery({
    queryKey: queryKeys.items.my(),
    queryFn: () => itemsApi.getInventory(),
  });
}

/**
 * Hook for fetching user's equipped items
 */
export function useEquippedItems() {
  return useQuery({
    queryKey: ['items', 'equipped'],
    queryFn: () => itemsApi.getEquippedItems(),
  });
}

/**
 * Hook for fetching active item effects
 */
export function useActiveEffects() {
  return useQuery({
    queryKey: ['items', 'active-effects'],
    queryFn: () => itemsApi.getActiveEffects(),
  });
}
