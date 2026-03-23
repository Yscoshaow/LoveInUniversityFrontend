import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { alumniChatApi } from '../lib/api';
import type {
  CreateCharacterCardRequest,
  UpdateCharacterCardRequest,
  CreateConversationRequest,
  UpdateConversationRequest,
  CreateWorldBookEntryRequest,
  UpdateWorldBookEntryRequest,
} from '../types';

// ==================== 角色卡 ====================

export function useMyCards() {
  return useQuery({
    queryKey: ['alumni-chat', 'my-cards'],
    queryFn: () => alumniChatApi.getMyCards(),
  });
}

export function usePurchasedCards() {
  return useQuery({
    queryKey: ['alumni-chat', 'purchased-cards'],
    queryFn: () => alumniChatApi.getPurchasedCards(),
  });
}

export function useCardDetail(cardId: number | null) {
  return useQuery({
    queryKey: ['alumni-chat', 'card', cardId],
    queryFn: () => alumniChatApi.getCardDetail(cardId!),
    enabled: !!cardId,
  });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCharacterCardRequest) => alumniChatApi.createCard(request),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-chat', 'my-cards'] }); },
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateCharacterCardRequest }) =>
      alumniChatApi.updateCard(id, request),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'my-cards'] });
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'card', id] });
    },
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alumniChatApi.deleteCard(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-chat', 'my-cards'] }); },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, formData }: { cardId: number; formData: FormData }) =>
      alumniChatApi.uploadAvatar(cardId, formData),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'card', cardId] });
    },
  });
}

export function useUploadImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, formData }: { cardId: number; formData: FormData }) =>
      alumniChatApi.uploadImages(cardId, formData),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'card', cardId] });
    },
  });
}

export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, imageId }: { cardId: number; imageId: number }) =>
      alumniChatApi.deleteImage(cardId, imageId),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'card', cardId] });
    },
  });
}

// ==================== 世界书 ====================

export function useWorldBook(cardId: number | null) {
  return useQuery({
    queryKey: ['alumni-chat', 'world-book', cardId],
    queryFn: () => alumniChatApi.getWorldBook(cardId!),
    enabled: !!cardId,
  });
}

export function useCreateWorldBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, request }: { cardId: number; request: CreateWorldBookEntryRequest }) =>
      alumniChatApi.createWorldBookEntry(cardId, request),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'world-book', cardId] });
    },
  });
}

export function useUpdateWorldBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, entryId, request }: { cardId: number; entryId: number; request: UpdateWorldBookEntryRequest }) =>
      alumniChatApi.updateWorldBookEntry(cardId, entryId, request),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'world-book', cardId] });
    },
  });
}

export function useDeleteWorldBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, entryId }: { cardId: number; entryId: number }) =>
      alumniChatApi.deleteWorldBookEntry(cardId, entryId),
    onSuccess: (_, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'world-book', cardId] });
    },
  });
}

// ==================== 市场 ====================

export function useMarketplace(params?: { search?: string; tags?: string; sortBy?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['alumni-chat', 'marketplace', params],
    queryFn: () => alumniChatApi.browseMarketplace(params),
  });
}

export function useMarketplaceInfinite(params?: { search?: string; tags?: string; sortBy?: string; pageSize?: number }) {
  return useInfiniteQuery({
    queryKey: ['alumni-chat', 'marketplace-infinite', params?.search, params?.tags, params?.sortBy],
    queryFn: ({ pageParam = 1 }) =>
      alumniChatApi.browseMarketplace({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / (params?.pageSize || 20));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

export function useMarketplaceDetail(id: number | null) {
  return useQuery({
    queryKey: ['alumni-chat', 'marketplace-detail', id],
    queryFn: () => alumniChatApi.getMarketplaceDetail(id!),
    enabled: !!id,
  });
}

export function usePurchaseCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alumniChatApi.purchaseCard(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'marketplace-detail', id] });
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'purchased-cards'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useToggleCardLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alumniChatApi.toggleLike(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'marketplace-detail', id] });
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'marketplace'] });
    },
  });
}

export function usePublishCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, price }: { cardId: number; price?: number }) =>
      alumniChatApi.publishCard(cardId, price),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'my-cards'] });
    },
  });
}

// ==================== 聊天 ====================

export function useMyConversations() {
  return useQuery({
    queryKey: ['alumni-chat', 'conversations'],
    queryFn: () => alumniChatApi.getMyConversations(),
  });
}

export function useConversationDetail(id: number | null) {
  return useQuery({
    queryKey: ['alumni-chat', 'conversation', id],
    queryFn: () => alumniChatApi.getConversationDetail(id!),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateConversationRequest) => alumniChatApi.createConversation(request),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversations'] }); },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateConversationRequest }) =>
      alumniChatApi.updateConversation(id, request),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversation', id] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alumniChatApi.deleteConversation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversations'] }); },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ convId, msgId }: { convId: number; msgId: number }) =>
      alumniChatApi.deleteMessage(convId, msgId),
    onSuccess: (_, { convId }) => {
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversation', convId] });
    },
  });
}

// ==================== AI 模型 ====================

export function useAiModels() {
  return useQuery({
    queryKey: ['alumni-chat', 'models'],
    queryFn: () => alumniChatApi.getModels(),
  });
}
