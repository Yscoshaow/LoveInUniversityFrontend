import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, adminBooksApi, stickerApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import type {
  UserUploadBookRequest,
  CreateBookSeriesRequest,
  UpdateBookRequest,
  ReviewBookRequest,
  CreateBookCommentRequest,
} from '../types';

export function useBooks(params?: { categoryId?: number; search?: string; excludeSeriesBooks?: boolean; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.books.list(params),
    queryFn: () => booksApi.getBooks(params),
  });
}

export function useBookCategories() {
  return useQuery({
    queryKey: queryKeys.books.categories(),
    queryFn: () => booksApi.getCategories(),
  });
}

export function useBookDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.books.detail(id!),
    queryFn: () => booksApi.getBookDetail(id!),
    enabled: id !== null,
  });
}

export function useMyBookPurchases() {
  return useQuery({
    queryKey: queryKeys.books.myPurchases(),
    queryFn: () => booksApi.getMyPurchases(),
  });
}

export function usePurchaseBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) => booksApi.purchaseBook(bookId),
    onSuccess: (_, bookId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(bookId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.books.myPurchases() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

// ==================== 系列 ====================

export function useBookSeries(params?: { categoryId?: number; search?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.books.series(params),
    queryFn: () => booksApi.getSeries(params),
  });
}

export function useBookSeriesDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.books.seriesDetail(id!),
    queryFn: () => booksApi.getSeriesDetail(id!),
    enabled: id !== null,
  });
}

// ==================== 阅读进度 ====================

export function useRecentlyRead() {
  return useQuery({
    queryKey: queryKeys.books.recentlyRead(),
    queryFn: () => booksApi.getRecentlyRead(),
  });
}

export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, scrollPosition }: { bookId: number; scrollPosition: number }) =>
      booksApi.updateReadingProgress(bookId, scrollPosition),
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.recentlyRead() });
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(bookId) });
    },
  });
}

// ==================== 用户上传 ====================

export function useMyUploads() {
  return useQuery({
    queryKey: queryKeys.books.myUploads(),
    queryFn: () => booksApi.getMyUploads(),
  });
}

export function useMySeries() {
  return useQuery({
    queryKey: queryKeys.books.mySeries(),
    queryFn: () => booksApi.getMySeries(),
  });
}

export function useUploadBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UserUploadBookRequest) => booksApi.uploadBook(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.myUploads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateBookSeriesRequest) => booksApi.createSeries(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.mySeries() });
    },
  });
}

export function useUpdateMyBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateBookRequest }) =>
      booksApi.updateMyBook(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.myUploads() });
    },
  });
}

export function useDeleteMyBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => booksApi.deleteMyBook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.myUploads() });
    },
  });
}

// ==================== 图书评论 ====================

export function useBookComments(bookId: number | null, limit = 20, offset = 0) {
  return useQuery({
    queryKey: [...queryKeys.books.comments(bookId!), limit, offset],
    queryFn: () => booksApi.getComments(bookId!, limit, offset),
    enabled: bookId !== null,
  });
}

export function useCreateBookComment(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateBookCommentRequest) => booksApi.createComment(bookId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.comments(bookId) });
    },
  });
}

export function useDeleteBookComment(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => booksApi.deleteComment(bookId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.comments(bookId) });
    },
  });
}

export function useToggleBookCommentLike(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => booksApi.toggleCommentLike(bookId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.comments(bookId) });
    },
  });
}

export function useToggleBookCommentReaction(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, stickerId }: { commentId: number; stickerId: number }) =>
      stickerApi.toggleBookReaction(commentId, stickerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.comments(bookId) });
    },
  });
}

// ==================== 管理员审核 ====================

export function usePendingReviews(params?: { page?: number }) {
  return useQuery({
    queryKey: queryKeys.books.pendingReviews(params),
    queryFn: () => adminBooksApi.getPendingReviews({ ...params }),
  });
}

export function useReviewBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: ReviewBookRequest }) =>
      adminBooksApi.reviewBook(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
    },
  });
}
