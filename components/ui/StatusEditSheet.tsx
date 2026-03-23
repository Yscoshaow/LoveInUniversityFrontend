import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { userProfileApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

interface StatusEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatusText?: string | null;
  currentStatusImageKey?: string | null;
  currentStatusImageUrl?: string | null;
}

export const StatusEditSheet: React.FC<StatusEditSheetProps> = ({
  isOpen,
  onClose,
  currentStatusText,
  currentStatusImageKey,
  currentStatusImageUrl,
}) => {
  const { refreshUser } = useAuth();
  const [statusText, setStatusText] = useState(currentStatusText || '');
  const [imageKey, setImageKey] = useState<string | null>(currentStatusImageKey || null);
  const [imagePreview, setImagePreview] = useState<string | null>(currentStatusImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片不能超过5MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await userProfileApi.uploadStatusImage(file);
      setImageKey(result.imageKey);
      setImagePreview(result.imageUrl);
    } catch (err) {
      alert('图片上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userProfileApi.updateStatus({
        statusText: statusText.trim() || null,
        statusImageKey: imageKey,
      });
      await refreshUser();
      onClose();
    } catch (err) {
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await userProfileApi.clearStatus();
      await refreshUser();
      onClose();
    } catch (err) {
      alert('清空失败');
    } finally {
      setIsClearing(false);
    }
  };

  const handleRemoveImage = () => {
    setImageKey(null);
    setImagePreview(null);
  };

  const hasExistingStatus = currentStatusText || currentStatusImageKey;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">编辑个人状态</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div>
          <textarea
            value={statusText}
            onChange={e => setStatusText(e.target.value.slice(0, 200))}
            placeholder="分享你此刻的心情..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="text-right text-xs text-slate-400 mt-1">{statusText.length}/200</div>
        </div>

        {imagePreview ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden">
            <img src={imagePreview} alt="状态图片" className="w-full h-full object-cover" />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <><Loader2 size={16} className="animate-spin" />上传中...</>
            ) : (
              <><ImagePlus size={16} />添加图片（可选）</>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        <div className="flex gap-2">
          {hasExistingStatus && (
            <button
              onClick={handleClear}
              disabled={isClearing || isSaving}
              className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              清空状态
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || isClearing || (!statusText.trim() && !imageKey)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
