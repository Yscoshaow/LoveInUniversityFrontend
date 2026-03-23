import React from 'react';
import { MapPin, Calendar, Clock, Bell } from 'lucide-react';
import { ScheduleEvent, ScheduleSummary, ScheduleType } from '../../types';

// Support both legacy ScheduleEvent and new ScheduleSummary
interface EventCardProps {
  event: ScheduleEvent | ScheduleSummary;
  onClick?: (event: ScheduleEvent | ScheduleSummary) => void;
}

// Type guard to check if it's the backend type
const isBackendSchedule = (event: ScheduleEvent | ScheduleSummary): event is ScheduleSummary => {
  return typeof event.id === 'number' && 'startTime' in event;
};

// Format time from HH:mm:ss to HH.mm
const formatTime = (time: string): string => {
  // Backend format: HH:mm:ss or HH:mm
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return time;
};

// Get color based on schedule type
const getTypeColor = (type: ScheduleType | string): string => {
  switch (type) {
    case 'MEETING':
    case 'meeting':
      return 'bg-primary shadow-glow-primary';
    case 'DEADLINE':
    case 'test':
      return 'bg-red-500 shadow-red-500/30';
    case 'REMINDER':
      return 'bg-amber-500 shadow-amber-500/30';
    case 'EVENT':
      return 'bg-purple-500 shadow-purple-500/30';
    default:
      return 'bg-slate-600 shadow-slate-600/30';
  }
};

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  // Normalize data for display
  const time = isBackendSchedule(event) ? formatTime(event.startTime) : event.time;
  const title = event.title;
  const location = event.location || 'No location';
  const type = isBackendSchedule(event) ? event.type : event.type;
  const colorClass = getTypeColor(type);

  return (
    <div
      onClick={() => onClick?.(event)}
      className="flex gap-4 group cursor-pointer"
    >
      <div className="w-12 pt-2 text-xs font-medium text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">
        {time}
      </div>
      <div className={`flex-1 ${colorClass} rounded-3xl p-5 text-white shadow-lg relative overflow-hidden group-hover:scale-[1.02] active:scale-95 transition-all duration-300`}>
        {/* Abstract Card Decor */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white dark:bg-slate-800 opacity-10 rounded-full translate-x-8 -translate-y-8"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-black opacity-5 rounded-full -translate-x-4 translate-y-8"></div>

        <h3 className="font-semibold text-base mb-4 relative z-10">
          {title}
        </h3>
        <div className="flex items-center gap-2 opacity-80 relative z-10">
          <MapPin size={12} />
          <span className="text-xs truncate">
            {location}
          </span>
        </div>
      </div>
    </div>
  );
};
