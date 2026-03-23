import React, { useState } from 'react';
import { ScheduleEvent, ScheduleSummary, Schedule, MemorySummary } from '../../types';
import {
  ArrowLeft,
  Edit2,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  BookOpen,
  Image,
  Share2,
  Heart,
  Loader2,
} from 'lucide-react';
import { CreateMemoryModal } from '../features/CreateMemoryModal';
import { ShareScheduleModal } from '../features/ShareScheduleModal';
import { useScheduleMemories } from '../../hooks/useMemory';
import { useScheduleDetail } from '../../hooks/useSchedules';

// Type guard
const isBackendSchedule = (event: ScheduleEvent | ScheduleSummary | Schedule): event is ScheduleSummary | Schedule => {
  return typeof event.id === 'number' && 'startTime' in event;
};

// Check if schedule can have memories (today or past)
const canCreateMemory = (event: ScheduleEvent | ScheduleSummary | Schedule): boolean => {
  if (isBackendSchedule(event)) {
    // Check status if available
    if ('status' in event && event.status === 'COMPLETED') {
      return true;
    }
    // Check if date is today or in the past
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate <= today; // Include today
  }
  return false;
};

// Format time from HH:mm:ss to HH:mm
const formatTime = (time: string): string => {
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
};

interface EventDetailViewProps {
  event: ScheduleEvent | ScheduleSummary | Schedule;
  onBack: () => void;
  onMemoryCreated?: (memoryId: number) => void;
  onViewMemory?: (memory: MemorySummary) => void;
}

export const EventDetailView: React.FC<EventDetailViewProps> = ({
  event,
  onBack,
  onMemoryCreated,
  onViewMemory,
}) => {
  const [isCreateMemoryModalOpen, setIsCreateMemoryModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Get schedule ID for backend schedules
  const scheduleId = isBackendSchedule(event) ? event.id : null;

  // Fetch full schedule detail to get description
  const { data: fullSchedule, isLoading: isLoadingSchedule } = useScheduleDetail(scheduleId || 0, {
    enabled: scheduleId !== null,
  });

  // Fetch existing memory for this schedule (one memory per schedule)
  const { data: memories, refetch: refetchMemories } = useScheduleMemories(scheduleId || 0, {
    enabled: scheduleId !== null,
  });

  // Use full schedule data if available, otherwise fall back to initial event
  const scheduleData = fullSchedule || (isBackendSchedule(event) ? event : null);

  const canCreate = canCreateMemory(event);
  // One memory per schedule
  const memory = memories && memories.length > 0 ? memories[0] : null;

  // Normalize data - prefer fullSchedule data when available
  const title = scheduleData?.title || event.title;
  const type = scheduleData?.type || event.type;
  const location = scheduleData?.location || event.location || 'No location specified';

  const time = isBackendSchedule(event) ? formatTime(event.startTime) : event.time;
  const endTime = isBackendSchedule(event)
    ? (event.endTime ? formatTime(event.endTime) : null)
    : event.endTime;

  // Get description from full schedule (Schedule has description, ScheduleSummary doesn't)
  const description = fullSchedule?.description || (!isBackendSchedule(event) ? event.description : null);
  const attendees = isBackendSchedule(event) ? [] : event.attendees;

  return (
    <div className="h-full bg-bgMain flex flex-col overflow-hidden lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Colored Header Area */}
      <div className="relative h-[35%] bg-primary rounded-b-[40px] shadow-lg flex flex-col p-6 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-800 opacity-10 rounded-full translate-x-12 -translate-y-12 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-5 rounded-full -translate-x-8 translate-y-8 blur-xl"></div>

        {/* Navbar within Header */}
        <div className="relative z-10 flex justify-between items-center pt-4 mb-auto">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-white hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <span className="text-white/80 font-medium tracking-wide text-sm">Event Detail</span>
          {scheduleId && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="p-2 -mr-2 rounded-full bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-white hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
            >
              <Share2 size={20} />
            </button>
          )}
        </div>

        {/* Header Content */}
        <div className="relative z-10 pb-4">
          <div className="inline-block px-3 py-1 bg-white/20 dark:bg-slate-800/20 backdrop-blur-md rounded-full text-white text-xs font-bold mb-3 uppercase tracking-wider">
            {type}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 leading-tight">{title}</h1>
          <div className="flex items-center gap-2 text-white/90">
            <Clock size={16} />
            <span className="text-sm font-medium">
              {time}{endTime ? ` - ${endTime}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto -mt-6 z-20 px-6 pb-28 lg:pb-8">
        {/* Location Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-soft mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-primary">
            <MapPin size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Location</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{location}</p>
          </div>
          <button className="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Description</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            {description || 'No description provided for this event.'}
          </p>
        </div>

        {/* Memory Section - Show if memory exists */}
        {memory && (
          <div
            className="mb-6 bg-gradient-to-br from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => onViewMemory?.(memory)}
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={18} className="text-indigo-500 dark:text-indigo-400" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">我的回忆</h3>
            </div>

            {/* Memory Images Preview */}
            {memory.imageUrls && memory.imageUrls.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                {memory.imageUrls.slice(0, 3).map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                ))}
                {memory.imageUrls.length > 3 && (
                  <div className="w-20 h-20 rounded-xl bg-black/10 flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium shrink-0">
                    +{memory.imageUrls.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Memory Content Preview */}
            <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-3 leading-relaxed">
              {memory.contentPreview}
            </p>

            {/* Memory Stats */}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Heart size={14} className={memory.likeCount > 0 ? 'text-rose-500 dark:text-rose-400' : ''} />
                {memory.likeCount}
              </span>
              <span>{new Date(memory.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        )}

        {/* Attendees */}
        {attendees.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Attendees</h3>
              <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">
                {attendees.length} Going
              </span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
              {attendees.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                  alt="Attendee"
                />
              ))}
              <button className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-colors">
                <Plus size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 left-6 right-6 z-30">
        {scheduleId && canCreate ? (
          memory ? (
            // Has memory - show view button
            <button
              onClick={() => onViewMemory?.(memory)}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-4 rounded-3xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <BookOpen size={20} />
              查看回忆
            </button>
          ) : (
            // No memory - show create button
            <button
              onClick={() => setIsCreateMemoryModalOpen(true)}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-4 rounded-3xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <BookOpen size={20} />
              创建回忆
            </button>
          )
        ) : (
          <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-3xl shadow-xl active:scale-95 transition-transform">
            Join Meeting
          </button>
        )}
      </div>

      {/* Create Memory Modal */}
      {isCreateMemoryModalOpen && scheduleId && (
        <CreateMemoryModal
          schedule={event as ScheduleSummary | Schedule}
          onClose={() => setIsCreateMemoryModalOpen(false)}
          onSuccess={(memoryId) => {
            setIsCreateMemoryModalOpen(false);
            refetchMemories(); // Refresh to show the new memory
            onMemoryCreated?.(memoryId);
          }}
        />
      )}

      {/* Share Schedule Modal */}
      {isShareModalOpen && scheduleId && (
        <ShareScheduleModal
          schedule={event as ScheduleSummary | Schedule}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
};
