'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PostItem,
  PostCategory,
  POST_CATEGORY_NAMES,
  CreatePostRequest,
  CreatePollRequest,
  PollType,
  PollSelectionType,
} from '../../types';
import { postsApi, specialItemsApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import {
  MessageSquare,
  Heart,
  Eye,
  Plus,
  X,
  Loader2,
  Pin,
  Image as ImageIcon,
  UserX,
  BarChart2,
  Trash2,
  ChevronDown,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Code,
  Link,
  Quote,
  EyeIcon,
  Pencil,
  Star,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { DateTimePickerSheet } from '@/components/ui/mobile-picker';

interface CommunityTabProps {
  onUserClick?: (userId: number) => void;
  onPostClick?: (postId: number) => void;
  onCreateModalChange?: (isOpen: boolean) => void;
  onOpenCreateModal?: () => void;  // Trigger from parent to open create modal
  createModalTrigger?: number;     // Increment to trigger open
}

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

// Category colors
const CATEGORY_COLORS: Record<PostCategory, string> = {
  GENERAL: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  HELP: 'bg-orange-100 text-orange-600 dark:text-orange-400',
  SHARE: 'bg-blue-100 text-blue-600 dark:text-blue-400',
  EXPERIENCE: 'bg-green-100 text-green-600 dark:text-green-400',
  QUESTION: 'bg-purple-100 text-purple-600 dark:text-purple-400',
  ANNOUNCEMENT: 'bg-red-100 text-red-600 dark:text-red-400',
};

export const CommunityTab: React.FC<CommunityTabProps> = ({ onUserClick, onPostClick, onCreateModalChange, createModalTrigger }) => {
  // Get current user info
  const { user, hasPermission } = useAuth();
  const confirm = useConfirm();
  const canModerate = hasPermission('comment.moderate');
  const canFeature = hasPermission('post.feature');
  const currentUserId = user?.id ?? 0;

  // List view state
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | undefined>(undefined);

  // Infinite scroll refs
  const postsSentinelRef = useRef<HTMLDivElement>(null);

  // Long-press context menu state
  const [contextMenuPost, setContextMenuPost] = useState<PostItem | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Create post modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);  // For animation
  const [newPostCategory, setNewPostCategory] = useState<PostCategory>('GENERAL');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);  // preview blob URLs
  const [newPostImageKeys, setNewPostImageKeys] = useState<string[]>([]);  // MinIO keys for API
  const [newPostIsAnonymous, setNewPostIsAnonymous] = useState(false);  // 匿名发帖
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [anonymousTokenCount, setAnonymousTokenCount] = useState<number | null>(null);

  // Poll creation state
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollType, setPollType] = useState<PollType>('NORMAL');
  const [pollSelectionType, setPollSelectionType] = useState<PollSelectionType>('SINGLE');
  const [pollMaxSelections, setPollMaxSelections] = useState(2);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollEndTime, setPollEndTime] = useState<string>('');

  // Markdown editor state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Insert markdown syntax at cursor position
  const insertMarkdown = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newPostContent.substring(start, end);
    const insertText = selectedText || placeholder;
    const newContent = newPostContent.substring(0, start) + before + insertText + after + newPostContent.substring(end);
    setNewPostContent(newContent);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + before.length + insertText.length;
      textarea.setSelectionRange(
        selectedText ? cursorPos + after.length : start + before.length,
        selectedText ? cursorPos + after.length : start + before.length + placeholder.length
      );
    });
  };

  // Handle modal open/close with animation
  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    // Double requestAnimationFrame ensures browser has rendered the initial state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsCreateModalVisible(true);
      });
    });
  };

  const closeCreateModal = () => {
    setIsCreateModalVisible(false);
    setTimeout(() => {
      setIsCreateModalOpen(false);
      newPostImages.forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
      setNewPostImages([]);
      setNewPostImageKeys([]);
      setIsPreviewMode(false);
    }, 300);  // Match animation duration
  };

  // Fetch posts
  const fetchPosts = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const response = await postsApi.getPosts(selectedCategory, 20, newOffset);
      if (reset) {
        setPosts(response.posts);
        setOffset(20);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
        setOffset(prev => prev + 20);
      }
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, offset]);

  useEffect(() => {
    fetchPosts(true);
  }, [selectedCategory]);

  // Notify parent when create modal state changes
  useEffect(() => {
    onCreateModalChange?.(isCreateModalOpen);
  }, [isCreateModalOpen, onCreateModalChange]);

  // Open create modal when triggered from parent (only on change, not initial mount)
  const prevTriggerRef = React.useRef(createModalTrigger);
  useEffect(() => {
    // Only trigger if value changed AND is greater than previous (meaning it was incremented)
    if (createModalTrigger !== undefined && createModalTrigger > (prevTriggerRef.current || 0)) {
      openCreateModal();
    }
    prevTriggerRef.current = createModalTrigger;
  }, [createModalTrigger]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const sentinel = postsSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchPosts(false);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchPosts]);

  // Handle post click - navigate to detail page
  const handlePostClick = (postId: number) => {
    if (onPostClick) {
      onPostClick(postId);
    }
  };

  // Toggle like
  const handleToggleLike = async (postId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await postsApi.toggleLike(postId);
      // Update local state
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, isLikedByMe: !p.isLikedByMe, likeCount: p.likeCount + (p.isLikedByMe ? -1 : 1) }
          : p
      ));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Validate poll options
  const getValidPollOptions = () => {
    return pollOptions.filter(opt => opt.trim().length > 0);
  };

  // Create post
  const handleCreatePost = async () => {
    // Content can be empty if poll is enabled
    if (!newPostTitle.trim()) return;
    if (!isPollEnabled && !newPostContent.trim()) return;

    // Validate poll if enabled
    if (isPollEnabled) {
      const validOptions = getValidPollOptions();
      if (validOptions.length < 2) {
        toast.warning('投票至少需要2个选项');
        return;
      }
    }

    setIsCreating(true);
    try {
      const request: CreatePostRequest = {
        category: newPostCategory,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        imageUrls: newPostImageKeys,
        isAnonymous: newPostIsAnonymous,
      };

      // Add poll if enabled
      if (isPollEnabled) {
        const validOptions = getValidPollOptions();
        const pollRequest: CreatePollRequest = {
          pollType: pollType,
          selectionType: pollSelectionType,
          maxSelections: pollSelectionType === 'MULTIPLE' ? pollMaxSelections : 1,
          options: validOptions,
        };
        if (pollEndTime) {
          pollRequest.endTime = new Date(pollEndTime).toISOString();
        }
        request.poll = pollRequest;
      }

      await postsApi.createPost(request);
      closeCreateModal();
      // Reset all form state
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategory('GENERAL');
      // Revoke blob URLs
      newPostImages.forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
      setNewPostImages([]);
      setNewPostImageKeys([]);
      setNewPostIsAnonymous(false);
      setIsPreviewMode(false);
      setIsPollEnabled(false);
      setPollType('NORMAL');
      setPollSelectionType('SINGLE');
      setPollMaxSelections(2);
      setPollOptions(['', '']);
      setPollEndTime('');
      // Refresh posts list
      fetchPosts(true);
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle image upload - uploads to server and stores keys + local preview URLs
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (newPostImages.length + files.length > 9) {
      toast.warning('最多上传9张图片');
      return;
    }

    setIsUploadingImage(true);
    try {
      const fileArray: File[] = Array.from(files);
      // Upload to server
      const { imageKeys } = await postsApi.uploadImages(fileArray);
      // Create local preview URLs
      const previewUrls = fileArray.map(file => URL.createObjectURL(file));
      setNewPostImages(prev => [...prev, ...previewUrls]);
      setNewPostImageKeys(prev => [...prev, ...imageKeys]);
    } catch (err) {
      console.error('Failed to upload images:', err);
      toast.error('图片上传失败，请重试');
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    // Revoke blob URL to free memory
    const url = newPostImages[index];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setNewPostImages(prev => prev.filter((_, i) => i !== index));
    setNewPostImageKeys(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch anonymous token count when create modal opens
  useEffect(() => {
    if (!isCreateModalOpen) return;
    specialItemsApi.getInventory().then(items => {
      const token = items.find(i => i.itemType === 'ANONYMOUS_TOKEN');
      setAnonymousTokenCount(token?.quantity ?? 0);
    }).catch(() => setAnonymousTokenCount(0));
  }, [isCreateModalOpen]);

  // Long-press handlers
  const handleLongPressStart = useCallback((post: PostItem) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setContextMenuPost(post);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePostCardClick = useCallback((postId: number) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    handlePostClick(postId);
  }, []);

  // Pin post handler (author only, uses POST_PIN item)
  const handlePinPost = async (postId: number) => {
    setContextMenuPost(null);
    try {
      await postsApi.pinPost(postId);
      toast.success('帖子已置顶 24h');
    } catch (err: any) {
      toast.error(err?.message ?? '置顶失败');
    }
  };

  // Feature post handler (admin only)
  const handleFeaturePost = async (postId: number, featured: boolean) => {
    setContextMenuPost(null);
    try {
      await postsApi.featurePost(postId, featured);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, isFeatured: featured } : p));
      toast.success(featured ? '已标记为精华' : '已取消精华');
    } catch (err: any) {
      toast.error(err?.message ?? '操作失败');
    }
  };

  // Delete post
  const handleDeletePost = async (postId: number) => {
    setContextMenuPost(null);
    if (!(await confirm({ title: '确认删除', description: '确定要删除这篇帖子吗？', destructive: true }))) return;

    try {
      await postsApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Add poll option
  const handleAddPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  // Remove poll option
  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  // Update poll option
  const handlePollOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  // Render post card (shared between all and my posts)
  const renderPostCard = (post: PostItem) => (
    <div
      key={post.id}
      onClick={() => handlePostCardClick(post.id)}
      onMouseDown={() => handleLongPressStart(post)}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
      onTouchStart={() => handleLongPressStart(post)}
      onTouchEnd={handleLongPressEnd}
      onTouchMove={handleLongPressEnd}
      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors select-none"
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-2">
        {post.isAnonymous ? (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <UserX size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
        ) : (
          <img
            src={post.authorAvatar || DEFAULT_AVATAR}
            className="w-8 h-8 rounded-full object-cover"
            alt=""
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{post.authorName}</span>
            {!post.isAnonymous && (
              <span className="text-xs text-slate-400 dark:text-slate-500">Lv.{post.authorLevel}</span>
            )}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(post.createdAt)}</span>
        </div>
        {post.isPinned && (
          <Pin size={14} className="text-orange-500 dark:text-orange-400" />
        )}
      </div>

      {/* Title & category */}
      <div className="flex items-start gap-2 mb-1">
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[post.category]}`}>
          {POST_CATEGORY_NAMES[post.category]}
        </span>
        {/* Source type badge */}
        {post.sourceType && post.sourceType !== 'NONE' && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
            post.sourceType === 'SCHEDULE' ? 'bg-primary/10 text-primary' : 'bg-pink-100 text-pink-600 dark:text-pink-400'
          }`}>
            {post.sourceType === 'SCHEDULE' ? '📅' : '📸'}
          </span>
        )}
        {/* Poll badge */}
        {post.hasPoll && (
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-600 dark:text-purple-400 shrink-0">
            📊 投票
          </span>
        )}
        {/* Featured badge */}
        {post.isFeatured && (
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">精华</span>
        )}
        {/* Hot badge */}
        {post.isHot && (
          <span className="shrink-0 text-sm" title="今日热帖">🔥</span>
        )}
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex-1 line-clamp-1">{post.title}</h3>
      </div>

      {/* Content preview */}
      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">{post.contentPreview}</p>

      {/* Poll summary */}
      {post.hasPoll && post.pollSummary && (
        <div className="mb-2 px-3 py-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
            <BarChart2 size={14} />
            <span>{post.pollSummary.optionCount}个选项 · {post.pollSummary.totalVotes}人参与</span>
            {post.pollSummary.hasVoted && (
              <span className="text-green-600 dark:text-green-400">✓ 已投票</span>
            )}
            {post.pollSummary.isEnded && (
              <span className="text-slate-400 dark:text-slate-500">已结束</span>
            )}
          </div>
        </div>
      )}

      {/* Images preview */}
      {post.imageUrls.length > 0 && (
        <div className="flex gap-1 mb-2">
          {post.imageUrls.slice(0, 3).map((url, i) => (
            <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
              <img src={url} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
          {post.imageUrls.length > 3 && (
            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              +{post.imageUrls.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <Eye size={14} />
          {post.viewCount}
        </span>
        <button
          onClick={(e) => handleToggleLike(post.id, e)}
          className={`flex items-center gap-1 ${post.isLikedByMe ? 'text-red-500 dark:text-red-400' : ''}`}
        >
          <Heart size={14} fill={post.isLikedByMe ? 'currentColor' : 'none'} />
          {post.likeCount}
        </button>
        <span className="flex items-center gap-1">
          <MessageSquare size={14} />
          {post.commentCount}
        </span>
      </div>
    </div>
  );

  // Render post list
  const renderPostList = () => (
    <div className="flex flex-col">
      {/* Category filter */}
      <div className="sticky top-0 z-10 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <button
          onClick={() => setSelectedCategory(undefined)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCategory === undefined
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          全部
        </button>
        {(Object.keys(POST_CATEGORY_NAMES) as PostCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {POST_CATEGORY_NAMES[cat]}
          </button>
        ))}
      </div>

      {/* Post list */}
      <div>
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare size={48} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 dark:text-slate-500">还没有帖子，来发一个吧</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {posts.map(post => renderPostCard(post))}

            {/* Infinite scroll sentinel */}
            <div ref={postsSentinelRef} className="py-3">
              {isLoading && posts.length > 0 && (
                <div className="flex justify-center">
                  <Loader2 className="animate-spin text-slate-300" size={20} />
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <p className="text-center text-xs text-slate-300">已加载全部</p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );

  // Check if create button should be enabled
  const canCreatePost = () => {
    if (!newPostTitle.trim()) return false;
    if (isPollEnabled) {
      const validOptions = getValidPollOptions();
      return validOptions.length >= 2;
    }
    return newPostContent.trim().length > 0;
  };

  // Render create modal
  const renderCreateModal = () => (
    <div className={`fixed inset-0 z-50 flex items-end justify-center transition-colors duration-300 ${
      isCreateModalVisible ? 'bg-black/50' : 'bg-black/0'
    }`}>
      <div className={`w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[90vh] flex flex-col transition-transform duration-300 ease-out ${
        isCreateModalVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <button onClick={closeCreateModal} className="text-slate-400 dark:text-slate-500">
            取消
          </button>
          <span className="font-semibold">发帖</span>
          <button
            onClick={handleCreatePost}
            disabled={!canCreatePost() || isCreating || isUploadingImage}
            className="text-primary font-medium disabled:opacity-50"
          >
            {isCreating ? '发布中...' : '发布'}
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Category select */}
          <div className="mb-4">
            <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">分类</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(POST_CATEGORY_NAMES) as PostCategory[]).filter(c => canFeature || c !== 'ANNOUNCEMENT').map(cat => (
                <button
                  key={cat}
                  onClick={() => setNewPostCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    newPostCategory === cat
                      ? 'bg-primary text-white'
                      : CATEGORY_COLORS[cat]
                  }`}
                >
                  {POST_CATEGORY_NAMES[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <input
              type="text"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              placeholder="标题（必填）"
              maxLength={200}
              className="w-full px-0 py-2 text-lg font-semibold border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Content - Markdown Editor */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsPreviewMode(false)}
                className={`p-1.5 rounded transition-colors ${!isPreviewMode ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="编辑"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewMode(true)}
                className={`p-1.5 rounded transition-colors ${isPreviewMode ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="预览"
              >
                <EyeIcon size={16} />
              </button>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button type="button" onClick={() => insertMarkdown('**', '**', '粗体')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="粗体"><Bold size={16} /></button>
              <button type="button" onClick={() => insertMarkdown('*', '*', '斜体')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="斜体"><Italic size={16} /></button>
              <button type="button" onClick={() => insertMarkdown('## ', '', '标题')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="标题"><Heading2 size={16} /></button>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button type="button" onClick={() => insertMarkdown('- ', '', '列表项')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="无序列表"><List size={16} /></button>
              <button type="button" onClick={() => insertMarkdown('1. ', '', '列表项')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="有序列表"><ListOrdered size={16} /></button>
              <button type="button" onClick={() => insertMarkdown('> ', '', '引用')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="引用"><Quote size={16} /></button>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button type="button" onClick={() => insertMarkdown('`', '`', '代码')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="行内代码"><Code size={16} /></button>
              <button type="button" onClick={() => insertMarkdown('[', '](url)', '链接文字')} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200" title="链接"><Link size={16} /></button>
            </div>

            {/* Editor / Preview area */}
            {isPreviewMode ? (
              <div className="p-4 min-h-45 max-h-75 overflow-y-auto">
                {newPostContent.trim() ? (
                  <article className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-li:my-0.5 prose-img:rounded-lg">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {newPostContent}
                    </Markdown>
                  </article>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 text-sm">预览区域（请先输入内容）</p>
                )}
              </div>
            ) : (
              <textarea
                ref={contentTextareaRef}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="支持 Markdown 格式，分享你的想法..."
                maxLength={5000}
                rows={8}
                className="w-full px-4 py-3 border-0 resize-none focus:outline-none text-sm font-mono"
              />
            )}

            {/* Footer hint */}
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">支持 Markdown 语法</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{newPostContent.length}/5000</span>
            </div>
          </div>

          {/* Anonymous toggle */}
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div
              onClick={() => setNewPostIsAnonymous(!newPostIsAnonymous)}
              className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserX size={20} className={newPostIsAnonymous ? 'text-purple-500 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'} />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                    匿名发布
                    {anonymousTokenCount !== null && (
                      <span className={`ml-1.5 text-xs font-normal ${anonymousTokenCount === 0 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        (剩余 {anonymousTokenCount} 枚令牌)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {anonymousTokenCount === 0 ? '需要匿名令牌，请前往商店购买' : '消耗一枚匿名令牌，其他用户将看不到你的身份'}
                  </div>
                </div>
              </div>
              <div className={`
                w-12 h-7 rounded-full transition-colors relative
                ${newPostIsAnonymous ? 'bg-purple-500' : 'bg-slate-300'}
              `}>
                <div className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-sm transition-transform
                  ${newPostIsAnonymous ? 'translate-x-6' : 'translate-x-1'}
                `}></div>
              </div>
            </div>
          </div>

          {/* Image upload section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-500 dark:text-slate-400">图片 ({newPostImages.length}/9)</label>
              {isUploadingImage && (
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Loader2 className="animate-spin" size={12} />
                  上传中...
                </span>
              )}
            </div>

            {/* Image preview grid */}
            <div className="grid grid-cols-3 gap-2">
              {newPostImages.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {/* Add image button */}
              {newPostImages.length < 9 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                  <ImageIcon size={24} className="text-slate-300 mb-1" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">添加图片</span>
                </label>
              )}
            </div>
          </div>

          {/* Poll toggle */}
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div
              onClick={() => setIsPollEnabled(!isPollEnabled)}
              className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart2 size={20} className={isPollEnabled ? 'text-purple-500 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'} />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">添加投票</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">让用户参与投票</div>
                </div>
              </div>
              <div className={`
                w-12 h-7 rounded-full transition-colors relative
                ${isPollEnabled ? 'bg-purple-500' : 'bg-slate-300'}
              `}>
                <div className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-sm transition-transform
                  ${isPollEnabled ? 'translate-x-6' : 'translate-x-1'}
                `}></div>
              </div>
            </div>
          </div>

          {/* Poll creation form */}
          {isPollEnabled && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-2xl">
              {/* Poll options */}
              <div className="mb-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block font-medium">投票选项 ({getValidPollOptions().length}/10)</label>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handlePollOptionChange(index, e.target.value)}
                        placeholder={`选项 ${index + 1}`}
                        maxLength={200}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-purple-400"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => handleRemovePollOption(index)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 10 && (
                  <button
                    onClick={handleAddPollOption}
                    className="mt-2 text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1"
                  >
                    <Plus size={16} />
                    添加选项
                  </button>
                )}
              </div>

              {/* Poll type */}
              <div className="mb-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block font-medium">投票类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPollType('NORMAL')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      pollType === 'NORMAL'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    普通投票
                  </button>
                  <button
                    onClick={() => setPollType('ANONYMOUS')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      pollType === 'ANONYMOUS'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    匿名投票
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {pollType === 'NORMAL' ? '其他用户可以看到谁投了哪个选项' : '投票者信息保密'}
                </p>
              </div>

              {/* Selection type */}
              <div className="mb-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block font-medium">选择方式</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPollSelectionType('SINGLE')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      pollSelectionType === 'SINGLE'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    单选
                  </button>
                  <button
                    onClick={() => setPollSelectionType('MULTIPLE')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      pollSelectionType === 'MULTIPLE'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    多选
                  </button>
                </div>
              </div>

              {/* Max selections (for multiple choice) */}
              {pollSelectionType === 'MULTIPLE' && (
                <div className="mb-4">
                  <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block font-medium">
                    最多可选 {pollMaxSelections} 项
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={2}
                      max={Math.min(pollOptions.length, 10)}
                      value={pollMaxSelections}
                      onChange={(e) => setPollMaxSelections(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-purple-600 dark:text-purple-400 font-medium w-8 text-center">
                      {pollMaxSelections}
                    </span>
                  </div>
                </div>
              )}

              {/* End time (optional) */}
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block font-medium">截止时间（可选）</label>
                <DateTimePickerSheet
                  value={pollEndTime}
                  onChange={setPollEndTime}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">不设置则投票永不结束</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {renderPostList()}
      {isCreateModalOpen && renderCreateModal()}

      {/* Long-press context menu bottom sheet — portaled to body so it covers the bottom nav */}
      {contextMenuPost && createPortal(
        <div className="fixed inset-0 z-70 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setContextMenuPost(null)} />
          <div className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl px-4 pt-4 pb-safe-or-8 flex flex-col gap-1" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            {/* Post title preview */}
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 px-2 line-clamp-1">{contextMenuPost.title}</p>

            {/* Pin — author only */}
            {contextMenuPost.authorId === currentUserId && (
              <button
                onClick={() => handlePinPost(contextMenuPost.id)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-left"
              >
                <Pin size={18} className="text-orange-500 shrink-0" />
                <span className="text-sm font-medium">使用置顶卡置顶</span>
              </button>
            )}

            {/* Feature — requires post.feature permission */}
            {canFeature && (
              <button
                onClick={() => handleFeaturePost(contextMenuPost.id, !contextMenuPost.isFeatured)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-left"
              >
                <Star size={18} className={contextMenuPost.isFeatured ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} fill={contextMenuPost.isFeatured ? 'currentColor' : 'none'} />
                <span className="text-sm font-medium">{contextMenuPost.isFeatured ? '取消精华' : '标为精华'}</span>
              </button>
            )}

            {/* Delete — author or moderator */}
            {(contextMenuPost.authorId === currentUserId || canModerate) && (
              <button
                onClick={() => handleDeletePost(contextMenuPost.id)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 text-left"
              >
                <Trash2 size={18} className="shrink-0" />
                <span className="text-sm font-medium">删除帖子</span>
              </button>
            )}

            <button
              onClick={() => setContextMenuPost(null)}
              className="mt-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CommunityTab;
