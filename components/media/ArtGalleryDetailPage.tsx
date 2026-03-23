import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Heart, Eye, Coins, Lock, User, Send, Loader2, Reply, Trash2, ArrowLeft, X, CornerDownRight, MessageCircle, Share2, Tag } from 'lucide-react';
import { galleryApi, stickerApi, adminGalleryApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { queryKeys } from '../../lib/query-client';
import { DraggableCardContainer, DraggableCardBody } from '../ui/draggable-card';
import { ImageLightbox } from '../ui/ImageLightbox';
import { GalleryCommentItem } from '../../types';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { platformShare } from '../../lib/platform-actions';
import { Player } from '@lottiefiles/react-lottie-player';
import { useUserProfileNavigation } from '../layout/MainLayout';

// Pre-computed layout positions for cards (scattered with rotations)
const CARD_LAYOUTS = [
  { top: '4%', left: '8%', rotate: -6 },
  { top: '8%', right: '6%', rotate: 5 },
  { top: '35%', left: '15%', rotate: -4 },
  { top: '30%', right: '10%', rotate: 8 },
  { top: '55%', left: '5%', rotate: 3 },
  { top: '50%', right: '15%', rotate: -7 },
  { top: '70%', left: '20%', rotate: 6 },
  { top: '65%', right: '5%', rotate: -3 },
  { top: '15%', left: '35%', rotate: 2 },
  { top: '45%', left: '30%', rotate: -5 },
];

interface ArtGalleryDetailPageProps {
  itemId: number;
  onBack: () => void;
}

export const ArtGalleryDetailPage: React.FC<ArtGalleryDetailPageProps> = ({ itemId, onBack }) => {
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.gallery.detail(itemId),
    queryFn: () => galleryApi.getDetail(itemId),
  });

  const purchaseMutation = useMutation({
    mutationFn: () => galleryApi.purchase(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gallery.detail(itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => galleryApi.toggleLike(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gallery.detail(itemId) });
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
      await adminGalleryApi.takedown(itemId, takedownReason || undefined);
      queryClient.invalidateQueries({ queryKey: queryKeys.gallery.all });
      onBack();
    } catch {
      // ignore
    } finally {
      setTakedownLoading(false);
      setShowTakedown(false);
    }
  };

  // ==================== 评论系统 ====================
  const [comments, setComments] = useState<GalleryCommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; parentId: number | null; userName: string } | null>(null);
  const [detailSheetComment, setDetailSheetComment] = useState<GalleryCommentItem | null>(null);

  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null);
  const [activePackIndex, setActivePackIndex] = useState(0);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = (commentId: number, x: number, y: number) => {
    longPressStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      setShowStickerPicker(commentId);
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
    }, 500);
  };
  const moveLongPress = (x: number, y: number) => {
    if (longPressStartPos.current) {
      if (Math.abs(x - longPressStartPos.current.x) > 10 || Math.abs(y - longPressStartPos.current.y) > 10) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    }
  };
  const endLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

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
      const res = await galleryApi.getComments(itemId, 50);
      setComments(res.comments);
    } catch {}
    setIsLoadingComments(false);
  }, [itemId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePostComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const request: { content: string; parentId?: number; replyToCommentId?: number } = { content: commentText.trim() };
      if (replyingTo) {
        request.parentId = replyingTo.parentId ?? replyingTo.id;
        request.replyToCommentId = replyingTo.id;
      }
      const newComment = await galleryApi.postComment(itemId, request);
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
      await galleryApi.deleteComment(itemId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId).map(c => ({
        ...c, replies: c.replies?.filter(r => r.id !== commentId) || null,
      })));
      if (detailSheetComment) {
        if (detailSheetComment.id === commentId) setDetailSheetComment(null);
        else setDetailSheetComment(prev => prev ? { ...prev, replies: prev.replies?.filter(r => r.id !== commentId) || null } : null);
      }
    } catch {}
  };

  const handleToggleReaction = async (commentId: number, stickerId: number) => {
    try {
      const res = await stickerApi.toggleGalleryReaction(commentId, stickerId);
      const updateReactions = (items: GalleryCommentItem[]): GalleryCommentItem[] =>
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

  // Randomize card layouts per render but keep stable via useMemo
  const cardPositions = useMemo(() => {
    if (!detail?.images) return [];
    return detail.images.map((_, i) => {
      const base = CARD_LAYOUTS[i % CARD_LAYOUTS.length];
      return {
        ...base,
        rotate: base.rotate + (Math.random() * 4 - 2),
      };
    });
  }, [detail?.images]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header skeleton */}
        <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-9 w-9" />
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-5 w-40 ml-3" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Image gallery skeleton */}
          <div className="w-full aspect-square bg-slate-200 dark:bg-slate-700 animate-pulse" />
          {/* Info section skeleton */}
          <div className="p-4 space-y-4">
            {/* Author row */}
            <div className="flex items-center gap-3">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-10 w-10" />
              <div className="flex-1 space-y-2">
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-24" />
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16" />
              </div>
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
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-400 dark:text-slate-500">作品不存在</p>
        <button onClick={onBack} className="mt-4 text-indigo-500 dark:text-indigo-400">返回</button>
      </div>
    );
  }

  const canAccess = detail.isFree || detail.isPurchased;
  const images = detail.images || [];
  const authorName = detail.authorName || '匿名用户';

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10">
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
        {/* Draggable Image Gallery */}
        {canAccess && images.length > 0 ? (
          <DraggableCardContainer className="w-full overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/30" style={{ minHeight: Math.max(380, images.length * 80 + 100) }}>
            {/* Background hint text */}
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-slate-300/60 text-lg font-bold pointer-events-none select-none max-w-[200px] leading-relaxed">
              拖拽卡片浏览
              <br />
              <span className="text-sm font-normal">双击查看大图</span>
            </p>

            {images.map((img, idx) => {
              const pos = cardPositions[idx] || CARD_LAYOUTS[0];
              return (
                <DraggableCardBody
                  key={img.id}
                  className="absolute"
                  style={{
                    top: pos.top,
                    left: 'left' in pos ? pos.left : undefined,
                    right: 'right' in pos ? pos.right : undefined,
                    rotate: `${pos.rotate}deg`,
                    zIndex: idx + 1,
                  }}
                  onDoubleClick={() => setLightboxIndex(idx)}
                >
                  <div className="rounded-xl overflow-hidden shadow-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-shadow">
                    <img
                      src={img.imageUrl}
                      alt={`${detail.title} - ${idx + 1}`}
                      className="w-36 h-36 sm:w-44 sm:h-44 object-cover pointer-events-none"
                      draggable={false}
                    />
                    <div className="px-2.5 py-2 bg-white dark:bg-slate-800">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{authorName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{idx + 1} / {images.length}</p>
                    </div>
                  </div>
                </DraggableCardBody>
              );
            })}
          </DraggableCardContainer>
        ) : !canAccess ? (
          <div className="w-full aspect-square bg-black flex flex-col items-center justify-center text-white/70 gap-3">
            <Lock size={48} />
            <p className="text-sm">购买后查看完整图片</p>
          </div>
        ) : null}

        {/* Info */}
        <div className="p-4 pb-20 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center overflow-hidden">
              {detail.authorAvatar ? (
                <img src={detail.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-indigo-400" />
              )}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">{authorName}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(detail.createdAt).toLocaleDateString()}</p>
            </div>
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
                  text: `来看看「${detail.title}」— ${detail.authorName || '匿名'}的作品`,
                  url: `https://t.me/lovein_university_bot/university?startapp=gallery_${detail.id}`,
                  inlineQuery: `gallery:${detail.id}`,
                });
              }}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors ml-auto"
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
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full text-xs">
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
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
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
                <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
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
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs cursor-pointer hover:text-indigo-600 dark:text-indigo-400" onClick={() => viewUserProfile(comment.authorId)}>{comment.authorName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(comment.id)}>
                        {comment.content}
                      </p>

                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {comment.reactions?.map(r => (
                          <button
                            key={r.stickerId}
                            onClick={() => handleToggleReaction(comment.id, r.stickerId)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                              r.hasReacted ? 'border-indigo-400/40 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                            <span>{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: comment.id, parentId: null, userName: comment.authorName })}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:text-indigo-400 flex items-center gap-1 transition-colors ml-1"
                        >
                          <Reply size={10} /> 回复
                        </button>
                        {comment.isAuthor && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 ml-1">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>

                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                          {comment.replies.slice(0, 3).map(reply => (
                            <div key={reply.id} className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-bold text-slate-700 dark:text-slate-200">{reply.authorName}</span>
                              {reply.replyToName && (
                                <><span className="text-slate-400 dark:text-slate-500 mx-1">回复</span><span className="text-indigo-600 dark:text-indigo-400">@{reply.replyToName}</span></>
                              )}
                              <span className="text-slate-300 mx-1">:</span>
                              <span>{reply.content}</span>
                            </div>
                          ))}
                          {comment.replies.length > 3 ? (
                            <button onClick={() => setDetailSheetComment(comment)} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:text-indigo-400">
                              共{comment.replies.length}条回复 &gt;
                            </button>
                          ) : comment.replies.length > 0 && (
                            <button onClick={() => setDetailSheetComment(comment)} className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:text-indigo-400">
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
            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-3 py-2 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <CornerDownRight size={12} />
                <span>回复 <strong>{replyingTo.userName}</strong></span>
              </div>
              <button onClick={handleCancelReply} className="p-1 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 rounded-full transition-colors">
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
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300/40 transition-all"
            />
            <button
              onClick={() => handlePostComment()}
              disabled={isSubmittingComment || !commentText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 text-white rounded-full disabled:opacity-50"
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
            <div className="flex gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <img src={detailSheetComment.authorAvatar || DEFAULT_AVATAR} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer" alt="" onClick={() => viewUserProfile(detailSheetComment.authorId)} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm cursor-pointer hover:text-indigo-600 dark:text-indigo-400" onClick={() => viewUserProfile(detailSheetComment.authorId)}>{detailSheetComment.authorName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detailSheetComment.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(detailSheetComment.id)}>{detailSheetComment.content}</p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {detailSheetComment.reactions?.map(r => (
                    <button key={r.stickerId} onClick={() => handleToggleReaction(detailSheetComment.id, r.stickerId)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${r.hasReacted ? 'border-indigo-400/40 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                      <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                      <span>{r.count}</span>
                    </button>
                  ))}
                  <button onClick={() => setReplyingTo({ id: detailSheetComment.id, parentId: null, userName: detailSheetComment.authorName })}
                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:text-indigo-400 flex items-center gap-1 transition-colors ml-1">
                    <Reply size={10} /> 回复
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {detailSheetComment.replies?.map(reply => (
                <div key={reply.id} className="flex gap-3">
                  <img src={reply.authorAvatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover mt-1 cursor-pointer" alt="" onClick={() => viewUserProfile(reply.authorId)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-indigo-600 dark:text-indigo-400" onClick={() => viewUserProfile(reply.authorId)}>{reply.authorName}</span>
                        {reply.replyToName && (
                          <><span className="text-slate-400 dark:text-slate-500">回复</span><span className="text-indigo-600 dark:text-indigo-400">@{reply.replyToName}</span></>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line select-none" {...longPressHandlers(reply.id)}>{reply.content}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {reply.reactions?.map(r => (
                        <button key={r.stickerId} onClick={() => handleToggleReaction(reply.id, r.stickerId)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${r.hasReacted ? 'border-indigo-400/40 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Player autoplay loop src={r.stickerUrl} style={{ width: 16, height: 16 }} />
                          <span>{r.count}</span>
                        </button>
                      ))}
                      <button onClick={() => setReplyingTo({ id: reply.id, parentId: detailSheetComment.id, userName: reply.authorName })}
                        className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:text-indigo-400 flex items-center gap-1 transition-colors ml-1">
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

          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 pb-6 space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <CornerDownRight size={12} />
                  <span>回复 <strong>{replyingTo.userName}</strong></span>
                </div>
                <button onClick={handleCancelReply} className="p-1 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 rounded-full"><X size={11} /></button>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePostComment(); } }}
                placeholder={replyingTo ? `回复 ${replyingTo.userName}...` : `回复 ${detailSheetComment.authorName}...`}
                className="w-full bg-slate-100 dark:bg-slate-700 rounded-full pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300/40"
              />
              <button onClick={handlePostComment} disabled={isSubmittingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 text-white rounded-full disabled:opacity-50">
                {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${activePackIndex === idx ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {pack.stickers[0] && <Player src={pack.stickers[0].fileUrl} style={{ width: 14, height: 14 }} />}
                  {pack.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {stickerPacks[activePackIndex]?.stickers.map(sticker => (
                  <button key={sticker.id} onClick={() => handleToggleReaction(showStickerPicker!, sticker.id)}
                    className="aspect-square rounded-xl hover:bg-indigo-50 dark:bg-indigo-950 p-1.5 transition-all active:scale-90">
                    <Player src={sticker.fileUrl} style={{ width: '100%', height: '100%' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Takedown Modal */}
      {showTakedown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTakedown(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">下架作品</h3>
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

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};

export default ArtGalleryDetailPage;
