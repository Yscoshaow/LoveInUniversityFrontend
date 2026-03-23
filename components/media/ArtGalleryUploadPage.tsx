import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Upload, X, Image as ImageIcon, Plus, Tag } from 'lucide-react';
import { galleryApi, mediaTagsApi } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';

interface ArtGalleryUploadPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const ArtGalleryUploadPage: React.FC<ArtGalleryUploadPageProps> = ({ onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const { data: popularTags } = useQuery({
    queryKey: ['media-tags', 'popular'],
    queryFn: () => mediaTagsApi.getPopular(),
  });

  const { data: searchedTags } = useQuery({
    queryKey: ['media-tags', 'search', tagInput],
    queryFn: () => mediaTagsApi.search(tagInput),
    enabled: tagInput.length >= 1,
  });

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', title);
      if (description) formData.append('description', description);
      formData.append('priceCampusPoints', String(price));
      if (tags.length > 0) formData.append('tags', tags.join(','));
      selectedFiles.forEach(file => formData.append('images', file));
      return galleryApi.upload(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gallery.all });
      onSuccess();
    },
  });

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const totalFiles = [...selectedFiles, ...newFiles].slice(0, 20);
    setSelectedFiles(totalFiles);

    // Generate previews
    const newPreviews = totalFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const canSubmit = title.trim() && selectedFiles.length > 0 && !uploadMutation.isPending;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-slate-800 dark:text-slate-100 ml-2">上传作品</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给你的作品起个名字"
            maxLength={200}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="介绍一下你的作品..."
            rows={3}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">价格（校园点）</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">设为 0 表示免费观看</p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">标签</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full text-xs">
                <Tag size={10} />{tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
          {tags.length < 10 && (
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                placeholder="输入标签后回车添加"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {showTagSuggestions && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {(tagInput ? searchedTags?.tags : popularTags?.tags)
                    ?.filter(t => !tags.includes(t))
                    .slice(0, 8)
                    .map(t => (
                      <button
                        key={t}
                        onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Tag size={12} className="inline mr-1.5 text-slate-400" />{t}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">最多 10 个标签，回车或逗号分隔</p>
        </div>

        {/* Image Upload */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">
            图片 * ({selectedFiles.length}/20)
          </label>

          <div className="grid grid-cols-3 gap-2">
            {previews.map((preview, idx) => (
              <div key={idx} className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-xl relative overflow-hidden">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {selectedFiles.length < 20 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
              >
                <Plus size={24} />
                <span className="text-xs mt-1">添加图片</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">每张图片最大 10MB，最多 20 张</p>
        </div>

        {/* Submit */}
        <button
          onClick={() => uploadMutation.mutate()}
          disabled={!canSubmit}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
        >
          <Upload size={18} />
          {uploadMutation.isPending ? '上传中...' : '提交作品'}
        </button>

        {uploadMutation.isError && (
          <p className="text-sm text-red-500 dark:text-red-400 text-center">
            {(uploadMutation.error as Error)?.message || '上传失败'}
          </p>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
          提交后将进入审核流程，审核通过后可获得 20 校园点奖励
        </p>
      </div>
    </div>
  );
};

export default ArtGalleryUploadPage;
