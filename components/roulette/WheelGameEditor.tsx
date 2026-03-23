import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Upload,
  Loader2,
  Image as ImageIcon,
  Type,
  X,
  Coins,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import type {
  RouletteGameType,
  RouletteGameDetail,
  CreateRouletteGameRequest,
  WheelCategory,
  ImageWheelConfig,
  TextWheelConfig,
} from '../../types';

interface WheelGameEditorProps {
  gameId: number | null;
  gameType: RouletteGameType;
  onBack: () => void;
  onSaved: () => void;
}

interface EditableCategory {
  id: string;
  name: string;
  description: string;
  minPoints: number;
  maxPoints: number;
  pointDescriptions: Record<string, string>;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

export const WheelGameEditor: React.FC<WheelGameEditorProps> = ({
  gameId,
  gameType,
  onBack,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<EditableCategory[]>([]);
  const [priceCampusPoints, setPriceCampusPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const isImageWheel = gameType === 'IMAGE_WHEEL';

  useEffect(() => {
    if (gameId) {
      loadGame();
    } else {
      setCategories([createEmptyCategory()]);
    }
  }, [gameId]);

  const createEmptyCategory = (): EditableCategory => ({
    id: generateId(),
    name: '',
    description: '',
    minPoints: 1,
    maxPoints: 6,
    pointDescriptions: {},
  });

  const loadGame = async () => {
    setIsLoading(true);
    try {
      const game = await rouletteApi.getGame(gameId!);
      setTitle(game.title);
      setDescription(game.description);
      setCoverImageUrl(game.coverImageUrl || '');
      setTags(game.tags);
      setPriceCampusPoints(game.priceCampusPoints ?? 0);

      if (game.wheelConfig) {
        if (isImageWheel) {
          const config: ImageWheelConfig = JSON.parse(game.wheelConfig);
          // Backwards compat: support both imageUrls and imageUrl
          const imgs = config.imageUrls?.length
            ? config.imageUrls
            : config.imageUrl
              ? [config.imageUrl]
              : [];
          setImageUrls(imgs);
          setCategories(config.categories.map(c => ({
            id: generateId(),
            name: c.name,
            description: c.description || '',
            minPoints: c.minPoints,
            maxPoints: c.maxPoints,
            pointDescriptions: c.pointDescriptions || {},
          })));
        } else {
          const config: TextWheelConfig = JSON.parse(game.wheelConfig);
          setCategories(config.categories.map(c => ({
            id: generateId(),
            name: c.name,
            description: c.description || '',
            minPoints: c.minPoints,
            maxPoints: c.maxPoints,
            pointDescriptions: c.pointDescriptions || {},
          })));
        }
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await rouletteApi.uploadImage(file);
      if (isImageWheel) {
        setImageUrls(prev => [...prev, result.imageUrl]);
      } else {
        setCoverImageUrl(result.imageUrl);
      }
    } catch (err: any) {
      setError(err.message || '上传失败');
    } finally {
      setIsUploading(false);
      // Reset file input so the same file can be re-selected
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addCategory = () => {
    setCategories(prev => [...prev, createEmptyCategory()]);
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const updateCategory = (id: string, field: keyof EditableCategory, value: any) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updatePointDescription = (catId: string, point: string, desc: string) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const pd = { ...c.pointDescriptions };
      if (desc) {
        pd[point] = desc;
      } else {
        delete pd[point];
      }
      return { ...c, pointDescriptions: pd };
    }));
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const buildWheelConfig = (): string => {
    const cats: WheelCategory[] = categories.map(c => ({
      name: c.name.trim(),
      description: c.description.trim() || undefined,
      minPoints: c.minPoints,
      maxPoints: c.maxPoints,
      pointDescriptions: Object.keys(c.pointDescriptions).length > 0 ? c.pointDescriptions : undefined,
    }));

    if (isImageWheel) {
      const config: ImageWheelConfig = { imageUrls, categories: cats };
      return JSON.stringify(config);
    } else {
      const config: TextWheelConfig = { categories: cats };
      return JSON.stringify(config);
    }
  };

  const handleSave = async (publish = false) => {
    setError(null);
    if (publish) setIsPublishing(true);
    else setIsSaving(true);

    try {
      const request: CreateRouletteGameRequest = {
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: (isImageWheel ? imageUrls[0] : coverImageUrl.trim()) || undefined,
        sections: [],
        specialRules: [],
        tags,
        roundExitEnabled: false,
        priceCampusPoints,
        gameType,
        wheelConfig: buildWheelConfig(),
      };

      let savedGame: RouletteGameDetail;
      if (gameId) {
        savedGame = await rouletteApi.updateGame(gameId, request);
      } else {
        savedGame = await rouletteApi.createGame(request);
      }

      if (publish) {
        await rouletteApi.publishGame(savedGame.id);
      }

      onSaved();
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex-1">
          {gameId ? '编辑' : '创建'}{isImageWheel ? '图片轮盘' : '文字轮盘'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || isPublishing}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="ml-1">保存</span>
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving || isPublishing}
            className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors disabled:opacity-50"
          >
            {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>发布</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Title & Description */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="给你的轮盘起个名字"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述一下这个轮盘的玩法"
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
            />
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">
            {isImageWheel ? `轮盘图片 (${imageUrls.length})` : '封面图片（可选）'}
          </label>

          {isImageWheel ? (
            /* Multi-image grid for IMAGE_WHEEL */
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {/* Add button */}
              <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-teal-400 transition-colors">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {isUploading ? (
                  <Loader2 size={20} className="text-slate-400 dark:text-slate-500 animate-spin" />
                ) : (
                  <>
                    <Plus size={20} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">添加</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            /* Single cover image for TEXT_WHEEL */
            coverImageUrl ? (
              <div className="relative">
                <img
                  src={coverImageUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  onClick={() => setCoverImageUrl('')}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-teal-400 transition-colors">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {isUploading ? (
                  <Loader2 size={24} className="text-slate-400 dark:text-slate-500 animate-spin" />
                ) : (
                  <>
                    <Upload size={24} className="text-slate-400 dark:text-slate-500 mb-2" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">点击上传图片</span>
                  </>
                )}
              </label>
            )
          )}
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              分类 ({categories.length})
            </h2>
            <button
              onClick={addCategory}
              className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors"
            >
              <Plus size={14} />
              添加分类
            </button>
          </div>

          {categories.map((cat, idx) => (
            <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                  {cat.name || String.fromCharCode(65 + idx)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {cat.name || `分类 ${idx + 1}`}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{cat.minPoints}-{cat.maxPoints} 点</p>
                </div>
                {categories.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {expandedCategory === cat.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">名称</label>
                    <input
                      type="text"
                      value={cat.name}
                      onChange={e => updateCategory(cat.id, 'name', e.target.value)}
                      placeholder="例如 A / 惩罚 / 奖励"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none"
                    />
                  </div>

                  {!isImageWheel && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">描述</label>
                      <textarea
                        value={cat.description}
                        onChange={e => updateCategory(cat.id, 'description', e.target.value)}
                        placeholder="描述这个分类的含义"
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none resize-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">最小值</label>
                      <input
                        type="number"
                        value={cat.minPoints}
                        onChange={e => updateCategory(cat.id, 'minPoints', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">最大值</label>
                      <input
                        type="number"
                        value={cat.maxPoints}
                        onChange={e => updateCategory(cat.id, 'maxPoints', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none"
                      />
                    </div>
                  </div>

                  {/* Point descriptions (TEXT_WHEEL only) */}
                  {!isImageWheel && cat.minPoints <= cat.maxPoints && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">
                        每个点数的说明（可选）
                      </label>
                      <div className="space-y-2">
                        {Array.from(
                          { length: cat.maxPoints - cat.minPoints + 1 },
                          (_, i) => cat.minPoints + i
                        ).map(point => (
                          <div key={point} className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                              {point}
                            </span>
                            <input
                              type="text"
                              value={cat.pointDescriptions[String(point)] || ''}
                              onChange={e => updatePointDescription(cat.id, String(point), e.target.value)}
                              placeholder={`点数 ${point} 的说明`}
                              className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">标签</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500 dark:hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="输入标签"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-400 outline-none"
            />
            <button
              onClick={addTag}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              添加
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">收费设置</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={9999}
              value={priceCampusPoints}
              onChange={e => setPriceCampusPoints(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-teal-400 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">校园点（0 = 免费）</span>
          </div>
          {priceCampusPoints > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              玩家需支付 {priceCampusPoints} 校园点才能游玩，收入归你所有
            </p>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
};
