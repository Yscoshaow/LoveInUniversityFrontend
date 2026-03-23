import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asmrApi, musicApi } from '../lib/api';
import { queryKeys } from '../lib/query-client';

// ==================== asmr.one API hooks ====================

export function useAsmrWorks(params?: {
  page?: number; pageSize?: number; order?: string; sort?: string;
  subtitle?: number; tags?: number[];
}) {
  return useQuery({
    queryKey: queryKeys.music.works(params),
    queryFn: () => asmrApi.getWorks(params),
    placeholderData: (prev) => prev,
  });
}

export function useAsmrSearch(keyword: string, params?: {
  page?: number; pageSize?: number; order?: string; sort?: string; subtitle?: number;
}) {
  return useQuery({
    queryKey: queryKeys.music.search(keyword, params),
    queryFn: () => asmrApi.search(keyword, params),
    enabled: keyword.length > 0,
    placeholderData: (prev) => prev,
  });
}

// ── Infinite query variants for scroll-to-load-more ──

export function useAsmrWorksInfinite(params?: {
  pageSize?: number; order?: string; sort?: string;
  subtitle?: number; tags?: number[];
}, enabled = true) {
  const pageSize = params?.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ['music', 'worksInfinite', { ...params, pageSize }],
    queryFn: ({ pageParam }) => asmrApi.getWorks({ ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize: ps, totalCount } = lastPage.pagination;
      return currentPage * ps < totalCount ? currentPage + 1 : undefined;
    },
    enabled,
  });
}

export function useAsmrSearchInfinite(keyword: string, params?: {
  pageSize?: number; order?: string; sort?: string; subtitle?: number;
}) {
  const pageSize = params?.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ['music', 'searchInfinite', keyword, { ...params, pageSize }],
    queryFn: ({ pageParam }) => asmrApi.search(keyword, { ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize: ps, totalCount } = lastPage.pagination;
      return currentPage * ps < totalCount ? currentPage + 1 : undefined;
    },
    enabled: keyword.length > 0,
  });
}

export function useAsmrTagWorksInfinite(tagId: number | null, params?: {
  pageSize?: number; order?: string; sort?: string;
}) {
  const pageSize = params?.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ['music', 'tagWorksInfinite', tagId, { ...params, pageSize }],
    queryFn: ({ pageParam }) => asmrApi.getTagWorks(tagId!, { ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize: ps, totalCount } = lastPage.pagination;
      return currentPage * ps < totalCount ? currentPage + 1 : undefined;
    },
    enabled: tagId !== null,
  });
}

export function useAsmrVAWorksInfinite(vaId: string | null, params?: {
  pageSize?: number; order?: string; sort?: string;
}) {
  const pageSize = params?.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ['music', 'vaWorksInfinite', vaId, { ...params, pageSize }],
    queryFn: ({ pageParam }) => asmrApi.getVAWorks(vaId!, { ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize: ps, totalCount } = lastPage.pagination;
      return currentPage * ps < totalCount ? currentPage + 1 : undefined;
    },
    enabled: vaId !== null,
  });
}

export function useAsmrCircleWorksInfinite(circleId: number | null, params?: {
  pageSize?: number; order?: string; sort?: string;
}) {
  const pageSize = params?.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ['music', 'circleWorksInfinite', circleId, { ...params, pageSize }],
    queryFn: ({ pageParam }) => asmrApi.getCircleWorks(circleId!, { ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize: ps, totalCount } = lastPage.pagination;
      return currentPage * ps < totalCount ? currentPage + 1 : undefined;
    },
    enabled: circleId !== null,
  });
}

export function useAsmrWorkInfo(id: number | null) {
  return useQuery({
    queryKey: queryKeys.music.workInfo(id!),
    queryFn: () => asmrApi.getWorkInfo(id!),
    enabled: id !== null && id > 0,
  });
}

export function useAsmrTracks(id: number | null) {
  return useQuery({
    queryKey: queryKeys.music.tracks(id!),
    queryFn: () => asmrApi.getTracks(id!),
    enabled: id !== null && id > 0,
  });
}

