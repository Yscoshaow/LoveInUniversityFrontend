import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Eye,
  Coins,
  Lock,
  Loader2,
  BookOpen,
  Tag,
  List,
  X,
  ChevronRight,
  Hash,
  User,
  BookMarked,
  MessageCircle,
  Heart,
  Send,
  Trash2,
  CornerDownRight,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { useBookDetail, usePurchaseBook, useUserCurrency, useUpdateReadingProgress, useBookComments, useCreateBookComment, useDeleteBookComment, useToggleBookCommentLike, useToggleBookCommentReaction } from '../../hooks';
import type { BookSummary, BookCommentItem } from '../../types';
import { useAuth } from '../../lib/auth-context';
import { useStickerPacks } from '../../hooks/useStickerPacks';
import { Player } from '@lottiefiles/react-lottie-player';
import { useConfirm } from '@/hooks/useConfirm';

interface BookDetailPageProps {
  bookId: number;
  onBack: () => void;
  onBookClick?: (bookId: number) => void;
  onSeriesClick?: (seriesId: number) => void;
}

// Extract headings from markdown for TOC
interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[`*_~\[\]()]/g, '').trim();
      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fff-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      items.push({ id, text, level });
    }
  }
  return items;
}

// Custom heading component with anchor link
const createHeadingComponent = (level: number) => {
  const HeadingComponent = ({ id, children, ...props }: any) => {
    const content = (
      <>
        {children}
        <a
          href={`#${id}`}
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-600 dark:text-indigo-400 no-underline"
          aria-label="Anchor"
        >
          <Hash size={level <= 2 ? 16 : 14} className="inline-block" />
        </a>
      </>
    );
    const cls = "group relative scroll-mt-20";
    switch (level) {
      case 1: return <h1 id={id} className={cls} {...props}>{content}</h1>;
      case 2: return <h2 id={id} className={cls} {...props}>{content}</h2>;
      case 3: return <h3 id={id} className={cls} {...props}>{content}</h3>;
      default: return <h4 id={id} className={cls} {...props}>{content}</h4>;
    }
  };
  return HeadingComponent;
};

const DEFAULT_AVATAR = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23e2e8f0" width="40" height="40" rx="20"/><text x="20" y="25" text-anchor="middle" fill="%2394a3b8" font-size="16">?</text></svg>';

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

