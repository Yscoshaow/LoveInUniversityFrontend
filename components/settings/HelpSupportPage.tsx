import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  HelpCircle,
  MessageSquare,
  Bug,
  Lightbulb,
  ChevronRight,
  ChevronDown,
  Send,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  MessageCircle,
  ExternalLink,
  Users,
  ImagePlus,
  X,
} from 'lucide-react';
import { feedbackApi } from '@/lib/api';
import type {
  FeedbackType,
  FeedbackItem,
  FeedbackDetailResponse,
  FAQItem,
  HelpCenterResponse,
  CreateFeedbackRequest,
} from '@/types';

interface HelpSupportPageProps {
  onBack: () => void;
}

const feedbackTypeConfig: Record<FeedbackType, { icon: React.ElementType; label: string; color: string }> = {
  BUG: { icon: Bug, label: 'Bug报告', color: 'text-red-500 dark:text-red-400' },
  FEATURE_REQUEST: { icon: Lightbulb, label: '功能建议', color: 'text-amber-500 dark:text-amber-400' },
  QUESTION: { icon: HelpCircle, label: '问题咨询', color: 'text-blue-500 dark:text-blue-400' },
  OTHER: { icon: MessageSquare, label: '其他', color: 'text-slate-500 dark:text-slate-400' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待处理', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700' },
  IN_PROGRESS: { label: '处理中', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100' },
  RESOLVED: { label: '已解决', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100' },
  CLOSED: { label: '已关闭', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' },
};

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'feedback' | 'history'>('faq');
  const [helpCenter, setHelpCenter] = useState<HelpCenterResponse | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackDetailResponse | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Feedback form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('QUESTION');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load help center data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [helpData, feedbackData] = await Promise.all([
          feedbackApi.getHelpCenter(),
          feedbackApi.getFeedbacks(20, 0),
        ]);
        setHelpCenter(helpData);
        setFeedbacks(feedbackData);
      } catch (err) {
        console.error('Failed to load help center:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (!subject.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const request: CreateFeedbackRequest = {
        type: feedbackType,
        subject: subject.trim(),
        content: content.trim(),
        screenshotUrls: screenshotUrls.length > 0 ? screenshotUrls : undefined,
        appVersion: `${__APP_VERSION__} (${__GIT_COMMIT_SHA__})`,
      };

      await feedbackApi.createFeedback(request);
      setSubmitSuccess(true);
      setSubject('');
      setContent('');
      setScreenshotUrls([]);

      // Refresh feedback list
      const updatedFeedbacks = await feedbackApi.getFeedbacks(20, 0);
      setFeedbacks(updatedFeedbacks);

      // Auto switch to history tab after 2 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('history');
      }, 2000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Load feedback detail (backend auto-marks response as read)
  const handleViewFeedback = async (id: number) => {
    try {
      const detail = await feedbackApi.getFeedbackDetail(id);
      setSelectedFeedback(detail);
      // Refresh feedbacks list to update red dot (response marked as read on backend)
      const updatedFeedbacks = await feedbackApi.getFeedbacks(20, 0);
      setFeedbacks(updatedFeedbacks);
    } catch (err) {
      console.error('Failed to load feedback detail:', err);
    }
  };

  // Group FAQs by category
  const groupedFAQs = helpCenter?.faqs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQItem[]>) || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feedback detail view
  if (selectedFeedback) {
    const typeConf = feedbackTypeConfig[selectedFeedback.type];
    const statusConf = statusConfig[selectedFeedback.status];
    const TypeIcon = typeConf.icon;

    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 pb-24 lg:pb-8 overflow-y-auto lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setSelectedFeedback(null)}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">反馈详情</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Status Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TypeIcon size={18} className={typeConf.color} />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{typeConf.label}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusConf.bg} ${statusConf.color}`}>
                {statusConf.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{selectedFeedback.subject}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              提交于 {new Date(selectedFeedback.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">反馈内容</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{selectedFeedback.content}</p>
          </div>

          {/* Screenshots */}
          {selectedFeedback.screenshotUrls && selectedFeedback.screenshotUrls.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">截图</h3>
              <div className="flex flex-wrap gap-3">
                {selectedFeedback.screenshotUrls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`反馈截图${idx + 1}`}
                    className="w-32 h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Admin Response */}
          {selectedFeedback.adminResponse && (
            <div className="bg-green-50 dark:bg-green-950 rounded-2xl p-4 border border-green-100 dark:border-green-900">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={16} className="text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">官方回复</h3>
              </div>
              <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">{selectedFeedback.adminResponse}</p>
              {selectedFeedback.respondedAt && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  回复于 {new Date(selectedFeedback.respondedAt).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          )}

          {/* Pending notice */}
          {!selectedFeedback.adminResponse && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 border border-amber-100 dark:border-amber-900 flex items-start gap-3">
              <Clock size={20} className="text-amber-500 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">等待回复中</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">我们会尽快处理您的反馈，请耐心等待。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 pb-24 lg:pb-8 overflow-y-auto lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">帮助与支持</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 px-4 py-2 flex gap-2 border-b border-slate-100 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'faq'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          常见问题
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'feedback'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          提交反馈
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
            activeTab === 'history'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          我的反馈
          {feedbacks.filter(f => f.hasResponse && !f.isResponseRead).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
              {feedbacks.filter(f => f.hasResponse && !f.isResponseRead).length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4">
        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-4">
            {Object.entries(groupedFAQs).map(([category, faqs]) => (
              <div key={category} className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200">{category}</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {faqs.map((faq) => (
                    <div key={faq.id}>
                      <button
                        onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 pr-4">{faq.question}</span>
                        <ChevronDown
                          size={18}
                          className={`text-slate-400 dark:text-slate-500 transition-transform ${
                            expandedFAQ === faq.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {expandedFAQ === faq.id && (
                        <div className="px-4 pb-3">
                          <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Contact Info */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">联系我们</h3>
              <div className="space-y-3">
                <a
                  href="https://t.me/Yscoshaow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <MessageSquare size={20} className="text-blue-500 dark:text-blue-400" />
                  <div className="flex-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">@Yscoshaow</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500">作者</p>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 dark:text-slate-500" />
                </a>
                <a
                  href="https://t.me/lovein_university"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Users size={20} className="text-blue-500 dark:text-blue-400" />
                  <div className="flex-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">交流群</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500">t.me/lovein_university</p>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 dark:text-slate-500" />
                </a>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
                Version {__APP_VERSION__} Build {__GIT_COMMIT_SHA__}
              </p>
            </div>
          </div>
        )}

        {/* Feedback Form Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {submitSuccess ? (
              <div className="bg-green-50 dark:bg-green-950 rounded-2xl p-6 text-center border border-green-100 dark:border-green-900">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">提交成功！</h3>
                <p className="text-sm text-green-600 dark:text-green-400">感谢您的反馈，我们会尽快处理。</p>
              </div>
            ) : (
              <>
                {/* Feedback Type */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">反馈类型</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(feedbackTypeConfig) as FeedbackType[]).map((type) => {
                      const config = feedbackTypeConfig[type];
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setFeedbackType(type)}
                          className={`p-3 rounded-xl border-2 transition-colors flex items-center gap-2 ${
                            feedbackType === type
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Icon size={18} className={config.color} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">标题</h3>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="简短描述您的问题或建议"
                    maxLength={200}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary text-sm"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-right">{subject.length}/200</p>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">详细内容</h3>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请详细描述您遇到的问题或建议..."
                    maxLength={5000}
                    rows={6}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary text-sm resize-none"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-right">{content.length}/5000</p>
                </div>

                {/* Screenshot Upload (Multi) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">截图（可选，最多5张）</h3>
                  <div className="flex flex-wrap gap-3">
                    {screenshotUrls.map((url, idx) => (
                      <div key={idx} className="relative inline-block">
                        <img
                          src={url}
                          alt={`截图${idx + 1}`}
                          className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                        <button
                          onClick={() => setScreenshotUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {screenshotUrls.length < 5 && (
                      <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                        {uploadingImage ? (
                          <Loader2 size={20} className="animate-spin text-primary" />
                        ) : (
                          <>
                            <ImagePlus size={20} className="text-slate-400 dark:text-slate-500 mb-1" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{screenshotUrls.length}/5</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          multiple
                          disabled={uploadingImage}
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            const remaining = 5 - screenshotUrls.length;
                            const toUpload = files.slice(0, remaining);
                            for (const file of toUpload) {
                              if (file.size > 10 * 1024 * 1024) {
                                toast.warning(`图片 ${file.name} 超过10MB，已跳过`);
                                continue;
                              }
                              setUploadingImage(true);
                              try {
                                const result = await feedbackApi.uploadImage(file);
                                setScreenshotUrls(prev => [...prev, result.imageUrl]);
                              } catch (err) {
                                console.error('Failed to upload image:', err);
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitFeedback}
                  disabled={!subject.trim() || !content.trim() || submitting}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={20} />
                      提交反馈
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Feedback History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {feedbacks.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-soft">
                <MessageSquare size={48} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">暂无反馈记录</p>
                <button
                  onClick={() => setActiveTab('feedback')}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
                >
                  提交反馈
                </button>
              </div>
            ) : (
              feedbacks.map((feedback) => {
                const typeConf = feedbackTypeConfig[feedback.type];
                const statusConf = statusConfig[feedback.status];
                const TypeIcon = typeConf.icon;

                return (
                  <button
                    key={feedback.id}
                    onClick={() => handleViewFeedback(feedback.id)}
                    className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon size={16} className={typeConf.color} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{feedback.subject}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(feedback.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <div className="flex items-center gap-1">
                        {feedback.hasResponse && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <MessageCircle size={12} />
                            已回复
                          </span>
                        )}
                        <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpSupportPage;
