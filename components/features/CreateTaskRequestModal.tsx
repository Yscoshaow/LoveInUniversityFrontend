import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useCreateTaskRequest } from '../../hooks/useTaskRequests';
import {
  ArrowLeft,
  Type,
  FileText,
  Coins,
  X,
  Loader2,
  Megaphone,
} from 'lucide-react';

interface CreateTaskRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (requestId: number) => void;
}

export const CreateTaskRequestModal: React.FC<CreateTaskRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const createMutation = useCreateTaskRequest();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardAmount, setRewardAmount] = useState(20);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setRewardAmount(20);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!description.trim()) {
      setError('请输入描述');
      return;
    }
    if (rewardAmount < 10) {
      setError('悬赏金额不能少于10校园点数');
      return;
    }
    if (user && rewardAmount > (user.campusPoints ?? 0)) {
      setError('校园点数不足');
      return;
    }

    setError(null);

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        rewardAmount,
      });
      onSuccess?.(result.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const rewardPresets = [10, 20, 50, 100];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:bg-black/50 lg:flex lg:items-center lg:justify-center">
      <div className="w-full h-full bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300 lg:max-w-2xl lg:max-h-[90vh] lg:rounded-2xl lg:overflow-hidden lg:shadow-2xl lg:h-auto">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-50">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path
              fill="#F59E0B"
              d="M45,-76.3C58.9,-69.3,71.4,-59.1,80.6,-46.7C89.8,-34.3,95.8,-19.7,94.8,-5.5C93.8,8.7,85.8,22.5,76.5,34.8C67.2,47.1,56.6,57.9,44.2,66.3C31.8,74.7,17.6,80.7,3.1,75.4C-11.4,70.1,-26.2,53.5,-39.8,40.8C-53.4,28.1,-65.8,19.3,-72.6,6.3C-79.4,-6.7,-80.6,-23.9,-73.1,-38.3C-65.6,-52.7,-49.4,-64.3,-34.1,-70.5C-18.8,-76.7,-4.4,-77.5,10.1,-77.3"
              transform="translate(100 0) scale(1.4)"
            />
          </svg>
        </div>

        {/* Header */}
        <div className="pt-8 px-6 pb-2 flex justify-between items-center relative z-20">
          <button
            onClick={onClose}
            disabled={createMutation.isPending}
            className="p-2 -ml-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="text-slate-800 dark:text-slate-100 font-bold text-lg">发布求任务</div>
          <div className="w-10"></div>
        </div>

        <div className="px-6 relative z-10 flex-1 overflow-y-auto no-scrollbar pt-4">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-8 max-w-[80%] leading-tight">
              发布一个
              <br />
              <span className="text-amber-500 dark:text-amber-400">任务悬赏</span>
            </h1>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl text-sm flex items-center gap-2">
                <X size={16} />
                {error}
              </div>
            )}

            {/* Title */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 flex items-center gap-2">
                <Type size={16} />
                标题
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="你想要什么样的任务？"
                maxLength={200}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all"
              />
              <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{title.length}/200</div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 flex items-center gap-2">
                <FileText size={16} />
                描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="详细描述你对这个任务的需求..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all resize-none"
              />
            </div>

            {/* Reward Amount */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Coins size={16} />
                  悬赏金额
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  余额: {user?.campusPoints ?? 0} 校园点数
                </span>
              </label>

              {/* Preset Amounts */}
              <div className="flex gap-2 mb-3">
                {rewardPresets.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setRewardAmount(amount)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      rewardAmount === amount
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-700">
                <Coins size={16} className="text-amber-500 dark:text-amber-400" />
                <input
                  type="number"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  min={10}
                  className="flex-1 bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">校园点数</span>
              </div>

              {rewardAmount > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Megaphone size={10} />
                  发布后将从你的余额中扣除 {rewardAmount} 校园点数作为悬赏
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-800 dark:via-slate-800 z-30">
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !title.trim() || !description.trim() || rewardAmount < 10}
            className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
          >
            {createMutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Megaphone size={18} />
                发布悬赏 ({rewardAmount} 校园点数)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
