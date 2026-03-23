import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Music, Timer, GraduationCap, CheckCircle2, Loader2, BookOpen, Circle } from 'lucide-react';
import type { BoardBlock } from '../../types';
import { boardApi } from '../../lib/api';
import { platformOpenLink } from '../../lib/platform-actions';
import { queryKeys } from '../../lib/query-client';

interface BoardBlockRendererProps {
  block: BoardBlock;
  userId?: number;
}

export const BoardBlockRenderer: React.FC<BoardBlockRendererProps> = ({ block, userId }) => {
  switch (block.type) {
    case 'IMAGE':
      return <ImageBlock block={block} />;
    case 'TEXT':
      return <TextBlock block={block} />;
    case 'LINK':
      return <LinkBlock block={block} />;
    case 'COLOR':
      return <ColorBlock block={block} />;
    case 'COUNTDOWN':
      return <CountdownBlock block={block} />;
    case 'MUSIC':
      return <MusicBlock block={block} />;
    case 'STAT':
      return <StatBlock block={block} />;
    case 'COURSE':
      return <CourseWidgetBlock block={block} userId={userId} />;
    case 'TASK':
      return <TaskWidgetBlock block={block} userId={userId} />;
    default:
      return null;
  }
};

const ImageBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { imageUrl, caption } = block.content;
  return (
    <div className="w-full h-full relative bg-slate-100 dark:bg-slate-700">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={caption || ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-xs font-medium truncate">{caption}</p>
        </div>
      )}
    </div>
  );
};

const TextBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { title, body, bgColor, bgGradient, textColor } = block.content;
  const isLargeish = ['LARGE', 'W3H2', 'W3H3', 'W3H4', 'W4H3'].includes(block.size);

  return (
    <div
      className="w-full h-full p-3 flex flex-col justify-center overflow-hidden"
      style={{
        backgroundColor: bgColor || '#7B6EF6',
        backgroundImage: bgGradient || undefined,
        color: textColor || '#ffffff',
      }}
    >
      {title && (
        <p className={`font-bold leading-tight ${isLargeish ? 'text-base' : 'text-sm'}`}>
          {title}
        </p>
      )}
      {body && (
        <p className={`mt-1 opacity-80 line-clamp-3 ${isLargeish ? 'text-sm' : 'text-xs'}`}>
          {body}
        </p>
      )}
    </div>
  );
};

const LinkBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { url, linkTitle, linkDescription } = block.content;
  const displayUrl = url ? new URL(url).hostname : '';

  const handleClick = () => {
    if (!url) return;
    platformOpenLink(url);
  };

  return (
    <div
      onClick={handleClick}
      className="w-full h-full bg-white dark:bg-slate-800 p-3 flex items-center gap-2.5 border border-slate-100 dark:border-slate-700 cursor-pointer active:bg-slate-50 dark:bg-slate-900 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <ExternalLink size={14} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{linkTitle || 'Link'}</p>
        {linkDescription ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{linkDescription}</p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{displayUrl}</p>
        )}
      </div>
    </div>
  );
};

const ColorBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { bgColor, bgGradient } = block.content;
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: bgColor || '#EE5A7C',
        backgroundImage: bgGradient || undefined,
      }}
    />
  );
};

const CountdownBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { targetDate, label, bgColor, bgGradient, textColor } = block.content;
  const hasCustomBg = !!(bgColor || bgGradient);

  const daysLeft = useMemo(() => {
    if (!targetDate) return 0;
    const target = new Date(targetDate);
    const now = new Date();
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
  }, [targetDate]);

  return (
    <div
      className={`w-full h-full p-3 flex flex-col items-center justify-center ${hasCustomBg ? '' : 'bg-slate-900'}`}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(bgGradient ? { backgroundImage: bgGradient } : {}),
        color: textColor || '#ffffff',
      }}
    >
      <Timer size={14} className="opacity-40 mb-1" />
      <p className="text-2xl font-black leading-none">{daysLeft}</p>
      <p className="text-[10px] opacity-50 mt-1 truncate max-w-full text-center">
        {label || 'days left'}
      </p>
    </div>
  );
};

const MusicBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { songName, artistName, musicUrl, platform, bgColor, bgGradient, textColor } = block.content;
  const hasCustomBg = !!(bgColor || bgGradient);

  const gradientClass = platform === 'spotify'
    ? 'from-green-500 to-green-600'
    : platform === 'apple'
      ? 'from-rose-500 to-pink-600'
      : 'from-violet-500 to-purple-600';

  const handleClick = () => {
    if (!musicUrl) return;
    platformOpenLink(musicUrl);
  };

  return (
    <div
      onClick={musicUrl ? handleClick : undefined}
      className={`w-full h-full p-3 flex items-center gap-2.5 ${hasCustomBg ? '' : `bg-gradient-to-r ${gradientClass}`} ${musicUrl ? 'cursor-pointer active:opacity-90' : ''}`}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(bgGradient ? { backgroundImage: bgGradient } : {}),
        color: textColor || '#ffffff',
      }}
    >
      <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center shrink-0">
        <Music size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{songName || 'Unknown'}</p>
        {artistName && <p className="text-xs opacity-80 truncate">{artistName}</p>}
      </div>
    </div>
  );
};

