import React, { useState, useEffect, useRef } from 'react';
import { platformShare } from '../../lib/platform-actions';
import { Schedule, ScheduleSummary, ScheduleParticipant, FollowUserItem, UserSearchResult } from '../../types';
import { userProfileApi, scheduleSharingApi, followApi } from '../../lib/api';
import {
  useScheduleParticipants,
  useShareSchedule,
  useGenerateShareCode,
  useRemoveParticipant,
  usePublishScheduleToCommunity,
  useUnpublishScheduleFromCommunity,
} from '../../hooks/useMemory';
import {
  X,
  Search,
  Users,
  Link2,
  Check,
  Loader2,
  UserPlus,
  Crown,
  Trash2,
  AlertCircle,
  Share2,
  Send,
  Globe,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';

interface ShareScheduleModalProps {
  schedule: Schedule | ScheduleSummary;
  onClose: () => void;
}

type Tab = 'participants' | 'invite' | 'link' | 'publish';

interface SearchResult {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
}

export const ShareScheduleModal: React.FC<ShareScheduleModalProps> = ({
  schedule,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('participants');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  // Quick select from followed users
  const [followedUsers, setFollowedUsers] = useState<FollowUserItem[]>([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);

  // Publish custom content state
  const [publishDescription, setPublishDescription] = useState('');
  const [publishImages, setPublishImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Get Telegram WebApp
  const webApp = (window as any).Telegram?.WebApp;

  // Queries and mutations
  const { data: participants, isLoading: isLoadingParticipants } = useScheduleParticipants(schedule.id);
  const shareScheduleMutation = useShareSchedule();
  const generateShareCodeMutation = useGenerateShareCode();
  const removeParticipantMutation = useRemoveParticipant();
  const publishMutation = usePublishScheduleToCommunity();
  const unpublishMutation = useUnpublishScheduleFromCommunity();

  // Fetch followed users for quick select
  useEffect(() => {
    if (activeTab === 'invite' && followedUsers.length === 0) {
      const fetchFollowedUsers = async () => {
        setIsLoadingFollowed(true);
        try {
          const users = await followApi.getQuickSelect(50);
          // Filter out already invited users
          const participantIds = participants?.map(p => p.userId) || [];
          const filtered = users.filter(u => !participantIds.includes(u.id));
          setFollowedUsers(filtered);
        } catch (err) {
          console.error('Failed to fetch followed users:', err);
        } finally {
          setIsLoadingFollowed(false);
        }
      };
      fetchFollowedUsers();
    }
  }, [activeTab, participants]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const results = await userProfileApi.searchUsers(searchQuery);
        // Filter out already invited users
        const participantIds = participants?.map(p => p.userId) || [];
        const filtered = results.filter(r => !participantIds.includes(r.id));
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search failed:', err);
        setError('搜索失败');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, participants]);

  const handleToggleSelect = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleInvite = async () => {
    if (selectedUserIds.length === 0) return;

    setError(null);
    try {
      await shareScheduleMutation.mutateAsync({
        scheduleId: schedule.id,
        userIds: selectedUserIds,
      });
      setSelectedUserIds([]);
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('participants');
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请失败');
    }
  };

  const handleGenerateShareCode = async () => {
    setError(null);
    try {
      const result = await generateShareCodeMutation.mutateAsync(schedule.id);
      setShareCode(result.shareCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    }
  };

  const handleShareViaTelegram = async () => {
    if (!shareCode) return;

    const shareText = `邀请你参加日程「${schedule.title}」\n📅 ${schedule.date}\n⏰ ${schedule.startTime.slice(0, 5)}\n\n加入码: ${shareCode}`;
    const shared = await platformShare({ text: shareText, url: window.location.origin });
    if (!shared) {
      setError('已复制分享文本到剪贴板');
    }
  };

  const handleRemoveParticipant = async (userId: number) => {
    try {
      await removeParticipantMutation.mutateAsync({
        scheduleId: schedule.id,
        userId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除失败');
    }
  };

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync({
        scheduleId: schedule.id,
        request: {
          description: publishDescription.trim() || undefined,
          imageUrls: publishImages.length > 0 ? publishImages : undefined,
        },
      });
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
    }
  };

  const handleUnpublish = async () => {
    try {
      await unpublishMutation.mutateAsync(schedule.id);
      setIsPublished(false);
      setPublishDescription('');
      setPublishImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消发布失败');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check max images (9)
    if (publishImages.length + files.length > 9) {
      setError('最多上传9张图片');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      const uploadPromises = Array.from(files).map(file => scheduleSharingApi.uploadImage(file));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(r => r.imageUrl);
      setPublishImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setPublishImages(prev => prev.filter((_, i) => i !== index));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'participants', label: '参与者', icon: <Users size={16} /> },
    { id: 'invite', label: '邀请', icon: <UserPlus size={16} /> },
    { id: 'link', label: '分享', icon: <Send size={16} /> },
    { id: 'publish', label: '社区', icon: <Globe size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:w-[480px] sm:rounded-2xl rounded-t-[32px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Share2 size={20} className="text-primary" />
            分享日程
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Schedule Info */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{schedule.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {schedule.date} · {schedule.startTime.slice(0, 5)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="space-y-3">
              {isLoadingParticipants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : participants && participants.length > 0 ? (
                participants.map(participant => (
                  <ParticipantCard
                    key={participant.id}
                    participant={participant}
                    onRemove={() => handleRemoveParticipant(participant.userId)}
                    isRemoving={removeParticipantMutation.isPending}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">暂无参与者</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">邀请好友一起参与吧</p>
                </div>
              )}
            </div>
          )}

          {/* Invite Tab */}
          {activeTab === 'invite' && (
            <div className="space-y-4">
              {/* Quick Select from Followed Users */}
              {followedUsers.length > 0 && !searchQuery && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Users size={12} />
                    快速选择关注的人
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {followedUsers.slice(0, 10).map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleToggleSelect(user.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all ${
                          selectedUserIds.includes(user.id)
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                          {user.photoUrl ? (
                            <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white text-xs font-bold">
                              {user.firstName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="truncate max-w-[80px]">{user.firstName}</span>
                        {selectedUserIds.includes(user.id) && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingFollowed && !searchQuery && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              )}

              {/* Divider */}
              {followedUsers.length > 0 && !searchQuery && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">或搜索更多</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              )}

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索用户名..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:text-slate-500"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-slate-400 dark:text-slate-500" />
                )}
              </div>

              {/* Search Results */}
              <div className="space-y-2">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleToggleSelect(user.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      selectedUserIds.includes(user.id)
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white font-bold">
                          {user.firstName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {user.firstName} {user.lastName || ''}
                      </div>
                      {user.username && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">@{user.username}</div>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedUserIds.includes(user.id)
                        ? 'bg-primary border-primary text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {selectedUserIds.includes(user.id) && <Check size={14} />}
                    </div>
                  </div>
                ))}

                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                    未找到用户
                  </div>
                )}

                {searchQuery.length < 2 && followedUsers.length === 0 && !isLoadingFollowed && (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
                    输入用户名搜索
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Share Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                生成分享码后，可以通过 Telegram 发送给好友邀请他们加入日程。
              </p>

              {shareCode ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">分享码</div>
                    <div className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100">{shareCode}</div>
                  </div>

                  <button
                    onClick={handleShareViaTelegram}
                    className="w-full py-3 rounded-xl bg-[#0088cc] text-white font-medium flex items-center justify-center gap-2 hover:bg-[#0077b5] transition-colors"
                  >
                    <Send size={18} />
                    通过 Telegram 分享
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateShareCode}
                  disabled={generateShareCodeMutation.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-white font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {generateShareCodeMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Link2 size={18} />
                      生成分享码
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Publish to Community Tab */}
          {activeTab === 'publish' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                发布到社区后，所有社区成员都可以看到这个日程的信息。
              </p>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-slate-800 dark:text-slate-100">日程信息</h4>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="text-slate-400 dark:text-slate-500">标题：</span>{schedule.title}</p>
                  <p><span className="text-slate-400 dark:text-slate-500">日期：</span>{schedule.date}</p>
                  <p><span className="text-slate-400 dark:text-slate-500">时间：</span>{schedule.startTime.slice(0, 5)}</p>
                  {schedule.location && (
                    <p><span className="text-slate-400 dark:text-slate-500">地点：</span>{schedule.location}</p>
                  )}
                </div>
              </div>

              {isPublished ? (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <Check size={16} />
                    日程已发布到社区
                  </div>
                  <button
                    onClick={handleUnpublish}
                    disabled={unpublishMutation.isPending}
                    className="w-full py-3 rounded-xl bg-slate-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {unpublishMutation.isPending ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        取消中...
                      </>
                    ) : (
                      '取消发布'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Custom Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                      添加说明（可选）
                    </label>
                    <textarea
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                      placeholder="分享你的想法..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:text-slate-500 resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="text-right text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {publishDescription.length}/500
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                      添加图片（可选，最多9张）
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {publishImages.map((url, index) => (
                        <div key={index} className="aspect-square relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {publishImages.length < 9 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary flex items-center justify-center cursor-pointer transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={isUploadingImage}
                          />
                          {isUploadingImage ? (
                            <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
                          ) : (
                            <Plus size={24} className="text-slate-400 dark:text-slate-500" />
                          )}
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Publish Button */}
                  <button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending || isUploadingImage}
                    className="w-full py-3 rounded-xl bg-primary text-white font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {publishMutation.isPending ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        发布中...
                      </>
                    ) : (
                      <>
                        <Globe size={18} />
                        发布到社区
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Invite Button */}
        {activeTab === 'invite' && selectedUserIds.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleInvite}
              disabled={shareScheduleMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {shareScheduleMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  邀请中...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  邀请 {selectedUserIds.length} 人
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Participant Card Component
interface ParticipantCardProps {
  participant: ScheduleParticipant;
  onRemove: () => void;
  isRemoving: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  onRemove,
  isRemoving,
}) => {
  const isOwner = participant.role === 'OWNER';
  const isPending = participant.status === 'PENDING';

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
        {participant.userAvatar ? (
          <img src={participant.userAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold">
            {participant.userName.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
          {participant.userName}
          {isOwner && (
            <Crown size={14} className="text-amber-500 dark:text-amber-400" />
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {isOwner ? '创建者' : isPending ? '待接受' : '参与者'}
        </div>
      </div>
      {!isOwner && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

export default ShareScheduleModal;
