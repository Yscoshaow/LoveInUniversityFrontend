import React from 'react';

// ── Base Skeleton ──

const Pulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-200 dark:bg-slate-700 animate-pulse rounded ${className}`} />
);

// ── Composites ──

/** 任务/日程卡片骨架 */
export const TaskCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-3">
    <div className="flex items-center gap-3">
      <Pulse className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-3.5 w-2/3 rounded-full" />
        <Pulse className="h-3 w-1/3 rounded-full" />
      </div>
    </div>
    <Pulse className="h-2 w-full rounded-full" />
  </div>
);

/** 自律锁卡片骨架 */
export const LockCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Pulse className="w-8 h-8 rounded-full" />
        <Pulse className="h-3.5 w-20 rounded-full" />
      </div>
      <Pulse className="h-5 w-16 rounded-full" />
    </div>
    <div className="space-y-2">
      <Pulse className="h-2.5 w-full rounded-full" />
      <div className="flex justify-between">
        <Pulse className="h-3 w-24 rounded-full" />
        <Pulse className="h-3 w-16 rounded-full" />
      </div>
    </div>
  </div>
);

/** 管理的锁卡片骨架 */
export const ManagedLockSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
    <div className="flex items-center gap-3">
      <Pulse className="w-11 h-11 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-3.5 w-24 rounded-full" />
        <Pulse className="h-3 w-32 rounded-full" />
      </div>
      <Pulse className="h-5 w-14 rounded-full" />
    </div>
  </div>
);

/** 操场锁卡片骨架（带头像+徽章） */
export const PlaygroundLockSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Pulse className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Pulse className="h-3.5 w-20 rounded-full" />
          <div className="flex gap-1.5">
            <Pulse className="h-4 w-12 rounded-full" />
            <Pulse className="h-4 w-10 rounded-full" />
          </div>
        </div>
      </div>
      <Pulse className="h-2 w-full rounded-full" />
      <div className="flex justify-between items-center pt-1">
        <Pulse className="h-3 w-20 rounded-full" />
        <div className="flex gap-2">
          <Pulse className="h-8 w-16 rounded-xl" />
          <Pulse className="h-8 w-8 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

/** 帖子卡片骨架 */
export const PostCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 px-4 py-4 space-y-3">
    <div className="flex items-center gap-3">
      <Pulse className="w-9 h-9 rounded-full shrink-0" />
      <div className="space-y-1.5">
        <Pulse className="h-3.5 w-20 rounded-full" />
        <Pulse className="h-2.5 w-28 rounded-full" />
      </div>
    </div>
    <div className="space-y-2">
      <Pulse className="h-3.5 w-full rounded-full" />
      <Pulse className="h-3.5 w-4/5 rounded-full" />
      <Pulse className="h-3 w-2/3 rounded-full" />
    </div>
    <div className="flex gap-2">
      <Pulse className="h-32 flex-1 rounded-xl" />
      <Pulse className="h-32 flex-1 rounded-xl" />
    </div>
    <div className="flex items-center gap-6 pt-1">
      <Pulse className="h-4 w-12 rounded-full" />
      <Pulse className="h-4 w-12 rounded-full" />
      <Pulse className="h-4 w-12 rounded-full" />
    </div>
  </div>
);

/** 快捷入口行骨架（4 个圆形图标） */
export const ShortcutsRowSkeleton: React.FC = () => (
  <div className="grid grid-cols-4 gap-3">
    {[0, 1, 2, 3].map(i => (
      <div key={i} className="flex flex-col items-center gap-2">
        <Pulse className="w-14 h-14 rounded-2xl" />
        <Pulse className="h-2.5 w-10 rounded-full" />
      </div>
    ))}
  </div>
);

/** 通用列表骨架：重复 N 个子元素 */
export const SkeletonList: React.FC<{
  count?: number;
  children: React.ReactNode;
  className?: string;
}> = ({ count = 3, children, className = 'space-y-3' }) => (
  <div className={className}>
    {Array.from({ length: count }, (_, i) => (
      <React.Fragment key={i}>{children}</React.Fragment>
    ))}
  </div>
);
