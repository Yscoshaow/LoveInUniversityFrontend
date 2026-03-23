import React, { useState, useEffect } from 'react';
import { SelfLockSummary, UserSearchResult } from '../../types';
import { selfLockApi, userProfileApi, specialItemsApi } from '../../lib/api';
import {
  X,
  Search,
  Lock,
  KeyRound,
  Loader2,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';

interface KeyBoxUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'select-lock' | 'search-user' | 'confirm' | 'success';

const STEPS: Step[] = ['select-lock', 'search-user', 'confirm'];

const STEP_TITLES: Record<Step, string> = {
  'select-lock': '选择自锁',
  'search-user': '选择管理者',
  'confirm': '确认使用',
  'success': '使用成功',
};

export const KeyBoxUseModal: React.FC<KeyBoxUseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('select-lock');
  const [selfLocks, setSelfLocks] = useState<SelfLockSummary[]>([]);
  const [selectedLock, setSelectedLock] = useState<SelfLockSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = STEPS.indexOf(step as any);

  // Reset state and load locks when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select-lock');
      setSelectedLock(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setError(null);
      loadSelfLocks();
    }
  }, [isOpen]);

  const loadSelfLocks = async () => {
    setIsLoading(true);
    try {
      const locks = await selfLockApi.getMyLocks(true);
      // Only show locks that are SELF type
      setSelfLocks(locks.filter(l => l.lockType === 'SELF'));
    } catch (err) {
      console.error('Failed to load locks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery.trim() || step !== 'search-user') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await userProfileApi.searchUsers(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, step]);

  const handleLockSelect = (lock: SelfLockSummary) => {
    setSelectedLock(lock);
    setStep('search-user');
  };

  const handleUserSelect = (user: UserSearchResult) => {
    setSelectedUser(user);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedLock || !selectedUser) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await specialItemsApi.useKeyBox(selectedLock.id, selectedUser.id);
      setStep('success');

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '使用钥匙盒失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    switch (step) {
      case 'search-user':
        setStep('select-lock');
        setSelectedLock(null);
        break;
      case 'confirm':
        setStep('search-user');
        setSelectedUser(null);
        break;
      default:
        break;
    }
  };

  const formatRemainingTime = (lock: SelfLockSummary) => {
    const seconds = lock.remainingSeconds ?? (lock.remainingMinutes ? lock.remainingMinutes * 60 : null);
    if (seconds == null || lock.hideRemainingTime) return '剩余时间隐藏';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `剩余 ${h}h ${m}m`;
    return `剩余 ${m}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          {step !== 'select-lock' && step !== 'success' ? (
            <button onClick={goBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
              <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <h2 className="font-bold text-lg">{STEP_TITLES[step]}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Progress */}
        {step !== 'success' && (
          <div className="px-4 py-2">
            <div className="flex gap-1">
              {STEPS.map((s, index) => (
                <div
                  key={s}
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    index <= currentStepIndex ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Select Lock */}
          {step === 'select-lock' && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-300 text-sm text-center mb-4">
                选择要转为私有锁的自锁
              </p>

              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}

              {!isLoading && selfLocks.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium mb-1">没有可用的自锁</div>
                  <div className="text-sm text-slate-400 dark:text-slate-500">你需要先创建一个自锁类型的锁</div>
                </div>
              )}

              {!isLoading && selfLocks.map((lock) => (
                <button
                  key={lock.id}
                  onClick={() => handleLockSelect(lock)}
                  className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">锁 #{lock.id}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{formatRemainingTime(lock)}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Search User */}
          {step === 'search-user' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="搜索用户名或ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {isSearching && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                          {user.photoUrl ? (
                            <img src={user.photoUrl} alt={user.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg text-slate-600 dark:text-slate-300">{user.firstName.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {user.firstName} {user.lastName || ''}
                          </div>
                          {user.username && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  未找到符合条件的用户
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  输入用户名或ID搜索管理者
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedLock && selectedUser && (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Selected keyholder */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden mb-3">
                  {selectedUser.photoUrl ? (
                    <img src={selectedUser.photoUrl} alt={selectedUser.firstName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-slate-600 dark:text-slate-300">{selectedUser.firstName.charAt(0)}</span>
                  )}
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                  {selectedUser.firstName} {selectedUser.lastName || ''}
                </div>
                {selectedUser.username && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">@{selectedUser.username}</div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">锁定</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">锁 #{selectedLock.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">变更</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">自锁 → 私有锁</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">主管理者</span>
                  <span className="text-sm font-medium text-primary">{selectedUser.firstName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">管理权限</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">完全控制</span>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  使用后，你的锁将变为私有锁，<span className="font-medium">{selectedUser.firstName}</span> 将成为主管理者并拥有完全控制权限。此操作消耗一个钥匙盒。
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <KeyRound className="w-5 h-5" />
                )}
                确认使用钥匙盒
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-medium mb-2">钥匙盒使用成功</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">你的锁已转为私有锁</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeyBoxUseModal;
