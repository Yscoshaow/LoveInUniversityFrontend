import React, { useState, useEffect, useRef } from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { ScheduleEvent, SelfLock, ScheduleSummary, SelfLockSummary, UserTaskDetail, UserOptionalTaskGroupDisplay, OptionalTaskGroupDatePreview, LOCK_TYPE_NAMES, KEYHOLDER_PERMISSION_NAMES, ManagedLockSummary, SupervisorTaskDetail, RouletteTaskInstance } from '../../types';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Crown,
  Lock,
  Key,
  Users,
  Timer,
  Snowflake,
  Droplets,
  BookOpen,
  Building2,
  PartyPopper,
  Shield,
  UserCheck,
  ListTodo,
  Dice5,
  Footprints,
  Mic,
  Heart,
  Swords,
  Skull,
  Palette,
  Film,
  Video,
  Music,
  Trophy,
  Ribbon,
} from 'lucide-react';
import { ProfileHeader, CalendarStrip, CalendarGrid, EventCard, SelfLockCard, TaskCard, OptionalTaskGroupCard, SupervisorTaskCard } from '../ui';
import { RouletteTaskCard } from '../roulette/RouletteTaskCard';
import {
  useMyLocks,
  useManagedLocks,
  useScheduleByDate,
  useTodayTasks,
  useTasksByDate,
  useStartTask,
  useCompleteTask,
  useUpdateTaskProgress,
  usePendingOptionalTaskGroups,
  useOptionalTaskGroupsByDate,
  useSelectTasks,
  useSupervisionHomeOverview,
  useMySupervisorTasks,
  useStartSupervisorTask,
  useCompleteSupervisorTask,
  useUpdateSupervisorTaskProgress,
  usePendingRouletteTasks,
  useInvalidateRouletteTasks,
} from '../../hooks';
import { useUserSettings } from '../../hooks/useUser';

const monthNames = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

// Format date to YYYY-MM-DD using local timezone (NOT UTC)
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse YYYY-MM-DD string to Date (as local date, not UTC)
const parseDateKey = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * 获取用户的有效日期（考虑 dayStartOffsetHours）
 * 例如：如果 dayStartOffsetHours = 3，则凌晨 0:00-2:59 仍属于"昨天"
 * @param dayStartOffsetHours 用户的日开始时间偏移（-12 到 +12）
 * @returns 用户视角的"今天"日期字符串 (YYYY-MM-DD)
 */
const getEffectiveToday = (dayStartOffsetHours: number = 0): string => {
  const now = new Date();
  const adjustedTime = new Date(now.getTime() - dayStartOffsetHours * 60 * 60 * 1000);
  return formatDateKey(adjustedTime);
};

// Campus location types — includes all navigable locations
export type CampusLocation =
  | 'library' | 'teaching-building' | 'activity-center' | 'campus-walk'
  | 'voice-chat' | 'therapy-room' | 'roulette-room' | 'liars-tavern'
  | 'punishment-room' | 'art-gallery' | 'cinema' | 'live-stream'
  | 'music-room' | 'auditorium' | 'rope-art' | 'alumni-chat';

// Default homepage shortcuts (when user hasn't customized)
export const DEFAULT_HOMEPAGE_SHORTCUTS = ['library', 'activity-center', 'campus-walk'];

