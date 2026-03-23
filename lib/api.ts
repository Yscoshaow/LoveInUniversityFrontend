// API client for backend communication

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isCapacitorNative } from './environment';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1';

// Native token bridge for Android widget
interface TokenBridgePlugin {
  setToken(options: { token: string }): Promise<void>;
  clearToken(): Promise<void>;
}

const TokenBridge = Capacitor.isNativePlatform()
  ? registerPlugin<TokenBridgePlugin>('TokenBridge')
  : null;

// Native music bridge for Android widget
interface MusicBridgePlugin {
  updateState(options: {
    trackHash: string;
    trackTitle: string;
    workTitle: string;
    coverUrl: string;
    playing: boolean;
    currentTime: number;
    duration: number;
    currentIndex: number;
    playlistSize: number;
    subtitleText?: string;
  }): Promise<void>;
  clearState(): Promise<void>;
  addListener(eventName: 'musicCommand', cb: (data: { command: string }) => void): Promise<{ remove: () => void }>;
}

export const MusicBridge: MusicBridgePlugin | null = Capacitor.isNativePlatform()
  ? registerPlugin<MusicBridgePlugin>('MusicBridge')
  : null;

// Store for the Telegram init data
let telegramInitData: string | null = null;

export const setTelegramInitData = (initData: string) => {
  telegramInitData = initData;
};

export const getTelegramInitData = () => telegramInitData;

// JWT token storage (for browser mode)
let jwtToken: string | null = null;
let nativeTokenSynced = false;

export const setJwtToken = (token: string) => {
  jwtToken = token;
  try { localStorage.setItem('jwt_token', token); } catch {}
  // Push to native SharedPreferences for Android widget
  TokenBridge?.setToken({ token }).catch(() => {});
};

export const getJwtToken = (): string | null => {
  if (!jwtToken) {
    try { jwtToken = localStorage.getItem('jwt_token'); } catch {}
  }
  // One-time sync: push existing localStorage token to native SharedPreferences
  if (jwtToken && !nativeTokenSynced && TokenBridge) {
    nativeTokenSynced = true;
    TokenBridge.setToken({ token: jwtToken }).catch(() => {});
  }
  return jwtToken;
};

export const clearJwtToken = () => {
  jwtToken = null;
  try { localStorage.removeItem('jwt_token'); } catch {}
  // Clear from native SharedPreferences
  TokenBridge?.clearToken().catch(() => {});
};

