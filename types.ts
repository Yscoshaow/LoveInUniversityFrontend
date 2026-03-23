
export interface User {
  name: string;
  avatar: string;
}

export interface CalendarDate {
  date: Date;
  day: string; // e.g., "18"
  weekday: string; // e.g., "Mo"
  isActive?: boolean;
  isToday?: boolean;
}

// --- Schedule Types (from backend) ---

export type ScheduleType = 'MEETING' | 'REMINDER' | 'DEADLINE' | 'EVENT' | 'OTHER';
export type ScheduleStatus = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export interface Schedule {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  date: string; // LocalDate as YYYY-MM-DD
  startTime: string; // LocalTime as HH:mm:ss
  endTime: string | null;
  location: string | null;
  type: ScheduleType;
  status: ScheduleStatus;
  reminderMinutes: number | null;
  isRecurring: boolean;
  recurringPattern: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSummary {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  type: ScheduleType;
  status: ScheduleStatus;
}

export interface CreateScheduleRequest {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  type?: ScheduleType;
  reminderMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface UpdateScheduleRequest {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  type?: ScheduleType;
  status?: ScheduleStatus;
  reminderMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface DailyScheduleOverview {
  date: string;
  totalSchedules: number;
  upcomingCount: number;
  completedCount: number;
  schedules: ScheduleSummary[];
}

// Legacy ScheduleEvent for backwards compatibility (displayed in UI)
export interface ScheduleEvent {
  id: string;
  time: string;
  endTime?: string; // Optional end time
  title: string;
  attendees: string[];
  type: 'meeting' | 'test' | 'other';
  date: string; // ISO Date string YYYY-MM-DD
  location?: string;
  description?: string;
}

export interface Reminder {
  id: string;
  title: string;
  timeRange: string;
}

export interface Category {
  id: string;
  label: string;
  color: string; // Tailwind class or hex
}

// --- Self Lock Types (from backend) ---

export type LockDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME' | 'CUSTOM';
export type LockStatus = 'ACTIVE' | 'UNLOCKING' | 'UNLOCKED' | 'EXPIRED' | 'CANCELLED';
export type UnlockMethod = 'TIME_ONLY' | 'GUESS_TIME' | 'GUESS_KEY' | 'VOTE' | 'COMMUNITY';

// Lock Box Types
export type LockBoxType = 'NONE' | 'PHOTO' | 'SUOJI' | 'YICIYUAN';

// 役次元 API 类型
export interface YiciyuanAccountStatus {
  hasAccount: boolean;
  phone?: string;
}

export interface YiciyuanLoginRequest {
  phone: string;
  password?: string;
  pcode?: string;
  type: 1 | 2;  // 1=密码登录, 2=验证码登录
}

export interface YiciyuanLoginResponse {
  message: string;
  userName?: string;
}

export interface YiciyuanBindResult {
  message: string;
  deviceId: number;
  keyA?: string;
  tokenB?: string;
}

export interface YiciyuanDeviceCredentials {
  keyA: string;   // hex 编码的 KeyA
  tokenB: string; // hex 编码的 TokenB
}

// ===== 课程暂停 =====
export interface PauseCoursesResponse {
  message: string;
  coursesPausedUntil: string;
}

// ===== 异次元设备信息（不含敏感凭据） =====
export interface YiciyuanDeviceInfo {
  id: number;
  mac: string;
  deviceName: string;
  lockId: number | null;
  hasActiveLock: boolean;
  createdAt: string;
}

// V2 Lock Types
export type LockTypeV2 = 'SELF' | 'SHARED' | 'PRIVATE';
export type TimeConfigMode = 'MIN_MAX_RANGE' | 'FIXED_VARIANCE';
export type KeyholderPermission = 'READ_ONLY' | 'BASIC_CONTROL' | 'FULL_CONTROL';
// Note: HYGIENE_OPENING removed (core lock feature via hygieneOpeningEnabled)
// Note: GUESS_THE_TIMER removed (implicit when hideRemainingTime=true)
export type ExtensionType =
  | 'WHEEL_OF_FORTUNE'
  | 'DICE'
  | 'TASKS'
  | 'RANDOM_EVENTS'
  | 'PILLORY'
  | 'SHARE_LINKS'
  | 'VERIFICATION_PICTURE'
  | 'PENALTIES'
  | 'ROLE'
  | 'VOTE_UNLOCK'
  | 'LIKE_UNLOCK'
  | 'COIN_TOSS';
export type LockTaskStatusV2 = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type NotificationType =
  | 'LOCK_CREATED' | 'LOCK_READY_TO_UNLOCK' | 'LOCK_EXPIRED' | 'LOCK_UNLOCKED' | 'LOCK_FROZEN' | 'LOCK_UNFROZEN' | 'LOCK_EMERGENCY_UNLOCKED' | 'LOCK_REWARD'
  | 'TIME_ADDED' | 'TIME_REMOVED'
  | 'KEYHOLDER_ADDED' | 'KEYHOLDER_REMOVED' | 'KEYHOLDER_REQUEST'
  | 'TASK_ASSIGNED' | 'TASK_SUBMITTED' | 'TASK_APPROVED' | 'TASK_REJECTED' | 'TASK_EXPIRED'
  | 'EXTENSION_TRIGGERED' | 'WHEEL_SPIN_RESULT' | 'DICE_ROLL_RESULT' | 'RANDOM_EVENT_OCCURRED'
  | 'PILLORY_VOTE_RECEIVED' | 'PILLORY_STARTED' | 'PILLORY_ENDED'
  | 'VERIFICATION_REQUIRED' | 'VERIFICATION_OVERDUE' | 'VERIFICATION_APPROVED'
  | 'HYGIENE_OPENING_STARTED' | 'HYGIENE_OPENING_ENDED' | 'HYGIENE_OPENING_OVERDUE'
  | 'SHARE_LINK_USED'
  | 'SUPERVISION_REQUEST_RECEIVED' | 'SUPERVISION_APPROVED' | 'SUPERVISION_REJECTED' | 'SUPERVISION_EXPIRED' | 'SUPERVISION_CANCELLED'
  | 'SUPERVISOR_TASK_ASSIGNED' | 'SUPERVISOR_TASK_COMPLETED' | 'SUPERVISOR_TASK_FAILED'
  | 'SCHEDULE_SHARE_INVITE' | 'SCHEDULE_SHARE_ACCEPTED' | 'SCHEDULE_SHARE_DECLINED' | 'SCHEDULE_PARTICIPANT_JOINED' | 'SCHEDULE_PARTICIPANT_LEFT' | 'SCHEDULE_PUBLISHED'
  | 'MEMORY_CREATED' | 'MEMORY_INVITE' | 'MEMORY_LIKED' | 'MEMORY_PUBLISHED' | 'MEMORY_COMMENT'
  | 'MAJOR_ENROLLED' | 'MAJOR_DROPPED' | 'MAJOR_GRADUATED' | 'MAJOR_AUTO_ENROLLED'
  | 'BOOK_REVIEW_APPROVED' | 'BOOK_REVIEW_REJECTED' | 'BOOK_PURCHASED'
  | 'COMMENT_NEW' | 'COMMENT_REPLY';

export const LOCK_TYPE_NAMES: Record<LockTypeV2, string> = {
  SELF: '自锁',
  SHARED: '共享锁',
  PRIVATE: '私有锁'
};

export const KEYHOLDER_PERMISSION_NAMES: Record<KeyholderPermission, string> = {
  READ_ONLY: '只读',
  BASIC_CONTROL: '基础控制',
  FULL_CONTROL: '完全控制'
};

export const EXTENSION_NAMES: Record<ExtensionType, string> = {
  WHEEL_OF_FORTUNE: '幸运轮盘',
  DICE: '骰子',
  TASKS: '任务',
  RANDOM_EVENTS: '随机事件',
  PILLORY: '公开惩罚',
  SHARE_LINKS: '共享链接',
  VERIFICATION_PICTURE: '验证照片',
  PENALTIES: '惩罚追踪',
  ROLE: '角色扮演',
  VOTE_UNLOCK: '投票解锁',
  LIKE_UNLOCK: '点赞解锁',
  COIN_TOSS: '投币'
};

export interface SelfLockBackend {
  id: number;
  userId: number;
  baseDurationMinutes: number;
  actualDurationMinutes: number;
  addedDurationMinutes: number;
  removedDurationMinutes: number;
  timeVarianceMin: number;
  timeVarianceMax: number;
  difficulty: LockDifficulty;
  wrongGuessPenaltyPercent: number;
  keyCount: number;
  unlockMethod: UnlockMethod;
  hideRemainingTime: boolean;
  voteRequired: number;
  currentVotes: number;
  isPublic: boolean;
  likesReceived: number;
  likeTimeAddMinutes: number;
  imageKey: string | null;
  lockBoxType: LockBoxType;
  lockBoxDeviceName: string | null;
  lockBoxUnlocked: boolean;
  status: LockStatus;
  startedAt: string;
  scheduledUnlockAt: string;
  actualUnlockAt: string | null;
  guessAttempts: number;
  correctKeyIndex: number | null;
  createdAt: string;
  updatedAt: string;

  // V2 Fields
  lockType: LockTypeV2;
  timeConfigMode: TimeConfigMode;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  maxLockDate: string | null;
  allowKeyholderFreeze: boolean;
  pilloryEnabled: boolean;
  punishmentMode: boolean;
  punishmentModeExpiresAt: string | null;
  wearerHasVeto: boolean;
  primaryKeyholderId: number | null;
  primaryKeyholderPermission: KeyholderPermission;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenBy: number | null;
  hygieneOpeningEnabled: boolean;
  hygieneOpeningDurationMinutes: number;
  hygieneOpeningDailyLimit: number;
  hygieneOpeningLimitMode: 'DAILY' | 'COOLDOWN';
  hygieneOpeningCooldownHours: number;
  hygieneOpeningsUsedToday: number;
  isHygieneOpening: boolean;
  hygieneOpeningEndsAt: string | null;
  hygieneImageRequired: boolean;
  hygieneBypassKeyholder: boolean;
  hygieneImageKey: string | null;
  hygieneRelockImageKey: string | null;
  verificationIntervalHours: number;
  lastVerificationAt: string | null;
  verificationOverdue: boolean;
  lastBumpedAt: string | null;
  viewCode?: string | null;  // 私密分享码，6位数字，仅所有者在自己的锁详情中可见
}

export interface SelfLockSummary {
  id: number;
  userId: number;
  username: string | null;
  telegramUsername: string | null;
  userPhotoUrl: string | null;  // 用户头像
  status: LockStatus;
  difficulty: LockDifficulty;
  isPublic: boolean;
  likesReceived: number;
  isLikedByMe: boolean;  // 当前用户是否已点赞
  remainingMinutes: number | null;  // 保留向后兼容
  remainingSeconds: number | null;  // 秒级精度
  hideRemainingTime: boolean;
  hasImage: boolean;
  createdAt: string;

  // V2 Fields
  lockType: LockTypeV2;
  isFrozen: boolean;
  isHygieneOpening: boolean;
  hygieneOpeningEndsAt: string | null;
  hygieneOpeningEnabled: boolean;
  hygieneOpeningDailyLimit: number;
  hygieneOpeningLimitMode: 'DAILY' | 'COOLDOWN';
  hygieneOpeningCooldownHours: number;
  hygieneOpeningsUsedToday: number;
  hygieneImageRequired: boolean;
  hygieneBypassKeyholder: boolean;
  primaryKeyholderId: number | null;
  keyholderInactiveDays: number | null;
  lockBoxType: LockBoxType;
  lockBoxUnlocked: boolean;
  likeUnlockEnabled: boolean;
  likeUnlockRequired: number;
  lastBumpedAt: string | null;
  coverImageUrl: string | null;

  // 申请制
  myApplicationStatus: string | null;
  pendingApplicationCount: number;
  punishmentMode: boolean;
  punishmentModeExpiresAt: string | null;
}

// 申请者信息
export interface UserSummary {
  id: number;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
}

export interface TakeoverRequestInfo {
  id: number;
  lockId: number;
  requester: UserSummary;
  requestedPermission: KeyholderPermission;
  message: string | null;
  status: string;
  respondedBy: UserSummary | null;
  respondedAt: string | null;
  responseMessage: string | null;
  createdAt: string;
}

export interface SelfLockDetail {
  lock: SelfLockBackend;
  remainingMinutes: number | null;  // 保留向后兼容
  remainingSeconds: number | null;  // 秒级精度
  totalDurationMinutes: number;
  canUnlock: boolean;
  unlockProgress: UnlockProgress | null;
  imageUrl: string | null;
  coverImageUrl: string | null;

  // V2 Fields
  keyholders?: LockKeyholder[];
  extensions?: LockExtensionData[];
  pendingTasks?: LockTask[];
}

export interface UnlockProgress {
  method: UnlockMethod;
  timeReached: boolean;
  votesNeeded: number;
  votesCurrent: number;
  guessAttemptsUsed: number;
  keysRemaining: number | null;
  likeUnlockEnabled: boolean;
  likesRequired: number;
  likesCurrent: number;
  likeThresholdMet: boolean;
}

export interface GuessResult {
  correct: boolean;
  penaltyMinutes: number;
  newScheduledUnlockAt: string | null;
  message: string;
}

export interface CreateSelfLockRequest {
  // Basic settings
  durationMinutes?: number;
  unlockAt?: string;
  timeVarianceMin?: number;
  timeVarianceMax?: number;
  difficulty?: LockDifficulty;
  customWrongGuessPenaltyPercent?: number;
  customKeyCount?: number;
  unlockMethod?: UnlockMethod;
  hideRemainingTime?: boolean;
  voteRequired?: number;
  isPublic?: boolean;
  likeTimeAddMinutes?: number;

  // V2 Lock Type settings
  lockType?: LockTypeV2;
  timeConfigMode?: TimeConfigMode;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;

  // V2 Options
  maxLockDate?: string;
  maxTotalDays?: number;
  allowKeyholderFreeze?: boolean;
  pilloryEnabled?: boolean;
  wearerHasVeto?: boolean;

  // V2 Keyholder settings (for PRIVATE type)
  primaryKeyholderId?: number;
  primaryKeyholderPermission?: KeyholderPermission;

  // V2 Hygiene Opening
  hygieneOpeningEnabled?: boolean;
  hygieneOpeningDurationMinutes?: number;
  hygieneOpeningDailyLimit?: number;
  hygieneOpeningLimitMode?: 'DAILY' | 'COOLDOWN';
  hygieneOpeningCooldownHours?: number;
  hygieneImageRequired?: boolean;
  hygieneBypassKeyholder?: boolean;

  // V2 Verification
  verificationIntervalHours?: number;

  // Lock Box
  lockBoxType?: LockBoxType;
  lockBoxDeviceName?: string;

  // V2 Extensions
  enabledExtensions?: ExtensionEnableRequest[];
}

export interface UpdateLockSettingsRequest {
  hideRemainingTime?: boolean;
  isPublic?: boolean;
  allowKeyholderFreeze?: boolean;
  hygieneOpeningEnabled?: boolean;
  hygieneOpeningDurationMinutes?: number;
  hygieneOpeningDailyLimit?: number;
  hygieneOpeningLimitMode?: 'DAILY' | 'COOLDOWN';
  hygieneOpeningCooldownHours?: number;
  hygieneImageRequired?: boolean;
  hygieneBypassKeyholder?: boolean;
  pilloryEnabled?: boolean;
  voteRequired?: number;
  likeTimeAddMinutes?: number;
  verificationIntervalHours?: number;
  punishmentMode?: boolean;
  punishmentModeHours?: number;
}

export interface ExtensionEnableRequest {
  type: ExtensionType;
  config?: Record<string, unknown>;
  cooldownSeconds?: number;
}

// Hygiene Opening Response
export interface HygieneOpeningResponse {
  message: string;
  lockId: number;
  isHygieneOpening: boolean;
  hygieneOpeningEndsAt: string | null;
  hygieneImageUrl: string | null;
  hygieneImageRequired: boolean;
  requiresApproval: boolean;  // true if manager approval is needed
  requestId: number | null;   // unlock request ID if waiting for approval
}

// Hygiene Image History
export type HygieneImageType = 'INITIAL' | 'RELOCK';

export interface HygieneImageHistoryItem {
  id: number;
  lockId: number;
  userId: number;
  imageKey: string;
  imageType: HygieneImageType;
  sessionNumber: number;
  createdAt: string;
  imageUrl?: string | null;
}

export interface SelfLockStats {
  totalLocks: number;
  activeLocks: number;
  completedLocks: number;
  totalLockedMinutes: number;
  longestLockMinutes: number;
  averageLockMinutes: number;
}

// Legacy SelfLock type for UI components (keep for backward compatibility)
export type LockType = 'timer' | 'key' | 'vote';

export interface SelfLock {
  id: string;
  type: LockType;
  status: 'active' | 'unlocked' | 'failed';
  imageUrl?: string; // The reward image
  lockedUntil?: Date; // For timer
  durationMinutes: number;
  currentVotes?: number;
  requiredVotes?: number;
  likes?: number;
  isEncrypted?: boolean; // If true, image is blurred
}

// --- New Types for Campus Tasks ---

export type CampusTaskStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DELETED';
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// Full task detail
export interface CampusTask {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  description: string;
  coverImageUrl: string | null;
  rewardCampusPoints: number;
  rewardItem: Item | null;
  rewardItemQuantity: number;
  maxCompletions: number;
  requiresVerification: boolean;
  isAnonymous: boolean;
  completedCount: number;
  viewCount: number;
  totalTips: number;
  status: CampusTaskStatus;
  createdAt: string;
  updatedAt: string;
  hasSubmitted: boolean;
  mySubmission: TaskSubmission | null;
  isFavorited: boolean;
}

// Task list item (summary)
export interface CampusTaskSummary {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  coverImageUrl: string | null;
  rewardCampusPoints: number;
  hasItemReward: boolean;
  maxCompletions: number;
  completedCount: number;
  commentCount: number;
  status: CampusTaskStatus;
  createdAt: string;
  isAnonymous: boolean;
}

// Task submission
export interface TaskSubmission {
  id: number;
  taskId: number;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
  content: string | null;
  imageUrls: string[];
  status: SubmissionStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  rewardIssued: boolean;
  createdAt: string;
  updatedAt: string;
}

// Task comment
export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
  parentId: number | null;
  replyToCommentId: number | null;
  replyToUserName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: TaskComment[];
  reactions: CommentReactionSummary[];
}

// Sticker reaction types
export interface StickerPack {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stickers: StickerItem[];
}

export interface StickerItem {
  id: number;
  packId: number;
  emoji: string | null;
  fileKey: string;
  fileUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CommentReactionSummary {
  stickerId: number;
  stickerUrl: string;
  emoji: string | null;
  count: number;
  hasReacted: boolean;
}

// Task tip
export interface TaskTip {
  id: number;
  taskId: number;
  fromUserId: number;
  fromUserName: string | null;
  toUserId: number;
  amount: number;
  message: string | null;
  createdAt: string;
}

// Request types
export interface CreateCampusTaskRequest {
  title: string;
  description: string;
  rewardCampusPoints?: number;
  rewardItemId?: number;
  rewardItemQuantity?: number;
  maxCompletions?: number;
  requiresVerification?: boolean;
  isAnonymous?: boolean;
}

export interface UpdateCampusTaskRequest {
  title?: string;
  description?: string;
  rewardCampusPoints?: number;
  rewardItemId?: number;
  rewardItemQuantity?: number;
  maxCompletions?: number;
  status?: CampusTaskStatus;
}

export interface SubmitTaskRequest {
  content?: string;
}

export interface ReviewSubmissionRequest {
  approved: boolean;
  reviewNote?: string;
}

export interface PostCommentRequest {
  content: string;
  parentId?: number;
  replyToCommentId?: number;
}

export interface TipTaskRequest {
  amount: number;
  message?: string;
}

// ===================== Task Request (求任务) Types =====================

export type TaskRequestStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type ProposalStatus = 'PENDING' | 'SELECTED' | 'REJECTED';

export interface TaskRequestDetail {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  description: string;
  rewardAmount: number;
  proposalCount: number;
  winningProposal: TaskRequestProposalDetail | null;
  status: TaskRequestStatus;
  hasProposed: boolean;
  myProposal: TaskRequestProposalDetail | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRequestSummary {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  rewardAmount: number;
  proposalCount: number;
  status: TaskRequestStatus;
  createdAt: string;
}

export interface TaskRequestProposalDetail {
  id: number;
  requestId: number;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
  title: string;
  description: string;
  status: ProposalStatus;
  selectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequestRequest {
  title: string;
  description: string;
  rewardAmount: number;
}

export interface SubmitProposalRequest {
  title: string;
  description: string;
}

export interface SelectWinnerRequest {
  proposalId: number;
}

// --- New Types for Shop & Inventory ---

export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ItemType = 'CONSUMABLE' | 'EQUIPMENT' | 'MATERIAL' | 'GIFT';

export const RARITY_COLORS: Record<ItemRarity, string> = {
    COMMON: '#9e9e9e',
    UNCOMMON: '#4caf50',
    RARE: '#2196f3',
    EPIC: '#9c27b0',
    LEGENDARY: '#ff9800'
};

export const RARITY_NAMES: Record<ItemRarity, string> = {
    COMMON: '普通',
    UNCOMMON: '优良',
    RARE: '稀有',
    EPIC: '史诗',
    LEGENDARY: '传说'
};

export interface BuffInfo {
    id: number;
    name: string;
    buffType: string;
    value: number;
    description: string | null;
}

export interface Item {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    itemType: ItemType;
    rarity: ItemRarity;
    itemCategory?: string;
    priceCampusPoints: number;
    priceCredits: number;
    maxStack: number;
    useCooldownMinutes: number;
    effectDurationMinutes: number;
    isTradeable: boolean;
    isAvailable: boolean;
    createdAt: string;
    updatedAt: string;
    buffs: BuffInfo[];
}

export interface CardFaceInfo {
    id: number;
    name: string;
    description: string | null;
    themeKey: string;
}

export interface ShopItem {
    item: Item;
    canAfford: boolean;
    ownedQuantity: number;
}

// --- Special Items (Fixed Items, not configured through database) ---

export type SpecialItemType = 'MASTER_KEY' | 'SUPERVISION_PERMIT' | 'KEY_BOX' | 'STICKY_NOTE' | 'PHOTO_PAPER' | 'TIME_CAPSULE' | 'DRIFT_BOTTLE' | 'BEACON' | 'BEACON_BASE_IRON' | 'BEACON_BASE_GOLD' | 'BEACON_BASE_DIAMOND' | 'POST_PIN' | 'ANONYMOUS_TOKEN';

export interface SpecialItem {
    type: SpecialItemType;
    name: string;
    description: string;
    iconUrl: string | null;
    priceCampusPoints: number;
    priceCredits: number;
    maxStack: number;
    rarity: ItemRarity;
}

export interface SpecialShopItem {
    item: SpecialItem;
    canAfford: boolean;
    ownedQuantity: number;
}

export interface UserSpecialItem {
    id: number;
    userId: number;
    itemType: SpecialItemType;
    quantity: number;
    lastUsedAt: string | null;
    acquiredAt: string;
    updatedAt: string;
}

export interface PurchaseSpecialItemRequest {
    itemType: SpecialItemType;
    quantity?: number;
}

export interface UseMasterKeyRequest {
    lockId: number;
}

export interface UseKeyBoxRequest {
    lockId: number;
    keyholderId: number;
}

export interface KeyBoxUseResponse {
    message: string;
    lockId: number;
    keyholderId: number;
}

export interface UserItem {
    id: number;
    userId: number;
    item: Item;
    quantity: number;
    isEquipped: boolean;
    equippedAt: string | null;
    effectExpiresAt: string | null;
    lastUsedAt: string | null;
    acquiredAt: string;
    updatedAt: string;
}

export interface UserCurrency {
    credits: number;
    campusPoints: number;
}

export interface ActiveEffect {
    id: number;
    name: string;
    iconUrl: string | null;
    remainingTime: string;
    effectExpiresAt: string;
}

export interface PurchaseItemRequest {
    itemId: number;
    quantity?: number;
    useCredits?: boolean;
}

export interface GiftItemRequest {
    itemId: number;
    toUserId: number;
    quantity?: number;
    message?: string;
}

// --- User Task Types (from backend) ---

export type TaskType = 'DURATION' | 'COUNT' | 'MANUAL' | 'LOCK' | 'LOCATION';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type TargetUnit = 'KILOMETERS' | 'METERS' | 'MINUTES' | 'HOURS' | 'TIMES' | 'NONE';

export interface UserTaskDetail {
  id: number;
  courseName: string;
  courseIconUrl: string | null;
  taskName: string;
  taskDescription: string | null;
  taskType: TaskType;
  targetValue: number;
  targetUnit: TargetUnit;
  actualValue: number;
  status: TaskStatus;
  scheduledDate: string; // LocalDate as YYYY-MM-DD
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  isExamAttempt: boolean;
  pointsEarned: number;
  remainingSeconds: number | null;
  progressPercent: number;
}

export interface DailyTaskOverview {
  date: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  failedTasks: number;
  tasks: UserTaskDetail[];
}

// --- New Types for Courses (Backend types) ---

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED';

export interface CoursePrerequisiteInfo {
  courseId: number;
  courseName: string;
  isPassed: boolean;
}

export interface CourseSummaryBackend {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  categoryName: string | null;
  schedules: number[]; // Days of week: 1-7
  isActive: boolean;
  prerequisites: CoursePrerequisiteInfo[];
  canEnroll: boolean;
  missingPrerequisites: string[];
  creditsOnPass: number; // 通过考试后可获得的学分
  examPointsRequired: number; // 参加考试所需的课程积分
}

export interface UserCourseProgress {
  enrollmentId: number;
  course: CourseSummaryBackend;
  status: EnrollmentStatus;
  currentPoints: number;
  examPointsRequired: number;
  canTakeExam: boolean;
  examPassed: boolean;
  creditsEarned: number;
  completedTaskCount: number;
  failedTaskCount: number;
  enrolledAt: string;
}

export interface EnrollCourseRequest {
  courseId: number;
}

export interface UserEnrollment {
  id: number;
  userId: number;
  courseId: number;
  status: EnrollmentStatus;
  currentPoints: number;
  examPassed: boolean;
  creditsEarned: number;
  completedTaskCount: number;
  failedTaskCount: number;
  enrolledAt: string;
  completedAt: string | null;
}

// Legacy Course type for UI components (keep for backward compatibility)
export type CourseStatus = 'AVAILABLE' | 'ENROLLED' | 'COMPLETED' | 'LOCKED';

export interface Course {
    id: string;
    title: string;
    instructor: string;
    credits: number;
    scheduleDay: number; // 1 = Monday, 7 = Sunday
    scheduleTime: string; // "14:00 - 16:00"
    location: string;
    description: string;
    status: CourseStatus;
    capacity: number;
    enrolledCount: number;
    prerequisites?: string[]; // List of Course IDs required
    progress?: number; // 0-100, only if enrolled
    coverImage?: string;
}

// --- Course Tasks Overview ---

export interface TaskDefinitionDisplay {
  id: number;
  name: string;
  description: string | null;
  taskType: string;
  targetValue: number;
  targetUnit: string;
  orderIndex: number;
}

export interface OptionalTaskGroupOverview {
  id: number;
  name: string;
  description: string | null;
  requiredCount: number;
  totalCount: number;
  scheduleDays: number[] | null;
  tasks: TaskDefinitionDisplay[];
}

export interface CourseTasksOverview {
  courseId: number;
  courseName: string;
  dailyTasks: TaskDefinitionDisplay[];
  examTasks: TaskDefinitionDisplay[];
  optionalTaskGroups: OptionalTaskGroupOverview[];
}

export interface OptionalTaskGroupDatePreview {
  groupId: number;
  groupName: string;
  groupDescription: string | null;
  courseName: string;
  courseId: number;
  requiredCount: number;
  totalCount: number;
  scheduleDays: number[] | null;
  /** null=preview (not yet generated), non-null=existing instance */
  existingStatus: OptionalTaskGroupStatus | null;
  tasks: TaskDefinitionDisplay[];
}

// --- New Types for Punishments (Backend types) ---

export type PunishmentStatusBackend = 'PENDING_CLAIM' | 'PENDING' | 'COMPLETED' | 'EXPIRED';
export type PunishmentTypeBackend = 'EXTRA_TASK' | 'POINT_DEDUCTION' | 'EXAM_BAN';
export type PunishmentTriggerBackend = 'TASK_FAIL' | 'TASK_SKIP' | 'EXAM_FAIL' | 'MANUAL';

export interface UserPunishmentDisplay {
  id: number;
  /** 惩罚名称（抽取后才有，未抽取时为null） */
  name: string | null;
  /** 惩罚描述（抽取后才有） */
  description: string | null;
  /** 惩罚类型（抽取后才有） */
  punishmentType: PunishmentTypeBackend | null;
  status: PunishmentStatusBackend;
  /** 触发类型 */
  triggerType: PunishmentTriggerBackend;
  /** 重抽次数 */
  rerollCount: number;
  /** 惩罚截止时间（申领后才有） */
  dueAt: string | null;
  /** 申领截止时间 */
  claimDeadline: string | null;
  createdAt: string;
  /** 惩罚任务详情（如果是额外任务类型） */
  punishmentTask: UserTaskDetail | null;
  /** 抽取到的惩罚值（扣除点数/禁考天数等） */
  punishmentValue: number | null;
}

/** 抽取惩罚结果 */
export interface DrawPunishmentResult {
  userPunishment: UserPunishmentDisplay;
  message: string;
}

/** 用户校园点数信息 */
export interface UserPointsInfo {
  points: number;
  rerollCost: number;
}

// Punishment Room types
export interface PunishmentRoomItem {
  id: number;
  name: string;
  description: string | null;
}

export interface PunishmentRoomRollResult {
  userPunishmentId: number;
  punishment: PunishmentRoomItem;
  campusPoints: number;
}

// Legacy Punishment types for UI components (keep for backward compatibility)
export type PunishmentStatus = 'PENDING' | 'SERVED' | 'APPEALED';
export type PunishmentType = 'FINE_COIN' | 'XP_DEDUCTION' | 'TEMP_BAN' | 'COMMUNITY_SERVICE';

export interface Punishment {
  id: string;
  reason: string;
  type: PunishmentType;
  amount?: number; // e.g. 500
  status: PunishmentStatus;
  issuedAt: string;
  resolvedAt?: string;
  description?: string;
}

// --- User Stats Types (from backend) ---

export interface UserStatsDisplay {
  /** 专注时长（小时），保留一位小数 */
  focusHours: number;
  /** 当前连续天数 */
  streakDays: number;
  /** 完成的任务数 */
  tasksCompleted: number;
  /** 今日锁定时长（分钟） */
  todayLockedMinutes: number;
  /** 最长连续天数 */
  longestStreak: number;
  /** 总锁定次数 */
  totalLockCount: number;
  /** 成功解锁次数 */
  successfulUnlockCount: number;
  /** 当前活跃锁的开始时间（ISO-8601），用于实时计算 */
  activeLockStartedAt?: string;
}

// --- V2 Lock System Types ---

// Keyholder - matches backend KeyholderInfo
export interface LockKeyholder {
  id: number;
  userId: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  permissionLevel: KeyholderPermission;
  isPrimary: boolean;
  assignedAt: string;
  acceptedAt: string | null;
  isActive: boolean;
}

export interface AddKeyholderRequest {
  userId: number;
  permission: KeyholderPermission;
}

export interface UpdateKeyholderRequest {
  permission: KeyholderPermission;
}

// Unlock Request Types
export type UnlockRequestType = 'NORMAL' | 'TEMPORARY' | 'ADJUSTMENT' | 'VOTE';
export type UnlockRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface UnlockRequest {
  id: number;
  lockId: number;
  requesterId: number;
  requesterName: string | null;
  requesterAvatar: string | null;
  keyholderId: number;
  keyholderName: string | null;
  keyholderAvatar: string | null;
  requestType: UnlockRequestType;
  reason: string | null;
  status: UnlockRequestStatus;
  responseNote: string | null;
  respondedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RespondUnlockRequestData {
  approved: boolean;
  responseNote?: string;
}

export interface UnlockRequestResponse {
  message: string;
  request: UnlockRequest;
  lockUnlocked?: boolean;
}

export interface PendingUnlockRequestsResponse {
  requests: UnlockRequest[];
  total: number;
}

// Managed Lock Summary (for keyholder view)
export interface ManagedLockSummary {
  lockId: number;
  wearerId: number;
  wearerName: string | null;
  wearerAvatar: string | null;
  wearerTelegramId: number | null;
  wearerUsername: string | null;
  lockType: LockTypeV2;
  status: LockStatus;
  remainingSeconds: number | null;
  isFrozen: boolean;
  isHygieneOpening: boolean;
  permission: KeyholderPermission;
  createdAt: string;
}

// Lock Extension (matches backend EnabledExtensionInfo)
export interface LockExtensionData {
  id: number;
  type: ExtensionType;  // backend uses 'type' not 'extensionType'
  displayName: string;
  description: string;
  enabled: boolean;  // backend uses 'enabled' not 'isActive'
  config: Record<string, unknown>;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
  canTrigger: boolean;
  cooldownRemainingSeconds: number;
}

export interface ExtensionConfigRequest {
  config: Record<string, unknown>;
  cooldownSeconds?: number;
}

export interface ExtensionTriggerResult {
  success: boolean;
  message: string;
  timeChange?: number;
  data?: Record<string, unknown>;
}

// Coin Toss
export interface CoinTossInfo {
  maxCoinsPerPlayer: number;
  usePercentage: boolean;
  minutesPerCoin: number;
  percentagePerCoin: number;
  userCoinsTossed: number;
  totalCoinsTossed: number;
}

export interface CoinTossResult {
  coinsUsed: number;
  timeAddedMinutes: number;
  campusPointsSpent: number;
  totalCoinsTossed: number;
  maxCoins: number;
}

// Lock Task (V2 - assigned by keyholder)
export interface LockTask {
  id: number;
  lockId: number;
  assignedBy: number;
  assignedByName: string | null;
  title: string;
  description: string | null;
  deadline: string | null;
  rewardMinutes: number;
  penaltyMinutes: number;
  status: LockTaskStatusV2;
  proofImageUrl: string | null;
  reviewNote: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateLockTaskRequest {
  title: string;
  description?: string;
  deadlineMinutes?: number;
  rewardMinutes?: number;
  penaltyMinutes?: number;
  requireVoting?: boolean;
}

export interface SubmitLockTaskProofRequest {
  proofText?: string;
}

export interface ReviewLockTaskRequest {
  approved: boolean;
  reviewNote?: string;
}

// Notifications
export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  data: string | null;
  linkUrl: string | null;
  relatedLockId: number | null;
  relatedTaskId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  enableTelegram: boolean;
  enableInApp: boolean;
  lockNotifications: boolean;
  taskNotifications: boolean;
  keyholderNotifications: boolean;
  extensionNotifications: boolean;
  verificationNotifications: boolean;
  supervisionNotifications: boolean;
  socialNotifications: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

export interface UpdateNotificationSettingsRequest {
  enableTelegram?: boolean;
  enableInApp?: boolean;
  lockNotifications?: boolean;
  taskNotifications?: boolean;
  keyholderNotifications?: boolean;
  extensionNotifications?: boolean;
  verificationNotifications?: boolean;
  supervisionNotifications?: boolean;
  socialNotifications?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

export interface NotificationStats {
  totalCount: number;
  unreadCount: number;
  countByType: Record<string, number>;
}

// --- User Settings ---

export interface UserSettings {
  allowTelegramContact: boolean;
  allowSupervisionRequest: boolean;  // 允许他人发起监督协议签订
  hideFromLeaderboard: boolean;  // 不参与排行榜
  timezone: string;
  dayStartOffsetHours: number;  // -12 to +12, 用于夜猫子调整一天的开始时间
}

export interface UpdateUserSettingsRequest {
  allowTelegramContact?: boolean;
  allowSupervisionRequest?: boolean;  // 允许他人发起监督协议签订
  hideFromLeaderboard?: boolean;  // 不参与排行榜
  timezone?: string;
  dayStartOffsetHours?: number;
}

// Wheel of Fortune
export interface WheelSegment {
  label: string;
  weight: number;
  timeChange: number;
  color?: string;
}

export interface WheelSpinResult {
  segment: WheelSegment;
  timeChange: number;
  message: string;
}

// Dice Roll
export interface DiceRollResult {
  diceValues: number[];
  total: number;
  timeChange: number;
  message: string;
}

// Freeze Request
export interface FreezeRequest {
  durationMinutes?: number;
}

// Lock Comment
export interface LockComment {
  id: number;
  lockId: number;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
  parentId: number | null;
  replyToCommentId: number | null;
  replyToUserName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: LockComment[];
  reactions: CommentReactionSummary[];
}

// Post Lock Comment Request
export interface PostLockCommentRequest {
  content: string;
  parentId?: number;
  replyToCommentId?: number;
}

// Time Change History Entry
export interface TimeChangeHistoryEntry {
  id: number;
  lockId: number;
  extensionType: string;
  actionType: string;
  actorId: number | null;
  actorType: 'USER' | 'KEYHOLDER' | 'SYSTEM' | 'SHARE_LINK';
  actorName: string | null;
  actorAvatar: string | null;
  timeChange: number;
  success: boolean;
  createdAt: string;
}

// --- Feedback & Help Center Types ---

export type FeedbackType = 'BUG' | 'FEATURE_REQUEST' | 'QUESTION' | 'OTHER';
export type FeedbackStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface CreateFeedbackRequest {
  type: FeedbackType;
  subject: string;
  content: string;
  screenshotUrls?: string[];
  deviceInfo?: string;
  appVersion?: string;
}

export interface FeedbackItem {
  id: number;
  type: FeedbackType;
  subject: string;
  status: FeedbackStatus;
  hasResponse: boolean;
  isResponseRead: boolean;
  createdAt: string;
}

export interface FeedbackDetailResponse {
  id: number;
  type: FeedbackType;
  subject: string;
  content: string;
  screenshotUrls: string[];
  deviceInfo: string | null;
  appVersion: string | null;
  status: FeedbackStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface HelpCenterResponse {
  faqs: FAQItem[];
  contactEmail: string;
  telegramSupport: string | null;
  appVersion: string;
}

// --- Admin Feedback Types ---

export interface AdminFeedbackItem {
  id: number;
  userId: number;
  type: FeedbackType;
  subject: string;
  content: string;
  screenshotUrls: string[];
  deviceInfo: string | null;
  appVersion: string | null;
  status: FeedbackStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  respondedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRespondFeedbackRequest {
  response: string;
  status: FeedbackStatus;
}

// --- Community Posts Types ---

export type PostCategory = 'GENERAL' | 'HELP' | 'SHARE' | 'EXPERIENCE' | 'QUESTION' | 'ANNOUNCEMENT';

export const POST_CATEGORY_NAMES: Record<PostCategory, string> = {
  GENERAL: '杂谈',
  HELP: '求助',
  SHARE: '分享',
  EXPERIENCE: '经验',
  QUESTION: '问答',
  ANNOUNCEMENT: '公告'
};

// 帖子来源类型（用于关联日程或回忆）
export type PostSourceType = 'NONE' | 'SCHEDULE' | 'MEMORY';

// 帖子来源数据（用于展示日程或回忆信息）
export interface SourceData {
  type: PostSourceType;
  schedule?: ScheduleSummary & { isShared?: boolean };
  memory?: MemorySummary;
}

// --- Poll Types ---

export type PollType = 'NORMAL' | 'ANONYMOUS';
export type PollSelectionType = 'SINGLE' | 'MULTIPLE';

export interface PollSummary {
  totalVotes: number;
  optionCount: number;
  hasVoted: boolean;
  isEnded: boolean;
}

export interface PollVoter {
  id: number;
  name: string;
  avatar: string | null;
}

export interface PollOptionDetail {
  id: number;
  content: string;
  voteCount: number;
  percentage: number;
  isVotedByMe: boolean;
  voters: PollVoter[];
}

export interface PollDetail {
  id: number;
  pollType: PollType;
  selectionType: PollSelectionType;
  maxSelections: number;
  totalVotes: number;
  endTime: string | null;
  isEnded: boolean;
  hasVoted: boolean;
  options: PollOptionDetail[];
}

export interface CreatePollRequest {
  pollType?: PollType;
  selectionType?: PollSelectionType;
  maxSelections?: number;
  options: string[];
  endTime?: string;
}

export interface VoteRequest {
  optionIds: number[];
}

export interface PostItem {
  id: number;
  category: PostCategory;
  title: string;
  contentPreview: string;
  imageUrls: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  pinnedUntil?: string | null;
  isFeatured: boolean;
  isHot: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  sourceType?: PostSourceType;
  sourceId?: number | null;
  hasPoll?: boolean;
  pollSummary?: PollSummary | null;
  createdAt: string;
  // Author info (匿名时为"匿名用户"和null)
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorLevel: number;
}

export interface PostDetail {
  id: number;
  category: PostCategory;
  title: string;
  content: string;
  imageUrls: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  pinnedUntil?: string | null;
  isFeatured: boolean;
  isHot: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  sourceType?: PostSourceType;
  sourceId?: number | null;
  sourceData?: SourceData | null;
  hasPoll?: boolean;
  poll?: PollDetail | null;
  createdAt: string;
  updatedAt: string;
  // Author info (匿名时为"匿名用户"和null，但isAuthor=true时前端可能需要显示真实信息)
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorLevel: number;
  isAuthor: boolean;
}

export interface MentionedUser {
  id: number;
  name: string;
  avatar: string | null;
}

export interface PostCommentItem {
  id: number;
  parentId: number | null;
  content: string;
  imageUrl: string | null;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  // Author info
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorLevel: number;
  isAuthor: boolean;
  // Reply info
  replyToCommentId: number | null;
  replyToName: string | null;
  // Nested replies
  replies: PostCommentItem[] | null;
  reactions: CommentReactionSummary[];
  mentions: MentionedUser[];
}

export interface CreatePostRequest {
  category?: PostCategory;
  title: string;
  content: string;
  imageUrls?: string[];
  isAnonymous?: boolean;  // 是否匿名发帖
  poll?: CreatePollRequest;  // 可选的投票
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  category?: PostCategory;
  imageUrls?: string[];
}

export interface CreatePostCommentRequest {
  content: string;
  imageUrl?: string;
  parentId?: number;
  replyToCommentId?: number;
  mentionedUserIds?: number[];
}

export interface PostListResponse {
  posts: PostItem[];
  total: number;
  hasMore: boolean;
}

export interface CommentListResponse {
  comments: PostCommentItem[];
  total: number;
  hasMore: boolean;
}

// --- Supervision Agreement System ---

export type SupervisionRole = 'SUPERVISOR' | 'SUPERVISEE';
export type AgreementStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SupervisionAgreement {
  id: number;
  supervisorId: number;
  supervisorName: string;
  supervisorUsername: string | null;
  supervisorAvatar: string | null;
  superviseeId: number;
  superviseeName: string;
  superviseeUsername: string | null;
  superviseeAvatar: string | null;
  initiatorId: number;
  initiatorRole: SupervisionRole;
  status: AgreementStatus;
  durationDays: number | null;  // null = permanent
  startsAt: string | null;
  expiresAt: string | null;
  initiatorSignedAt: string;
  responderSignedAt: string | null;
  hygieneBypassApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignedAgreementItem {
  id: number;
  userId: number;
  agreementId: number;
  agreement: SupervisionAgreement;
  acquiredAt: string;
}

export interface InitiateSupervisionRequest {
  targetUserId: number;
  role: SupervisionRole;  // The initiator's role
  durationDays?: number;  // null = permanent
}

export interface RespondSupervisionRequest {
  accept: boolean;
}

/**
 * 通用用户搜索结果（用于日程分享、回忆邀请等功能）
 */
export interface UserSearchResult {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  level: number;
}

export interface SupervisionSearchResult {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  allowSupervisionRequest: boolean;
}

export interface SupervisionSummary {
  hasSupervisor: boolean;
  supervisor: SupervisionAgreement | null;
  superviseeCount: number;
  supervisees: SupervisionAgreement[];
  pendingRequests: SupervisionAgreement[];
}

// --- Memory System Types ---

export interface MemorySummary {
  id: number;
  scheduleId: number;
  scheduleTitle: string;
  scheduleDate: string;
  contentPreview: string;
  imageUrls: string[];
  isPublishedToCommunity: boolean;
  likeCount: number;
  createdAt: string;
  creatorId: number;
  creatorName: string;
  creatorAvatar: string | null;
}

export interface MemoryDetail {
  id: number;
  schedule: ScheduleSummary & { isShared: boolean };
  content: string;
  imageUrls: string[];
  isPublishedToCommunity: boolean;
  communityPostId: number | null;
  viewCount: number;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  creatorId: number;
  creatorName: string;
  creatorAvatar: string | null;
  isCreator: boolean;
  invitedUsers: InvitedUser[] | null;  // Only visible to creator
}

export interface InvitedUser {
  userId: number;
  userName: string;
  userAvatar: string | null;
  viewedAt: string | null;
  invitedAt: string;
}

export interface CreateMemoryRequest {
  scheduleId: number;
  content: string;
  imageUrls?: string[];
}

export interface UpdateMemoryRequest {
  content?: string;
  imageUrls?: string[];
}

export interface InviteToMemoryRequest {
  userIds: number[];
}

export interface MemoryStats {
  totalMemories: number;
  publishedCount: number;
  totalLikes: number;
  totalViews: number;
}

// --- Schedule Sharing Types ---

export type ParticipantRole = 'OWNER' | 'PARTICIPANT';
export type ParticipantStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface ScheduleParticipant {
  id: number;
  scheduleId: number;
  userId: number;
  userName: string;
  userAvatar: string | null;
  invitedBy: number;
  role: ParticipantRole;
  status: ParticipantStatus;
  canCreateMemory: boolean;
  joinedAt: string | null;
  createdAt: string;
}

export interface SchedulePublication {
  id: number;
  scheduleId: number;
  publishedBy: number;
  communityPostId: number | null;
  description: string | null;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
}

export interface SharedScheduleDetail {
  schedule: Schedule & { isShared: boolean; shareCode: string | null; allowParticipantMemories: boolean };
  participants: ScheduleParticipant[];
  memories: MemorySummary[];
  shareCode: string | null;
  isPublishedToCommunity: boolean;
}

export interface ScheduleInvitation {
  participantId: number;
  scheduleId: number;
  scheduleTitle: string;
  scheduleDate: string;
  scheduleTime: string;
  invitedByUserId: number;
  invitedByUserName: string;
  invitedByUserAvatar: string | null;
  createdAt: string;
}

// Schedule Sharing Request/Response Types

export interface ShareScheduleRequest {
  userIds: number[];
}

export interface JoinByShareCodeRequest {
  shareCode: string;
}

export interface RespondToInvitationRequest {
  accept: boolean;
}

export interface PublishScheduleRequest {
  description?: string;
  imageUrls?: string[];
}

export interface ShareCodeResponse {
  shareCode: string;
  shareLink: string;
}

export interface SharedScheduleListResponse {
  schedules: SharedScheduleDetail[];
  total: number;
}

export interface PendingInvitationsResponse {
  invitations: ScheduleInvitation[];
  total: number;
}

export interface UpdateParticipantPermissionRequest {
  canCreateMemory: boolean;
}

// --- Follow System Types ---

/**
 * 关注统计
 */
export interface FollowStats {
  followingCount: number;  // 关注数
  followersCount: number;  // 粉丝数
}

/**
 * 关注用户信息（用于列表展示）
 */
export interface FollowUserItem {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  bio: string | null;
  isPremium: boolean;
  level: number;
  isFollowedByMe: boolean;  // 我是否关注了TA
  isFollowingMe: boolean;   // TA是否关注了我
  followedAt: string;       // 关注时间
}

/**
 * 关注列表响应
 */
export interface FollowListResponse {
  users: FollowUserItem[];
  total: number;
  hasMore: boolean;
}

/**
 * 关注/取关响应
 */
export interface FollowResponse {
  success: boolean;
  isFollowing: boolean;
  followingCount: number;
  followersCount: number;
}

/**
 * 关注状态响应
 */
export interface FollowStatusResponse {
  isFollowing: boolean;
  isFollowedBy: boolean;  // 对方是否关注我
}

// --- Unlock Vote Types ---

export type UnlockVoteStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface UnlockVoteSession {
  id: number;
  lockId: number;
  userId: number;
  approveVotes: number;
  rejectVotes: number;
  votesRequired: number;
  status: UnlockVoteStatus;
  penaltyMinutes: number;
  telegramMessageId: number | null;
  telegramChatId: number | null;
  expiresAt: string;
  decidedAt: string | null;
  createdAt: string;
}

export interface UnlockVoteDetail {
  session: UnlockVoteSession;
  lockOwnerName: string;
  lockOwnerAvatar: string | null;
  myVote: boolean | null;  // true=approve, false=reject, null=not voted
  remainingSeconds: number;
  canVote: boolean;
}

export interface StartUnlockVoteRequest {
  lockId: number;
}

export interface CastUnlockVoteRequest {
  sessionId: number;
  isApprove: boolean;
}

export interface UnlockVoteResult {
  session: UnlockVoteSession;
  voteRegistered: boolean;
  message: string;
}

export interface CanStartVoteResponse {
  canStart: boolean;
  reason: string | null;
  cooldownUntil: string | null;
}

// --- Optional Task Group Types ---

export type OptionalTaskGroupStatus = 'PENDING_SELECTION' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface UserOptionalTaskGroupDisplay {
  id: number;
  groupName: string;
  groupDescription: string | null;
  courseName: string;
  courseId: number;
  status: OptionalTaskGroupStatus;
  requiredCount: number;
  totalCount: number;
  completedCount: number;
  scheduledDate: string; // LocalDate as YYYY-MM-DD
  createdAt: string;
  availableTasks: OptionalTaskItemDisplay[];
  selectedTasks: SelectedTaskDisplay[] | null;
}

export interface OptionalTaskItemDisplay {
  taskDefinitionId: number;
  name: string;
  description: string | null;
  taskType: TaskTypeBackend;
  targetValue: number;
  targetUnit: TargetUnitBackend;
  sortOrder: number;
  isSelected: boolean;
}

export interface SelectedTaskDisplay {
  taskDefinitionId: number;
  name: string;
  description: string | null;
  taskType: TaskTypeBackend;
  targetValue: number;
  currentValue: number;
  targetUnit: TargetUnitBackend;
  isCompleted: boolean;
  userTaskId: number | null;
  userTaskStatus: TaskStatusBackend | null;
}

export interface SelectTasksRequest {
  taskDefinitionIds: number[];
}

// --- Backend Task Types (missing definitions) ---
export type TaskTypeBackend = 'DURATION' | 'COUNT' | 'MANUAL' | 'LOCK';
export type TargetUnitBackend = 'KILOMETERS' | 'METERS' | 'MINUTES' | 'HOURS' | 'TIMES' | 'NONE';
export type TaskStatusBackend = 'PENDING' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

// --- Admin API Types ---

// Course (Full backend model)
export interface CourseBackend {
  id: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  iconUrl: string | null;
  pointsPerCompletion: number;
  examPointsRequired: number;
  creditsOnPass: number;
  campusPointsPerTask: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  schedules: number[];
  prerequisites: CoursePrerequisiteInfo[];
}

export interface CreateCourseRequest {
  categoryId?: number | null;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  pointsPerCompletion?: number;
  examPointsRequired?: number;
  creditsOnPass?: number;
  campusPointsPerTask?: number;
  schedules?: number[];
  prerequisiteIds?: number[];
}

export interface UpdateCourseRequest {
  categoryId?: number | null;
  name?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  pointsPerCompletion?: number | null;
  examPointsRequired?: number | null;
  creditsOnPass?: number | null;
  campusPointsPerTask?: number | null;
  schedules?: number[] | null;
  prerequisiteIds?: number[] | null;
  isActive?: boolean | null;
}

// TaskDefinition (Full backend model)
export interface TaskDefinitionBackend {
  id: number;
  courseId: number;
  isExamTask: boolean;
  name: string;
  description: string | null;
  iconUrl: string | null;
  taskType: TaskTypeBackend;
  targetValue: number;
  targetUnit: TargetUnitBackend;
  orderIndex: number;
  allowPartial: boolean;
  timeoutMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDefinitionRequest {
  courseId: number;
  isExamTask?: boolean;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  taskType: TaskTypeBackend;
  targetValue?: number;
  targetUnit?: TargetUnitBackend;
  orderIndex?: number;
  allowPartial?: boolean;
  timeoutMinutes?: number;
}

export interface UpdateTaskDefinitionRequest {
  name?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  taskType?: TaskTypeBackend | null;
  targetValue?: number | null;
  targetUnit?: TargetUnitBackend | null;
  orderIndex?: number | null;
  allowPartial?: boolean | null;
  timeoutMinutes?: number | null;
  isActive?: boolean | null;
}

// Punishment (Full backend model)
export interface PunishmentBackend {
  id: number;
  name: string;
  description: string | null;
  triggerType: PunishmentTriggerBackend;
  triggerCourseId: number | null;
  punishmentType: PunishmentTypeBackend;
  punishmentValue: number;
  taskDefinitionId: number | null;
  deadlineHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePunishmentRequest {
  name: string;
  description?: string | null;
  triggerType: PunishmentTriggerBackend;
  triggerCourseId?: number | null;
  punishmentType: PunishmentTypeBackend;
  punishmentValue?: number;
  taskDefinitionId?: number | null;
  deadlineHours?: number;
}

// Category Types
export interface CategoryBackend {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

// Club Types (simplified for admin selection)
export interface ClubBackend {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  categoryId: number | null;
  isActive: boolean;
}

// Buff Types
// 降低难度: TIME_REDUCTION_PERCENT, VALUE_REDUCTION_PERCENT, VALUE_BONUS_FLAT
// 增加难度: TIME_INCREASE_PERCENT, VALUE_INCREASE_PERCENT, VALUE_PENALTY_FLAT
// 奖励加成: POINTS_BONUS_PERCENT
export type BuffTypeBackend =
  | 'TIME_REDUCTION_PERCENT'     // 时间减少%（降低难度）
  | 'VALUE_REDUCTION_PERCENT'    // 目标值减少%（降低难度）
  | 'VALUE_BONUS_FLAT'           // 目标值固定减少（降低难度）
  | 'TIME_INCREASE_PERCENT'      // 时间增加%（增加难度）
  | 'VALUE_INCREASE_PERCENT'     // 目标值增加%（增加难度）
  | 'VALUE_PENALTY_FLAT'         // 目标值固定增加（增加难度）
  | 'POINTS_BONUS_PERCENT';      // 课程点加成%（奖励加成）
export type BuffTargetScope = 'ALL' | 'CATEGORY' | 'COURSE';

export interface BuffBackend {
  id: number;
  clubId: number | null;
  name: string;
  description: string | null;
  buffType: BuffTypeBackend;
  targetScope: BuffTargetScope;
  targetIds: number[];
  value: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuffRequest {
  clubId?: number | null;
  name: string;
  description?: string | null;
  buffType: BuffTypeBackend;
  targetScope: BuffTargetScope;
  targetIds?: number[];
  value: number;
}

export interface UpdateBuffRequest {
  name?: string | null;
  description?: string | null;
  buffType?: BuffTypeBackend | null;
  targetScope?: BuffTargetScope | null;
  targetIds?: number[];
  value?: number | null;
  isActive?: boolean | null;
}

// Item Create/Update Request
export interface CreateItemRequest {
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  itemType?: ItemType;
  rarity?: ItemRarity;
  priceCampusPoints?: number;
  priceCredits?: number;
  maxStack?: number;
  useCooldownMinutes?: number;
  effectDurationMinutes?: number;
  isTradeable?: boolean;
  isAvailable?: boolean;
  buffIds?: number[];
}

// Optional Task Group Request Types
export interface CreateOptionalTaskGroupRequest {
  courseId: number;
  name: string;
  description?: string | null;
  scheduleDays: number[]; // Days of week 1-7
  requiredCount: number;
  taskDefinitionIds: number[];
}

export interface UpdateOptionalTaskGroupRequest {
  name?: string | null;
  description?: string | null;
  scheduleDays?: number[] | null;
  requiredCount?: number | null;
  taskDefinitionIds?: number[] | null;
  isActive?: boolean | null;
}

export interface OptionalTaskGroupBackend {
  id: number;
  courseId: number;
  name: string;
  description: string | null;
  scheduleDays: number[];
  requiredCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  taskDefinitions: TaskDefinitionBackend[];
}

// --- Leaderboard Types ---

export interface LeaderboardEntry {
  rank: number;
  id: number;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  credits: number;
  level: number;
  isPremium: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myRank: number | null;
  totalParticipants: number;
}

// --- Voice Chat Types ---

export type VoiceChatRole = 'LISTENER' | 'SPEAKER';
export type VoiceChatSessionStatus = 'ACTIVE' | 'ENDED';

export interface VoiceChatSession {
  id: number;
  partnerId: number;
  myRole: string;
  partnerRole: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export interface VoiceChatMessage {
  id: number;
  sessionId: number;
  senderId: number;
  content: string;
  isMe: boolean;
  createdAt: string;
}

export interface VoiceChatHistoryResponse {
  sessions: VoiceChatSession[];
  totalCount: number;
}

export interface VoiceChatMessagesResponse {
  messages: VoiceChatMessage[];
  sessionInfo: VoiceChatSession;
}

// WebSocket Message Types
export type VoiceChatClientMessage =
  | { type: 'JOIN_QUEUE'; role: VoiceChatRole; anonymous?: boolean }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'SEND_MESSAGE'; content: string }
  | { type: 'END_CHAT' }
  | { type: 'WEBRTC_OFFER'; sdp: string }
  | { type: 'WEBRTC_ANSWER'; sdp: string }
  | { type: 'ICE_CANDIDATE'; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

// 对方用户信息（非匿名时显示）
export interface PartnerInfo {
  username: string;
  avatarUrl?: string | null;
}

export interface QueueStats {
  listenerCount: number;
  speakerCount: number;
}

export type VoiceChatServerMessage =
  | { type: 'CONNECTED'; message: string; queueStats?: QueueStats | null }
  | { type: 'QUEUE_STATUS'; position: number; waitingCount: number }
  | { type: 'QUEUE_STATS'; listenerCount: number; speakerCount: number }
  | { type: 'MATCH_FOUND'; sessionId: number; partnerRole: string; myRole: string; partnerInfo?: PartnerInfo | null; isInitiator: boolean }
  | { type: 'MESSAGE_RECEIVED'; message: VoiceChatMessage }
  | { type: 'CHAT_ENDED'; endedBy: 'PARTNER' | 'ME' }
  | { type: 'WEBRTC_OFFER'; sdp: string }
  | { type: 'WEBRTC_ANSWER'; sdp: string }
  | { type: 'ICE_CANDIDATE'; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }
  | { type: 'CALL_ENDED'; duration: number; endedBy: 'PARTNER' | 'ME' }
  | { type: 'ERROR'; message: string };

// ===================== 监督任务相关类型 =====================

export type TaskRepeatType = 'ONCE' | 'DAILY' | 'WEEKLY';

// 首页监督关系概览
export interface SupervisionHomeOverview {
  supervisor: SupervisorInfo | null;
  supervisees: SuperviseeInfo[];
  pendingRequestCount: number;
}

export interface SupervisorInfo {
  agreementId: number;
  userId: number;
  name: string;
  username: string | null;
  avatar: string | null;
  agreementStartsAt: string | null;
  agreementExpiresAt: string | null;
}

export interface SuperviseeInfo {
  agreementId: number;
  userId: number;
  name: string;
  username: string | null;
  avatar: string | null;
  agreementStartsAt: string | null;
  agreementExpiresAt: string | null;
  todayCompletedTasks: number;
  todayTotalTasks: number;
}

// 监督者任务定义
export interface SupervisorTaskDefinition {
  id: number;
  agreementId: number;
  supervisorId: number;
  supervisorName: string | null;
  superviseeId: number;
  superviseeName: string | null;
  name: string;
  description: string | null;
  iconUrl: string | null;
  taskType: TaskType;
  targetValue: number;
  targetUnit: TargetUnit;
  allowPartial: boolean;
  timeoutMinutes: number;
  repeatType: TaskRepeatType;
  repeatDays: string | null;
  isActive: boolean;
  requireReview: boolean;
  targetLatitude: number | null;
  targetLongitude: number | null;
  targetRadiusMeters: number | null;
  createdAt: string;
  updatedAt: string;
}

// 监督者任务实例
export interface SupervisorTask {
  id: number;
  definitionId: number;
  superviseeId: number;
  scheduledDate: string;
  dueAt: string | null;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  actualValue: number;
  supervisorNote: string | null;
  // 任务证明
  proofImageKey: string | null;
  proofImageUrl: string | null;
  proofText: string | null;
  proofSubmittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkinAt: string | null;
  createdAt: string;
  updatedAt: string;
  definition?: SupervisorTaskDefinition;
}

// 监督者任务详情（用于前端展示）
export interface SupervisorTaskDetail {
  id: number;
  definitionId: number;
  taskName: string;
  taskDescription: string | null;
  iconUrl: string | null;
  taskType: TaskType;
  targetValue: number;
  targetUnit: TargetUnit;
  actualValue: number;
  status: TaskStatus;
  scheduledDate: string;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  supervisorId: number;
  supervisorName: string;
  supervisorAvatar: string | null;
  supervisorNote: string | null;
  // 任务证明
  proofImageUrl: string | null;
  proofText: string | null;
  proofSubmittedAt: string | null;
  // 审核相关
  requireReview: boolean;
  reviewedAt: string | null;
  rejectionReason: string | null;
  remainingSeconds: number | null;
  progressPercent: number;
  targetLatitude: number | null;
  targetLongitude: number | null;
  targetRadiusMeters: number | null;
}

// 被监督者任务概览
export interface SuperviseeTaskOverview {
  superviseeId: number;
  superviseeName: string;
  superviseeUsername: string | null;
  superviseeAvatar: string | null;
  date: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  failedTasks: number;
  tasks: SupervisorTaskDetail[];
}

// 创建监督者任务定义请求
export interface CreateSupervisorTaskDefinitionRequest {
  superviseeId: number;
  name: string;
  description?: string;
  iconUrl?: string;
  taskType: TaskType;
  targetValue?: number;
  targetUnit?: TargetUnit;
  allowPartial?: boolean;
  requireReview?: boolean;
  timeoutMinutes?: number;
  repeatType?: TaskRepeatType;
  repeatDays?: string;
  scheduledDate?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  targetRadiusMeters?: number;
}

// 更新监督者任务定义请求
export interface UpdateSupervisorTaskDefinitionRequest {
  name?: string;
  description?: string;
  iconUrl?: string;
  taskType?: TaskType;
  targetValue?: number;
  targetUnit?: TargetUnit;
  allowPartial?: boolean;
  requireReview?: boolean;
  timeoutMinutes?: number;
  repeatType?: TaskRepeatType;
  repeatDays?: string;
  isActive?: boolean;
}

// ===================== 轮盘赌游戏系统 =====================

export type RouletteGameStatus = 'DRAFT' | 'PUBLISHED' | 'DELETED';
export type PlaySessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type RollStatus = 'PENDING' | 'SUCCESS' | 'FAILURE';
export type SpecialRuleType = 'SAME_ROLL';
export type SpecialRuleActionType = 'EXTRA_TASK' | 'JUMP_SECTION' | 'MODIFY_DICE_RESULT';
export type RouletteTaskType = 'MANUAL' | 'COUNT' | 'DURATION' | 'LOCK';
export type ModifyActionType = 'SWAP_SUCCESS_FAILURE' | 'FORCE_SUCCESS' | 'FORCE_FAILURE';
export type TaskInstanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type RouletteGameType = 'GRAPH' | 'IMAGE_WHEEL' | 'TEXT_WHEEL' | 'NODE_SCRIPT';

export interface WheelCategory {
  name: string;
  description?: string | null;
  minPoints: number;
  maxPoints: number;
  pointDescriptions?: Record<string, string> | null;
}

export interface ImageWheelConfig {
  imageUrl?: string;
  imageUrls?: string[];
  categories: WheelCategory[];
}

export interface TextWheelConfig {
  categories: WheelCategory[];
}

export interface WheelCategoryResult {
  categoryName: string;
  categoryDescription: string | null;
  rolledValue: number;
  minPoints: number;
  maxPoints: number;
  pointDescription: string | null;
}

export interface WheelRollResponse {
  results: WheelCategoryResult[];
  gameId: number;
  rolledAt: string;
}

export interface RouletteGameSummary {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: RouletteGameStatus;
  playCount: number;
  likeCount: number;
  commentCount: number;
  totalTips: number;
  isLiked: boolean;
  isFavorited: boolean;
  tags: string[];
  gameType: RouletteGameType;
  priceCampusPoints: number;
  isPurchased: boolean;
  createdAt: string;
}

export interface RouletteSection {
  id: number;
  gameId: number;
  name: string;
  sortOrder: number;
  isStart: boolean;
  diceRangeMin: number;
  diceRangeMax: number;
  isRoundDeterminer: boolean;
  countsAsRound: boolean;
  backgroundImageUrl: string | null;
}

export interface RouletteTask {
  id: number;
  sectionId: number;
  diceMin: number;
  diceMax: number;
  title: string;
  description: string | null;
  imageRequired: boolean;
  taskType: RouletteTaskType;
  targetValue: number | null;
  targetUnit: string | null;
  successNextSectionId: number | null;
  failureNextSectionId: number | null;
  roundTargetValue: number | null;
}

export interface RouletteSpecialRule {
  id: number;
  gameId: number;
  ruleType: string;
  conditionValue: number | null;
  actionType: SpecialRuleActionType;
  taskTitle: string | null;
  taskDescription: string | null;
  imageRequired: boolean;
  taskType: RouletteTaskType;
  targetValue: number | null;
  targetUnit: string | null;
  nextSectionId: number | null;
  targetSectionIds: number[] | null;
  modifyAction: ModifyActionType | null;
}

export interface RouletteSectionDetail {
  id: number;
  name: string;
  sortOrder: number;
  isStart: boolean;
  tasks: RouletteTask[];
  diceRangeMin: number;
  diceRangeMax: number;
  isRoundDeterminer: boolean;
  countsAsRound: boolean;
  backgroundImageUrl: string | null;
}

export interface RouletteGameDetail {
  id: number;
  creatorId: number;
  creatorName: string | null;
  creatorAvatar: string | null;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: RouletteGameStatus;
  playCount: number;
  likeCount: number;
  commentCount: number;
  totalTips: number;
  isLiked: boolean;
  isFavorited: boolean;
  tags: string[];
  sections: RouletteSectionDetail[];
  specialRules: RouletteSpecialRule[];
  roundExitEnabled: boolean;
  gameType: RouletteGameType;
  wheelConfig: string | null;
  priceCampusPoints: number;
  isPurchased: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===================== 游戏评论 & 打赏 =====================

export interface GameComment {
  id: number;
  parentId: number | null;
  content: string;
  imageUrl?: string;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  replyToCommentId: number | null;
  replyToName: string | null;
  replies?: GameComment[];
}

export interface GameCommentListResponse {
  comments: GameComment[];
  total: number;
  hasMore: boolean;
}

export interface GameTip {
  id: number;
  gameId: number;
  fromUserId: number;
  fromUserName: string | null;
  fromUserAvatar: string | null;
  toUserId: number;
  amount: number;
  message: string | null;
  createdAt: string;
}

export interface RoulettePlaySession {
  id: number;
  gameId: number;
  playerId: number;
  currentSectionId: number;
  status: PlaySessionStatus;
  lastRollValue: number | null;
  consecutiveSameRolls: number;
  modifiedSectionsJson: string | null;
  targetRounds: number | null;
  completedRounds: number;
  startedAt: string;
  completedAt: string | null;
}

export interface RouletteRollRecord {
  id: number;
  sessionId: number;
  sectionId: number;
  sectionName: string | null;
  rollValue: number;
  taskId: number | null;
  specialRuleId: number | null;
  taskTitle: string | null;
  taskDescription: string | null;
  imageRequired: boolean;
  taskType: RouletteTaskType;
  targetValue: number | null;
  targetUnit: string | null;
  status: RollStatus;
  imageUrl: string | null;
  createdAt: string;
}

export interface RouletteTaskInstance {
  id: number;
  sessionId: number | null;
  rollHistoryId: number | null;
  playerId: number;
  sourceTaskId: number | null;
  sourceRuleId: number | null;
  title: string;
  description: string | null;
  taskType: RouletteTaskType;
  targetValue: number | null;
  targetUnit: string | null;
  currentValue: number;
  status: TaskInstanceStatus;
  imageUrl: string | null;
  proofImageKey: string | null;
  proofText: string | null;
  proofSubmittedAt: string | null;
  dueDate: string | null;
  startedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  gameTitle: string | null;
  gameId: number | null;
}

export interface ActiveSessionSummary {
  id: number;
  gameId: number;
  gameTitle: string;
  gameCoverImageUrl: string | null;
  currentSectionName: string;
  status: string;
  pendingTaskCount: number;
  startedAt: string;
}

export interface PlaySessionResponse {
  session: RoulettePlaySession;
  currentSection: RouletteSection;
  currentRoll: RouletteRollRecord | null;
  rollHistory: RouletteRollRecord[];
  taskInstances: RouletteTaskInstance[];
  gameTitle: string | null;
  coverImageUrl: string | null;
  roundExitEnabled: boolean;
}

export interface RollDiceResponse {
  roll: RouletteRollRecord;
  isSpecialRule: boolean;
  specialRuleType: string | null;
  specialRuleActionType: SpecialRuleActionType | null;
  taskInstance: RouletteTaskInstance | null;
  jumpedToSection: RouletteSection | null;
  modifiedSections: number[] | null;
  modifyAction: ModifyActionType | null;
  roundTargetSet: number | null;
}

// Request DTOs
export interface SectionInput {
  name: string;
  sortOrder: number;
  isStart: boolean;
  tasks: TaskInput[];
  diceRangeMin: number;
  diceRangeMax: number;
  isRoundDeterminer: boolean;
  countsAsRound: boolean;
  backgroundImageUrl?: string | null;
}

export interface TaskInput {
  diceMin: number;
  diceMax: number;
  title: string;
  description?: string;
  imageRequired: boolean;
  taskType: RouletteTaskType;
  targetValue?: number;
  targetUnit?: string;
  successNextSectionIndex: number | null;
  failureNextSectionIndex: number | null;
  roundTargetValue?: number | null;
}

export interface SpecialRuleInput {
  ruleType: string;
  conditionValue?: number;
  actionType: SpecialRuleActionType;
  taskTitle?: string;
  taskDescription?: string;
  imageRequired: boolean;
  taskType: RouletteTaskType;
  targetValue?: number;
  targetUnit?: string;
  nextSectionIndex: number | null;
  targetSectionIndices?: number[];
  modifyAction?: ModifyActionType;
}

export interface CreateRouletteGameRequest {
  title: string;
  description: string;
  coverImageUrl?: string;
  sections: SectionInput[];
  specialRules: SpecialRuleInput[];
  tags: string[];
  roundExitEnabled: boolean;
  gameType: RouletteGameType;
  wheelConfig?: string;
  priceCampusPoints?: number;
}

export interface CompleteRollRequest {
  success: boolean;
  imageUrl?: string;
}

export interface UpdateTaskInstanceRequest {
  currentValue?: number;
  imageUrl?: string;
}

export interface CompleteTaskInstanceRequest {
  success: boolean;
  imageUrl?: string;
}

// ============ Major/Specialization Types ============

export type MajorStatus = 'ACTIVE' | 'DROPPED' | 'GRADUATED';

export interface MajorSummary {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  courseCount: number;
  totalCredits: number;
  canEnroll: boolean;
  enrollmentBlockReason: string | null;
}

export interface MajorDetail {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  courses: MajorCourseInfo[];
}

export interface MajorCourseInfo {
  courseId: number;
  courseName: string;
  courseIconUrl: string | null;
  orderIndex: number;
  creditsOnPass: number;
  isPassed: boolean;
}

export interface UserMajor {
  id: number;
  userId: number;
  majorId: number;
  enrolledAt: string;
  status: MajorStatus;
  droppedAt: string | null;
  graduatedAt: string | null;
}

export interface UserMajorProgress {
  userMajor: UserMajor;
  majorName: string;
  majorDescription: string | null;
  majorIconUrl: string | null;
  courses: MajorCourseProgress[];
  completedCount: number;
  totalCount: number;
  totalCreditsEarned: number;
  isGraduationReady: boolean;
}

export interface MajorCourseProgress {
  courseId: number;
  courseName: string;
  courseIconUrl: string | null;
  orderIndex: number;
  creditsOnPass: number;
  enrollmentStatus: EnrollmentStatus | null;
  currentPoints: number;
  examPointsRequired: number;
  examPassed: boolean;
  creditsEarned: number;
  prerequisitesMet: boolean;
}

export interface EnrollMajorRequest {
  majorId: number;
}

export interface CreateMajorRequest {
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  courseIds: number[];
}

export interface UpdateMajorRequest {
  name: string | null;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean | null;
  courseIds: number[] | null;
}

// --- Changelog Types ---

export interface ChangelogData {
  id: number;
  title: string;
  content: string;
  version: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangelogRequest {
  title: string;
  content: string;
  version?: string;
  isPublished?: boolean;
}

export interface UpdateChangelogRequest {
  title?: string;
  content?: string;
  version?: string;
  isPublished?: boolean;
}

// ==================== 验证照片拓展 ====================

export interface VerificationPictureConfig {
  scheduleTimes: string[];
  toleranceMinutes: number;
  shareToCommunity: boolean;
  penaltyMinutes?: number;
}

export interface VerificationPhotoData {
  id: number;
  lockId: number;
  userId: number;
  windowId: number | null;
  imageKey: string;
  imageUrl: string | null;
  isShared: boolean;
  uploadedAt: string;
  scheduledTime: string;
}

export interface VerificationWindowData {
  id: number;
  lockId: number;
  scheduledTime: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
  windowStartLocal?: string;
  windowEndLocal?: string;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  completedAt: string | null;
  photoId: number | null;
}

export interface VerificationStatusResponse {
  enabled: boolean;
  config: VerificationPictureConfig | null;
  todayWindows: VerificationWindowData[];
  currentWindow: VerificationWindowData | null;
  totalPhotos: number;
  missedCount: number;
}

// ==================== Library/Book Types ====================

export interface BookCategory {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type BookReviewStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';

export interface BookSummary {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  priceCampusPoints: number;
  authorId: number;
  authorName: string | null;
  viewCount: number;
  isPublished: boolean;
  seriesId: number | null;
  seriesName: string | null;
  orderInSeries: number | null;
  isUserUploaded: boolean;
  reviewStatus: BookReviewStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookDetail {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  content: string | null;
  priceCampusPoints: number;
  authorId: number;
  authorName: string | null;
  viewCount: number;
  isPublished: boolean;
  isPurchased: boolean;
  isFree: boolean;
  seriesId: number | null;
  seriesName: string | null;
  orderInSeries: number | null;
  seriesBooks: BookSummary[] | null;
  isUserUploaded: boolean;
  reviewStatus: BookReviewStatus;
  readingProgress: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookListResponse {
  books: BookSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== 图书评论 =====

export interface BookCommentItem {
  id: number;
  parentId: number | null;
  content: string;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  isAuthor: boolean;
  replyToName: string | null;
  replies: BookCommentItem[] | null;
  reactions: CommentReactionSummary[];
}

export interface BookCommentListResponse {
  comments: BookCommentItem[];
  total: number;
  hasMore: boolean;
}

export interface CreateBookCommentRequest {
  content: string;
  parentId?: number | null;
}

export interface BookSeriesSummary {
  id: number;
  name: string;
  coverImageUrl: string | null;
  authorName: string | null;
  categoryName: string | null;
  bookCount: number;
  isUserUploaded: boolean;
}

export interface BookSeriesData {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  authorId: number;
  authorName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  isUserUploaded: boolean;
  bookCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookSeriesDetailResponse {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  authorId: number;
  authorName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  isUserUploaded: boolean;
  books: BookSummary[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookSeriesListResponse {
  series: BookSeriesSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReadingProgressData {
  bookId: number;
  bookTitle: string | null;
  bookCoverImageUrl: string | null;
  scrollPosition: number;
  lastReadAt: string | null;
}

export interface CreateBookRequest {
  title: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: number;
  content: string;
  priceCampusPoints?: number;
  isPublished?: boolean;
  seriesId?: number;
  orderInSeries?: number;
}

export interface UpdateBookRequest {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: number | null;
  content?: string;
  priceCampusPoints?: number;
  isPublished?: boolean;
  seriesId?: number;
  orderInSeries?: number;
}

export interface UserUploadBookRequest {
  title: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: number;
  content: string;
  priceCampusPoints?: number;
  seriesId?: number;
  orderInSeries?: number;
}

export interface UserUploadResponse {
  message: string;
  bookId: number | null;
  seriesId: number | null;
  uploadFeeCharged: number;
  remainingCampusPoints: number;
}

export interface CreateBookSeriesRequest {
  name: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: number;
}

export interface UpdateBookSeriesRequest {
  name?: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: number;
}

export interface ReviewBookRequest {
  approved: boolean;
  rejectionReason?: string;
}

export interface PurchaseBookResponse {
  message: string;
  purchase: {
    id: number;
    userId: number;
    bookId: number;
    pricePaid: number;
    purchasedAt: string;
  };
  remainingCampusPoints: number;
}

// --- Custom Waveform Types ---

export interface WaveformSection {
  enabled: boolean;
  frequencyMode: 'fixed' | 'random' | 'sweep';
  frequencyMin: number;
  frequencyMax: number;
  intensityBars: number[]; // 8 values, 0-100
  durationMs: number;
  restDurationMs: number;
}

export interface CustomWaveform {
  id: number;
  name: string;
  sections: WaveformSection[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomWaveformListResponse {
  waveforms: CustomWaveform[];
  total: number;
}

export interface SaveCustomWaveformRequest {
  id?: number;
  name: string;
  sections: WaveformSection[];
  isPublic?: boolean;
}

export interface PreviewWaveformRequest {
  sections: WaveformSection[];
}

export interface PreviewWaveformResponse {
  v3Data: string[];
  frameCount: number;
  durationMs: number;
}

// ============ Foundation Types ============

export type FoundationApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FoundationTransactionData {
  id: number;
  txHash: string;
  description: string;
  amount: string;
  fromAddress: string | null;
  createdByAdminId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoundationSponsorData {
  id: number;
  name: string;
  avatarUrl: string | null;
  message: string | null;
  totalAmount: string | null;
  createdAt: string;
}

export interface FoundationApplicationData {
  id: number;
  userId: number;
  userName: string;
  telegramId: number;
  telegramUsername: string | null;
  title: string;
  description: string;
  amount: string;
  status: FoundationApplicationStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoundationOverviewResponse {
  walletAddress: string;
  baseScanUrl: string;
  transactions: FoundationTransactionData[];
  sponsors: FoundationSponsorData[];
}

export interface CreateFoundationApplicationRequest {
  title: string;
  description: string;
  amount: string;
}

export interface CreateFoundationTransactionRequest {
  txHash: string;
  description: string;
  amount: string;
  fromAddress?: string;
}

export interface CreateFoundationSponsorRequest {
  name: string;
  avatarUrl?: string;
  message?: string;
  totalAmount?: string;
}

export interface UpdateFoundationApplicationStatusRequest {
  status: FoundationApplicationStatus;
  adminNote?: string;
}

// ==================== Gallery (美术馆) Types ====================

export interface GalleryImage {
  id: number;
  galleryItemId: number;
  imageKey: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
}

export interface GalleryItemSummary {
  id: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  imageCount: number;
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  reviewStatus: string;
  createdAt: string;
  tags?: string[];
}

export interface GalleryItemDetail {
  id: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  description: string | null;
  images: GalleryImage[];
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  isPurchased: boolean;
  isFree: boolean;
  isLiked: boolean;
  reviewStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  tags?: string[];
}

export interface GalleryReviewItem {
  id: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  description: string | null;
  images: { id: number; imageUrl: string; sortOrder: number }[];
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  reviewStatus: string;
  createdAt: string;
}

export interface GalleryListResponse {
  items: GalleryItemSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Cinema (电影院) Types ====================

export interface CinemaVideoSummary {
  id: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  duration: number | null;
  muxPlaybackId: string | null;
  muxAssetStatus: string | null;
  reviewStatus: string;
  createdAt: string;
  playbackToken?: string | null;
  thumbnailToken?: string | null;
  tags?: string[];
}

export interface CinemaVideoDetail {
  id: number;
  authorId: number;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  duration: number | null;
  muxPlaybackId: string | null;
  muxAssetStatus: string | null;
  isPurchased: boolean;
  isFree: boolean;
  isLiked: boolean;
  reviewStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  playbackToken?: string | null;
  thumbnailToken?: string | null;
  tags?: string[];
}

export interface CinemaListResponse {
  videos: CinemaVideoSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CinemaUploadUrlResponse {
  videoId: number;
  uploadUrl: string;
}

export interface PurchaseGalleryResponse {
  message: string;
  remainingCampusPoints: number;
}

export interface PurchaseCinemaResponse {
  message: string;
  remainingCampusPoints: number;
}

// ==================== Cinema 评论系统 ====================

export interface CinemaCommentItem {
  id: number;
  parentId: number | null;
  replyToCommentId: number | null;
  content: string;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  isAuthor: boolean;
  replyToName: string | null;
  replies: CinemaCommentItem[] | null;
  reactions: CommentReactionSummary[];
}

export interface CinemaCommentListResponse {
  comments: CinemaCommentItem[];
  total: number;
  hasMore: boolean;
}

// ==================== Gallery 评论系统 ====================

export interface GalleryCommentItem {
  id: number;
  parentId: number | null;
  replyToCommentId: number | null;
  content: string;
  likeCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  isAuthor: boolean;
  replyToName: string | null;
  replies: GalleryCommentItem[] | null;
  reactions: CommentReactionSummary[];
}

export interface GalleryCommentListResponse {
  comments: GalleryCommentItem[];
  total: number;
  hasMore: boolean;
}

// ==================== Profile Board ====================

export type BoardBlockType = 'IMAGE' | 'TEXT' | 'LINK' | 'COLOR' | 'COUNTDOWN' | 'MUSIC' | 'STAT' | 'COURSE' | 'TASK';
export type BoardBlockSize = 'SMALL' | 'WIDE' | 'LARGE' | 'W3H2' | 'W3H3' | 'W3H4' | 'W4H3';

export interface BoardBlockContent {
  // Image
  imageUrl?: string;
  imageKey?: string;
  caption?: string;
  // Text
  title?: string;
  body?: string;
  bgColor?: string;
  bgGradient?: string;
  textColor?: string;
  // Link
  url?: string;
  linkTitle?: string;
  linkDescription?: string;
  // Countdown
  targetDate?: string;
  label?: string;
  // Music
  songName?: string;
  artistName?: string;
  musicUrl?: string;
  platform?: string;
  // Stat
  statValue?: string;
  statLabel?: string;
  statIcon?: string;
}

export interface BoardBlock {
  id: string;
  type: BoardBlockType;
  size: BoardBlockSize;
  sortOrder: number;
  content: BoardBlockContent;
}

export interface BoardResponse {
  blocks: BoardBlock[];
}

// ==================== Board Widget Data ====================

export interface PublicCourseInfo {
  id: number;
  name: string;
  iconUrl: string | null;
  categoryName: string | null;
  currentPoints: number;
  examPointsRequired: number;
  progressPercent: number;
}

export interface PublicCoursesWidgetData {
  courses: PublicCourseInfo[];
}

export interface PublicTaskInfo {
  taskName: string;
  courseName: string;
  courseIconUrl: string | null;
  status: string;
  progressPercent: number;
}

export interface PublicTaskSummary {
  date: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionPercent: number;
  tasks: PublicTaskInfo[];
}

// ==================== Live Stream (直播间) Types ====================

export interface LiveStreamData {
  id: number;
  hostUserId: number;
  hostName: string | null;
  hostAvatar: string | null;
  title: string;
  status: string; // CREATED, LIVE, ENDED, ERROR
  muxPlaybackId: string | null;
  viewerCount: number;
  peakViewerCount: number;
  totalGiftPoints: number;
  durationSeconds: number | null;
  startedAt: string | null;
  createdAt: string | null;
}

export interface LiveStreamReplay {
  id: number;
  hostUserId: number;
  hostName: string | null;
  hostAvatar: string | null;
  title: string;
  muxAssetPlaybackId: string | null;
  playbackToken: string | null;
  durationSeconds: number | null;
  viewerCount: number;
  peakViewerCount: number;
  totalGiftPoints: number;
  endedAt: string | null;
}

export interface RoomStatusResponse {
  isLive: boolean;
  stream: LiveStreamData | null;
  playbackToken: string | null;
}

export interface StartStreamResponse {
  streamId: number;
  muxStreamKey: string;
  muxPlaybackId: string;
}

export interface ReplayListResponse {
  replays: LiveStreamReplay[];
  total: number;
}

export interface LiveStreamChatMessage {
  type: 'CHAT_MESSAGE';
  userId: number;
  userName: string;
  userAvatar: string | null;
  content: string;
  timestamp: number;
}

export interface LiveStreamGiftMessage {
  type: 'GIFT_RECEIVED';
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  amount: number;
  timestamp: number;
}

export type LiveStreamServerMessage =
  | { type: 'CONNECTED'; stream: LiveStreamData | null }
  | { type: 'ROOM_STATUS'; isLive: boolean; stream: LiveStreamData | null }
  | LiveStreamChatMessage
  | LiveStreamGiftMessage
  | { type: 'VIEWER_COUNT'; count: number }
  | { type: 'STREAM_STARTED'; stream: LiveStreamData }
  | { type: 'STREAM_ENDED'; message: string }
  | { type: 'ERROR'; message: string };

// ==================== Music Room (音乐室) Types ====================

// asmr.one API types
export interface AsmrCircle {
  id: number;
  name: string;
  source_id: string;
  source_type: string;
}

export interface AsmrVA {
  id: string; // UUID
  name: string;
}

export interface AsmrTag {
  id: number;
  name: string;
  i18n?: {
    'ja-jp'?: { name: string };
    'en-us'?: { name: string };
    'zh-cn'?: { name: string };
  };
}

export interface AsmrLanguageEdition {
  edition_id: number;
  lang: string;
  label: string;
  workno: string;
}

export interface AsmrWork {
  id: number;
  source_id: string;
  source_type: string;
  title: string;
  circle_id: number;
  nsfw: boolean;
  release: string;
  create_date: string;
  dl_count: number;
  price: number;
  review_count: number;
  rate_count: number;
  rate_average_2dp: number;
  rate_count_detail?: Record<string, number>;
  rank: number | null;
  has_subtitle: boolean;
  duration: number; // seconds
  age_category_string: string;
  work_attributes?: string;
  circle: AsmrCircle;
  vas: AsmrVA[];
  tags: AsmrTag[];
  language_editions?: AsmrLanguageEdition[];
  samCoverUrl: string;
  thumbnailCoverUrl?: string;
  mainCoverUrl: string;
}

export interface AsmrPagination {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

export interface AsmrWorksResponse {
  works: AsmrWork[];
  pagination: AsmrPagination;
}

export interface AsmrTrackNode {
  type: 'folder' | 'audio' | 'text' | 'image' | 'other';
  title: string;
  hash?: string;
  duration?: number;
  size?: number;
  mediaStreamUrl?: string;
  mediaDownloadUrl?: string;
  streamLowQualityUrl?: string;
  children?: AsmrTrackNode[];
  work?: { id: number; source_id: string; source_type: string };
  workTitle?: string;
}

// Our backend types
export interface MusicPlaylist {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  type?: string; // 'USER' | 'WATCH_LATER'
  shareCode?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedPlaylistResponse {
  playlist: MusicPlaylist;
  items: MusicPlaylistItem[];
  ownerName: string;
}

export interface MusicPlaylistItem {
  id: number;
  playlistId: number;
  asmrWorkId: number;
  sortOrder: number;
  addedAt: string;
}

export interface MusicPlayProgress {
  asmrWorkId: number;
  trackHash: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
}

export interface FollowedVA {
  vaId: string;
  vaName: string;
  createdAt: string;
}

export interface FollowedCircle {
  circleId: number;
  circleName: string;
  createdAt: string;
}

// ==================== Music Catalog (server-cached) ====================

export interface ListeningHistoryResponse {
  workIds: number[];
  total: number;
}

export interface CachedTag {
  id: number;
  name: string;
  i18n?: Record<string, { name?: string; locale?: string }>;
  count: number;
}

export interface CachedCircle {
  id: number;
  name: string;
  count: number;
}

export interface CachedVA {
  id: string;
  name: string;
  count: number;
}

export interface CatalogListResponse<T> {
  items: T[];
  total: number;
}

// --- Campus Walk (漫步校园) ---

export type CampusDropType = 'STICKY_NOTE' | 'PHOTO_PAPER' | 'KEY_BOX' | 'TIME_CAPSULE' | 'DRIFT_BOTTLE';
export type CampusDropStatus = 'ACTIVE' | 'PICKED_UP' | 'INVALIDATED';

export interface CampusDrop {
  id: number;
  dropperId: number;
  dropperName: string | null;
  dropperAvatar: string | null;
  dropType: CampusDropType;
  latitude: number;
  longitude: number;
  pickupRadiusMeters: number;
  content: string | null;
  imageKeys: string[];
  imageUrls: string[];
  status: CampusDropStatus;
  pickerId: number | null;
  pickerName: string | null;
  lockId: number | null;
  opensAt: string | null;
  isLocked: boolean;
  distanceMeters: number | null;
  canPickup: boolean;
  createdAt: string;
  pickedUpAt: string | null;
}

export interface PickupDropResponse {
  drop: CampusDrop;
  message: string;
  lockEffect: string | null;
}

export interface DirectionHint {
  dropId: number;
  dropType: CampusDropType;
  direction: string;
  distanceRange: string;
}

export interface KeyBoxHint {
  dropId: number;
  direction: string;
  temperature: 'burning' | 'hot' | 'warm' | 'cold';
  distanceRange: string;
}

// ===== 探索记录 + 足迹热力图 (F5/F6) =====

export interface ExplorationStats {
  visitedCells: number;
  totalCells: number;
  percentage: number;
}

export interface FootprintSample {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export interface HeatmapCell {
  latitude: number;
  longitude: number;
  weight: number;
}

// ===== 附近的人 / 漫步模式 (F7) =====

export interface StrollUser {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  approximateDirection: string;
  approximateDistance: string;
}

// ===== 校园地标打卡 (F9) =====

export interface CampusLandmark {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  iconType: string;
  checkedIn: boolean;
  checkedInToday: boolean;
  totalCheckins: number;
}

// ===== 信标系统 =====

export type BeaconBaseType = 'IRON' | 'GOLD' | 'DIAMOND';
export type BeaconStatus = 'ACTIVE' | 'RECALLED';

export interface CampusBeacon {
  id: number;
  ownerId: number;
  ownerName: string | null;
  ownerAvatar: string | null;
  latitude: number;
  longitude: number;
  baseType: BeaconBaseType;
  radiusMeters: number;
  status: BeaconStatus;
  contactCount: number;
  isOwner: boolean;
  isContact: boolean;
  distanceMeters: number;
  canInteract: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceBeaconRequest {
  latitude: number;
  longitude: number;
  baseType: BeaconBaseType;
}

export interface SwapBeaconBaseRequest {
  newBaseType: BeaconBaseType;
}

export interface BeaconContact {
  userId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  contactedAt: string;
}

// ===== Street Coins =====

export type CampusCoinStatus = 'ACTIVE' | 'COLLECTED' | 'EXPIRED';

export interface CampusCoin {
  id: number;
  latitude: number;
  longitude: number;
  value: number;
  status: CampusCoinStatus;
  distanceMeters: number | null;
  canCollect: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface CollectCoinResponse {
  coin: CampusCoin;
  pointsAwarded: number;
  totalCampusPoints: number;
  message: string;
}

export interface CoinStats {
  totalCollected: number;
  collectedToday: number;
  pointsEarnedToday: number;
  collectedThisHour: number;
}

// ===================== 骗子酒馆 (Liar's Tavern) =====================

export type TavernRoomStatus = 'WAITING' | 'STARTING' | 'IN_GAME' | 'PLAY_AGAIN' | 'FINISHED' | 'CANCELLED';
export type TavernEntryType = 'CAMPUS_POINTS' | 'LOCK_TIME';
export type TavernPlayerStatus = 'ALIVE' | 'ELIMINATED' | 'DISCONNECTED';
export type TavernCardRank = 'KING' | 'QUEEN' | 'ACE' | 'JOKER';
export type TavernGamePhase = 'DEALING' | 'PLAYING' | 'CHALLENGE_REVEAL' | 'ROULETTE' | 'ROUND_END' | 'GAME_OVER';

export interface TavernPlayerInfo {
  seatIndex: number;
  userId: number | null;
  displayName: string;
  avatarUrl: string | null;
  isBot: boolean;
  status: TavernPlayerStatus;
}

export interface TavernRoomDetail {
  id: number;
  inviteCode: string;
  ownerId: number;
  status: TavernRoomStatus;
  isPublic: boolean;
  players: TavernPlayerInfo[];
  maxPlayers: number;
  createdAt: string;
}

export interface TavernRoomSummary {
  id: number;
  inviteCode: string;
  ownerName: string;
  ownerAvatar: string | null;
  status: string;
  playerCount: number;
  maxPlayers: number;
  isPublic: boolean;
  createdAt: string;
}

export interface TavernGameStateView {
  roomId: number;
  phase: TavernGamePhase;
  roundNumber: number;
  targetRank: TavernCardRank;
  currentTurnSeat: number;
  turnTimeRemainingMs: number;
  myHand: string[];
  mySeatIndex: number;
  players: TavernPlayerGameView[];
  pileSize: number;
  lastClaimedCount: number;
  lastPlayedBySeat: number;
  isFirstTurnOfRound: boolean;
}

export interface TavernPlayerGameView {
  seatIndex: number;
  displayName: string;
  avatarUrl: string | null;
  isBot: boolean;
  status: TavernPlayerStatus;
  cardCount: number;
  chamberPosition: number;
  isCurrentTurn: boolean;
}

export interface TavernGameHistory {
  roomId: number;
  players: TavernPlayerHistoryEntry[];
  winnerId: number | null;
  winnerName: string | null;
  totalRounds: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TavernPlayerHistoryEntry {
  userId: number | null;
  displayName: string;
  isBot: boolean;
  status: string;
  eliminatedAtRound: number | null;
}

// WebSocket messages — server to client
export type TavernServerMessageType =
  | 'CONNECTED'
  | 'ROOM_UPDATE'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'GAME_STARTING'
  | 'GAME_STATE'
  | 'ROUND_START'
  | 'TURN_START'
  | 'CARDS_PLAYED'
  | 'LIAR_CALLED'
  | 'CHALLENGE_RESULT'
  | 'ROULETTE_START'
  | 'ROULETTE_RESULT'
  | 'PLAYER_ELIMINATED'
  | 'GAME_OVER'
  | 'CHAT_MESSAGE'
  | 'MATCHMAKING_STATUS'
  | 'MATCH_FOUND'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED'
  | 'TURN_TIMEOUT'
  | 'PLAY_AGAIN_STATUS'
  | 'ERROR'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'ICE_CANDIDATE';

export interface TavernServerMessage {
  type: TavernServerMessageType;
  // CONNECTED
  sessionToken?: string;
  roomId?: number;
  yourSeatIndex?: number;
  // ROOM_UPDATE
  room?: TavernRoomDetail;
  // PLAYER_JOINED
  player?: TavernPlayerInfo;
  // PLAYER_LEFT / PLAYER_ELIMINATED / ROULETTE_START / TURN_START
  seatIndex?: number;
  displayName?: string;
  // GAME_STARTING
  countdownSeconds?: number;
  // GAME_STATE
  state?: TavernGameStateView;
  // ROUND_START
  roundNumber?: number;
  targetRank?: string;
  yourCards?: string[];
  firstTurnSeat?: number;
  // TURN_START
  timeRemainingMs?: number;
  canCallLiar?: boolean;
  isYourTurn?: boolean;
  mustCallLiar?: boolean;
  // CARDS_PLAYED
  cardCount?: number;
  remainingCards?: number;
  // LIAR_CALLED
  challengerSeat?: number;
  challengerName?: string;
  targetSeat?: number;
  targetName?: string;
  // CHALLENGE_RESULT
  revealedCards?: string[];
  wasLying?: boolean;
  loserSeat?: number;
  loserName?: string;
  // ROULETTE_START
  chamberPosition?: number;
  // ROULETTE_RESULT
  died?: boolean;
  chamberFired?: number;
  bulletWasAt?: number;
  // PLAYER_ELIMINATED
  remainingPlayers?: number;
  // GAME_OVER
  winnerSeat?: number;
  winnerName?: string;
  winnerUserId?: number;
  rewardCampusPoints?: number;
  totalRounds?: number;
  // CHAT_MESSAGE
  userId?: number;
  avatarUrl?: string | null;
  content?: string;
  timestamp?: number;
  // MATCHMAKING_STATUS
  playersInQueue?: number;
  requiredPlayers?: number;
  estimatedWaitSeconds?: number | null;
  // MATCH_FOUND
  message?: string;
  players?: TavernPlayerInfo[];
  // TURN_TIMEOUT
  autoAction?: string;
  // ERROR (uses message above)
  // PLAY_AGAIN_STATUS
  readyPlayerSeats?: number[];
  timeoutSeconds?: number;
  // WebRTC
  fromSeat?: number;
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

// WebSocket messages — client to server
export type TavernClientMessageType =
  | 'READY'
  | 'START_GAME'
  | 'PLAY_CARDS'
  | 'CALL_LIAR'
  | 'CHAT_MESSAGE'
  | 'ADD_BOT'
  | 'REMOVE_BOT'
  | 'PLAY_AGAIN'
  | 'RECONNECT'
  | 'JOIN_MATCHMAKING'
  | 'LEAVE_MATCHMAKING'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'ICE_CANDIDATE';

export interface TavernClientMessage {
  type: TavernClientMessageType;
  roomId?: number;
  inviteCode?: string;
  isPublic?: boolean;
  entryType?: string;
  lockId?: number;
  cardIndices?: number[];
  content?: string;
  botDifficulty?: string;
  seatIndex?: number;
  sessionToken?: string;
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  targetSeat?: number;
}

// ==================== Alumni Chat ====================

export interface CharacterCardSummary {
  id: number;
  creatorId: number;
  creatorName?: string;
  creatorAvatar?: string;
  name: string;
  avatarUrl?: string;
  introduction?: string;
  tags?: string; // JSON array
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  chatCount: number;
  reviewStatus: string;
  isPublished: boolean;
  createdAt?: string;
}

export interface CharacterCardData {
  id: number;
  creatorId: number;
  creatorName?: string;
  creatorAvatar?: string;
  name: string;
  avatarUrl?: string;
  introduction?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  detailedDescription?: string;
  tags?: string;
  suggestedReplies?: string;
  openingDialogues?: string;
  images: CharacterCardImageData[];
  worldBookEntries: WorldBookEntryData[];
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  chatCount: number;
  reviewStatus: string;
  rejectionReason?: string;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterCardMarketplaceDetail {
  id: number;
  creatorId: number;
  creatorName?: string;
  creatorAvatar?: string;
  name: string;
  avatarUrl?: string;
  introduction?: string;
  personality?: string;
  scenario?: string;
  tags?: string;
  suggestedReplies?: string;
  images: CharacterCardImageData[];
  priceCampusPoints: number;
  viewCount: number;
  likeCount: number;
  chatCount: number;
  isPurchased: boolean;
  isFree: boolean;
  isLiked: boolean;
  isOwner: boolean;
  createdAt?: string;
}

export interface CharacterCardImageData {
  id: number;
  imageUrl: string;
  sortOrder: number;
}

export interface CharacterCardListResponse {
  items: CharacterCardSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorldBookEntryData {
  id: number;
  characterCardId: number;
  name: string;
  content: string;
  isEnabled: boolean;
  notes?: string;
  isAlwaysActive: boolean;
  triggerKeywords?: string;
  insertPosition: string;
  priority: number;
  insertRole: string;
  insertDepth: number;
  caseSensitive: boolean;
  triggerProbability: number;
  scanDepth: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatConversationData {
  id: number;
  userId: number;
  characterCardId: number;
  characterName?: string;
  characterAvatarUrl?: string;
  title?: string;
  aiProviderType: string;
  customApiUrl?: string;
  customModelName?: string;
  serverModelId?: string;
  totalTokensUsed: number;
  totalCentsSpent: number;
  lastActiveAt?: string;
  createdAt?: string;
}

export interface ChatConversationDetail {
  conversation: ChatConversationData;
  messages: ChatMessageData[];
  hasMore: boolean;
}

export interface ChatMessageData {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  tokenCount: number;
  createdAt?: string;
}

export interface AiModelConfigData {
  id: number;
  modelId: string;
  displayName: string;
  inputPriceCentsPerMillion: number;
  outputPriceCentsPerMillion: number;
  maxContextTokens: number;
  isAvailable: boolean;
}

export interface ChatStreamChunk {
  type: 'content' | 'done' | 'error' | 'usage';
  content?: string;
  usage?: TokenUsageData;
  error?: string;
}

export interface TokenUsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  centsCharged: number;
}

export interface CreateCharacterCardRequest {
  name: string;
  introduction?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  detailedDescription?: string;
  tags?: string;
  suggestedReplies?: string;
  openingDialogues?: string;
  priceCampusPoints?: number;
}

export interface UpdateCharacterCardRequest {
  name?: string;
  introduction?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  detailedDescription?: string;
  tags?: string;
  suggestedReplies?: string;
  openingDialogues?: string;
  priceCampusPoints?: number;
}

export interface CreateConversationRequest {
  characterCardId: number;
  title?: string;
  aiProviderType?: string;
  customApiUrl?: string;
  customApiKey?: string;
  customModelName?: string;
  serverModelId?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  aiProviderType?: string;
  customApiUrl?: string;
  customApiKey?: string;
  customModelName?: string;
  serverModelId?: string;
}

export interface CreateWorldBookEntryRequest {
  name: string;
  content: string;
  isEnabled?: boolean;
  notes?: string;
  isAlwaysActive?: boolean;
  triggerKeywords?: string;
  insertPosition?: string;
  priority?: number;
  insertRole?: string;
  insertDepth?: number;
  caseSensitive?: boolean;
  triggerProbability?: number;
  scanDepth?: number;
}

export interface UpdateWorldBookEntryRequest {
  name?: string;
  content?: string;
  isEnabled?: boolean;
  notes?: string;
  isAlwaysActive?: boolean;
  triggerKeywords?: string;
  insertPosition?: string;
  priority?: number;
  insertRole?: string;
  insertDepth?: number;
  caseSensitive?: boolean;
  triggerProbability?: number;
  scanDepth?: number;
}

// --- Rope Art Studio Types ---

export type RopeArtistStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type RopeBookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'REVIEWED' | 'CANCELLED_BY_CLIENT' | 'REJECTED';

export interface RopeArtistListItem {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string;
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  minPrice: string | null;
  isPaused: boolean;
  previewImages: string[];
}

export interface RopeArtistListResponse {
  artists: RopeArtistListItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface PortfolioImage {
  id: number;
  imageUrl: string;
  caption: string;
  sortOrder: number;
  createdAt: string;
}

export interface PriceListItem {
  id: number;
  title: string;
  description: string;
  priceText: string;
  images: string[];
  isActive: boolean;
}

export interface RopeReview {
  id: number;
  bookingId: number;
  clientId: number;
  clientName: string;
  clientAvatar: string | null;
  clientLevel: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface BusyDateData {
  date: string;
  reason: string;
}

export interface RopeArtistDetail {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string;
  contactTelegram: string | null;
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  isPaused: boolean;
  maxBookingDaysAhead: number;
  userAvatarUrl: string | null;
  userLevel: number;
  portfolioImages: PortfolioImage[];
  priceLists: PriceListItem[];
  recentReviews: RopeReview[];
}

export interface RopeArtistData {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  city: string;
  status: string;
  maxBookingDaysAhead: number;
  maxBookingsPerDay: number;
  isPaused: boolean;
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  createdAt: string;
}

export interface RopeAvailabilityResponse {
  busyDates: BusyDateData[];
  maxBookingDaysAhead: number;
}

export interface RopeBookingData {
  id: number;
  artistId: number;
  artistName: string;
  clientId: number;
  clientName: string;
  priceListId: number;
  priceListTitle: string;
  bookingDate: string;
  note: string;
  status: RopeBookingStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface ApplyRopeArtistRequest {
  displayName: string;
  bio: string;
  city: string;
  specialties?: string;
  experienceYears?: number;
  applicationImageUrls: string[];
}

export interface UpdateRopeArtistProfileRequest {
  displayName?: string;
  bio?: string;
  city?: string;
  specialties?: string;
  experienceYears?: number;
  maxBookingDaysAhead?: number;
}

export interface CreatePriceListRequest {
  title: string;
  description: string;
  priceText: string;
  imageUrls?: string[];
}

export interface UpdatePriceListRequest {
  title?: string;
  description?: string;
  priceText?: string;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface SetBusyDatesRequest {
  dates: string[];
  reason?: string;
}

export interface RemoveBusyDatesRequest {
  dates: string[];
}

export interface CreateBookingRequest {
  artistId: number;
  priceListId: number;
  bookingDate: string;
  note?: string;
}

export interface CreateRopeReviewRequest {
  rating: number;
  comment: string;
}