// All available shortcut items (excluding teaching-building which is always shown)
export const ALL_SHORTCUT_ITEMS: { id: string; label: string; icon: string; bgColor: string; iconColor: string }[] = [
  { id: 'library', label: '图书馆', icon: 'BookOpen', bgColor: 'bg-blue-50 dark:bg-blue-950', iconColor: 'text-blue-500 dark:text-blue-400' },
  { id: 'activity-center', label: '活动中心', icon: 'PartyPopper', bgColor: 'bg-rose-50 dark:bg-rose-950', iconColor: 'text-rose-500 dark:text-rose-400' },
  { id: 'campus-walk', label: '漫步校园', icon: 'Footprints', bgColor: 'bg-emerald-50 dark:bg-emerald-950', iconColor: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'voice-chat', label: '语音聊天', icon: 'Mic', bgColor: 'bg-violet-50 dark:bg-violet-950', iconColor: 'text-violet-500 dark:text-violet-400' },
  { id: 'therapy-room', label: '理疗房', icon: 'Heart', bgColor: 'bg-pink-50 dark:bg-pink-950', iconColor: 'text-pink-500 dark:text-pink-400' },
  { id: 'roulette-room', label: '游戏室', icon: 'Dice5', bgColor: 'bg-emerald-50 dark:bg-emerald-950', iconColor: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'liars-tavern', label: '骗子酒馆', icon: 'Swords', bgColor: 'bg-amber-50 dark:bg-amber-950', iconColor: 'text-amber-700 dark:text-amber-400' },
  { id: 'punishment-room', label: '惩罚室', icon: 'Skull', bgColor: 'bg-slate-100 dark:bg-slate-950', iconColor: 'text-slate-600 dark:text-slate-400' },
  { id: 'art-gallery', label: '美术馆', icon: 'Palette', bgColor: 'bg-indigo-50 dark:bg-indigo-950', iconColor: 'text-indigo-500 dark:text-indigo-400' },
  { id: 'cinema', label: '电影院', icon: 'Film', bgColor: 'bg-amber-50 dark:bg-amber-950', iconColor: 'text-amber-500 dark:text-amber-400' },
  { id: 'live-stream', label: '直播间', icon: 'Video', bgColor: 'bg-red-50 dark:bg-red-950', iconColor: 'text-red-500 dark:text-red-400' },
  { id: 'music-room', label: '音乐室', icon: 'Music', bgColor: 'bg-purple-50 dark:bg-purple-950', iconColor: 'text-purple-500 dark:text-purple-400' },
  { id: 'auditorium', label: '礼堂', icon: 'Trophy', bgColor: 'bg-violet-50 dark:bg-violet-950', iconColor: 'text-violet-500 dark:text-violet-400' },
  { id: 'rope-art', label: '绳艺室', icon: 'Ribbon', bgColor: 'bg-rose-50 dark:bg-rose-950', iconColor: 'text-rose-500 dark:text-rose-400' },
];

const SHORTCUT_ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen size={24} />, PartyPopper: <PartyPopper size={24} />, Footprints: <Footprints size={24} />,
  Mic: <Mic size={24} />, Heart: <Heart size={24} />, Dice5: <Dice5 size={24} />, Swords: <Swords size={24} />,
  Skull: <Skull size={24} />, Palette: <Palette size={24} />, Film: <Film size={24} />, Video: <Video size={24} />,
  Music: <Music size={24} />, Trophy: <Trophy size={24} />, Ribbon: <Ribbon size={24} />,
};

interface DashboardProps {
  onEventClick: (event: ScheduleEvent | ScheduleSummary) => void;
  onLockClick: (lock: SelfLock | SelfLockSummary) => void;
  onManagedLockClick?: (lock: ManagedLockSummary) => void;
  onTaskClick?: (task: UserTaskDetail) => void;
  onSupervisorTaskClick?: (task: SupervisorTaskDetail) => void;
  onCreateSchedule: (date: Date) => void;
  onCreateLock: () => void;
  onCampusNavigate?: (location: CampusLocation) => void;
  onSuperviseeClick?: (superviseeId: number, superviseeName: string, superviseeAvatar?: string) => void;
  onSupervisorClick?: (supervisorId: number) => void;
  refreshTrigger?: number; // Deprecated: React Query handles refresh automatically
}

