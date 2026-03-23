import React, { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useTaskRequestDetail, useTaskRequestProposals, useSubmitProposal, useSelectWinner, useCancelTaskRequest } from '../../hooks/useTaskRequests';
import {
  ArrowLeft,
  Coins,
  FileText,
  Trophy,
  Loader2,
  User as UserIcon,
  X,
  Megaphone,
  CheckCircle,
  Clock,
  Send,
  Trash2,
} from 'lucide-react';
import type { TaskRequestProposalDetail } from '../../types';
import { useUserProfileNavigation } from '../layout/MainLayout';

interface TaskRequestDetailPageProps {
  requestId: number;
  onBack?: () => void;
}

const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

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

export const TaskRequestDetailPage: React.FC<TaskRequestDetailPageProps> = ({
  requestId,
  onBack,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? 0;
  const { viewUserProfile } = useUserProfileNavigation();

  const { data: detail, isLoading, error: loadError } = useTaskRequestDetail(requestId);
  const { data: proposals, isLoading: isLoadingProposals } = useTaskRequestProposals(requestId, {
    enabled: !!detail && detail.creatorId === currentUserId,
  });

  const submitProposalMutation = useSubmitProposal();
  const selectWinnerMutation = useSelectWinner();
  const cancelMutation = useCancelTaskRequest();

  // Proposal form state
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ type: 'select' | 'cancel'; proposalId?: number } | null>(null);

  const isCreator = detail?.creatorId === currentUserId;

  const handleSubmitProposal = async () => {
    if (!proposalTitle.trim() || !proposalDescription.trim()) {
      setError('请填写标题和描述');
      return;
    }
    setError(null);
    try {
      await submitProposalMutation.mutateAsync({
        requestId,
        request: { title: proposalTitle.trim(), description: proposalDescription.trim() },
      });
      setProposalTitle('');
      setProposalDescription('');
      setShowProposalForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    }
  };

  const handleSelectWinner = async (proposalId: number) => {
    setError(null);
    try {
      await selectWinnerMutation.mutateAsync({ requestId, request: { proposalId } });
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleCancel = async () => {
    setError(null);
    try {
      await cancelMutation.mutateAsync(requestId);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消失败');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 flex flex-col">
        <div className="p-4">
          <button onClick={onBack} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
          加载失败
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">求任务详情</h1>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            detail.status === 'OPEN' ? 'bg-amber-100 text-amber-600 dark:text-amber-400' :
            detail.status === 'COMPLETED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
            'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {detail.status === 'OPEN' ? '悬赏中' : detail.status === 'COMPLETED' ? '已结束' : '已取消'}
          </span>
        </div>
      </div>

      <div className="p-4 pb-32 space-y-4">
        {/* Main Info Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
          {/* Creator Info */}
          <div className="flex items-center gap-3 mb-4">
            <img
              src={detail.creatorAvatar || DEFAULT_AVATAR}
              className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              alt="avatar"
              onClick={() => viewUserProfile(detail.creatorId)}
            />
            <div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary" onClick={() => viewUserProfile(detail.creatorId)}>{detail.creatorName || '匿名用户'}</span>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(detail.createdAt)}</div>
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">{detail.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-4">{detail.description}</p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Coins size={16} />
              <span className="text-sm font-bold">{detail.rewardAmount}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">校园点数</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <FileText size={14} />
              <span className="text-xs">{detail.proposalCount} 个提案</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <X size={14} />
            {error}
          </div>
        )}

        {/* Winning Proposal (shown when completed) */}
        {detail.status === 'COMPLETED' && detail.winningProposal && (
          <div className="bg-gradient-to-br from-amber-50 dark:from-amber-950 to-amber-100/50 dark:to-amber-900/50 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">获胜提案</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={detail.winningProposal.userAvatar || DEFAULT_AVATAR}
                  className="w-7 h-7 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  alt="avatar"
                  onClick={() => viewUserProfile(detail.winningProposal!.userId)}
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary" onClick={() => viewUserProfile(detail.winningProposal!.userId)}>{detail.winningProposal.userName || '匿名用户'}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{detail.winningProposal.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{detail.winningProposal.description}</p>
            </div>
          </div>
        )}

        {/* Creator View: Cancel & Proposals */}
        {isCreator && detail.status === 'OPEN' && (
          <>
            {/* Cancel Button */}
            <button
              onClick={() => setConfirmAction({ type: 'cancel' })}
              className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
            >
              <Trash2 size={14} />
              取消悬赏（退还校园点数）
            </button>

            {/* Proposals List (Creator Only) */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-violet-500 dark:text-violet-400" />
                收到的提案
                {detail.proposalCount > 0 && (
                  <span className="bg-violet-100 text-violet-600 dark:text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {detail.proposalCount}
                  </span>
                )}
              </h3>
              {isLoadingProposals ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : proposals && proposals.length > 0 ? (
                <div className="space-y-3">
                  {proposals.map(proposal => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      isCreator={true}
                      onSelect={() => setConfirmAction({ type: 'select', proposalId: proposal.id })}
                      onUserClick={viewUserProfile}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">暂无提案，等待其他用户提交</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Non-Creator View: Submit Proposal or Show My Proposal */}
        {!isCreator && detail.status === 'OPEN' && (
          <>
            {detail.hasProposed && detail.myProposal ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-green-500 dark:text-green-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">你已提交提案</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{detail.myProposal.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{detail.myProposal.description}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 inline-block ${
                    detail.myProposal.status === 'SELECTED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
                    detail.myProposal.status === 'REJECTED' ? 'bg-red-100 text-red-600 dark:text-red-400' :
                    'bg-amber-100 text-amber-600 dark:text-amber-400'
                  }`}>
                    {detail.myProposal.status === 'SELECTED' ? '获胜' :
                     detail.myProposal.status === 'REJECTED' ? '未选中' : '等待中'}
                  </span>
                </div>
              </div>
            ) : showProposalForm ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">提交提案</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder="提案标题"
                    maxLength={200}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <textarea
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    placeholder="详细描述你的任务方案..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowProposalForm(false); setProposalTitle(''); setProposalDescription(''); }}
                      className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitProposal}
                      disabled={submitProposalMutation.isPending || !proposalTitle.trim() || !proposalDescription.trim()}
                      className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {submitProposalMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Send size={14} />
                          提交
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowProposalForm(true)}
                className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
              >
                <Send size={16} />
                提交提案
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-[85%] max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              {confirmAction.type === 'select' ? '确认选择获胜者' : '确认取消悬赏'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {confirmAction.type === 'select'
                ? `选择后将支付 ${detail.rewardAmount} 校园点数给获胜者，此操作不可撤销。`
                : `取消后 ${detail.rewardAmount} 校园点数将退还到你的账户。`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'select' && confirmAction.proposalId) {
                    handleSelectWinner(confirmAction.proposalId);
                  } else {
                    handleCancel();
                  }
                }}
                disabled={selectWinnerMutation.isPending || cancelMutation.isPending}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center ${
                  confirmAction.type === 'select' ? 'bg-amber-500' : 'bg-red-500'
                }`}
              >
                {(selectWinnerMutation.isPending || cancelMutation.isPending) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  confirmAction.type === 'select' ? '确认选择' : '确认取消'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Proposal Card Component
const ProposalCard: React.FC<{
  proposal: TaskRequestProposalDetail;
  isCreator: boolean;
  onSelect?: () => void;
  onUserClick?: (userId: number) => void;
}> = ({ proposal, isCreator, onSelect, onUserClick }) => {
  const DEFAULT_AVATAR = 'https://picsum.photos/id/1005/100/100';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-50 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <img
          src={proposal.userAvatar || DEFAULT_AVATAR}
          className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
          alt="avatar"
          onClick={() => onUserClick?.(proposal.userId)}
        />
        <div className="flex-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary" onClick={() => onUserClick?.(proposal.userId)}>{proposal.userName || '匿名用户'}</span>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(proposal.createdAt)}</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          proposal.status === 'SELECTED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
          proposal.status === 'REJECTED' ? 'bg-red-100 text-red-600 dark:text-red-400' :
          'bg-amber-100 text-amber-600 dark:text-amber-400'
        }`}>
          {proposal.status === 'SELECTED' ? '获胜' :
           proposal.status === 'REJECTED' ? '未选中' : '待审核'}
        </span>
      </div>

      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{proposal.title}</h4>
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-3">{proposal.description}</p>

      {isCreator && proposal.status === 'PENDING' && onSelect && (
        <button
          onClick={onSelect}
          className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-600 active:scale-[0.98] transition-all"
        >
          <Trophy size={14} />
          选为获胜提案
        </button>
      )}
    </div>
  );
};
