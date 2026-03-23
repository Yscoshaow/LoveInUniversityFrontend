import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Loader2,
  X,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  ChevronDown,
  ChevronUp,
  Save,
  Smile,
} from 'lucide-react';
import { Player } from '@lottiefiles/react-lottie-player';
import { adminApi } from '../../lib/api';
import type { StickerPack, StickerItem } from '../../types';

interface StickerEditorPageProps {
  onBack: () => void;
}

export const StickerEditorPage: React.FC<StickerEditorPageProps> = ({ onBack }) => {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Expanded pack state
  const [expandedPackId, setExpandedPackId] = useState<number | null>(null);

  // Create/Edit modal state
  const [editingPack, setEditingPack] = useState<StickerPack | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);

  // Upload state
  const [uploadingPackId, setUploadingPackId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deletingPackId, setDeletingPackId] = useState<number | null>(null);
  const [deletingStickerId, setDeletingStickerId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getStickerPacks();
      setPacks(data);
    } catch (err) {
      console.error('Failed to fetch sticker packs:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingPack(null);
    setIsCreating(true);
    setFormName('');
    setFormSortOrder(0);
    setError(null);
  };

  const openEditModal = (pack: StickerPack) => {
    setEditingPack(pack);
    setIsCreating(true);
    setFormName(pack.name);
    setFormSortOrder(pack.sortOrder);
    setError(null);
  };

  const closeModal = () => {
    setEditingPack(null);
    setIsCreating(false);
    setFormName('');
    setFormSortOrder(0);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      setError('名称不能为空');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingPack) {
        await adminApi.updateStickerPack(editingPack.id, {
          name: formName.trim(),
          sortOrder: formSortOrder,
        });
      } else {
        await adminApi.createStickerPack({
          name: formName.trim(),
          sortOrder: formSortOrder,
        });
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Failed to save sticker pack:', err);
      setError('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (pack: StickerPack) => {
    try {
      await adminApi.updateStickerPack(pack.id, { isActive: !pack.isActive });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle pack active:', err);
    }
  };

  const handleDeletePack = async (id: number) => {
    try {
      await adminApi.deleteStickerPack(id);
      await fetchData();
      setDeletingPackId(null);
    } catch (err) {
      console.error('Failed to delete pack:', err);
    }
  };

  const handleDeleteSticker = async (id: number) => {
    try {
      await adminApi.deleteSticker(id);
      await fetchData();
      setDeletingStickerId(null);
    } catch (err) {
      console.error('Failed to delete sticker:', err);
    }
  };

  const handleUploadClick = (packId: number) => {
    setUploadingPackId(packId);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingPackId) return;

    setSubmitting(true);
    setError(null);

    try {
      await adminApi.uploadStickers(uploadingPackId, Array.from(files));
      await fetchData();
      // Keep the pack expanded to show new stickers
      setExpandedPackId(uploadingPackId);
    } catch (err) {
      console.error('Failed to upload stickers:', err);
      setError('上传失败，请重试');
    } finally {
      setSubmitting(false);
      setUploadingPackId(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading && packs.length === 0) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500 dark:text-pink-400" />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tgs,.json"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">贴纸管理</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              共 {packs.length} 个贴纸组，{packs.reduce((sum, p) => sum + p.stickers.length, 0)} 个贴纸
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center hover:bg-pink-600 shadow-md"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && !isCreating && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Uploading indicator */}
      {submitting && !isCreating && (
        <div className="mx-4 mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          正在上传贴纸...
        </div>
      )}

      {/* Pack List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {packs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
            <Smile size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">暂无贴纸组</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">点击右上角 + 创建第一个贴纸组</p>
          </div>
        ) : (
          packs.map((pack) => {
            const isExpanded = expandedPackId === pack.id;
            return (
              <div
                key={pack.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
              >
                {/* Pack header */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      pack.isActive ? 'bg-pink-50 dark:bg-pink-950 text-pink-500 dark:text-pink-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}>
                      <Smile size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pack.name}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          pack.isActive
                            ? 'bg-green-100 text-green-600 dark:text-green-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {pack.isActive ? '启用' : '禁用'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {pack.stickers.length} 个贴纸 · 排序: {pack.sortOrder}
                      </p>
                    </div>

                    <button
                      onClick={() => setExpandedPackId(isExpanded ? null : pack.id)}
                      className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Pack actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => openEditModal(pack)}
                      className="flex-1 py-2 bg-pink-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-pink-600"
                    >
                      <Edit3 size={14} />
                      编辑
                    </button>
                    <button
                      onClick={() => handleUploadClick(pack.id)}
                      disabled={submitting}
                      className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-blue-600 disabled:opacity-50"
                    >
                      <Upload size={14} />
                      上传贴纸
                    </button>
                    <button
                      onClick={() => handleToggleActive(pack)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium ${
                        pack.isActive
                          ? 'bg-amber-100 text-amber-600 dark:text-amber-400 hover:bg-amber-200'
                          : 'bg-green-100 text-green-600 dark:text-green-400 hover:bg-green-200'
                      }`}
                    >
                      {pack.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => setDeletingPackId(pack.id)}
                      className="px-3 py-2 bg-red-100 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded sticker grid */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
                    {pack.stickers.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                        暂无贴纸，点击"上传贴纸"添加
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        {pack.stickers.map((sticker) => (
                          <div
                            key={sticker.id}
                            className="relative bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-100 dark:border-slate-700 group"
                          >
                            <div className="aspect-square flex items-center justify-center">
                              <Player
                                autoplay
                                loop
                                src={sticker.fileUrl}
                                style={{ width: '100%', height: '100%' }}
                              />
                            </div>
                            {sticker.emoji && (
                              <p className="text-center text-xs mt-1">{sticker.emoji}</p>
                            )}
                            {/* Delete button on hover */}
                            <button
                              onClick={() => setDeletingStickerId(sticker.id)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Pack Modal */}
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
                {editingPack ? '编辑贴纸组' : '创建贴纸组'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
              >
                <X size={18} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="贴纸组名称"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-pink-400"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">排序（越小越靠前）</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-pink-400"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-pink-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-pink-600"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    {editingPack ? '保存修改' : '创建贴纸组'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pack Confirmation */}
      {deletingPackId !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setDeletingPackId(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">删除贴纸组将同时删除其中的所有贴纸，确定要删除吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPackId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => handleDeletePack(deletingPackId)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sticker Confirmation */}
      {deletingStickerId !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setDeletingStickerId(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">确定要删除这个贴纸吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingStickerId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteSticker(deletingStickerId)}
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

export default StickerEditorPage;