export const Dashboard: React.FC<DashboardProps> = ({
  onEventClick,
  onLockClick,
  onManagedLockClick,
  onTaskClick,
  onSupervisorTaskClick,
  onCreateSchedule,
  onCreateLock,
  onCampusNavigate,
  onSuperviseeClick,
  onSupervisorClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDirection(scrollRef);

  // 获取用户设置（包含 dayStartOffsetHours + homepageShortcuts）
  const userSettingsQuery = useUserSettings();
  const dayStartOffsetHours = userSettingsQuery.data?.dayStartOffsetHours ?? 0;
  const homepageShortcuts = userSettingsQuery.data?.homepageShortcuts?.length
    ? userSettingsQuery.data.homepageShortcuts
    : DEFAULT_HOMEPAGE_SHORTCUTS;

  const today = new Date();
  // 使用有效日期判断是否为"今天"（考虑时间偏移）
  const effectiveTodayStr = getEffectiveToday(dayStartOffsetHours);
  const isToday = formatDateKey(currentDate) === effectiveTodayStr;
  const dateStr = formatDateKey(currentDate);

  // ==================== React Query Hooks ====================

  // Fetch today's tasks for initial load
  const todayTasksQuery = useTodayTasks();

  // Fetch tasks for selected date (when not today)
  const dateTasksQuery = useTasksByDate(dateStr, { enabled: isInitialized && !isToday });

  // Use today's tasks if viewing today, otherwise use date-specific tasks
  const tasks = isToday ? (todayTasksQuery.data?.tasks ?? []) : (dateTasksQuery.data?.tasks ?? []);
  const isLoadingTasks = isToday ? todayTasksQuery.isLoading : dateTasksQuery.isLoading;

  // Fetch schedules for selected date
  const schedulesQuery = useScheduleByDate(dateStr, { enabled: isInitialized });
  const schedules = schedulesQuery.data?.schedules ?? [];
  const isLoadingSchedules = schedulesQuery.isLoading;

  // Fetch user's locks
  const locksQuery = useMyLocks(true); // Active only
  const locks = locksQuery.data ?? [];
  const isLoadingLocks = locksQuery.isLoading;

  // Fetch locks where I'm keyholder
  const managedLocksQuery = useManagedLocks();
  const managedLocks = managedLocksQuery.data ?? [];
  const isLoadingManagedLocks = managedLocksQuery.isLoading;

  // Fetch pending optional task groups for today (only PENDING_SELECTION — once selected, tasks appear in daily schedule)
  const optionalTaskGroupsQuery = usePendingOptionalTaskGroups();
  const todayOptionalTaskGroups = (optionalTaskGroupsQuery.data ?? []).filter(g => g.status === 'PENDING_SELECTION');

  // Fetch optional task groups preview for selected date (non-today)
  const dateOptionalTaskGroupsQuery = useOptionalTaskGroupsByDate(dateStr, { enabled: isInitialized && !isToday });
  const dateOptionalTaskGroups = dateOptionalTaskGroupsQuery.data ?? [];

  // Show today's pending groups when viewing today, date preview when viewing other dates
  const optionalTaskGroups = isToday ? todayOptionalTaskGroups : [];
  const optionalTaskGroupPreviews = isToday ? [] : dateOptionalTaskGroups;
  const isLoadingOptionalTaskGroups = isToday ? optionalTaskGroupsQuery.isLoading : dateOptionalTaskGroupsQuery.isLoading;

  // Fetch supervision relationships
  const supervisionQuery = useSupervisionHomeOverview();
  const supervisionData = supervisionQuery.data;
  const isLoadingSupervision = supervisionQuery.isLoading;

  // Fetch supervisor-assigned tasks for me (as supervisee)
  const supervisorTasksQuery = useMySupervisorTasks(dateStr, { enabled: isInitialized });
  const supervisorTasks = supervisorTasksQuery.data ?? [];
  const isLoadingSupervisorTasks = supervisorTasksQuery.isLoading;

  // Fetch pending roulette task instances
  const rouletteTasksQuery = usePendingRouletteTasks();
  const rouletteTasks = rouletteTasksQuery.data ?? [];
  const isLoadingRouletteTasks = rouletteTasksQuery.isLoading;
  const invalidateRouletteTasks = useInvalidateRouletteTasks();

  // Mutation hooks
  const startTaskMutation = useStartTask();
  const selectTasksMutation = useSelectTasks();
  const completeTaskMutation = useCompleteTask();
  const updateProgressMutation = useUpdateTaskProgress();

  // Supervisor task mutations
  const startSupervisorTaskMutation = useStartSupervisorTask();
  const completeSupervisorTaskMutation = useCompleteSupervisorTask();
  const updateSupervisorProgressMutation = useUpdateSupervisorTaskProgress();

  // ==================== Effects ====================

  // Initialize with backend's effective date
  useEffect(() => {
    if (todayTasksQuery.data?.date && !isInitialized) {
      const effectiveDate = parseDateKey(todayTasksQuery.data.date);
      setCurrentDate(effectiveDate);
      setDisplayMonth(effectiveDate);
      setIsInitialized(true);
    }
  }, [todayTasksQuery.data?.date, isInitialized]);

  // ==================== Event Handlers ====================

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = new Date(displayMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setDisplayMonth(newDate);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = new Date(displayMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setDisplayMonth(newDate);
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handleStartTask = async (task: UserTaskDetail) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
    } catch (error) {
      console.error('Failed to start task:', error);
    }
  };

  const handleCompleteTask = async (task: UserTaskDetail, actualValue?: number) => {
    try {
      await completeTaskMutation.mutateAsync({ taskId: task.id, actualValue });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleIncrementTask = async (task: UserTaskDetail) => {
    try {
      const newValue = task.actualValue + 1;
      await updateProgressMutation.mutateAsync({ taskId: task.id, actualValue: newValue });
      // Auto-complete if target reached
      if (newValue >= task.targetValue) {
        await completeTaskMutation.mutateAsync({ taskId: task.id, actualValue: newValue });
      }
    } catch (error) {
      console.error('Failed to increment task:', error);
    }
  };

  // Handler for selecting optional tasks
  const handleSelectTasks = async (groupId: number, taskDefinitionIds: number[]) => {
    try {
      await selectTasksMutation.mutateAsync({ groupId, taskDefinitionIds });
    } catch (error) {
      console.error('Failed to select tasks:', error);
      throw error;
    }
  };

  // Handlers for supervisor tasks
  const handleStartSupervisorTask = async (task: SupervisorTaskDetail) => {
    try {
      await startSupervisorTaskMutation.mutateAsync(task.id);
    } catch (error) {
      console.error('Failed to start supervisor task:', error);
    }
  };

  const handleCompleteSupervisorTask = async (task: SupervisorTaskDetail, actualValue?: number) => {
    try {
      await completeSupervisorTaskMutation.mutateAsync({ taskId: task.id, actualValue });
    } catch (error) {
      console.error('Failed to complete supervisor task:', error);
    }
  };

  const handleIncrementSupervisorTask = async (task: SupervisorTaskDetail) => {
    try {
      const newValue = task.actualValue + 1;
      await updateSupervisorProgressMutation.mutateAsync({ taskId: task.id, actualValue: newValue });
      // Auto-complete if target reached
      if (newValue >= task.targetValue) {
        await completeSupervisorTaskMutation.mutateAsync({ taskId: task.id, actualValue: newValue });
      }
    } catch (error) {
      console.error('Failed to increment supervisor task:', error);
    }
  };

  // Sort schedules by start time
  const sortedSchedules = [...schedules].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto no-scrollbar">
      <div className="p-6 pb-28 lg:pb-8 lg:max-w-[1200px] lg:mx-auto lg:w-full">
        {/* Header Profile */}
        <ProfileHeader />

        {/* Calendar Header Control */}
        <div
          className="flex justify-between items-center mb-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {monthNames[isExpanded ? displayMonth.getMonth() : currentDate.getMonth()]}{' '}
              {isExpanded ? displayMonth.getFullYear() : currentDate.getFullYear()}
            </h2>
            {isExpanded ? (
              <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronDown size={20} className="text-slate-400 dark:text-slate-500" />
            )}
          </div>
          {isExpanded && (
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Date Picker Area */}
        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'mb-4' : 'mb-8'}`}>
          {!isExpanded ? (
            <CalendarStrip currentDate={currentDate} onDateSelect={handleDateClick} />
          ) : (
            <CalendarGrid
              displayMonth={displayMonth}
              currentDate={currentDate}
              onDateSelect={handleDateClick}
            />
          )}
        </div>

        {/* Desktop: 2-column grid layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">

        {/* Section: Today's Schedule (Combined Schedules + Tasks + Supervisor Tasks) */}
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {isSameDay(currentDate, today)
                ? "今日日程"
                : `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 日程`}
            </h2>
            {(tasks.length > 0 || supervisorTasks.length > 0) && (
              <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {tasks.filter(t => t.status === 'COMPLETED').length + supervisorTasks.filter(t => t.status === 'COMPLETED').length}/{tasks.length + supervisorTasks.length} 任务
              </span>
            )}
          </div>
          <button
            onClick={() => onCreateSchedule(currentDate)}
            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-primary hover:text-white transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {(isLoadingSchedules || isLoadingTasks || isLoadingSupervisorTasks) ? (
          <div className="mb-8 p-8 flex justify-center">
            <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
          </div>
        ) : (sortedSchedules.length > 0 || tasks.length > 0 || supervisorTasks.length > 0) ? (
          <div className="space-y-4 mb-8">
            {/* Combine and sort schedules, tasks, and supervisor tasks by time */}
            {(() => {
              // Create unified items with sort key
              type UnifiedItem =
                | { type: 'schedule'; data: typeof sortedSchedules[0]; sortKey: string }
                | { type: 'task'; data: typeof tasks[0]; sortKey: string }
                | { type: 'supervisorTask'; data: SupervisorTaskDetail; sortKey: string };

              const unifiedItems: UnifiedItem[] = [
                ...sortedSchedules.map(s => ({
                  type: 'schedule' as const,
                  data: s,
                  sortKey: s.startTime
                })),
                ...tasks.map(t => ({
                  type: 'task' as const,
                  data: t,
                  // Tasks use dueAt time if available, otherwise put at end of day
                  sortKey: t.dueAt ? t.dueAt.split('T')[1]?.substring(0, 8) || '23:59:59' : '23:59:59'
                })),
                ...supervisorTasks.map(t => ({
                  type: 'supervisorTask' as const,
                  data: t,
                  // Supervisor tasks use dueAt time if available, otherwise put at end of day
                  sortKey: t.dueAt ? t.dueAt.split('T')[1]?.substring(0, 8) || '23:59:59' : '23:59:59'
                }))
              ];

              // Sort by time
              unifiedItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

              return unifiedItems.map((item) => {
                if (item.type === 'schedule') {
                  return <EventCard key={`schedule-${item.data.id}`} event={item.data} onClick={onEventClick} />;
                } else if (item.type === 'task') {
                  return (
                    <TaskCard
                      key={`task-${item.data.id}`}
                      task={item.data}
                      onClick={onTaskClick}
                      onStart={handleStartTask}
                      onComplete={handleCompleteTask}
                      onIncrement={handleIncrementTask}
                      dayStartOffsetHours={dayStartOffsetHours}
                    />
                  );
                } else {
                  return (
                    <SupervisorTaskCard
                      key={`supervisor-task-${item.data.id}`}
                      task={item.data}
                      onClick={onSupervisorTaskClick}
                      onStart={handleStartSupervisorTask}
                      onComplete={handleCompleteSupervisorTask}
                      onIncrement={handleIncrementSupervisorTask}
                    />
                  );
                }
              });
            })()}
          </div>
        ) : (
          <div className="mb-8 p-4 text-center text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
            这一天暂无日程安排
          </div>
        )}

        {/* Section: Optional Task Groups (选做任务) — Today: pending selection; Other dates: preview */}
        {(isLoadingOptionalTaskGroups || optionalTaskGroups.length > 0 || optionalTaskGroupPreviews.length > 0) && (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">选做任务</h2>
                {isToday && optionalTaskGroups.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {optionalTaskGroups.length} 待选择
                  </span>
                )}
                {!isToday && optionalTaskGroupPreviews.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    预览
                  </span>
                )}
              </div>
            </div>

            {isLoadingOptionalTaskGroups ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
              </div>
            ) : isToday ? (
              <div className="space-y-4">
                {optionalTaskGroups.map((group) => (
                  <OptionalTaskGroupCard
                    key={group.id}
                    group={group}
                    onSelect={handleSelectTasks}
                    onTaskClick={(taskId) => {
                      const task = tasks.find(t => t.id === taskId);
                      if (task && onTaskClick) {
                        onTaskClick(task);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {optionalTaskGroupPreviews.map((preview) => (
                  <OptionalTaskGroupPreviewCard key={preview.groupId} preview={preview} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section: Pending Roulette Tasks */}
        {(isLoadingRouletteTasks || rouletteTasks.length > 0) && (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">轮盘任务</h2>
                <span className="px-2 py-0.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold rounded-full">
                  <Dice5 size={10} className="inline mr-1" />
                  ROULETTE
                </span>
              </div>
              {rouletteTasks.length > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {rouletteTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length} 待完成
                </span>
              )}
            </div>

            {isLoadingRouletteTasks ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {rouletteTasks.map((instance) => (
                  <RouletteTaskCard
                    key={instance.id}
                    instance={instance}
                    onRefresh={invalidateRouletteTasks}
                    showGameTitle
                  />
                ))}
              </div>
            )}
          </div>
        )}

        </div>
        <div>

        {/* Section: Self-Discipline Lock */}
        <div className="mb-4">
          <div className="flex justify-between items-end mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">我的时间锁</h2>
              <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">
                BETA
              </span>
            </div>
            {!isLoadingLocks && locks.length === 0 && (
              <button
                onClick={onCreateLock}
                className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1"
              >
                创建锁 <ChevronRight size={14} />
              </button>
            )}
          </div>

          {isLoadingLocks ? (
            <div className="p-8 flex justify-center">
              <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {locks.map((lock) => (
                <SelfLockCard key={lock.id} lock={lock} onClick={onLockClick} />
              ))}

              {locks.length === 0 && (
                <button
                  onClick={onCreateLock}
                  className="w-full h-[180px] rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500 hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <span className="text-sm font-semibold">创建新锁</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section: Locks I Manage (as Keyholder) */}
        {(managedLocks.length > 0 || isLoadingManagedLocks) && (
          <div className="mb-4">
            <div className="flex justify-between items-end mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">我管理的锁</h2>
                <span className="px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold rounded-full">
                  <Crown size={10} className="inline mr-1" />
                  KEYHOLDER
                </span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{managedLocks.length} 个锁</span>
            </div>

            {isLoadingManagedLocks ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {managedLocks.map((lock) => (
                  <div
                    key={lock.lockId}
                    onClick={() => onManagedLockClick?.(lock)}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        {lock.wearerAvatar ? (
                          <img
                            src={lock.wearerAvatar}
                            className="w-12 h-12 rounded-full object-cover border-2 border-violet-200 dark:border-violet-800"
                            alt="wearer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                            <Users size={20} className="text-violet-500 dark:text-violet-400" />
                          </div>
                        )}
                        {/* Lock Type Badge */}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                          lock.lockType === 'SHARED' ? 'bg-violet-500' :
                          lock.lockType === 'PRIVATE' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}>
                          {lock.lockType === 'SHARED' ? <Users size={10} className="text-white" /> :
                           lock.lockType === 'PRIVATE' ? <Key size={10} className="text-white" /> :
                           <Lock size={10} className="text-white" />}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {lock.wearerName || `User #${lock.wearerId}`}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            lock.permission === 'FULL_CONTROL' ? 'bg-violet-100 text-violet-600 dark:text-violet-400' :
                            lock.permission === 'BASIC_CONTROL' ? 'bg-blue-100 text-blue-600 dark:text-blue-400' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {KEYHOLDER_PERMISSION_NAMES[lock.permission]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            lock.lockType === 'SHARED' ? 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400' :
                            lock.lockType === 'PRIVATE' ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                          }`}>
                            {LOCK_TYPE_NAMES[lock.lockType]}
                          </span>
                          {lock.isFrozen && (
                            <span className="flex items-center gap-0.5 text-blue-500 dark:text-blue-400">
                              <Snowflake size={10} />
                              冻结
                            </span>
                          )}
                          {lock.isHygieneOpening && (
                            <span className="flex items-center gap-0.5 text-emerald-500 dark:text-emerald-400">
                              <Droplets size={10} />
                              卫生开启
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                          <Timer size={12} />
                          <span className="text-xs font-bold font-mono">
                            {lock.remainingSeconds !== null ?
                              lock.remainingSeconds >= 3600 ?
                                `${Math.floor(lock.remainingSeconds / 3600)}h ${Math.floor((lock.remainingSeconds % 3600) / 60)}m` :
                                `${Math.floor(lock.remainingSeconds / 60)}m`
                              : '--'}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-1 ${
                          lock.status === 'ACTIVE' ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {lock.status === 'ACTIVE' ? '锁定中' : lock.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section: Campus */}
        <div className="mb-4">
          <div className="flex justify-between items-end mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">校园</h2>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                CAMPUS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {homepageShortcuts.map(id => {
              const item = ALL_SHORTCUT_ITEMS.find(s => s.id === id);
              if (!item) return null;
              return (
                <button
                  key={item.id}
                  onClick={() => onCampusNavigate?.(item.id as CampusLocation)}
                  className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 active:scale-95 transition-transform"
                >
                  <div className={`w-12 h-12 rounded-full ${item.bgColor} flex items-center justify-center`}>
                    <span className={item.iconColor}>{SHORTCUT_ICON_MAP[item.icon]}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                </button>
              );
            })}

            {/* 教学楼 — always shown */}
            <button
              onClick={() => onCampusNavigate?.('teaching-building')}
              className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                <Building2 size={24} className="text-amber-500 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">教学楼</span>
            </button>
          </div>
        </div>

        {/* Section: Supervision Relationships */}
        {(isLoadingSupervision || supervisionData?.supervisor || (supervisionData?.supervisees && supervisionData.supervisees.length > 0)) && (
          <div className="mb-4">
            <div className="flex justify-between items-end mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">监督关系</h2>
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full">
                  <Shield size={10} className="inline mr-1" />
                  SUPERVISION
                </span>
              </div>
            </div>

            {isLoadingSupervision ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 dark:text-slate-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* My Supervisor */}
                {supervisionData?.supervisor && (
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                      <UserCheck size={12} />
                      我的监督者
                    </div>
                    <div
                      onClick={() => onSupervisorClick?.(supervisionData.supervisor!.userId)}
                      className="bg-gradient-to-r from-indigo-50 dark:from-indigo-950 to-violet-50 dark:to-violet-950 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {supervisionData.supervisor.avatar ? (
                          <img
                            src={supervisionData.supervisor.avatar}
                            className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-800"
                            alt="supervisor"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                            <Shield size={20} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {supervisionData.supervisor.name}
                          </div>
                          {supervisionData.supervisor.username && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              @{supervisionData.supervisor.username}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Supervisees I manage */}
                {supervisionData?.supervisees && supervisionData.supervisees.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                      <Users size={12} />
                      我监督的人 ({supervisionData.supervisees.length})
                    </div>
                    <div className="space-y-3">
                      {supervisionData.supervisees.map((supervisee) => (
                        <div
                          key={supervisee.userId}
                          onClick={() => onSuperviseeClick?.(supervisee.userId, supervisee.name, supervisee.avatar)}
                          className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700 active:scale-[0.98] transition-transform cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            {supervisee.avatar ? (
                              <img
                                src={supervisee.avatar}
                                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-800"
                                alt="supervisee"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                                <Users size={20} className="text-emerald-500 dark:text-emerald-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                {supervisee.name}
                              </div>
                              {supervisee.username && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  @{supervisee.username}
                                </div>
                              )}
                            </div>
                            {/* Today's task progress */}
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-lg">
                                <ListTodo size={12} />
                                <span className="text-xs font-bold">
                                  {supervisee.todayCompletedTasks}/{supervisee.todayTotalTasks}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                {supervisee.todayTotalTasks > 0
                                  ? `${Math.round((supervisee.todayCompletedTasks / supervisee.todayTotalTasks) * 100)}%`
                                  : '无任务'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
};

// --- Preview card for optional task groups on non-today dates ---

const TASK_TYPE_LABELS: Record<string, string> = {
  DURATION: '时长', COUNT: '次数', MANUAL: '手动确认', LOCK: '锁定',
};
const TARGET_UNIT_LABELS: Record<string, string> = {
  KILOMETERS: 'km', METERS: 'm', MINUTES: '分钟', HOURS: '小时', TIMES: '次', NONE: '',
};
const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  PENDING_SELECTION: { text: '待选择', color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' },
  IN_PROGRESS: { text: '进行中', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400' },
  COMPLETED: { text: '已完成', color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400' },
  FAILED: { text: '未完成', color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400' },
  EXPIRED: { text: '已过期', color: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' },
};

const OptionalTaskGroupPreviewCard: React.FC<{ preview: OptionalTaskGroupDatePreview }> = ({ preview }) => {
  const statusInfo = preview.existingStatus ? STATUS_LABELS[preview.existingStatus] : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{preview.groupName}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{preview.courseName}</div>
        </div>
        {statusInfo ? (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 bg-purple-100 text-purple-600 dark:text-purple-400">
            预览
          </span>
        )}
      </div>
      {preview.groupDescription && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{preview.groupDescription}</div>
      )}
      <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">
        需完成 <span className="font-medium text-slate-600 dark:text-slate-300">{preview.requiredCount}/{preview.totalCount}</span> 个任务
      </div>
      {preview.tasks.length > 0 && (
        <div className="space-y-1 pl-2 border-l-2 border-purple-200 dark:border-purple-800">
          {preview.tasks.map(task => (
            <div key={task.id} className="text-xs flex items-center gap-1.5">
              <span className="font-medium text-slate-600 dark:text-slate-300">{task.name}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-400 dark:text-slate-500">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
              {task.targetValue > 0 && (TARGET_UNIT_LABELS[task.targetUnit] || '') && (
                <span className="text-slate-400 dark:text-slate-500">
                  {task.targetValue} {TARGET_UNIT_LABELS[task.targetUnit] || task.targetUnit}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
