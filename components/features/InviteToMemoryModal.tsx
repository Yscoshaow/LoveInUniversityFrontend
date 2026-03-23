import React, { useState, useEffect } from 'react';
import { platformShare } from '../../lib/platform-actions';
import { userProfileApi, followApi } from '../../lib/api';
import { useInviteToMemory, useRemoveMemoryInvitation, useGenerateMemoryShareCode } from '../../hooks/useMemory';
import type { InvitedUser, FollowUserItem, UserSearchResult } from '../../types';
import {
  X,
  Search,
  Users,
  Check,
  Loader2,
  UserPlus,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  Send,
  Link2,
} from 'lucide-react';

interface InviteToMemoryModalProps {
  memoryId: number;
  memoryTitle?: string;
  invitedUsers: InvitedUser[] | null;
  onClose: () => void;
  onUpdated?: () => void;
}

type Tab = 'invited' | 'search' | 'share';

interface SearchResult {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
}

export const InviteToMemoryModal: React.FC<InviteToMemoryModalProps> = ({
  memoryId,
  memoryTitle,
  invitedUsers,
  onClose,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('invited');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick select from followed users
  const [followedUsers, setFollowedUsers] = useState<FollowUserItem[]>([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);

  // Get Telegram WebApp
  const webApp = (window as any).Telegram?.WebApp;

  const inviteMutation = useInviteToMemory();
  const removeInvitationMutation = useRemoveMemoryInvitation();
  const generateShareCodeMutation = useGenerateMemoryShareCode();

  // Fetch followed users for quick select
  useEffect(() => {
    if (activeTab === 'search' && followedUsers.length === 0) {
      const fetchFollowedUsers = async () => {
        setIsLoadingFollowed(true);
        try {
          const users = await followApi.getQuickSelect(50);
          // Filter out already invited users
          const invitedIds = invitedUsers?.map(u => u.userId) || [];
          const filtered = users.filter(u => !invitedIds.includes(u.id));
          setFollowedUsers(filtered);
        } catch (err) {
          console.error('Failed to fetch followed users:', err);
        } finally {
          setIsLoadingFollowed(false);
        }
      };
      fetchFollowedUsers();
    }
  }, [activeTab, invitedUsers]);

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
        const invitedIds = invitedUsers?.map(u => u.userId) || [];
        const filtered = results.filter(r => !invitedIds.includes(r.id));
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search failed:', err);
        setError('搜索失败');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, invitedUsers]);

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
      await inviteMutation.mutateAsync({
        memoryId,
        request: { userIds: selectedUserIds },
      });
      setSelectedUserIds([]);
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('invited');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请失败');
    }
  };

  const handleRemoveInvitation = async (userId: number) => {
    try {
      await removeInvitationMutation.mutateAsync({ memoryId, userId });
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除失败');
    }
  };

  const handleGenerateShareCode = async () => {
    setError(null);
    try {
      const result = await generateShareCodeMutation.mutateAsync(memoryId);
      setShareCode(result.shareCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    }
  };

  const handleShareViaTelegram = async () => {
    if (!shareCode) return;

    const title = memoryTitle || '回忆';
    const shareText = `邀请你查看我的回忆「${title}」\n\n加入码: ${shareCode}`;
    const shared = await platformShare({ text: shareText, url: window.location.origin });
    if (!shared) {
      setError('已复制分享文本到剪贴板');
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'invited', label: '已邀请', icon: <Users size={16} /> },
    { id: 'search', label: '邀请', icon: <UserPlus size={16} /> },
    { id: 'share', label: '分享', icon: <Send size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:w-[480px] sm:rounded-2xl rounded-t-[32px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-indigo-500 dark:text-indigo-400" />
            分享回忆
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
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
              {tab.id === 'invited' && invitedUsers && invitedUsers.length > 0 && (
                <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {invitedUsers.length}
                </span>
              )}
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
          {/* Invited Tab */}
          {activeTab === 'invited' && (
            <div className="space-y-3">
              {invitedUsers && invitedUsers.length > 0 ? (
                invitedUsers.map(user => (
                  <InvitedUserCard
                    key={user.userId}
                    user={user}
                    onRemove={() => handleRemoveInvitation(user.userId)}
                    isRemoving={removeInvitationMutation.isPending}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">暂未邀请任何人</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">邀请好友一起查看这个回忆吧</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium flex items-center gap-2 mx-auto"
                  >
                    <UserPlus size={16} />
                    邀请好友
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
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
          {activeTab === 'share' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                生成分享码后，可以通过 Telegram 发送给好友邀请他们查看这个回忆。
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
        </div>

        {/* Footer - Invite Button */}
        {activeTab === 'search' && selectedUserIds.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {inviteMutation.isPending ? (
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

// Invited User Card Component
interface InvitedUserCardProps {
  user: InvitedUser;
  onRemove: () => void;
  isRemoving: boolean;
}

const InvitedUserCard: React.FC<InvitedUserCardProps> = ({
  user,
  onRemove,
  isRemoving,
}) => {
  const hasViewed = !!user.viewedAt;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
        {user.userAvatar ? (
          <img src={user.userAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold">
            {user.userName.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
          {user.userName}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          {hasViewed ? (
            <>
              <Eye size={12} className="text-green-500 dark:text-green-400" />
              <span className="text-green-600 dark:text-green-400">
                已查看 · {new Date(user.viewedAt!).toLocaleDateString('zh-CN')}
              </span>
            </>
          ) : (
            <>
              <EyeOff size={12} />
              <span>待查看</span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export default InviteToMemoryModal;
