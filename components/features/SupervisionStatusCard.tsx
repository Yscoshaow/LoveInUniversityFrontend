import React from 'react';
import { SupervisionAgreement, SupervisionSummary } from '../../types';
import { Shield, Users, Clock, UserCheck, UserX, AlertCircle } from 'lucide-react';

interface SupervisionStatusCardProps {
  summary: SupervisionSummary;
  onViewSupervisor?: () => void;
  onViewSupervisees?: () => void;
  onViewPending?: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '永久';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const AgreementCard: React.FC<{
  agreement: SupervisionAgreement;
  role: 'supervisor' | 'supervisee';
  onCancel?: () => void;
}> = ({ agreement, role, onCancel }) => {
  const isSupervisor = role === 'supervisor';
  const otherName = isSupervisor ? agreement.superviseeName : agreement.supervisorName;
  const otherAvatar = isSupervisor ? agreement.superviseeAvatar : agreement.supervisorAvatar;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
          {otherAvatar ? (
            <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg text-slate-600 dark:text-slate-300">{otherName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{otherName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {agreement.expiresAt ? `${formatDate(agreement.expiresAt)} 到期` : '永久有效'}
          </div>
        </div>
        {isSupervisor && onCancel && (
          <button
            onClick={onCancel}
            className="px-2 py-1 text-xs bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
          >
            终止
          </button>
        )}
      </div>
    </div>
  );
};

export const SupervisionStatusCard: React.FC<SupervisionStatusCardProps> = ({
  summary,
  onViewSupervisor,
  onViewSupervisees,
  onViewPending,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">监督关系</h3>
        {summary.pendingRequests.length > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-orange-100 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full">
            {summary.pendingRequests.length} 待处理
          </span>
        )}
      </div>

      {/* 我的监督人 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">我的监督人</span>
        </div>
        {summary.supervisor ? (
          <AgreementCard agreement={summary.supervisor} role="supervisee" />
        ) : (
          <div className="text-sm text-slate-400 dark:text-slate-500 py-3 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            暂无监督人
          </div>
        )}
      </div>

      {/* 我监督的人 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-green-500 dark:text-green-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">我监督的人</span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{summary.superviseeCount} 人</span>
        </div>
        {summary.supervisees.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {summary.supervisees.slice(0, 3).map((agreement) => (
              <AgreementCard
                key={agreement.id}
                agreement={agreement}
                role="supervisor"
              />
            ))}
            {summary.supervisees.length > 3 && (
              <button
                onClick={onViewSupervisees}
                className="w-full text-sm text-primary py-2 hover:text-primary/80 transition-colors font-medium"
              >
                查看全部 {summary.supervisees.length} 人
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-400 dark:text-slate-500 py-3 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            暂未监督他人
          </div>
        )}
      </div>

      {/* 待处理的请求 */}
      {summary.pendingRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-500 dark:text-orange-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">待处理请求</span>
          </div>
          <button
            onClick={onViewPending}
            className="w-full py-2.5 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-xl text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors border border-orange-200 dark:border-orange-800"
          >
            查看 {summary.pendingRequests.length} 个待处理请求
          </button>
        </div>
      )}
    </div>
  );
};

export default SupervisionStatusCard;