// Auth headers for multipart uploads (no Content-Type — browser sets boundary automatically)
function getUploadHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (telegramInitData) {
    headers['X-Telegram-Init-Data'] = telegramInitData;
  } else {
    const token = getJwtToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Generic fetch wrapper with auth header
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Prefer Telegram initData if available (Mini App mode)
  if (telegramInitData) {
    headers['X-Telegram-Init-Data'] = telegramInitData;
  } else {
    // Otherwise use JWT token (browser mode)
    const token = getJwtToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 — clear JWT and let auth context handle redirect
  if (response.status === 401) {
    clearJwtToken();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// User type matching backend model
export interface User {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean;
  photoUrl: string | null;
  bio: string | null;  // 个人简介
  tags: string[];      // 自我标签
  allowTelegramContact: boolean;  // 允许他人通过Telegram联系
  credits: number;
  campusPoints: number;
  enrollmentCompleted: boolean;
  isAdmin: boolean;  // 是否是管理员
  isBanned: boolean;  // 是否被封禁
  bannedAt: string | null;  // 封禁时间
  bannedReason: string | null;  // 封禁原因
  statusText: string | null;  // 个人状态文字
  statusImageKey: string | null;  // 个人状态图片key
  statusUpdatedAt: string | null;  // 状态更新时间
  createdAt: string;
  updatedAt: string;
}

// User with RBAC roles/permissions (returned by /auth/me, /auth/telegram, /users/me)
export interface UserWithRoles {
  user: User;
  permissions: string[];
  roleNames: string[];
}

// User settings type
export interface UserSettings {
  allowTelegramContact: boolean;
  allowSupervisionRequest: boolean;
  hideFromLeaderboard: boolean;
  timezone: string;
  dayStartOffsetHours: number;  // -12 to +12, 用于夜猫子调整一天的开始时间
  homepageShortcuts: string[];  // 首页快捷方式（3个）
}

// Update settings request
export interface UpdateSettingsRequest {
  allowTelegramContact?: boolean;
  allowSupervisionRequest?: boolean;
  hideFromLeaderboard?: boolean;
  timezone?: string;
  dayStartOffsetHours?: number;  // -12 to +12
  homepageShortcuts?: string[];  // 首页快捷方式（3个）
}

// Update profile request
export interface UpdateProfileRequest {
  bio?: string;
  tags?: string[];
}

// Auth API
export const authApi = {
  /**
   * Authenticate with Telegram credentials and get/create user
   */
  loginWithTelegram: () =>
    fetchWithAuth<UserWithRoles>('/auth/telegram', { method: 'POST' }),

  /**
   * Get current user info
   */
  getCurrentUser: () =>
    fetchWithAuth<UserWithRoles>('/auth/me'),

  /**
   * Complete enrollment process
   * @param timezone - User's detected timezone (e.g., "Asia/Shanghai")
   */
  completeEnrollment: (timezone?: string) =>
    fetchWithAuth<{ message: string; user: User }>('/auth/complete-enrollment', {
      method: 'POST',
      body: JSON.stringify({ timezone }),
    }),

  /** Telegram Login Widget auth (browser mode) */
  loginWithTelegramWidget: (data: {
    id: number; firstName: string; lastName?: string; username?: string;
    photoUrl?: string; authDate: number; hash: string;
  }) =>
    fetchWithAuth<{ token: string; user: User; permissions: string[]; roleNames: string[] }>('/auth/telegram-login-widget', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Refresh JWT token */
  refreshToken: () =>
    fetchWithAuth<{ token: string }>('/auth/refresh', { method: 'POST' }),
};

// Types from types.ts
import type {
  ShopItem,
  UserItem,
  Item,
  UserCurrency,
  PurchaseItemRequest,
  GiftItemRequest,
  CampusTask,
  CampusTaskSummary,
  CampusTaskStatus,
  TaskSubmission,
  TaskComment,
  TaskTip,
  SubmissionStatus,
  CreateCampusTaskRequest,
  UpdateCampusTaskRequest,
  SubmitTaskRequest,
  ReviewSubmissionRequest,
  PostCommentRequest,
  TipTaskRequest,
  Schedule,
  DailyScheduleOverview,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  SelfLockSummary,
  SelfLockDetail,
  CreateSelfLockRequest,
  SelfLockStats,
  DailyTaskOverview,
  UserTaskDetail,
  CourseSummaryBackend,
  UserCourseProgress,
  EnrollCourseRequest,
  UserEnrollment,
  UserPunishmentDisplay,
  DrawPunishmentResult,
  UserPointsInfo,
  UserStatsDisplay,
  // V2 Lock Types
  LockKeyholder,
  TakeoverRequestInfo,
  AddKeyholderRequest,
  UpdateKeyholderRequest,
  ManagedLockSummary,
  LockExtensionData,
  ExtensionType,
  ExtensionConfigRequest,
  ExtensionTriggerResult,
  CoinTossInfo,
  CoinTossResult,
  LockTask,
  CreateLockTaskRequest,
  SubmitLockTaskProofRequest,
  ReviewLockTaskRequest,
  NotificationItem,
  NotificationSettings,
  UpdateNotificationSettingsRequest,
  NotificationStats,
  FreezeRequest,
  UpdateLockSettingsRequest,
  LockComment,
  PostLockCommentRequest,
  SelfLockBackend,
  HygieneOpeningResponse,
  HygieneImageHistoryItem,
  SpecialShopItem,
  UserSpecialItem,
  PurchaseSpecialItemRequest,
  SelfLock,
  // User search types
  UserSearchResult,
  // Supervision types
  SupervisionAgreement,
  SignedAgreementItem,
  InitiateSupervisionRequest,
  RespondSupervisionRequest,
  SupervisionSearchResult,
  SupervisionSummary,
  // Memory and Schedule Sharing types
  MemorySummary,
  MemoryDetail,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  InviteToMemoryRequest,
  MemoryStats,
  ScheduleParticipant,
  SharedScheduleDetail,
  ScheduleInvitation,
  ShareScheduleRequest,
  JoinByShareCodeRequest,
  RespondToInvitationRequest,
  PublishScheduleRequest,
  ShareCodeResponse,
  SharedScheduleListResponse,
  PendingInvitationsResponse,
  UpdateParticipantPermissionRequest,
  InvitedUser,
  // Follow types
  FollowStats,
  FollowUserItem,
  FollowListResponse,
  FollowResponse,
  FollowStatusResponse,
  // Unlock Request types
  UnlockRequest,
  RespondUnlockRequestData,
  UnlockRequestResponse,
  PendingUnlockRequestsResponse,
  // Leaderboard types
  LeaderboardResponse,
  // Punishment room types
  PunishmentRoomRollResult,
  // Task Request types
  TaskRequestSummary,
  TaskRequestDetail,
  TaskRequestProposalDetail,
  TaskRequestStatus,
  CreateTaskRequestRequest,
  SubmitProposalRequest,
  SelectWinnerRequest,
  PauseCoursesResponse,
} from '../types';

export interface ActiveEffectsResponse {
  activeItems: UserItem[];
  buffs: Array<{
    id: number;
    name: string;
    buffType: string;
    value: number;
    description: string | null;
  }>;
}

export interface ItemTransaction {
  id: number;
  itemId: number;
  itemName: string;
  fromUserId: number | null;
  fromUsername: string | null;
  toUserId: number;
  toUsername: string | null;
  quantity: number;
  transactionType: string;
  pricePaid: number;
  createdAt: string;
}

// Items API
export const itemsApi = {
  /**
   * Get shop items list
   */
  getShopItems: () =>
    fetchWithAuth<ShopItem[]>('/items/shop'),

  /**
   * Get item details by ID
   */
  getItem: (itemId: number) =>
    fetchWithAuth<Item>(`/items/${itemId}`),

  /**
   * Purchase an item
   */
  purchaseItem: (request: PurchaseItemRequest) =>
    fetchWithAuth<{ message: string; item: UserItem }>('/items/purchase', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Gift an item to another user
   */
  giftItem: (request: GiftItemRequest) =>
    fetchWithAuth<{ message: string; transaction: ItemTransaction }>('/items/gift', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Use an item
   */
  useItem: (itemId: number) =>
    fetchWithAuth<{ message: string; item: UserItem }>(`/items/${itemId}/use`, {
      method: 'POST',
    }),

  /**
   * Get user's inventory
   */
  getInventory: () =>
    fetchWithAuth<UserItem[]>('/items/inventory'),

  /**
   * Get user's equipped items
   */
  getEquippedItems: () =>
    fetchWithAuth<UserItem[]>('/items/equipped'),

  /**
   * Get active item effects
   */
  getActiveEffects: () =>
    fetchWithAuth<ActiveEffectsResponse>('/items/active-effects'),

  /**
   * Get user's currency info
   */
  getCurrency: () =>
    fetchWithAuth<UserCurrency>('/items/currency'),

  /**
   * Get user's transaction history
   */
  getTransactions: (limit?: number) =>
    fetchWithAuth<ItemTransaction[]>(`/items/transactions${limit ? `?limit=${limit}` : ''}`),
};

// Special Items API (Fixed items like Master Key)
export const specialItemsApi = {
  /**
   * Get special items shop list
   */
  getShopItems: () =>
    fetchWithAuth<SpecialShopItem[]>('/special-items/shop'),

  /**
   * Purchase a special item
   */
  purchaseItem: (request: PurchaseSpecialItemRequest) =>
    fetchWithAuth<{ message: string; item: UserSpecialItem }>('/special-items/purchase', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Get user's special items inventory
   */
  getInventory: () =>
    fetchWithAuth<UserSpecialItem[]>('/special-items/inventory'),

  /**
   * Use Master Key to unlock a lock
   */
  useMasterKey: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLock }>('/special-items/master-key/use', {
      method: 'POST',
      body: JSON.stringify({ lockId }),
    }),

  useKeyBox: (lockId: number, keyholderId: number) =>
    fetchWithAuth<{ message: string; lockId: number; keyholderId: number }>('/special-items/key-box/use', {
      method: 'POST',
      body: JSON.stringify({ lockId, keyholderId }),
    }),
};

// Campus Tasks API
export const campusTasksApi = {
  /**
   * Get tasks list (public)
   */
  getTasks: (status?: CampusTaskStatus, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return fetchWithAuth<CampusTaskSummary[]>(`/campus-tasks${query ? `?${query}` : ''}`);
  },

  /**
   * Get my created tasks
   */
  getMyTasks: (limit?: number) =>
    fetchWithAuth<CampusTaskSummary[]>(`/campus-tasks/my${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get my submissions
   */
  getMySubmissions: (limit?: number) =>
    fetchWithAuth<TaskSubmission[]>(`/campus-tasks/my-submissions${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get pending reviews (submissions to my tasks)
   */
  getPendingReviews: (limit?: number) =>
    fetchWithAuth<TaskSubmission[]>(`/campus-tasks/pending-reviews${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get task detail
   */
  getTask: (taskId: number) =>
    fetchWithAuth<CampusTask>(`/campus-tasks/${taskId}`),

  /**
   * Create a new task
   */
  createTask: (request: CreateCampusTaskRequest) =>
    fetchWithAuth<CampusTask>('/campus-tasks', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update a task
   */
  updateTask: (taskId: number, request: UpdateCampusTaskRequest) =>
    fetchWithAuth<CampusTask>(`/campus-tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a task
   */
  deleteTask: (taskId: number) =>
    fetchWithAuth<{ message: string }>(`/campus-tasks/${taskId}`, {
      method: 'DELETE',
    }),

  /**
   * Upload task cover image
   */
  uploadCoverImage: async (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/campus-tasks/${taskId}/cover`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  // ==================== Submissions ====================

  /**
   * Submit to a task
   */
  submitTask: (taskId: number, request: SubmitTaskRequest) =>
    fetchWithAuth<TaskSubmission>(`/campus-tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Get task submissions (for task creator)
   */
  getTaskSubmissions: (taskId: number, status?: SubmissionStatus) =>
    fetchWithAuth<TaskSubmission[]>(`/campus-tasks/${taskId}/submissions${status ? `?status=${status}` : ''}`),

  /**
   * Upload submission image
   */
  uploadSubmissionImage: async (submissionId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/campus-tasks/submissions/${submissionId}/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  /**
   * Review a submission (approve/reject)
   */
  reviewSubmission: (submissionId: number, request: ReviewSubmissionRequest) =>
    fetchWithAuth<{ message: string; submission: TaskSubmission }>(`/campus-tasks/submissions/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Cancel my submission
   */
  cancelSubmission: (submissionId: number) =>
    fetchWithAuth<{ message: string }>(`/campus-tasks/submissions/${submissionId}`, {
      method: 'DELETE',
    }),

  // ==================== Comments ====================

  /**
   * Get task comments
   */
  getComments: (taskId: number, limit?: number) =>
    fetchWithAuth<TaskComment[]>(`/campus-tasks/${taskId}/comments${limit ? `?limit=${limit}` : ''}`),

  /**
   * Post a comment
   */
  postComment: (taskId: number, request: PostCommentRequest) =>
    fetchWithAuth<TaskComment>(`/campus-tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a comment
   */
  deleteComment: (commentId: number) =>
    fetchWithAuth<{ message: string }>(`/campus-tasks/comments/${commentId}`, {
      method: 'DELETE',
    }),

  // ==================== Tips ====================

  /**
   * Tip a task creator
   */
  tipTask: (taskId: number, request: TipTaskRequest) =>
    fetchWithAuth<{ message: string; tip: TaskTip }>(`/campus-tasks/${taskId}/tip`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Get task tips
   */
  getTaskTips: (taskId: number, limit?: number) =>
    fetchWithAuth<TaskTip[]>(`/campus-tasks/${taskId}/tips${limit ? `?limit=${limit}` : ''}`),

  // ==================== Favorites ====================

  /**
   * Toggle favorite status for a task
   */
  toggleFavorite: (taskId: number) =>
    fetchWithAuth<{ message: string; isFavorited: boolean }>(`/campus-tasks/${taskId}/favorite`, {
      method: 'POST',
    }),

  /**
   * Get my favorite tasks
   */
  getMyFavorites: (limit?: number) =>
    fetchWithAuth<CampusTaskSummary[]>(`/campus-tasks/my-favorites${limit ? `?limit=${limit}` : ''}`),

  /**
   * Search tasks by keyword
   */
  searchTasks: (keyword: string, status?: CampusTaskStatus, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    params.append('q', keyword);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return fetchWithAuth<CampusTaskSummary[]>(`/campus-tasks/search?${params.toString()}`);
  },
};

// User Tasks API (course-related tasks)
export const userTasksApi = {
  /**
   * Get today's task overview
   */
  getTodayOverview: () =>
    fetchWithAuth<DailyTaskOverview>('/tasks/today'),

  /**
   * Get task overview for a specific date
   */
  getDateOverview: (date: string) =>
    fetchWithAuth<DailyTaskOverview>(`/tasks/date/${date}`),

  /**
   * Start a task
   */
  startTask: (taskId: number) =>
    fetchWithAuth<UserTaskDetail>(`/tasks/${taskId}/start`, {
      method: 'POST',
    }),

  /**
   * Update task progress
   */
  updateProgress: (taskId: number, actualValue: number) =>
    fetchWithAuth<UserTaskDetail>(`/tasks/${taskId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ taskId, actualValue }),
    }),

  /**
   * Complete a task
   */
  completeTask: (taskId: number, actualValue?: number) =>
    fetchWithAuth<UserTaskDetail>(`/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ taskId, actualValue }),
    }),

  /**
   * Abandon a task
   */
  abandonTask: (taskId: number) =>
    fetchWithAuth<UserTaskDetail>(`/tasks/${taskId}/abandon`, {
      method: 'POST',
    }),
};

// Schedule API
export const scheduleApi = {
  /**
   * Get today's schedule overview
   */
  getTodayOverview: () =>
    fetchWithAuth<DailyScheduleOverview>('/schedules/today'),

  /**
   * Get schedule overview for a specific date
   */
  getDateOverview: (date: string) =>
    fetchWithAuth<DailyScheduleOverview>(`/schedules/date/${date}`),

  /**
   * Get upcoming schedules
   */
  getUpcoming: (limit?: number) =>
    fetchWithAuth<Schedule[]>(`/schedules/upcoming${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get schedule detail
   */
  getSchedule: (scheduleId: number) =>
    fetchWithAuth<Schedule>(`/schedules/${scheduleId}`),

  /**
   * Create a new schedule
   */
  createSchedule: (request: CreateScheduleRequest) =>
    fetchWithAuth<Schedule>('/schedules', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update a schedule
   */
  updateSchedule: (scheduleId: number, request: UpdateScheduleRequest) =>
    fetchWithAuth<Schedule>(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a schedule
   */
  deleteSchedule: (scheduleId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}`, {
      method: 'DELETE',
    }),

  /**
   * Mark schedule as completed
   */
  markAsCompleted: (scheduleId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}/complete`, {
      method: 'POST',
    }),

  /**
   * Cancel a schedule
   */
  cancelSchedule: (scheduleId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}/cancel`, {
      method: 'POST',
    }),
};

// Self Lock API
export const selfLockApi = {
  /**
   * Get public locks
   */
  getPublicLocks: (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return fetchWithAuth<SelfLockSummary[]>(`/locks/public${query ? `?${query}` : ''}`);
  },

  /**
   * Get playground locks (shared locks awaiting keyholder + public locks)
   */
  getPlaygroundLocks: (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return fetchWithAuth<SelfLockSummary[]>(`/locks/playground${query ? `?${query}` : ''}`);
  },

  /**
   * Search playground locks by username
   */
  searchPlaygroundLocks: (keyword: string, limit?: number) => {
    const params = new URLSearchParams();
    params.append('q', keyword);
    if (limit) params.append('limit', limit.toString());
    return fetchWithAuth<SelfLockSummary[]>(`/locks/playground/search?${params.toString()}`);
  },

  /**
   * Get my locks
   */
  getMyLocks: (activeOnly?: boolean) =>
    fetchWithAuth<SelfLockSummary[]>(`/locks/my${activeOnly ? '?activeOnly=true' : ''}`),

  /**
   * Get my lock stats
   */
  getMyStats: () =>
    fetchWithAuth<SelfLockStats>('/locks/my/stats'),

  /**
   * Get lock summary (for deep links)
   */
  getLockSummary: (lockId: number) =>
    fetchWithAuth<SelfLockSummary>(`/locks/${lockId}/summary`),

  /**
   * Get lock detail
   */
  getLockDetail: (lockId: number) =>
    fetchWithAuth<SelfLockDetail>(`/locks/${lockId}`),

  /**
   * Get lock summary by 6-digit view code (private share link)
   */
  getLockSummaryByViewCode: (code: string) =>
    fetchWithAuth<SelfLockSummary>(`/locks/code/${encodeURIComponent(code)}/summary`),

  /**
   * Get lock detail by 6-digit view code (private share link)
   */
  getLockDetailByViewCode: (code: string) =>
    fetchWithAuth<SelfLockDetail>(`/locks/code/${encodeURIComponent(code)}`),

  /**
   * Generate (or regenerate) a 6-digit private view code for a lock
   */
  generateViewCode: (lockId: number) =>
    fetchWithAuth<{ viewCode: string }>(`/locks/${lockId}/view-code`, { method: 'POST' }),

  /**
   * Delete the private view code for a lock (revoke share access)
   */
  deleteViewCode: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/view-code`, { method: 'DELETE' }),

  /**
   * Create a new lock
   */
  createLock: (request: CreateSelfLockRequest) =>
    fetchWithAuth<SelfLockDetail>('/locks', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Upload lock image
   */
  uploadLockImage: async (lockId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/${lockId}/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  /**
   * Get lock image URL
   */
  getLockImageUrl: (lockId: number) =>
    fetchWithAuth<{ imageUrl: string }>(`/locks/${lockId}/image`),

  /**
   * Upload cover image
   */
  uploadCoverImage: async (lockId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/${lockId}/cover-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; coverImageKey: string; coverImageUrl: string }>;
  },

  /**
   * Delete cover image
   */
  deleteCoverImage: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/cover-image`, { method: 'DELETE' }),

  /**
   * Try to unlock
   */
  tryUnlock: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLockDetail; imageUrl: string | null }>(`/locks/${lockId}/unlock`, {
      method: 'POST',
    }),

  /**
   * Guess (time or key)
   */
  guess: (lockId: number, guessType: string, guessValue: string) =>
    fetchWithAuth<{ correct: boolean; penaltyMinutes: number; newScheduledUnlockAt: string | null; message: string }>(`/locks/${lockId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ guessType, guessValue }),
    }),

  /**
   * Vote to unlock
   */
  vote: (lockId: number) =>
    fetchWithAuth<{ message: string; currentVotes: number }>(`/locks/${lockId}/vote`, {
      method: 'POST',
    }),

  /**
   * Like a lock (adds time)
   */
  like: (lockId: number) =>
    fetchWithAuth<{ message: string; currentLikes: number }>(`/locks/${lockId}/like`, {
      method: 'POST',
    }),

  bumpLock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/bump`, {
      method: 'POST',
    }),

  /**
   * Toss coins to add time to a lock
   */
  tossCoin: (lockId: number, coins: number) =>
    fetchWithAuth<CoinTossResult>(`/locks/${lockId}/coin-toss`, {
      method: 'POST',
      body: JSON.stringify({ coins }),
    }),

  /**
   * Get coin toss info for a lock
   */
  getCoinTossInfo: (lockId: number) =>
    fetchWithAuth<CoinTossInfo>(`/locks/${lockId}/coin-toss-info`),

  /**
   * Emergency unlock
   */
  emergencyUnlock: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLockDetail }>(`/locks/${lockId}`, {
      method: 'DELETE',
    }),

  /**
   * Check if user has active lock
   */
  checkActiveLock: (minDuration?: number) =>
    fetchWithAuth<{ hasActiveLock: boolean; todayLockedMinutes: number }>(`/locks/check-active${minDuration ? `?minDuration=${minDuration}` : ''}`),

  // ==================== V2 Endpoints ====================

  /**
   * Create a new lock V2 (with all new features)
   */
  createLockV2: (request: CreateSelfLockRequest) =>
    fetchWithAuth<SelfLockDetail>('/locks/v2', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Freeze a lock
   */
  freezeLock: (lockId: number, request?: FreezeRequest) =>
    fetchWithAuth<{ message: string; lock: SelfLockBackend }>(`/locks/${lockId}/freeze`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }),

  /**
   * Unfreeze a lock
   */
  unfreezeLock: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLockBackend }>(`/locks/${lockId}/unfreeze`, {
      method: 'POST',
    }),

  /**
   * Use veto power
   */
  useVeto: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLockBackend }>(`/locks/${lockId}/veto`, {
      method: 'POST',
    }),

  /**
   * Request hygiene opening
   */
  requestHygieneOpening: (lockId: number) =>
    fetchWithAuth<HygieneOpeningResponse>(`/locks/${lockId}/hygiene/request`, {
      method: 'POST',
    }),

  /**
   * End hygiene opening
   */
  endHygieneOpening: (lockId: number) =>
    fetchWithAuth<{ message: string; lock: SelfLockBackend }>(`/locks/${lockId}/hygiene/end`, {
      method: 'POST',
    }),

  /**
   * Confirm lock box has been physically unlocked via BLE
   */
  confirmLockBoxUnlock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/lockbox/confirm-unlock`, {
      method: 'POST',
    }),

  /**
   * Confirm lock box has been relocked via BLE (during hygiene opening)
   */
  confirmLockBoxRelock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/lockbox/confirm-relock`, {
      method: 'POST',
    }),

  /**
   * Upload initial hygiene image (when creating lock with hygieneImageRequired)
   */
  uploadHygieneImage: async (lockId: number, imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/${lockId}/hygiene/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  /**
   * Upload relock image (required before ending hygiene opening when hygieneImageRequired)
   */
  uploadHygieneRelockImage: async (lockId: number, imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/${lockId}/hygiene/relock-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  /**
   * Get hygiene image history
   */
  getHygieneImageHistory: (lockId: number) =>
    fetchWithAuth<HygieneImageHistoryItem[]>(`/locks/${lockId}/hygiene/image-history`),

  /**
   * Get locks where I am keyholder
   */
  getLocksAsKeyholder: () =>
    fetchWithAuth<LockKeyholder[]>('/locks/keyholder'),

  /**
   * Get managed lock summaries (with lock info)
   */
  getManagedLocks: () =>
    fetchWithAuth<ManagedLockSummary[]>('/locks/keyholder/managed'),

  // ==================== Comments ====================

  /**
   * Get lock comments
   */
  getComments: (lockId: number, limit?: number) =>
    fetchWithAuth<LockComment[]>(`/locks/${lockId}/comments${limit ? `?limit=${limit}` : ''}`),

  /**
   * Post a comment
   */
  postComment: (lockId: number, request: PostLockCommentRequest) =>
    fetchWithAuth<LockComment>(`/locks/${lockId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a comment
   */
  deleteComment: (commentId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/comments/${commentId}`, {
      method: 'DELETE',
    }),

  /**
   * Get time change history
   */
  getTimeHistory: (lockId: number, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return fetchWithAuth<import('../types').TimeChangeHistoryEntry[]>(`/locks/${lockId}/time-history${query ? `?${query}` : ''}`);
  },
};

// Courses API
export const coursesApi = {
  /**
   * Get all courses (public)
   */
  getAllCourses: () =>
    fetchWithAuth<CourseSummaryBackend[]>('/courses'),

  /**
   * Get all courses with user status (authenticated)
   */
  getCoursesWithStatus: () =>
    fetchWithAuth<CourseSummaryBackend[]>('/courses/with-status'),

  /**
   * Get today's courses (public)
   */
  getTodayCourses: () =>
    fetchWithAuth<CourseSummaryBackend[]>('/courses/today'),

  /**
   * Get course detail
   */
  getCourseDetail: (courseId: number) =>
    fetchWithAuth<CourseSummaryBackend>(`/courses/${courseId}`),

  /**
   * Enroll in a course
   */
  enrollCourse: (request: EnrollCourseRequest) =>
    fetchWithAuth<UserEnrollment>('/courses/enroll', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Get user's course progress
   */
  getMyProgress: () =>
    fetchWithAuth<UserCourseProgress[]>('/courses/my-progress'),

  /**
   * Drop a course
   */
  dropCourse: (courseId: number) =>
    fetchWithAuth<{ message: string }>(`/courses/${courseId}/drop`, {
      method: 'DELETE',
    }),

  /**
   * Get course tasks overview (daily tasks, exam tasks, optional task groups)
   */
  getCourseTasksOverview: (courseId: number) =>
    fetchWithAuth<import('../types').CourseTasksOverview>(`/courses/${courseId}/tasks`),
};

// Exams API
export const examsApi = {
  /**
   * Check exam eligibility
   */
  checkEligibility: (courseId: number) =>
    fetchWithAuth<{ eligible: boolean; reason: string | null }>(`/exams/eligibility/${courseId}`),

  /**
   * Start exam - generates exam tasks
   */
  startExam: (courseId: number) =>
    fetchWithAuth<UserTaskDetail[]>(`/exams/start/${courseId}`, {
      method: 'POST',
    }),

  /**
   * Check exam result
   */
  checkResult: (courseId: number) =>
    fetchWithAuth<{ passed: boolean; message: string; creditsEarned: number }>(`/exams/result/${courseId}`),
};

// Punishments API
export const punishmentsApi = {
  /**
   * Get pending punishments (待申领 + 待执行)
   */
  getPending: () =>
    fetchWithAuth<UserPunishmentDisplay[]>('/punishments/pending'),

  /**
   * Get punishment history
   */
  getHistory: () =>
    fetchWithAuth<UserPunishmentDisplay[]>('/punishments/history'),

  /**
   * Get user's campus points (用于判断是否可以重抽)
   */
  getPoints: () =>
    fetchWithAuth<UserPointsInfo>('/punishments/points'),

  /**
   * Draw punishment - 从惩罚池中随机抽取一个
   */
  draw: (punishmentId: number) =>
    fetchWithAuth<DrawPunishmentResult>(`/punishments/${punishmentId}/draw`, {
      method: 'POST',
    }),

  /**
   * Reroll punishment - 消耗校园点数重新抽取
   */
  reroll: (punishmentId: number, confirm: boolean = true) =>
    fetchWithAuth<DrawPunishmentResult>(`/punishments/${punishmentId}/reroll`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),

  /**
   * Claim punishment - 确认接受抽取到的惩罚
   */
  claim: (punishmentId: number, confirm: boolean = true) =>
    fetchWithAuth<UserPunishmentDisplay>(`/punishments/${punishmentId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),
};

// Punishment Room API
export const punishmentRoomApi = {
  roll: (severity: string = 'LIGHT') =>
    fetchWithAuth<PunishmentRoomRollResult>('/punishments/room/roll', {
      method: 'POST',
      body: JSON.stringify({ severity }),
    }),

  reroll: (severity: string, userPunishmentId: number) =>
    fetchWithAuth<PunishmentRoomRollResult>('/punishments/room/reroll', {
      method: 'POST',
      body: JSON.stringify({ severity, userPunishmentId }),
    }),
};

// User Stats API
export const userStatsApi = {
  /**
   * Get user stats for display (focus hours, streak, tasks completed, etc.)
   */
  getStats: () =>
    fetchWithAuth<UserStatsDisplay>('/user-stats'),
};

// User public profile type (when viewing other users)
export interface UserPublicProfile {
  id: number;
  username: string | null;  // Only shown when allowTelegramContact is true
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  bio: string | null;
  tags: string[];
  isPremium: boolean;
  allowTelegramContact: boolean;
  createdAt: string;
  // 统计数据
  credits: number;       // 学分/XP
  level: number;         // 等级 = credits / 10
  focusHours: number;    // 专注时长（小时）
  streakDays: number;    // 当前连续天数
  tasksCompleted: number; // 完成任务数
  // 实时专注
  activeLockStartedAt?: string;  // 活跃锁开始时间（ISO-8601）
  // 公开活跃锁
  publicActiveLock?: SelfLockSummary;
  // 卡面
  equippedCardFace?: {
    id: number;
    name: string;
    description: string | null;
    themeKey: string;
  };
  // 个人状态
  statusText?: string | null;
  statusImageUrl?: string | null;
  statusUpdatedAt?: string | null;
  // 封禁状态
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
}

// Guestbook types
export interface GuestbookEntry {
  id: number;
  profileUserId: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  authorLevel: number;
  parentId: number | null;
  replyToCommentId: number | null;
  replyToUserName: string | null;
  content: string;
  imageUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  replies: GuestbookEntry[];
}

export interface GuestbookResponse {
  entries: GuestbookEntry[];
  total: number;
  hasMore: boolean;
}

export interface CreateGuestbookRequest {
  content: string;
  imageUrl: string | null;
  parentId: number | null;
  replyToCommentId: number | null;
}

// Ban user request/response types
export interface BanUserRequest {
  reason?: string;
}

export interface BanUserResponse {
  success: boolean;
  message: string;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
}

// User Profile API
export const userProfileApi = {
  /**
   * Get current user profile
   */
  getMe: () =>
    fetchWithAuth<UserWithRoles>('/users/me'),

  /**
   * Update user profile (bio and tags)
   */
  updateProfile: (request: UpdateProfileRequest) =>
    fetchWithAuth<{ message: string; user: User }>('/users/me/profile', {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Get user public profile by ID
   */
  getUser: (userId: number) =>
    fetchWithAuth<UserPublicProfile>(`/users/${userId}`),

  /**
   * Get current user settings
   */
  getSettings: () =>
    fetchWithAuth<UserSettings>('/users/me/settings'),

  /**
   * Update user settings
   */
  updateSettings: (request: UpdateSettingsRequest) =>
    fetchWithAuth<UserSettings>('/users/me/settings', {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Ban a user (admin only)
   */
  banUser: (userId: number, request?: BanUserRequest) =>
    fetchWithAuth<BanUserResponse>(`/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }),

  /**
   * Unban a user (admin only)
   */
  unbanUser: (userId: number) =>
    fetchWithAuth<BanUserResponse>(`/users/${userId}/ban`, {
      method: 'DELETE',
    }),

  /**
   * Update personal status
   */
  updateStatus: (request: { statusText?: string | null; statusImageKey?: string | null }) =>
    fetchWithAuth<{ message: string; statusText: string | null; statusImageKey: string | null; statusUpdatedAt: string | null }>('/users/me/status', {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Clear personal status
   */
  clearStatus: () =>
    fetchWithAuth<{ message: string }>('/users/me/status', { method: 'DELETE' }),

  /**
   * Upload status image
   */
  uploadStatusImage: async (file: File): Promise<{ imageKey: string; imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const token = getJwtToken();
    const res = await fetch(`${API_BASE_URL}/users/me/status/image`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    return res.json();
  },

  /**
   * Search users (general search without allowSupervisionRequest filter)
   * Use this for schedule sharing, memory invites, etc.
   */
  searchUsers: (query: string) =>
    fetchWithAuth<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`),

  /**
   * Get credits leaderboard
   */
  getCreditsLeaderboard: (limit: number = 20) =>
    fetchWithAuth<LeaderboardResponse>(`/users/leaderboard/credits?limit=${limit}`),

  /**
   * 暂停所有课程（至少21天）
   */
  pauseCourses: () =>
    fetchWithAuth<PauseCoursesResponse>('/users/me/pause-courses', { method: 'POST' }),

  /**
   * 取消课程暂停
   */
  unpauseCourses: () =>
    fetchWithAuth<{ message: string }>('/users/me/pause-courses', { method: 'DELETE' }),
};

// Guestbook API
export const guestbookApi = {
  getEntries: (userId: number, limit = 20, offset = 0) =>
    fetchWithAuth<GuestbookResponse>(`/users/${userId}/guestbook?limit=${limit}&offset=${offset}`),

  postEntry: (userId: number, request: CreateGuestbookRequest) =>
    fetchWithAuth<GuestbookEntry>(`/users/${userId}/guestbook`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteEntry: (entryId: number) =>
    fetchWithAuth<{ success: boolean }>(`/guestbook/${entryId}`, { method: 'DELETE' }),

  uploadImage: async (file: File): Promise<{ imageKey: string; imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const token = getJwtToken();
    const res = await fetch(`${API_BASE_URL}/guestbook/images`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    return res.json();
  },
};

// ── API Token Types ──

export interface ApiTokenInfo {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateTokenResponse {
  token: string;        // 明文 token，仅显示一次
  tokenInfo: ApiTokenInfo;
}

// ── API Token Management ──

export const apiTokenApi = {
  list: () =>
    fetchWithAuth<ApiTokenInfo[]>('/api-tokens'),

  create: (name: string) =>
    fetchWithAuth<CreateTokenResponse>('/api-tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  revoke: (tokenId: number) =>
    fetchWithAuth<{ message: string }>(`/api-tokens/${tokenId}`, {
      method: 'DELETE',
    }),
};

// Keyholder API
export const keyholderApi = {
  /**
   * Get keyholders for a lock
   */
  getKeyholders: (lockId: number) =>
    fetchWithAuth<LockKeyholder[]>(`/locks/${lockId}/keyholders`),

  /**
   * Add a keyholder
   */
  addKeyholder: (lockId: number, request: AddKeyholderRequest) =>
    fetchWithAuth<LockKeyholder>(`/locks/${lockId}/keyholders`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update keyholder permission
   */
  updateKeyholder: (lockId: number, userId: number, request: UpdateKeyholderRequest) =>
    fetchWithAuth<LockKeyholder>(`/locks/${lockId}/keyholders/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Remove a keyholder
   */
  removeKeyholder: (lockId: number, userId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/keyholders/${userId}`, {
      method: 'DELETE',
    }),

  /**
   * 申请共享锁（创建 PENDING 申请）
   */
  applyForLock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/claim`, {
      method: 'POST',
    }),

  /**
   * 取消申请或取消认领共享锁
   */
  cancelApplication: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/claim`, {
      method: 'DELETE',
    }),

  /**
   * 管理员取消认领共享锁（保留向后兼容）
   */
  unclaimLock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/claim`, {
      method: 'DELETE',
    }),

  /**
   * 获取申请列表（锁主用）
   */
  getApplications: (lockId: number) =>
    fetchWithAuth<TakeoverRequestInfo[]>(`/locks/${lockId}/takeover`),

  /**
   * 选定申请者
   */
  acceptApplication: (lockId: number, requestId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/takeover/${requestId}/accept`, {
      method: 'POST',
    }),

  /**
   * 拒绝申请者
   */
  rejectApplication: (lockId: number, requestId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/takeover/${requestId}/reject`, {
      method: 'POST',
    }),

  /**
   * 锁创建者移除不活跃管理员
   */
  removeInactiveKeyholder: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/claim/inactive`, {
      method: 'DELETE',
    }),

  /**
   * Add time to a lock (keyholder control)
   */
  addTime: (lockId: number, minutes: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/control/add-time`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  /**
   * Remove time from a lock (keyholder control)
   */
  removeTime: (lockId: number, minutes: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/control/remove-time`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  /**
   * Freeze a lock (keyholder control)
   */
  freezeLock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/control/freeze`, {
      method: 'POST',
    }),

  /**
   * Unfreeze a lock (keyholder control)
   */
  unfreezeLock: (lockId: number) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/control/unfreeze`, {
      method: 'POST',
    }),

  /**
   * Update lock settings (keyholder control, requires FULL_CONTROL)
   */
  updateSettings: (lockId: number, settings: UpdateLockSettingsRequest) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/control/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// Unlock Request API (keyholder approval for unlock)
export const unlockRequestApi = {
  /**
   * Get pending unlock requests I need to approve (as keyholder)
   */
  getPendingRequests: () =>
    fetchWithAuth<PendingUnlockRequestsResponse>('/unlock-requests/pending'),

  /**
   * Get my pending unlock requests (as lock wearer)
   */
  getMyPendingRequests: () =>
    fetchWithAuth<PendingUnlockRequestsResponse>('/unlock-requests/my-pending'),

  /**
   * Respond to an unlock request (approve/reject) - keyholder only
   */
  respondToRequest: (requestId: number, data: RespondUnlockRequestData) =>
    fetchWithAuth<UnlockRequestResponse>(`/unlock-requests/${requestId}/respond`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Cancel an unlock request - requester only
   */
  cancelRequest: (requestId: number) =>
    fetchWithAuth<{ message: string }>(`/unlock-requests/${requestId}`, {
      method: 'DELETE',
    }),
};

// Extension API
export const extensionApi = {
  /**
   * Get enabled extensions for a lock
   */
  getExtensions: (lockId: number) =>
    fetchWithAuth<LockExtensionData[]>(`/locks/${lockId}/extensions`),

  /**
   * Enable an extension
   */
  enableExtension: (lockId: number, extensionType: ExtensionType, config?: ExtensionConfigRequest) =>
    fetchWithAuth<LockExtensionData>(`/locks/${lockId}/extensions/enable`, {
      method: 'POST',
      body: JSON.stringify({
        type: extensionType,
        config: config?.config || {},
        cooldownSeconds: config?.cooldownSeconds || 0,
      }),
    }),

  /**
   * Disable an extension
   */
  disableExtension: (lockId: number, extensionType: ExtensionType) =>
    fetchWithAuth<{ message: string }>(`/locks/${lockId}/extensions/${extensionType}`, {
      method: 'DELETE',
    }),

  /**
   * Update extension config
   */
  updateExtensionConfig: (lockId: number, extensionType: ExtensionType, config: ExtensionConfigRequest) =>
    fetchWithAuth<LockExtensionData>(`/locks/${lockId}/extensions/${extensionType}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  /**
   * Trigger an extension
   */
  triggerExtension: (lockId: number, extensionType: ExtensionType, requestData?: Record<string, unknown>) =>
    fetchWithAuth<ExtensionTriggerResult>(`/locks/${lockId}/extensions/${extensionType}/trigger`, {
      method: 'POST',
      body: JSON.stringify(requestData ? { data: requestData } : {}),
    }),

  /**
   * Spin the wheel of fortune
   */
  spinWheel: (lockId: number) =>
    fetchWithAuth<ExtensionTriggerResult>(`/locks/${lockId}/wheel/spin`, {
      method: 'POST',
    }),

  /**
   * Roll dice
   */
  rollDice: (lockId: number) =>
    fetchWithAuth<ExtensionTriggerResult>(`/locks/${lockId}/dice/roll`, {
      method: 'POST',
    }),
};

// Lock Task API (V2 - keyholder assigned tasks)
export const lockTaskApi = {
  /**
   * Get tasks for a lock
   */
  getTasks: (lockId: number, status?: string) =>
    fetchWithAuth<LockTask[]>(`/locks/${lockId}/tasks${status ? `?status=${status}` : ''}`),

  /**
   * Create a task for a lock
   */
  createTask: (lockId: number, request: CreateLockTaskRequest) =>
    fetchWithAuth<LockTask>(`/locks/${lockId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Submit task proof
   */
  submitProof: (taskId: number, request?: SubmitLockTaskProofRequest) =>
    fetchWithAuth<LockTask>(`/locks/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }),

  /**
   * Upload task proof image
   */
  uploadProofImage: async (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/tasks/${taskId}/proof-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageKey: string }>;
  },

  /**
   * Review a task (approve/reject)
   */
  reviewTask: (taskId: number, request: ReviewLockTaskRequest) =>
    fetchWithAuth<LockTask>(`/locks/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Vote on a task
   */
  voteOnTask: (taskId: number, approve: boolean) =>
    fetchWithAuth<{ message: string; currentVotes: number }>(`/locks/tasks/${taskId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }),

  /**
   * Get my assigned tasks (as wearer)
   */
  getMyTasks: () =>
    fetchWithAuth<LockTask[]>('/locks/tasks/my'),

  /**
   * Get tasks I've assigned (as keyholder)
   */
  getAssignedTasks: () =>
    fetchWithAuth<LockTask[]>('/locks/tasks/assigned'),
};

// Notification API
export const notificationApi = {
  /**
   * Get notifications
   */
  getNotifications: (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return fetchWithAuth<NotificationItem[]>(`/notifications${query ? `?${query}` : ''}`);
  },

  /**
   * Get unread notifications
   */
  getUnread: (limit?: number) =>
    fetchWithAuth<NotificationItem[]>(`/notifications/unread${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get unread count
   */
  getUnreadCount: () =>
    fetchWithAuth<{ count: number }>('/notifications/unread-count'),

  /**
   * Get notification stats
   */
  getStats: () =>
    fetchWithAuth<NotificationStats>('/notifications/stats'),

  /**
   * Mark notification as read
   */
  markAsRead: (notificationId: number) =>
    fetchWithAuth<{ message: string }>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    }),

  /**
   * Mark multiple notifications as read
   */
  markMultipleAsRead: (notificationIds: number[]) =>
    fetchWithAuth<{ message: string; count: number }>('/notifications/read', {
      method: 'PUT',
      body: JSON.stringify({ notificationIds }),
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () =>
    fetchWithAuth<{ markedCount: number }>('/notifications/read', {
      method: 'PUT',
      body: JSON.stringify({ notificationIds: null }),
    }),

  /**
   * Delete a notification
   */
  deleteNotification: (notificationId: number) =>
    fetchWithAuth<{ message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    }),

  /**
   * Get notification settings
   */
  getSettings: () =>
    fetchWithAuth<NotificationSettings>('/notifications/settings'),

  /**
   * Update notification settings
   */
  updateSettings: (request: UpdateNotificationSettingsRequest) =>
    fetchWithAuth<NotificationSettings>('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(request),
    }),
};

// ===== Feedback & Help Center API =====

import type {
  CreateFeedbackRequest,
  FeedbackItem,
  FeedbackDetailResponse,
  HelpCenterResponse,
  PostCategory,
  PostItem,
  PostDetail,
  PostCommentItem,
  CreatePostRequest,
  UpdatePostRequest,
  CreatePostCommentRequest,
  PostListResponse,
  CommentListResponse,
  PollDetail,
} from '../types';

export const feedbackApi = {
  /**
   * Get help center info (FAQs, contact info)
   */
  getHelpCenter: () =>
    fetchWithAuth<HelpCenterResponse>('/feedback/help-center'),

  /**
   * Submit new feedback
   */
  createFeedback: (request: CreateFeedbackRequest) =>
    fetchWithAuth<FeedbackDetailResponse>('/feedback', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Get user's feedback list
   */
  getFeedbacks: (limit = 50, offset = 0) =>
    fetchWithAuth<FeedbackItem[]>(`/feedback?limit=${limit}&offset=${offset}`),

  /**
   * Get feedback detail
   */
  getFeedbackDetail: (id: number) =>
    fetchWithAuth<FeedbackDetailResponse>(`/feedback/${id}`),

  /**
   * Get recent feedbacks with responses
   */
  getRecentResponses: (limit = 5) =>
    fetchWithAuth<FeedbackItem[]>(`/feedback/with-responses?limit=${limit}`),

  /**
   * Upload feedback screenshot
   */
  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/feedback/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },
};

// ===== Admin Feedback API =====

import type {
  AdminFeedbackItem,
  AdminRespondFeedbackRequest,
} from '../types';

export const adminFeedbackApi = {
  /**
   * Get all feedbacks (admin only)
   */
  getAllFeedbacks: (limit = 100, offset = 0, status?: string) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (status) params.append('status', status);
    return fetchWithAuth<AdminFeedbackItem[]>(`/admin/feedback?${params.toString()}`);
  },

  /**
   * Get pending feedback count
   */
  getPendingCount: () =>
    fetchWithAuth<{ pendingCount: number }>('/admin/feedback/pending-count'),

  /**
   * Respond to feedback
   */
  respondToFeedback: (id: number, request: AdminRespondFeedbackRequest) =>
    fetchWithAuth<{ message: string }>(`/admin/feedback/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update feedback status
   */
  updateFeedbackStatus: (id: number, status: string) =>
    fetchWithAuth<{ message: string }>(`/admin/feedback/${id}/status?status=${status}`, {
      method: 'PUT',
    }),
};

// ============ Posts API ============

export const postsApi = {
  /**
   * Get posts list
   */
  getPosts: (category?: PostCategory, limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return fetchWithAuth<PostListResponse>(`/posts?${params.toString()}`);
  },

  /**
   * Get my posts
   */
  getMyPosts: (limit = 20, offset = 0) =>
    fetchWithAuth<PostItem[]>(`/posts/my?limit=${limit}&offset=${offset}`),

  getUserPosts: (userId: number, limit = 10, offset = 0) =>
    fetchWithAuth<PostItem[]>(`/posts/user/${userId}?limit=${limit}&offset=${offset}`),

  /**
   * Get post detail
   */
  getPost: (id: number) =>
    fetchWithAuth<PostDetail>(`/posts/${id}`),

  /**
   * Upload post images
   */
  uploadImages: async (files: File[]): Promise<{ imageKeys: string[] }> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/posts/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ imageKeys: string[] }>;
  },

  /**
   * Create a new post
   */
  createPost: (request: CreatePostRequest) =>
    fetchWithAuth<PostDetail>('/posts', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update a post
   */
  updatePost: (id: number, request: UpdatePostRequest) =>
    fetchWithAuth<{ success: boolean }>(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a post
   */
  deletePost: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/posts/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Toggle like on a post
   */
  toggleLike: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/posts/${id}/like`, {
      method: 'POST',
    }),

  /**
   * Pin a post using a POST_PIN special item (author only)
   */
  pinPost: (postId: number) =>
    fetchWithAuth<{ message: string }>(`/posts/${postId}/pin`, { method: 'POST' }),

  /**
   * Feature/unfeature a post (admin only)
   */
  featurePost: (postId: number, featured: boolean) =>
    fetchWithAuth<{ message: string }>(`/posts/${postId}/feature`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured }),
    }),

  /**
   * Get comments for a post
   */
  getComments: (postId: number, limit = 20, offset = 0) =>
    fetchWithAuth<CommentListResponse>(`/posts/${postId}/comments?limit=${limit}&offset=${offset}`),

  /**
   * Create a comment
   */
  createComment: (postId: number, request: CreatePostCommentRequest) =>
    fetchWithAuth<PostCommentItem>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a comment
   */
  deleteComment: (postId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  /**
   * Toggle like on a comment
   */
  toggleCommentLike: (postId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/posts/${postId}/comments/${commentId}/like`, {
      method: 'POST',
    }),

  /**
   * Search posts by keyword
   */
  searchPosts: (keyword: string, category?: PostCategory, limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    params.append('q', keyword);
    if (category) params.append('category', category);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return fetchWithAuth<PostListResponse>(`/posts/search?${params.toString()}`);
  },

  /**
   * Vote on a poll
   */
  vote: (postId: number, optionIds: number[]) =>
    fetchWithAuth<PollDetail>(`/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds }),
    }),

  /**
   * Cancel vote on a poll
   */
  cancelVote: (postId: number) =>
    fetchWithAuth<PollDetail>(`/posts/${postId}/vote`, {
      method: 'DELETE',
    }),
};

// Memory API
export const memoryApi = {
  /**
   * Get my memories
   */
  getMyMemories: (limit = 50, offset = 0) =>
    fetchWithAuth<MemorySummary[]>(`/memories/my?limit=${limit}&offset=${offset}`),

  /**
   * Get memory stats
   */
  getStats: () =>
    fetchWithAuth<MemoryStats>('/memories/stats'),

  /**
   * Get memories for a schedule
   */
  getScheduleMemories: (scheduleId: number) =>
    fetchWithAuth<MemorySummary[]>(`/memories/schedule/${scheduleId}`),

  /**
   * Get memory detail
   */
  getMemory: (memoryId: number) =>
    fetchWithAuth<MemoryDetail>(`/memories/${memoryId}`),

  /**
   * Create a new memory
   */
  createMemory: (request: CreateMemoryRequest) =>
    fetchWithAuth<MemoryDetail>('/memories', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update a memory
   */
  updateMemory: (memoryId: number, request: UpdateMemoryRequest) =>
    fetchWithAuth<MemoryDetail>(`/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a memory
   */
  deleteMemory: (memoryId: number) =>
    fetchWithAuth<{ message: string }>(`/memories/${memoryId}`, {
      method: 'DELETE',
    }),

  /**
   * Upload memory images
   */
  uploadImages: async (memoryId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/memories/${memoryId}/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ message: string; imageUrls: string[] }>;
  },

  /**
   * Invite users to view memory
   */
  inviteUsers: (memoryId: number, request: InviteToMemoryRequest) =>
    fetchWithAuth<InvitedUser[]>(`/memories/${memoryId}/invite`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Remove invitation
   */
  removeInvitation: (memoryId: number, userId: number) =>
    fetchWithAuth<{ message: string }>(`/memories/${memoryId}/invite/${userId}`, {
      method: 'DELETE',
    }),

  /**
   * Toggle like on memory
   */
  toggleLike: (memoryId: number) =>
    fetchWithAuth<{ isLiked: boolean }>(`/memories/${memoryId}/like`, {
      method: 'POST',
    }),

  /**
   * Generate share code for memory
   */
  generateShareCode: (memoryId: number) =>
    fetchWithAuth<{ shareCode: string }>(`/memories/${memoryId}/share-code`, {
      method: 'POST',
    }),

  /**
   * Join memory by share code
   */
  joinByShareCode: (shareCode: string) =>
    fetchWithAuth<MemoryDetail>(`/memories/join`, {
      method: 'POST',
      body: JSON.stringify({ shareCode }),
    }),

  /**
   * Publish memory to community
   */
  publishToCommunity: (memoryId: number) =>
    fetchWithAuth<MemoryDetail>(`/memories/${memoryId}/publish`, {
      method: 'POST',
    }),

  /**
   * Unpublish memory from community
   */
  unpublishFromCommunity: (memoryId: number) =>
    fetchWithAuth<{ message: string }>(`/memories/${memoryId}/publish`, {
      method: 'DELETE',
    }),
};

// Schedule Sharing API
export const scheduleSharingApi = {
  /**
   * Share schedule with users
   */
  shareWithUsers: (scheduleId: number, request: ShareScheduleRequest) =>
    fetchWithAuth<ScheduleParticipant[]>(`/schedules/${scheduleId}/sharing/invite`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Generate share code
   */
  generateShareCode: (scheduleId: number) =>
    fetchWithAuth<ShareCodeResponse>(`/schedules/${scheduleId}/sharing/share-code`, {
      method: 'POST',
    }),

  /**
   * Get participants
   */
  getParticipants: (scheduleId: number) =>
    fetchWithAuth<ScheduleParticipant[]>(`/schedules/${scheduleId}/sharing/participants`),

  /**
   * Remove participant
   */
  removeParticipant: (scheduleId: number, userId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}/sharing/participants/${userId}`, {
      method: 'DELETE',
    }),

  /**
   * Update participant permission
   */
  updateParticipantPermission: (scheduleId: number, userId: number, request: UpdateParticipantPermissionRequest) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}/sharing/participants/${userId}/permission`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Publish schedule to community
   */
  publishToCommunity: (scheduleId: number, request?: PublishScheduleRequest) =>
    fetchWithAuth<{ message: string; postId: number }>(`/schedules/${scheduleId}/sharing/publish`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }),

  /**
   * Unpublish from community
   */
  unpublishFromCommunity: (scheduleId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/${scheduleId}/sharing/publish`, {
      method: 'DELETE',
    }),

  /**
   * Get shared schedules (schedules I participate in)
   */
  getSharedSchedules: () =>
    fetchWithAuth<SharedScheduleListResponse>('/schedules/shared'),

  /**
   * Get pending invitations
   */
  getPendingInvitations: () =>
    fetchWithAuth<PendingInvitationsResponse>('/schedules/shared/pending'),

  /**
   * Join by share code
   */
  joinByShareCode: (request: JoinByShareCodeRequest) =>
    fetchWithAuth<ScheduleParticipant>('/schedules/shared/join', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Respond to invitation
   */
  respondToInvitation: (scheduleId: number, request: RespondToInvitationRequest) =>
    fetchWithAuth<{ message: string }>(`/schedules/shared/${scheduleId}/respond`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Leave shared schedule
   */
  leaveSchedule: (scheduleId: number) =>
    fetchWithAuth<{ message: string }>(`/schedules/shared/${scheduleId}`, {
      method: 'DELETE',
    }),

  /**
   * Upload image for schedule publish
   */
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/schedules/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ imageUrl: string; imageKey: string }>;
  },
};

// Supervision API
import type {
  SupervisionHomeOverview,
  SupervisorTaskDefinition,
  SupervisorTask,
  SupervisorTaskDetail,
  SuperviseeTaskOverview,
  CreateSupervisorTaskDefinitionRequest,
  UpdateSupervisorTaskDefinitionRequest,
} from '../types';

export const supervisionApi = {
  /**
   * Search users for supervision agreement
   */
  searchUsers: (query: string) =>
    fetchWithAuth<SupervisionSearchResult[]>(`/supervision/search?q=${encodeURIComponent(query)}`),

  /**
   * Initiate a supervision agreement
   */
  initiate: (request: InitiateSupervisionRequest) =>
    fetchWithAuth<{ message: string; agreement: SupervisionAgreement }>('/supervision/initiate', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Respond to a supervision agreement (accept/reject)
   */
  respond: (agreementId: number, accept: boolean) =>
    fetchWithAuth<{ message: string; agreement: SupervisionAgreement }>(`/supervision/${agreementId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ accept }),
    }),

  /**
   * Cancel/terminate a supervision agreement (supervisor only)
   */
  cancel: (agreementId: number) =>
    fetchWithAuth<{ message: string }>(`/supervision/${agreementId}`, {
      method: 'DELETE',
    }),

  /**
   * Get my supervisor
   */
  getMySupervisor: () =>
    fetchWithAuth<{ supervisor: SupervisionAgreement | null }>('/supervision/my-supervisor'),

  /**
   * Get users I supervise
   */
  getMySupervisees: () =>
    fetchWithAuth<SupervisionAgreement[]>('/supervision/my-supervisees'),

  /**
   * Get pending requests (I need to respond)
   */
  getPending: () =>
    fetchWithAuth<SupervisionAgreement[]>('/supervision/pending'),

  /**
   * Get my pending requests (I initiated)
   */
  getMyPending: () =>
    fetchWithAuth<SupervisionAgreement[]>('/supervision/my-pending'),

  /**
   * Get supervision summary
   */
  getSummary: () =>
    fetchWithAuth<SupervisionSummary>('/supervision/summary'),

  /**
   * Update hygiene bypass approval (supervisor only)
   */
  updateHygieneBypassApproval: (agreementId: number, bypass: boolean) =>
    fetchWithAuth<{ message: string; agreement: SupervisionAgreement }>(`/supervision/${agreementId}/hygiene-bypass`, {
      method: 'PUT',
      body: JSON.stringify({ bypass }),
    }),

  /**
   * Get signed agreement items (for supervisor)
   */
  getSignedAgreements: () =>
    fetchWithAuth<SignedAgreementItem[]>('/supervision/signed-agreements'),

  /**
   * Get home overview (supervisor/supervisee relationships with today's task stats)
   */
  getHomeOverview: () =>
    fetchWithAuth<SupervisionHomeOverview>('/supervision/home-overview'),

  /**
   * Get task definitions for a specific supervisee (supervisor view)
   */
  getTaskDefinitions: (superviseeId: number) =>
    fetchWithAuth<SupervisorTaskDefinition[]>(`/supervision/supervisee/${superviseeId}/task-definitions`),

  /**
   * Create a task definition for a supervisee
   */
  createTaskDefinition: (request: CreateSupervisorTaskDefinitionRequest) =>
    fetchWithAuth<{ message: string; definition: SupervisorTaskDefinition }>('/supervision/task-definitions', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Update a task definition
   */
  updateTaskDefinition: (definitionId: number, request: UpdateSupervisorTaskDefinitionRequest) =>
    fetchWithAuth<{ message: string; definition: SupervisorTaskDefinition }>(`/supervision/task-definitions/${definitionId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  /**
   * Delete a task definition
   */
  deleteTaskDefinition: (definitionId: number) =>
    fetchWithAuth<{ message: string }>(`/supervision/task-definitions/${definitionId}`, {
      method: 'DELETE',
    }),

  /**
   * Manually dispatch a task from a template
   */
  dispatchTask: (definitionId: number) =>
    fetchWithAuth<{ message: string }>(`/supervision/task-definitions/${definitionId}/dispatch`, {
      method: 'POST',
    }),

  /**
   * Get supervisee's tasks for a date (supervisor view)
   */
  getSuperviseeTasksOverview: (superviseeId: number, date?: string) =>
    fetchWithAuth<SuperviseeTaskOverview>(`/supervision/supervisee/${superviseeId}/tasks${date ? `?date=${date}` : ''}`),

  /**
   * Add a note to a task (supervisor action)
   */
  addTaskNote: (taskId: number, note: string) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/tasks/${taskId}/note`, {
      method: 'POST',
      body: JSON.stringify({ taskId, note }),
    }),

  /**
   * Get my supervisor tasks (supervisee view)
   */
  getMyTasks: (date?: string) =>
    fetchWithAuth<SupervisorTaskDetail[]>(`/supervision/my-tasks${date ? `?date=${date}` : ''}`),

  /**
   * Start a supervisor task (supervisee action)
   */
  startTask: (taskId: number) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/start`, {
      method: 'POST',
    }),

  /**
   * Update task progress (supervisee action)
   */
  updateTaskProgress: (taskId: number, actualValue: number) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ taskId, actualValue }),
    }),

  /**
   * Complete a supervisor task (supervisee action)
   */
  completeTask: (taskId: number, actualValue?: number) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ taskId, actualValue }),
    }),

  /**
   * Abandon a supervisor task (supervisee action)
   */
  abandonTask: (taskId: number) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/abandon`, {
      method: 'POST',
    }),

  /**
   * Submit proof for a supervisor task (supervisee action)
   */
  submitProof: (taskId: number, proofImageKey?: string, proofText?: string) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/proof`, {
      method: 'POST',
      body: JSON.stringify({ proofImageKey, proofText }),
    }),

  /**
   * Location checkin for a supervisor task (LOCATION type)
   */
  locationCheckin: (taskId: number, lat: number, lng: number) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/my-tasks/${taskId}/location-checkin?lat=${lat}&lng=${lng}`, {
      method: 'POST',
    }),

  /**
   * Review a supervisor task (supervisor approves or rejects)
   */
  reviewTask: (superviseeId: number, taskId: number, approved: boolean, rejectionReason?: string) =>
    fetchWithAuth<{ message: string; task: SupervisorTask }>(`/supervision/supervisees/${superviseeId}/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved, rejectionReason }),
    }),

  /**
   * Upload proof image for supervisor task
   */
  uploadProofImage: async (file: File): Promise<{ objectKey: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/supervision/proof-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },
};

// Follow API
export const followApi = {
  /**
   * 获取我的关注统计
   */
  getMyStats: () =>
    fetchWithAuth<FollowStats>('/follow/stats'),

  /**
   * 获取指定用户的关注统计
   */
  getUserStats: (userId: number) =>
    fetchWithAuth<FollowStats>(`/follow/stats/${userId}`),

  /**
   * 获取关注状态
   */
  getStatus: (userId: number) =>
    fetchWithAuth<FollowStatusResponse>(`/follow/status/${userId}`),

  /**
   * 关注用户
   */
  follow: (userId: number) =>
    fetchWithAuth<FollowResponse>(`/follow/${userId}`, {
      method: 'POST',
    }),

  /**
   * 取消关注
   */
  unfollow: (userId: number) =>
    fetchWithAuth<FollowResponse>(`/follow/${userId}`, {
      method: 'DELETE',
    }),

  /**
   * 切换关注状态
   */
  toggle: (userId: number) =>
    fetchWithAuth<FollowResponse>(`/follow/${userId}/toggle`, {
      method: 'POST',
    }),

  /**
   * 获取我关注的用户列表
   */
  getMyFollowing: (limit = 20, offset = 0) =>
    fetchWithAuth<FollowListResponse>(`/follow/following?limit=${limit}&offset=${offset}`),

  /**
   * 获取指定用户的关注列表
   */
  getUserFollowing: (userId: number, limit = 20, offset = 0) =>
    fetchWithAuth<FollowListResponse>(`/follow/following/${userId}?limit=${limit}&offset=${offset}`),

  /**
   * 获取关注我的用户列表（粉丝）
   */
  getMyFollowers: (limit = 20, offset = 0) =>
    fetchWithAuth<FollowListResponse>(`/follow/followers?limit=${limit}&offset=${offset}`),

  /**
   * 获取指定用户的粉丝列表
   */
  getUserFollowers: (userId: number, limit = 20, offset = 0) =>
    fetchWithAuth<FollowListResponse>(`/follow/followers/${userId}?limit=${limit}&offset=${offset}`),

  /**
   * 获取我关注的用户列表（用于快速选择）
   */
  getQuickSelect: (limit = 50) =>
    fetchWithAuth<FollowUserItem[]>(`/follow/quick-select?limit=${limit}`),
};

// Unlock Vote API
import type {
  UnlockVoteDetail,
  UnlockVoteSession,
  UnlockVoteResult,
  CanStartVoteResponse,
} from '../types';

export const unlockVoteApi = {
  /**
   * 发起投票解锁
   */
  startVote: (lockId: number) =>
    fetchWithAuth<{ message: string; session: UnlockVoteSession }>('/unlock-votes/start', {
      method: 'POST',
      body: JSON.stringify({ lockId }),
    }),

  /**
   * 检查是否可以发起投票解锁
   */
  canStartVote: (lockId: number) =>
    fetchWithAuth<CanStartVoteResponse>(`/unlock-votes/can-start/${lockId}`),

  /**
   * 获取锁的活跃投票会话
   */
  getActiveSession: (lockId: number) =>
    fetchWithAuth<UnlockVoteDetail>(`/unlock-votes/active/${lockId}`),

  /**
   * 获取投票会话详情
   */
  getSessionDetail: (sessionId: number) =>
    fetchWithAuth<UnlockVoteDetail>(`/unlock-votes/session/${sessionId}`),

  /**
   * 投票（系统用户）
   */
  castVote: (sessionId: number, isApprove: boolean) =>
    fetchWithAuth<UnlockVoteResult>('/unlock-votes/cast', {
      method: 'POST',
      body: JSON.stringify({ sessionId, isApprove }),
    }),

  /**
   * 取消投票会话
   */
  cancelSession: (sessionId: number) =>
    fetchWithAuth<{ message: string }>(`/unlock-votes/cancel/${sessionId}`, {
      method: 'POST',
    }),
};

// Optional Task Group API
import type { UserOptionalTaskGroupDisplay, SelectTasksRequest } from '../types';

export const optionalTaskGroupApi = {
  // 获取待处理的选做任务组
  getPending: () =>
    fetchWithAuth<UserOptionalTaskGroupDisplay[]>('/optional-task-groups/pending'),

  // 获取历史选做任务组
  getHistory: () =>
    fetchWithAuth<UserOptionalTaskGroupDisplay[]>('/optional-task-groups/history'),

  // 获取单个选做任务组详情
  getDetail: (id: number) =>
    fetchWithAuth<UserOptionalTaskGroupDisplay>(`/optional-task-groups/${id}`),

  // 选择要完成的任务
  selectTasks: (id: number, taskDefinitionIds: number[]) =>
    fetchWithAuth<UserOptionalTaskGroupDisplay>(`/optional-task-groups/${id}/select`, {
      method: 'POST',
      body: JSON.stringify({ taskDefinitionIds } as SelectTasksRequest),
    }),

  // 获取指定日期的选做任务组预览
  getByDate: (date: string) =>
    fetchWithAuth<import('../types').OptionalTaskGroupDatePreview[]>(`/optional-task-groups/by-date?date=${date}`),
};

// Admin API - Creator Mode
import type {
  CourseBackend,
  CreateCourseRequest,
  UpdateCourseRequest,
  CategoryBackend,
  CreateCategoryRequest,
  ClubBackend,
  TaskDefinitionBackend,
  CreateTaskDefinitionRequest,
  UpdateTaskDefinitionRequest,
  PunishmentBackend,
  CreatePunishmentRequest,
  BuffBackend,
  CreateBuffRequest,
  UpdateBuffRequest,
  CreateItemRequest,
  OptionalTaskGroupBackend,
  CreateOptionalTaskGroupRequest,
  UpdateOptionalTaskGroupRequest,
} from '../types';

export const adminApi = {
  // ==================== Courses ====================
  getCourses: (includeInactive = true) =>
    fetchWithAuth<CourseBackend[]>(`/admin/courses?includeInactive=${includeInactive}`),

  getCourse: (id: number) =>
    fetchWithAuth<CourseBackend>(`/admin/courses/${id}`),

  createCourse: (request: CreateCourseRequest) =>
    fetchWithAuth<CourseBackend>('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateCourse: (id: number, request: UpdateCourseRequest) =>
    fetchWithAuth<CourseBackend>(`/admin/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteCourse: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/courses/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Categories ====================
  getCategories: (includeInactive = true) =>
    fetchWithAuth<CategoryBackend[]>(`/admin/categories?includeInactive=${includeInactive}`),

  getCategory: (id: number) =>
    fetchWithAuth<CategoryBackend>(`/admin/categories/${id}`),

  createCategory: (request: CreateCategoryRequest) =>
    fetchWithAuth<CategoryBackend>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateCategory: (id: number, request: Partial<CreateCategoryRequest> & { isActive?: boolean }) =>
    fetchWithAuth<CategoryBackend>(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteCategory: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/categories/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Clubs ====================
  getClubs: (includeInactive = true) =>
    fetchWithAuth<ClubBackend[]>(`/admin/clubs?includeInactive=${includeInactive}`),

  // ==================== Task Definitions ====================
  getTaskDefinitions: (includeInactive = true, courseId?: number) => {
    const params = new URLSearchParams();
    params.append('includeInactive', String(includeInactive));
    if (courseId) params.append('courseId', String(courseId));
    return fetchWithAuth<TaskDefinitionBackend[]>(`/admin/task-definitions?${params.toString()}`);
  },

  getTaskDefinitionsByCourse: (courseId: number) =>
    fetchWithAuth<TaskDefinitionBackend[]>(`/admin/task-definitions/course/${courseId}`),

  getTaskDefinition: (id: number) =>
    fetchWithAuth<TaskDefinitionBackend>(`/admin/task-definitions/${id}`),

  createTaskDefinition: (request: CreateTaskDefinitionRequest) =>
    fetchWithAuth<TaskDefinitionBackend>('/admin/task-definitions', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateTaskDefinition: (id: number, request: UpdateTaskDefinitionRequest) =>
    fetchWithAuth<TaskDefinitionBackend>(`/admin/task-definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteTaskDefinition: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/task-definitions/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Punishments ====================
  getPunishments: (includeInactive = true) =>
    fetchWithAuth<PunishmentBackend[]>(`/admin/punishments?includeInactive=${includeInactive}`),

  getPunishment: (id: number) =>
    fetchWithAuth<PunishmentBackend>(`/admin/punishments/${id}`),

  createPunishment: (request: CreatePunishmentRequest) =>
    fetchWithAuth<PunishmentBackend>('/admin/punishments', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updatePunishment: (id: number, request: CreatePunishmentRequest) =>
    fetchWithAuth<PunishmentBackend>(`/admin/punishments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  setPunishmentActive: (id: number, isActive: boolean) =>
    fetchWithAuth<PunishmentBackend>(`/admin/punishments/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  deletePunishment: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/punishments/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Buffs ====================
  getBuffs: (includeInactive = true, clubId?: number) => {
    const params = new URLSearchParams();
    params.append('includeInactive', String(includeInactive));
    if (clubId) params.append('clubId', String(clubId));
    return fetchWithAuth<BuffBackend[]>(`/admin/buffs?${params.toString()}`);
  },

  getBuff: (id: number) =>
    fetchWithAuth<BuffBackend>(`/admin/buffs/${id}`),

  createBuff: (request: CreateBuffRequest) =>
    fetchWithAuth<BuffBackend>('/admin/buffs', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateBuff: (id: number, request: UpdateBuffRequest) =>
    fetchWithAuth<BuffBackend>(`/admin/buffs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteBuff: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/buffs/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Items ====================
  getItems: (availableOnly = false) =>
    fetchWithAuth<import('../types').Item[]>(`/admin/items?availableOnly=${availableOnly}`),

  getItem: (id: number) =>
    fetchWithAuth<import('../types').Item>(`/admin/items/${id}`),

  createItem: (request: CreateItemRequest) =>
    fetchWithAuth<import('../types').Item>('/admin/items', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateItem: (id: number, request: CreateItemRequest) =>
    fetchWithAuth<import('../types').Item>(`/admin/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteItem: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/items/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Optional Task Groups ====================
  getOptionalTaskGroups: (includeInactive = true) =>
    fetchWithAuth<OptionalTaskGroupBackend[]>(`/admin/optional-task-groups?includeInactive=${includeInactive}`),

  getOptionalTaskGroupsByCourse: (courseId: number) =>
    fetchWithAuth<OptionalTaskGroupBackend[]>(`/admin/optional-task-groups/course/${courseId}`),

  createOptionalTaskGroup: (request: CreateOptionalTaskGroupRequest) =>
    fetchWithAuth<OptionalTaskGroupBackend>('/admin/optional-task-groups', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateOptionalTaskGroup: (id: number, request: UpdateOptionalTaskGroupRequest) =>
    fetchWithAuth<OptionalTaskGroupBackend>(`/admin/optional-task-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteOptionalTaskGroup: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/optional-task-groups/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Majors ====================
  getMajors: () =>
    fetchWithAuth<MajorSummary[]>('/admin/majors'),

  getMajor: (id: number) =>
    fetchWithAuth<MajorDetail>(`/admin/majors/${id}`),

  createMajor: (request: CreateMajorRequest) =>
    fetchWithAuth<import('../types').MajorDetail>('/admin/majors', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateMajor: (id: number, request: UpdateMajorRequest) =>
    fetchWithAuth<import('../types').MajorDetail>(`/admin/majors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteMajor: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/majors/${id}`, {
      method: 'DELETE',
    }),

  setMajorCourses: (id: number, courseIds: number[]) =>
    fetchWithAuth<MajorDetail>(`/admin/majors/${id}/courses`, {
      method: 'PUT',
      body: JSON.stringify(courseIds),
    }),

  // ==================== Image Upload ====================
  uploadImage: async (file: File, folder: string = 'admin'): Promise<{ imageUrl: string; imageKey: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/admin/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // ==================== Sticker Management ====================
  getStickerPacks: () =>
    fetchWithAuth<StickerPack[]>('/admin/sticker-packs'),

  createStickerPack: (req: { name: string; sortOrder?: number }) =>
    fetchWithAuth<StickerPack>('/admin/sticker-packs', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  updateStickerPack: (id: number, req: { name?: string; sortOrder?: number; isActive?: boolean }) =>
    fetchWithAuth<StickerPack>(`/admin/sticker-packs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),

  deleteStickerPack: (id: number) =>
    fetchWithAuth<{ message: string }>(`/admin/sticker-packs/${id}`, {
      method: 'DELETE',
    }),

  uploadStickers: async (packId: number, files: File[]): Promise<StickerItem[]> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/admin/sticker-packs/${packId}/stickers`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  deleteSticker: (id: number) =>
    fetchWithAuth<{ message: string }>(`/admin/stickers/${id}`, {
      method: 'DELETE',
    }),

  // ==================== Landmark Management ====================
  getLandmarks: () =>
    fetchWithAuth<import('../types').CampusLandmark[]>('/admin/landmarks'),

  getLandmark: (id: number) =>
    fetchWithAuth<import('../types').CampusLandmark>(`/admin/landmarks/${id}`),

  createLandmark: (request: { name: string; description?: string; latitude: number; longitude: number; radiusMeters?: number; iconType?: string }) =>
    fetchWithAuth<import('../types').CampusLandmark>('/admin/landmarks', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateLandmark: (id: number, request: { name: string; description?: string; latitude: number; longitude: number; radiusMeters?: number; iconType?: string }) =>
    fetchWithAuth<import('../types').CampusLandmark>(`/admin/landmarks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteLandmark: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/landmarks/${id}`, {
      method: 'DELETE',
    }),
};

// Majors API
import type {
  MajorSummary,
  MajorDetail,
  UserMajor,
  UserMajorProgress,
  EnrollMajorRequest,
  CreateMajorRequest,
  UpdateMajorRequest,
} from '../types';

export const majorsApi = {
  /**
   * Get all majors (public)
   */
  getAllMajors: () =>
    fetchWithAuth<MajorSummary[]>('/majors'),

  /**
   * Get major detail (public)
   */
  getMajorDetail: (id: number) =>
    fetchWithAuth<MajorDetail>(`/majors/${id}`),

  /**
   * Get majors with user enrollment status (authenticated)
   */
  getMajorsWithStatus: () =>
    fetchWithAuth<MajorSummary[]>('/majors/with-status'),

  /**
   * Get major detail with user course status (authenticated)
   */
  getMajorDetailWithStatus: (id: number) =>
    fetchWithAuth<MajorDetail>(`/majors/${id}/detail`),

  /**
   * Enroll in a major
   */
  enrollMajor: (request: EnrollMajorRequest) =>
    fetchWithAuth<UserMajor>('/majors/enroll', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * Drop current major
   */
  dropMajor: () =>
    fetchWithAuth<{ message: string }>('/majors/drop', {
      method: 'DELETE',
    }),

  /**
   * Get current major progress
   */
  getMyProgress: () =>
    fetchWithAuth<UserMajorProgress | { message: string }>('/majors/my-progress'),

  /**
   * Get major enrollment history
   */
  getHistory: () =>
    fetchWithAuth<UserMajor[]>('/majors/history'),
};

// Roulette Game API
import type {
  RouletteGameSummary,
  RouletteGameDetail,
  CreateRouletteGameRequest,
  PlaySessionResponse,
  RollDiceResponse,
  CompleteRollRequest,
  RouletteTaskInstance,
  ActiveSessionSummary,
  UpdateTaskInstanceRequest,
  CompleteTaskInstanceRequest,
} from '../types';

export const rouletteApi = {
  // ==================== Game CRUD ====================
  listGames: (limit = 20, offset = 0, search?: string, tag?: string) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    if (tag) params.set('tag', tag);
    return fetchWithAuth<RouletteGameSummary[]>(`/roulette/games?${params.toString()}`);
  },

  listMyGames: () =>
    fetchWithAuth<RouletteGameSummary[]>('/roulette/games/mine'),

  getGame: (id: number) =>
    fetchWithAuth<RouletteGameDetail>(`/roulette/games/${id}`),

  createGame: (request: CreateRouletteGameRequest) =>
    fetchWithAuth<RouletteGameDetail>('/roulette/games', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateGame: (id: number, request: CreateRouletteGameRequest) =>
    fetchWithAuth<RouletteGameDetail>(`/roulette/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteGame: (id: number) =>
    fetchWithAuth<{ message: string }>(`/roulette/games/${id}`, {
      method: 'DELETE',
    }),

  publishGame: (id: number) =>
    fetchWithAuth<RouletteGameDetail>(`/roulette/games/${id}/publish`, {
      method: 'POST',
    }),

  toggleLike: (id: number) =>
    fetchWithAuth<{ isLiked: boolean }>(`/roulette/games/${id}/like`, {
      method: 'POST',
    }),

  toggleFavorite: (id: number) =>
    fetchWithAuth<{ isFavorited: boolean }>(`/roulette/games/${id}/favorite`, {
      method: 'POST',
    }),

  listFavorites: () =>
    fetchWithAuth<RouletteGameSummary[]>('/roulette/games/favorites'),

  // ==================== 购买 ====================
  purchaseGame: (gameId: number) =>
    fetchWithAuth<{ message: string }>(`/roulette/games/${gameId}/purchase`, {
      method: 'POST',
    }),

  // ==================== Wheel Roll ====================
  rollWheel: (gameId: number) =>
    fetchWithAuth<import('../types').WheelRollResponse>(`/roulette/games/${gameId}/wheel-roll`, {
      method: 'POST',
    }),

  // ==================== Play ====================
  startGame: (gameId: number) =>
    fetchWithAuth<PlaySessionResponse>(`/roulette/games/${gameId}/play`, {
      method: 'POST',
    }),

  getSession: (sessionId: number) =>
    fetchWithAuth<PlaySessionResponse>(`/roulette/sessions/${sessionId}`),

  rollDice: (sessionId: number) =>
    fetchWithAuth<RollDiceResponse>(`/roulette/sessions/${sessionId}/roll`, {
      method: 'POST',
    }),

  completeRoll: (sessionId: number, rollId: number, request: CompleteRollRequest) =>
    fetchWithAuth<PlaySessionResponse>(`/roulette/sessions/${sessionId}/complete/${rollId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  abandonSession: (sessionId: number) =>
    fetchWithAuth<{ message: string }>(`/roulette/sessions/${sessionId}/abandon`, {
      method: 'POST',
    }),

  // ==================== Active Sessions ====================
  listActiveSessions: () =>
    fetchWithAuth<ActiveSessionSummary[]>('/roulette/sessions/active'),

  // ==================== Task Instances ====================
  updateTaskProgress: (taskId: number, request: UpdateTaskInstanceRequest) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}/progress`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  completeTaskInstance: (taskId: number, request: CompleteTaskInstanceRequest) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getPendingTasks: () =>
    fetchWithAuth<RouletteTaskInstance[]>('/roulette/tasks/pending'),

  getTaskInstance: (taskId: number) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}`),

  startTaskInstance: (taskId: number) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}/start`, {
      method: 'POST',
    }),

  skipTaskInstance: (taskId: number) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}/skip`, {
      method: 'POST',
    }),

  submitTaskProof: (taskId: number, request: { proofImageKey?: string; proofText?: string }) =>
    fetchWithAuth<RouletteTaskInstance>(`/roulette/tasks/${taskId}/proof`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // ==================== Image Upload ====================
  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/roulette/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // ==================== Node Script API ====================
  getScript: (gameId: number) =>
    fetchWithAuth<{ graphData: string | null; version: number; isPublished: boolean }>(
      `/roulette/scripts/${gameId}`
    ),

  saveScript: (gameId: number, graphJson: string) =>
    fetchWithAuth<{ version: number }>(`/roulette/scripts/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify({ graphData: graphJson }),
    }),

  validateScript: (gameId: number) =>
    fetchWithAuth<import('../components/node-editor/types').ScriptValidationResult>(
      `/roulette/scripts/${gameId}/validate`,
      { method: 'POST' }
    ),

  publishScript: (gameId: number) =>
    fetchWithAuth<{ success: boolean }>(`/roulette/scripts/${gameId}/publish`, {
      method: 'POST',
    }),

  startScriptExecution: (gameId: number) =>
    fetchWithAuth<import('../components/node-editor/types').ScriptExecutionResponse>(
      `/roulette/games/${gameId}/play-script`,
      { method: 'POST' }
    ),

  getScriptExecution: (executionId: number) =>
    fetchWithAuth<import('../components/node-editor/types').ScriptExecutionResponse>(
      `/roulette/scripts/executions/${executionId}`
    ),

  submitScriptInput: (executionId: number, input: { nodeId: string; value: string }) =>
    fetchWithAuth<import('../components/node-editor/types').ScriptExecutionResponse>(
      `/roulette/scripts/executions/${executionId}/input`,
      { method: 'POST', body: JSON.stringify(input) }
    ),

  abandonScriptExecution: (executionId: number) =>
    fetchWithAuth<void>(`/roulette/scripts/executions/${executionId}/abandon`, {
      method: 'POST',
    }),

  getActiveScriptExecutions: () =>
    fetchWithAuth<Array<{ id: number; gameId: number; status: string }>>(
      `/roulette/scripts/executions/active`
    ),

  // ==================== 评论 ====================
  getComments: (gameId: number, limit: number = 20, offset: number = 0) =>
    fetchWithAuth<import('../types').GameCommentListResponse>(
      `/roulette/games/${gameId}/comments?limit=${limit}&offset=${offset}`
    ),

  postComment: (
    gameId: number,
    request: { content: string; imageUrl?: string; parentId?: number; replyToCommentId?: number }
  ) =>
    fetchWithAuth<import('../types').GameComment>(`/roulette/games/${gameId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteComment: (commentId: number) =>
    fetchWithAuth<{ message: string }>(`/roulette/games/comments/${commentId}`, {
      method: 'DELETE',
    }),

  toggleCommentLike: (commentId: number) =>
    fetchWithAuth<{ isLiked: boolean }>(`/roulette/games/comments/${commentId}/like`, {
      method: 'POST',
    }),

  // ==================== 打赏 ====================
  tipGame: (gameId: number, request: { amount: number; message?: string }) =>
    fetchWithAuth<{ message: string; tip: import('../types').GameTip }>(
      `/roulette/games/${gameId}/tip`,
      { method: 'POST', body: JSON.stringify(request) }
    ),

  getGameTips: (gameId: number, limit: number = 50) =>
    fetchWithAuth<import('../types').GameTip[]>(`/roulette/games/${gameId}/tips?limit=${limit}`),
};

// ===== Changelog API (public) =====

export const changelogApi = {
  getAll: (limit: number = 20) =>
    fetchWithAuth<import('../types').ChangelogData[]>(`/changelogs?limit=${limit}`),
};

// ===== Admin Changelog API =====

export const adminChangelogApi = {
  getAll: () =>
    fetchWithAuth<import('../types').ChangelogData[]>('/admin/changelogs'),

  create: (data: import('../types').CreateChangelogRequest) =>
    fetchWithAuth<import('../types').ChangelogData>('/admin/changelogs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: import('../types').UpdateChangelogRequest) =>
    fetchWithAuth<import('../types').ChangelogData>(`/admin/changelogs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/changelogs/${id}`, {
      method: 'DELETE',
    }),
};

// ===== Verification Photo API =====

export const verificationApi = {
  getStatus: (lockId: number) =>
    fetchWithAuth<import('../types').VerificationStatusResponse>(`/locks/${lockId}/verification/status`),

  upload: async (lockId: number, file: File): Promise<import('../types').VerificationPhotoData> => {
    const formData = new FormData();
    formData.append('image', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/locks/${lockId}/verification/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  getPhotos: (lockId: number) =>
    fetchWithAuth<import('../types').VerificationPhotoData[]>(`/locks/${lockId}/verification/photos`),

  getWindows: (lockId: number, date?: string) =>
    fetchWithAuth<import('../types').VerificationWindowData[]>(
      `/locks/${lockId}/verification/windows${date ? `?date=${date}` : ''}`
    ),
};

// ===== Library/Books API =====

export const booksApi = {
  getBooks: (params?: { categoryId?: number; search?: string; excludeSeriesBooks?: boolean; authorId?: number; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set('categoryId', String(params.categoryId));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.excludeSeriesBooks) searchParams.set('excludeSeriesBooks', 'true');
    if (params?.authorId) searchParams.set('authorId', String(params.authorId));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return fetchWithAuth<import('../types').BookListResponse>(`/books${qs ? `?${qs}` : ''}`);
  },

  getCategories: () =>
    fetchWithAuth<import('../types').BookCategory[]>('/books/categories'),

  getBookDetail: (id: number) =>
    fetchWithAuth<import('../types').BookDetail>(`/books/${id}`),

  purchaseBook: (id: number) =>
    fetchWithAuth<import('../types').PurchaseBookResponse>(`/books/${id}/purchase`, { method: 'POST' }),

  getMyPurchases: () =>
    fetchWithAuth<import('../types').BookSummary[]>('/books/my-purchases'),

  // 系列
  getSeries: (params?: { categoryId?: number; search?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set('categoryId', String(params.categoryId));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return fetchWithAuth<import('../types').BookSeriesListResponse>(`/books/series${qs ? `?${qs}` : ''}`);
  },

  getSeriesDetail: (id: number) =>
    fetchWithAuth<import('../types').BookSeriesDetailResponse>(`/books/series/${id}`),

  // 阅读进度
  getRecentlyRead: () =>
    fetchWithAuth<import('../types').ReadingProgressData[]>('/books/recently-read'),

  updateReadingProgress: (bookId: number, scrollPosition: number) =>
    fetchWithAuth<{ message: string }>(`/books/${bookId}/reading-progress`, {
      method: 'PUT',
      body: JSON.stringify({ scrollPosition }),
    }),

  getReadingProgress: (bookId: number) =>
    fetchWithAuth<import('../types').ReadingProgressData>(`/books/${bookId}/reading-progress`),

  // 用户上传
  getMyUploads: () =>
    fetchWithAuth<import('../types').BookSummary[]>('/books/my-uploads'),

  getMySeries: () =>
    fetchWithAuth<import('../types').BookSeriesData[]>('/books/my-uploads/series'),

  uploadBook: (request: import('../types').UserUploadBookRequest) =>
    fetchWithAuth<import('../types').UserUploadResponse>('/books/upload', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  createSeries: (request: import('../types').CreateBookSeriesRequest) =>
    fetchWithAuth<import('../types').BookSeriesData>('/books/upload/series', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  uploadUserCover: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const headers = getUploadHeaders();
    const response = await fetch(`${API_BASE_URL}/books/upload/cover`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  updateMyBook: (id: number, request: import('../types').UpdateBookRequest) =>
    fetchWithAuth<import('../types').BookSummary>(`/books/my-uploads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteMyBook: (id: number) =>
    fetchWithAuth<{ message: string }>(`/books/my-uploads/${id}`, { method: 'DELETE' }),

  // 评论
  getComments: (bookId: number, limit = 20, offset = 0) =>
    fetchWithAuth<import('../types').BookCommentListResponse>(`/books/${bookId}/comments?limit=${limit}&offset=${offset}`),

  createComment: (bookId: number, request: import('../types').CreateBookCommentRequest) =>
    fetchWithAuth<import('../types').BookCommentItem>(`/books/${bookId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteComment: (bookId: number, commentId: number) =>
    fetchWithAuth<{ message: string }>(`/books/${bookId}/comments/${commentId}`, { method: 'DELETE' }),

  toggleCommentLike: (bookId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/books/${bookId}/comments/${commentId}/like`, { method: 'POST' }),
};

// ===== Admin Books API =====

export const adminBooksApi = {
  getBooks: (params?: { categoryId?: number; search?: string; page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set('categoryId', String(params.categoryId));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    const qs = searchParams.toString();
    return fetchWithAuth<import('../types').BookListResponse>(`/admin/books${qs ? `?${qs}` : ''}`);
  },

  getBook: (id: number) =>
    fetchWithAuth<import('../types').BookSummary>(`/admin/books/${id}`),

  createBook: (request: import('../types').CreateBookRequest) =>
    fetchWithAuth<import('../types').BookSummary>('/admin/books', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateBook: (id: number, request: import('../types').UpdateBookRequest) =>
    fetchWithAuth<import('../types').BookSummary>(`/admin/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteBook: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/books/${id}`, { method: 'DELETE' }),

  uploadBookCover: async (bookId: number, file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/admin/books/${bookId}/cover`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  getCategories: () =>
    fetchWithAuth<import('../types').BookCategory[]>('/admin/book-categories'),

  createCategory: (request: { name: string; description?: string; iconUrl?: string; sortOrder?: number }) =>
    fetchWithAuth<import('../types').BookCategory>('/admin/book-categories', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateCategory: (id: number, request: Partial<{ name: string; description: string; iconUrl: string; sortOrder: number; isActive: boolean }>) =>
    fetchWithAuth<import('../types').BookCategory>(`/admin/book-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteCategory: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/book-categories/${id}`, { method: 'DELETE' }),

  // 审核
  getPendingReviews: (params?: { status?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return fetchWithAuth<import('../types').BookListResponse>(`/admin/book-reviews${qs ? `?${qs}` : ''}`);
  },

  reviewBook: (id: number, request: import('../types').ReviewBookRequest) =>
    fetchWithAuth<import('../types').BookSummary>(`/admin/book-reviews/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // 系列管理
  getAllSeries: (params?: { page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return fetchWithAuth<import('../types').BookSeriesListResponse>(`/admin/book-series${qs ? `?${qs}` : ''}`);
  },

  createSeries: (request: import('../types').CreateBookSeriesRequest) =>
    fetchWithAuth<import('../types').BookSeriesData>('/admin/book-series', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateSeries: (id: number, request: import('../types').UpdateBookSeriesRequest) =>
    fetchWithAuth<{ success: boolean }>(`/admin/book-series/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteSeries: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/book-series/${id}`, { method: 'DELETE' }),
};

// Therapy Room API (for inline waveform picker)
export interface TherapySessionStatusData {
  sessionId: number;
  shareCode: string;
  isActive: boolean;
  strengthA: number;
  strengthB: number;
  strengthLimitA: number;
  strengthLimitB: number;
  currentController: { controllerName: string; status: string } | null;
  queueLength: number;
  myQueuePosition: number | null;
  controlTimeLeftSeconds: number | null;
}

export interface LocalWaveformPreset {
  name: string;
  hexData: string[];
  isCustom: boolean;
  customId?: number;
}

export const therapyApi = {
  getWaveforms: (shareCode: string) =>
    fetchWithAuth<{ waveforms: string[]; currentWaveformA: string; currentWaveformB: string }>(`/therapy/session/${shareCode}/waveforms`),
  changeWaveform: (shareCode: string, waveformName: string, channel: 'A' | 'B' | 'AB' = 'AB') =>
    fetchWithAuth<{ message: string }>(`/therapy/session/${shareCode}/waveform`, {
      method: 'POST',
      body: JSON.stringify({ waveformName, channel }),
    }),
  getSessionStatus: (shareCode: string, identity?: string) =>
    fetch(`${API_BASE_URL}/therapy/session/${shareCode}/status${identity ? `?identity=${encodeURIComponent(identity)}` : ''}`)
      .then(r => r.json()) as Promise<TherapySessionStatusData>,
  /** 获取波形预设（含 hex 数据）—— 本地 BLE 模式使用 */
  getWaveformPresets: (deviceType: string) =>
    fetchWithAuth<{ presets: LocalWaveformPreset[] }>(`/therapy/waveform-presets?deviceType=${deviceType}`),
};

// Custom Waveform API
export const waveformApi = {
  // Get user's custom waveforms
  getMyWaveforms: () =>
    fetchWithAuth<import('../types').CustomWaveformListResponse>('/waveforms'),

  // Get single waveform
  getWaveform: (id: number) =>
    fetchWithAuth<import('../types').CustomWaveform>(`/waveforms/${id}`),

  // Save (create or update) waveform
  saveWaveform: (request: import('../types').SaveCustomWaveformRequest) =>
    fetchWithAuth<import('../types').CustomWaveform>('/waveforms', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // Delete waveform
  deleteWaveform: (id: number) =>
    fetchWithAuth<{ success: boolean; message: string }>(`/waveforms/${id}`, { method: 'DELETE' }),

  // Preview waveform (get V3 data without saving)
  previewWaveform: (request: import('../types').PreviewWaveformRequest) =>
    fetchWithAuth<import('../types').PreviewWaveformResponse>('/waveforms/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // Get default section configuration
  getDefaultSection: () =>
    fetchWithAuth<import('../types').WaveformSection>('/waveforms/default-section'),

  // Get public waveforms
  getPublicWaveforms: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchWithAuth<import('../types').CustomWaveformListResponse>(`/waveforms/public${query}`);
  },
};

// Task Request API (求任务系统)
export const taskRequestApi = {
  getRequests: (params?: { status?: TaskRequestStatus; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset !== undefined) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchWithAuth<TaskRequestSummary[]>(`/task-requests${query}`);
  },

  getRequest: (id: number) =>
    fetchWithAuth<TaskRequestDetail>(`/task-requests/${id}`),

  createRequest: (request: CreateTaskRequestRequest) =>
    fetchWithAuth<TaskRequestDetail>('/task-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  cancelRequest: (id: number) =>
    fetchWithAuth<{ message: string }>(`/task-requests/${id}`, { method: 'DELETE' }),

  submitProposal: (requestId: number, request: SubmitProposalRequest) =>
    fetchWithAuth<TaskRequestProposalDetail>(`/task-requests/${requestId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getProposals: (requestId: number) =>
    fetchWithAuth<TaskRequestProposalDetail[]>(`/task-requests/${requestId}/proposals`),

  selectWinner: (requestId: number, request: SelectWinnerRequest) =>
    fetchWithAuth<TaskRequestDetail>(`/task-requests/${requestId}/select-winner`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getMyRequests: () =>
    fetchWithAuth<TaskRequestSummary[]>('/task-requests/my'),

  getMyProposals: () =>
    fetchWithAuth<TaskRequestProposalDetail[]>('/task-requests/my-proposals'),
};

// ==================== Card Image API ====================

export const cardImageApi = {
  getCardImage: (userId: number) =>
    fetchWithAuth<{ imageUrl: string; hash: string }>(`/users/${userId}/card-image`),

  uploadCardImage: async (userId: number, imageBlob: Blob, hash: string) => {
    const formData = new FormData();
    formData.append('image', imageBlob, 'card.png');
    formData.append('hash', hash);

    const headers = getUploadHeaders();

    const response = await fetch(`${API_BASE_URL}/users/me/card-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ imageUrl: string; hash: string }>;
  },

  /** Proxy an external image through our server to bypass CORS */
  fetchProxyImage: async (url: string): Promise<Blob> => {
    const headers = getUploadHeaders();

    const response = await fetch(
      `${API_BASE_URL}/users/proxy-image?url=${encodeURIComponent(url)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.status}`);
    }

    return response.blob();
  },
};

// ========== 役次元锁盒 API ==========

import type {
  YiciyuanAccountStatus,
  YiciyuanLoginRequest,
  YiciyuanLoginResponse,
  YiciyuanBindResult,
  YiciyuanDeviceCredentials,
  YiciyuanDeviceInfo,
} from '../types';

export const yiciyuanApi = {
  /** 获取账号状态 */
  getAccount: () =>
    fetchWithAuth<YiciyuanAccountStatus>('/yiciyuan/account'),

  /** 发送短信验证码 */
  sendCode: (phone: string) =>
    fetchWithAuth<{ message: string }>('/yiciyuan/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /** 登录役次元 */
  login: (data: YiciyuanLoginRequest) =>
    fetchWithAuth<YiciyuanLoginResponse>('/yiciyuan/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 绑定设备 */
  bindDevice: (mac: string, name: string) =>
    fetchWithAuth<YiciyuanBindResult>('/yiciyuan/bind-device', {
      method: 'POST',
      body: JSON.stringify({ mac, name }),
    }),

  /** 将设备关联到锁 */
  bindDeviceToLock: (mac: string, lockId: number) =>
    fetchWithAuth<{ message: string }>('/yiciyuan/bind-device-to-lock', {
      method: 'POST',
      body: JSON.stringify({ mac, lockId: String(lockId) }),
    }),

  /** 获取设备 BLE 凭据（通过锁ID） */
  getDeviceCredentials: (lockId: number) =>
    fetchWithAuth<YiciyuanDeviceCredentials>(`/yiciyuan/device-credentials/${lockId}`),

  /** 通过 MAC 地址获取已绑定设备的凭据（不需要役次元登录） */
  getDeviceCredentialsByMac: (mac: string) =>
    fetchWithAuth<YiciyuanDeviceCredentials>(`/yiciyuan/device-credentials-by-mac/${encodeURIComponent(mac)}`),

  /** 获取用户唯一设备的凭据（Web/iOS 无 MAC 时使用） */
  getDeviceCredentialsForUser: () =>
    fetchWithAuth<YiciyuanDeviceCredentials>('/yiciyuan/device-credentials-for-user'),

  /** 注销役次元账号 */
  deleteAccount: () =>
    fetchWithAuth<{ message: string }>('/yiciyuan/account', {
      method: 'DELETE',
    }),

  /** 获取绑定的设备列表 */
  getDevices: () =>
    fetchWithAuth<YiciyuanDeviceInfo[]>('/yiciyuan/devices'),

  /** 解绑单个设备 */
  unbindDevice: (deviceId: number) =>
    fetchWithAuth<{ message: string }>(`/yiciyuan/devices/${deviceId}`, {
      method: 'DELETE',
    }),
};

// ========== 贴纸反应 API ==========

import type { StickerPack, StickerItem, CommentReactionSummary } from '../types';

export const stickerApi = {
  /** 获取所有激活的贴纸组（含贴纸，用于 picker） */
  getActivePacks: () =>
    fetchWithAuth<StickerPack[]>('/stickers/packs'),

  /** 切换校园任务评论反应 */
  toggleReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/campus-tasks/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),

  /** 切换社区帖子评论反应 */
  togglePostReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/posts/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),

  /** 切换操场锁评论反应 */
  toggleLockReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/locks/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),

  /** 切换图书评论反应 */
  toggleBookReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/books/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),

  /** 切换电影院评论反应 */
  toggleCinemaReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/cinema/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),

  /** 切换美术馆评论反应 */
  toggleGalleryReaction: (commentId: number, stickerId: number) =>
    fetchWithAuth<{ added: boolean; reactions: CommentReactionSummary[] }>(
      `/gallery/comments/${commentId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ stickerId }),
      }
    ),
};

// ============ Foundation API ============

export const foundationApi = {
  getOverview: () =>
    fetchWithAuth<import('../types').FoundationOverviewResponse>('/foundation'),

  createApplication: (request: import('../types').CreateFoundationApplicationRequest) =>
    fetchWithAuth<import('../types').FoundationApplicationData>('/foundation/applications', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getMyApplications: () =>
    fetchWithAuth<import('../types').FoundationApplicationData[]>('/foundation/applications/my'),
};

export const adminFoundationApi = {
  createTransaction: (request: import('../types').CreateFoundationTransactionRequest) =>
    fetchWithAuth<import('../types').FoundationTransactionData>('/admin/foundation/transactions', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteTransaction: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/foundation/transactions/${id}`, {
      method: 'DELETE',
    }),

  createSponsor: (request: import('../types').CreateFoundationSponsorRequest) =>
    fetchWithAuth<import('../types').FoundationSponsorData>('/admin/foundation/sponsors', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteSponsor: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/admin/foundation/sponsors/${id}`, {
      method: 'DELETE',
    }),

  getAllApplications: (limit = 100, offset = 0) =>
    fetchWithAuth<import('../types').FoundationApplicationData[]>(
      `/admin/foundation/applications?limit=${limit}&offset=${offset}`
    ),

  updateApplicationStatus: (id: number, request: import('../types').UpdateFoundationApplicationStatusRequest) =>
    fetchWithAuth<{ success: boolean }>(`/admin/foundation/applications/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),
};

// ==================== Media Tags API ====================
export const mediaTagsApi = {
  getPopular: () =>
    fetchWithAuth<{ tags: string[] }>('/media/tags/popular'),

  search: (q: string) =>
    fetchWithAuth<{ tags: string[] }>(`/media/tags/search?q=${encodeURIComponent(q)}`),
};

// ==================== Gallery API ====================
export const galleryApi = {
  getItems: (params?: { search?: string; sortBy?: string; authorId?: number; tag?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy && params.sortBy !== 'latest') query.set('sortBy', params.sortBy);
    if (params?.authorId) query.set('authorId', String(params.authorId));
    if (params?.tag) query.set('tag', params.tag);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return fetchWithAuth<import('../types').GalleryListResponse>(`/gallery${qs ? `?${qs}` : ''}`);
  },

  getDetail: (id: number) =>
    fetchWithAuth<import('../types').GalleryItemDetail>(`/gallery/${id}`),

  getMyUploads: () =>
    fetchWithAuth<import('../types').GalleryItemSummary[]>('/gallery/my'),

  getMyPurchases: () =>
    fetchWithAuth<import('../types').GalleryItemSummary[]>('/gallery/my-purchases'),

  deleteMyItem: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/gallery/my/${id}`, { method: 'DELETE' }),

  upload: (formData: FormData) =>
    fetch(`${API_BASE_URL}/gallery/upload`, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    }),

  purchase: (id: number) =>
    fetchWithAuth<import('../types').PurchaseGalleryResponse>(`/gallery/${id}/purchase`, { method: 'POST' }),

  toggleLike: (id: number) =>
    fetchWithAuth<{ liked: boolean }>(`/gallery/${id}/like`, { method: 'POST' }),

  // 评论系统
  getComments: (itemId: number, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return fetchWithAuth<import('../types').GalleryCommentListResponse>(`/gallery/${itemId}/comments${qs ? `?${qs}` : ''}`);
  },

  postComment: (itemId: number, request: { content: string; parentId?: number; replyToCommentId?: number }) =>
    fetchWithAuth<import('../types').GalleryCommentItem>(`/gallery/${itemId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteComment: (itemId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/gallery/${itemId}/comments/${commentId}`, { method: 'DELETE' }),

  toggleCommentLike: (itemId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/gallery/${itemId}/comments/${commentId}/like`, { method: 'POST' }),
};

// ==================== Cinema API ====================
export const cinemaApi = {
  getVideos: (params?: { search?: string; sortBy?: string; authorId?: number; tag?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy && params.sortBy !== 'latest') query.set('sortBy', params.sortBy);
    if (params?.authorId) query.set('authorId', String(params.authorId));
    if (params?.tag) query.set('tag', params.tag);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return fetchWithAuth<import('../types').CinemaListResponse>(`/cinema${qs ? `?${qs}` : ''}`);
  },

  getDetail: (id: number) =>
    fetchWithAuth<import('../types').CinemaVideoDetail>(`/cinema/${id}`),

  getMyUploads: () =>
    fetchWithAuth<import('../types').CinemaVideoSummary[]>('/cinema/my'),

  getMyPurchases: () =>
    fetchWithAuth<import('../types').CinemaVideoSummary[]>('/cinema/my-purchases'),

  createUploadUrl: (data: { title: string; description?: string; priceCampusPoints: number; tags?: string[] }) =>
    fetchWithAuth<import('../types').CinemaUploadUrlResponse>('/cinema/upload-url', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadCover: (videoId: number, formData: FormData) =>
    fetch(`${API_BASE_URL}/cinema/${videoId}/upload-cover`, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json() as Promise<{ coverImageUrl: string }>;
    }),

  confirmUpload: (videoId: number) =>
    fetchWithAuth<import('../types').CinemaVideoDetail>(`/cinema/${videoId}/confirm-upload`, { method: 'POST' }),

  purchase: (id: number) =>
    fetchWithAuth<import('../types').PurchaseCinemaResponse>(`/cinema/${id}/purchase`, { method: 'POST' }),

  toggleLike: (id: number) =>
    fetchWithAuth<{ liked: boolean }>(`/cinema/${id}/like`, { method: 'POST' }),

  deleteMyVideo: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/cinema/my/${id}`, { method: 'DELETE' }),

  // 评论系统
  getComments: (videoId: number, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return fetchWithAuth<import('../types').CinemaCommentListResponse>(`/cinema/${videoId}/comments${qs ? `?${qs}` : ''}`);
  },

  postComment: (videoId: number, request: { content: string; parentId?: number; replyToCommentId?: number }) =>
    fetchWithAuth<import('../types').CinemaCommentItem>(`/cinema/${videoId}/comments`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteComment: (videoId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/cinema/${videoId}/comments/${commentId}`, { method: 'DELETE' }),

  toggleCommentLike: (videoId: number, commentId: number) =>
    fetchWithAuth<{ success: boolean }>(`/cinema/${videoId}/comments/${commentId}/like`, { method: 'POST' }),
};

// ==================== Admin Gallery Review API ====================
export const adminGalleryApi = {
  getPending: () =>
    fetchWithAuth<import('../types').GalleryReviewItem[]>('/admin/gallery/pending'),

  review: (id: number, request: { approved: boolean; rejectionReason?: string }) =>
    fetchWithAuth<{ success: boolean }>(`/admin/gallery/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  takedown: (id: number, reason?: string) =>
    fetchWithAuth<{ success: boolean }>(`/admin/gallery/${id}/takedown`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// ==================== Admin Cinema Review API ====================
export const adminCinemaApi = {
  getPending: () =>
    fetchWithAuth<import('../types').CinemaVideoSummary[]>('/admin/cinema/pending'),

  review: (id: number, request: { approved: boolean; rejectionReason?: string }) =>
    fetchWithAuth<{ success: boolean }>(`/admin/cinema/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  takedown: (id: number, reason?: string) =>
    fetchWithAuth<{ success: boolean }>(`/admin/cinema/${id}/takedown`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  syncMux: () =>
    fetchWithAuth<{ total: number; updated: number; failed: number }>('/admin/cinema/sync-mux', {
      method: 'POST',
    }),
};

// ==================== Review Assignment API ====================
export interface ReviewAssignmentData {
  id: number;
  reviewerId: number;
  contentType: string;
  contentId: number;
  status: string;
  reviewNote: string | null;
  assignedAt: string;
  reviewedAt: string | null;
}

export interface ReviewAssignmentWithContent {
  assignment: ReviewAssignmentData;
  contentTitle: string | null;
  contentDescription: string | null;
  contentAuthorName: string | null;
  contentThumbnailUrl: string | null;
  galleryItem: import('../types').GalleryReviewItem | null;
  cinemaVideo: import('../types').CinemaVideoSummary | null;
}

export interface ReviewAssignmentResponse {
  assignments: ReviewAssignmentWithContent[];
  remainingToday: number;
  maxPerDay: number;
}

export const reviewAssignmentApi = {
  getMyAssignments: () =>
    fetchWithAuth<ReviewAssignmentResponse>('/admin/review-assignments'),

  requestAssignments: () =>
    fetchWithAuth<ReviewAssignmentResponse>('/admin/review-assignments/request', {
      method: 'POST',
    }),

  submitReview: (assignmentId: number, request: { approved: boolean; rejectionReason?: string }) =>
    fetchWithAuth<{ success: boolean }>(`/admin/review-assignments/${assignmentId}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

export const boardApi = {
  getBoard: (userId: number) =>
    fetchWithAuth<import('../types').BoardResponse>(`/users/${userId}/board`),

  getMyBoard: () =>
    fetchWithAuth<import('../types').BoardResponse>('/users/me/board'),

  saveBoard: (blocks: import('../types').BoardBlock[]) =>
    fetchWithAuth<import('../types').BoardResponse>('/users/me/board', {
      method: 'PUT',
      body: JSON.stringify({ blocks }),
    }),

  uploadImage: async (file: File): Promise<{ imageUrl: string; imageKey: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const headers = getUploadHeaders();
    const response = await fetch(`${API_BASE_URL}/users/me/board/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return response.json();
  },

  getWidgetCourses: (userId: number) =>
    fetchWithAuth<import('../types').PublicCoursesWidgetData>(`/users/${userId}/widget/courses`),

  getWidgetTodayTasks: (userId: number) =>
    fetchWithAuth<import('../types').PublicTaskSummary>(`/users/${userId}/widget/today-tasks`),
};

export const liveStreamApi = {
  getStatus: () =>
    fetchWithAuth<import('../types').RoomStatusResponse>('/live-stream/status'),

  startStream: (title: string = '') =>
    fetchWithAuth<import('../types').StartStreamResponse>('/live-stream/start', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  stopStream: () =>
    fetchWithAuth<{ message: string }>('/live-stream/stop', {
      method: 'POST',
    }),

  getReplays: (limit = 20, offset = 0) =>
    fetchWithAuth<import('../types').ReplayListResponse>(
      `/live-stream/replays?limit=${limit}&offset=${offset}`
    ),
};

// ==================== asmr.one API ====================
// Web: proxy via asmrone.lovein.fun to bypass CORS
// Native (Capacitor): direct access via CapacitorHttp (enabled in capacitor.config.ts)

const ASMR_DIRECT = 'https://api.asmr-200.com/api';
const ASMR_PROXY = 'https://asmrone.lovein.fun/api';

function getAsmrBase(): string {
  return isCapacitorNative() ? ASMR_DIRECT : ASMR_PROXY;
}

/** Convert asmr-200.com URLs — native: keep original, web: rewrite to proxy */
export function asmrProxyUrl(url: string): string {
  if (!url) return url;
  if (isCapacitorNative()) return url;
  return url.replace('https://api.asmr-200.com/api', ASMR_PROXY)
            .replace('https://api.asmr.one/api', ASMR_PROXY);
}

/** Get cover URL — native: direct, web: proxy */
export function asmrCoverUrl(workId: number, type: 'main' | 'sam' = 'sam'): string {
  return `${getAsmrBase()}/cover/${workId}.jpg?type=${type}`;
}

/** Pad work ID to 8 digits for API calls */
function padWorkId(id: number | string): string {
  const numStr = String(id).replace('RJ', '').replace(/^0+/, '');
  return numStr.padStart(8, '0');
}

async function asmrFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`ASMR API error: ${res.status}`);
  return res.json();
}

export const asmrApi = {
  getWorks: (params?: {
    page?: number; pageSize?: number; order?: string; sort?: string;
    subtitle?: number; tags?: number[]; vas?: string[]; circles?: number[];
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.order) query.set('order', params.order);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.subtitle !== undefined) query.set('subtitle', String(params.subtitle));
    params?.tags?.forEach(t => query.append('tags[]', String(t)));
    params?.vas?.forEach(v => query.append('vas[]', v));
    params?.circles?.forEach(c => query.append('circles[]', String(c)));
    const qs = query.toString();
    return asmrFetch<import('../types').AsmrWorksResponse>(`${getAsmrBase()}/works${qs ? `?${qs}` : ''}`);
  },

  search: (keyword: string, params?: {
    page?: number; pageSize?: number; order?: string; sort?: string; subtitle?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.order) query.set('order', params.order || 'rate_average_2dp');
    if (params?.sort) query.set('sort', params.sort || 'desc');
    if (params?.subtitle !== undefined) query.set('subtitle', String(params.subtitle));
    const qs = query.toString();
    return asmrFetch<import('../types').AsmrWorksResponse>(
      `${getAsmrBase()}/search/${encodeURIComponent(keyword)}${qs ? `?${qs}` : ''}`
    );
  },

  getWorkInfo: (id: number) =>
    asmrFetch<import('../types').AsmrWork>(`${getAsmrBase()}/workInfo/${padWorkId(id)}`),

  getTracks: (id: number) =>
    asmrFetch<import('../types').AsmrTrackNode[]>(`${getAsmrBase()}/tracks/${padWorkId(id)}?v=2`),

  getTagWorks: (tagId: number, params?: { page?: number; pageSize?: number; order?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    query.set('order', params?.order || 'create_date');
    query.set('sort', params?.sort || 'desc');
    return asmrFetch<import('../types').AsmrWorksResponse>(`${getAsmrBase()}/tags/${tagId}/works?${query}`);
  },

  getVAWorks: (vaId: string, params?: { page?: number; pageSize?: number; order?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    query.set('order', params?.order || 'create_date');
    query.set('sort', params?.sort || 'desc');
    return asmrFetch<import('../types').AsmrWorksResponse>(`${getAsmrBase()}/vas/${vaId}/works?${query}`);
  },

  getCircleWorks: (circleId: number, params?: { page?: number; pageSize?: number; order?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    query.set('order', params?.order || 'create_date');
    query.set('sort', params?.sort || 'desc');
    return asmrFetch<import('../types').AsmrWorksResponse>(`${getAsmrBase()}/circles/${circleId}/works?${query}`);
  },

  getPopular: (params?: { page?: number; pageSize?: number; subtitle?: number }) =>
    asmrFetch<import('../types').AsmrWorksResponse>(`${getAsmrBase()}/recommender/popular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: ' ',
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        subtitle: params?.subtitle ?? 0,
        localSubtitledWorks: [],
        withPlaylistStatus: [],
      }),
    }),
};

// ==================== Music Room Backend API ====================

export const musicApi = {
  // Likes
  toggleLike: (asmrWorkId: number) =>
    fetchWithAuth<{ liked: boolean }>('/music/likes/toggle', {
      method: 'POST',
      body: JSON.stringify({ asmrWorkId }),
    }),

  checkLike: (workId: number) =>
    fetchWithAuth<{ liked: boolean }>(`/music/likes/check/${workId}`),

  getLikes: (limit?: number, offset?: number) => {
    const query = new URLSearchParams();
    if (limit) query.set('limit', String(limit));
    if (offset) query.set('offset', String(offset));
    const qs = query.toString();
    return fetchWithAuth<{ workIds: number[]; total: number }>(`/music/likes${qs ? `?${qs}` : ''}`);
  },

  checkLikeBatch: (workIds: number[]) =>
    fetchWithAuth<{ likedWorkIds: number[] }>('/music/likes/check-batch', {
      method: 'POST',
      body: JSON.stringify({ workIds }),
    }),

  // Play progress
  saveProgress: (asmrWorkId: number, trackHash: string, currentTime: number, duration: number) =>
    fetchWithAuth<{ success: boolean }>('/music/progress', {
      method: 'POST',
      body: JSON.stringify({ asmrWorkId, trackHash, currentTime, duration }),
    }),

  getProgress: (workId: number) =>
    fetchWithAuth<import('../types').MusicPlayProgress[]>(`/music/progress/${workId}`),

  // Playlists
  getPlaylists: () =>
    fetchWithAuth<import('../types').MusicPlaylist[]>('/music/playlists'),

  createPlaylist: (name: string, description?: string) =>
    fetchWithAuth<import('../types').MusicPlaylist>('/music/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  updatePlaylist: (id: number, name?: string, description?: string) =>
    fetchWithAuth<import('../types').MusicPlaylist>(`/music/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    }),

  deletePlaylist: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/music/playlists/${id}`, { method: 'DELETE' }),

  getPlaylistItems: (playlistId: number) =>
    fetchWithAuth<import('../types').MusicPlaylistItem[]>(`/music/playlists/${playlistId}/items`),

  addToPlaylist: (playlistId: number, asmrWorkId: number) =>
    fetchWithAuth<import('../types').MusicPlaylistItem>(`/music/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ asmrWorkId }),
    }),

  removeFromPlaylist: (playlistId: number, asmrWorkId: number) =>
    fetchWithAuth<{ success: boolean }>(`/music/playlists/${playlistId}/items/${asmrWorkId}`, {
      method: 'DELETE',
    }),

  // Share
  sharePlaylist: (playlistId: number) =>
    fetchWithAuth<{ shareCode: string }>(`/music/playlists/${playlistId}/share`, { method: 'POST' }),

  unsharePlaylist: (playlistId: number) =>
    fetchWithAuth<{ success: boolean }>(`/music/playlists/${playlistId}/share`, { method: 'DELETE' }),

  getSharedPlaylist: (code: string) =>
    fetch(`${API_BASE_URL}/music/playlists/shared/${encodeURIComponent(code)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }) as Promise<import('../types').SharedPlaylistResponse>,

  importPlaylist: (code: string) =>
    fetchWithAuth<import('../types').MusicPlaylist>(`/music/playlists/import/${encodeURIComponent(code)}`, { method: 'POST' }),

  // Watch Later (稍后再听)
  getWatchLater: () =>
    fetchWithAuth<import('../types').MusicPlaylist>('/music/playlists/watch-later'),

  addToWatchLater: (asmrWorkId: number) =>
    fetchWithAuth<import('../types').MusicPlaylistItem>('/music/playlists/watch-later/items', {
      method: 'POST',
      body: JSON.stringify({ asmrWorkId }),
    }),

  removeFromWatchLater: (asmrWorkId: number) =>
    fetchWithAuth<{ success: boolean }>(`/music/playlists/watch-later/items/${asmrWorkId}`, { method: 'DELETE' }),

  // Follow - VA
  followVA: (vaId: string, vaName: string) =>
    fetchWithAuth<{ followed: boolean }>('/music/follow/va', {
      method: 'POST',
      body: JSON.stringify({ vaId, vaName }),
    }),
  unfollowVA: (vaId: string) =>
    fetchWithAuth<{ unfollowed: boolean }>(`/music/follow/va/${encodeURIComponent(vaId)}`, {
      method: 'DELETE',
    }),
  getFollowedVAs: () =>
    fetchWithAuth<import('../types').FollowedVA[]>('/music/follow/vas'),
  checkFollowVA: (vaId: string) =>
    fetchWithAuth<{ following: boolean }>(`/music/follow/va/${encodeURIComponent(vaId)}/check`),

  // Follow - Circle
  followCircle: (circleId: number, circleName: string) =>
    fetchWithAuth<{ followed: boolean }>('/music/follow/circle', {
      method: 'POST',
      body: JSON.stringify({ circleId, circleName }),
    }),
  unfollowCircle: (circleId: number) =>
    fetchWithAuth<{ unfollowed: boolean }>(`/music/follow/circle/${circleId}`, {
      method: 'DELETE',
    }),
  getFollowedCircles: () =>
    fetchWithAuth<import('../types').FollowedCircle[]>('/music/follow/circles'),
  checkFollowCircle: (circleId: number) =>
    fetchWithAuth<{ following: boolean }>(`/music/follow/circle/${circleId}/check`),

  // History
  getHistory: (limit = 50, offset = 0) =>
    fetchWithAuth<import('../types').ListeningHistoryResponse>(`/music/history?limit=${limit}&offset=${offset}`),

  // Catalog (server-cached)
  getTags: (params?: { search?: string; limit?: number; offset?: number; sort?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.sort) sp.set('sort', params.sort);
    return fetchWithAuth<import('../types').CatalogListResponse<import('../types').CachedTag>>(`/music/tags?${sp}`);
  },
  getCircles: (params?: { search?: string; limit?: number; offset?: number; sort?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.sort) sp.set('sort', params.sort);
    return fetchWithAuth<import('../types').CatalogListResponse<import('../types').CachedCircle>>(`/music/circles?${sp}`);
  },
  getVAs: (params?: { search?: string; limit?: number; offset?: number; sort?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.sort) sp.set('sort', params.sort);
    return fetchWithAuth<import('../types').CatalogListResponse<import('../types').CachedVA>>(`/music/vas?${sp}`);
  },
};

export const campusWalkApi = {
  getNearbyDrops: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').CampusDrop[]>(`/campus-walk/nearby?lat=${lat}&lng=${lng}`),

  placeDrop: async (data: {
    dropType: string;
    latitude: number;
    longitude: number;
    pickupRadiusMeters: number;
    content?: string;
    lockId?: number;
    opensAt?: string;
    images?: File[];
  }) => {
    const formData = new FormData();
    formData.append('dropType', data.dropType);
    formData.append('latitude', String(data.latitude));
    formData.append('longitude', String(data.longitude));
    formData.append('pickupRadiusMeters', String(data.pickupRadiusMeters));
    if (data.content) formData.append('content', data.content);
    if (data.lockId) formData.append('lockId', String(data.lockId));
    if (data.opensAt) formData.append('opensAt', data.opensAt);
    if (data.images) {
      data.images.forEach((file) => formData.append('images', file));
    }

    const headers = getUploadHeaders();
    const response = await fetch(`${API_BASE_URL}/campus-walk/drop`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json() as Promise<import('../types').CampusDrop>;
  },

  pickupDrop: (dropId: number, latitude: number, longitude: number) =>
    fetchWithAuth<import('../types').PickupDropResponse>(`/campus-walk/drops/${dropId}/pickup`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),

  getMyDrops: () =>
    fetchWithAuth<import('../types').CampusDrop[]>('/campus-walk/my-drops'),

  getMyPickups: () =>
    fetchWithAuth<import('../types').CampusDrop[]>('/campus-walk/my-pickups'),

  getDropDetail: (id: number) =>
    fetchWithAuth<import('../types').CampusDrop>(`/campus-walk/drops/${id}`),

  getDirectionHints: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').DirectionHint[]>(`/campus-walk/direction-hints?lat=${lat}&lng=${lng}`),

  getMyKeyBoxHints: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').KeyBoxHint[]>(`/campus-walk/my-keybox-hints?lat=${lat}&lng=${lng}`),

  // F5/F6: 探索记录 + 足迹热力图
  recordPosition: (lat: number, lng: number) =>
    fetchWithAuth<{ ok: boolean }>('/campus-walk/record-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    }),

  getExplorationStats: () =>
    fetchWithAuth<import('../types').ExplorationStats>('/campus-walk/exploration-stats'),

  getMyFootprints: (days = 7) =>
    fetchWithAuth<import('../types').FootprintSample[]>(`/campus-walk/my-footprints?days=${days}`),

  getGlobalHeatmap: (days = 7) =>
    fetchWithAuth<import('../types').HeatmapCell[]>(`/campus-walk/global-heatmap?days=${days}`),

  // F7: 附近的人 / 漫步模式
  startStroll: (lat: number, lng: number, bio?: string) =>
    fetchWithAuth<{ ok: boolean }>('/campus-walk/stroll/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng, bio }),
    }),

  updateStroll: (lat: number, lng: number) =>
    fetchWithAuth<{ ok: boolean }>('/campus-walk/stroll/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    }),

  stopStroll: () =>
    fetchWithAuth<{ ok: boolean }>('/campus-walk/stroll/stop', { method: 'POST' }),

  getNearbyStrollers: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').StrollUser[]>(`/campus-walk/stroll/nearby?lat=${lat}&lng=${lng}`),

  sendWave: (userId: number) =>
    fetchWithAuth<{ ok: boolean }>(`/campus-walk/stroll/wave/${userId}`, { method: 'POST' }),

  // F9: 校园地标打卡
  getLandmarks: () =>
    fetchWithAuth<import('../types').CampusLandmark[]>('/campus-walk/landmarks'),

  checkinLandmark: (id: number, lat: number, lng: number) =>
    fetchWithAuth<{ landmarkId: number; bonusPoints: number; message: string }>(
      `/campus-walk/landmarks/${id}/checkin?lat=${lat}&lng=${lng}`,
      { method: 'POST' }
    ),

  // 信标系统
  placeBeacon: (req: import('../types').PlaceBeaconRequest) =>
    fetchWithAuth<import('../types').CampusBeacon>('/campus-walk/beacons', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  getMyBeacons: () =>
    fetchWithAuth<import('../types').CampusBeacon[]>('/campus-walk/beacons/my'),

  getNearbyBeacons: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').CampusBeacon[]>(`/campus-walk/beacons/nearby?lat=${lat}&lng=${lng}`),

  recallBeacon: (id: number) =>
    fetchWithAuth<{ message: string }>(`/campus-walk/beacons/${id}/recall`, { method: 'POST' }),

  swapBeaconBase: (id: number, req: import('../types').SwapBeaconBaseRequest) =>
    fetchWithAuth<import('../types').CampusBeacon>(`/campus-walk/beacons/${id}/swap-base`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  interactBeacon: (id: number, lat: number, lng: number) =>
    fetchWithAuth<import('../types').CampusBeacon>(`/campus-walk/beacons/${id}/interact`, {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    }),

  getBeaconContacts: (id: number) =>
    fetchWithAuth<import('../types').BeaconContact[]>(`/campus-walk/beacons/${id}/contacts`),

  // Street Coins
  getNearbyCoins: (lat: number, lng: number) =>
    fetchWithAuth<import('../types').CampusCoin[]>(`/campus-walk/coins/nearby?lat=${lat}&lng=${lng}`),

  collectCoin: (id: number, latitude: number, longitude: number) =>
    fetchWithAuth<import('../types').CollectCoinResponse>(`/campus-walk/coins/${id}/collect`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),

  getCoinStats: () =>
    fetchWithAuth<import('../types').CoinStats>('/campus-walk/coins/stats'),
};

// ===================== 骗子酒馆 API =====================

export const tavernApi = {
  // 创建房间
  createRoom: (isPublic: boolean) =>
    fetchWithAuth<import('../types').TavernRoomDetail>('/tavern/rooms', {
      method: 'POST',
      body: JSON.stringify({ isPublic }),
    }),

  // 加入房间
  joinRoom: (data: { roomId?: number; inviteCode?: string; entryType: string; lockId?: number }) =>
    fetchWithAuth<import('../types').TavernRoomDetail>('/tavern/rooms/join', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 离开房间
  leaveRoom: (roomId: number) =>
    fetchWithAuth<{ success: boolean }>(`/tavern/rooms/${roomId}/leave`, { method: 'POST' }),

  // 添加机器人
  addBot: (roomId: number, difficulty: string) =>
    fetchWithAuth<import('../types').TavernPlayerInfo>(`/tavern/rooms/${roomId}/bot`, {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
    }),

  // 移除机器人
  removeBot: (roomId: number, seatIndex: number) =>
    fetchWithAuth<{ success: boolean }>(`/tavern/rooms/${roomId}/bot/${seatIndex}`, { method: 'DELETE' }),

  // 获取房间详情
  getRoom: (roomId: number) =>
    fetchWithAuth<import('../types').TavernRoomDetail>(`/tavern/rooms/${roomId}`),

  // 获取公开房间列表
  listPublicRooms: (limit = 20, offset = 0) =>
    fetchWithAuth<{ rooms: import('../types').TavernRoomSummary[]; total: number }>(
      `/tavern/rooms?limit=${limit}&offset=${offset}`
    ),

  // 获取当前活跃房间
  getActiveRoom: () =>
    fetchWithAuth<{ roomId: number | null; room?: import('../types').TavernRoomDetail }>('/tavern/active-room'),

  // 获取游戏历史
  getHistory: (limit = 20, offset = 0) =>
    fetchWithAuth<import('../types').TavernGameHistory[]>(`/tavern/history?limit=${limit}&offset=${offset}`),

  // 获取匹配队列状态
  getQueueStatus: () =>
    fetchWithAuth<{ playersInQueue: number; requiredPlayers: number }>('/tavern/queue-status'),
};

// ===================== 角色管理 API =====================

export interface RoleInfo {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  id: number;
  userId: number;
  roleId: number;
  roleName: string;
  roleDisplayName: string;
  assignedAt: string;
  assignedBy: number | null;
}

export const roleApi = {
  /** 获取所有角色 */
  getAllRoles: () =>
    fetchWithAuth<RoleInfo[]>('/admin/roles'),

  /** 获取用户的角色列表 */
  getUserRoles: (userId: number) =>
    fetchWithAuth<UserRoleAssignment[]>(`/admin/user-roles/${userId}`),

  /** 分配角色给用户 */
  assignRole: (userId: number, roleId: number) =>
    fetchWithAuth<UserRoleAssignment[]>(`/admin/user-roles/${userId}/roles/${roleId}`, { method: 'POST' }),

  /** 移除用户的角色 */
  removeRole: (userId: number, roleId: number) =>
    fetchWithAuth<UserRoleAssignment[]>(`/admin/user-roles/${userId}/roles/${roleId}`, { method: 'DELETE' }),
};

// ===================== 拉黑 API =====================

export interface BlockedUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  blockedAt: string;
}

export const blockApi = {
  /** 获取拉黑列表 */
  getBlockedUsers: () =>
    fetchWithAuth<{ users: BlockedUser[]; total: number }>('/blocks'),

  /** 拉黑用户 */
  block: (userId: number) =>
    fetchWithAuth<{ message: string }>(`/blocks/${userId}`, { method: 'POST' }),

  /** 取消拉黑 */
  unblock: (userId: number) =>
    fetchWithAuth<{ message: string }>(`/blocks/${userId}`, { method: 'DELETE' }),

  /** 检查是否已拉黑 */
  checkBlocked: (userId: number) =>
    fetchWithAuth<{ blocked: boolean }>(`/blocks/check/${userId}`),
};

// ==================== Alumni Chat (校友聊天) ====================

export const alumniChatApi = {
  // 角色卡 CRUD
  createCard: (request: import('../types').CreateCharacterCardRequest) =>
    fetchWithAuth<{ id: number }>('/alumni-chat/cards', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getMyCards: () =>
    fetchWithAuth<import('../types').CharacterCardSummary[]>('/alumni-chat/cards/my'),

  getPurchasedCards: () =>
    fetchWithAuth<import('../types').CharacterCardSummary[]>('/alumni-chat/cards/purchased'),

  getCardDetail: (id: number) =>
    fetchWithAuth<import('../types').CharacterCardData>(`/alumni-chat/cards/${id}`),

  updateCard: (id: number, request: import('../types').UpdateCharacterCardRequest) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteCard: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${id}`, { method: 'DELETE' }),

  // 头像上传
  uploadAvatar: (cardId: number, formData: FormData) =>
    fetch(`${API_BASE_URL}/alumni-chat/cards/${cardId}/avatar`, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }).then(async (res) => {
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error || 'Upload failed'); }
      return res.json() as Promise<{ avatarUrl: string }>;
    }),

  // 图库
  uploadImages: (cardId: number, formData: FormData) =>
    fetch(`${API_BASE_URL}/alumni-chat/cards/${cardId}/images`, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }).then(async (res) => {
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error || 'Upload failed'); }
      return res.json() as Promise<import('../types').CharacterCardImageData[]>;
    }),

  deleteImage: (cardId: number, imageId: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${cardId}/images/${imageId}`, { method: 'DELETE' }),

  reorderImages: (cardId: number, imageIds: number[]) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${cardId}/images/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ imageIds }),
    }),

  // 世界书
  getWorldBook: (cardId: number) =>
    fetchWithAuth<import('../types').WorldBookEntryData[]>(`/alumni-chat/cards/${cardId}/world-book`),

  createWorldBookEntry: (cardId: number, request: import('../types').CreateWorldBookEntryRequest) =>
    fetchWithAuth<import('../types').WorldBookEntryData>(`/alumni-chat/cards/${cardId}/world-book`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateWorldBookEntry: (cardId: number, entryId: number, request: import('../types').UpdateWorldBookEntryRequest) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${cardId}/world-book/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteWorldBookEntry: (cardId: number, entryId: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${cardId}/world-book/${entryId}`, { method: 'DELETE' }),

  // 市场
  publishCard: (cardId: number, priceCampusPoints?: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/cards/${cardId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ priceCampusPoints: priceCampusPoints ?? 0 }),
    }),

  browseMarketplace: (params?: { search?: string; tags?: string; sortBy?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.tags) query.set('tags', params.tags);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return fetchWithAuth<import('../types').CharacterCardListResponse>(`/alumni-chat/marketplace${qs ? `?${qs}` : ''}`);
  },

  getMarketplaceDetail: (id: number) =>
    fetchWithAuth<import('../types').CharacterCardMarketplaceDetail>(`/alumni-chat/marketplace/${id}`),

  purchaseCard: (id: number) =>
    fetchWithAuth<{ message: string; remainingCampusPoints: number }>(`/alumni-chat/marketplace/${id}/purchase`, { method: 'POST' }),

  toggleLike: (id: number) =>
    fetchWithAuth<{ liked: boolean }>(`/alumni-chat/marketplace/${id}/like`, { method: 'POST' }),

  // 聊天对话
  createConversation: (request: import('../types').CreateConversationRequest) =>
    fetchWithAuth<import('../types').ChatConversationData>('/alumni-chat/conversations', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getMyConversations: () =>
    fetchWithAuth<import('../types').ChatConversationData[]>('/alumni-chat/conversations'),

  getConversationDetail: (id: number, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return fetchWithAuth<import('../types').ChatConversationDetail>(`/alumni-chat/conversations/${id}${qs ? `?${qs}` : ''}`);
  },

  updateConversation: (id: number, request: import('../types').UpdateConversationRequest) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteConversation: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/conversations/${id}`, { method: 'DELETE' }),

  deleteMessage: (convId: number, msgId: number) =>
    fetchWithAuth<{ success: boolean }>(`/alumni-chat/conversations/${convId}/messages/${msgId}`, { method: 'DELETE' }),

  // AI 模型
  getModels: () =>
    fetchWithAuth<import('../types').AiModelConfigData[]>('/alumni-chat/models'),

  // SSE endpoints (handled separately in hooks)
  getMessageStreamUrl: (convId: number) => `${API_BASE_URL}/alumni-chat/conversations/${convId}/messages`,
  getRegenerateStreamUrl: (convId: number) => `${API_BASE_URL}/alumni-chat/conversations/${convId}/regenerate`,
};

// ==================== Rope Artist API ====================
export const ropeArtistApi = {
  // Public: browse artists
  listArtists: (params?: { offset?: number; limit?: number; sortBy?: string; minRating?: number; city?: string }) => {
    const query = new URLSearchParams();
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.minRating) query.set('minRating', String(params.minRating));
    if (params?.city) query.set('city', params.city);
    const qs = query.toString();
    return fetchWithAuth<import('../types').RopeArtistListResponse>(`/rope-artists${qs ? `?${qs}` : ''}`);
  },

  getArtistDetail: (id: number) =>
    fetchWithAuth<import('../types').RopeArtistDetail>(`/rope-artists/${id}`),

  getAvailability: (id: number) =>
    fetchWithAuth<import('../types').RopeAvailabilityResponse>(`/rope-artists/${id}/availability`),

  getReviews: (id: number, params?: { offset?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return fetchWithAuth<import('../types').RopeReview[]>(`/rope-artists/${id}/reviews${qs ? `?${qs}` : ''}`);
  },

  // Apply to become artist
  apply: (request: import('../types').ApplyRopeArtistRequest) =>
    fetchWithAuth<import('../types').RopeArtistData>('/rope-artists/apply', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // Upload images (multipart)
  uploadImages: (formData: FormData) =>
    fetch(`${API_BASE_URL}/rope-artists/images`, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }).then(async (res) => {
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error || 'Upload failed'); }
      return res.json() as Promise<{ imageUrls: string[] }>;
    }),

  // My profile
  getMyProfile: () =>
    fetchWithAuth<import('../types').RopeArtistData>('/rope-artists/me'),

  updateMyProfile: (request: import('../types').UpdateRopeArtistProfileRequest) =>
    fetchWithAuth<{ success: boolean }>('/rope-artists/me', {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  togglePause: () =>
    fetchWithAuth<{ isPaused: boolean }>('/rope-artists/me/toggle-pause', { method: 'POST' }),

  // Portfolio
  getPortfolio: () =>
    fetchWithAuth<import('../types').PortfolioImage[]>('/rope-artists/me/portfolio'),

  addPortfolioImage: (imageUrl: string, caption?: string) =>
    fetchWithAuth<{ id: number }>('/rope-artists/me/portfolio', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, caption: caption || '' }),
    }),

  removePortfolioImage: (imageId: number) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/me/portfolio/${imageId}`, { method: 'DELETE' }),

  // Price lists
  createPriceList: (request: import('../types').CreatePriceListRequest) =>
    fetchWithAuth<{ id: number }>('/rope-artists/me/price-lists', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updatePriceList: (id: number, request: import('../types').UpdatePriceListRequest) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/me/price-lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deletePriceList: (id: number) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/me/price-lists/${id}`, { method: 'DELETE' }),

  // Busy dates
  setBusyDates: (request: import('../types').SetBusyDatesRequest) =>
    fetchWithAuth<{ success: boolean }>('/rope-artists/me/busy-dates', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  removeBusyDates: (request: import('../types').RemoveBusyDatesRequest) =>
    fetchWithAuth<{ success: boolean }>('/rope-artists/me/busy-dates', {
      method: 'DELETE',
      body: JSON.stringify(request),
    }),

  // My bookings as artist
  getArtistBookings: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return fetchWithAuth<import('../types').RopeBookingData[]>(`/rope-artists/me/bookings${qs}`);
  },

  // Bookings (client side)
  createBooking: (request: import('../types').CreateBookingRequest) =>
    fetchWithAuth<import('../types').RopeBookingData>('/rope-artists/bookings', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getMyBookings: () =>
    fetchWithAuth<import('../types').RopeBookingData[]>('/rope-artists/bookings/mine'),

  cancelBooking: (bookingId: number) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/bookings/${bookingId}/cancel`, { method: 'POST' }),

  confirmBooking: (bookingId: number) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/bookings/${bookingId}/confirm`, { method: 'POST' }),

  rejectBooking: (bookingId: number, reason?: string) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/bookings/${bookingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    }),

  completeBooking: (bookingId: number) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/bookings/${bookingId}/complete`, { method: 'POST' }),

  reviewBooking: (bookingId: number, request: import('../types').CreateRopeReviewRequest) =>
    fetchWithAuth<import('../types').RopeReview>(`/rope-artists/bookings/${bookingId}/review`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // Admin
  getPendingApplications: () =>
    fetchWithAuth<Array<{ artist: import('../types').RopeArtistData; applicationImages: string[] }>>('/rope-artists/admin/pending'),

  adminReview: (artistId: number, approved: boolean, reason?: string) =>
    fetchWithAuth<{ success: boolean }>(`/rope-artists/admin/${artistId}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason: reason || '' }),
    }),
};

export default {
  auth: authApi,
  items: itemsApi,
  campusTasks: campusTasksApi,
  userTasks: userTasksApi,
  schedule: scheduleApi,
  selfLock: selfLockApi,
  courses: coursesApi,
  exams: examsApi,
  punishments: punishmentsApi,
  userStats: userStatsApi,
  userProfile: userProfileApi,
  guestbook: guestbookApi,
  keyholder: keyholderApi,
  extension: extensionApi,
  lockTask: lockTaskApi,
  notification: notificationApi,
  feedback: feedbackApi,
  posts: postsApi,
  supervision: supervisionApi,
  memory: memoryApi,
  scheduleSharing: scheduleSharingApi,
  follow: followApi,
  unlockVote: unlockVoteApi,
  optionalTaskGroup: optionalTaskGroupApi,
  admin: adminApi,
  majors: majorsApi,
  roulette: rouletteApi,
  adminFeedback: adminFeedbackApi,
  changelog: changelogApi,
  adminChangelog: adminChangelogApi,
  therapy: therapyApi,
  waveform: waveformApi,
  taskRequest: taskRequestApi,
  cardImage: cardImageApi,
  yiciyuan: yiciyuanApi,
  sticker: stickerApi,
  foundation: foundationApi,
  adminFoundation: adminFoundationApi,
  gallery: galleryApi,
  cinema: cinemaApi,
  adminGallery: adminGalleryApi,
  adminCinema: adminCinemaApi,
  board: boardApi,
  liveStream: liveStreamApi,
  asmr: asmrApi,
  music: musicApi,
  campusWalk: campusWalkApi,
  tavern: tavernApi,
  block: blockApi,
  role: roleApi,
  alumniChat: alumniChatApi,
  ropeArtist: ropeArtistApi,
};
