import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, ImagePlus, X, Loader2, Trash2, CornerDownRight, ChevronDown, ChevronUp } from 'lucide-react';
import { guestbookApi, GuestbookEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useUserProfileNavigation } from '../layout/MainLayout';
import { toast } from 'sonner';

interface GuestbookSectionProps {
  profileUserId: number;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
};

export const GuestbookSection: React.FC<GuestbookSectionProps> = ({ profileUserId }) => {
  const { user: currentUser, hasPermission } = useAuth();
  const { viewUserProfile } = useUserProfileNavigation();
  const queryClient = useQueryClient();
  const isOwnProfile = currentUser?.id === profileUserId;

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ parentId: number; replyToCommentId?: number; replyToName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['guestbook', profileUserId],
    queryFn: () => guestbookApi.getEntries(profileUserId, 50),
    staleTime: 60_000,
  });

  const entries = data?.entries ?? [];
  const displayEntries = expanded ? entries : entries.slice(0, 3);

  const handleSend = async () => {
    if (isSending || (!content.trim() && !imageKey)) return;

    setIsSending(true);
    try {
      await guestbookApi.postEntry(profileUserId, {
        content: content.trim(),
        imageUrl: imageKey,
        parentId: replyTo?.parentId ?? null,
        replyToCommentId: replyTo?.replyToCommentId ?? null,
      });
      setContent('');
      setImageKey(null);
      setImagePreview(null);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['guestbook', profileUserId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    try {
      await guestbookApi.deleteEntry(entryId);
      queryClient.invalidateQueries({ queryKey: ['guestbook', profileUserId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片不能超过5MB');
      return;
    }
    setIsUploading(true);
    try {
      const result = await guestbookApi.uploadImage(file);
      setImageKey(result.imageKey);
      setImagePreview(result.imageUrl);
    } catch {
      toast.error('图片上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReply = (entry: GuestbookEntry, isReplyToReply = false) => {
    // For top-level entries, parentId = entry.id
    // For replies to replies, parentId = entry.parentId (the top-level), replyToCommentId = entry.id
    setReplyTo({
      parentId: isReplyToReply ? entry.parentId! : entry.id,
      replyToCommentId: isReplyToReply ? entry.id : undefined,
      replyToName: entry.authorName || '匿名',
    });
  };

  const renderEntry = (entry: GuestbookEntry, isReply = false) => {
    const canDelete = currentUser && (entry.authorId === currentUser.id || profileUserId === currentUser.id || hasPermission('comment.moderate'));
    const avatarUrl = entry.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.authorName || 'U')}&background=EE5A7C&color=fff&size=64`;

    return (
      <div key={entry.id} className={`${isReply ? 'pl-10' : ''}`}>
        <div className="flex gap-2.5 py-2.5">
          <button
            onClick={() => !entry.isDeleted && viewUserProfile(entry.authorId)}
            className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0"
          >
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => !entry.isDeleted && viewUserProfile(entry.authorId)}
                className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
              >
                {entry.isDeleted ? '已删除' : entry.authorName || '匿名'}
              </button>
              {!entry.isDeleted && entry.authorLevel > 0 && (
                <span className="text-[10px] text-primary/70 font-medium">Lv.{entry.authorLevel}</span>
              )}
              {isReply && entry.replyToUserName && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  <CornerDownRight size={10} className="inline mr-0.5" />
                  {entry.replyToUserName}
                </span>
              )}
            </div>
            <p className={`text-sm mt-0.5 ${entry.isDeleted ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-600 dark:text-slate-300'}`}>
              {entry.content}
            </p>
            {entry.imageUrl && !entry.isDeleted && (
              <img src={entry.imageUrl} alt="" className="mt-1.5 max-h-32 rounded-lg object-cover" />
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(entry.createdAt)}</span>
              {!entry.isDeleted && !isOwnProfile && (
                <button
                  onClick={() => handleReply(entry, isReply)}
                  className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
                >
                  回复
                </button>
              )}
              {canDelete && !entry.isDeleted && (
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-soft mb-6 border border-slate-50 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-violet-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">留言板</h3>
          {data && data.total > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">({data.total})</span>
          )}
        </div>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 italic">
          {isOwnProfile ? '还没有人留言，分享你的主页给朋友吧' : '还没有留言，成为第一个留言的人吧'}
        </p>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {displayEntries.map(entry => (
              <div key={entry.id}>
                {renderEntry(entry)}
                {entry.replies?.map(reply => renderEntry(reply, true))}
              </div>
            ))}
          </div>
          {entries.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-primary py-2 transition-colors"
            >
              {expanded ? (
                <><ChevronUp size={14} /> 收起</>
              ) : (
                <><ChevronDown size={14} /> 查看全部 {entries.length} 条留言</>
              )}
            </button>
          )}
        </>
      )}

      {/* Input area - only show for other users */}
      {!isOwnProfile && currentUser && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-400 dark:text-slate-500">
              <CornerDownRight size={12} />
              <span>回复 {replyTo.replyToName}</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-slate-600 dark:hover:text-slate-300">
                <X size={12} />
              </button>
            </div>
          )}
          {imagePreview && (
            <div className="relative w-20 h-20 mb-2">
              <img src={imagePreview} alt="" className="w-full h-full object-cover rounded-lg" />
              <button
                onClick={() => { setImageKey(null); setImagePreview(null); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value.slice(0, 500))}
                placeholder="留下你的留言..."
                rows={1}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || (!content.trim() && !imageKey)}
              className="p-2 text-primary hover:text-primary/80 transition-colors disabled:opacity-30"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      )}
    </div>
  );
};
