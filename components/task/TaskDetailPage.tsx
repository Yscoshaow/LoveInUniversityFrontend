import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CampusTask, CampusTaskSummary, TaskComment, PostCommentRequest, TipTaskRequest, CampusTaskStatus, CommentReactionSummary } from '../../types';
import { campusTasksApi, stickerApi } from '../../lib/api';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { Player } from '@lottiefiles/react-lottie-player';
import { useUserProfileNavigation } from '../layout/MainLayout';
import { useCurrentUser } from '../../hooks/useUser';
import { useAuth } from '../../lib/auth-context';
import { useUpdateCampusTask, useDeleteCampusTask, campusTaskQueryKeys } from '../../hooks/useCampusTasks';
import { useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Coins,
  Gift,
  MessageSquare,
  Heart,
  ArrowLeft,
  Star,
  Send,
  MoreHorizontal,
  Loader2,
  Users,
  CheckCircle,
  AlertCircle,
  X,
  Reply,
  CornerDownRight,
  Image as ImageIcon,
  Plus,
  Trash2,
  Play,
  Pause,
  Check,
  UserX
} from 'lucide-react';

// Default avatar
const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
};

interface TaskDetailPageProps {
  task: CampusTaskSummary;
  onBack: () => void;
}

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({ task: taskSummary, onBack }) => {
  const { viewUserProfile } = useUserProfileNavigation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { hasPermission } = useAuth();
  const updateTaskMutation = useUpdateCampusTask();
  const deleteTaskMutation = useDeleteCampusTask();

  const [task, setTask] = useState<CampusTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Menu dropdown
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  // Comment input
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; parentId: number | null; userName: string } | null>(null);
  const [detailSheetComment, setDetailSheetComment] = useState<TaskComment | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitContent, setSubmitContent] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitImages, setSubmitImages] = useState<File[]>([]);
  const [submitImagePreviews, setSubmitImagePreviews] = useState<string[]>([]);

  // Tip
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(10);
  const [tipMessage, setTipMessage] = useState('');
  const [isTipping, setIsTipping] = useState(false);

  // Favorite
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Sticker reactions
  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null); // commentId
  const [activePackIndex, setActivePackIndex] = useState(0);

  // Check if current user can manage this task (creator or admin)
  const canManageTask = currentUser && task && (
    currentUser.id === task.creatorId || hasPermission('task.manage')
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle status change
  const handleStatusChange = async (newStatus: CampusTaskStatus) => {
    if (!task) return;
    setShowMenu(false);
    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        request: { status: newStatus }
      });
      setTask(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err: any) {
      setError(err.message || '更新状态失败');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!task) return;
    setShowDeleteConfirm(false);
    setShowMenu(false);
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
      onBack();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  // Fetch task detail
  const fetchTask = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await campusTasksApi.getTask(taskSummary.id);
      setTask(data);
      setIsFavorited(data.isFavorited);
      setError(null);
    } catch (err) {
      setError('加载任务详情失败');
      console.error('Failed to load task:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskSummary.id]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const data = await campusTasksApi.getComments(taskSummary.id);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [taskSummary.id]);

  useEffect(() => {
    fetchTask();
    fetchComments();
  }, [fetchTask, fetchComments]);

  // Toggle sticker reaction on a comment
  const startLongPress = (commentId: number, x: number, y: number) => {
    if (stickerPacks.length === 0) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      setShowStickerPicker(commentId);
      longPressTimer.current = null;
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
    }, 500);
  };

  const moveLongPress = (x: number, y: number) => {
    if (!longPressStartPos.current || !longPressTimer.current) return;
    const dx = x - longPressStartPos.current.x;
    const dy = y - longPressStartPos.current.y;
    if (dx * dx + dy * dy > 100) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStartPos.current = null;
  };

  const longPressHandlers = (commentId: number) => ({
    onTouchStart: (e: React.TouchEvent) => startLongPress(commentId, e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => e.touches[0] && moveLongPress(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: endLongPress,
    onMouseDown: (e: React.MouseEvent) => startLongPress(commentId, e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => moveLongPress(e.clientX, e.clientY),
    onMouseUp: endLongPress,
    onMouseLeave: endLongPress,
  });

  const handleToggleReaction = async (commentId: number, stickerId: number) => {
    try {
      const res = await stickerApi.toggleReaction(commentId, stickerId);
      // Update reactions in comments state
      const updateReactions = (commentList: TaskComment[]): TaskComment[] =>
        commentList.map(c => {
          const updated = { ...c };
          if (c.id === commentId) {
            updated.reactions = res.reactions;
          }
          if (c.replies?.length) {
            updated.replies = updateReactions(c.replies);
          }
          return updated;
        });
      setComments(prev => updateReactions(prev));
      // Also update detailSheetComment if open
      if (detailSheetComment) {
        setDetailSheetComment(prev => {
          if (!prev) return prev;
          if (prev.id === commentId) return { ...prev, reactions: res.reactions };
          if (prev.replies?.some(r => r.id === commentId)) {
            return {
              ...prev,
              replies: prev.replies.map(r => r.id === commentId ? { ...r, reactions: res.reactions } : r),
            };
          }
          return prev;
        });
      }
      setShowStickerPicker(null);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Post comment
  const handlePostComment = async () => {
    if (!commentText.trim()) return;

    // If in detail sheet and no explicit replyingTo, treat as replying to parent comment
    const effectiveReply = replyingTo ?? (detailSheetComment ? { id: detailSheetComment.id, parentId: null, userName: detailSheetComment.userName || '匿名' } : null);

    setIsSubmittingComment(true);
    try {
      const topLevelId = effectiveReply ? (effectiveReply.parentId ?? effectiveReply.id) : undefined;
      const request: PostCommentRequest = {
        content: commentText.trim(),
        parentId: topLevelId,
        replyToCommentId: effectiveReply?.parentId ? effectiveReply.id : undefined,
      };
      const newComment = await campusTasksApi.postComment(taskSummary.id, request);

      if (topLevelId) {
        // Add reply to the top-level comment
        setComments(prev => prev.map(comment => {
          if (comment.id === topLevelId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            };
          }
          return comment;
        }));
        // Also update detailSheetComment if open
        if (detailSheetComment?.id === topLevelId) {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: [...(prev.replies || []), newComment],
          } : null);
        }
      } else {
        // Add as top-level comment
        setComments(prev => [...prev, newComment]);
      }

      setCommentText('');
      setReplyingTo(null);
    } catch (err: any) {
      setError(err.message || '发表评论失败');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Cancel reply
  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  // Handle submit image selection
  const handleSubmitImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + submitImages.length > 3) {
      setError('最多只能上传3张图片');
      return;
    }

    const newImages = [...submitImages, ...files].slice(0, 3);
    setSubmitImages(newImages);

    // Generate previews
    const newPreviews: string[] = [];
    newImages.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === newImages.length) {
          setSubmitImagePreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSubmitImage = (index: number) => {
    setSubmitImages(prev => prev.filter((_, i) => i !== index));
    setSubmitImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Submit task
  const handleSubmitTask = async () => {
    setIsSubmitting(true);
    try {
      // Create submission
      const submission = await campusTasksApi.submitTask(taskSummary.id, { content: submitContent.trim() || undefined });

      // Upload images if any
      for (const image of submitImages) {
        try {
          await campusTasksApi.uploadSubmissionImage(submission.id, image);
        } catch (imgErr) {
          console.error('Failed to upload submission image:', imgErr);
        }
      }

      setShowSubmitModal(false);
      setSubmitContent('');
      setSubmitImages([]);
      setSubmitImagePreviews([]);
      // Refresh task to update hasSubmitted status
      fetchTask();
    } catch (err: any) {
      setError(err.message || '提交任务失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tip creator
  const handleTip = async () => {
    if (tipAmount <= 0) return;

    setIsTipping(true);
    try {
      const request: TipTaskRequest = { amount: tipAmount, message: tipMessage.trim() || undefined };
      await campusTasksApi.tipTask(taskSummary.id, request);
      setShowTipModal(false);
      setTipAmount(10);
      setTipMessage('');
      // Refresh task to update totalTips
      fetchTask();
    } catch (err: any) {
      setError(err.message || '打赏失败');
    } finally {
      setIsTipping(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    setIsTogglingFavorite(true);
    try {
      const result = await campusTasksApi.toggleFavorite(taskSummary.id);
      setIsFavorited(result.isFavorited);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400';
      case 'PAUSED': return 'bg-amber-500/20 text-amber-400 dark:text-amber-300';
      case 'COMPLETED': return 'bg-slate-500/20 text-slate-400 dark:text-slate-500';
      default: return 'bg-slate-500/20 text-slate-400 dark:text-slate-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '进行中';
      case 'PAUSED': return '已暂停';
      case 'COMPLETED': return '已完成';
      case 'DELETED': return '已删除';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-600 dark:text-slate-300">{error || '任务不存在'}</p>
        <button onClick={onBack} className="mt-4 text-secondary font-bold">返回</button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-slate-800 flex flex-col relative overflow-hidden lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Image Header */}
      <div className="h-56 relative bg-slate-900 shrink-0">
        {task.coverImageUrl ? (
          <img src={task.coverImageUrl} className="w-full h-full object-cover opacity-90" alt="detail" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <span className="text-slate-500 dark:text-slate-400 font-bold">暂无封面</span>
          </div>
        )}

        {/* Overlay Controls */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-8 flex justify-between items-center text-white">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/30 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Menu Button & Dropdown */}
          {canManageTask && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/30 transition-colors"
              >
                <MoreHorizontal size={20} />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden min-w-[160px] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Status Options */}
                  {task?.status !== 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange('ACTIVE')}
                      disabled={updateTaskMutation.isPending}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Play size={16} className="text-green-500 dark:text-green-400" />
                      <span>继续任务</span>
                    </button>
                  )}
                  {task?.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange('PAUSED')}
                      disabled={updateTaskMutation.isPending}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Pause size={16} className="text-amber-500 dark:text-amber-400" />
                      <span>暂停任务</span>
                    </button>
                  )}
                  {task?.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleStatusChange('COMPLETED')}
                      disabled={updateTaskMutation.isPending}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Check size={16} className="text-blue-500 dark:text-blue-400" />
                      <span>完成任务</span>
                    </button>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteTaskMutation.isPending}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    <span>删除任务</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Show menu button for non-managers (no functionality) */}
          {!canManageTask && (
            <button className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/30 transition-colors opacity-50">
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>

        {/* Status Tag */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/20 ${getStatusColor(task.status)}`}>
                  {getStatusText(task.status)}
                </span>
                <span className="text-white/80 text-xs flex items-center gap-1">
                  <Clock size={12} /> {formatRelativeTime(task.createdAt)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{task.title}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-28 lg:pb-8 -mt-4 bg-white dark:bg-slate-800 rounded-t-[32px] relative z-10">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Creator Profile */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {/* 匿名任务：显示匿名头像，不可点击 */}
            {task.isAnonymous ? (
              <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <UserX size={20} className="text-slate-400 dark:text-slate-500" />
              </div>
            ) : (
              <img
                src={task.creatorAvatar || DEFAULT_AVATAR}
                className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity"
                alt="creator"
                onClick={() => viewUserProfile(task.creatorId)}
              />
            )}
            <div>
              <h3 className={`text-sm font-bold ${task.isAnonymous ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                {task.isAnonymous ? '匿名用户' : (task.creatorName || '匿名用户')}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={10} /> {task.completedCount}{task.maxCompletions > 0 ? `/${task.maxCompletions}` : ''} 完成
                </span>
                {task.totalTips > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart size={10} /> {task.totalTips} 打赏
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* 匿名任务：隐藏联系按钮 */}
          {!task.isAnonymous && (
            <button
              onClick={() => viewUserProfile(task.creatorId)}
              className="text-secondary text-xs font-bold bg-secondary/10 px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-secondary/20 transition-colors"
            >
              <MessageSquare size={14} /> 联系TA
            </button>
          )}
        </div>

        {/* Reward Box */}
        <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 mb-6 flex justify-between items-center shadow-sm">
          <div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block mb-1">任务奖励</span>
            <div className="flex items-center gap-3">
              {task.rewardCampusPoints > 0 && (
                <span className="text-2xl font-bold tracking-tight text-amber-500 dark:text-amber-400 flex items-center gap-1">
                  <Coins size={20} /> {task.rewardCampusPoints}
                </span>
              )}
              {task.rewardItem && (
                <span className="text-lg font-bold text-purple-500 dark:text-purple-400 flex items-center gap-1">
                  <Gift size={18} /> {task.rewardItem.name} x{task.rewardItemQuantity}
                </span>
              )}
              {task.rewardCampusPoints === 0 && !task.rewardItem && (
                <span className="text-slate-400 dark:text-slate-500">无奖励</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowTipModal(true)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col items-center gap-1"
          >
            <Heart size={16} className="text-red-400" />
            <span className="text-[10px]">打赏</span>
          </button>
        </div>

        {/* My Submission Status */}
        {task.hasSubmitted && task.mySubmission && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-blue-500 dark:text-blue-400" />
              <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">你已提交此任务</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              状态: {task.mySubmission.status === 'PENDING' ? '待审核' :
                     task.mySubmission.status === 'APPROVED' ? '已通过' :
                     task.mySubmission.status === 'REJECTED' ? '已拒绝' : '已取消'}
              {task.mySubmission.rewardIssued && ' · 奖励已发放'}
            </p>
          </div>
        )}

        {/* Description */}
        <div className="mb-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 text-sm uppercase tracking-wider opacity-60">任务描述</h3>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            {task.description}
          </p>
        </div>

        {/* Comments Section */}
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-sm uppercase tracking-wider opacity-60">
            评论 ({comments.length})
          </h3>

          {isLoadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-4 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={comment.userAvatar || DEFAULT_AVATAR}
                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                    alt="u"
                    onClick={() => viewUserProfile(comment.userId)}
                  />
                  <div className="flex-1">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{comment.userName || '匿名'}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      {comment.isDeleted ? (
                        <span className="text-slate-400 dark:text-slate-500 italic">此评论已删除</span>
                      ) : (
                        <p className="whitespace-pre-line select-none" {...longPressHandlers(comment.id)}>{comment.content}</p>
                      )}
                    </div>
                    {/* Reactions + Reply */}
                    {!comment.isDeleted && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {comment.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(comment.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted
                                ? 'border-secondary/40 bg-secondary/10 text-secondary'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-secondary/30'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: comment.id, parentId: null, userName: comment.userName || '匿名' })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-secondary flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} />
                          回复
                        </button>
                      </div>
                    )}
                    {/* Reply Preview (max 3 inline) */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                        {comment.replies.slice(0, 3).map(reply => (
                          <div key={reply.id} className="text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{reply.userName || '匿名'}</span>
                            {reply.replyToUserName && (
                              <>
                                <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                                <span className="text-secondary">@{reply.replyToUserName}</span>
                              </>
                            )}
                            <span className="text-slate-300 mx-1">:</span>
                            {reply.isDeleted ? (
                              <span className="text-slate-400 dark:text-slate-500 italic">此回复已删除</span>
                            ) : (
                              <span>{reply.content}</span>
                            )}
                          </div>
                        ))}
                        {comment.replies.length > 3 && (
                          <button
                            onClick={() => setDetailSheetComment(comment)}
                            className="text-[11px] text-secondary hover:text-secondary/80 flex items-center gap-0.5 transition-colors"
                          >
                            共{comment.replies.length}条回复 &gt;
                          </button>
                        )}
                        {comment.replies.length <= 3 && comment.replies.length > 0 && (
                          <button
                            onClick={() => setDetailSheetComment(comment)}
                            className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-secondary flex items-center gap-0.5 transition-colors"
                          >
                            查看全部回复
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-8">暂无评论</p>
          )}

          {/* Add Comment Input */}
          <div className="space-y-2">
            {/* Reply indicator */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-secondary/10 text-secondary px-3 py-2 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <CornerDownRight size={12} />
                  <span>回复 <strong>{replyingTo.userName}</strong></span>
                </div>
                <button
                  onClick={handleCancelReply}
                  className="p-1 hover:bg-secondary/20 rounded-full transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : "发表评论..."}
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
              />
              <button
                onClick={handlePostComment}
                disabled={isSubmittingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-secondary text-white rounded-full disabled:opacity-50"
              >
                {isSubmittingComment ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-4 pb-6 flex items-center gap-4 z-20">
        <button
          onClick={handleToggleFavorite}
          disabled={isTogglingFavorite}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
            isFavorited
              ? 'bg-amber-100 text-amber-500 dark:text-amber-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950'
          }`}
        >
          {isTogglingFavorite ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <Star size={24} className={isFavorited ? 'fill-amber-500' : ''} />
          )}
        </button>
        <button
          onClick={() => setShowSubmitModal(true)}
          disabled={task.status !== 'ACTIVE' || task.hasSubmitted}
          className={`flex-1 font-bold h-12 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${
            task.status === 'ACTIVE' && !task.hasSubmitted
              ? 'bg-slate-900 text-white shadow-slate-900/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {task.hasSubmitted ? '已提交' : task.status === 'ACTIVE' ? '提交任务' : '任务已结束'}
        </button>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-[90%] max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">提交任务</h3>

            {/* Description Input */}
            <textarea
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              placeholder="说明你的完成情况（可选）"
              className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none mb-4"
            />

            {/* Image Upload Section */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <ImageIcon size={12} />
                上传图片（可选，最多3张）
              </label>

              <div className="flex gap-2 flex-wrap">
                {/* Image Previews */}
                {submitImagePreviews.map((preview, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeSubmitImage(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* Add Image Button */}
                {submitImages.length < 3 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-secondary hover:bg-secondary/5 transition-colors">
                    <Plus size={20} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">添加</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSubmitImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  setSubmitContent('');
                  setSubmitImages([]);
                  setSubmitImagePreviews([]);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
              >
                取消
              </button>
              <button
                onClick={handleSubmitTask}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {submitImages.length > 0 ? '上传中...' : '提交中...'}
                  </>
                ) : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-[90%] max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">打赏创作者</h3>
            <div className="mb-4">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">打赏金额（校园点数）</label>
              <div className="flex gap-2">
                {[10, 50, 100, 200].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                      tipAmount === amount
                        ? 'bg-amber-100 text-amber-600 dark:text-amber-400 border-2 border-amber-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={tipMessage}
              onChange={(e) => setTipMessage(e.target.value)}
              placeholder="留言（可选）"
              className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowTipModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
              >
                取消
              </button>
              <button
                onClick={handleTip}
                disabled={isTipping || tipAmount <= 0}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2"
              >
                {isTipping ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    <Heart size={16} /> 打赏 {tipAmount}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                删除后将无法恢复，确定要删除这个任务吗？
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTaskMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold flex items-center justify-center gap-2"
              >
                {deleteTaskMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  '确认删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Detail Sheet (B站-style full overlay) */}
      {detailSheetComment && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <button
              onClick={() => {
                setDetailSheetComment(null);
                setReplyingTo(null);
                setCommentText('');
              }}
              className="p-1"
            >
              <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
              评论详情 ({(detailSheetComment.replies?.length || 0) + 1})
            </span>
            <div className="w-7" />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
            {/* Parent Comment */}
            <div className="flex gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <img
                src={detailSheetComment.userAvatar || DEFAULT_AVATAR}
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                alt="u"
                onClick={() => viewUserProfile(detailSheetComment.userId)}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{detailSheetComment.userName || '匿名'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detailSheetComment.createdAt)}</span>
                </div>
                {detailSheetComment.isDeleted ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">此评论已删除</span>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(detailSheetComment.id)}>{detailSheetComment.content}</p>
                )}
                {!detailSheetComment.isDeleted && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {detailSheetComment.reactions?.map(r => (
                      <button
                        key={r.stickerId}
                        onClick={() => handleToggleReaction(detailSheetComment.id, r.stickerId)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                          r.hasReacted
                            ? 'border-secondary/40 bg-secondary/10 text-secondary'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-secondary/30'
                        }`}
                      >
                        <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                        <span>{r.count}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setReplyingTo({ id: detailSheetComment.id, parentId: null, userName: detailSheetComment.userName || '匿名' })}
                      className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-secondary flex items-center gap-1 transition-colors ml-1"
                    >
                      <Reply size={10} /> 回复
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* All Replies */}
            <div className="space-y-3">
              {detailSheetComment.replies?.map(reply => (
                <div key={reply.id} className="flex gap-3">
                  <img
                    src={reply.userAvatar || DEFAULT_AVATAR}
                    className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                    alt="u"
                    onClick={() => viewUserProfile(reply.userId)}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{reply.userName || '匿名'}</span>
                        {reply.replyToUserName && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                            <span className="text-secondary">@{reply.replyToUserName}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                    </div>
                    {reply.isDeleted ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">此回复已删除</span>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(reply.id)}>{reply.content}</p>
                    )}
                    {!reply.isDeleted && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {reply.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(reply.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted
                                ? 'border-secondary/40 bg-secondary/10 text-secondary'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-secondary/30'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: reply.id, parentId: detailSheetComment.id, userName: reply.userName || '匿名' })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-secondary flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} /> 回复
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Reply Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 pb-6 space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-secondary/10 text-secondary px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1.5">
                  <CornerDownRight size={11} />
                  <span>回复 <strong>{replyingTo.userName}</strong></span>
                </div>
                <button onClick={handleCancelReply} className="p-0.5 hover:bg-secondary/20 rounded-full transition-colors">
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : `回复 ${detailSheetComment.userName || '匿名'}...`}
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
              />
              <button
                onClick={handlePostComment}
                disabled={isSubmittingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-secondary text-white rounded-full disabled:opacity-50"
              >
                {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticker Picker Overlay */}
      {showStickerPicker !== null && stickerPacks.length > 0 && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center"
          onClick={() => setShowStickerPicker(null)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl max-h-[40vh] flex flex-col animate-in slide-in-from-bottom duration-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Pack Tabs */}
            <div className="flex items-center gap-1.5 px-3 pb-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
              {stickerPacks.map((pack, idx) => (
                <button
                  key={pack.id}
                  onClick={() => setActivePackIndex(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    activePackIndex === idx
                      ? 'bg-secondary text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {pack.stickers[0] && (
                    <Player src={pack.stickers[0].fileUrl} style={{ width: 14, height: 14, pointerEvents: 'none' }} />
                  )}
                  {pack.name}
                </button>
              ))}
            </div>

            {/* Sticker Grid */}
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {stickerPacks[activePackIndex]?.stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => handleToggleReaction(showStickerPicker!, sticker.id)}
                    className="aspect-square rounded-xl hover:bg-secondary/10 p-1.5 transition-all active:scale-90"
                  >
                    <Player
                      src={sticker.fileUrl}
                      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                    />
                  </button>
                ))}
              </div>
              {(!stickerPacks[activePackIndex]?.stickers.length) && (
                <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-6">此贴纸组暂无贴纸</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
