import React, { useState, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Upload,
  BookOpen,
  Coins,
  Loader2,
  Image,
  X,
  AlertCircle,
  CheckCircle,
  Plus,
  BookMarked,
  Eye,
  EyeOff,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useBookCategories,
  useUserCurrency,
  useUploadBook,
  useCreateSeries,
  useMySeries,
} from '../../hooks';
import { booksApi } from '../../lib/api';

type UploadMode = 'single' | 'series';

interface UserUploadPageProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export const UserUploadPage: React.FC<UserUploadPageProps> = ({ onBack, onSuccess }) => {
  const [mode, setMode] = useState<UploadMode>('single');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  // Form state - single book
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [price, setPrice] = useState(0);
  const [coverUrl, setCoverUrl] = useState('');

  // Form state - series
  const [seriesName, setSeriesName] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [seriesCoverUrl, setSeriesCoverUrl] = useState('');
  const [seriesCategoryId, setSeriesCategoryId] = useState<number | undefined>(undefined);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | undefined>(undefined);
  const [orderInSeries, setOrderInSeries] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useBookCategories();
  const { data: currency } = useUserCurrency();
  const { data: mySeries } = useMySeries();
  const uploadBookMutation = useUploadBook();
  const createSeriesMutation = useCreateSeries();

  const balance = currency?.campusPoints ?? 0;
  const UPLOAD_COST = 10;
  const canAfford = balance >= UPLOAD_COST;

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('封面图片不能超过 5MB');
      return;
    }

    setCoverUploading(true);
    setUploadError(null);
    try {
      const result = await booksApi.uploadUserCover(file);
      if (mode === 'series' && !selectedSeriesId) {
        setSeriesCoverUrl(result.url);
      } else {
        setCoverUrl(result.url);
      }
    } catch (err: any) {
      setUploadError(err?.message || '封面上传失败');
    } finally {
      setCoverUploading(false);
    }
  }, [mode, selectedSeriesId]);

  const handleCreateSeries = async () => {
    if (!seriesName.trim()) {
      setUploadError('请输入系列名称');
      return;
    }
    setUploadError(null);
    try {
      const result = await createSeriesMutation.mutateAsync({
        name: seriesName.trim(),
        description: seriesDescription.trim() || undefined,
        coverImageUrl: seriesCoverUrl || undefined,
        categoryId: seriesCategoryId,
      });
      setSelectedSeriesId(result.id);
      setUploadSuccess('系列创建成功！现在可以添加卷了');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || err?.message || '创建系列失败');
    }
  };

  const handleSubmitBook = async () => {
    setUploadError(null);
    try {
      const result = await uploadBookMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        coverImageUrl: coverUrl || undefined,
        categoryId: mode === 'series' ? undefined : categoryId,
        content: content,
        priceCampusPoints: price,
        seriesId: mode === 'series' ? selectedSeriesId : undefined,
        orderInSeries: mode === 'series' ? orderInSeries : undefined,
      });
      setUploadSuccess(result.message || '上传成功！等待管理员审核');
      // Reset form
      setTitle('');
      setDescription('');
      setContent('');
      setPrice(0);
      setCoverUrl('');
      if (mode === 'series') {
        setOrderInSeries(prev => prev + 1);
      }
      setShowConfirm(false);
      setTimeout(() => {
        setUploadSuccess(null);
        if (mode === 'single') onSuccess?.();
      }, 2000);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || err?.message || '上传失败');
      setShowConfirm(false);
    }
  };

  const isFormValid = title.trim() && content.trim();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">上传小说</h1>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-full">
            <Coins size={11} />
            余额: {balance}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mode switcher */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'single'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen size={13} />
              单本小说
            </button>
            <button
              onClick={() => setMode('series')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'series'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <BookMarked size={13} />
              系列小说
            </button>
          </div>
        </div>

        {/* Fee notice */}
        <div className="px-4 pb-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            canAfford ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
          }`}>
            <AlertCircle size={13} />
            <span>
              {mode === 'single'
                ? `发布费用: ${UPLOAD_COST} 校园点/本`
                : `创建系列免费，每本 ${UPLOAD_COST} 校园点`
              }
              {!canAfford && ' — 余额不足'}
            </span>
          </div>
        </div>

        {/* Success banner */}
        {uploadSuccess && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 text-xs">
              <CheckCircle size={13} />
              {uploadSuccess}
            </div>
          </div>
        )}

        {/* Error banner */}
        {uploadError && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={13} />
              {uploadError}
              <button onClick={() => setUploadError(null)} className="ml-auto">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Series creation section */}
        {mode === 'series' && !selectedSeriesId && (
          <div className="px-4 pb-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {mySeries && mySeries.length > 0 ? '选择已有系列或创建新系列' : '创建新系列'}
              </h3>

              {/* Existing series */}
              {mySeries && mySeries.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {mySeries.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeriesId(s.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:bg-indigo-950 transition-colors text-left border border-slate-100 dark:border-slate-700"
                    >
                      <BookMarked size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">{s.bookCount} 卷</span>
                    </button>
                  ))}
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
                    <div className="relative flex justify-center"><span className="bg-slate-50 dark:bg-slate-900 px-2 text-[10px] text-slate-400 dark:text-slate-500">或 创建新系列</span></div>
                  </div>
                </div>
              )}

              {/* New series form */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder="系列名称 *"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-800"
                />
                <textarea
                  value={seriesDescription}
                  onChange={(e) => setSeriesDescription(e.target.value)}
                  placeholder="系列简介（选填）"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-800 resize-none"
                />
                <select
                  value={seriesCategoryId ?? ''}
                  onChange={(e) => setSeriesCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-800"
                >
                  <option value="">分类（选填）</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Cover upload for series */}
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:text-indigo-400 transition-colors w-full justify-center"
                  >
                    {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                    {seriesCoverUrl ? '更换封面' : '上传封面（选填）'}
                  </button>
                  {seriesCoverUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={seriesCoverUrl} alt="封面" className="w-10 h-14 rounded object-cover" />
                      <button onClick={() => setSeriesCoverUrl('')} className="text-xs text-red-500 dark:text-red-400">移除</button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCreateSeries}
                  disabled={!seriesName.trim() || createSeriesMutation.isPending}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {createSeriesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  创建系列
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Series selected indicator */}
        {mode === 'series' && selectedSeriesId && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900">
              <BookMarked size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400 flex-1">
                {mySeries?.find((s: any) => s.id === selectedSeriesId)?.name ?? (seriesName || '系列')}
              </span>
              <button
                onClick={() => setSelectedSeriesId(undefined)}
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-400"
              >
                更换
              </button>
            </div>
          </div>
        )}

        {/* Book form (visible for single mode always, series mode after series selected) */}
        {(mode === 'single' || selectedSeriesId) && (
          <div className="px-4 pb-8 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {mode === 'series' ? `添加第 ${orderInSeries} 卷` : '小说信息'}
            </h3>

            {/* Title */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入小说标题"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">简介</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述你的小说"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {/* Category (only for single mode) */}
            {mode === 'single' && (
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">分类</label>
                <select
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">选择分类</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Order in series */}
            {mode === 'series' && (
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">卷序号</label>
                <input
                  type="number"
                  value={orderInSeries}
                  onChange={(e) => setOrderInSeries(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            )}

            {/* Price */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">价格（校园点，0 = 免费）</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Cover upload */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">封面</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              {coverUrl ? (
                <div className="flex items-center gap-3">
                  <img src={coverUrl} alt="封面" className="w-14 h-20 rounded-lg object-cover shadow-sm" />
                  <div className="space-y-1.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={coverUploading}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      更换封面
                    </button>
                    <button
                      onClick={() => setCoverUrl('')}
                      className="block text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:text-red-400"
                    >
                      移除封面
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={coverUploading}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:text-indigo-400 transition-colors w-full justify-center"
                >
                  {coverUploading ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
                  上传封面图片
                </button>
              )}
            </div>

            {/* Content (Markdown editor) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">内容 *（支持 Markdown）</label>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400"
                >
                  {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showPreview ? '编辑' : '预览'}
                </button>
              </div>
              {showPreview ? (
                <div className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[200px] max-h-[400px] overflow-y-auto bg-slate-50 dark:bg-slate-900 prose prose-sm prose-slate dark:prose-invert max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {content || '*暂无内容*'}
                  </Markdown>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在这里写你的小说内容...&#10;&#10;支持 Markdown 格式：&#10;# 第一章 标题&#10;## 第一节&#10;正文内容..."
                  rows={12}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y font-mono leading-relaxed"
                />
              )}
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{content.length} 字</p>
            </div>

            {/* Submit button */}
            <button
              onClick={() => {
                setUploadError(null);
                setShowConfirm(true);
              }}
              disabled={!isFormValid || !canAfford}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                isFormValid && canAfford
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Upload size={15} />
              提交审核（扣 {UPLOAD_COST} 校园点）
            </button>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">确认提交</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              《{title}》
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              将扣除 <span className="font-semibold text-amber-600 dark:text-amber-400">{UPLOAD_COST}</span> 校园点作为发布费用
              <br />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                提交后需等待管理员审核
              </span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={uploadBookMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitBook}
                disabled={uploadBookMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {uploadBookMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