export function useAsmrPopular() {
  return useQuery({
    queryKey: queryKeys.music.popular(),
    queryFn: () => asmrApi.getPopular(),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useAsmrTagWorks(tagId: number | null, params?: {
  page?: number; pageSize?: number; order?: string; sort?: string;
}) {
  return useQuery({
    queryKey: queryKeys.music.tagWorks(tagId!, params),
    queryFn: () => asmrApi.getTagWorks(tagId!, params),
    enabled: tagId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useAsmrVAWorks(vaId: string | null, params?: {
  page?: number; pageSize?: number; order?: string; sort?: string;
}) {
  return useQuery({
    queryKey: queryKeys.music.vaWorks(vaId!, params),
    queryFn: () => asmrApi.getVAWorks(vaId!, params),
    enabled: vaId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useAsmrCircleWorks(circleId: number | null, params?: {
  page?: number; pageSize?: number; order?: string; sort?: string;
}) {
  return useQuery({
    queryKey: queryKeys.music.circleWorks(circleId!, params),
    queryFn: () => asmrApi.getCircleWorks(circleId!, params),
    enabled: circleId !== null,
    placeholderData: (prev) => prev,
  });
}

// ==================== Backend music API hooks ====================

export function useMusicLikeCheck(workId: number | null) {
  return useQuery({
    queryKey: queryKeys.music.likeCheck(workId!),
    queryFn: () => musicApi.checkLike(workId!),
    enabled: workId !== null && workId > 0,
  });
}

export function useToggleMusicLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (asmrWorkId: number) => musicApi.toggleLike(asmrWorkId),
    onSuccess: (_data, asmrWorkId) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.likeCheck(asmrWorkId) });
      qc.invalidateQueries({ queryKey: queryKeys.music.likes() });
    },
  });
}

export function useMusicLikes() {
  return useQuery({
    queryKey: queryKeys.music.likes(),
    queryFn: () => musicApi.getLikes(100),
  });
}

export function useMusicProgress(workId: number | null) {
  return useQuery({
    queryKey: queryKeys.music.progress(workId!),
    queryFn: () => musicApi.getProgress(workId!),
    enabled: workId !== null && workId > 0,
  });
}

export function useSaveMusicProgress() {
  return useMutation({
    mutationFn: (params: { asmrWorkId: number; trackHash: string; currentTime: number; duration: number }) =>
      musicApi.saveProgress(params.asmrWorkId, params.trackHash, params.currentTime, params.duration),
  });
}

export function useMusicPlaylists() {
  return useQuery({
    queryKey: queryKeys.music.playlists(),
    queryFn: () => musicApi.getPlaylists(),
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; description?: string }) =>
      musicApi.createPlaylist(params.name, params.description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function usePlaylistItems(playlistId: number | null) {
  return useQuery({
    queryKey: queryKeys.music.playlistItems(playlistId!),
    queryFn: () => musicApi.getPlaylistItems(playlistId!),
    enabled: playlistId !== null,
  });
}

export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { playlistId: number; asmrWorkId: number }) =>
      musicApi.addToPlaylist(params.playlistId, params.asmrWorkId),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlistItems(params.playlistId) });
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function useRemoveFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { playlistId: number; asmrWorkId: number }) =>
      musicApi.removeFromPlaylist(params.playlistId, params.asmrWorkId),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlistItems(params.playlistId) });
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: number; name?: string; description?: string }) =>
      musicApi.updatePlaylist(params.id, params.name, params.description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => musicApi.deletePlaylist(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

// ==================== 歌单分享 hooks ====================

export function useSharePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: number) => musicApi.sharePlaylist(playlistId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function useUnsharePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: number) => musicApi.unsharePlaylist(playlistId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

export function useImportPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => musicApi.importPlaylist(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.playlists() });
    },
  });
}

// ==================== 稍后再听 hooks ====================

export function useWatchLaterPlaylist() {
  return useQuery({
    queryKey: queryKeys.music.watchLater(),
    queryFn: () => musicApi.getWatchLater(),
  });
}

