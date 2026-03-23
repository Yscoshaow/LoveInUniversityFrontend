import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  ScrollText,
  Loader2,
  X,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  Calendar,
  Save,
} from 'lucide-react';
import { adminChangelogApi } from '../../lib/api';
import type { ChangelogData, CreateChangelogRequest, UpdateChangelogRequest } from '../../types';

interface ChangelogEditorPageProps {
  onBack: () => void;
}

export const ChangelogEditorPage: React.FC<ChangelogEditorPageProps> = ({ onBack }) => {
  const [changelogs, setChangelogs] = useState<ChangelogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit/Create modal state
  const [editingChangelog, setEditingChangelog] = useState<ChangelogData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await adminChangelogApi.getAll();
      setChangelogs(data);
    } catch (err) {
      console.error('Failed to fetch changelogs:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingChangelog(null);
    setIsCreating(true);
    setFormTitle('');
    setFormContent('');
    setFormVersion('');
    setFormIsPublished(true);
  };

  const openEditModal = (changelog: ChangelogData) => {
    setEditingChangelog(changelog);
    setIsCreating(true);
    setFormTitle(changelog.title);
    setFormContent(changelog.content);
    setFormVersion(changelog.version || '');
    setFormIsPublished(changelog.isPublished);
  };

  const closeModal = () => {
    setEditingChangelog(null);
    setIsCreating(false);
    setFormTitle('');
    setFormContent('');
    setFormVersion('');
    setFormIsPublished(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      setError('标题和内容不能为空');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingChangelog) {
        const updateData: UpdateChangelogRequest = {
          title: formTitle.trim(),
          content: formContent.trim(),
          version: formVersion.trim() || undefined,
          isPublished: formIsPublished,
        };
        await adminChangelogApi.update(editingChangelog.id, updateData);
      } else {
        const createData: CreateChangelogRequest = {
          title: formTitle.trim(),
          content: formContent.trim(),
          version: formVersion.trim() || undefined,
          isPublished: formIsPublished,
        };
        await adminChangelogApi.create(createData);
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Failed to save changelog:', err);
      setError('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminChangelogApi.delete(id);
      await fetchData();
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete changelog:', err);
    }
  };

  const handleTogglePublish = async (changelog: ChangelogData) => {
    try {
      await adminChangelogApi.update(changelog.id, {
        isPublished: !changelog.isPublished,
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle publish:', err);
    }
  };

  if (loading && changelogs.length === 0) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 dark:text-emerald-400" />
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">更新日志管理</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              共 {changelogs.length} 条日志
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-md"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {changelogs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
            <ScrollText size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">暂无更新日志</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">点击右上角 + 创建第一条</p>
          </div>
        ) : (
          changelogs.map((changelog) => (
            <div
              key={changelog.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  changelog.isPublished ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}>
                  <ScrollText size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{changelog.title}</span>
                    {changelog.version && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                        <Tag size={10} />
                        {changelog.version}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      changelog.isPublished
                        ? 'bg-green-100 text-green-600 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {changelog.isPublished ? '已发布' : '草稿'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">{changelog.content}</p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(changelog.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => openEditModal(changelog)}
                  className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-emerald-600"
                >
                  <Edit3 size={14} />
                  编辑
                </button>
                <button
                  onClick={() => handleTogglePublish(changelog)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium ${
                    changelog.isPublished
                      ? 'bg-amber-100 text-amber-600 dark:text-amber-400 hover:bg-amber-200'
                      : 'bg-green-100 text-green-600 dark:text-green-400 hover:bg-green-200'
                  }`}
                >
                  {changelog.isPublished ? (
                    <><EyeOff size={14} className="inline mr-1" />隐藏</>
                  ) : (
                    <><Eye size={14} className="inline mr-1" />发布</>
                  )}
                </button>
                <button
                  onClick={() => setDeletingId(changelog.id)}
                  className="px-3 py-2 bg-red-100 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {isCreating && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingChangelog ? '编辑日志' : '创建日志'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
              >
                <X size={18} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">标题 *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="更新标题"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Version */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">版本号（可选）</label>
                <input
                  type="text"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="例如 v1.2.0"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">内容 *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="更新内容..."
                  rows={8}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm resize-none focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Published Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">立即发布</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">关闭则保存为草稿</p>
                </div>
                <button
                  onClick={() => setFormIsPublished(!formIsPublished)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    formIsPublished ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full absolute top-1 transition-transform ${
                    formIsPublished ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-emerald-600"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    {editingChangelog ? '保存修改' : '创建日志'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">删除后无法恢复，确定要删除这条更新日志吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangelogEditorPage;
