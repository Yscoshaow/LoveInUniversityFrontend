import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  Send,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  User,
  Calendar,
  Smartphone,
} from 'lucide-react';
import { adminFeedbackApi } from '../../lib/api';
import type {
  AdminFeedbackItem,
  FeedbackType,
  FeedbackStatus,
} from '../../types';

interface FeedbackEditorPageProps {
  onBack: () => void;
}

const feedbackTypeConfig: Record<FeedbackType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  BUG: { icon: Bug, label: 'Bug报告', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
  FEATURE_REQUEST: { icon: Lightbulb, label: '功能建议', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
  QUESTION: { icon: HelpCircle, label: '问题咨询', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  OTHER: { icon: MessageSquare, label: '其他', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' },
};

const statusConfig: Record<FeedbackStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING: { label: '待处理', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100', icon: Clock },
  IN_PROGRESS: { label: '处理中', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100', icon: AlertCircle },
  RESOLVED: { label: '已解决', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100', icon: CheckCircle },
  CLOSED: { label: '已关闭', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700', icon: X },
};

export const FeedbackEditorPage: React.FC<FeedbackEditorPageProps> = ({ onBack }) => {
  const [feedbacks, setFeedbacks] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackItem | null>(null);
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('RESOLVED');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [feedbacksData, countData] = await Promise.all([
        adminFeedbackApi.getAllFeedbacks(200, 0, statusFilter === 'ALL' ? undefined : statusFilter),
        adminFeedbackApi.getPendingCount(),
      ]);
      setFeedbacks(feedbacksData);
      setPendingCount(countData.pendingCount);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleRespond = async () => {
    if (!selectedFeedback || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await adminFeedbackApi.respondToFeedback(selectedFeedback.id, {
        response: responseText.trim(),
        status: newStatus,
      });

      // Refresh data
      await fetchData();

      // Close modal
      setSelectedFeedback(null);
      setResponseText('');
      setNewStatus('RESOLVED');
    } catch (err) {
      console.error('Failed to respond:', err);
      setError('回复失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (feedback: AdminFeedbackItem, status: FeedbackStatus) => {
    try {
      await adminFeedbackApi.updateFeedbackStatus(feedback.id, status);
      await fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.subject.toLowerCase().includes(query) ||
        f.content.toLowerCase().includes(query) ||
        f.userId.toString().includes(query)
      );
    }
    return true;
  });

  if (loading && feedbacks.length === 0) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">反馈管理</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              共 {feedbacks.length} 条反馈
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                  · {pendingCount} 待处理
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索反馈内容或用户ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((status) => {
            const isAll = status === 'ALL';
            const config = isAll ? null : statusConfig[status];
            const count = isAll ? feedbacks.length : feedbacks.filter(f => f.status === status).length;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {isAll ? '全部' : config?.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
            <MessageSquare size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">暂无反馈</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => {
            const typeConf = feedbackTypeConfig[feedback.type];
            const statusConf = statusConfig[feedback.status];
            const TypeIcon = typeConf.icon;
            const StatusIcon = statusConf.icon;

            return (
              <div
                key={feedback.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${typeConf.bg} ${typeConf.color} flex items-center justify-center flex-shrink-0`}>
                    <TypeIcon size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{feedback.subject}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.color} flex items-center gap-1`}>
                        <StatusIcon size={10} />
                        {statusConf.label}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">{feedback.content}</p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        ID: {feedback.userId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(feedback.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      {feedback.appVersion && (
                        <span className="flex items-center gap-1">
                          <Smartphone size={10} />
                          v{feedback.appVersion}
                        </span>
                      )}
                    </div>

                    {feedback.adminResponse && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg border border-green-100 dark:border-green-900">
                        <p className="text-xs text-green-700 dark:text-green-400 line-clamp-2">{feedback.adminResponse}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setResponseText(feedback.adminResponse || '');
                      setNewStatus(feedback.status === 'PENDING' ? 'RESOLVED' : feedback.status);
                    }}
                    className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-primary/90"
                  >
                    <Eye size={14} />
                    查看详情
                  </button>

                  {feedback.status === 'PENDING' && (
                    <button
                      onClick={() => handleQuickStatusChange(feedback, 'IN_PROGRESS')}
                      className="px-3 py-2 bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-200"
                    >
                      处理中
                    </button>
                  )}

                  {feedback.status !== 'CLOSED' && feedback.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleQuickStatusChange(feedback, 'CLOSED')}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      关闭
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedFeedback(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">反馈详情</h2>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
              >
                <X size={18} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Type and Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const conf = feedbackTypeConfig[selectedFeedback.type];
                    const Icon = conf.icon;
                    return (
                      <>
                        <Icon size={18} className={conf.color} />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{conf.label}</span>
                      </>
                    );
                  })()}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusConfig[selectedFeedback.status].bg} ${statusConfig[selectedFeedback.status].color}`}>
                  {statusConfig[selectedFeedback.status].label}
                </span>
              </div>

              {/* Subject */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedFeedback.subject}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  用户ID: {selectedFeedback.userId} · {new Date(selectedFeedback.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>

              {/* Content */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedFeedback.content}</p>
              </div>

              {/* Device Info */}
              {(selectedFeedback.deviceInfo || selectedFeedback.appVersion) && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedFeedback.appVersion && <span>版本: {selectedFeedback.appVersion}</span>}
                    {selectedFeedback.deviceInfo && (
                      <span className="ml-3">设备: {selectedFeedback.deviceInfo}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Screenshots */}
              {selectedFeedback.screenshotUrls && selectedFeedback.screenshotUrls.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">截图:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedFeedback.screenshotUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`反馈截图${idx + 1}`}
                        className="w-32 h-32 object-cover rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Response Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">回复反馈</h4>

                {/* Status Select */}
                <div className="mb-3">
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">更新状态</label>
                  <div className="flex gap-2">
                    {(['IN_PROGRESS', 'RESOLVED', 'CLOSED'] as FeedbackStatus[]).map((status) => {
                      const conf = statusConfig[status];
                      return (
                        <button
                          key={status}
                          onClick={() => setNewStatus(status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            newStatus === status
                              ? `${conf.bg} ${conf.color} ring-2 ring-offset-1 ring-current`
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Response Text */}
                <div className="mb-3">
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">回复内容</label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="输入回复内容..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm resize-none focus:outline-none focus:border-primary"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleRespond}
                  disabled={submitting}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      提交回复
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackEditorPage;