const StatBlock: React.FC<{ block: BoardBlock }> = ({ block }) => {
  const { statValue, statLabel, statIcon, bgColor, bgGradient, textColor } = block.content;
  const hasCustomBg = !!(bgColor || bgGradient);

  return (
    <div
      className={`w-full h-full p-2 flex flex-col items-center justify-center ${hasCustomBg ? '' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700'}`}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(bgGradient ? { backgroundImage: bgGradient } : {}),
        ...(textColor ? { color: textColor } : {}),
      }}
    >
      {statIcon && <span className="text-lg mb-0.5">{statIcon}</span>}
      <p className={`text-xl font-black leading-none ${textColor ? '' : 'text-slate-800 dark:text-slate-100'}`}>{statValue}</p>
      {statLabel && (
        <p className={`text-[10px] mt-1 truncate max-w-full text-center ${textColor ? 'opacity-50' : 'text-slate-400 dark:text-slate-500'}`}>
          {statLabel}
        </p>
      )}
    </div>
  );
};

// ==================== Widget Blocks ====================

const CourseWidgetBlock: React.FC<{ block: BoardBlock; userId?: number }> = ({ block, userId }) => {
  const { bgColor, bgGradient, textColor } = block.content;
  const hasCustomBg = !!(bgColor || bgGradient);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.board.widgetCourses(userId ?? 0),
    queryFn: () => boardApi.getWidgetCourses(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const isCompact = block.size === 'WIDE';
  const courses = data?.courses ?? [];

  return (
    <div
      className={`w-full h-full p-3 flex flex-col overflow-hidden ${hasCustomBg ? '' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(bgGradient ? { backgroundImage: bgGradient } : {}),
        color: textColor || '#ffffff',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <GraduationCap size={14} className="opacity-70" />
        <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wide">在修课程</span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin opacity-50" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs opacity-50">暂无课程</p>
        </div>
      ) : isCompact ? (
        <div className="flex-1 flex items-center">
          <p className="text-2xl font-black leading-none">{courses.length}</p>
          <p className="text-xs opacity-70 ml-2">门课程</p>
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {courses.slice(0, block.size === 'LARGE' ? 3 : 6).map((course) => (
            <div key={course.id} className="flex items-center gap-2">
              {course.iconUrl ? (
                <img src={course.iconUrl} alt="" className="w-5 h-5 rounded shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded bg-white/20 dark:bg-slate-800/20 flex items-center justify-center shrink-0">
                  <BookOpen size={10} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{course.name}</p>
                <div className="mt-0.5 h-1 rounded-full bg-white/20 dark:bg-slate-800/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/70 dark:bg-slate-800/70"
                    style={{ width: `${Math.min(course.progressPercent, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] opacity-60 shrink-0">{course.progressPercent}%</span>
            </div>
          ))}
          {courses.length > (block.size === 'LARGE' ? 3 : 6) && (
            <p className="text-[10px] opacity-50 text-center">
              +{courses.length - (block.size === 'LARGE' ? 3 : 6)} 门课程
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const TaskWidgetBlock: React.FC<{ block: BoardBlock; userId?: number }> = ({ block, userId }) => {
  const { bgColor, bgGradient, textColor } = block.content;
  const hasCustomBg = !!(bgColor || bgGradient);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.board.widgetTasks(userId ?? 0),
    queryFn: () => boardApi.getWidgetTodayTasks(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const isCompact = block.size === 'WIDE';

  return (
    <div
      className={`w-full h-full p-3 flex flex-col overflow-hidden ${hasCustomBg ? '' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(bgGradient ? { backgroundImage: bgGradient } : {}),
        color: textColor || '#ffffff',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <CheckCircle2 size={14} className="opacity-70" />
        <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wide">今日任务</span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin opacity-50" />
        </div>
      ) : !data || data.totalTasks === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs opacity-50">今日无任务</p>
        </div>
      ) : isCompact ? (
        <div className="flex-1 flex items-center gap-3">
          <p className="text-2xl font-black leading-none">
            {data.completedTasks}/{data.totalTasks}
          </p>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-white/20 dark:bg-slate-800/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/80 dark:bg-slate-800/80 transition-all"
                style={{ width: `${data.completionPercent}%` }}
              />
            </div>
            <p className="text-[10px] opacity-60 mt-0.5">已完成</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Progress ring */}
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-10 h-10 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="3"
                  strokeDasharray={`${data.completionPercent * 0.9425} 94.25`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                {data.completionPercent}%
              </span>
            </div>
            <div>
              <p className="text-sm font-bold">{data.completedTasks}/{data.totalTasks} 已完成</p>
              {data.inProgressTasks > 0 && (
                <p className="text-[10px] opacity-60">{data.inProgressTasks} 进行中</p>
              )}
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 space-y-1 overflow-hidden">
            {data.tasks.slice(0, block.size === 'LARGE' ? 3 : 5).map((task, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {task.status === 'COMPLETED' ? (
                  <CheckCircle2 size={12} className="shrink-0 opacity-80" />
                ) : (
                  <Circle size={12} className="shrink-0 opacity-40" />
                )}
                <span className={`text-[11px] truncate ${task.status === 'COMPLETED' ? 'opacity-60 line-through' : ''}`}>
                  {task.taskName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
