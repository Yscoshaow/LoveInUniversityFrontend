import React, { useState, useEffect, useCallback } from 'react';
import { UserPunishmentDisplay, UserPointsInfo } from '../../types';
import { punishmentsApi } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-client';
import {
  ArrowLeft,
  AlertTriangle,
  History,
  Shield,
  FileWarning,
  CheckCircle,
  Clock,
  Gavel,
  Loader2,
  AlertCircle,
  ListTodo,
  MinusCircle,
  Ban,
  Dices,
  RefreshCw,
  Hand,
  Coins,
  HelpCircle,
} from 'lucide-react';

interface DisciplinaryPageProps {
  onBack: () => void;
  onRefreshTasks?: () => void; // 刷新任务的回调
}

export const DisciplinaryPage: React.FC<DisciplinaryPageProps> = ({ onBack, onRefreshTasks }) => {
  const queryClient = useQueryClient();
  const [punishmentTab, setPunishmentTab] = useState<'pending' | 'history'>('pending');
  const [pendingPunishments, setPendingPunishments] = useState<UserPunishmentDisplay[]>([]);
  const [historyPunishments, setHistoryPunishments] = useState<UserPunishmentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User points state
  const [userPoints, setUserPoints] = useState<UserPointsInfo | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: number; text: string; type: 'success' | 'error' } | null>(null);

  const fetchPunishments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pending, history, points] = await Promise.all([
        punishmentsApi.getPending(),
        punishmentsApi.getHistory(),
        punishmentsApi.getPoints()
      ]);
      setPendingPunishments(pending);
      setHistoryPunishments(history);
      setUserPoints(points);
    } catch (err) {
      console.error('Failed to fetch punishments:', err);
      setError('加载处罚记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPunishments();
  }, [fetchPunishments]);

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Refresh points after action
  const refreshPoints = async () => {
    try {
      const points = await punishmentsApi.getPoints();
      setUserPoints(points);
    } catch (err) {
      console.error('Failed to refresh points:', err);
    }
  };

  // Draw punishment
  const handleDraw = async (punishmentId: number) => {
    setActionLoading(punishmentId);
    setActionMessage(null);
    try {
      const result = await punishmentsApi.draw(punishmentId);
      // Update the punishment in list
      setPendingPunishments(prev =>
        prev.map(p => p.id === punishmentId ? result.userPunishment : p)
      );
      setActionMessage({ id: punishmentId, text: result.message, type: 'success' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '抽取失败';
      setActionMessage({ id: punishmentId, text: errorMsg, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Reroll punishment
  const handleReroll = async (punishmentId: number) => {
    setActionLoading(punishmentId);
    setActionMessage(null);
    try {
      const result = await punishmentsApi.reroll(punishmentId);
      // Update the punishment in list
      setPendingPunishments(prev =>
        prev.map(p => p.id === punishmentId ? result.userPunishment : p)
      );
      setActionMessage({ id: punishmentId, text: result.message, type: 'success' });
      // 刷新点数
      await refreshPoints();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '重抽失败';
      setActionMessage({ id: punishmentId, text: errorMsg, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Claim punishment
  const handleClaim = async (punishmentId: number) => {
    setActionLoading(punishmentId);
    setActionMessage(null);
    try {
      const updatedPunishment = await punishmentsApi.claim(punishmentId);
      // Update lists - move to different category if needed
      if (updatedPunishment.status === 'PENDING') {
        setPendingPunishments(prev =>
          prev.map(p => p.id === punishmentId ? updatedPunishment : p)
        );
        // 如果创建了惩罚任务，刷新任务列表
        if (updatedPunishment.punishmentTask) {
          onRefreshTasks?.();
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        }
      } else if (updatedPunishment.status === 'COMPLETED') {
        // Remove from pending, add to history
        setPendingPunishments(prev => prev.filter(p => p.id !== punishmentId));
        setHistoryPunishments(prev => [updatedPunishment, ...prev]);
      }
      setActionMessage({ id: punishmentId, text: '惩罚已申领', type: 'success' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '申领失败';
      setActionMessage({ id: punishmentId, text: errorMsg, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Get icon for punishment type
  const getPunishmentTypeIcon = (type: string | null) => {
    switch (type) {
      case 'EXTRA_TASK':
        return <ListTodo size={14} />;
      case 'POINT_DEDUCTION':
        return <MinusCircle size={14} />;
      case 'EXAM_BAN':
        return <Ban size={14} />;
      default:
        return <HelpCircle size={14} />;
    }
  };

  // Get punishment type label
  const getPunishmentTypeLabel = (type: string | null) => {
    switch (type) {
      case 'EXTRA_TASK':
        return '额外任务';
      case 'POINT_DEDUCTION':
        return '扣除积分';
      case 'EXAM_BAN':
        return '禁止考试';
      default:
        return '未知';
    }
  };

  // Get trigger type label
  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'TASK_FAIL':
        return '任务失败';
      case 'TASK_SKIP':
        return '任务跳过';
      case 'EXAM_FAIL':
        return '考试失败';
      case 'MANUAL':
        return '惩罚室';
      default:
        return trigger;
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING_CLAIM':
        return '待申领';
      case 'PENDING':
        return '待执行';
      case 'COMPLETED':
        return '已完成';
      case 'EXPIRED':
        return '已过期';
      default:
        return status;
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // Format datetime
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
        <button
          onClick={() => fetchPunishments()}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
        >
          重试
        </button>
      </div>
    );
  }

  // Render pending claim card (needs to draw)
  const renderPendingClaimCard = (punishment: UserPunishmentDisplay) => {
    const isLoading = actionLoading === punishment.id;
    const message = actionMessage?.id === punishment.id ? actionMessage : null;
    const hasDrawn = punishment.name !== null;
    const canReroll = userPoints !== null && userPoints.points >= (userPoints.rerollCost || 1);

    return (
      <div
        key={punishment.id}
        className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-soft border-l-4 border-l-amber-500 relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
            {hasDrawn ? <FileWarning size={24} /> : <Dices size={24} />}
          </div>
          <div className="flex-1">
            {hasDrawn ? (
              <>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{punishment.name}</h4>
                {punishment.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{punishment.description}</p>
                )}
              </>
            ) : (
              <>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">待抽取惩罚</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  触发原因: {getTriggerLabel(punishment.triggerType)}
                </p>
              </>
            )}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                触发: {formatDate(punishment.createdAt)}
              </span>
              {punishment.claimDeadline && (
                <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1">
                  <Clock size={10} /> 申领截止: {formatDateTime(punishment.claimDeadline)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action message */}
        {message && (
          <div className={`mb-3 p-2 rounded-lg text-xs font-medium ${
            message.type === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Drawn punishment info */}
        {hasDrawn && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 mb-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">处罚类型</div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  {getPunishmentTypeIcon(punishment.punishmentType)}
                  {getPunishmentTypeLabel(punishment.punishmentType)}
                </div>
              </div>
              {punishment.punishmentValue != null && punishment.punishmentValue > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">惩罚值</div>
                  <div className="text-sm font-bold text-red-500 dark:text-red-400">
                    {punishment.punishmentType === 'POINT_DEDUCTION' ? `-${punishment.punishmentValue} 点` :
                     punishment.punishmentType === 'EXAM_BAN' ? `${punishment.punishmentValue} 小时` :
                     punishment.punishmentValue}
                  </div>
                </div>
              )}
            </div>
            {punishment.rerollCount > 0 && (
              <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                已重抽 {punishment.rerollCount} 次
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!hasDrawn ? (
            // Not drawn yet - show draw button
            <button
              onClick={() => handleDraw(punishment.id)}
              disabled={isLoading}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Dices size={16} />
                  抽取惩罚
                </>
              )}
            </button>
          ) : (
            // Already drawn - show reroll and claim buttons
            <>
              <button
                onClick={() => handleReroll(punishment.id)}
                disabled={isLoading || !canReroll}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                  canReroll ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                }`}
                title={!canReroll ? `校园点数不足 (当前: ${userPoints?.points || 0})` : undefined}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <RefreshCw size={16} />
                    重抽
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                      canReroll ? 'bg-amber-100 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}>
                      <Coins size={10} /> {userPoints?.rerollCost || 1}
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleClaim(punishment.id)}
                disabled={isLoading}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Hand size={16} />
                    申领执行
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render pending execution card (already claimed)
  const renderPendingExecutionCard = (punishment: UserPunishmentDisplay) => (
    <div
      key={punishment.id}
      className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-soft border-l-4 border-l-red-500 relative overflow-hidden"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0">
          <FileWarning size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{punishment.name || '惩罚执行中'}</h4>
          {punishment.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{punishment.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              发布: {formatDate(punishment.createdAt)}
            </span>
            {punishment.dueAt && (
              <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                <Clock size={10} /> 截止: {formatDateTime(punishment.dueAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Penalty Info */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">处罚类型</div>
            <div className="text-sm font-bold text-red-500 dark:text-red-400 flex items-center gap-1">
              {getPunishmentTypeIcon(punishment.punishmentType)}
              {getPunishmentTypeLabel(punishment.punishmentType)}
            </div>
          </div>
          {punishment.punishmentTask && (
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">关联任务</div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{punishment.punishmentTask.taskName}</div>
            </div>
          )}
        </div>

        {/* Task progress if available */}
        {punishment.punishmentTask && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
              <span>任务进度</span>
              <span>{punishment.punishmentTask.progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${punishment.punishmentTask.progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-y-auto no-scrollbar">
      <div className="p-6 pb-32 lg:pb-8 lg:max-w-[1200px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-2">
              <Gavel size={20} className="text-slate-800 dark:text-slate-100" />
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">纪律处分</h1>
            </div>
          </div>
          {/* User campus points */}
          {userPoints !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950 rounded-full">
              <Coins size={14} className="text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{userPoints.points}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl mb-6 lg:max-w-xs">
          <button
            onClick={() => setPunishmentTab('pending')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              punishmentTab === 'pending' ? 'bg-white dark:bg-slate-800 shadow text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <AlertTriangle size={14} /> 待处理 ({pendingPunishments.length})
          </button>
          <button
            onClick={() => setPunishmentTab('history')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              punishmentTab === 'history' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <History size={14} /> 历史记录
          </button>
        </div>

        {/* PENDING TAB */}
        {punishmentTab === 'pending' && (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {pendingPunishments.length > 0 ? (
              pendingPunishments.map((punishment) =>
                punishment.status === 'PENDING_CLAIM'
                  ? renderPendingClaimCard(punishment)
                  : renderPendingExecutionCard(punishment)
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-60 lg:col-span-2">
                <Shield size={48} className="text-green-500 dark:text-green-400 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">记录良好</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">你没有待处理的纪律处分</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {punishmentTab === 'history' && (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {historyPunishments.length > 0 ? (
              historyPunishments.map((punishment) => (
                <div
                  key={punishment.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 opacity-80 hover:opacity-100 transition-opacity lg:hover:shadow-md"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        punishment.status === 'COMPLETED'
                          ? 'bg-green-50 dark:bg-green-950 text-green-500 dark:text-green-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                      }`}>
                        {punishment.status === 'COMPLETED' ? <CheckCircle size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">{punishment.name || '未抽取'}</h4>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {formatDate(punishment.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                      punishment.status === 'COMPLETED'
                        ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                        : punishment.status === 'EXPIRED'
                        ? 'bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {getStatusLabel(punishment.status)}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      {getPunishmentTypeIcon(punishment.punishmentType)}
                      <span>{getPunishmentTypeLabel(punishment.punishmentType)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {getTriggerLabel(punishment.triggerType)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 lg:col-span-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">暂无历史记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
