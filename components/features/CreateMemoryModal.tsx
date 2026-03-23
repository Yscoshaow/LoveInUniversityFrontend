import React, { useState, useRef } from 'react';
import { useCreateMemory } from '../../hooks/useMemory';
import { memoryApi } from '../../lib/api';
import type { Schedule, ScheduleSummary } from '../../types';
import {
  X, Image, Calendar, Clock, MapPin, Loader2, AlertCircle, Plus, Trash2
} from 'lucide-react';

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format time
const formatTime = (timeString: string): string => {
  const parts = timeString.split(':');
  return `${parts[0]}:${parts[1]}`;
};

interface CreateMemoryModalProps {
  schedule: Schedule | ScheduleSummary;
  onClose: () => void;
  onSuccess?: (memoryId: number) => void;
}

export const CreateMemoryModal: React.FC<CreateMemoryModalProps> = ({
  schedule,
  onClose,
  onSuccess
}) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMemoryMutation = useCreateMemory();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check total image count
    if (images.length + files.length > 9) {
      setError('最多只能上传9张图片');
      return;
    }

    // Validate file types and sizes
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('只能上传图片文件');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('单张图片不能超过10MB');
        continue;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }

    setImages(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...previews]);
    setError(null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('请输入回忆内容');
      return;
    }

    if (content.length > 5000) {
      setError('回忆内容不能超过5000字');
      return;
    }

    setError(null);

    try {
      // Create memory first
      const memory = await createMemoryMutation.mutateAsync({
        scheduleId: schedule.id,
        content: content.trim(),
        imageUrls: [] // Will upload images after
      });

      // Upload images if any
      if (images.length > 0) {
        setIsUploading(true);
        try {
          await memoryApi.uploadImages(memory.id, images);
        } catch (uploadError) {
          console.error('Failed to upload images:', uploadError);
          // Don't fail the whole operation if image upload fails
        }
        setIsUploading(false);
      }

      // Clean up previews
      imagePreviews.forEach(url => URL.revokeObjectURL(url));

      if (onSuccess) {
        onSuccess(memory.id);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const isSubmitting = createMemoryMutation.isPending || isUploading;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:w-[480px] sm:rounded-2xl rounded-t-[32px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">创建回忆</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Schedule Info */}
          <div className="bg-gradient-to-r from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">{schedule.title}</h3>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(schedule.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTime(schedule.startTime)}
              </span>
              {schedule.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {schedule.location}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Content Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              记录这一刻
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下你想记录的内容..."
              rows={6}
              maxLength={5000}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:text-slate-500 disabled:bg-slate-50 dark:bg-slate-900"
            />
            <div className="text-right text-xs text-slate-400 dark:text-slate-500 mt-1">
              {content.length}/5000
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              添加图片 (最多9张)
            </label>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <img
                      src={preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Image Button */}
            {images.length < 9 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <Plus size={24} />
                <span className="text-sm">点击添加图片</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isUploading ? '上传图片中...' : '创建中...'}
              </>
            ) : (
              '创建回忆'
            )}
          </button>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            回忆创建后默认为私密状态，你可以稍后选择发布到社区
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateMemoryModal;
