import React, { useState, useCallback, useRef, createContext, useContext, useEffect, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStartParam } from '../../lib/telegram-provider';
import { ScheduleEvent, SelfLock, CampusTaskSummary, ScheduleSummary, SelfLockSummary, UserTaskDetail, ManagedLockSummary, SupervisorTaskDetail } from '../../types';
import { BottomNavBar, UserTaskDetailModal, SupervisorTaskDetailModal } from '../ui';
import { DesktopSidebar } from './DesktopSidebar';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { LightboxProvider } from '../../contexts/LightboxContext';
import { Dashboard, CreateScheduleModal, CreateTaskModal, CreateTaskRequestModal, CreateLockWizard, SupervisionRequestModal } from '../features';
import { supervisionApi, selfLockApi, userTasksApi } from '../../lib/api';
import { supervisionQueryKeys } from '../../hooks/useSupervision';
import { queryKeys } from '../../lib/query-client';
import type { SupervisionAgreement } from '../../types';
import { EventDetailView } from './EventDetailView';
import { LockDetailView } from './LockDetailView';
import type { CampusLocation } from '../features/Dashboard';
import type { SupervisorTaskDefinition } from '../../types';
import { Loader2 } from 'lucide-react';
import { MusicPlayerProvider } from '../music/MusicPlayer';

// Eagerly loaded main tab pages (always mounted in DOM)
import { CampusTasks } from '../social/CampusTasks';
import { ShopPage } from '../ShopPage';
import { ProfilePage } from '../profile/ProfilePage';

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="h-full flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
  </div>
);

// Helper: creates a component that wraps React.lazy with Suspense
// Usage stays identical to normal components — no JSX changes needed
function lazyLoad<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(factory);
  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={<PageLoader />}>
      <LazyComponent {...(props as any)} />
    </Suspense>
  );
}

// --- Lazy-loaded sub-pages (only downloaded when first navigated to) ---

// Home sub-pages
const AuditoriumPage = lazyLoad(() => import('../academic/AuditoriumPage'));
const LibraryPage = lazyLoad(() => import('../media/LibraryPage').then(m => ({ default: m.LibraryPage })));
const BookDetailPage = lazyLoad(() => import('../media/BookDetailPage').then(m => ({ default: m.BookDetailPage })));
const BookSeriesDetailPage = lazyLoad(() => import('../media/BookSeriesDetailPage').then(m => ({ default: m.BookSeriesDetailPage })));
const UserUploadPage = lazyLoad(() => import('../profile/UserUploadPage').then(m => ({ default: m.UserUploadPage })));
const TeachingBuildingPage = lazyLoad(() => import('../academic/TeachingBuildingPage'));
const VoiceChatRoom = lazyLoad(() => import('../social/VoiceChatRoom'));
const TherapyRoom = lazyLoad(() => import('../TherapyRoom'));
const RouletteRoomPage = lazyLoad(() => import('../roulette/RouletteRoomPage'));
const PunishmentRoomPage = lazyLoad(() => import('../academic/PunishmentRoomPage'));
const ArtGalleryPage = lazyLoad(() => import('../media/ArtGalleryPage'));
const ArtGalleryDetailPage = lazyLoad(() => import('../media/ArtGalleryDetailPage'));
const ArtGalleryUploadPage = lazyLoad(() => import('../media/ArtGalleryUploadPage'));
const CinemaPage = lazyLoad(() => import('../media/CinemaPage'));
const LiveStreamRoom = lazyLoad(() => import('../social/LiveStreamRoom'));
const MusicRoomPage = lazyLoad(() => import('../music/MusicRoomPage'));
const MusicWorkDetailPage = lazyLoad(() => import('../music/MusicWorkDetailPage'));
const MusicPlaylistPage = lazyLoad(() => import('../music/MusicPlaylistPage'));
const CampusWalkPage = lazyLoad(() => import('../social/CampusWalkPage'));
const GameLobbyPage = lazyLoad(() => import('../game/GameLobbyPage'));
const CinemaDetailPage = lazyLoad(() => import('../media/CinemaDetailPage'));
const CinemaUploadPage = lazyLoad(() => import('../media/CinemaUploadPage'));
const CreatorProfilePage = lazyLoad(() => import('../profile/CreatorProfilePage'));
const SuperviseeDetailPage = lazyLoad(() => import('../task/SuperviseeDetailPage').then(m => ({ default: m.SuperviseeDetailPage })));
const SupervisorTaskEditorPage = lazyLoad(() => import('../task/SupervisorTaskEditorPage').then(m => ({ default: m.SupervisorTaskEditorPage })));
const MemoryDetailPage = lazyLoad(() => import('../memory/MemoryDetailPage'));
const AlumniChatPage = lazyLoad(() => import('../alumni-chat/AlumniChatPage'));
const CharacterCardDetail = lazyLoad(() => import('../alumni-chat/CharacterCardDetail'));
const CharacterCardWizard = lazyLoad(() => import('../alumni-chat/CharacterCardWizard'));
const ChatPage = lazyLoad(() => import('../alumni-chat/ChatPage'));
const RopeArtStudioPage = lazyLoad(() => import('../rope-art/RopeArtStudioPage'));
const RopeArtistManagePage = lazyLoad(() => import('../rope-art/RopeArtistManagePage'));

