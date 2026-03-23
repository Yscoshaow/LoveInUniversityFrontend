import React, { useState } from 'react';
import { useMemoryDetail, useToggleMemoryLike, useDeleteMemory, usePublishMemoryToCommunity, useUnpublishMemoryFromCommunity } from '../../hooks/useMemory';
import { InviteToMemoryModal } from '../features/InviteToMemoryModal';
import type { MemoryDetail } from '../../types';
import {
  ArrowLeft, Heart, Eye, Globe, Lock, Calendar, Clock, MapPin,
  Loader2, AlertCircle, Users, Share2, Trash2, Edit, ChevronLeft, ChevronRight, UserPlus, Upload, X
} from 'lucide-react';

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format time
const formatTime = (timeString: string): string => {
  // timeString format: HH:mm:ss or HH:mm
  const parts = timeString.split(':');
  return `${parts[0]}:${parts[1]}`;
};

// Format datetime
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface MemoryDetailPageProps {
  memoryId: number;
  onBack: () => void;
  onEdit?: (memory: MemoryDetail) => void;
}

export const MemoryDetailPage: React.FC<MemoryDetailPageProps> = ({
  memoryId,
  onBack,
  onEdit
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const { data: memory, isLoading, error, refetch } = useMemoryDetail(memoryId);
  const toggleLikeMutation = useToggleMemoryLike();
  const deleteMutation = useDeleteMemory();
  const publishMutation = usePublishMemoryToCommunity();
  const unpublishMutation = useUnpublishMemoryFromCommunity();

  const handleToggleLike = () => {
    if (memory) {
      toggleLikeMutation.mutate(memory.id);
    }
  };

  const handleDelete = async () => {
    if (memory) {
      try {
        await deleteMutation.mutateAsync(memory.id);
        onBack();
      } catch {
        // Error handled by mutation
      }
    }
  };

  const nextImage = () => {
    if (memory && memory.imageUrls.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % memory.imageUrls.length);
    }
  };

  const prevImage = () => {
    if (memory && memory.imageUrls.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + memory.imageUrls.length) % memory.imageUrls.length);
    }
  };

  const handlePublish = async () => {
    if (memory) {
      try {
        await publishMutation.mutateAsync(memory.id);
        setShowPublishConfirm(false);
        refetch();
      } catch {
        // Error handled by mutation
      }
    }
  };

  const handleUnpublish = async () => {
    if (memory) {
      try {
        await unpublishMutation.mutateAsync(memory.id);
        setShowPublishConfirm(false);
        refetch();
      } catch {
        // Error handled by mutation
      }
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col">
        <div className="p-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
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
      </div>
    );
  }

  const hasImages = memory.imageUrls && memory.imageUrls.length > 0;

  return (
    <div className="h-full bg-white dark:bg-slate-800 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header with gradient */}
      <div className={`relative shrink-0 ${hasImages ? 'h-64' : 'h-48'} bg-gradient-to-br from-indigo-500 to-purple-600`}>
        {/* Image Gallery */}
        {hasImages ? (
          <>
            <img
              src={memory.imageUrls[currentImageIndex]}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Image Navigation */}
            {memory.imageUrls.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Image Indicators */}
                <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
                  {memory.imageUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentImageIndex ? 'bg-white dark:bg-slate-800 w-4' : 'bg-white/50 dark:bg-slate-800/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/20 dark:bg-slate-800/20 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-white/10 dark:bg-slate-800/10 blur-3xl" />
          </div>
        )}

        {/* Back Button */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-8 z-20">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Creator Actions (if creator) */}
        {memory.isCreator && (
          <div className="absolute top-0 right-0 p-4 pt-8 z-20 flex gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95"
            >
              <UserPlus size={18} />
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(memory)}
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95"
              >
                <Edit size={18} />
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500/80 transition-colors active:scale-95"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}

        {/* Schedule Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            {memory.isPublishedToCommunity ? (
              <span className="bg-green-500/90 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Globe size={10} />
                已发布到社区
              </span>
            ) : (
              <span className="bg-white/30 dark:bg-slate-800/30 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Lock size={10} />
                私密回忆
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">{memory.schedule.title}</h1>
          <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(memory.schedule.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatTime(memory.schedule.startTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar -mt-4 bg-white dark:bg-slate-800 rounded-t-[32px] relative z-10">
        <div className="p-6 space-y-6">
          {/* Creator Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              {memory.creatorAvatar ? (
                <img src={memory.creatorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white font-bold">
                  {memory.creatorName.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-800 dark:text-slate-100">{memory.creatorName}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(memory.createdAt)}</div>
            </div>
          </div>

          {/* Memory Content */}
          <div className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {memory.content}
          </div>

          {/* Schedule Location (if available) */}
          {memory.schedule.location && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MapPin size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-slate-500">地点</div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{memory.schedule.location}</div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between py-4 border-t border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-6">
              <button
                onClick={handleToggleLike}
                disabled={toggleLikeMutation.isPending}
                className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:text-rose-400 transition-colors disabled:opacity-50"
              >
                <Heart
                  size={20}
                  className={memory.isLikedByMe ? 'fill-rose-500 text-rose-500 dark:text-rose-400' : ''}
                />
                <span className={`text-sm font-medium ${memory.isLikedByMe ? 'text-rose-500 dark:text-rose-400' : ''}`}>
                  {memory.likeCount}
                </span>
              </button>
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <Eye size={20} />
                <span className="text-sm">{memory.viewCount}</span>
              </div>
            </div>

            {/* Publish to Community Button (only for creator) */}
            {memory.isCreator && (
              <button
                onClick={() => setShowPublishConfirm(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  memory.isPublishedToCommunity
                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                <Globe size={14} />
                {memory.isPublishedToCommunity ? '已发布' : '发布到社区'}
              </button>
            )}
          </div>

          {/* Invited Users (only for creator) */}
          {memory.isCreator && memory.invitedUsers && memory.invitedUsers.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Users size={16} />
                已邀请查看 ({memory.invitedUsers.length})
              </h3>
              <div className="space-y-2">
                {memory.invitedUsers.map(user => (
                  <div key={user.userId} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      {user.userAvatar ? (
                        <img src={user.userAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold">
                          {user.userName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{user.userName}</div>
                      {user.viewedAt && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          已查看 · {formatDateTime(user.viewedAt)}
                        </div>
                      )}
                    </div>
                    {user.viewedAt ? (
                      <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-full">已查看</span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">待查看</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">确定要删除这个回忆吗？此操作无法撤销。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  '删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite to Memory Modal */}
      {showInviteModal && memory && (
        <InviteToMemoryModal
          memoryId={memory.id}
          memoryTitle={memory.schedule.title}
          invitedUsers={memory.invitedUsers}
          onClose={() => setShowInviteModal(false)}
          onUpdated={() => refetch()}
        />
      )}

      {/* Publish Confirmation Modal */}
      {showPublishConfirm && memory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              {memory.isPublishedToCommunity ? '取消发布' : '发布到社区'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {memory.isPublishedToCommunity
                ? '确定要从社区取消发布这个回忆吗？'
                : '发布后，所有社区成员都可以看到这个回忆及其关联的日程信息。'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={memory.isPublishedToCommunity ? handleUnpublish : handlePublish}
                disabled={publishMutation.isPending || unpublishMutation.isPending}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                  memory.isPublishedToCommunity
                    ? 'bg-slate-500 text-white hover:bg-slate-600'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {publishMutation.isPending || unpublishMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : memory.isPublishedToCommunity ? (
                  '取消发布'
                ) : (
                  '确认发布'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryDetailPage;
