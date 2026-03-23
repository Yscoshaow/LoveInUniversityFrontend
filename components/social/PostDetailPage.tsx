'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PostDetail,
  PostCommentItem,
  POST_CATEGORY_NAMES,
  CreatePostCommentRequest,
  PollDetail,
  PollOptionDetail,
  CommentReactionSummary,
  FollowUserItem,
} from '../../types';
import { postsApi, stickerApi, followApi } from '../../lib/api';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { Player } from '@lottiefiles/react-lottie-player';
import { useAuth } from '../../lib/auth-context';
import {
  ArrowLeft,
  Heart,
  Eye,
  MessageSquare,
  Send,
  Trash2,
  Pin,
  Loader2,
  X,
  MoreHorizontal,
  Image as ImageIcon,
  AtSign,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  BarChart2,
  Check,
  Users,
  UserX,
  Reply,
  CornerDownRight,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

interface PostDetailPageProps {
  postId: number;
  onBack?: () => void;
  onUserClick?: (userId: number) => void;
}

// Default avatar
const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  HELP: 'bg-orange-100 text-orange-600 dark:text-orange-400',
  SHARE: 'bg-blue-100 text-blue-600 dark:text-blue-400',
  EXPERIENCE: 'bg-green-100 text-green-600 dark:text-green-400',
  QUESTION: 'bg-purple-100 text-purple-600 dark:text-purple-400',
  ANNOUNCEMENT: 'bg-red-100 text-red-600 dark:text-red-400',
};

// Format schedule date
const formatScheduleDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
};

// Format schedule time
const formatScheduleTime = (startTime: string, endTime?: string | null): string => {
  const start = startTime.slice(0, 5);
  if (endTime) {
    const end = endTime.slice(0, 5);
    return `${start} - ${end}`;
  }
  return start;
};