export const BookDetailPage: React.FC<BookDetailPageProps> = ({ bookId, onBack, onBookClick, onSeriesClick }) => {
  const { data: book, isLoading, error } = useBookDetail(bookId);
  const { data: currency } = useUserCurrency();
  const { user } = useAuth();
  const confirm = useConfirm();
  const purchaseMutation = usePurchaseBook();
  const updateProgressMutation = useUpdateReadingProgress();
  const [showConfirm, setShowConfirm] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredProgress = useRef(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string } | null>(null);
  const { data: commentsData, isLoading: isLoadingComments } = useBookComments(bookId);
  const createCommentMutation = useCreateBookComment(bookId);
  const deleteCommentMutation = useDeleteBookComment(bookId);
  const toggleLikeMutation = useToggleBookCommentLike(bookId);
  const toggleReactionMutation = useToggleBookCommentReaction(bookId);

  // Sticker reaction state
  const stickerPacks = useStickerPacks();
  const [showStickerPicker, setShowStickerPicker] = useState<number | null>(null);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

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

  const handleToggleReaction = (commentId: number, stickerId: number) => {
    toggleReactionMutation.mutate({ commentId, stickerId });
    setShowStickerPicker(null);
  };

  // Generate TOC from content
  const toc = useMemo(() => {
    if (!book?.content) return [];
    return extractToc(book.content);
  }, [book?.content]);

  // Custom components for Markdown — GitBook-inspired
  const markdownComponents = useMemo(() => ({
    h1: createHeadingComponent(1),
    h2: createHeadingComponent(2),
    h3: createHeadingComponent(3),
    h4: createHeadingComponent(4),
    pre: ({ children, ...props }: any) => (
      <div className="my-5 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#1e1e2e] shadow-sm">
        <pre className="bg-transparent! m-0! rounded-none! p-4 overflow-x-auto text-[13px] leading-relaxed" {...props}>
          {children}
        </pre>
      </div>
    ),
    code: ({ children, className, ...props }: any) => {
      if (className) {
        return <code className={className} {...props}>{children}</code>;
      }
      return (
        <code className="bg-indigo-50! text-indigo-700 dark:text-indigo-400! px-1.5! py-0.5! rounded-md! text-[13px]! font-medium! before:content-none! after:content-none! border border-indigo-100 dark:border-indigo-900" {...props}>
          {children}
        </code>
      );
    },
    blockquote: ({ children, ...props }: any) => {
      const childText = (children as any)?.props?.children?.[0]?.props?.children;
      const firstText = typeof childText === 'string' ? childText : '';
      let style = { border: 'border-l-indigo-400', bg: 'bg-indigo-50/60 dark:bg-indigo-950/60' };
      if (firstText.startsWith('⚠️') || firstText.toLowerCase().includes('warning')) {
        style = { border: 'border-l-amber-400', bg: 'bg-amber-50/60 dark:bg-amber-950/60' };
      } else if (firstText.startsWith('🚨') || firstText.toLowerCase().includes('danger')) {
        style = { border: 'border-l-red-400', bg: 'bg-red-50/60 dark:bg-red-950/60' };
      } else if (firstText.startsWith('✅') || firstText.toLowerCase().includes('success')) {
        style = { border: 'border-l-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-950/60' };
      }
      return (
        <blockquote
          className={`border-l-4! ${style.border} ${style.bg} pl-4! pr-4! py-3! my-5! rounded-r-lg! not-italic! [&>p]:my-1!`}
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    table: ({ children, ...props }: any) => (
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="min-w-full my-0!" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4! py-2.5! text-left! text-xs! font-semibold! text-slate-600! uppercase tracking-wider" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4! py-2.5! text-sm! border-b! border-slate-100!" {...props}>{children}</td>
    ),
    img: ({ src, alt, ...props }: any) => (
      <figure className="my-5">
        <img
          src={src}
          alt={alt}
          className="rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 max-w-full mx-auto"
          loading="lazy"
          {...props}
        />
        {alt && alt !== '' && (
          <figcaption className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2 italic">{alt}</figcaption>
        )}
      </figure>
    ),
    a: ({ children, href, ...props }: any) => (
      <a
        href={href}
        className="text-indigo-600! no-underline! font-medium! hover:underline! hover:text-indigo-700 dark:text-indigo-400! transition-colors"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    hr: () => (
      <div className="my-8 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="my-3! space-y-1!" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="my-3! space-y-1!" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => {
      const { className } = props;
      if (className === 'task-list-item') {
        return (
          <li className="list-none! pl-0! flex items-start gap-2" {...props}>
            {children}
          </li>
        );
      }
      return <li {...props}>{children}</li>;
    },
  }), []);

  // Restore reading progress from server when book loads
  useEffect(() => {
    if (!book || !book.readingProgress || hasRestoredProgress.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Wait a tick for content to render
    const timer = setTimeout(() => {
      const { scrollHeight, clientHeight } = container;
      if (scrollHeight > clientHeight && book.readingProgress) {
        const targetScroll = book.readingProgress * (scrollHeight - clientHeight);
        container.scrollTo({ top: targetScroll, behavior: 'auto' });
        hasRestoredProgress.current = true;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [book]);

  // Save reading progress to server (debounced)
  const saveProgressToServer = useCallback((scrollPosition: number) => {
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = setTimeout(() => {
      updateProgressMutation.mutate({ bookId, scrollPosition });
    }, 2000);
  }, [bookId, updateProgressMutation]);

  // Track reading progress and active heading
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const progressFraction = scrollHeight > clientHeight
      ? scrollTop / (scrollHeight - clientHeight)
      : 1;
    const progressPercent = Math.min(100, Math.round(progressFraction * 100));
    setReadingProgress(progressPercent);

    // Save to server (debounced, as 0.0-1.0)
    if (book?.isPurchased || book?.isFree) {
      saveProgressToServer(Math.min(1, progressFraction));
    }

    // Find active heading
    if (toc.length > 0 && contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h1[id], h2[id], h3[id], h4[id]');
      let current = '';
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          current = heading.id;
        }
      });
      if (current !== activeHeadingId) {
        setActiveHeadingId(current);
      }
    }
  }, [toc.length, activeHeadingId, book?.isPurchased, book?.isFree, saveProgressToServer]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Cleanup progress save timer on unmount
  useEffect(() => {
    return () => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    };
  }, []);

  const scrollToHeading = (id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    const container = scrollContainerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + container.scrollTop - 60;
      container.scrollTo({ top: offset, behavior: 'smooth' });
      setShowToc(false);
    }
  };

  const handlePurchase = async () => {
    setPurchaseError(null);
    try {
      await purchaseMutation.mutateAsync(bookId);
      setShowConfirm(false);
    } catch (err: any) {
      setPurchaseError(err?.response?.data?.error || err?.message || '购买失败');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        {/* Sticky header skeleton */}
        <div className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-8 w-8" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-32" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Cover banner skeleton */}
          <div className="h-44 bg-slate-200 dark:bg-slate-700 animate-pulse lg:flex lg:gap-8 lg:p-6 lg:h-auto">
            <div className="hidden lg:block lg:w-60 lg:shrink-0 lg:rounded-2xl lg:aspect-2/3 bg-slate-300 dark:bg-slate-600 animate-pulse" />
          </div>
          {/* Info section skeleton */}
          <div className="px-5 pt-4 pb-4 space-y-3">
            {/* Tags row */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-5 w-14" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-5 w-10" />
            </div>
            {/* Title */}
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-7 w-3/4" />
            {/* Author */}
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-24" />
            {/* Description lines */}
            <div className="space-y-2 pt-2">
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-full" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-5/6" />
              <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-4/6" />
            </div>
            {/* Purchase button skeleton */}
            <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-11 w-full mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="px-4 pt-14 pb-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">图书不存在或已被删除</p>
        </div>
      </div>
    );
  }

  const canAccess = book.isFree || book.isPurchased;
  const balance = currency?.campusPoints ?? 0;
  const canAfford = balance >= book.priceCampusPoints;
  const seriesBooks = book.seriesBooks?.filter(b => b.id !== bookId) ?? [];

  // ===== Comment handlers =====
  const comments = commentsData?.comments ?? [];
  const commentTotal = commentsData?.total ?? 0;

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createCommentMutation.mutateAsync({
        content: commentText.trim(),
        parentId: replyingTo?.id ?? null,
      });
      setCommentText('');
      setReplyingTo(null);
    } catch (e) {
      // silently fail
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这条评论吗？', destructive: true }))) return;
    try {
      await deleteCommentMutation.mutateAsync(commentId);
    } catch (e) {
      // silently fail
    }
  };

  const renderComment = (comment: BookCommentItem, isReply = false) => (
    <div key={comment.id} className={`flex gap-2.5 ${isReply ? 'ml-10 mt-3' : ''}`}>
      <img
        src={comment.authorAvatar || DEFAULT_AVATAR}
        className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover shrink-0`}
        alt=""
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-medium ${isReply ? 'text-xs' : 'text-sm'} text-slate-800 dark:text-slate-100`}>
            {comment.authorName}
          </span>
          {comment.replyToName && (
            <>
              <CornerDownRight size={10} className="text-slate-400 dark:text-slate-500" />
              <span className="text-xs text-indigo-500 dark:text-indigo-400">@{comment.replyToName}</span>
            </>
          )}
        </div>

        <p className={`${isReply ? 'text-xs' : 'text-sm'} text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-none`} {...longPressHandlers(comment.id)}>
          {comment.content}
        </p>

        <div className="flex items-center gap-3.5 mt-1.5">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(comment.createdAt)}</span>

          <button
            onClick={() => toggleLikeMutation.mutate(comment.id)}
            className={`flex items-center gap-0.5 text-[11px] ${comment.isLikedByMe ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500 hover:text-red-400'} transition-colors`}
          >
            <Heart size={12} fill={comment.isLikedByMe ? 'currentColor' : 'none'} />
            {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
          </button>

          {!isReply && (
            <button
              onClick={() => setReplyingTo({ id: comment.id, name: comment.authorName })}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:text-indigo-400 transition-colors"
            >
              回复
            </button>
          )}

          {comment.isAuthor && (
            <button
              onClick={() => handleDeleteComment(comment.id)}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* Sticker Reactions */}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {comment.reactions?.map(r => (
            <button
              key={r.stickerId}
              onClick={() => handleToggleReaction(comment.id, r.stickerId)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                r.hasReacted
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-200 dark:border-indigo-800'
              }`}
            >
              <Player autoplay loop src={r.stickerUrl} style={{ width: 14, height: 14 }} />
              <span>{r.count}</span>
            </button>
          ))}
        </div>

        {/* Nested replies */}
        {!isReply && comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 relative lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Reading progress bar */}
      {canAccess && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full bg-indigo-500 transition-all duration-150 ease-out"
            style={{ width: `${readingProgress}%` }}
          />
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{book.title}</h1>
            <div className="flex items-center gap-2">
              {book.authorName && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <User size={8} /> {book.authorName}
                </span>
              )}
              {book.categoryName && (
                <span className="text-[10px] text-indigo-500 dark:text-indigo-400">{book.categoryName}</span>
              )}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                <Eye size={8} /> {book.viewCount}
              </span>
            </div>
          </div>

          {/* TOC toggle */}
          {canAccess && toc.length > 0 && (
            <button
              onClick={() => setShowToc(true)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors relative"
            >
              <List size={18} className="text-slate-500 dark:text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {/* Book info card */}
        <div className="relative lg:flex lg:gap-8 lg:p-6">
          {/* Cover — mobile: banner, desktop: portrait sidebar */}
          <div className="h-44 relative overflow-hidden lg:h-auto lg:w-60 lg:shrink-0 lg:rounded-2xl lg:shadow-lg lg:aspect-2/3">
            {book.coverImageUrl ? (
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center">
                <BookOpen size={48} className="text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-slate-900 dark:via-slate-900/30 lg:hidden" />
          </div>

          <div className="px-5 -mt-14 relative z-10 pb-4 lg:mt-0 lg:px-0 lg:flex-1">
            {/* Tags row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {book.categoryName && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                  <Tag size={10} />
                  {book.categoryName}
                </span>
              )}
              {book.isFree ? (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  免费
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                  <Coins size={10} />
                  {book.priceCampusPoints} 校园点
                </span>
              )}
              {book.isPurchased && (
                <span className="text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
                  已购买
                </span>
              )}
              {book.isUserUploaded && (
                <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-2 py-0.5 rounded-full">
                  用户作品
                </span>
              )}
            </div>

            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mb-1 leading-tight">{book.title}</h2>

            {book.authorName && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {book.isUserUploaded && <User size={12} className="inline mr-1 -mt-0.5" />}
                {book.authorName}
              </p>
            )}

            {/* Continue Reading button — desktop only inline */}
            {canAccess && (
              <button
                onClick={() => {
                  const contentEl = contentRef.current;
                  if (contentEl) {
                    contentEl.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="hidden lg:inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors mb-4"
              >
                <BookOpen size={16} />
                继续阅读
              </button>
            )}

            {/* Synopsis */}
            {book.description && (
              <div className="lg:mt-2">
                <h3 className="hidden lg:block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">简介</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{book.description}</p>
              </div>
            )}

            {/* Series navigation */}
            {book.seriesName && book.seriesId && (
              <div className="mt-4 bg-indigo-50/60 dark:bg-indigo-950/60 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900">
                <button
                  onClick={() => onSeriesClick?.(book.seriesId!)}
                  className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-2"
                >
                  <BookMarked size={14} />
                  {book.seriesName}
                  {book.orderInSeries && (
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded-full">
                      第{book.orderInSeries}卷
                    </span>
                  )}
                  <ChevronRight size={12} className="ml-auto" />
                </button>
                {seriesBooks.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {[...(book.orderInSeries ? [book] : []), ...seriesBooks]
                      .sort((a, b) => (a.orderInSeries ?? 0) - (b.orderInSeries ?? 0))
                      .map((sb) => {
                        const isCurrent = sb.id === bookId;
                        return (
                          <button
                            key={sb.id}
                            onClick={() => !isCurrent && onBookClick?.(sb.id)}
                            className={`shrink-0 w-16 text-center transition-all ${
                              isCurrent ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            <div className={`w-16 h-20 rounded-lg overflow-hidden mb-1 border-2 ${
                              isCurrent ? 'border-indigo-500 shadow-md' : 'border-transparent'
                            }`}>
                              {sb.coverImageUrl ? (
                                <img src={sb.coverImageUrl} alt={sb.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                  <BookOpen size={14} className="text-white/40" />
                                </div>
                              )}
                            </div>
                            <p className={`text-[9px] truncate ${
                              isCurrent ? 'text-indigo-700 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              {sb.orderInSeries ? `第${sb.orderInSeries}卷` : sb.title}
                            </p>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Inline TOC for long articles */}
            {canAccess && toc.length > 2 && (
              <div className="mt-4 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setShowToc(true)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2.5"
                >
                  <List size={14} className="text-indigo-500 dark:text-indigo-400" />
                  目录
                </button>
                <div className="space-y-1">
                  {toc.slice(0, 8).map((item, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToHeading(item.id)}
                      className="block w-full text-left text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:text-indigo-400 transition-colors truncate"
                      style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                    >
                      <ChevronRight size={10} className="inline mr-1 opacity-40" />
                      {item.text}
                    </button>
                  ))}
                  {toc.length > 8 && (
                    <button
                      onClick={() => setShowToc(true)}
                      className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400 mt-1"
                    >
                      查看全部 {toc.length} 个章节...
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-5" />

        {/* Content area */}
        <div ref={contentRef} className="px-5 pt-6 pb-6">
          {canAccess ? (
            <article className="
              prose prose-slate dark:prose-invert max-w-none
              prose-headings:font-bold
              prose-h1:text-[1.35rem] prose-h1:border-b prose-h1:border-slate-200 dark:prose-h1:border-slate-700 prose-h1:pb-3 prose-h1:mb-6
              prose-h2:text-[1.15rem] prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-100 dark:prose-h2:border-slate-700
              prose-h3:text-[1rem] prose-h3:mt-7 prose-h3:mb-3
              prose-h4:text-sm prose-h4:mt-5 prose-h4:mb-2 prose-h4:uppercase prose-h4:tracking-wide
              prose-p:text-[15px] prose-p:leading-[1.85] prose-p:my-4
              prose-strong:font-semibold
              prose-li:text-[15px] prose-li:leading-[1.8]
              prose-img:rounded-xl prose-img:shadow-sm
            ">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={markdownComponents}
              >
                {book.content || '*暂无内容*'}
              </Markdown>
            </article>
          ) : (
            /* Locked content */
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center mx-auto mb-5 shadow-sm">
                <Lock size={32} className="text-amber-500 dark:text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">内容已锁定</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                需要 <span className="font-semibold text-amber-600 dark:text-amber-400">{book.priceCampusPoints}</span> 校园点解锁
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                当前余额: <span className="font-medium">{balance}</span> 校园点
              </p>

              <button
                onClick={() => { setPurchaseError(null); setShowConfirm(true); }}
                disabled={!canAfford}
                className={`px-8 py-3 rounded-xl text-sm font-medium transition-all ${
                  canAfford
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                {canAfford ? (
                  <span className="flex items-center gap-1.5">
                    <Coins size={14} />
                    购买解锁
                  </span>
                ) : (
                  '校园点不足'
                )}
              </button>
            </div>
          )}
        </div>

        {/* ===== Comment Section ===== */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 pt-5 pb-28 lg:pb-8">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={18} className="text-indigo-500 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">评论</h3>
            {commentTotal > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{commentTotal}</span>
            )}
          </div>

          {/* Comment input */}
          <div className="mb-5">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
                <CornerDownRight size={12} />
                <span>回复 @{replyingTo.name}</span>
                <button onClick={() => setReplyingTo(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyingTo ? `回复 @${replyingTo.name}...` : '写下你的评论...'}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || createCommentMutation.isPending}
                className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0 hover:bg-indigo-700 transition-colors active:scale-95"
              >
                {createCommentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          {/* Comment list */}
          {isLoadingComments ? (
            <div className="py-8 flex justify-center">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center">
              <MessageCircle size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400 dark:text-slate-500">还没有评论，来说两句吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => renderComment(comment))}
              {commentsData?.hasMore && (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">更多评论加载中...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TOC Drawer */}
      {showToc && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowToc(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[75%] max-w-xs bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <List size={16} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">目录</h3>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                  {toc.length}
                </span>
              </div>
              <button
                onClick={() => setShowToc(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={16} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {toc.map((item, i) => {
                const isActive = activeHeadingId === item.id;
                return (
                  <button
                    key={i}
                    onClick={() => scrollToHeading(item.id)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-start gap-2 ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-medium border-r-2 border-indigo-500'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                    style={{ paddingLeft: `${12 + (item.level - 1) * 16}px` }}
                  >
                    <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-indigo-500' : 'bg-slate-300'
                    } ${item.level === 1 ? 'w-2 h-2' : ''}`} />
                    <span className={`leading-tight ${item.level >= 3 ? 'text-xs' : ''}`}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Progress at bottom */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">阅读进度</span>
                <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">{readingProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Purchase confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">确认购买</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              《{book.title}》
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              将花费 <span className="font-semibold text-amber-600 dark:text-amber-400">{book.priceCampusPoints}</span> 校园点
              <br />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                购买后余额: {balance - book.priceCampusPoints} 校园点
              </span>
            </p>

            {purchaseError && (
              <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950 p-2 rounded-lg">{purchaseError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={purchaseMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchaseMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {purchaseMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Coins size={14} />
                )}
                确认购买
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
                      ? 'bg-indigo-500 text-white shadow-sm'
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
                    className="aspect-square rounded-xl hover:bg-indigo-50 dark:bg-indigo-950 p-1.5 transition-all active:scale-90"
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

      {/* CSS for drawer animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </div>
  );
};
