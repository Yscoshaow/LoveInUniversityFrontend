import { QueryClient } from '@tanstack/react-query';

// Create a client with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache is kept for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Refetch on window focus (useful for mobile apps)
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// Query keys factory for type-safe and consistent query keys
export const queryKeys = {
  // Tasks
  tasks: {
    all: ['tasks'] as const,
    byDate: (date: string) => ['tasks', 'date', date] as const,
    today: () => ['tasks', 'today'] as const,
  },

  // Courses
  courses: {
    all: ['courses'] as const,
    withStatus: () => ['courses', 'withStatus'] as const,
    myProgress: () => ['courses', 'myProgress'] as const,
    detail: (id: number) => ['courses', 'detail', id] as const,
    tasks: (courseId: number) => ['courses', 'tasks', courseId] as const,
  },

  // Self Locks
  locks: {
    all: ['locks'] as const,
    my: () => ['locks', 'my'] as const,
    managed: () => ['locks', 'managed'] as const,
    detail: (id: number) => ['locks', 'detail', id] as const,
    public: () => ['locks', 'public'] as const,
    history: () => ['locks', 'history'] as const,
    timeHistory: (id: number) => ['locks', 'timeHistory', id] as const,
  },

  // Schedules
  schedules: {
    all: ['schedules'] as const,
    byDate: (date: string) => ['schedules', 'date', date] as const,
    byMonth: (year: number, month: number) => ['schedules', 'month', year, month] as const,
  },

  // User
  user: {
    me: () => ['user', 'me'] as const,
    stats: () => ['user', 'stats'] as const,
    profile: (id: number) => ['user', 'profile', id] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },

  // Items/Shop
  items: {
    all: ['items'] as const,
    shop: () => ['items', 'shop'] as const,
    inventory: () => ['items', 'inventory'] as const,
    equipped: () => ['items', 'equipped'] as const,
  },

  // Special Items
  specialItems: {
    all: ['specialItems'] as const,
    shop: () => ['specialItems', 'shop'] as const,
    inventory: () => ['specialItems', 'inventory'] as const,
  },

  // Behavior/Status
  behavior: {
    all: ['behavior'] as const,
    status: () => ['behavior', 'status'] as const,
    penalties: () => ['behavior', 'penalties'] as const,
  },

  // Posts/Community
  posts: {
    all: ['posts'] as const,
    detail: (id: number) => ['posts', 'detail', id] as const,
  },

  // Memory
  memories: {
    all: ['memories'] as const,
    my: () => ['memories', 'my'] as const,
    stats: () => ['memories', 'stats'] as const,
    detail: (id: number) => ['memories', 'detail', id] as const,
    bySchedule: (scheduleId: number) => ['memories', 'schedule', scheduleId] as const,
  },

  // Majors
  majors: {
    all: ['majors'] as const,
    withStatus: () => ['majors', 'withStatus'] as const,
    detail: (id: number) => ['majors', 'detail', id] as const,
    myProgress: () => ['majors', 'myProgress'] as const,
    history: () => ['majors', 'history'] as const,
  },

  // Schedule Sharing
  scheduleSharing: {
    participants: (scheduleId: number) => ['scheduleSharing', 'participants', scheduleId] as const,
    shared: () => ['scheduleSharing', 'shared'] as const,
    pending: () => ['scheduleSharing', 'pending'] as const,
  },

  // Foundation
  foundation: {
    overview: ['foundation', 'overview'] as const,
    myApplications: ['foundation', 'my-applications'] as const,
    allApplications: ['foundation', 'all-applications'] as const,
  },

  // Library/Books
  books: {
    all: ['books'] as const,
    list: (params?: { categoryId?: number; search?: string; page?: number }) =>
      ['books', 'list', params] as const,
    detail: (id: number) => ['books', 'detail', id] as const,
    myPurchases: () => ['books', 'myPurchases'] as const,
    categories: () => ['books', 'categories'] as const,
    series: (params?: { categoryId?: number; search?: string; page?: number }) =>
      ['books', 'series', params] as const,
    seriesDetail: (id: number) => ['books', 'seriesDetail', id] as const,
    recentlyRead: () => ['books', 'recentlyRead'] as const,
    myUploads: () => ['books', 'myUploads'] as const,
    mySeries: () => ['books', 'mySeries'] as const,
    pendingReviews: (params?: { page?: number }) => ['books', 'pendingReviews', params] as const,
    comments: (bookId: number) => ['books', 'comments', bookId] as const,
  },

  // Gallery
  gallery: {
    all: ['gallery'] as const,
    list: (params?: { search?: string; page?: number; sortBy?: string; authorId?: number }) => ['gallery', 'list', params] as const,
    detail: (id: number) => ['gallery', 'detail', id] as const,
    myUploads: () => ['gallery', 'myUploads'] as const,
    myPurchases: () => ['gallery', 'myPurchases'] as const,
  },

  // Stickers
  stickers: {
    activePacks: ['stickers', 'activePacks'] as const,
  },

  // Profile Board
  board: {
    byUser: (userId: number) => ['board', userId] as const,
    my: () => ['board', 'my'] as const,
    widgetCourses: (userId: number) => ['board', 'widget-courses', userId] as const,
    widgetTasks: (userId: number) => ['board', 'widget-tasks', userId] as const,
  },

  // Cinema
  cinema: {
    all: ['cinema'] as const,
    list: (params?: { search?: string; page?: number; sortBy?: string; authorId?: number }) => ['cinema', 'list', params] as const,
    detail: (id: number) => ['cinema', 'detail', id] as const,
    myUploads: () => ['cinema', 'myUploads'] as const,
    myPurchases: () => ['cinema', 'myPurchases'] as const,
  },

  // Music Room
  music: {
    works: (params?: Record<string, unknown>) => ['music', 'works', params] as const,
    search: (keyword: string, params?: Record<string, unknown>) => ['music', 'search', keyword, params] as const,
    workInfo: (id: number) => ['music', 'workInfo', id] as const,
    tracks: (id: number) => ['music', 'tracks', id] as const,
    tagWorks: (tagId: number, params?: Record<string, unknown>) => ['music', 'tagWorks', tagId, params] as const,
    vaWorks: (vaId: string, params?: Record<string, unknown>) => ['music', 'vaWorks', vaId, params] as const,
    circleWorks: (circleId: number, params?: Record<string, unknown>) => ['music', 'circleWorks', circleId, params] as const,
    popular: () => ['music', 'popular'] as const,
    likes: () => ['music', 'likes'] as const,
    likeCheck: (workId: number) => ['music', 'likeCheck', workId] as const,
    progress: (workId: number) => ['music', 'progress', workId] as const,
    playlists: () => ['music', 'playlists'] as const,
    playlistItems: (id: number) => ['music', 'playlistItems', id] as const,
    watchLater: () => ['music', 'watchLater'] as const,
    watchLaterItems: () => ['music', 'watchLaterItems'] as const,
    followedVAs: () => ['music', 'followedVAs'] as const,
    followedCircles: () => ['music', 'followedCircles'] as const,
    followVACheck: (vaId: string) => ['music', 'followVACheck', vaId] as const,
    followCircleCheck: (circleId: number) => ['music', 'followCircleCheck', circleId] as const,
    history: () => ['music', 'history'] as const,
    randomWork: () => ['music', 'randomWork'] as const,
    tags: (params?: Record<string, unknown>) => ['music', 'tags', params] as const,
    circles: (params?: Record<string, unknown>) => ['music', 'circles', params] as const,
    vas: (params?: Record<string, unknown>) => ['music', 'vas', params] as const,
  },
};
