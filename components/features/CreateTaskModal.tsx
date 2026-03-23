import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreateCampusTaskRequest } from '../../types';
import { campusTasksApi } from '../../lib/api';
import { campusTaskQueryKeys } from '../../hooks/useCampusTasks';
import {
  ArrowLeft,
  Type,
  FileText,
  Coins,
  Gift,
  Users,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  X,
  Plus,
  Minus,
  EyeOff
} from 'lucide-react';
import { useCreateCampusTask } from '../../hooks';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // React Query
  const queryClient = useQueryClient();
  const createTaskMutation = useCreateCampusTask();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState(20);
  const [maxCompletions, setMaxCompletions] = useState(10);
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Cover image state
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setRewardPoints(20);
      setMaxCompletions(10);
      setRequiresVerification(true);
      setIsAnonymous(false);
      setCoverImage(null);
      setCoverPreview(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCoverImage = () => {
    setCoverImage(null);
    setCoverPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!title.trim()) {
      setError('请输入任务标题');
      return;
    }
    if (!description.trim()) {
      setError('请输入任务描述');
      return;
    }
    if (rewardPoints < 10) {
      setError('奖励积分不能少于10');
      return;
    }

    setError(null);

    try {
      // Create task
      const request: CreateCampusTaskRequest = {
        title: title.trim(),
        description: description.trim(),
        rewardCampusPoints: rewardPoints,
        maxCompletions: maxCompletions,
        requiresVerification: requiresVerification,
        isAnonymous: isAnonymous,
      };

      const task = await createTaskMutation.mutateAsync(request);

      // Upload cover image if provided
      if (coverImage && task.id) {
        try {
          await campusTasksApi.uploadCoverImage(task.id, coverImage);
          // Re-invalidate queries after image upload so the list shows the cover
          queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
        } catch (imgErr) {
          console.error('Failed to upload cover image:', imgErr);
          // Don't fail the whole task creation for image upload failure
        }
      }

      // Invalidate to ensure CampusTasks refreshes (it uses local state, so we trigger via onSuccess)
      queryClient.invalidateQueries({ queryKey: campusTaskQueryKeys.all });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(err instanceof Error ? err.message : '创建任务失败');
    }
  };

  // Preset reward point amounts
  const rewardPresets = [10, 20, 50, 100];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:bg-black/50 lg:flex lg:items-center lg:justify-center"
    >
    <div
      className="w-full h-full bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300 lg:max-w-2xl lg:max-h-[90vh] lg:rounded-2xl lg:overflow-hidden lg:shadow-2xl lg:h-auto"
    >
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-50">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path
            fill="#7B6EF6"
            d="M45,-76.3C58.9,-69.3,71.4,-59.1,80.6,-46.7C89.8,-34.3,95.8,-19.7,94.8,-5.5C93.8,8.7,85.8,22.5,76.5,34.8C67.2,47.1,56.6,57.9,44.2,66.3C31.8,74.7,17.6,80.7,3.1,75.4C-11.4,70.1,-26.2,53.5,-39.8,40.8C-53.4,28.1,-65.8,19.3,-72.6,6.3C-79.4,-6.7,-80.6,-23.9,-73.1,-38.3C-65.6,-52.7,-49.4,-64.3,-34.1,-70.5C-18.8,-76.7,-4.4,-77.5,10.1,-77.3"
            transform="translate(100 0) scale(1.4)"
          />
          <path
            fill="#EE5A7C"
            d="M38.1,-64.4C49.6,-59.3,59.5,-49.6,66.9,-38.3C74.3,-27,79.2,-14.1,78.2,-1.5C77.2,11.1,70.3,23.4,61.4,33.5C52.5,43.6,41.6,51.5,30.1,58.3C18.6,65.1,6.5,70.8,-4.2,68C-14.9,65.2,-24.2,53.9,-35.1,44.2C-46,34.5,-58.5,26.4,-65.3,15.2C-72.1,4,-73.2,-10.3,-67.6,-22.4C-62,-34.5,-49.7,-44.4,-37.2,-49.2C-24.7,-54,-12,-53.7,0.7,-54.9C13.4,-56.1,26.6,-69.5,38.1,-64.4Z"
            transform="translate(140 20) scale(1.1)"
          />
        </svg>
      </div>

      {/* Header */}
      <div className="pt-8 px-6 pb-2 flex justify-between items-center relative z-20">
        <button
          onClick={onClose}
          disabled={createTaskMutation.isPending}
          className="p-2 -ml-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="text-slate-800 dark:text-slate-100 font-bold text-lg">发布任务</div>
        <div className="w-10"></div>
      </div>

      <div className="px-6 relative z-10 flex-1 overflow-y-auto no-scrollbar pt-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-8 max-w-[80%] leading-tight">
            发布一个
            <br />
            <span className="text-primary">校园任务</span>
          </h1>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl text-sm flex items-center gap-2">
              <X size={16} />
              {error}
            </div>
          )}

          {/* Cover Image Upload */}
          <div className="mb-6">
            <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <ImageIcon size={16} />
                封面图片
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">可选</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {coverPreview ? (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden">
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={removeCoverImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all cursor-pointer bg-slate-50 dark:bg-slate-900"
              >
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <span className="text-xs font-medium">点击上传图片</span>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="mb-6">
            <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block flex items-center gap-2">
              <Type size={16} />
              任务标题
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-primary/20 transition-all">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：帮忙取快递"
                className="bg-transparent w-full text-slate-800 dark:text-slate-100 font-semibold placeholder:text-slate-400 dark:text-slate-500 focus:outline-none"
                maxLength={50}
              />
            </div>
            <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{title.length}/50</div>
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block flex items-center gap-2">
              <FileText size={16} />
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-28 bg-slate-100 dark:bg-slate-700 rounded-2xl resize-none focus:outline-none p-4 text-sm text-slate-700 dark:text-slate-200 border-2 border-transparent focus:border-primary/20 transition-all"
              placeholder="详细描述任务内容、要求和完成标准..."
              maxLength={500}
            />
            <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{description.length}/500</div>
          </div>

          {/* Reward Points */}
          <div className="mb-6">
            <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block flex items-center gap-2">
              <Coins size={16} />
              奖励积分
            </label>
            <div className="flex gap-2 mb-3">
              {rewardPresets.map(preset => (
                <button
                  key={preset}
                  onClick={() => setRewardPoints(preset)}
                  className={`
                    flex-1 py-2 rounded-xl text-sm font-bold transition-all border-2
                    ${rewardPoints === preset
                      ? 'bg-amber-100 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}
                  `}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-primary/20 transition-all">
              <Coins size={18} className="text-amber-500 dark:text-amber-400 mr-3" />
              <input
                type="number"
                value={rewardPoints}
                onChange={(e) => setRewardPoints(Math.max(10, parseInt(e.target.value) || 10))}
                className="bg-transparent w-full text-slate-800 dark:text-slate-100 font-bold text-lg focus:outline-none"
                min={10}
              />
              <span className="text-slate-400 dark:text-slate-500 text-sm">积分</span>
            </div>
          </div>

          {/* Max Completions */}
          <div className="mb-6">
            <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block flex items-center gap-2">
              <Users size={16} />
              最大完成人数
            </label>
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3">
              <button
                onClick={() => setMaxCompletions(Math.max(0, maxCompletions - 1))}
                className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Minus size={18} />
              </button>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {maxCompletions === 0 ? '不限' : maxCompletions}
              </div>
              <button
                onClick={() => setMaxCompletions(maxCompletions + 1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
              设置为 0 表示不限制人数
            </p>
          </div>

          {/* Requires Verification Toggle */}
          <div className="mb-6">
            <div
              onClick={() => setRequiresVerification(!requiresVerification)}
              className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className={requiresVerification ? 'text-primary' : 'text-slate-400 dark:text-slate-500'} />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">需要审核</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">完成后需要你手动审核</div>
                </div>
              </div>
              <div className={`
                w-12 h-7 rounded-full transition-colors relative
                ${requiresVerification ? 'bg-primary' : 'bg-slate-300'}
              `}>
                <div className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-sm transition-transform
                  ${requiresVerification ? 'translate-x-6' : 'translate-x-1'}
                `}></div>
              </div>
            </div>
          </div>

          {/* Anonymous Toggle */}
          <div className="mb-6">
            <div
              onClick={() => setIsAnonymous(!isAnonymous)}
              className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <EyeOff size={20} className={isAnonymous ? 'text-purple-500 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'} />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">匿名发布</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">他人将无法看到你的身份</div>
                </div>
              </div>
              <div className={`
                w-12 h-7 rounded-full transition-colors relative
                ${isAnonymous ? 'bg-purple-500' : 'bg-slate-300'}
              `}>
                <div className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-sm transition-transform
                  ${isAnonymous ? 'translate-x-6' : 'translate-x-1'}
                `}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="absolute bottom-6 left-6 right-6 z-30">
        <button
          onClick={handleSubmit}
          disabled={createTaskMutation.isPending}
          className="w-full bg-gradient-to-r from-slate-900 to-slate-700 text-white font-bold py-4 rounded-3xl shadow-lg shadow-slate-900/30 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {createTaskMutation.isPending ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              发布中...
            </>
          ) : (
            '发布任务'
          )}
        </button>
      </div>
    </div>
    </div>
  );
};
