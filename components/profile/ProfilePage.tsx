import React, { useState, useEffect, useRef } from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import {
  ChevronRight,
  Clock,
  Flame,
  Target,
  Share2,
  Shield,
  HelpCircle,
  Bell,
  QrCode,
  Wifi,
  BookOpen,
  GraduationCap,
  CalendarDays,
  AlertTriangle,
  Gavel,
  Lock,
  History,
  X,
  Plus,
  Check,
  User as UserIcon,
  Tag,
  Heart,
  Wand2,
  LayoutGrid,
  Link2,
} from 'lucide-react';
import { CometCard } from '@/components/ui/comet-card';
import { StudentQRModal } from '@/components/ui/StudentQRModal';
import { ShareCardModal } from '@/components/ui/ShareCardModal';
import { useAuth, useUserDisplayName, useUserAvatar } from '@/lib/auth-context';
import { coursesApi, punishmentsApi, userStatsApi, userProfileApi, followApi, itemsApi, userTasksApi } from '@/lib/api';
import { UserStatsDisplay, FollowStats } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { useUserSettings } from '@/hooks/useUser';
import { getCardFaceTheme } from '@/lib/cardFaceThemes';

interface ProfilePageProps {
  onNavigateToAcademic?: () => void;
  onNavigateToDisciplinary?: () => void;
  onNavigateToLockHistory?: () => void;
  onNavigateToMemory?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToHelpSupport?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToFollowing?: () => void;
  onNavigateToFollowers?: () => void;
  onNavigateToCreatorMode?: () => void;
  onNavigateToFoundation?: () => void;
  onNavigateToFriendLinks?: () => void;
  onNavigateToBoard?: () => void;
  onQRModalChange?: (isOpen: boolean) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigateToAcademic,
  onNavigateToDisciplinary,
  onNavigateToLockHistory,
  onNavigateToMemory,
  onNavigateToSettings,
  onNavigateToHelpSupport,
  onNavigateToNotifications,
  onNavigateToFollowing,
  onNavigateToFollowers,
  onNavigateToCreatorMode,
  onNavigateToFoundation,
  onNavigateToFriendLinks,
  onNavigateToBoard,
  onQRModalChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDirection(scrollRef);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [myCourseCount, setMyCourseCount] = useState(0);
  const [todayClassCount, setTodayClassCount] = useState(0);
  const [hasPendingTasks, setHasPendingTasks] = useState(false);
  const [userStats, setUserStats] = useState<UserStatsDisplay | null>(null);
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);

  // Bio and tags state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleQRModalOpen = () => {
    setIsQRModalOpen(true);
    onQRModalChange?.(true);
  };

  const handleQRModalClose = () => {
    setIsQRModalOpen(false);
    onQRModalChange?.(false);
  };
  const { user: authUser, refreshUser, hasPermission } = useAuth();
  const userSettingsQuery = useUserSettings();
  const dayStartOffsetHours = userSettingsQuery.data?.dayStartOffsetHours ?? 0;

  // Pending punishment count via React Query (so it refreshes after claiming in PunishmentRoom)
  const { data: pendingPunishmentCount = 0 } = useQuery({
    queryKey: queryKeys.behavior.penalties(),
    queryFn: async () => {
      const punishments = await punishmentsApi.getPending();
      return punishments.length;
    },
    enabled: !!authUser,
  });

  // Equipped card face
  const { data: equippedItems } = useQuery({
    queryKey: ['items', 'equipped'],
    queryFn: () => itemsApi.getEquippedItems(),
    enabled: !!authUser,
  });
  const cardFaceItem = equippedItems?.find(ui => ui.item.itemCategory === 'CARD_FACE');
  const cardFaceTheme = getCardFaceTheme(
    cardFaceItem ? (cardFaceItem.item.name === 'Alpha校园卡' ? 'alpha' : 'default') : undefined
  );
  const isCustomCardFace = cardFaceTheme.key !== 'default';

  // Initialize edit values when authUser changes
  useEffect(() => {
    if (authUser) {
      setEditBio(authUser.bio || '');
      setEditTags(authUser.tags || []);
    }
  }, [authUser]);

  const handleStartEditProfile = () => {
    setEditBio(authUser?.bio || '');
    setEditTags(authUser?.tags || []);
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setNewTag('');
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await userProfileApi.updateProfile({
        bio: editBio,
        tags: editTags,
      });
      await refreshUser();
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !editTags.includes(trimmedTag) && editTags.length < 10) {
      setEditTags([...editTags, trimmedTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };
  const displayName = useUserDisplayName();
  const avatarUrl = useUserAvatar();

  // Fetch course and user stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [progress, stats, follow, todayTasks] = await Promise.all([
          coursesApi.getMyProgress(),
          userStatsApi.getStats(),
          followApi.getMyStats(),
          userTasksApi.getTodayOverview()
        ]);

        // Course stats
        const activeCourses = progress.filter(p => p.status === 'ACTIVE');
        setMyCourseCount(activeCourses.length);

        // Count today's classes (apply dayStartOffsetHours)
        const effectiveNow = new Date(Date.now() - dayStartOffsetHours * 60 * 60 * 1000);
        const today = effectiveNow.getDay() || 7; // Convert Sunday from 0 to 7
        const todayClasses = activeCourses.filter(p =>
          p.course.schedules.includes(today)
        );
        setTodayClassCount(todayClasses.length);

        // Check if there are pending/in-progress tasks today
        setHasPendingTasks((todayTasks.pendingTasks + todayTasks.inProgressTasks) > 0);

        // User stats
        setUserStats(stats);
        setStatsFetchedAt(Date.now());

        // Follow stats
        setFollowStats(follow);
      } catch (error) {
        console.error('Failed to fetch profile stats:', error);
      }
    };

    if (authUser) {
      fetchStats();
    }
  }, [authUser, dayStartOffsetHours]);

  // Student ID is just the user's auto-increment id (smaller = earlier registration)
  const studentId = authUser ? String(authUser.id).padStart(6, '0') : '------';

  // Card expiry is registration date (MM/YY format)
  const cardExpiry = authUser
    ? (() => {
        const date = new Date(authUser.createdAt);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${month}/${year}`;
      })()
    : '--/--';

  // Use real user data with fallbacks
  // credits = XP (学分), 10 XP = 1 Level
  const totalXP = authUser?.credits || 0;
  const level = Math.floor(totalXP / 10);
  const xpInCurrentLevel = totalXP % 10;

  const user = {
    name: displayName,
    id: studentId,
    cardExpiry,
    major: 'Student', // This could come from extended user profile later
    level: level,
    xp: xpInCurrentLevel, // XP within current level (0-9)
    totalXP: totalXP, // Total XP (credits)
    nextLevelXp: 10, // Need 10 XP per level
    campusPoints: authUser?.campusPoints || 0,
    avatar: avatarUrl,
    isPremium: authUser?.isPremium || false,
  };

  // Real-time focus time: tick every minute while an active lock exists
  const [focusTimeTick, setFocusTimeTick] = useState(0);
  const [statsFetchedAt, setStatsFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!userStats?.activeLockStartedAt) return;
    const interval = setInterval(() => setFocusTimeTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [userStats?.activeLockStartedAt]);

  // Format focus hours for display
  const formatFocusHours = (hours: number) => {
    if (hours >= 1) {
      return `${hours.toFixed(1)}h`;
    }
    return `${Math.round(hours * 60)}m`;
  };

  const getLiveFocusHours = () => {
    if (!userStats) return 0;
    if (!userStats.activeLockStartedAt || !statsFetchedAt) return userStats.focusHours;
    const extraHours = (Date.now() - statsFetchedAt) / 3_600_000;
    return userStats.focusHours + extraHours;
  };

  const stats = [
    {
      label: '专注时长',
      value: userStats ? formatFocusHours(getLiveFocusHours()) : '0h',
      icon: Clock,
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      label: '连续打卡',
      value: userStats ? `${userStats.streakDays} 天` : '0 天',
      icon: Flame,
      color: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950'
    },
    {
      label: '完成任务',
      value: userStats ? String(userStats.tasksCompleted) : '0',
      icon: Target,
      color: 'text-green-500 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950'
    },
  ];

  const menuItems = [
    { icon: Bell, label: '通知', badge: undefined as string | undefined, onClick: onNavigateToNotifications },
    { icon: Shield, label: '隐私与安全', onClick: onNavigateToSettings },
    { icon: HelpCircle, label: '帮助与支持', onClick: onNavigateToHelpSupport },
    { icon: Link2, label: '友情链接', onClick: onNavigateToFriendLinks },
    { icon: Heart, label: 'LoveIn 基金会', onClick: onNavigateToFoundation },
  ];

  return (
    <div ref={scrollRef} className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-y-auto no-scrollbar">
      <div className="p-6 pb-32 lg:pb-8 lg:max-w-[1200px] lg:mx-auto lg:w-full lg:grid lg:grid-cols-3 lg:gap-4">
        {/* --- Header --- */}
        <div className="mb-6 lg:col-span-3 lg:mb-2">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">我的主页</h1>
            <button
              onClick={() => setIsShareCardOpen(true)}
              className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-primary shadow-sm transition-colors"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* --- STUDENT ID CARD --- */}
        <div className="mb-4 lg:col-span-2 lg:mb-0">
          {!authUser ? (
            /* Skeleton loading state for student ID card */
            <div className="w-full aspect-86/54 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-3xl" />
          ) : (
            <CometCard
              rotateDepth={12}
              translateDepth={15}
              className="w-full"
            >
            <div className={`@container w-full aspect-86/54 rounded-3xl relative overflow-hidden shadow-2xl group ${isCustomCardFace ? cardFaceTheme.cardClassName : ''}`}>
              {/* Card Background (Gradient & Noise) */}
              {!isCustomCardFace && (
                <>
                  <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 z-0"></div>
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay"></div>
                </>
              )}

              {/* Watermark */}
              {cardFaceTheme.watermark && (
                <div className="absolute top-[2cqi] right-[3cqi] text-[20cqi] font-black text-white/10 leading-none select-none pointer-events-none z-2">
                  {cardFaceTheme.watermark}
                </div>
              )}

              {/* Decorative Circles */}
              <div className={`absolute -top-[8cqi] -right-[8cqi] w-[40cqi] h-[40cqi] blur-3xl opacity-30 rounded-full ${cardFaceTheme.decorCircle1 || 'bg-primary'}`}></div>
              <div className={`absolute -bottom-[8cqi] -left-[8cqi] w-[40cqi] h-[40cqi] blur-3xl opacity-30 rounded-full ${cardFaceTheme.decorCircle2 || 'bg-secondary'}`}></div>

              {/* Card Content — all sizes in cqi for proportional scaling (×1.5) */}
              <div className="relative z-10 p-[6.75cqi] flex flex-col h-full text-white">
                {/* Top Row: Logo & Chip */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-[2.25cqi] opacity-80">
                    <div className="w-[6cqi] h-[6cqi] rounded-full border-[0.6cqi] border-white/30 flex items-center justify-center">
                      <div className="w-[1.8cqi] h-[1.8cqi] bg-white dark:bg-slate-800 rounded-full"></div>
                    </div>
                    <span className="text-[3.75cqi] font-bold tracking-widest uppercase">Campus ID</span>
                  </div>
                  <Wifi className="w-[6cqi] h-[6cqi] opacity-50 rotate-90" />
                </div>

                {/* Main Row: Photo & Details — flex-1 to absorb space */}
                <div className="flex-1 flex items-center gap-[4.5cqi]">
                  <div className="w-[21cqi] h-[21cqi] rounded-xl overflow-hidden border-[0.75cqi] border-white/20 shadow-lg shrink-0">
                    <img src={user.avatar} className="w-full h-full object-cover" alt="ID" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-[6.75cqi] font-bold leading-tight truncate">{user.name}</h2>
                    <div className="flex items-center gap-[3.75cqi] mt-[1.2cqi]">
                      <div>
                        <p className="text-[3.3cqi] text-white/50 uppercase tracking-wide">ID</p>
                        <p className="font-mono text-[4.5cqi] tracking-wider opacity-90">{user.id}</p>
                      </div>
                      <div>
                        <p className="text-[3.3cqi] text-white/50 uppercase tracking-wide">Since</p>
                        <p className="text-[4.5cqi] font-bold opacity-90">{user.cardExpiry}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleQRModalOpen();
                    }}
                    className="bg-white dark:bg-slate-800 p-[2.25cqi] rounded-lg hover:bg-white/90 dark:bg-slate-800/90 transition-colors cursor-pointer shrink-0"
                  >
                    <QrCode className="w-[7.5cqi] h-[7.5cqi] text-black dark:text-white" />
                  </button>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10 dark:bg-slate-800/10 mb-[2.25cqi]"></div>

                {/* Level & XP Section — anchored to bottom */}
                <div className="space-y-[1.8cqi]">
                  {/* Level Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-[2.25cqi]">
                      <span className="text-[7.5cqi] font-black">LV.{user.level}</span>
                      <span className="text-[3.75cqi] text-white/50 font-medium">{user.major}</span>
                    </div>
                    <span className="text-[3.75cqi] font-bold text-white/70">
                      {user.xp} / {user.nextLevelXp} XP
                    </span>
                  </div>

                  {/* XP Progress Bar */}
                  <div className="w-full h-[2.25cqi] bg-white/10 dark:bg-slate-800/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                      style={{ width: `${(user.xp / user.nextLevelXp) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Shine Effect Overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>
            </div>
            </CometCard>
          )}
        </div>

        {/* --- BIO & TAGS SECTION --- */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700 lg:col-span-1 lg:row-span-2 lg:mb-0 lg:h-full">
          {/* Follow Stats - Compact inline */}
          {followStats ? (
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <button
                onClick={onNavigateToFollowing}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity active:scale-[0.98]"
              >
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{followStats.followingCount}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">关注</span>
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <button
                onClick={onNavigateToFollowers}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity active:scale-[0.98]"
              >
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{followStats.followersCount}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">粉丝</span>
              </button>
            </div>
          ) : (
            /* Skeleton loading state for follow stats */
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                <div className="h-3 w-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                <div className="h-3 w-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <UserIcon size={18} className="text-primary" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">个人简介</h3>
            </div>
            {!isEditingProfile ? (
              <button
                onClick={handleStartEditProfile}
                className="text-xs text-primary font-medium hover:underline"
              >
                编辑
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEditProfile}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="p-1.5 text-green-500 dark:text-green-400 hover:text-green-600 dark:text-green-400 rounded-full hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Bio */}
          {isEditingProfile ? (
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="写点什么介绍自己吧..."
              maxLength={500}
              className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-200 resize-none border border-slate-200 dark:border-slate-700 focus:border-primary focus:outline-none"
            />
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {authUser?.bio || <span className="text-slate-400 dark:text-slate-500 italic">还没有填写个人简介</span>}
            </p>
          )}

          {/* Tags */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-secondary" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">自我标签</span>
              {isEditingProfile && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">({editTags.length}/10)</span>
              )}
            </div>

            {isEditingProfile ? (
              <>
                {/* Add Tag Input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="添加标签..."
                    maxLength={20}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm border border-slate-200 dark:border-slate-700 focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!newTag.trim() || editTags.length >= 10}
                    className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {/* Editable Tags */}
                <div className="flex flex-wrap gap-2">
                  {editTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {editTags.length === 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">点击上方添加标签</span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(authUser?.tags && authUser.tags.length > 0) ? (
                  authUser.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-secondary/10 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">还没有添加标签</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 lg:col-span-2 lg:mb-0">
          {!userStats ? (
            // Skeleton loading state for stats cards
            [0, 1, 2].map(i => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 flex flex-col items-center text-center gap-2"
              >
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
                <div>
                  <div className="h-4 w-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full mx-auto mb-1" />
                  <div className="h-2.5 w-12 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full mx-auto" />
                </div>
              </div>
            ))
          ) : (
            stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 flex flex-col items-center text-center gap-2"
              >
                <div className={`w-8 h-8 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <stat.icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{stat.label}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* --- ACADEMIC CENTER CARD (Entry Point) --- */}
        <div
          onClick={onNavigateToAcademic}
          className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-4 border border-slate-50 dark:border-slate-700 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-2 lg:mb-0"
        >
          {/* Background Decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-100 to-transparent opacity-50"></div>
          <GraduationCap className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100 -rotate-12" />

          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                学术中心
                {hasPendingTasks && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">管理课程和日程安排</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:bg-primary transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>

          {/* Quick Status */}
          <div className="relative z-10 mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-secondary" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{myCourseCount} 门课程</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-primary" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {todayClassCount > 0 ? `今日 ${todayClassCount} 节课` : '今日无课'}
              </span>
            </div>
          </div>
        </div>

        {/* --- DISCIPLINARY / PUNISHMENT ENTRY --- */}
        <div
          onClick={onNavigateToDisciplinary}
          className={`p-5 rounded-3xl shadow-soft mb-4 border relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-1 lg:mb-0 ${
            pendingPunishmentCount > 0 ? 'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900' : 'bg-white dark:bg-slate-800 border-slate-50 dark:border-slate-700'
          }`}
        >
          {/* Background Decoration */}
          <div className={`absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l ${pendingPunishmentCount > 0 ? 'from-red-100' : 'from-green-50 dark:from-green-950'} to-transparent opacity-50`}></div>
          <Gavel className={`absolute -right-4 -bottom-4 w-24 h-24 ${pendingPunishmentCount > 0 ? 'text-red-100' : 'text-green-100'} -rotate-12`} />

          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {pendingPunishmentCount > 0 ? (
                  <AlertTriangle size={18} className="text-red-500 dark:text-red-400" />
                ) : (
                  <Shield size={18} className="text-green-500 dark:text-green-400" />
                )}
                行为状态
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">查看纪律记录</p>
            </div>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                pendingPunishmentCount > 0 ? 'bg-red-500 text-white group-hover:bg-red-600' : 'bg-green-500 text-white group-hover:bg-green-600'
              }`}
            >
              <ChevronRight size={20} />
            </div>
          </div>

          {/* Quick Status */}
          <div className="relative z-10 mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              {pendingPunishmentCount > 0 ? (
                <>
                  <AlertTriangle size={14} className="text-red-500 dark:text-red-400" />
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">{pendingPunishmentCount} 项待处理</span>
                </>
              ) : (
                <>
                  <Shield size={14} className="text-green-500 dark:text-green-400" />
                  <span className="text-xs font-bold text-green-600 dark:text-green-400">状态良好</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* --- LOCK HISTORY ENTRY --- */}
        <div
          onClick={onNavigateToLockHistory}
          className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-4 border border-slate-50 dark:border-slate-700 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-1 lg:mb-0"
        >
          {/* Background Decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-rose-50 dark:from-rose-950 to-transparent opacity-50"></div>
          <Lock className="absolute -right-4 -bottom-4 w-24 h-24 text-rose-100 -rotate-12" />

          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History size={18} className="text-rose-500 dark:text-rose-400" />
                锁定历史
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">查看所有锁定记录和图片</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg group-hover:bg-rose-600 transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>

        {/* --- MEMORY ENTRY --- */}
        <div
          onClick={onNavigateToMemory}
          className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-4 border border-slate-50 dark:border-slate-700 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-1 lg:mb-0"
        >
          {/* Background Decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-indigo-50 dark:from-indigo-950 to-transparent opacity-50"></div>
          <Heart className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-100 -rotate-12" />

          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-500 dark:text-indigo-400" />
                我的回忆
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">记录和分享美好时刻</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg group-hover:bg-indigo-600 transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>

        {/* --- PROFILE BOARD ENTRY --- */}
        <div
          onClick={onNavigateToBoard}
          className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-4 border border-slate-50 dark:border-slate-700 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-1 lg:mb-0"
        >
          {/* Background Decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-purple-50 dark:from-purple-950 to-transparent opacity-50"></div>
          <LayoutGrid className="absolute -right-4 -bottom-4 w-24 h-24 text-purple-100 -rotate-12" />
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <LayoutGrid size={18} className="text-secondary" />
                个人展示板
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">自定义你的公开主页展示</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>

        {/* --- CREATOR MODE ENTRY (Admin Only) --- */}
        {hasPermission('admin.panel') && (
          <div
            onClick={onNavigateToCreatorMode}
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 rounded-3xl shadow-soft mb-8 border border-slate-700 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all lg:col-span-1 lg:mb-0"
          >
            {/* Background Decoration */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary blur-3xl opacity-20 rounded-full"></div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-secondary blur-3xl opacity-20 rounded-full"></div>
            <Wand2 className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 -rotate-12" />

            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Wand2 size={18} className="text-amber-400 dark:text-amber-300" />
                  创作者模式
                </h3>
                <p className="text-xs text-white/60 mt-1">管理课程、任务和游戏内容</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <ChevronRight size={20} />
              </div>
            </div>
          </div>
        )}

        {/* Settings Menu */}
        <div className="lg:col-span-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 px-2">通用设置</h3>
          {/* Mobile: vertical list card / Desktop: 4-col grid */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden lg:bg-transparent lg:shadow-none lg:border-0 lg:rounded-none lg:grid lg:grid-cols-4 lg:gap-3">
            {menuItems.map((item, i) => (
              <div key={i} className="group cursor-pointer lg:bg-white dark:bg-slate-800 lg:rounded-2xl lg:shadow-soft lg:border lg:border-slate-50 dark:border-slate-700" onClick={item.onClick}>
                <div className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors lg:flex-col lg:items-center lg:text-center lg:py-5 lg:rounded-2xl">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <item.icon size={20} />
                  </div>
                  <div className="flex-1 font-bold text-sm text-slate-700 dark:text-slate-200 lg:flex-none">{item.label}</div>
                  {'badge' in item && item.badge && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-slate-300 lg:hidden" />
                </div>
                {i !== menuItems.length - 1 && <div className="h-px bg-slate-50 dark:bg-slate-900 mx-4 lg:hidden"></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center lg:col-span-3 lg:mt-4">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            Version {__APP_VERSION__} Build {__GIT_COMMIT_SHA__}
          </p>
        </div>
      </div>

      {/* QR Modal */}
      <StudentQRModal
        isOpen={isQRModalOpen}
        onClose={handleQRModalClose}
        user={{
          name: user.name,
          studentId: user.id,
          username: authUser?.username || null,
          avatar: user.avatar,
          cardExpiry: user.cardExpiry,
          isPremium: user.isPremium,
        }}
        cardFaceThemeKey={cardFaceTheme.key !== 'default' ? cardFaceTheme.key : undefined}
      />
      <ShareCardModal
        isOpen={isShareCardOpen}
        onClose={() => setIsShareCardOpen(false)}
        userId={authUser?.id}
        cardData={{
          name: user.name,
          avatarUrl: user.avatar,
          level: user.level,
          xp: user.xp,
          nextLevelXp: user.nextLevelXp,
          major: user.major,
          studentId: user.id,
          joinDate: user.cardExpiry,
          themeKey: cardFaceTheme.key !== 'default' ? cardFaceTheme.key : undefined,
        }}
      />
    </div>
  );
};