// Campus sub-pages
const TaskDetailPage = lazyLoad(() => import('../task/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const PlaygroundLockDetail = lazyLoad(() => import('../lock/PlaygroundLockDetail'));
const PostDetailPage = lazyLoad(() => import('../social/PostDetailPage'));
const TaskRequestDetailPage = lazyLoad(() => import('../task/TaskRequestDetailPage').then(m => ({ default: m.TaskRequestDetailPage })));

// Profile sub-pages
const AcademicPortalPage = lazyLoad(() => import('../academic/AcademicPortalPage').then(m => ({ default: m.AcademicPortalPage })));
const MajorPage = lazyLoad(() => import('../academic/MajorPage').then(m => ({ default: m.MajorPage })));
const DisciplinaryPage = lazyLoad(() => import('../academic/DisciplinaryPage').then(m => ({ default: m.DisciplinaryPage })));
const LockHistoryPage = lazyLoad(() => import('../lock/LockHistoryPage'));
const MemoryListPage = lazyLoad(() => import('../memory/MemoryListPage'));
const GeneralSettingsPage = lazyLoad(() => import('../settings/GeneralSettingsPage').then(m => ({ default: m.GeneralSettingsPage })));
const NotificationSettingsPage = lazyLoad(() => import('../settings/NotificationSettingsPage'));
const HelpSupportPage = lazyLoad(() => import('../settings/HelpSupportPage'));
const BlockedUsersPage = lazyLoad(() => import('../settings/BlockedUsersPage').then(m => ({ default: m.BlockedUsersPage })));
const NotificationsPage = lazyLoad(() => import('../settings/NotificationsPage'));
const FollowListPage = lazyLoad(() => import('../social/FollowListPage').then(m => ({ default: m.FollowListPage })));
const CreatorModePage = lazyLoad(() => import('../CreatorModePage'));
const FoundationPage = lazyLoad(() => import('../FoundationPage').then(m => ({ default: m.FoundationPage })));
const BoardEditorPage = lazyLoad(() => import('../profile/BoardEditorPage').then(m => ({ default: m.BoardEditorPage })));
const FriendLinksPage = lazyLoad(() => import('../profile/FriendLinksPage'));

// User profile overlay
const UserProfilePage = lazyLoad(() => import('../profile/UserProfilePage').then(m => ({ default: m.UserProfilePage })));

// Waveform picker (deep link only)
const WaveformPicker = lazyLoad(() => import('../music/WaveformPicker').then(m => ({ default: m.WaveformPicker })));

// Inline therapy controller (deep link only)
const InlineTherapyController = lazyLoad(() => import('../therapy/InlineTherapyController'));

// Context for global user profile navigation
interface UserProfileContextType {
  viewUserProfile: (userId: number) => void;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export const useUserProfileNavigation = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfileNavigation must be used within MainLayout');
  }
  return context;
};

type ProfileSubPage = 'none' | 'academic' | 'major' | 'disciplinary' | 'lock-history' | 'memory' | 'settings' | 'notification-settings' | 'blocked-users' | 'help-support' | 'notifications' | 'following' | 'followers' | 'creator-mode' | 'foundation' | 'friend-links' | 'board-editor';
type CampusSubPage = 'none' | 'task-detail' | 'lock-detail' | 'post-detail' | 'task-request-detail';
type HomeSubPage = 'none' | 'event-detail' | 'lock-detail' | 'memory-detail' | 'auditorium' | 'library' | 'book-detail' | 'book-series-detail' | 'user-upload' | 'teaching-building' | 'voice-chat' | 'therapy-room' | 'roulette-room' | 'punishment-room' | 'activity-center' | 'supervisee-detail' | 'task-editor' | 'art-gallery' | 'art-gallery-detail' | 'art-gallery-upload' | 'cinema' | 'cinema-detail' | 'cinema-upload' | 'live-stream' | 'music-room' | 'music-detail' | 'music-playlist' | 'campus-walk' | 'creator-profile' | 'liars-tavern' | 'alumni-chat' | 'alumni-chat-detail' | 'alumni-chat-wizard' | 'alumni-chat-session' | 'rope-art' | 'rope-art-manage';

// Union types for both legacy and backend types
type ScheduleEventType = ScheduleEvent | ScheduleSummary;
type SelfLockType = SelfLock | SelfLockSummary;

export const MainLayout: React.FC = () => {
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [activeTab, setActiveTab] = useState('home');

  const handleTabChange = useCallback((tabId: string) => {
    if (tabId === activeTab) {
      window.dispatchEvent(new CustomEvent('scroll-to-top'));
    } else {
      setActiveTab(tabId);
      setScrollNavVisible(true); // show nav when switching tabs
    }
  }, [activeTab]);

  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventType | null>(null);
  const [selectedLock, setSelectedLock] = useState<SelfLockType | null>(null);
  const [isKeyholderView, setIsKeyholderView] = useState(false); // true when viewing a managed lock
  const [wearerTelegramId, setWearerTelegramId] = useState<number | null>(null);
  const [wearerUsername, setWearerUsername] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorTab, setCreatorTab] = useState<'schedule' | 'lock'>('schedule');
  const [creatorInitialDate, setCreatorInitialDate] = useState<Date | undefined>(undefined);
  const [isLockWizardOpen, setIsLockWizardOpen] = useState(false);
  const [profileSubPage, setProfileSubPage] = useState<ProfileSubPage>('none');
  const [campusSubPage, setCampusSubPage] = useState<CampusSubPage>('none');
  const [selectedTask, setSelectedTask] = useState<CampusTaskSummary | null>(null);
  const [homeSubPage, setHomeSubPage] = useState<HomeSubPage>('none');
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateTaskRequestOpen, setIsCreateTaskRequestOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // User task detail modal state
  const [selectedUserTask, setSelectedUserTask] = useState<UserTaskDetail | null>(null);
  const [isUserTaskModalOpen, setIsUserTaskModalOpen] = useState(false);

  // Supervisor task detail modal state
  const [selectedSupervisorTask, setSelectedSupervisorTask] = useState<SupervisorTaskDetail | null>(null);
  const [isSupervisorTaskModalOpen, setIsSupervisorTaskModalOpen] = useState(false);

  // Global user profile view state
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);

  // Supervision request modal state
  const [isSupervisionModalOpen, setIsSupervisionModalOpen] = useState(false);
  const [pendingSupervisionRequests, setPendingSupervisionRequests] = useState<SupervisionAgreement[]>([]);

  // Lightbox close registration (for BackButton support)
  const lightboxCloseRef = useRef<(() => void) | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const registerLightbox = useCallback((fn: () => void) => {
    lightboxCloseRef.current = fn;
    setIsLightboxOpen(true);
  }, []);

  const unregisterLightbox = useCallback(() => {
    lightboxCloseRef.current = null;
    setIsLightboxOpen(false);
  }, []);

  // Supervisee detail state
  const [selectedSupervisee, setSelectedSupervisee] = useState<{
    id: number;
    name: string;
    avatar?: string;
  } | null>(null);
  const [editingTaskDefinition, setEditingTaskDefinition] = useState<SupervisorTaskDefinition | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [selectedAsmrWorkId, setSelectedAsmrWorkId] = useState<number | null>(null);
  const [creatorProfileAuthorId, setCreatorProfileAuthorId] = useState<number | null>(null);
  const [creatorProfileSource, setCreatorProfileSource] = useState<'gallery' | 'cinema'>('gallery');
  const [selectedPlaylist, setSelectedPlaylist] = useState<import('../../types').MusicPlaylist | null>(null);
  const [musicSearchKeyword, setMusicSearchKeyword] = useState<string | undefined>(undefined);
  const [musicBrowseTarget, setMusicBrowseTarget] = useState<{ type: 'va'; id: string; name: string } | { type: 'circle'; id: number; name: string } | undefined>(undefined);

  // Alumni chat state
  const [alumniChatCardId, setAlumniChatCardId] = useState<number | null>(null);
  const [alumniChatConversationId, setAlumniChatConversationId] = useState<number | null>(null);
  const [alumniChatEditCardId, setAlumniChatEditCardId] = useState<number | null>(null);

  // Deep link lock ID (from startapp=lock_<id>)
  const [deepLinkLockId, setDeepLinkLockId] = useState<number | null>(null);
  // Deep link view code (from startapp=lockcode_<6-digit-code>)
  const [deepLinkViewCode, setDeepLinkViewCode] = useState<string | null>(null);

  // Waveform picker share code (from startapp=wf_<shareCode>)
  const [wfShareCode, setWfShareCode] = useState<string | null>(null);

  // Therapy controller share code (from startapp=therapy_<shareCode>)
  const [therapyShareCode, setTherapyShareCode] = useState<string | null>(null);

  // Handle startParam from Telegram Direct Link (e.g., ?startapp=user_123456 or ?startapp=lock_123)
  useEffect(() => {
    const startParam = getStartParam();
    if (startParam) {
      if (startParam.startsWith('user_')) {
        const userIdStr = startParam.replace('user_', '');
        const userId = parseInt(userIdStr, 10);
        if (!isNaN(userId)) {
          setViewingUserId(userId);
        }
      } else if (startParam.startsWith('lock_')) {
        const lockIdStr = startParam.replace('lock_', '');
        const lockId = parseInt(lockIdStr, 10);
        if (!isNaN(lockId)) {
          setDeepLinkLockId(lockId);
          setActiveTab('campus');
        }
      } else if (startParam.startsWith('lockcode_')) {
        const code = startParam.replace('lockcode_', '');
        if (code) {
          setDeepLinkViewCode(code);
          setActiveTab('campus');
        }
      } else if (startParam.startsWith('wf_')) {
        const shareCode = startParam.replace('wf_', '');
        if (shareCode) {
          setWfShareCode(shareCode);
        }
      } else if (startParam.startsWith('therapy_')) {
        const shareCode = startParam.replace('therapy_', '');
        if (shareCode) {
          setTherapyShareCode(shareCode);
        }
      } else if (startParam.startsWith('post_')) {
        const postIdStr = startParam.replace('post_', '');
        const postId = parseInt(postIdStr, 10);
        if (!isNaN(postId)) {
          setSelectedPostId(postId);
          setCampusSubPage('post-detail');
          setActiveTab('campus');
        }
      } else if (startParam.startsWith('mylock_')) {
        const lockIdStr = startParam.replace('mylock_', '');
        const lockId = parseInt(lockIdStr, 10);
        if (!isNaN(lockId)) {
          selfLockApi.getLockSummary(lockId).then((summary) => {
            setSelectedLock(summary);
            setIsKeyholderView(false);
            setHomeSubPage('lock-detail');
            setActiveTab('home');
          }).catch(() => {});
        }
      } else if (startParam === 'supervision') {
        supervisionApi.getPending().then((requests) => {
          setPendingSupervisionRequests(requests);
          setIsSupervisionModalOpen(true);
        }).catch(() => {});
      } else if (startParam === 'tasks') {
        setActiveTab('home');
      } else if (startParam.startsWith('gallery_')) {
        const id = parseInt(startParam.replace('gallery_', ''), 10);
        if (!isNaN(id)) {
          setSelectedGalleryId(id);
          setHomeSubPage('art-gallery-detail');
          setActiveTab('home');
        }
      } else if (startParam.startsWith('cinema_')) {
        const id = parseInt(startParam.replace('cinema_', ''), 10);
        if (!isNaN(id)) {
          setSelectedCinemaId(id);
          setHomeSubPage('cinema-detail');
          setActiveTab('home');
        }
      } else if (startParam.startsWith('music_')) {
        const id = parseInt(startParam.replace('music_', ''), 10);
        if (!isNaN(id)) {
          setSelectedAsmrWorkId(id);
          setHomeSubPage('music-detail');
          setActiveTab('home');
        }
      }
    }
  }, []);

  // Handle deep link from Android widget (com.lovein.university://lock/<id>)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { isCapacitorNative } = await import('../../lib/environment');
        if (!isCapacitorNative()) return;
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url);
            if (url.host === 'lock') {
              // Deep link from lock widget: open owner's lock detail in home tab
              const lockIdStr = url.pathname.replace('/', '');
              const lockId = parseInt(lockIdStr, 10);
              if (!isNaN(lockId)) {
                selfLockApi.getLockSummary(lockId).then((summary) => {
                  setSelectedLock(summary);
                  setIsKeyholderView(false);
                  setHomeSubPage('lock-detail');
                  setActiveTab('home');
                }).catch(() => {});
              }
            } else if (url.host === 'managed-lock') {
              // Deep link from managed lock widget: managed-lock/<lockId>/<wearerId>/<telegramId>/<username>
              const parts = url.pathname.replace(/^\//, '').split('/');
              const lockId = parseInt(parts[0], 10);
              const wearerId = parseInt(parts[1], 10);
              const telegramId = parts[2] ? parseInt(parts[2], 10) : null;
              const username = parts[3] || null;
              if (!isNaN(lockId) && !isNaN(wearerId)) {
                selfLockApi.getLockSummary(lockId).then((summary) => {
                  setSelectedLock(summary);
                  setIsKeyholderView(true);
                  setWearerTelegramId(telegramId && telegramId !== 0 ? telegramId : null);
                  setWearerUsername(username);
                  setHomeSubPage('lock-detail');
                  setActiveTab('home');
                }).catch(() => {});
              }
            }
          } catch {}
        });
        cleanup = () => listener.remove();
      } catch {}
    })();
    return () => { cleanup?.(); };
  }, []);

  // Fetch lock summary when deep link lock ID is set (from Telegram share links)
  useEffect(() => {
    if (!deepLinkLockId) return;
    selfLockApi.getLockSummary(deepLinkLockId).then((summary) => {
      setSelectedPlaygroundLock(summary);
      setCampusSubPage('lock-detail');
      setActiveTab('campus');
    }).catch(() => {
      // Lock not found or error, ignore
    }).finally(() => {
      setDeepLinkLockId(null);
    });
  }, [deepLinkLockId]);

  // Fetch lock summary when deep link view code is set (from lockcode_ deep links for private locks)
  useEffect(() => {
    if (!deepLinkViewCode) return;
    const code = deepLinkViewCode;
    setDeepLinkViewCode(null);
    selfLockApi.getLockSummaryByViewCode(code).then((summary) => {
      setSelectedPlaygroundLock(summary);
      setSelectedPlaygroundLockViewCode(code);
      setCampusSubPage('lock-detail');
      setActiveTab('campus');
    }).catch(() => {
      // Code invalid or expired, ignore
    });
  }, [deepLinkViewCode]);

  const viewUserProfile = (userId: number) => {
    setViewingUserId(userId);
  };

  const handleUserProfileBack = () => {
    setViewingUserId(null);
  };

  // Handle notification link navigation
  const handleNotificationLinkClick = async (linkUrl: string, _data?: string) => {
    // Parse the linkUrl to determine where to navigate
    const path = linkUrl.includes('://') ? new URL(linkUrl).pathname : linkUrl;

    // /playground/locks/{id} — navigate to Playground lock detail (comments etc.)
    const playgroundLockMatch = path.match(/\/playground\/locks\/(\d+)/);
    if (playgroundLockMatch) {
      const lockId = parseInt(playgroundLockMatch[1], 10);
      try {
        const summary = await selfLockApi.getLockSummary(lockId);
        setSelectedPlaygroundLock(summary);
        setCampusSubPage('lock-detail');
        setActiveTab('campus');
        setProfileSubPage('none');
      } catch (err) {
        console.error('Failed to navigate to playground lock:', err);
      }
      return;
    }

    // /locks/{id} or /locks/{id}/tasks/{id} — navigate to lock detail
    const lockMatch = path.match(/\/locks\/(\d+)/);
    if (lockMatch) {
      const lockId = parseInt(lockMatch[1], 10);
      try {
        const summary = await selfLockApi.getLockSummary(lockId);
        setSelectedLock(summary);
        setIsKeyholderView(false);
        setHomeSubPage('lock-detail');
        setActiveTab('home');
        setProfileSubPage('none');
      } catch (err) {
        console.error('Failed to navigate to lock:', err);
      }
      return;
    }

    // /posts/{id} — navigate to post detail
    const postMatch = path.match(/\/posts\/(\d+)/);
    if (postMatch) {
      const postId = parseInt(postMatch[1], 10);
      setSelectedPostId(postId);
      setCampusSubPage('post-detail');
      setActiveTab('campus');
      setProfileSubPage('none');
      return;
    }

    // /supervision/supervisee/{id} — navigate to user profile
    const superviseeMatch = path.match(/\/supervision\/supervisee\/(\d+)/);
    if (superviseeMatch) {
      const superviseeId = parseInt(superviseeMatch[1], 10);
      setViewingUserId(superviseeId);
      setProfileSubPage('none');
      return;
    }

    // /supervision/pending or /supervision — show supervision modal
    if (path.includes('/supervision')) {
      try {
        const requests = await supervisionApi.getPending();
        setPendingSupervisionRequests(requests);
        setIsSupervisionModalOpen(true);
        setProfileSubPage('none');
      } catch (err) {
        console.error('Failed to fetch supervision requests:', err);
      }
      return;
    }

    // /tasks — navigate to supervisor tasks (home sub page)
    if (path.includes('/tasks')) {
      setActiveTab('home');
      setProfileSubPage('none');
      return;
    }
  };

  const handleSupervisionModalClose = () => {
    setIsSupervisionModalOpen(false);
    setPendingSupervisionRequests([]);
  };

  const handleSupervisionSuccess = async () => {
    // Refresh the pending requests
    try {
      const requests = await supervisionApi.getPending();
      setPendingSupervisionRequests(requests);
      if (requests.length === 0) {
        setIsSupervisionModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to refresh supervision requests:', err);
    }
    // Trigger refresh
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEventClick = (event: ScheduleEventType) => {
    setSelectedEvent(event);
    setHomeSubPage('event-detail');
  };

  const handleLockClick = (lock: SelfLockType) => {
    setSelectedLock(lock);
    setIsKeyholderView(false); // Viewing own lock
    setHomeSubPage('lock-detail');
  };

  // Handle managed lock click - convert to SelfLockSummary format for detail view
  const handleManagedLockClick = (managedLock: ManagedLockSummary) => {
    // Create a minimal SelfLockSummary from ManagedLockSummary
    // LockDetailView will fetch full details using the lockId
    const lockSummary: SelfLockSummary = {
      id: managedLock.lockId,
      userId: managedLock.wearerId,
      username: managedLock.wearerName,
      telegramUsername: managedLock.wearerUsername ?? null,
      userPhotoUrl: managedLock.wearerAvatar,
      status: managedLock.status,
      difficulty: 'NORMAL', // Will be fetched in detail view
      isPublic: false,
      likesReceived: 0,
      isLikedByMe: false,
      remainingMinutes: managedLock.remainingSeconds ? Math.floor(managedLock.remainingSeconds / 60) : null,
      remainingSeconds: managedLock.remainingSeconds,
      hideRemainingTime: false,
      hasImage: false,
      createdAt: managedLock.createdAt,
      lockType: managedLock.lockType,
      isFrozen: managedLock.isFrozen,
      isHygieneOpening: managedLock.isHygieneOpening,
      hygieneOpeningEndsAt: null,
      hygieneOpeningEnabled: false,
      hygieneOpeningDailyLimit: 1,
      hygieneOpeningLimitMode: 'DAILY',
      hygieneOpeningCooldownHours: 8,
      hygieneOpeningsUsedToday: 0,
      hygieneImageRequired: false,
      hygieneBypassKeyholder: false,
      primaryKeyholderId: null,
      keyholderInactiveDays: null,
      lockBoxType: null,
      lockBoxUnlocked: false,
      likeUnlockEnabled: false,
      likeUnlockRequired: null,
      lastBumpedAt: null,
      coverImageUrl: null,
      myApplicationStatus: null,
      pendingApplicationCount: 0,
      punishmentMode: false,
      punishmentModeExpiresAt: null,
    };
    setSelectedLock(lockSummary);
    setIsKeyholderView(true); // Viewing as keyholder/manager
    setWearerTelegramId(managedLock.wearerTelegramId ?? null);
    setWearerUsername(managedLock.wearerUsername ?? null);
    setHomeSubPage('lock-detail');
  };

  const handleViewMemory = (memory: { id: number }) => {
    setSelectedMemoryId(memory.id);
    setHomeSubPage('memory-detail');
  };

  const handleMemoryBack = () => {
    setHomeSubPage('event-detail'); // Go back to event detail
    setTimeout(() => {
      setSelectedMemoryId(null);
    }, 300);
  };

  const handleUserTaskClick = (task: UserTaskDetail) => {
    setSelectedUserTask(task);
    setIsUserTaskModalOpen(true);
  };

  const handleUserTaskModalClose = () => {
    setIsUserTaskModalOpen(false);
    setTimeout(() => {
      setSelectedUserTask(null);
    }, 300);
  };

  // Handle supervisor task click
  const handleSupervisorTaskClick = (task: SupervisorTaskDetail) => {
    setSelectedSupervisorTask(task);
    setIsSupervisorTaskModalOpen(true);
  };

  const handleSupervisorTaskModalClose = () => {
    setIsSupervisorTaskModalOpen(false);
    setTimeout(() => {
      setSelectedSupervisorTask(null);
    }, 300);
  };

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.behavior.all });
  };

  const handleUserTaskStart = async (task: UserTaskDetail) => {
    const updatedTask = await userTasksApi.startTask(task.id);
    setSelectedUserTask(updatedTask);
    invalidateTaskQueries();
  };

  const handleUserTaskComplete = async (task: UserTaskDetail, actualValue?: number) => {
    const updatedTask = await userTasksApi.completeTask(task.id, actualValue);
    setSelectedUserTask(updatedTask);
    invalidateTaskQueries();
  };

  const handleUserTaskUpdateProgress = async (task: UserTaskDetail, newValue: number) => {
    const updatedTask = await userTasksApi.updateProgress(task.id, newValue);
    setSelectedUserTask(updatedTask);
    invalidateTaskQueries();
  };

  const handleUserTaskRefresh = async () => {
    invalidateTaskQueries();
  };

  const handleUserTaskAbandon = async (task: UserTaskDetail) => {
    const updatedTask = await userTasksApi.abandonTask(task.id);
    setSelectedUserTask(updatedTask);
    invalidateTaskQueries();
  };

  // Supervisor task modal actions
  const handleSupervisorTaskStart = async (task: SupervisorTaskDetail) => {
    const response = await supervisionApi.startTask(task.id);
    // Update selected task with new data, preserving supervisor info
    setSelectedSupervisorTask(prev => prev ? {
      ...prev,
      ...response.task,
      supervisorName: prev.supervisorName,
    } : null);
    // Invalidate React Query cache to refresh Dashboard
    queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.myTasks() });
  };

  const handleSupervisorTaskComplete = async (task: SupervisorTaskDetail, actualValue?: number) => {
    // For MANUAL tasks, pass targetValue as actualValue to ensure completion
    const finalValue = actualValue ?? (task.taskType === 'MANUAL' ? task.targetValue : undefined);
    const response = await supervisionApi.completeTask(task.id, finalValue);
    setSelectedSupervisorTask(prev => prev ? {
      ...prev,
      ...response.task,
      supervisorName: prev.supervisorName,
    } : null);
    // Invalidate React Query cache to refresh Dashboard
    queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.myTasks() });
  };

  const handleSupervisorTaskIncrement = async (task: SupervisorTaskDetail) => {
    const newValue = task.actualValue + 1;
    const response = await supervisionApi.updateTaskProgress(task.id, newValue);
    setSelectedSupervisorTask(prev => prev ? {
      ...prev,
      ...response.task,
      supervisorName: prev.supervisorName,
    } : null);
    // Auto-complete if target reached
    if (newValue >= task.targetValue) {
      const completeResponse = await supervisionApi.completeTask(task.id, newValue);
      setSelectedSupervisorTask(prev => prev ? {
        ...prev,
        ...completeResponse.task,
        supervisorName: prev.supervisorName,
      } : null);
    }
    // Invalidate React Query cache to refresh Dashboard
    queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.myTasks() });
  };

  const handleSupervisorTaskSubmitProof = async (task: SupervisorTaskDetail, proofImageKey?: string, proofText?: string) => {
    const response = await supervisionApi.submitProof(task.id, proofImageKey, proofText);
    // Update selected task with proof info
    setSelectedSupervisorTask(prev => prev ? {
      ...prev,
      proofImageUrl: proofImageKey ? undefined : prev.proofImageUrl, // Will be refreshed from API
      proofText: proofText || prev.proofText,
      proofSubmittedAt: new Date().toISOString(),
    } : null);
    // Invalidate React Query cache to refresh Dashboard
    queryClient.invalidateQueries({ queryKey: supervisionQueryKeys.myTasks() });
  };

  const handleHomeBack = () => {
    setHomeSubPage('none');
    setTimeout(() => {
      setSelectedEvent(null);
      setSelectedLock(null);
      setSelectedSupervisee(null);
      setEditingTaskDefinition(null);
      setIsKeyholderView(false);
      setWearerTelegramId(null);
      setWearerUsername(null);
    }, 300);
  };

  // Handle supervisee click from Dashboard
  const handleSuperviseeClick = (superviseeId: number, superviseeName: string, superviseeAvatar?: string) => {
    setSelectedSupervisee({
      id: superviseeId,
      name: superviseeName,
      avatar: superviseeAvatar,
    });
    setHomeSubPage('supervisee-detail');
  };

  // Handle create task for supervisee
  const handleCreateSuperviseeTask = (superviseeId: number) => {
    setEditingTaskDefinition(null);
    setHomeSubPage('task-editor');
  };

  // Handle edit task definition
  const handleEditTaskDefinition = (definition: SupervisorTaskDefinition) => {
    setEditingTaskDefinition(definition);
    setHomeSubPage('task-editor');
  };

  // Handle back from task editor
  const handleTaskEditorBack = () => {
    setHomeSubPage('supervisee-detail');
    setEditingTaskDefinition(null);
  };

  // Handle task editor success
  const handleTaskEditorSuccess = () => {
    setHomeSubPage('supervisee-detail');
    setEditingTaskDefinition(null);
    setRefreshTrigger(prev => prev + 1);
  };

  // Handle back from supervisee detail
  const handleSuperviseeDetailBack = () => {
    setHomeSubPage('none');
    setTimeout(() => {
      setSelectedSupervisee(null);
      setEditingTaskDefinition(null);
    }, 300);
  };

  // Handle campus location navigation
  const handleCampusNavigate = (location: CampusLocation) => {
    // Direct sub-pages
    const directPages: Record<string, HomeSubPage> = {
      'library': 'library',
      'teaching-building': 'teaching-building',
      'activity-center': 'activity-center',
      'campus-walk': 'campus-walk',
      'voice-chat': 'voice-chat',
      'therapy-room': 'therapy-room',
      'roulette-room': 'roulette-room',
      'liars-tavern': 'liars-tavern',
      'punishment-room': 'punishment-room',
      'art-gallery': 'art-gallery',
      'cinema': 'cinema',
      'live-stream': 'live-stream',
      'music-room': 'music-room',
      'auditorium': 'auditorium',
      'rope-art': 'rope-art',
      'alumni-chat': 'alumni-chat',
    };
    const page = directPages[location];
    if (page) setHomeSubPage(page);
  };

  const openCreator = (type: 'schedule' | 'lock', date?: Date) => {
    if (type === 'lock') {
      // Use new CreateLockWizard for lock creation
      setIsLockWizardOpen(true);
    } else {
      // Use existing CreateScheduleModal for schedule creation
      setCreatorTab(type);
      setCreatorInitialDate(date);
      setIsCreatorOpen(true);
    }
  };

  const handleCreateSuccess = () => {
    // Trigger Dashboard to refetch all data
    setRefreshTrigger(prev => prev + 1);
    console.log('Created successfully, refreshing data...');
  };

  const handleEmergencyUnlock = () => {
    if (selectedLock) {
      handleHomeBack();
      // Trigger refresh to update lock history and dashboard
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleTaskClick = (task: CampusTaskSummary) => {
    setSelectedTask(task);
    setCampusSubPage('task-detail');
  };

  const handleTaskBack = () => {
    setCampusSubPage('none');
    setTimeout(() => {
      setSelectedTask(null);
    }, 300);
  };

  // State for playground lock detail
  const [selectedPlaygroundLock, setSelectedPlaygroundLock] = useState<SelfLockSummary | null>(null);
  // View code used to access a private lock via lockcode_ deep link
  const [selectedPlaygroundLockViewCode, setSelectedPlaygroundLockViewCode] = useState<string | null>(null);

  // State for post detail
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  // State for post create modal
  const [isPostCreateModalOpen, setIsPostCreateModalOpen] = useState(false);

  const handlePlaygroundLockClick = (lock: SelfLockSummary) => {
    setSelectedPlaygroundLock(lock);
    setCampusSubPage('lock-detail');
  };

  const handlePlaygroundLockBack = () => {
    setCampusSubPage('none');
    setTimeout(() => {
      setSelectedPlaygroundLock(null);
      setSelectedPlaygroundLockViewCode(null);
    }, 300);
  };

  // Navigate from home LockDetailView to PlaygroundLockDetail for community interaction
  const handleViewInPlayground = useCallback(async (lockId: number) => {
    try {
      const summary = await selfLockApi.getLockSummary(lockId);
      setSelectedPlaygroundLock(summary);
      setCampusSubPage('lock-detail');
      setActiveTab('campus');
    } catch (e) {
      console.error('Failed to load lock for playground:', e);
    }
  }, []);

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setCampusSubPage('post-detail');
  };

  const handlePostBack = () => {
    setCampusSubPage('none');
    setTimeout(() => {
      setSelectedPostId(null);
    }, 300);
  };

  // Task Request handlers
  const [selectedTaskRequestId, setSelectedTaskRequestId] = useState<number | null>(null);

  const handleTaskRequestClick = (requestId: number) => {
    setSelectedTaskRequestId(requestId);
    setCampusSubPage('task-request-detail');
  };

  const handleTaskRequestBack = () => {
    setCampusSubPage('none');
    setTimeout(() => {
      setSelectedTaskRequestId(null);
    }, 300);
  };

  // Swipe-right from left edge to go back (mobile gesture)
  const swipeBackHandler = useCallback(() => {
    // Lightbox — highest priority
    if (isLightboxOpen && lightboxCloseRef.current) {
      lightboxCloseRef.current();
      return;
    }
    // User profile overlay
    if (viewingUserId) {
      handleUserProfileBack();
      return;
    }
    // Modals (MainLayout-controlled)
    if (isSupervisionModalOpen) { handleSupervisionModalClose(); return; }
    if (isSupervisorTaskModalOpen) { handleSupervisorTaskModalClose(); return; }
    if (isUserTaskModalOpen) { handleUserTaskModalClose(); return; }
    if (isLockWizardOpen) { setIsLockWizardOpen(false); return; }
    if (isCreatorOpen) { setIsCreatorOpen(false); return; }
    if (isCreateTaskRequestOpen) { setIsCreateTaskRequestOpen(false); return; }
    if (isCreateTaskOpen) { setIsCreateTaskOpen(false); return; }
    // Home tab sub-pages
    if (activeTab === 'home' && homeSubPage !== 'none') {
      // Nested sub-pages that go to a parent sub-page (not 'none')
      const nestedBackMap: Partial<Record<HomeSubPage, HomeSubPage>> = {
        'book-detail': 'library',
        'book-series-detail': 'library',
        'voice-chat': 'teaching-building',
        'therapy-room': 'teaching-building',
        'roulette-room': 'teaching-building',
        'punishment-room': 'teaching-building',
        'activity-center': 'teaching-building',
        'art-gallery': 'teaching-building',
        'art-gallery-detail': 'art-gallery',
        'art-gallery-upload': 'art-gallery',
        'cinema': 'teaching-building',
        'cinema-detail': 'cinema',
        'cinema-upload': 'cinema',
        'live-stream': 'teaching-building',
        'music-room': 'teaching-building',
        'auditorium': 'teaching-building',
        'music-detail': 'music-room',
        'music-playlist': 'music-room',
        'liars-tavern': 'teaching-building',
        'rope-art': 'teaching-building',
        'rope-art-manage': 'rope-art',
        'alumni-chat': 'teaching-building',
        'alumni-chat-detail': 'alumni-chat',
        'alumni-chat-wizard': 'alumni-chat',
        'alumni-chat-session': 'alumni-chat',
        'campus-walk': 'none',
        'creator-profile': creatorProfileSource === 'gallery' ? 'art-gallery' : 'cinema',
        'task-editor': 'supervisee-detail',
      };
      const target = nestedBackMap[homeSubPage];
      if (target) {
        setHomeSubPage(target);
      } else {
        handleHomeBack();
      }
      return;
    }
    // Campus tab sub-pages
    if (activeTab === 'campus' && campusSubPage !== 'none') {
      if (campusSubPage === 'task-detail') handleTaskBack();
      else if (campusSubPage === 'lock-detail') handlePlaygroundLockBack();
      else if (campusSubPage === 'post-detail') handlePostBack();
      else if (campusSubPage === 'task-request-detail') handleTaskRequestBack();
      return;
    }
    // Profile tab sub-pages
    if (activeTab === 'profile' && profileSubPage !== 'none') {
      if (profileSubPage === 'notification-settings' || profileSubPage === 'blocked-users') {
        setProfileSubPage('settings');
      } else {
        setProfileSubPage('none');
      }
      return;
    }
  }, [activeTab, homeSubPage, campusSubPage, profileSubPage, viewingUserId,
    isSupervisionModalOpen, isSupervisorTaskModalOpen, isUserTaskModalOpen,
    isLockWizardOpen, isCreatorOpen, isCreateTaskRequestOpen, isCreateTaskOpen,
    isLightboxOpen]);

  const hasSubPage = (activeTab === 'home' && homeSubPage !== 'none')
    || (activeTab === 'campus' && campusSubPage !== 'none')
    || (activeTab === 'profile' && profileSubPage !== 'none')
    || !!viewingUserId;

  const anyModalOpen = isLockWizardOpen || isCreatorOpen
    || isCreateTaskOpen || isCreateTaskRequestOpen
    || isUserTaskModalOpen || isSupervisorTaskModalOpen
    || isSupervisionModalOpen;

  const shouldShowBackButton = hasSubPage || anyModalOpen || isLightboxOpen;

  useSwipeBack({
    onBack: swipeBackHandler,
    enabled: shouldShowBackButton && !isDesktop,
  });

  // Android hardware back button support (Capacitor)
  useEffect(() => {
    if (!shouldShowBackButton) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { isCapacitorNative } = await import('../../lib/environment');
        if (!isCapacitorNative()) return;
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', () => {
          swipeBackHandler();
        });
        cleanup = () => listener.remove();
      } catch {}
    })();
    return () => { cleanup?.(); };
  }, [shouldShowBackButton, swipeBackHandler]);

  // Telegram Mini App native BackButton support
  useTelegramBackButton({
    shouldShow: shouldShowBackButton,
    onBack: swipeBackHandler,
  });

  const [scrollNavVisible, setScrollNavVisible] = useState(true);

  useEffect(() => {
    const handler = (e: Event) => {
      const { visible } = (e as CustomEvent).detail;
      setScrollNavVisible(visible);
    };
    window.addEventListener('scroll-direction', handler);
    return () => window.removeEventListener('scroll-direction', handler);
  }, []);

  const isNavVisible =
    ((activeTab === 'home' && homeSubPage === 'none' && !isLockWizardOpen) ||
    (activeTab === 'campus' && campusSubPage === 'none' && !isCreateTaskOpen && !isCreateTaskRequestOpen && !isPostCreateModalOpen) ||
    (activeTab === 'shop' && !isShopModalOpen) ||
    (activeTab === 'profile' && profileSubPage === 'none' && !isQRModalOpen)) &&
    !viewingUserId && scrollNavVisible;

  const inMusicRoom = activeTab === 'home' && (homeSubPage === 'music-room' || homeSubPage === 'music-detail' || homeSubPage === 'music-playlist');

  // Desktop: no slide transitions, use display toggling
  const mainPageClass = (isActive: boolean) =>
    isDesktop
      ? `absolute inset-0 overflow-hidden ${isActive ? 'z-10' : 'hidden'}`
      : `absolute inset-0 overflow-hidden transition-transform duration-300 ease-in-out ${isActive ? 'translate-x-0' : '-translate-x-full'}`;

  const subPageClass = (isActive: boolean) =>
    isDesktop
      ? `absolute inset-0 overflow-hidden ${isActive ? 'z-10' : 'hidden'}`
      : `absolute inset-0 overflow-hidden transition-transform duration-300 ease-in-out ${isActive ? 'translate-x-0' : 'translate-x-full'}`;

  // Therapy controller: full-screen overlay when opened from deep link
  if (therapyShareCode) {
    return <InlineTherapyController shareCode={therapyShareCode} />;
  }

  // Waveform picker: full-screen overlay when opened from inline keyboard
  if (wfShareCode) {
    return <WaveformPicker shareCode={wfShareCode} />;
  }

  return (
    <LightboxProvider value={{ register: registerLightbox, unregister: unregisterLightbox }}>
    <MusicPlayerProvider navVisible={isNavVisible} inMusicRoom={inMusicRoom}>
    <UserProfileContext.Provider value={{ viewUserProfile }}>
    <div className="bg-white dark:bg-slate-800 w-full h-full flex relative overflow-hidden transition-colors duration-300">
      {/* Desktop Sidebar — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[260px] lg:shrink-0 h-full">
        <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Dashboard / Home View */}
      <div
        className={`
          absolute inset-0 flex flex-col transition-opacity duration-300
          ${activeTab === 'home' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}
        `}
      >
        {/* Home Main */}
        <div
          className={`${mainPageClass(homeSubPage === 'none')} flex flex-col`}
        >
          <Dashboard
            onEventClick={handleEventClick}
            onLockClick={handleLockClick}
            onManagedLockClick={handleManagedLockClick}
            onTaskClick={handleUserTaskClick}
            onSupervisorTaskClick={handleSupervisorTaskClick}
            onCreateSchedule={(date) => openCreator('schedule', date)}
            onCreateLock={() => openCreator('lock')}
            onCampusNavigate={handleCampusNavigate}
            onSuperviseeClick={handleSuperviseeClick}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Event Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'event-detail')}
        >
          {selectedEvent && (
            <EventDetailView
              event={selectedEvent}
              onBack={handleHomeBack}
              onViewMemory={handleViewMemory}
            />
          )}
        </div>

        {/* Lock Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'lock-detail')}
        >
          {selectedLock && (
            <LockDetailView
              lock={selectedLock}
              onBack={handleHomeBack}
              onEmergencyUnlock={handleEmergencyUnlock}
              onLockStatusChange={() => setRefreshTrigger(prev => prev + 1)}
              isKeyholderView={isKeyholderView}
              wearerTelegramId={wearerTelegramId}
              wearerUsername={wearerUsername}
              onViewInPlayground={handleViewInPlayground}
            />
          )}
        </div>

        {/* Memory Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'memory-detail')}
        >
          {selectedMemoryId && (
            <MemoryDetailPage
              memoryId={selectedMemoryId}
              onBack={handleMemoryBack}
            />
          )}
        </div>

        {/* Auditorium Sub Page (Campus - Credits Leaderboard) */}
        <div
          className={subPageClass(homeSubPage === 'auditorium')}
        >
          {homeSubPage === 'auditorium' && (
            <AuditoriumPage onBack={handleHomeBack} />
          )}
        </div>

        {/* Library Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'library')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'library' && (
            <LibraryPage
              onBack={handleHomeBack}
              onBookClick={(bookId) => {
                setSelectedBookId(bookId);
                setHomeSubPage('book-detail');
              }}
              onSeriesClick={(seriesId) => {
                setSelectedSeriesId(seriesId);
                setHomeSubPage('book-series-detail');
              }}
              onUploadClick={() => {
                setHomeSubPage('user-upload');
              }}
            />
          )}
        </div>

        {/* Book Detail Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'book-detail')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'book-detail' && selectedBookId && (
            <BookDetailPage
              bookId={selectedBookId}
              onBack={() => {
                setHomeSubPage('library');
                setSelectedBookId(null);
              }}
              onBookClick={(bookId) => {
                setSelectedBookId(bookId);
              }}
              onSeriesClick={(seriesId) => {
                setSelectedSeriesId(seriesId);
                setHomeSubPage('book-series-detail');
              }}
            />
          )}
        </div>

        {/* Book Series Detail Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'book-series-detail')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'book-series-detail' && selectedSeriesId && (
            <BookSeriesDetailPage
              seriesId={selectedSeriesId}
              onBack={() => {
                setHomeSubPage('library');
                setSelectedSeriesId(null);
              }}
              onBookClick={(bookId) => {
                setSelectedBookId(bookId);
                setHomeSubPage('book-detail');
              }}
            />
          )}
        </div>

        {/* User Upload Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'user-upload')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'user-upload' && (
            <UserUploadPage
              onBack={() => setHomeSubPage('library')}
              onSuccess={() => setHomeSubPage('library')}
            />
          )}
        </div>

        {/* Teaching Building Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'teaching-building')}
        >
          {homeSubPage === 'teaching-building' && (
            <TeachingBuildingPage
              onBack={handleHomeBack}
              onNavigateToRoom={(room) => {
                setHomeSubPage(room as HomeSubPage);
              }}
            />
          )}
        </div>

        {/* Rope Art Studio Sub Page */}
        <div className={subPageClass(homeSubPage === 'rope-art')}>
          {homeSubPage === 'rope-art' && (
            <RopeArtStudioPage
              onBack={() => setHomeSubPage('teaching-building')}
              onManage={() => setHomeSubPage('rope-art-manage')}
            />
          )}
        </div>

        {/* Rope Art Manage Sub Page */}
        <div className={subPageClass(homeSubPage === 'rope-art-manage')}>
          {homeSubPage === 'rope-art-manage' && (
            <RopeArtistManagePage
              onBack={() => setHomeSubPage('rope-art')}
            />
          )}
        </div>

        {/* Alumni Chat Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'alumni-chat')}
        >
          {homeSubPage === 'alumni-chat' && (
            <AlumniChatPage
              onBack={() => setHomeSubPage('teaching-building')}
              onCreateCard={() => {
                setAlumniChatEditCardId(null);
                setHomeSubPage('alumni-chat-wizard');
              }}
              onEditCard={(cardId: number) => {
                setAlumniChatEditCardId(cardId);
                setHomeSubPage('alumni-chat-wizard');
              }}
              onCardDetail={(cardId: number) => {
                setAlumniChatCardId(cardId);
                setHomeSubPage('alumni-chat-detail');
              }}
              onChat={(conversationId: number) => {
                setAlumniChatConversationId(conversationId);
                setHomeSubPage('alumni-chat-session');
              }}
              onStartChat={(cardId: number) => {
                setAlumniChatCardId(cardId);
                setHomeSubPage('alumni-chat-detail');
              }}
            />
          )}
        </div>

        {/* Alumni Chat Card Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'alumni-chat-detail')}
        >
          {homeSubPage === 'alumni-chat-detail' && alumniChatCardId && (
            <CharacterCardDetail
              cardId={alumniChatCardId}
              onBack={() => setHomeSubPage('alumni-chat')}
              onStartChat={(conversationId: number) => {
                setAlumniChatConversationId(conversationId);
                setHomeSubPage('alumni-chat-session');
              }}
            />
          )}
        </div>

        {/* Alumni Chat Wizard Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'alumni-chat-wizard')}
        >
          {homeSubPage === 'alumni-chat-wizard' && (
            <CharacterCardWizard
              cardId={alumniChatEditCardId}
              onBack={() => {
                setAlumniChatEditCardId(null);
                setHomeSubPage('alumni-chat');
              }}
              onComplete={() => {
                setAlumniChatEditCardId(null);
                setHomeSubPage('alumni-chat');
              }}
            />
          )}
        </div>

        {/* Alumni Chat Session Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'alumni-chat-session')}
        >
          {homeSubPage === 'alumni-chat-session' && alumniChatConversationId && (
            <ChatPage
              conversationId={alumniChatConversationId}
              onBack={() => {
                setAlumniChatConversationId(null);
                setHomeSubPage('alumni-chat');
              }}
            />
          )}
        </div>

        {/* Liar's Tavern Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'liars-tavern')}
        >
          {homeSubPage === 'liars-tavern' && (
            <GameLobbyPage
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Voice Chat Room Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'voice-chat')}
        >
          {homeSubPage === 'voice-chat' && (
            <VoiceChatRoom
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Therapy Room Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'therapy-room')}
        >
          {homeSubPage === 'therapy-room' && (
            <TherapyRoom
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Roulette Room Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'roulette-room')}
        >
          {homeSubPage === 'roulette-room' && (
            <RouletteRoomPage
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Punishment Room Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'punishment-room')}
        >
          {homeSubPage === 'punishment-room' && (
            <PunishmentRoomPage
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Art Gallery Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'art-gallery')} bg-slate-50 dark:bg-slate-900`}
        >
          {(homeSubPage === 'art-gallery' || homeSubPage === 'art-gallery-detail' || homeSubPage === 'art-gallery-upload') && (
            <ArtGalleryPage
              onBack={() => setHomeSubPage('teaching-building')}
              onItemClick={(id) => {
                setSelectedGalleryId(id);
                setHomeSubPage('art-gallery-detail');
              }}
              onUploadClick={() => setHomeSubPage('art-gallery-upload')}
              onAuthorClick={(authorId) => {
                setCreatorProfileAuthorId(authorId);
                setCreatorProfileSource('gallery');
                setHomeSubPage('creator-profile');
              }}
            />
          )}
        </div>

        {/* Art Gallery Detail Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'art-gallery-detail')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'art-gallery-detail' && selectedGalleryId && (
            <ArtGalleryDetailPage
              itemId={selectedGalleryId}
              onBack={() => {
                setHomeSubPage('art-gallery');
                setSelectedGalleryId(null);
              }}
            />
          )}
        </div>

        {/* Art Gallery Upload Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'art-gallery-upload')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'art-gallery-upload' && (
            <ArtGalleryUploadPage
              onBack={() => setHomeSubPage('art-gallery')}
              onSuccess={() => setHomeSubPage('art-gallery')}
            />
          )}
        </div>

        {/* Cinema Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'cinema')} bg-slate-50 dark:bg-slate-900`}
        >
          {(homeSubPage === 'cinema' || homeSubPage === 'cinema-detail' || homeSubPage === 'cinema-upload') && (
            <CinemaPage
              onBack={() => setHomeSubPage('teaching-building')}
              onVideoClick={(id) => {
                setSelectedCinemaId(id);
                setHomeSubPage('cinema-detail');
              }}
              onUploadClick={() => setHomeSubPage('cinema-upload')}
              onAuthorClick={(authorId) => {
                setCreatorProfileAuthorId(authorId);
                setCreatorProfileSource('cinema');
                setHomeSubPage('creator-profile');
              }}
            />
          )}
        </div>

        {/* Cinema Detail Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'cinema-detail')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'cinema-detail' && selectedCinemaId && (
            <CinemaDetailPage
              videoId={selectedCinemaId}
              onBack={() => {
                setHomeSubPage('cinema');
                setSelectedCinemaId(null);
              }}
            />
          )}
        </div>

        {/* Cinema Upload Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'cinema-upload')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'cinema-upload' && (
            <CinemaUploadPage
              onBack={() => setHomeSubPage('cinema')}
              onSuccess={() => setHomeSubPage('cinema')}
            />
          )}
        </div>

        {/* Creator Profile Sub Page */}
        <div
          className={`${subPageClass(homeSubPage === 'creator-profile')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'creator-profile' && creatorProfileAuthorId && (
            <CreatorProfilePage
              authorId={creatorProfileAuthorId}
              source={creatorProfileSource}
              onBack={() => {
                setHomeSubPage(creatorProfileSource === 'gallery' ? 'art-gallery' : 'cinema');
                setCreatorProfileAuthorId(null);
              }}
              onGalleryItemClick={(id) => {
                setSelectedGalleryId(id);
                setHomeSubPage('art-gallery-detail');
              }}
              onVideoClick={(id) => {
                setSelectedCinemaId(id);
                setHomeSubPage('cinema-detail');
              }}
            />
          )}
        </div>

        {/* Live Stream Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'live-stream')}
        >
          {homeSubPage === 'live-stream' && (
            <LiveStreamRoom
              onBack={() => setHomeSubPage('teaching-building')}
            />
          )}
        </div>

        {/* Music Room Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'music-room')}
        >
          {(homeSubPage === 'music-room' || homeSubPage === 'music-detail' || homeSubPage === 'music-playlist') && (
            <MusicRoomPage
              onBack={() => setHomeSubPage('teaching-building')}
              onWorkClick={(id: number) => {
                setSelectedAsmrWorkId(id);
                setMusicSearchKeyword(undefined);
                setMusicBrowseTarget(undefined);
                setHomeSubPage('music-detail');
              }}
              onPlaylistClick={(pl) => {
                setSelectedPlaylist(pl);
                setMusicSearchKeyword(undefined);
                setMusicBrowseTarget(undefined);
                setHomeSubPage('music-playlist');
              }}
              initialSearch={musicSearchKeyword}
              initialBrowse={musicBrowseTarget}
            />
          )}
        </div>

        {/* Music Work Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'music-detail')}
        >
          {homeSubPage === 'music-detail' && selectedAsmrWorkId && (
            <MusicWorkDetailPage
              workId={selectedAsmrWorkId}
              onBack={() => setHomeSubPage('music-room')}
              onTagClick={(tagName) => {
                setMusicSearchKeyword(tagName);
                setMusicBrowseTarget(undefined);
                setHomeSubPage('music-room');
              }}
              onCircleClick={(circleId, circleName) => {
                setMusicBrowseTarget({ type: 'circle', id: circleId, name: circleName });
                setMusicSearchKeyword(undefined);
                setHomeSubPage('music-room');
              }}
              onVAClick={(vaId, vaName) => {
                setMusicBrowseTarget({ type: 'va', id: vaId, name: vaName });
                setMusicSearchKeyword(undefined);
                setHomeSubPage('music-room');
              }}
            />
          )}
        </div>

        {/* Music Playlist Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'music-playlist')}
        >
          {homeSubPage === 'music-playlist' && selectedPlaylist && (
            <MusicPlaylistPage
              playlist={selectedPlaylist}
              onBack={() => setHomeSubPage('music-room')}
              onWorkClick={(id: number) => {
                setSelectedAsmrWorkId(id);
                setHomeSubPage('music-detail');
              }}
              onDeleted={() => setHomeSubPage('music-room')}
            />
          )}
        </div>

        {/* Activity Center Sub Page (Coming Soon) */}
        <div
          className={`${subPageClass(homeSubPage === 'activity-center')} bg-slate-50 dark:bg-slate-900`}
        >
          {homeSubPage === 'activity-center' && (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">活动中心</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center">敬请期待...</p>
              <button
                onClick={handleHomeBack}
                className="mt-6 px-6 py-2 bg-rose-500 text-white rounded-xl"
              >
                返回
              </button>
            </div>
          )}
        </div>

        {/* Campus Walk Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'campus-walk')}
        >
          {homeSubPage === 'campus-walk' && (
            <CampusWalkPage
              onBack={handleHomeBack}
            />
          )}
        </div>

        {/* Supervisee Detail Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'supervisee-detail')}
        >
          {selectedSupervisee && homeSubPage === 'supervisee-detail' && (
            <SuperviseeDetailPage
              superviseeId={selectedSupervisee.id}
              superviseeName={selectedSupervisee.name}
              superviseeAvatar={selectedSupervisee.avatar}
              onBack={handleSuperviseeDetailBack}
              onCreateTask={handleCreateSuperviseeTask}
              onEditTaskDefinition={handleEditTaskDefinition}
            />
          )}
        </div>

        {/* Supervisor Task Editor Sub Page */}
        <div
          className={subPageClass(homeSubPage === 'task-editor')}
        >
          {selectedSupervisee && homeSubPage === 'task-editor' && (
            <SupervisorTaskEditorPage
              superviseeId={selectedSupervisee.id}
              superviseeName={selectedSupervisee.name}
              existingDefinition={editingTaskDefinition}
              onBack={handleTaskEditorBack}
              onSuccess={handleTaskEditorSuccess}
            />
          )}
        </div>
      </div>

      {/* Campus Tasks View */}
      <div
        className={`
          absolute inset-0 transition-opacity duration-300
          ${activeTab === 'campus' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}
        `}
      >
        {/* Campus Tasks Main */}
        <div
          className={mainPageClass(campusSubPage === 'none')}
        >
          <CampusTasks
            onLockClick={handlePlaygroundLockClick}
            onPostClick={handlePostClick}
            onPostCreateModalChange={setIsPostCreateModalOpen}
            onTaskRequestClick={handleTaskRequestClick}
            onCreateTaskRequest={() => setIsCreateTaskRequestOpen(true)}
          />
        </div>

        {/* Task Detail Sub Page */}
        <div
          className={subPageClass(campusSubPage === 'task-detail')}
        >
          {selectedTask && (
            <TaskDetailPage task={selectedTask} onBack={handleTaskBack} />
          )}
        </div>

        {/* Playground Lock Detail Sub Page */}
        <div
          className={subPageClass(campusSubPage === 'lock-detail')}
        >
          {selectedPlaygroundLock && (
            <PlaygroundLockDetail
              lock={selectedPlaygroundLock}
              onBack={handlePlaygroundLockBack}
              viewCode={selectedPlaygroundLockViewCode ?? undefined}
            />
          )}
        </div>

        {/* Post Detail Sub Page */}
        <div
          className={subPageClass(campusSubPage === 'post-detail')}
        >
          {selectedPostId && (
            <PostDetailPage
              postId={selectedPostId}
              onBack={handlePostBack}
              onUserClick={viewUserProfile}
            />
          )}
        </div>

        {/* Task Request Detail Sub Page */}
        <div
          className={subPageClass(campusSubPage === 'task-request-detail')}
        >
          {selectedTaskRequestId && (
            <TaskRequestDetailPage
              requestId={selectedTaskRequestId}
              onBack={handleTaskRequestBack}
            />
          )}
        </div>
      </div>

      {/* Shop View */}
      <div
        className={`
          absolute inset-0 transition-opacity duration-300
          ${activeTab === 'shop' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}
        `}
      >
        <ShopPage onItemModalChange={setIsShopModalOpen} />
      </div>

      {/* Profile View */}
      <div
        className={`
          absolute inset-0 transition-opacity duration-300
          ${activeTab === 'profile' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}
        `}
      >
        {/* Profile Main */}
        <div
          className={mainPageClass(profileSubPage === 'none')}
        >
          <ProfilePage
            onNavigateToAcademic={() => setProfileSubPage('academic')}
            onNavigateToDisciplinary={() => setProfileSubPage('disciplinary')}
            onNavigateToLockHistory={() => setProfileSubPage('lock-history')}
            onNavigateToMemory={() => setProfileSubPage('memory')}
            onNavigateToSettings={() => setProfileSubPage('settings')}
            onNavigateToHelpSupport={() => setProfileSubPage('help-support')}
            onNavigateToNotifications={() => setProfileSubPage('notifications')}
            onNavigateToFollowing={() => setProfileSubPage('following')}
            onNavigateToFollowers={() => setProfileSubPage('followers')}
            onNavigateToCreatorMode={() => setProfileSubPage('creator-mode')}
            onNavigateToFoundation={() => setProfileSubPage('foundation')}
            onNavigateToFriendLinks={() => setProfileSubPage('friend-links')}
            onNavigateToBoard={() => setProfileSubPage('board-editor')}
            onQRModalChange={setIsQRModalOpen}
          />
        </div>

        {/* Academic Portal Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'academic')}
        >
          {profileSubPage === 'academic' && (
            <AcademicPortalPage onBack={() => setProfileSubPage('none')} onNavigateToMajor={() => setProfileSubPage('major')} />
          )}
        </div>

        {/* Major Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'major')}
        >
          {profileSubPage === 'major' && (
            <MajorPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* Disciplinary Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'disciplinary')}
        >
          {profileSubPage === 'disciplinary' && (
            <DisciplinaryPage
              onBack={() => setProfileSubPage('none')}
              onRefreshTasks={() => setRefreshTrigger(prev => prev + 1)}
            />
          )}
        </div>

        {/* Lock History Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'lock-history')}
        >
          {profileSubPage === 'lock-history' && (
            <LockHistoryPage onBack={() => setProfileSubPage('none')} refreshTrigger={refreshTrigger} />
          )}
        </div>

        {/* Memory Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'memory')}
        >
          {profileSubPage === 'memory' && (
            <MemoryListPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* General Settings Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'settings')}
        >
          {profileSubPage === 'settings' && (
            <GeneralSettingsPage
              onBack={() => setProfileSubPage('none')}
              onNavigateToNotificationSettings={() => setProfileSubPage('notification-settings')}
              onNavigateToBlockedUsers={() => setProfileSubPage('blocked-users')}
            />
          )}
        </div>

        {/* Notification Settings Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'notification-settings')}
        >
          {profileSubPage === 'notification-settings' && (
            <NotificationSettingsPage onBack={() => setProfileSubPage('settings')} />
          )}
        </div>

        {/* Blocked Users Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'blocked-users')}
        >
          {profileSubPage === 'blocked-users' && (
            <BlockedUsersPage onBack={() => setProfileSubPage('settings')} />
          )}
        </div>

        {/* Help & Support Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'help-support')}
        >
          {profileSubPage === 'help-support' && (
            <HelpSupportPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* Notifications Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'notifications')}
        >
          {profileSubPage === 'notifications' && (
            <NotificationsPage
              onBack={() => setProfileSubPage('none')}
              onNavigateToSettings={() => setProfileSubPage('settings')}
              onNavigateToLink={handleNotificationLinkClick}
            />
          )}
        </div>

        {/* Following Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'following')}
        >
          {profileSubPage === 'following' && (
            <FollowListPage
              onBack={() => setProfileSubPage('none')}
              initialTab="following"
            />
          )}
        </div>

        {/* Followers Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'followers')}
        >
          {profileSubPage === 'followers' && (
            <FollowListPage
              onBack={() => setProfileSubPage('none')}
              initialTab="followers"
            />
          )}
        </div>

        {/* Creator Mode Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'creator-mode')}
        >
          {profileSubPage === 'creator-mode' && (
            <CreatorModePage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* Foundation Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'foundation')}
        >
          {profileSubPage === 'foundation' && (
            <FoundationPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* Friend Links Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'friend-links')}
        >
          {profileSubPage === 'friend-links' && (
            <FriendLinksPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>

        {/* Board Editor Sub Page */}
        <div
          className={subPageClass(profileSubPage === 'board-editor')}
        >
          {profileSubPage === 'board-editor' && (
            <BoardEditorPage onBack={() => setProfileSubPage('none')} />
          )}
        </div>
      </div>

      {/* Creator Modal */}
      <CreateScheduleModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        initialTab={creatorTab}
        initialDate={creatorInitialDate}
        onSuccess={handleCreateSuccess}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSuccess={() => {
          // Could refresh the tasks list here if needed
        }}
      />

      {/* Create Task Request Modal */}
      <CreateTaskRequestModal
        isOpen={isCreateTaskRequestOpen}
        onClose={() => setIsCreateTaskRequestOpen(false)}
        onSuccess={(requestId) => {
          handleTaskRequestClick(requestId);
        }}
      />

      {/* Create Lock Wizard (V2) */}
      <CreateLockWizard
        isOpen={isLockWizardOpen}
        onClose={() => setIsLockWizardOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Global User Profile Overlay */}
      {viewingUserId && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-800 lg:bg-black/50 lg:flex lg:items-center lg:justify-center">
          <div className="h-full w-full lg:h-[90vh] lg:w-full lg:max-w-[800px] lg:rounded-2xl lg:overflow-hidden bg-white dark:bg-slate-800">
            <UserProfilePage
              userId={viewingUserId}
              onBack={handleUserProfileBack}
              onLockClick={(lock) => {
                handleUserProfileBack();
                setActiveTab('campus');
                handlePlaygroundLockClick(lock);
              }}
              onPostClick={(postId) => {
                handleUserProfileBack();
                setActiveTab('campus');
                handlePostClick(postId);
              }}
              onGalleryItemClick={(id) => {
                handleUserProfileBack();
                setActiveTab('home');
                setSelectedGalleryId(id);
                setHomeSubPage('art-gallery-detail');
              }}
              onCinemaVideoClick={(id) => {
                handleUserProfileBack();
                setActiveTab('home');
                setSelectedCinemaId(id);
                setHomeSubPage('cinema-detail');
              }}
              onBookClick={(id) => {
                handleUserProfileBack();
                setActiveTab('home');
                setSelectedBookId(id);
                setHomeSubPage('book-detail');
              }}
            />
          </div>
        </div>
      )}

      {/* User Task Detail Modal */}
      {selectedUserTask && (
        <UserTaskDetailModal
          isOpen={isUserTaskModalOpen}
          onClose={handleUserTaskModalClose}
          task={selectedUserTask}
          onStart={handleUserTaskStart}
          onComplete={handleUserTaskComplete}
          onUpdateProgress={handleUserTaskUpdateProgress}
          onAbandon={handleUserTaskAbandon}
          onRefresh={handleUserTaskRefresh}
        />
      )}

      {/* Supervisor Task Detail Modal */}
      {selectedSupervisorTask && (
        <SupervisorTaskDetailModal
          isOpen={isSupervisorTaskModalOpen}
          onClose={handleSupervisorTaskModalClose}
          task={selectedSupervisorTask}
          onStart={handleSupervisorTaskStart}
          onComplete={handleSupervisorTaskComplete}
          onIncrement={handleSupervisorTaskIncrement}
          onSubmitProof={handleSupervisorTaskSubmitProof}
        />
      )}

      {/* Supervision Request Modal */}
      <SupervisionRequestModal
        isOpen={isSupervisionModalOpen}
        onClose={handleSupervisionModalClose}
        requests={pendingSupervisionRequests}
        onSuccess={handleSupervisionSuccess}
      />

      {/* Bottom Navigation — hidden on desktop */}
      <div className="lg:hidden">
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          visible={isNavVisible}
        />
      </div>
      </div>
    </div>
    </UserProfileContext.Provider>
    </MusicPlayerProvider>
    </LightboxProvider>
  );
};