// Schedule type icons and colors
const SCHEDULE_TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  CLASS: { icon: '📚', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100' },
  EXAM: { icon: '📝', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100' },
  MEETING: { icon: '👥', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100' },
  APPOINTMENT: { icon: '🤝', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100' },
  REMINDER: { icon: '⏰', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100' },
  OTHER: { icon: '📌', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700' },
};

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
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

export const PostDetailPage: React.FC<PostDetailPageProps> = ({
  postId,
  onBack,
  onUserClick,
}) => {
  // Get current user info
  const { user, hasPermission } = useAuth();
  const confirm = useConfirm();
  const isAdmin = hasPermission('comment.moderate');

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<PostCommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment input state
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: number; parentId: number | null; name: string } | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [detailSheetComment, setDetailSheetComment] = useState<PostCommentItem | null>(null);

  // @Mention state
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [followingUsers, setFollowingUsers] = useState<FollowUserItem[]>([]);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Comment image upload state
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [commentImageKey, setCommentImageKey] = useState<string | null>(null);
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

  // Image viewer state
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);

  // Poll voting state
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  // Sticker reaction state
  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  // Fetch post detail
  const fetchPost = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await postsApi.getPost(postId);
      setPost(data);
    } catch (err) {
      setError('加载帖子失败');
      console.error('Failed to fetch post:', err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const response = await postsApi.getComments(postId, 100);
      setComments(response.comments);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [fetchPost, fetchComments]);

  // Toggle like
  const handleToggleLike = async () => {
    if (!post) return;
    try {
      await postsApi.toggleLike(post.id);
      setPost(prev => prev ? {
        ...prev,
        isLikedByMe: !prev.isLikedByMe,
        likeCount: prev.likeCount + (prev.isLikedByMe ? -1 : 1)
      } : null);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Fetch following users for @mention
  const fetchFollowingUsers = useCallback(async () => {
    try {
      const users = await followApi.getQuickSelect(50);
      setFollowingUsers(users);
    } catch (err) {
      console.error('Failed to fetch following users:', err);
    }
  }, []);

  // Handle @ input detection
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentText(value);

    // Detect @ trigger: find the last @ before cursor that's not part of an existing mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\[\]]*)$/);
    if (atMatch && !textBeforeCursor.match(/@\[[^\]]*$/)) {
      setMentionFilter(atMatch[1]);
      setMentionCursorPos(cursorPos);
      if (!showMentionPopup) {
        setShowMentionPopup(true);
        if (followingUsers.length === 0) fetchFollowingUsers();
      }
    } else {
      setShowMentionPopup(false);
    }
  };

  // Select a user from mention popup
  const handleSelectMention = (user: FollowUserItem) => {
    const displayName = user.firstName + (user.lastName ? ` ${user.lastName}` : '');
    // Find the @ position before cursor
    const textBeforeCursor = commentText.substring(0, mentionCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const before = commentText.substring(0, atIndex);
    const after = commentText.substring(mentionCursorPos);
    const mentionText = `@[${displayName}](${user.id}) `;
    const newText = before + mentionText + after;

    setCommentText(newText);
    if (!mentionedUserIds.includes(user.id)) {
      setMentionedUserIds(prev => [...prev, user.id]);
    }
    setShowMentionPopup(false);
    setMentionFilter('');

    // Refocus input
    setTimeout(() => {
      commentInputRef.current?.focus();
      const newCursorPos = before.length + mentionText.length;
      commentInputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle comment image upload
  const handleCommentImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setCommentImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setIsUploadingCommentImage(true);
    try {
      const result = await postsApi.uploadImages([file]);
      if (result.imageKeys.length > 0) {
        setCommentImageKey(result.imageKeys[0]);
      }
    } catch (err) {
      console.error('Failed to upload comment image:', err);
      setCommentImagePreview(null);
    } finally {
      setIsUploadingCommentImage(false);
      e.target.value = '';
    }
  };

  const removeCommentImage = () => {
    setCommentImagePreview(null);
    setCommentImageKey(null);
  };

  // Submit comment
  const handleSubmitComment = async () => {
    if ((!commentText.trim() && !commentImageKey) || !post) return;

    // If in detail sheet and no explicit replyingTo, treat as replying to parent
    const effectiveReply = replyingTo ?? (detailSheetComment ? { id: detailSheetComment.id, parentId: null, name: detailSheetComment.authorName } : null);

    setIsSubmittingComment(true);
    try {
      const topLevelId = effectiveReply ? (effectiveReply.parentId ?? effectiveReply.id) : undefined;
      const request: CreatePostCommentRequest = {
        content: commentText.trim(),
        parentId: topLevelId,
        replyToCommentId: effectiveReply?.parentId ? effectiveReply.id : undefined,
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
        imageUrl: commentImageKey || undefined,
      };
      const newComment = await postsApi.createComment(post.id, request);

      // Add to comments list
      if (topLevelId) {
        setComments(prev => prev.map(c =>
          c.id === topLevelId
            ? { ...c, replies: [...(c.replies || []), newComment] }
            : c
        ));
        // Also update detailSheetComment if open
        if (detailSheetComment?.id === topLevelId) {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: [...(prev.replies || []), newComment],
          } : null);
        }
      } else {
        setComments(prev => [...prev, { ...newComment, replies: [] }]);
      }

      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
      setCommentText('');
      setReplyingTo(null);
      setMentionedUserIds([]);
      setCommentImagePreview(null);
      setCommentImageKey(null);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: number, parentId?: number | null) => {
    if (!post || !(await confirm({ title: '确认删除', description: '确定要删除这条评论吗？', destructive: true }))) return;

    try {
      await postsApi.deleteComment(post.id, commentId);
      if (parentId) {
        // Remove reply
        setComments(prev => prev.map(c =>
          c.id === parentId
            ? { ...c, replies: c.replies?.filter(r => r.id !== commentId) || [] }
            : c
        ));
      } else {
        // Remove top-level comment
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount - 1 } : null);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Toggle comment like
  const handleToggleCommentLike = async (commentId: number, parentId?: number | null) => {
    if (!post) return;
    try {
      await postsApi.toggleCommentLike(post.id, commentId);

      const updateComment = (comment: PostCommentItem): PostCommentItem => {
        if (comment.id === commentId) {
          return {
            ...comment,
            isLikedByMe: !comment.isLikedByMe,
            likeCount: comment.likeCount + (comment.isLikedByMe ? -1 : 1)
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(updateComment)
          };
        }
        return comment;
      };

      setComments(prev => prev.map(updateComment));
    } catch (err) {
      console.error('Failed to toggle comment like:', err);
    }
  };

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

  // Toggle sticker reaction on a comment
  const handleToggleReaction = async (commentId: number, stickerId: number) => {
    try {
      const res = await stickerApi.togglePostReaction(commentId, stickerId);
      const updateReactions = (list: PostCommentItem[]): PostCommentItem[] =>
        list.map(c => {
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
        if (detailSheetComment.id === commentId) {
          setDetailSheetComment(prev => prev ? { ...prev, reactions: res.reactions } : null);
        } else {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: prev.replies?.map(r => r.id === commentId ? { ...r, reactions: res.reactions } : r) || null,
          } : null);
        }
      }
      setShowStickerPicker(null);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!post || !(await confirm({ title: '确认删除', description: '确定要删除这篇帖子吗？', destructive: true }))) return;
    try {
      await postsApi.deletePost(post.id);
      onBack?.();
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Toggle poll option selection
  const handleToggleOption = (optionId: number) => {
    if (!post?.poll) return;

    if (post.poll.hasVoted || post.poll.isEnded) return;

    if (post.poll.selectionType === 'SINGLE') {
      setSelectedOptions([optionId]);
    } else {
      // Multiple selection
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else if (selectedOptions.length < post.poll.maxSelections) {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };

  // Submit vote
  const handleVote = async () => {
    if (!post?.poll || selectedOptions.length === 0) return;

    setIsVoting(true);
    try {
      const updatedPoll = await postsApi.vote(post.id, selectedOptions);
      setPost(prev => prev ? { ...prev, poll: updatedPoll } : null);
      setSelectedOptions([]);
    } catch (err: any) {
      toast.error(err.message || '投票失败');
      console.error('Failed to vote:', err);
    } finally {
      setIsVoting(false);
    }
  };

  // Cancel vote
  const handleCancelVote = async () => {
    if (!post?.poll || !post.poll.hasVoted) return;
    if (!(await confirm({ title: '确认操作', description: '确定要取消投票吗？', destructive: true }))) return;

    setIsVoting(true);
    try {
      const updatedPoll = await postsApi.cancelVote(post.id);
      setPost(prev => prev ? { ...prev, poll: updatedPoll } : null);
    } catch (err: any) {
      toast.error(err.message || '取消投票失败');
      console.error('Failed to cancel vote:', err);
    } finally {
      setIsVoting(false);
    }
  };

  // Image viewer
  const renderImageViewer = () => {
    if (viewingImageIndex === null || !post) return null;

    const images = post.imageUrls;
    const currentImage = images[viewingImageIndex];

    return (
      <div
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onClick={() => setViewingImageIndex(null)}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          onClick={() => setViewingImageIndex(null)}
        >
          <X size={28} />
        </button>

        {/* Image counter */}
        <div className="absolute top-4 left-4 text-white/80 text-sm">
          {viewingImageIndex + 1} / {images.length}
        </div>

        {/* Previous button */}
        {viewingImageIndex > 0 && (
          <button
            className="absolute left-4 p-2 text-white/80 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setViewingImageIndex(prev => prev !== null ? prev - 1 : null);
            }}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* Image */}
        <img
          src={currentImage}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
          alt=""
        />

        {/* Next button */}
        {viewingImageIndex < images.length - 1 && (
          <button
            className="absolute right-4 p-2 text-white/80 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setViewingImageIndex(prev => prev !== null ? prev + 1 : null);
            }}
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>
    );
  };

  // Render comment item (bilibili-style, top-level only)
  // Render comment content with @mention highlights
  const renderCommentContent = (content: string) => {
    const mentionRegex = /@\[([^\]]+)]\((\d+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Text before mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      // Mention link
      const name = match[1];
      const userId = parseInt(match[2]);
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="text-primary cursor-pointer font-medium"
          onClick={(e) => { e.stopPropagation(); onUserClick?.(userId); }}
        >
          @{name}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const renderComment = (comment: PostCommentItem) => {
    const isAnonymousComment = comment.authorName === '匿名用户';

    return (
    <div key={comment.id} className="flex gap-3">
      {isAnonymousComment ? (
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <UserX size={16} className="text-slate-400 dark:text-slate-500" />
        </div>
      ) : (
        <img
          src={comment.authorAvatar || DEFAULT_AVATAR}
          className="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer"
          onClick={() => onUserClick?.(comment.authorId)}
          alt=""
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isAnonymousComment ? (
            <span className="font-medium text-sm text-slate-500 dark:text-slate-400">匿名用户</span>
          ) : (
            <span className="font-medium text-sm cursor-pointer hover:text-primary" onClick={() => onUserClick?.(comment.authorId)}>
              {comment.authorName}
            </span>
          )}
          {!isAnonymousComment && <span className="text-xs text-slate-400 dark:text-slate-500">Lv.{comment.authorLevel}</span>}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">{formatRelativeTime(comment.createdAt)}</span>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap select-none" {...longPressHandlers(comment.id)}>{renderCommentContent(comment.content)}</p>

        {comment.imageUrl && (
          <img src={comment.imageUrl} className="mt-2 max-w-[200px] rounded-lg cursor-pointer" onClick={() => window.open(comment.imageUrl!, '_blank')} alt="" />
        )}

        {/* Reactions + Actions */}
        {!comment.isAuthor || true ? (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {comment.reactions?.map(r => (
              <button key={r.stickerId} onClick={() => handleToggleReaction(comment.id, r.stickerId)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                  r.hasReacted ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-primary/30'
                }`}>
                <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                <span>{r.count}</span>
              </button>
            ))}
            <button onClick={() => handleToggleCommentLike(comment.id)}
              className={`flex items-center gap-0.5 text-[10px] ml-1 ${comment.isLikedByMe ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
              <Heart size={11} fill={comment.isLikedByMe ? 'currentColor' : 'none'} />
              {comment.likeCount > 0 && comment.likeCount}
            </button>
            <button onClick={() => setReplyingTo({ id: comment.id, parentId: null, name: comment.authorName })}
              className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-primary flex items-center gap-1 transition-colors ml-1">
              <MessageSquare size={10} /> 回复
            </button>
            {(comment.isAuthor || isAdmin) && (
              <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 ml-1">
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ) : null}

        {/* Reply Preview (max 3 inline, bilibili-style) */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
            {comment.replies.slice(0, 3).map(reply => (
              <div key={reply.id} className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-700 dark:text-slate-200">{reply.authorName}</span>
                {reply.replyToName && (
                  <>
                    <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                    <span className="text-primary">@{reply.replyToName}</span>
                  </>
                )}
                <span className="text-slate-300 mx-1">:</span>
                <span>{renderCommentContent(reply.content)}</span>
              </div>
            ))}
            {comment.replies.length > 3 ? (
              <button onClick={() => setDetailSheetComment(comment)}
                className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors">
                共{comment.replies.length}条回复 &gt;
              </button>
            ) : (
              <button onClick={() => setDetailSheetComment(comment)}
                className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-primary flex items-center gap-0.5 transition-colors">
                查看全部回复
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
  };

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-slate-800 flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-8 w-8" />
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-5 w-20" />
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 space-y-4">
          {/* Author row skeleton */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-11 w-11 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-28" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16" />
            </div>
          </div>
          {/* Post content skeleton */}
          <div className="space-y-2">
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-full" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-3/4" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-1/2" />
          </div>
          {/* Action bar skeleton */}
          <div className="flex gap-6 pt-2">
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-12" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-12" />
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-12" />
          </div>
        </div>
        {/* Comments skeleton */}
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-8 w-8 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-20" />
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
          <button onClick={onBack} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold">帖子详情</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">{error || '帖子不存在'}</p>
            <button onClick={onBack} className="text-primary font-medium">
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1">
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold">帖子详情</span>
        </div>
        {(post.isAuthor || isAdmin) && (
          <button
            onClick={handleDeletePost}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800">
          {/* Author info */}
          <div className="p-4 pb-0">
            <div className="flex items-center gap-3">
              {/* 匿名帖子：显示匿名头像，不可点击 */}
              {post.isAnonymous ? (
                <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <UserX size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
              ) : (
                <img
                  src={post.authorAvatar || DEFAULT_AVATAR}
                  className="w-11 h-11 rounded-full object-cover cursor-pointer"
                  onClick={() => onUserClick?.(post.authorId)}
                  alt=""
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {/* 匿名帖子：显示"匿名用户"，不可点击 */}
                  {post.isAnonymous ? (
                    <span className="font-semibold text-slate-500 dark:text-slate-400">匿名用户</span>
                  ) : (
                    <span
                      className="font-semibold cursor-pointer hover:text-primary"
                      onClick={() => onUserClick?.(post.authorId)}
                    >
                      {post.authorName}
                    </span>
                  )}
                  {!post.isAnonymous && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      Lv.{post.authorLevel}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(post.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Post content */}
          <div className="p-4">
            {/* Category & Pin */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.GENERAL}`}>
                {POST_CATEGORY_NAMES[post.category]}
              </span>
              {post.isPinned && (
                <span className="flex items-center gap-1 text-xs text-orange-500 dark:text-orange-400">
                  <Pin size={12} />
                  置顶
                </span>
              )}
              {/* Source type badge */}
              {post.sourceType && post.sourceType !== 'NONE' && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  post.sourceType === 'SCHEDULE' ? 'bg-primary/10 text-primary' : 'bg-pink-100 text-pink-600 dark:text-pink-400'
                }`}>
                  {post.sourceType === 'SCHEDULE' ? '📅 日程' : '📸 回忆'}
                </span>
              )}
            </div>

            {/* Source Data Card - Schedule */}
            {post.sourceData?.schedule && (
              <div className="mb-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Schedule type icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      SCHEDULE_TYPE_CONFIG[post.sourceData.schedule.type]?.bg || 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      {SCHEDULE_TYPE_CONFIG[post.sourceData.schedule.type]?.icon || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{post.sourceData.schedule.title}</h4>
                        {post.sourceData.schedule.isShared && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-600 dark:text-green-400 font-medium">共享</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatScheduleDate(post.sourceData.schedule.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatScheduleTime(post.sourceData.schedule.startTime, post.sourceData.schedule.endTime)}
                        </span>
                      </div>
                      {post.sourceData.schedule.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <MapPin size={12} />
                          {post.sourceData.schedule.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Title - Hide for schedule posts (schedule card already shows title) */}
            {post.sourceType !== 'SCHEDULE' && (
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{post.title}</h1>
            )}

            {/* Content - For schedule posts, only show if there's custom description */}
            {(post.sourceType !== 'SCHEDULE' || (post.content && post.content.trim())) && (
              <article className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-li:my-0.5 prose-img:rounded-lg prose-a:text-primary mb-4">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {post.content}
                </Markdown>
              </article>
            )}

            {/* Images */}
            {post.imageUrls.length > 0 && (
              <div className={`grid gap-2 mb-4 ${
                post.imageUrls.length === 1 ? 'grid-cols-1' :
                post.imageUrls.length === 2 ? 'grid-cols-2' :
                post.imageUrls.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
              }`}>
                {post.imageUrls.map((url, i) => (
                  <div
                    key={i}
                    className={`${
                      post.imageUrls.length === 1 ? 'aspect-auto max-h-80' : 'aspect-square'
                    } rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 cursor-pointer`}
                    onClick={() => setViewingImageIndex(i)}
                  >
                    <img
                      src={url}
                      className={`w-full h-full ${post.imageUrls.length === 1 ? 'object-contain' : 'object-cover'}`}
                      alt=""
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Poll */}
            {post.hasPoll && post.poll && (
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-2xl">
                {/* Poll header */}
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={18} className="text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-100">投票</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                    {post.poll.pollType === 'ANONYMOUS' && (
                      <span className="flex items-center gap-1">
                        <UserX size={12} />
                        匿名投票
                      </span>
                    )}
                  </span>
                </div>

                {/* Poll info */}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <span>{post.poll.totalVotes}人参与</span>
                  <span>
                    {post.poll.selectionType === 'SINGLE' ? '单选' : `多选（最多${post.poll.maxSelections}项）`}
                  </span>
                  {post.poll.isEnded && (
                    <span className="text-red-500 dark:text-red-400">已结束</span>
                  )}
                  {post.poll.endTime && !post.poll.isEnded && (
                    <span>截止: {new Date(post.poll.endTime).toLocaleString('zh-CN')}</span>
                  )}
                </div>

                {/* Poll options */}
                <div className="space-y-2">
                  {post.poll.options.map((option) => {
                    const isSelected = selectedOptions.includes(option.id);
                    const isVoted = option.isVotedByMe;
                    const showResults = post.poll!.hasVoted || post.poll!.isEnded;

                    return (
                      <div
                        key={option.id}
                        onClick={() => handleToggleOption(option.id)}
                        className={`relative overflow-hidden rounded-xl transition-all ${
                          post.poll!.hasVoted || post.poll!.isEnded
                            ? 'cursor-default'
                            : 'cursor-pointer hover:ring-2 hover:ring-purple-300'
                        } ${
                          isSelected ? 'ring-2 ring-purple-500' : ''
                        } ${
                          isVoted ? 'ring-2 ring-purple-500' : ''
                        }`}
                      >
                        {/* Progress background */}
                        {showResults && (
                          <div
                            className={`absolute inset-0 ${isVoted ? 'bg-purple-200' : 'bg-purple-100'}`}
                            style={{ width: `${option.percentage}%` }}
                          />
                        )}

                        {/* Option content */}
                        <div className={`relative px-4 py-3 flex items-center gap-3 ${
                          showResults ? '' : 'bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800'
                        }`}>
                          {/* Checkbox/Radio indicator */}
                          {!showResults && (
                            <div className={`w-5 h-5 rounded-${post.poll!.selectionType === 'SINGLE' ? 'full' : 'md'} border-2 flex items-center justify-center ${
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                          )}

                          {/* Voted indicator */}
                          {showResults && isVoted && (
                            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}

                          {/* Option text */}
                          <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{option.content}</span>

                          {/* Percentage and count */}
                          {showResults && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-purple-600 dark:text-purple-400">{option.percentage}%</span>
                              <span className="ml-1 text-xs">({option.voteCount}票)</span>
                            </div>
                          )}
                        </div>

                        {/* Voters preview (for normal polls) */}
                        {showResults && post.poll!.pollType === 'NORMAL' && option.voters.length > 0 && (
                          <div className="relative px-4 pb-2 flex items-center gap-1">
                            <div className="flex -space-x-1">
                              {option.voters.slice(0, 5).map((voter) => (
                                <img
                                  key={voter.id}
                                  src={voter.avatar || DEFAULT_AVATAR}
                                  className="w-5 h-5 rounded-full border border-white"
                                  alt={voter.name}
                                  title={voter.name}
                                />
                              ))}
                            </div>
                            {option.voters.length > 0 && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                                {option.voters.map(v => v.name).join('、').slice(0, 20)}
                                {option.voteCount > 5 && `...等${option.voteCount}人`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Vote button or status */}
                {!post.poll.hasVoted && !post.poll.isEnded && (
                  <button
                    onClick={handleVote}
                    disabled={selectedOptions.length === 0 || isVoting}
                    className="mt-4 w-full py-2.5 bg-purple-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isVoting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        投票中...
                      </>
                    ) : (
                      '确认投票'
                    )}
                  </button>
                )}

                {post.poll.hasVoted && !post.poll.isEnded && (
                  <button
                    onClick={handleCancelVote}
                    disabled={isVoting}
                    className="mt-4 w-full py-2 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isVoting ? '处理中...' : '撤销投票'}
                  </button>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 py-3 border-t border-slate-100 dark:border-slate-700">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
                <Eye size={16} />
                {post.viewCount}
              </span>
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 text-sm ${post.isLikedByMe ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <Heart size={16} fill={post.isLikedByMe ? 'currentColor' : 'none'} />
                {post.likeCount}
              </button>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
                <MessageSquare size={16} />
                {post.commentCount}
              </span>
            </div>
          </div>
        </div>

        {/* Comments section */}
        <div className="bg-white dark:bg-slate-800 mt-2 p-4">
          <h3 className="font-semibold mb-4">评论 ({post.commentCount})</h3>

          {isLoadingComments ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-400 dark:text-slate-500 py-8">还没有评论，来说两句吧</p>
          ) : (
            <div className="space-y-5">
              {comments.map(comment => renderComment(comment))}
            </div>
          )}
        </div>

        {/* Bottom spacing for input */}
        <div className="h-20"></div>
      </div>

      {/* Comment input - fixed at bottom */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 sticky bottom-0">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-500 dark:text-slate-400">
            <span>回复 @{replyingTo.name}</span>
            <button onClick={() => setReplyingTo(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Comment image preview */}
        {commentImagePreview && (
          <div className="mb-2 relative inline-block">
            <img src={commentImagePreview} className="h-16 rounded-lg object-cover" alt="" />
            {isUploadingCommentImage && (
              <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={16} />
              </div>
            )}
            <button
              onClick={removeCommentImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-600 text-white rounded-full flex items-center justify-center"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* @Mention popup */}
        {showMentionPopup && (
          <div className="mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {followingUsers
              .filter(u => {
                if (!mentionFilter) return true;
                const name = u.firstName + (u.lastName || '');
                return name.toLowerCase().includes(mentionFilter.toLowerCase());
              })
              .slice(0, 10)
              .map(user => (
                <button
                  key={user.id}
                  onClick={() => handleSelectMention(user)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                >
                  <img
                    src={user.photoUrl || DEFAULT_AVATAR}
                    className="w-7 h-7 rounded-full object-cover"
                    alt=""
                  />
                  <span className="text-sm">{user.firstName}{user.lastName ? ` ${user.lastName}` : ''}</span>
                </button>
              ))}
            {followingUsers.filter(u => {
              if (!mentionFilter) return true;
              const name = u.firstName + (u.lastName || '');
              return name.toLowerCase().includes(mentionFilter.toLowerCase());
            }).length === 0 && (
              <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-3">没有匹配的关注用户</p>
            )}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <button
            onClick={() => commentImageInputRef.current?.click()}
            disabled={isUploadingCommentImage || !!commentImagePreview}
            className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-primary disabled:opacity-50 shrink-0"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={commentImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCommentImageSelect}
          />
          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={handleCommentInputChange}
            placeholder={replyingTo ? `回复 @${replyingTo.name}...` : '写评论... 输入@提及好友'}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
          />
          <button
            onClick={handleSubmitComment}
            disabled={(!commentText.trim() && !commentImageKey) || isSubmittingComment}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            {isSubmittingComment ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Image viewer modal */}
      {renderImageViewer()}

      {/* Comment Detail Sheet */}
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
              {detailSheetComment.authorName === '匿名用户' ? (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <UserX size={14} className="text-slate-400 dark:text-slate-500" />
                </div>
              ) : (
                <img
                  src={detailSheetComment.authorAvatar || DEFAULT_AVATAR}
                  className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                  alt="u"
                  onClick={() => onUserClick?.(detailSheetComment.authorId)}
                />
              )}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{detailSheetComment.authorName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detailSheetComment.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(detailSheetComment.id)}>{detailSheetComment.content}</p>
                {detailSheetComment.imageUrl && (
                  <img src={detailSheetComment.imageUrl} className="mt-2 max-w-[200px] rounded-lg cursor-pointer" onClick={() => window.open(detailSheetComment.imageUrl!, '_blank')} alt="" />
                )}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {detailSheetComment.reactions?.map(r => (
                    <button
                      key={r.stickerId}
                      onClick={() => handleToggleReaction(detailSheetComment.id, r.stickerId)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                        r.hasReacted
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-primary/30'
                      }`}
                    >
                      <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                      <span>{r.count}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setReplyingTo({ id: detailSheetComment.id, parentId: null, name: detailSheetComment.authorName })}
                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-primary flex items-center gap-1 transition-colors ml-1"
                  >
                    <Reply size={10} /> 回复
                  </button>
                </div>
              </div>
            </div>

            {/* All Replies */}
            <div className="space-y-3">
              {detailSheetComment.replies?.map(reply => {
                const isAnon = reply.authorName === '匿名用户';
                return (
                  <div key={reply.id} className="flex gap-3">
                    {isAnon ? (
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <UserX size={12} className="text-slate-400 dark:text-slate-500" />
                      </div>
                    ) : (
                      <img
                        src={reply.authorAvatar || DEFAULT_AVATAR}
                        className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-0.5 cursor-pointer"
                        alt="u"
                        onClick={() => onUserClick?.(reply.authorId)}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <div className="text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{reply.authorName}</span>
                          {reply.replyToName && (
                            <>
                              <span className="text-slate-400 dark:text-slate-500 mx-1">回复</span>
                              <span className="text-primary">@{reply.replyToName}</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line select-none" {...longPressHandlers(reply.id)}>{renderCommentContent(reply.content)}</p>
                      {reply.imageUrl && (
                        <img src={reply.imageUrl} className="mt-1.5 max-w-[160px] rounded-lg cursor-pointer" onClick={() => window.open(reply.imageUrl!, '_blank')} alt="" />
                      )}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {reply.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(reply.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-primary/30'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: reply.id, parentId: detailSheetComment.id, name: reply.authorName })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-primary flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} /> 回复
                        </button>
                        {(reply.isAuthor || isAdmin) && (
                          <button onClick={() => handleDeleteComment(reply.id, detailSheetComment.id)} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 ml-1">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Reply Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 pb-6 space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1.5">
                  <CornerDownRight size={11} />
                  <span>回复 <strong>{replyingTo.name}</strong></span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-0.5 hover:bg-primary/20 rounded-full transition-colors">
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Comment image preview in detail sheet */}
            {commentImagePreview && (
              <div className="relative inline-block">
                <img src={commentImagePreview} className="h-12 rounded-lg object-cover" alt="" />
                {isUploadingCommentImage && (
                  <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={12} />
                  </div>
                )}
                <button
                  onClick={removeCommentImage}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-slate-600 text-white rounded-full flex items-center justify-center"
                >
                  <X size={8} />
                </button>
              </div>
            )}

            {/* @Mention popup in detail sheet */}
            {showMentionPopup && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                {followingUsers
                  .filter(u => {
                    if (!mentionFilter) return true;
                    const name = u.firstName + (u.lastName || '');
                    return name.toLowerCase().includes(mentionFilter.toLowerCase());
                  })
                  .slice(0, 8)
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectMention(user)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                    >
                      <img
                        src={user.photoUrl || DEFAULT_AVATAR}
                        className="w-6 h-6 rounded-full object-cover"
                        alt=""
                      />
                      <span className="text-xs">{user.firstName}{user.lastName ? ` ${user.lastName}` : ''}</span>
                    </button>
                  ))}
                {followingUsers.filter(u => {
                  if (!mentionFilter) return true;
                  const name = u.firstName + (u.lastName || '');
                  return name.toLowerCase().includes(mentionFilter.toLowerCase());
                }).length === 0 && (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-2">没有匹配的关注用户</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => commentImageInputRef.current?.click()}
                disabled={isUploadingCommentImage || !!commentImagePreview}
                className="w-7 h-7 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-primary disabled:opacity-50 shrink-0"
              >
                <ImageIcon size={14} />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={commentText}
                  onChange={handleCommentInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                  placeholder={replyingTo ? `回复 ${replyingTo.name}...` : `回复 ${detailSheetComment.authorName}...`}
                  className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={isSubmittingComment || (!commentText.trim() && !commentImageKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full disabled:opacity-50"
                >
                  {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>
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
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
              {stickerPacks.map((pack, idx) => (
                <button
                  key={pack.id}
                  onClick={() => setActivePackIndex(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    activePackIndex === idx
                      ? 'bg-primary text-white shadow-sm'
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
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {stickerPacks[activePackIndex]?.stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => handleToggleReaction(showStickerPicker!, sticker.id)}
                    className="aspect-square rounded-xl hover:bg-primary/10 p-1.5 transition-all active:scale-90"
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

export default PostDetailPage;