export function useWatchLaterItems() {
  const { data: playlist } = useWatchLaterPlaylist();
  return useQuery({
    queryKey: queryKeys.music.watchLaterItems(),
    queryFn: () => musicApi.getPlaylistItems(playlist!.id),
    enabled: !!playlist,
  });
}

export function useAddToWatchLater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (asmrWorkId: number) => musicApi.addToWatchLater(asmrWorkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.watchLater() });
      qc.invalidateQueries({ queryKey: queryKeys.music.watchLaterItems() });
    },
  });
}

export function useRemoveFromWatchLater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (asmrWorkId: number) => musicApi.removeFromWatchLater(asmrWorkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.music.watchLater() });
      qc.invalidateQueries({ queryKey: queryKeys.music.watchLaterItems() });
    },
  });
}

// ==================== 播放历史 hooks ====================

export function useMusicHistory() {
  return useQuery({
    queryKey: queryKeys.music.history(),
    queryFn: () => musicApi.getHistory(50),
  });
}

// ==================== 随心听 hooks ====================

export function useRandomWork() {
  return useMutation({
    mutationFn: () => asmrApi.getWorks({ page: 1, pageSize: 1, order: 'betterRandom' }),
  });
}

// ==================== 目录浏览 hooks ====================

export function useMusicTags(params?: { search?: string; limit?: number; offset?: number; sort?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.music.tags(params),
    queryFn: () => musicApi.getTags(params),
    staleTime: 60 * 60 * 1000, // 1h — server caches daily
    enabled,
  });
}

export function useMusicCircles(params?: { search?: string; limit?: number; offset?: number; sort?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.music.circles(params),
    queryFn: () => musicApi.getCircles(params),
    staleTime: 60 * 60 * 1000, // 1h — server caches daily
    enabled,
  });
}

export function useMusicVAs(params?: { search?: string; limit?: number; offset?: number; sort?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.music.vas(params),
    queryFn: () => musicApi.getVAs(params),
    staleTime: 60 * 60 * 1000, // 1h — server caches daily
    enabled,
  });
}

// ==================== 关注系统 hooks ====================

export function useFollowedVAs() {
  return useQuery({
    queryKey: queryKeys.music.followedVAs(),
    queryFn: () => musicApi.getFollowedVAs(),
  });
}

export function useFollowedCircles() {
  return useQuery({
    queryKey: queryKeys.music.followedCircles(),
    queryFn: () => musicApi.getFollowedCircles(),
  });
}

export function useCheckFollowVA(vaId: string | null) {
  return useQuery({
    queryKey: queryKeys.music.followVACheck(vaId!),
    queryFn: () => musicApi.checkFollowVA(vaId!),
    enabled: vaId !== null && vaId.length > 0,
  });
}

export function useFollowVA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { vaId: string; vaName: string }) =>
      musicApi.followVA(params.vaId, params.vaName),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.followedVAs() });
      qc.invalidateQueries({ queryKey: queryKeys.music.followVACheck(params.vaId) });
    },
  });
}

export function useUnfollowVA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vaId: string) => musicApi.unfollowVA(vaId),
    onSuccess: (_data, vaId) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.followedVAs() });
      qc.invalidateQueries({ queryKey: queryKeys.music.followVACheck(vaId) });
    },
  });
}

export function useCheckFollowCircle(circleId: number | null) {
  return useQuery({
    queryKey: queryKeys.music.followCircleCheck(circleId!),
    queryFn: () => musicApi.checkFollowCircle(circleId!),
    enabled: circleId !== null && circleId > 0,
  });
}

export function useFollowCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { circleId: number; circleName: string }) =>
      musicApi.followCircle(params.circleId, params.circleName),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.followedCircles() });
      qc.invalidateQueries({ queryKey: queryKeys.music.followCircleCheck(params.circleId) });
    },
  });
}

export function useUnfollowCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (circleId: number) => musicApi.unfollowCircle(circleId),
    onSuccess: (_data, circleId) => {
      qc.invalidateQueries({ queryKey: queryKeys.music.followedCircles() });
      qc.invalidateQueries({ queryKey: queryKeys.music.followCircleCheck(circleId) });
    },
  });
}
