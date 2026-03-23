import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Upload, Film, Image as ImageIcon, Check, Loader2, Tag, X } from 'lucide-react';
import * as UpChunk from '@mux/upchunk';
import { cinemaApi, mediaTagsApi } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';

interface CinemaUploadPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

type UploadStep = 'form' | 'uploading' | 'confirming' | 'done';

export const CinemaUploadPage: React.FC<CinemaUploadPageProps> = ({ onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [step, setStep] = useState<UploadStep>('form');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  const handleCoverSelected = (file: File | null) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!title.trim() || !videoFile) return;
    setError(null);
    setStep('uploading');
    setUploadProgress(0);

    try {
      // Step 1: Get upload URL from backend
      const { videoId, uploadUrl } = await cinemaApi.createUploadUrl({
        title: title.trim(),
        description: description.trim() || undefined,
        priceCampusPoints: price,
        tags: tags.length > 0 ? tags : undefined,
      });

      // Step 2: Upload cover if provided
      if (coverFile) {
        const coverFormData = new FormData();
        coverFormData.append('file', coverFile);
        await cinemaApi.uploadCover(videoId, coverFormData);
      }

      // Step 3: Upload video to Mux via chunked upload
      setUploadProgress(10);
      await new Promise<void>((resolve, reject) => {
        const upload = UpChunk.createUpload({
          endpoint: uploadUrl,
          file: videoFile,
          chunkSize: 30720, // ~30 MB chunks
          attempts: 8,
          delayBeforeAttempt: 1.5,
        });

        upload.on('progress', (e) => {
          setUploadProgress(10 + Math.round((e.detail as number) * 0.8));
        });

        upload.on('success', () => resolve());

        upload.on('error', (e) => {
          reject(new Error((e.detail as any)?.message || '视频上传失败'));
        });
      });

      // Step 4: Confirm upload
      setStep('confirming');
      setUploadProgress(95);

      // Poll for confirmation (Mux needs time to process)
      let retries = 0;
      while (retries < 10) {
        try {
          await cinemaApi.confirmUpload(videoId);
          break;
        } catch {
          retries++;
          if (retries >= 10) break; // OK if confirm fails, video is still uploaded
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      setUploadProgress(100);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: queryKeys.cinema.all });

      // Auto navigate after a short delay
      setTimeout(() => onSuccess(), 2000);
    } catch (err: any) {
      setError(err?.message || '上传失败');
      setStep('form');
    }
  };

  const canSubmit = title.trim() && videoFile && step === 'form';

  if (step === 'uploading' || step === 'confirming') {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
        <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <h1 className="flex-1 text-lg font-semibold text-slate-800 dark:text-slate-100 text-center">上传中</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center">
            <Loader2 size={36} className="text-amber-500 dark:text-amber-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {step === 'uploading' ? '正在上传视频...' : '正在确认上传...'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">请不要关闭页面</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">{uploadProgress}%</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center">
            <Check size={36} className="text-green-500 dark:text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-800 dark:text-slate-100">上传成功！</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">你的视频正在审核中，审核通过后可获得 30 校园点</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 lg:pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-slate-800 dark:text-slate-100 ml-2">上传视频</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给你的视频起个名字"
            maxLength={200}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="介绍一下你的视频..."
            rows={3}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
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
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">设为 0 表示免费观看</p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">标签</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-full text-xs">
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
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
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

        {/* Video File */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">视频文件 *</label>
          {videoFile ? (
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Film size={24} className="text-amber-500 dark:text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-100 truncate">{videoFile.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button onClick={() => setVideoFile(null)} className="text-xs text-red-400">移除</button>
            </div>
          ) : (
            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full p-6 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 hover:border-amber-300 hover:text-amber-400 dark:text-amber-300 transition-colors"
            >
              <Upload size={28} />
              <span className="text-sm">点击选择视频文件</span>
            </button>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
        </div>

        {/* Cover Image (optional) */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 block">封面图（可选）</label>
          {coverPreview ? (
            <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded"
              >
                移除
              </button>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="w-full p-4 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:border-amber-300 hover:text-amber-400 dark:text-amber-300 transition-colors"
            >
              <ImageIcon size={20} />
              <span className="text-sm">选择封面图片</span>
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleCoverSelected(e.target.files?.[0] || null)}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleUpload}
          disabled={!canSubmit}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
        >
          <Upload size={18} />
          提交视频
        </button>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
          提交后将进入审核流程，审核通过后可获得 30 校园点奖励
        </p>
      </div>
    </div>
  );
};

export default CinemaUploadPage;
