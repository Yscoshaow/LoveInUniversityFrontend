import React, { useState, useEffect } from 'react';
import {
  SupervisionRole,
  SupervisionSearchResult,
  InitiateSupervisionRequest,
} from '../../types';
import { supervisionApi } from '../../lib/api';
import { isImmersiveInteractionEnabled } from '../../lib/local-settings';
import {
  X,
  Search,
  Shield,
  User,
  Clock,
  Fingerprint,
  Loader2,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface SupervisionPermitUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'select-role' | 'search-user' | 'confirm' | 'biometric' | 'success';

const STEPS: Step[] = ['select-role', 'search-user', 'confirm'];

const STEP_TITLES: Record<Step, string> = {
  'select-role': '选择角色',
  'search-user': '搜索用户',
  'confirm': '确认签署',
  'biometric': '身份验证',
  'success': '发送成功',
};

const DURATION_OPTIONS = [
  { value: 7, label: '7天' },
  { value: 30, label: '30天' },
  { value: 90, label: '90天' },
  { value: 365, label: '1年' },
  { value: null, label: '永久' },
];

export const SupervisionPermitUseModal: React.FC<SupervisionPermitUseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('select-role');
  const [selectedRole, setSelectedRole] = useState<SupervisionRole | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SupervisionSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SupervisionSearchResult | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(30);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = STEPS.indexOf(step as any);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select-role');
      setSelectedRole(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setDurationDays(30);
      setError(null);
    }
  }, [isOpen]);

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery.trim() || step !== 'search-user') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await supervisionApi.searchUsers(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, step]);

  const handleRoleSelect = (role: SupervisionRole) => {
    setSelectedRole(role);
    setStep('search-user');
  };

  const handleUserSelect = (user: SupervisionSearchResult) => {
    setSelectedUser(user);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (isImmersiveInteractionEnabled()) {
      setStep('biometric');
      setTimeout(() => {
        handleBiometricSuccess();
      }, 1500);
    } else {
      handleBiometricSuccess();
    }
  };

  const handleBiometricSuccess = async () => {
    if (!selectedRole || !selectedUser) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const request: InitiateSupervisionRequest = {
        targetUserId: selectedUser.id,
        role: selectedRole,
        durationDays: durationDays ?? undefined,
      };

      await supervisionApi.initiate(request);
      setStep('success');

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '发起协议失败');
      setStep('confirm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    switch (step) {
      case 'search-user':
        setStep('select-role');
        setSelectedRole(null);
        break;
      case 'confirm':
        setStep('search-user');
        setSelectedUser(null);
        break;
      default:
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          {step !== 'select-role' && step !== 'success' && step !== 'biometric' ? (
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

        {/* Progress (only for main steps) */}
        {step !== 'biometric' && step !== 'success' && (
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
          {/* Step 1: Select Role */}
          {step === 'select-role' && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-300 text-sm text-center mb-6">
                请选择您在监督关系中的角色
              </p>

              <button
                onClick={() => handleRoleSelect('SUPERVISOR')}
                className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">我是监督人</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">我将监督对方的锁定</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('SUPERVISEE')}
                className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">我是被监督人</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">对方将监督我的锁定</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>
              </button>
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
                  输入用户名或ID搜索
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedUser && (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

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

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">协议有效期</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setDurationDays(option.value)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        durationDays === option.value
                          ? 'bg-primary text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-2">协议内容</div>
                <div className="text-sm text-slate-800 dark:text-slate-100">
                  {selectedRole === 'SUPERVISOR' ? (
                    <>您将成为 <span className="text-primary font-medium">{selectedUser.firstName}</span> 的监督人，可以控制其锁定。</>
                  ) : (
                    <><span className="text-primary font-medium">{selectedUser.firstName}</span> 将成为您的监督人，可以控制您的锁定。</>
                  )}
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
                  <CheckCircle className="w-5 h-5" />
                )}
                确认签署
              </button>
            </div>
          )}

          {/* Step 4: Biometric */}
          {step === 'biometric' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-medium mb-2">请进行指纹验证</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">验证您的身份以签署协议</div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-medium mb-2">协议请求已发送</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">等待对方确认签署</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisionPermitUseModal;
