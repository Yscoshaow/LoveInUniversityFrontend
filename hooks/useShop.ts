import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, specialItemsApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type { PurchaseItemRequest, PurchaseSpecialItemRequest, GiftItemRequest, UseItemRequest } from '../types';

/**
 * Hook for fetching shop items
 */
export function useShopItems() {
  return useQuery({
    queryKey: queryKeys.items.shop(),
    queryFn: () => itemsApi.getShopItems(),
  });
}

/**
 * Hook for fetching user's inventory
 */
export function useInventory() {
  return useQuery({
    queryKey: queryKeys.items.inventory(),
    queryFn: () => itemsApi.getInventory(),
  });
}

/**
 * Hook for fetching user's equipped items
 */
export function useEquippedItems() {
  return useQuery({
    queryKey: queryKeys.items.equipped(),
    queryFn: () => itemsApi.getEquippedItems(),
  });
}

/**
 * Hook for purchasing an item
 */
export function usePurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PurchaseItemRequest) => itemsApi.purchaseItem(request),
    onSuccess: () => {
      // Refresh inventory (backpack)
      queryClient.invalidateQueries({ queryKey: queryKeys.items.inventory() });
      // Refresh user stats (money/currency)
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

/**
 * Hook for using an item
 */
export function useUseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UseItemRequest) => itemsApi.useItem(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.inventory() });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.equipped() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

/**
 * Hook for gifting an item
 */
export function useGiftItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GiftItemRequest) => itemsApi.giftItem(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.inventory() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

// === Special Items ===

/**
 * Hook for fetching special items shop
 */
export function useSpecialShopItems() {
  return useQuery({
    queryKey: queryKeys.specialItems.shop(),
    queryFn: () => specialItemsApi.getShopItems(),
  });
}

/**
 * Hook for fetching special items inventory
 */
export function useSpecialInventory() {
  return useQuery({
    queryKey: queryKeys.specialItems.inventory(),
    queryFn: () => specialItemsApi.getInventory(),
  });
}

/**
 * Hook for purchasing a special item
 */
export function usePurchaseSpecialItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PurchaseSpecialItemRequest) => specialItemsApi.purchaseItem(request),
    onSuccess: () => {
      // Refresh special items inventory
      queryClient.invalidateQueries({ queryKey: queryKeys.specialItems.inventory() });
      // Refresh user stats (money/currency)
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

/**
 * Hook for using master key on a lock
 */
export function useUseMasterKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lockId: number) => specialItemsApi.useMasterKey(lockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.specialItems.inventory() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

export function useUseKeyBox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lockId, keyholderId }: { lockId: number; keyholderId: number }) =>
      specialItemsApi.useKeyBox(lockId, keyholderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.specialItems.inventory() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}
