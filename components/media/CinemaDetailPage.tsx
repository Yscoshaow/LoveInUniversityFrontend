import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Heart, Eye, Coins, Lock, User, Play, Clock, Send, Loader2, Reply, Trash2, ArrowLeft, X, CornerDownRight, MessageCircle, Maximize, Minimize, Share2, Tag } from 'lucide-react';
import { cinemaApi, stickerApi, adminCinemaApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { queryKeys } from '../../lib/query-client';
import { CinemaCommentItem } from '../../types';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { platformShare } from '../../lib/platform-actions';
import { Player } from '@lottiefiles/react-lottie-player';
import { useUserProfileNavigation } from '../layout/MainLayout';

interface CinemaDetailPageProps {
  videoId: number;
  onBack: () => void;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const CinemaDetailPage: React.FC<CinemaDetailPageProps> = ({ videoId, onBack }) => {
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.cinema.detail(videoId),
    queryFn: () => cinemaApi.getDetail(videoId),
  });

  const purchaseMutation = useMutation({
    mutationFn: () => cinemaApi.purchase(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cinema.detail(videoId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => cinemaApi.toggleLike(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cinema.detail(videoId) });
    },
  });

  const { viewUserProfile } = useUserProfileNavigation();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('content.takedown');
  const [showTakedown, setShowTakedown] = useState(false);
  const [takedownReason, setTakedownReason] = useState('');
  const [takedownLoading, setTakedownLoading] = useState(false);

  const handleTakedown = async () => {
    setTakedownLoading(true);
    try {
      await adminCinemaApi.takedown(videoId, takedownReason || undefined);
      queryClient.invalidateQueries({ queryKey: queryKeys.cinema.all });
      onBack();
    } catch {
      // ignore
    } finally {
      setTakedownLoading(false);
      setShowTakedown(false);
    }
  };

  // ==================== 评论系统 ====================
  const [comments, setComments] = useState<CinemaCommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; parentId: number | null; userName: string } | null>(null);
  const [detailSheetComment, setDetailSheetComment] = useState<CinemaCommentItem | null>(null);

  // Sticker reactions
  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null);
  const [activePackIndex, setActivePackIndex] = useState(0);

  // Long-press for sticker picker
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_THRESHOLD = 500;
  const MOVE_THRESHOLD = 10;

  const startLongPress = (commentId: number, x: number, y: number) => {
    longPressStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      setShowStickerPicker(commentId);
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
    }, LONG_PRESS_THRESHOLD);
  };

  const moveLongPress = (x: number, y: number) => {
    if (longPressStartPos.current) {
      const dx = Math.abs(x - longPressStartPos.current.x);
      const dy = Math.abs(y - longPressStartPos.current.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    }
  };

  const endLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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

  const DEFAULT_AVATAR = '/default-avatar.png';

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return date.toLocaleDateString();
  };

  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const res = await cinemaApi.getComments(videoId, 50);
      setComments(res.comments);
    } catch {}
    setIsLoadingComments(false);
  }, [videoId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const request: { content: string; parentId?: number; replyToCommentId?: number } = {
        content: commentText.trim(),
      };
      if (replyingTo) {
        request.parentId = replyingTo.parentId ?? replyingTo.id;
        request.replyToCommentId = replyingTo.id;
      }
      const newComment = await cinemaApi.postComment(videoId, request);
      if (replyingTo) {
        setComments(prev => prev.map(c => {
          if (c.id === (replyingTo.parentId ?? replyingTo.id)) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        }));
        if (detailSheetComment && detailSheetComment.id === (replyingTo.parentId ?? replyingTo.id)) {
          setDetailSheetComment(prev => prev ? { ...prev, replies: [...(prev.replies || []), newComment] } : null);
        }
      } else {
        setComments(prev => [{ ...newComment, replies: [] }, ...prev]);
      }
      setCommentText('');
      setReplyingTo(null);
    } catch {}
    setIsSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await cinemaApi.deleteComment(videoId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId).map(c => ({
        ...c,
        replies: c.replies?.filter(r => r.id !== commentId) || null,
      })));
      if (detailSheetComment) {
        if (detailSheetComment.id === commentId) {
          setDetailSheetComment(null);
        } else {
          setDetailSheetComment(prev => prev ? {
            ...prev,
            replies: prev.replies?.filter(r => r.id !== commentId) || null,
          } : null);
        }
      }
    } catch {}
  };

  const handleToggleReaction = async (commentId: number, stickerId: number) => {
    try {
      const res = await stickerApi.toggleCinemaReaction(commentId, stickerId);
      const updateReactions = (items: CinemaCommentItem[]): CinemaCommentItem[] =>
        items.map(c => c.id === commentId
          ? { ...c, reactions: res.reactions }
          : { ...c, replies: c.replies ? updateReactions(c.replies) : null }
        );
      setComments(prev => updateReactions(prev));
      if (detailSheetComment) {
        setDetailSheetComment(prev => {
          if (!prev) return null;
          if (prev.id === commentId) return { ...prev, reactions: res.reactions };
          return { ...prev, replies: prev.replies ? updateReactions(prev.replies) : null };
        });
      }
      setShowStickerPicker(null);
    } catch {}
  };

  const handleCancelReply = () => setReplyingTo(null);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header skeleton */}
        <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-9 w-9" />
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-5 w-40 ml-3" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Video player area skeleton */}
          <div className="relative bg-slate-200 dark:bg-slate-700 animate-pulse aspect-video" />
          {/* Info section skeleton */}
          <div className="p-4 space-y-4">
            {/* Author row */}
            <div className="flex items-center gap-3">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-10 w-10" />
              <div className="flex-1 space-y-2">
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-24" />
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16" />
              </div>
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-12" />
            </div>
            {/* Title */}
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-6 w-3/4" />
            {/* Description lines */}
            <div className="space-y-2">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-full" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-5/6" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-2/3" />
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-4 pt-2">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-16" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-16" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-20" />
            </div>
            {/* Tags skeleton */}
            <div className="flex gap-2 pt-2">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-6 w-14" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-6 w-18" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-400 dark:text-slate-500">视频不存在</p>
        <button onClick={onBack} className="mt-4 text-amber-500 dark:text-amber-400">返回</button>
      </div>
    );
  }

  const canAccess = detail.isFree || detail.isPurchased;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-slate-800 dark:text-slate-100 truncate ml-2">{detail.title}</h1>
        {isAdmin && (
          <button onClick={() => setShowTakedown(true)} className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors">
            下架
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Video Player Area */}
        <div className="relative bg-black aspect-video">
          {canAccess && detail.muxPlaybackId ? (
            <MuxPlayerComponent playbackId={detail.muxPlaybackId} playbackToken={detail.playbackToken} thumbnailToken={detail.thumbnailToken} />
          ) : canAccess && detail.muxAssetStatus === 'upload_failed' ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/70 gap-3">
              <p className="text-sm text-red-300">上传失败，请重新上传视频</p>
            </div>
          ) : canAccess && detail.muxAssetStatus !== 'ready' ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/70 gap-3">
              <div className="w-10 h-10 border-3 border-white/30 border-t-white/70 rounded-full animate-spin" />
              <p className="text-sm">视频处理中，请稍后刷新</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/70 gap-3 relative">
              {detail.coverImageUrl && (
                <img src={detail.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              )}
              <div className="relative z-10 flex flex-col items-center gap-3">
                <Lock size={48} />
                <p className="text-sm">购买后观看完整视频</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 pb-20 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
              {detail.authorAvatar ? (
                <img src={detail.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-amber-400 dark:text-amber-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-800 dark:text-slate-100">{detail.authorName || '匿名用户'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(detail.createdAt).toLocaleDateString()}</p>
            </div>
            {detail.duration && (
              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Clock size={14} />
                {formatDuration(detail.duration)}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Eye size={16} /> {detail.viewCount}</span>
            <button
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              className={`flex items-center gap-1 transition-colors ${
                detail.isLiked ? 'text-pink-500 dark:text-pink-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Heart size={16} fill={detail.isLiked ? 'currentColor' : 'none'} /> {detail.likeCount}
            </button>
            <button
              onClick={() => {
                platformShare({
                  text: `来看看「${detail.title}」— ${detail.authorName || '匿名'}的视频`,
                  url: `https://t.me/lovein_university_bot/university?startapp=cinema_${detail.id}`,
                  inlineQuery: `cinema:${detail.id}`,
                });
              }}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors ml-auto"
            >
              <Share2 size={16} />
            </button>
          </div>

          {/* Description */}
          {detail.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{detail.description}</p>
          )}

          {/* Tags */}
          {detail.tags && detail.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {detail.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-full text-xs">
                  <Tag size={10} />{tag}
                </span>
              ))}
            </div>
          )}

          {/* Rejection reason */}
          {detail.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
              审核未通过：{detail.rejectionReason}
            </div>
          )}

          {/* Purchase */}
          {!detail.isFree && !detail.isPurchased && (
            <button
              onClick={() => purchaseMutation.mutate()}
              disabled={purchaseMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
            >
              <Coins size={18} />
              {purchaseMutation.isPending ? '购买中...' : `购买 (${detail.priceCampusPoints} 校园点)`}
            </button>
          )}
          {purchaseMutation.isError && (
            <p className="text-sm text-red-500 dark:text-red-400 text-center">
              {(purchaseMutation.error as Error)?.message || '购买失败'}
            </p>
          )}

          {/* ==================== 评论区 ==================== */}
          <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <MessageCircle size={16} />
              评论 {comments.length > 0 && `(${comments.length})`}
            </h3>

            {/* 评论列表 */}
            {isLoadingComments ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4 mb-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <img
                      src={comment.authorAvatar || DEFAULT_AVATAR}
                      className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer"
                      alt=""
                      onClick={() => viewUserProfile(comment.authorId)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs cursor-pointer hover:text-amber-600 dark:text-amber-400" onClick={() => viewUserProfile(comment.authorId)}>{comment.authorName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(comment.id)}>
                        {comment.content}
                      </p>

                      {/* Reactions + Actions */}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {comment.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(comment.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: comment.id, parentId: null, userName: comment.authorName })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:text-amber-400 flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} /> 回复
                        </button>
                        {comment.isAuthor && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 ml-1">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>

                      {/* Reply Preview */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                          {comment.replies.slice(0, 3).map(reply => (
                            <div key={reply.id} className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-bold text-slate-700 dark:text-slate-200">{reply.authorName}</span>
                              {reply.replyToName && (
                                <><span className="text-slate-400 dark:text-slate-500 mx-1">回复</span><span className="text-amber-600 dark:text-amber-400">@{reply.replyToName}</span></>
                              )}
                              <span className="text-slate-300 mx-1">:</span>
                              <span>{reply.content}</span>
                            </div>
                          ))}
                          {comment.replies.length > 3 ? (
                            <button onClick={() => setDetailSheetComment(comment)} className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:text-amber-400">
                              共{comment.replies.length}条回复 &gt;
                            </button>
                          ) : comment.replies.length > 0 && (
                            <button onClick={() => setDetailSheetComment(comment)} className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:text-amber-400">
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
              <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-8">暂无评论，来发表第一条吧</p>
            )}
          </div>
        </div>
      </div>

      {/* ==================== 底部评论输入栏 ==================== */}
      {!detailSheetComment && (
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 space-y-2">
          {replyingTo && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <CornerDownRight size={12} />
                <span>回复 <strong>{replyingTo.userName}</strong></span>
              </div>
              <button onClick={handleCancelReply} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-full transition-colors">
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
              placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : '发表评论...'}
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300/40 transition-all"
            />
            <button
              onClick={() => handlePostComment()}
              disabled={isSubmittingComment || !commentText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-amber-500 text-white rounded-full disabled:opacity-50"
            >
              {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* ==================== 评论详情抽屉 ==================== */}
      {detailSheetComment && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <button onClick={() => { setDetailSheetComment(null); setReplyingTo(null); }}>
              <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
              评论详情 ({(detailSheetComment.replies?.length || 0) + 1})
            </span>
            <div className="w-7" />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
            {/* Parent Comment */}
            <div className="flex gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <img src={detailSheetComment.authorAvatar || DEFAULT_AVATAR} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer" alt="" onClick={() => viewUserProfile(detailSheetComment.authorId)} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm cursor-pointer hover:text-amber-600 dark:text-amber-400" onClick={() => viewUserProfile(detailSheetComment.authorId)}>{detailSheetComment.authorName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detailSheetComment.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(detailSheetComment.id)}>{detailSheetComment.content}</p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {detailSheetComment.reactions?.map(r => (
                    <button key={r.stickerId} onClick={() => handleToggleReaction(detailSheetComment.id, r.stickerId)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${r.hasReacted ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                      <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                      <span>{r.count}</span>
                    </button>
                  ))}
                  <button onClick={() => setReplyingTo({ id: detailSheetComment.id, parentId: null, userName: detailSheetComment.authorName })}
                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:text-amber-400 flex items-center gap-1 transition-colors ml-1">
                    <Reply size={10} /> 回复
                  </button>
                </div>
              </div>
            </div>

            {/* All Replies */}
            <div className="space-y-3">
              {detailSheetComment.replies?.map(reply => (
                <div key={reply.id} className="flex gap-3">
                  <img src={reply.authorAvatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer" alt="" onClick={() => viewUserProfile(reply.authorId)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-amber-600 dark:text-amber-400" onClick={() => viewUserProfile(reply.authorId)}>{reply.authorName}</span>
                        {reply.replyToName && (
                          <><span className="text-slate-400 dark:text-slate-500">回复</span><span className="text-amber-600 dark:text-amber-400">@{reply.replyToName}</span></>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(reply.id)}>{reply.content}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {reply.reactions?.map(r => (
                        <button key={r.stickerId} onClick={() => handleToggleReaction(reply.id, r.stickerId)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${r.hasReacted ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                          <span>{r.count}</span>
                        </button>
                      ))}
                      <button onClick={() => setReplyingTo({ id: reply.id, parentId: detailSheetComment.id, userName: reply.authorName })}
                        className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:text-amber-400 flex items-center gap-1 transition-colors ml-1">
                        <Reply size={10} /> 回复
                      </button>
                      {reply.isAuthor && (
                        <button onClick={() => handleDeleteComment(reply.id)} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 ml-1">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Reply Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 pb-6 space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <CornerDownRight size={12} />
                  <span>回复 <strong>{replyingTo.userName}</strong></span>
                </div>
                <button onClick={handleCancelReply} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-full"><X size={11} /></button>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePostComment(); } }}
                placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : `回复 ${detailSheetComment.authorName}...`}
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300/40"
              />
              <button onClick={handlePostComment} disabled={isSubmittingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-amber-500 text-white rounded-full disabled:opacity-50">
                {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Takedown Modal */}
      {showTakedown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTakedown(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">下架视频</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">确定要下架「{detail.title}」吗？作者会收到通知。</p>
            <input
              type="text"
              value={takedownReason}
              onChange={(e) => setTakedownReason(e.target.value)}
              placeholder="下架原因（可选）"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/50 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowTakedown(false)} className="flex-1 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                取消
              </button>
              <button onClick={handleTakedown} disabled={takedownLoading} className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                {takedownLoading ? '处理中...' : '确认下架'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Sticker Picker ==================== */}
      {showStickerPicker !== null && stickerPacks.length > 0 && (
        <div className="fixed inset-0 z-60 flex items-end justify-center" onClick={() => setShowStickerPicker(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl max-h-[40vh] flex flex-col animate-in slide-in-from-bottom duration-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-slate-300 rounded-full" /></div>
            <div className="flex items-center gap-1.5 px-3 pb-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
              {stickerPacks.map((pack, idx) => (
                <button key={pack.id} onClick={() => setActivePackIndex(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${activePackIndex === idx ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {pack.stickers[0] && <Player src={pack.stickers[0].fileUrl} style={{ width: 14, height: 14 }} />}
                  {pack.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {stickerPacks[activePackIndex]?.stickers.map(sticker => (
                  <button key={sticker.id} onClick={() => handleToggleReaction(showStickerPicker!, sticker.id)}
                    className="aspect-square rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950 p-1.5 transition-all active:scale-90">
                    <Player src={sticker.fileUrl} style={{ width: '100%', height: '100%' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// HLS.js-based Mux player component
const MuxPlayerComponent: React.FC<{
  playbackId: string;
  playbackToken?: string | null;
  thumbnailToken?: string | null;
}> = ({ playbackId, playbackToken, thumbnailToken }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const src = playbackToken
    ? `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`
    : `https://stream.mux.com/${playbackId}.m3u8`;

  const posterUrl = thumbnailToken
    ? `https://image.mux.com/${playbackId}/thumbnail.webp?token=${thumbnailToken}`
    : `https://image.mux.com/${playbackId}/thumbnail.webp?time=0`;

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        }
      }).catch(() => {
        video.src = src;
      });
    }
  }, [src]);

  React.useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video) return;

    if (isFullscreen) {
      document.exitFullscreen?.();
      return;
    }

    // iOS WebView: use webkitEnterFullscreen on the video element
    if ((video as any).webkitEnterFullscreen) {
      (video as any).webkitEnterFullscreen();
      return;
    }
    // Standard Fullscreen API on the container
    if (container?.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as any)?.webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    }
  }, [isFullscreen]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${isFullscreen ? 'bg-black' : ''}`}>
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full"
        poster={posterUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {!isPlaying && (
        <button
          onClick={() => videoRef.current?.play()}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <div className="w-16 h-16 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-xl">
            <Play size={28} className="text-slate-800 dark:text-slate-100 ml-1" />
          </div>
        </button>
      )}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-lg text-white/80 hover:text-white hover:bg-black/70 transition-colors z-10"
      >
        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  );
};

export default CinemaDetailPage;
