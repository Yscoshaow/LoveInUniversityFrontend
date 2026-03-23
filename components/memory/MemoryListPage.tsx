import React, { useState } from 'react';
import { useMyMemories, useMemoryStats } from '../../hooks/useMemory';
import type { MemorySummary, MemoryDetail } from '../../types';
import {
  ArrowLeft, BookOpen, Heart, Eye, Globe, Lock,
  Loader2, Calendar, ChevronRight, AlertCircle, Image, Plus
} from 'lucide-react';
import MemoryDetailPage from './MemoryDetailPage';

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}个月前`;
};

type FilterType = 'all' | 'published' | 'private';

interface MemoryListPageProps {
  onBack: () => void;
  onCreateMemory?: () => void;
}

export const MemoryListPage: React.FC<MemoryListPageProps> = ({
  onBack,
  onCreateMemory
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);

  const { data: memories, isLoading, error, refetch } = useMyMemories();
  const { data: stats } = useMemoryStats();

  // Filter memories
  const filteredMemories = (memories || []).filter(memory => {
    switch (filter) {
      case 'published':
        return memory.isPublishedToCommunity;
      case 'private':
        return !memory.isPublishedToCommunity;
      default:
        return true;
    }
  });

  if (selectedMemoryId !== null) {
    return (
      <MemoryDetailPage
        memoryId={selectedMemoryId}
        onBack={() => setSelectedMemoryId(null)}
      />
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">我的回忆</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500">记录每一个美好时刻</p>
        </div>
        {onCreateMemory && (
          <button
            onClick={onCreateMemory}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <Plus size={20} className="text-white" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Stats skeleton */}
          <div className="p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-20 mb-3" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="text-center space-y-1.5">
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-7 w-10 mx-auto" />
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-8 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Filter tabs skeleton */}
          <div className="px-4 mb-2">
            <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 lg:max-w-xs">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex-1 py-2 px-3">
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
          {/* Memory card skeletons */}
          <div className="px-4 pb-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-50 dark:border-slate-700 overflow-hidden">
                {/* Image placeholder (alternate between with/without image) */}
                {i % 2 === 0 && (
                  <div className="h-32 bg-slate-200 dark:bg-slate-700 animate-pulse" />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {i % 2 !== 0 && (
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-3/4" />
                      <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-full" />
                      <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-5/6" />
                      <div className="flex items-center gap-3 pt-1">
                        <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16" />
                        <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-8" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-300">{error instanceof Error ? error.message : '加载失败'}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-medium"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Stats Summary */}
          {stats && (
            <div className="p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border border-slate-50 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">统计概览</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalMemories}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">总回忆</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500 dark:text-green-400">{stats.publishedCount}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">已发布</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-rose-500 dark:text-rose-400">{stats.totalLikes}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">获赞</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="px-4 mb-2">
            <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 lg:max-w-xs">
              {[
                { key: 'all', label: '全部' },
                { key: 'published', label: '已发布' },
                { key: 'private', label: '私密' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as FilterType)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    filter === key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Memory List */}
          <div className="px-4 pb-6">
            {filteredMemories.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">暂无回忆</p>
                {onCreateMemory && (
                  <button
                    onClick={onCreateMemory}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm"
                  >
                    创建第一个回忆
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                {filteredMemories.map(memory => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => setSelectedMemoryId(memory.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Memory Card Component
interface MemoryCardProps {
  memory: MemorySummary;
  onClick: () => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onClick }) => {
  const hasImages = memory.imageUrls && memory.imageUrls.length > 0;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] overflow-hidden"
    >
      {/* Image Preview */}
      {hasImages && (
        <div className="relative h-32 bg-slate-100 dark:bg-slate-700">
          <img
            src={memory.imageUrls[0]}
            alt=""
            className="w-full h-full object-cover"
          />
          {memory.imageUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Image size={12} />
              {memory.imageUrls.length}
            </div>
          )}
          {/* Status Badge */}
          <div className="absolute top-2 left-2">
            {memory.isPublishedToCommunity ? (
              <span className="bg-green-500/90 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Globe size={10} />
                已发布
              </span>
            ) : (
              <span className="bg-slate-500/90 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Lock size={10} />
                私密
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon (when no image) */}
          {!hasImages && (
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              memory.isPublishedToCommunity
                ? 'bg-linear-to-br from-green-500 to-emerald-500'
                : 'bg-linear-to-br from-slate-400 to-slate-500'
            }`}>
              <BookOpen size={24} className="text-white" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{memory.scheduleTitle}</span>
              {!hasImages && (
                memory.isPublishedToCommunity ? (
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full shrink-0">
                    已发布
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full shrink-0">
                    私密
                  </span>
                )
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
              {memory.contentPreview}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(memory.scheduleDate)}
              </span>
              <span className="flex items-center gap-1">
                <Heart size={12} className={memory.likeCount > 0 ? 'text-rose-500 dark:text-rose-400' : ''} />
                {memory.likeCount}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight size={20} className="text-slate-300 shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default MemoryListPage;
