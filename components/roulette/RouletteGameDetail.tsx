import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Dice5,
  Heart,
  Play,
  Edit3,
  Trash2,
  Loader2,
  MapPin,
  User,
  Bookmark,
  Tag,
  Target,
  ChevronDown,
  ChevronUp,
  Timer,
  Hash,
  Hand,
  Lock,
  Camera,
  MessageCircle,
  Send,
  ThumbsUp,
  Gift,
  CornerDownRight,
  X,
  Coins,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { ImageLightbox } from '../ImageLightbox';
import type { RouletteGameDetail as RouletteGameDetailType, RouletteGameType, GameComment, GameTip } from '../../types';

interface RouletteGameDetailProps {
  gameId: number;
  onBack: () => void;
  onStartPlay: (sessionId: number) => void;
  onEdit: (gameType?: RouletteGameType) => void;
  onDeleted: () => void;
  onStartWheelPlay?: (game: { id: number; gameType: RouletteGameType; wheelConfig: string; title: string; coverImageUrl: string | null }) => void;
  onStartScriptPlay?: (gameId: number) => void;
}

export const RouletteGameDetail: React.FC<RouletteGameDetailProps> = ({
  gameId,
  onBack,
  onStartPlay,
  onEdit,
  onDeleted,
  onStartWheelPlay,
  onStartScriptPlay,
}) => {
  const [game, setGame] = useState<RouletteGameDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { user, hasPermission } = useAuth();

  // Comments state
  const [comments, setComments] = useState<GameComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentHasMore, setCommentHasMore] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ parentId: number; replyToCommentId?: number; replyToName: string } | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Tip state
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMessage, setTipMessage] = useState('');
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [tips, setTips] = useState<GameTip[]>([]);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    loadGame();
  }, [gameId]);

  useEffect(() => {
    if (game) loadComments();
  }, [game?.id]);

  const loadGame = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await rouletteApi.getGame(gameId);
      setGame(result);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!game) return;
    const isWheel = game.gameType === 'IMAGE_WHEEL' || game.gameType === 'TEXT_WHEEL';

    if (isWheel && onStartWheelPlay && game.wheelConfig) {
      onStartWheelPlay({
        id: game.id,
        gameType: game.gameType as RouletteGameType,
        wheelConfig: game.wheelConfig,
        title: game.title,
        coverImageUrl: game.coverImageUrl,
      });
      return;
    }

    if (game.gameType === 'NODE_SCRIPT' && onStartScriptPlay) {
      onStartScriptPlay(game.id);
      return;
    }

    setIsStarting(true);
    try {
      const result = await rouletteApi.startGame(gameId);
      onStartPlay(result.session.id);
    } catch (e: any) {
      setError(e.message || '开始游戏失败');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePurchase = async () => {
    if (!game) return;
    setIsPurchasing(true);
    setError(null);
    try {
      await rouletteApi.purchaseGame(game.id);
      setGame({ ...game, isPurchased: true });
    } catch (e: any) {
      setError(e.message || '购买失败');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await rouletteApi.deleteGame(gameId);
      onDeleted();
    } catch (e: any) {
      setError(e.message || '删除失败');
      setIsDeleting(false);
    }
  };

  const handleToggleLike = async () => {
    if (!game) return;
    try {
      const result = await rouletteApi.toggleLike(gameId);
      setGame({
        ...game,
        isLiked: result.isLiked,
        likeCount: game.likeCount + (result.isLiked ? 1 : -1),
      });
    } catch (e) {
      console.error('Failed to toggle like', e);
    }
  };

  const handleToggleFavorite = async () => {
    if (!game) return;
    try {
      const result = await rouletteApi.toggleFavorite(gameId);
      setGame({ ...game, isFavorited: result.isFavorited });
    } catch (e) {
      console.error('Failed to toggle favorite', e);
    }
  };

  // ==================== Comment handlers ====================
  const loadComments = async (offset = 0) => {
    setCommentLoading(true);
    try {
      const res = await rouletteApi.getComments(gameId, 20, offset);
      if (offset === 0) {
        setComments(res.comments);
      } else {
        setComments(prev => [...prev, ...res.comments]);
      }
      setCommentTotal(res.total);
      setCommentHasMore(res.hasMore);
    } catch (e) {
      console.error('Failed to load comments', e);
    } finally {
      setCommentLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const newComment = await rouletteApi.postComment(gameId, {
        content: commentText.trim(),
        parentId: replyTo?.parentId,
        replyToCommentId: replyTo?.replyToCommentId,
      });
      if (replyTo) {
        setComments(prev => prev.map(c => {
          if (c.id === replyTo.parentId) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        }));
      } else {
        setComments(prev => [...prev, newComment]);
      }
      setCommentTotal(prev => prev + 1);
      setCommentText('');
      setReplyTo(null);
    } catch (e: any) {
      setError(e.message || '评论失败');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number, parentId: number | null) => {
    try {
      await rouletteApi.deleteComment(commentId);
      if (parentId) {
        setComments(prev => prev.map(c => {
          if (c.id === parentId) {
            return { ...c, replies: c.replies?.filter(r => r.id !== commentId) };
          }
          return c;
        }));
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
      setCommentTotal(prev => prev - 1);
    } catch (e) {
      console.error('Failed to delete comment', e);
    }
  };

  const handleToggleCommentLike = async (commentId: number, parentId: number | null) => {
    try {
      const result = await rouletteApi.toggleCommentLike(commentId);
      const updateComment = (c: GameComment): GameComment => {
        if (c.id === commentId) {
          return {
            ...c,
            isLikedByMe: result.isLiked,
            likeCount: c.likeCount + (result.isLiked ? 1 : -1),
          };
        }
        if (c.replies) {
          return { ...c, replies: c.replies.map(updateComment) };
        }
        return c;
      };
      setComments(prev => prev.map(updateComment));
    } catch (e) {
      console.error('Failed to toggle comment like', e);
    }
  };

  const handleReply = (parentId: number, replyToCommentId: number, replyToName: string) => {
    setReplyTo({ parentId, replyToCommentId, replyToName });
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  // ==================== Tip handlers ====================
  const handleTip = async () => {
    if (tipSubmitting || tipAmount <= 0) return;
    setTipSubmitting(true);
    try {
      await rouletteApi.tipGame(gameId, { amount: tipAmount, message: tipMessage.trim() || undefined });
      setShowTipModal(false);
      setTipAmount(5);
      setTipMessage('');
      if (game) {
        setGame({ ...game, totalTips: game.totalTips + tipAmount });
      }
    } catch (e: any) {
      setError(e.message || '打赏失败');
    } finally {
      setTipSubmitting(false);
    }
  };

  const loadTips = async () => {
    try {
      const result = await rouletteApi.getGameTips(gameId);
      setTips(result);
      setShowTips(true);
    } catch (e) {
      console.error('Failed to load tips', e);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        {/* Cover image skeleton */}
        <div className="relative w-full h-48 bg-slate-200 dark:bg-slate-700 animate-pulse">
          {/* Back button placeholder */}
          <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          {/* Title overlay placeholder */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <div className="h-6 w-48 rounded-lg bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600" />
              <div className="h-3 w-20 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          </div>
        </div>

        {/* Tags skeleton */}
        <div className="bg-white dark:bg-slate-800 px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
          <div className="h-4 w-12 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-14 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>

        {/* Stats bar skeleton */}
        <div className="bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-around">
          <div className="text-center space-y-1">
            <div className="h-5 w-10 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mx-auto" />
            <div className="h-2.5 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mx-auto" />
          </div>
          <div className="w-px h-8 bg-slate-100 dark:bg-slate-700" />
          <div className="text-center space-y-1">
            <div className="h-5 w-10 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mx-auto" />
            <div className="h-2.5 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mx-auto" />
          </div>
          <div className="w-px h-8 bg-slate-100 dark:bg-slate-700" />
          <div className="h-9 w-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>

        {/* Content area skeleton */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Description skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          </div>

          {/* Play button skeleton */}
          <div className="h-12 w-full rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />

          {/* Comments section skeleton */}
          <div className="space-y-3 pt-2">
            <div className="h-4 w-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="px-4 pt-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-slate-500 dark:text-slate-400">{error}</p>
          <button onClick={loadGame} className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isOwner = user?.id === game.creatorId;
  const canModerate = hasPermission('comment.moderate');
  const canDelete = isOwner || canModerate;
  const canPlay = game.status === 'PUBLISHED' || isOwner;
  const needsPurchase = game.priceCampusPoints > 0 && !isOwner && !game.isPurchased;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header with cover */}
      <div className="relative">
        {game.coverImageUrl ? (
          <img
            src={game.coverImageUrl}
            alt={game.title}
            className="w-full h-48 object-cover cursor-pointer"
            onClick={() => {
              setLightboxImages([game.coverImageUrl!]);
              setLightboxIndex(0);
            }}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center">
            <Dice5 size={64} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 bg-black/30 hover:bg-black/50 rounded-full transition-colors text-white"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Owner / admin actions */}
        {(isOwner || canDelete) && (
          <div className="absolute top-4 right-4 flex gap-2">
            {isOwner && (
              <button
                onClick={() => onEdit(game?.gameType as RouletteGameType)}
                className="p-2 bg-black/30 hover:bg-black/50 rounded-full transition-colors text-white"
              >
                <Edit3 size={18} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 bg-black/30 hover:bg-black/50 rounded-full transition-colors text-white"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{game.title}</h1>
            {game.priceCampusPoints > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/90 text-white text-xs font-medium rounded-full flex items-center gap-1">
                <Coins size={12} />
                {game.priceCampusPoints}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-white/80 text-xs">
            {game.creatorAvatar ? (
              <img src={game.creatorAvatar} className="w-5 h-5 rounded-full" alt="" />
            ) : (
              <User size={14} />
            )}
            <span>{game.creatorName}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {game.tags && game.tags.length > 0 && (
        <div className="bg-white dark:bg-slate-800 px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
          <Tag size={12} className="text-slate-400 dark:text-slate-500" />
          {game.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-around">
        {game.gameType === 'GRAPH' ? (
          <div className="text-center">
            <div className="text-lg font-bold text-teal-600 dark:text-teal-400">{game.sections.length}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">关卡</div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`text-lg font-bold ${game.gameType === 'IMAGE_WHEEL' ? 'text-violet-600 dark:text-violet-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {game.gameType === 'IMAGE_WHEEL' ? '图片轮盘' : '文字轮盘'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">类型</div>
          </div>
        )}
        <div className="w-px h-8 bg-slate-100 dark:bg-slate-700" />
        <div className="text-center">
          <div className="text-lg font-bold text-teal-600 dark:text-teal-400">{game.playCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">游玩</div>
        </div>
        <div className="w-px h-8 bg-slate-100 dark:bg-slate-700" />
        <button
          onClick={handleToggleLike}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
            game.isLiked ? 'bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:bg-slate-700'
          }`}
        >
          <Heart size={18} fill={game.isLiked ? 'currentColor' : 'none'} />
          <span className="text-sm font-bold">{game.likeCount}</span>
        </button>
        <button
          onClick={handleToggleFavorite}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
            game.isFavorited ? 'bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:bg-slate-700'
          }`}
        >
          <Bookmark size={18} fill={game.isFavorited ? 'currentColor' : 'none'} />
          <span className="text-xs font-medium">{game.isFavorited ? '已收藏' : '收藏'}</span>
        </button>
        {!isOwner && (
          <button
            onClick={() => setShowTipModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 active:bg-orange-100"
          >
            <Gift size={18} />
            <span className="text-sm font-bold">{game.totalTips || ''}</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        {game.description && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{game.description}</p>
          </div>
        )}

        {/* Wheel config preview */}
        {game.gameType !== 'GRAPH' && game.wheelConfig && (() => {
          try {
            const config = JSON.parse(game.wheelConfig);
            const categories = config.categories || [];
            const wheelImages: string[] = config.imageUrls?.length
              ? config.imageUrls
              : config.imageUrl
                ? [config.imageUrl]
                : [];
            return (
              <div className="space-y-3">
                {/* Full image list — no cropping, natural aspect ratio */}
                {wheelImages.length > 0 && (
                  <div className="space-y-2">
                    {wheelImages.map((url: string, imgIdx: number) => (
                      <div
                        key={imgIdx}
                        className="cursor-pointer rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-700"
                        onClick={() => {
                          setLightboxImages(wheelImages);
                          setLightboxIndex(imgIdx);
                        }}
                      >
                        <img
                          src={url}
                          alt={`预览 ${imgIdx + 1}`}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">分类 ({categories.length})</h3>
                  <div className="space-y-2">
                    {categories.map((cat: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {cat.name?.charAt(0) || String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{cat.name}</p>
                          {cat.description && <p className="text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>}
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{cat.minPoints}-{cat.maxPoints}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          } catch { return null; }
        })()}

        {/* Sections overview (GRAPH only) */}
        {game.gameType === 'GRAPH' && (
          <SectionsOverview sections={game.sections} allSections={game.sections} />
        )}

        {/* Round exit info */}
        {game.gameType === 'GRAPH' && game.roundExitEnabled && (
          <div className="bg-violet-50 dark:bg-violet-950 rounded-2xl p-4 border border-violet-100">
            <h3 className="font-semibold text-violet-800 dark:text-violet-200 mb-2 flex items-center gap-2">
              <Target size={16} className="text-violet-500 dark:text-violet-400" />
              轮次退出条件
            </h3>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              此游戏启用了轮次退出机制。轮次决定关卡的骰子结果将设定目标轮次数，达到目标后游戏自动结束。
            </p>
            {(() => {
              const determiner = game.sections.find(s => s.isRoundDeterminer);
              const tasksWithRoundTarget = determiner?.tasks.filter(t => t.roundTargetValue != null);
              if (tasksWithRoundTarget && tasksWithRoundTarget.length > 0) {
                return (
                  <div className="mt-2 space-y-1">
                    {tasksWithRoundTarget.map(t => (
                      <div key={t.id} className="text-[10px] text-violet-500 dark:text-violet-400 flex items-center gap-1">
                        <span>骰子 {t.diceMin}{t.diceMin !== t.diceMax ? `-${t.diceMax}` : ''}：</span>
                        <span className="font-medium">{t.title}</span>
                        <span>→ {t.roundTargetValue} 轮</span>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Special rules */}
        {game.gameType === 'GRAPH' && game.specialRules && game.specialRules.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Dice5 size={16} className="text-amber-500 dark:text-amber-400" />
              特殊规则
            </h3>
            <div className="space-y-2">
              {game.specialRules.map((rule, idx) => {
                const actionLabels: Record<string, string> = {
                  EXTRA_TASK: '额外任务',
                  JUMP_SECTION: '跳转关卡',
                  MODIFY_DICE_RESULT: '修改骰子结果',
                };
                return (
                  <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-100 dark:border-amber-900">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 dark:text-amber-200 rounded text-[10px] font-medium">
                        {actionLabels[rule.actionType] || rule.actionType}
                      </span>
                      {rule.taskTitle && (
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">{rule.taskTitle}</span>
                      )}
                    </div>
                    {rule.taskDescription && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{rule.taskDescription}</p>
                    )}
                    <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                      触发条件：连续掷出相同点数 {rule.conditionValue} 次
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950 rounded-xl p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
        )}

        {/* Tips summary */}
        {game.totalTips > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
            <button
              onClick={() => showTips ? setShowTips(false) : loadTips()}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-orange-500 dark:text-orange-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-100">打赏记录</span>
                <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">{game.totalTips} 校园点</span>
              </div>
              {showTips ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />}
            </button>
            {showTips && tips.length > 0 && (
              <div className="mt-3 space-y-2">
                {tips.map(tip => (
                  <div key={tip.id} className="flex items-center gap-2 text-sm">
                    {tip.fromUserAvatar ? (
                      <img src={tip.fromUserAvatar} className="w-6 h-6 rounded-full" alt="" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                        <User size={12} className="text-orange-500 dark:text-orange-400" />
                      </div>
                    )}
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{tip.fromUserName}</span>
                    <span className="text-orange-500 dark:text-orange-400 font-bold">{tip.amount}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs">校园点</span>
                    {tip.message && <span className="text-slate-500 dark:text-slate-400 text-xs truncate flex-1">· {tip.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comments section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={16} className="text-teal-500 dark:text-teal-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">评论</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">({commentTotal})</span>
          </div>

          {/* Comment input */}
          <div className="mb-4">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-3 py-1.5 rounded-lg">
                <CornerDownRight size={12} />
                <span>回复 {replyTo.replyToName}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={replyTo ? `回复 ${replyTo.replyToName}...` : '写下你的评论...'}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-200"
                rows={2}
              />
              <button
                onClick={handlePostComment}
                disabled={!commentText.trim() || commentSubmitting}
                className="self-end px-3 py-2 bg-teal-500 text-white rounded-xl disabled:opacity-40 hover:bg-teal-600 transition-colors"
              >
                {commentSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          {/* Comment list */}
          <div className="space-y-3">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                canModerate={canModerate}
                onReply={handleReply}
                onDelete={handleDeleteComment}
                onToggleLike={handleToggleCommentLike}
              />
            ))}
          </div>

          {commentHasMore && (
            <button
              onClick={() => loadComments(comments.length)}
              disabled={commentLoading}
              className="w-full mt-3 py-2 text-sm text-teal-500 dark:text-teal-400 hover:bg-teal-50 dark:bg-teal-950 rounded-xl transition-colors disabled:opacity-50"
            >
              {commentLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : '加载更多评论'}
            </button>
          )}

          {!commentLoading && comments.length === 0 && (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">暂无评论，来说点什么吧</p>
          )}
        </div>
      </div>

      {/* Bottom action */}
      {canPlay && (
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
          {needsPurchase ? (
            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isPurchasing ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Coins size={20} />
                  购买游玩 · {game.priceCampusPoints} 校园点
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStartGame}
              disabled={isStarting}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-600 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isStarting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Play size={20} />
                  {game.status === 'PUBLISHED' ? '开始游戏' : '试玩（草稿）'}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Tip modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTipModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mx-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg mb-1 flex items-center gap-2">
              <Gift size={20} className="text-orange-500 dark:text-orange-400" />
              打赏创作者
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">用校园点支持 {game.creatorName} 的创作</p>

            <div className="flex gap-2 mb-3">
              {[1, 5, 10, 20].map(amt => (
                <button
                  key={amt}
                  onClick={() => setTipAmount(amt)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    tipAmount === amt
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>

            <input
              type="number"
              value={tipAmount}
              onChange={e => setTipAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-200"
              min={1}
              placeholder="自定义金额"
            />

            <input
              type="text"
              value={tipMessage}
              onChange={e => setTipMessage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="留言（可选）"
              maxLength={200}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowTipModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleTip}
                disabled={tipSubmitting || tipAmount <= 0}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-orange-600 transition-colors"
              >
                {tipSubmitting ? '处理中...' : `打赏 ${tipAmount} 校园点`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mx-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">删除后无法恢复，确定要删除这个游戏吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxImages([])}
        />
      )}
    </div>
  );
};

// ==================== Sections Overview ====================

const TASK_TYPE_ICONS: Record<string, React.ElementType> = {
  MANUAL: Hand,
  COUNT: Hash,
  DURATION: Timer,
  LOCK: Lock,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  MANUAL: '手动',
  COUNT: '计数',
  DURATION: '计时',
  LOCK: '锁定',
};

interface SectionsOverviewProps {
  sections: RouletteGameDetailType['sections'];
  allSections: RouletteGameDetailType['sections'];
}

const SectionsOverview: React.FC<SectionsOverviewProps> = ({ sections, allSections }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const getSectionName = (id: number | null) => {
    if (id == null) return null;
    return allSections.find(s => s.id === id)?.name ?? null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
        <MapPin size={16} className="text-teal-500 dark:text-teal-400" />
        关卡概览
      </h3>
      <div className="space-y-2">
        {sortedSections.map((section, idx) => {
          const isExpanded = expandedId === section.id;
          const sortedTasks = [...section.tasks].sort((a, b) => a.diceMin - b.diceMin);

          return (
            <div key={section.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : section.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  section.isStart
                    ? 'bg-teal-50 dark:bg-teal-950 border border-teal-100'
                    : isExpanded ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  section.isStart
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{section.name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {section.tasks.length} 个任务
                    {(section.diceRangeMin !== 1 || section.diceRangeMax !== 6) && (
                      <span className="ml-1 text-amber-500 dark:text-amber-400">· 骰子 {section.diceRangeMin}-{section.diceRangeMax}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {section.isStart && (
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-100 px-1.5 py-0.5 rounded-full">
                      起始
                    </span>
                  )}
                  {section.isRoundDeterminer && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium bg-violet-100 dark:bg-violet-950 px-1.5 py-0.5 rounded-full">
                      轮次决定
                    </span>
                  )}
                  {section.countsAsRound && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium bg-violet-100 dark:bg-violet-950 px-1.5 py-0.5 rounded-full">
                      计轮次
                    </span>
                  )}
                  {section.tasks.length > 0 && (
                    isExpanded
                      ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500 ml-1" />
                      : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500 ml-1" />
                  )}
                </div>
              </button>

              {/* Expanded task list */}
              {isExpanded && sortedTasks.length > 0 && (
                <div className="ml-5 mt-1 mb-1 pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5">
                  {sortedTasks.map((task) => {
                    const TypeIcon = TASK_TYPE_ICONS[task.taskType] || Dice5;
                    const successSection = getSectionName(task.successNextSectionId);
                    const failureSection = getSectionName(task.failureNextSectionId);

                    return (
                      <div key={task.id} className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-start gap-2">
                          {/* Dice range badge */}
                          <div className="flex-shrink-0 w-10 h-7 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-bold">
                            {task.diceMin === task.diceMax
                              ? `${task.diceMin}`
                              : `${task.diceMin}-${task.diceMax}`
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{task.title}</span>
                              {task.imageRequired && (
                                <Camera size={11} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
                              )}
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-pre-line">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                                <TypeIcon size={10} />
                                {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                                {task.targetValue != null && (
                                  <span className="ml-0.5">{task.targetValue}{task.targetUnit ? ` ${task.targetUnit}` : ''}</span>
                                )}
                              </span>
                              {task.roundTargetValue != null && (
                                <span className="text-[10px] text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-1.5 py-0.5 rounded font-medium">
                                  {task.roundTargetValue} 轮
                                </span>
                              )}
                              {successSection && (
                                <span className="text-[10px] text-emerald-500 dark:text-emerald-400">
                                  成功→{successSection}
                                </span>
                              )}
                              {failureSection && (
                                <span className="text-[10px] text-rose-400">
                                  失败→{failureSection}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== Comment Item ====================

interface CommentItemProps {
  comment: GameComment;
  currentUserId?: number;
  canModerate: boolean;
  onReply: (parentId: number, replyToCommentId: number, replyToName: string) => void;
  onDelete: (commentId: number, parentId: number | null) => void;
  onToggleLike: (commentId: number, parentId: number | null) => void;
  isReply?: boolean;
  parentId?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  canModerate,
  onReply,
  onDelete,
  onToggleLike,
  isReply = false,
  parentId,
}) => {
  const canDelete = comment.authorId === currentUserId || canModerate;
  const topParentId = isReply ? parentId! : comment.id;

  return (
    <div className={isReply ? 'ml-8 pl-3 border-l-2 border-slate-100 dark:border-slate-700' : ''}>
      <div className="flex gap-2">
        {comment.authorAvatar ? (
          <img src={comment.authorAvatar} className="w-7 h-7 rounded-full shrink-0" alt="" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <User size={12} className="text-teal-500 dark:text-teal-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{comment.authorName || '未知用户'}</span>
            {comment.replyToName && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                回复 <span className="text-teal-500 dark:text-teal-400">{comment.replyToName}</span>
              </span>
            )}
            <span className="text-[10px] text-slate-300 ml-auto shrink-0">
              {new Date(comment.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 break-words whitespace-pre-wrap">{comment.content}</p>
          {comment.imageUrl && (
            <img src={comment.imageUrl} className="mt-1.5 max-w-[200px] rounded-lg" alt="" />
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => onToggleLike(comment.id, isReply ? parentId! : null)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                comment.isLikedByMe ? 'text-teal-500 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:text-teal-400'
              }`}
            >
              <ThumbsUp size={12} fill={comment.isLikedByMe ? 'currentColor' : 'none'} />
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>
            <button
              onClick={() => onReply(topParentId, comment.id, comment.authorName || '未知用户')}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:text-teal-400 transition-colors"
            >
              回复
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id, isReply ? parentId! : null)}
                className="text-xs text-slate-300 hover:text-rose-500 dark:text-rose-400 transition-colors"
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onReply={onReply}
              onDelete={onDelete}
              onToggleLike={onToggleLike}
              isReply
              parentId={comment.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RouletteGameDetail;
