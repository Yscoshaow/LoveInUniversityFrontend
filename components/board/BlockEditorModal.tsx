import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  X, Image, Type, ExternalLink, Palette,
  Timer, Music, Hash, ChevronRight, Upload, Loader2,
  GraduationCap, CheckSquare
} from 'lucide-react';
import type { BoardBlock, BoardBlockType, BoardBlockSize, BoardBlockContent } from '../../types';
import { boardApi } from '../../lib/api';
import { DatePickerSheet } from '@/components/ui/mobile-picker';

interface BlockEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: BoardBlock) => void;
  editingBlock?: BoardBlock | null;
}

const BLOCK_TYPES: { type: BoardBlockType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'IMAGE', label: '图片', icon: <Image size={20} />, description: '上传一张图片' },
  { type: 'TEXT', label: '文字', icon: <Type size={20} />, description: '标题和内容' },
  { type: 'LINK', label: '链接', icon: <ExternalLink size={20} />, description: '外部链接' },
  { type: 'COLOR', label: '色块', icon: <Palette size={20} />, description: '装饰色块' },
  { type: 'COUNTDOWN', label: '倒计时', icon: <Timer size={20} />, description: '目标日期' },
  { type: 'MUSIC', label: '音乐', icon: <Music size={20} />, description: '分享歌曲' },
  { type: 'STAT', label: '数据', icon: <Hash size={20} />, description: '数字展示' },
  { type: 'COURSE', label: '课程', icon: <GraduationCap size={20} />, description: '显示在修课程' },
  { type: 'TASK', label: '今日任务', icon: <CheckSquare size={20} />, description: '今日任务进度' },
];

const ALLOWED_SIZES: Record<BoardBlockType, BoardBlockSize[]> = {
  IMAGE: ['SMALL', 'WIDE', 'LARGE', 'W3H2', 'W3H3', 'W3H4', 'W4H3'],
  TEXT: ['SMALL', 'WIDE', 'LARGE', 'W3H2', 'W3H3', 'W3H4', 'W4H3'],
  LINK: ['WIDE'],
  COLOR: ['SMALL', 'WIDE', 'LARGE', 'W3H2', 'W3H3', 'W3H4', 'W4H3'],
  COUNTDOWN: ['SMALL', 'WIDE'],
  MUSIC: ['WIDE'],
  STAT: ['SMALL'],
  COURSE: ['WIDE', 'LARGE', 'W3H2', 'W3H3', 'W4H3'],
  TASK: ['WIDE', 'LARGE', 'W3H2', 'W3H3', 'W4H3'],
};

const SIZE_LABELS: Record<BoardBlockSize, { label: string; visual: string }> = {
  SMALL: { label: '小 (1×1)', visual: 'w-6 h-6' },
  WIDE: { label: '宽 (2×1)', visual: 'w-12 h-6' },
  LARGE: { label: '大 (2×2)', visual: 'w-12 h-12' },
  W3H2: { label: '中宽 (3×2)', visual: 'w-[4.5rem] h-12' },
  W3H3: { label: '中方 (3×3)', visual: 'w-[4.5rem] h-[4.5rem]' },
  W3H4: { label: '竖长 (3×4)', visual: 'w-[4.5rem] h-24' },
  W4H3: { label: '横幅 (4×3)', visual: 'w-24 h-[4.5rem]' },
};

const PRESET_COLORS = [
  '#EE5A7C', '#7B6EF6', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#1E293B', '#475569',
];

const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #EE5A7C, #7B6EF6)',
  'linear-gradient(135deg, #F59E0B, #EE5A7C)',
  'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  'linear-gradient(135deg, #10B981, #06B6D4)',
  'linear-gradient(135deg, #EC4899, #F97316)',
  'linear-gradient(135deg, #1E293B, #475569)',
];

type Step = 'type' | 'size' | 'content';

export const BlockEditorModal: React.FC<BlockEditorModalProps> = ({
  isOpen, onClose, onSave, editingBlock,
}) => {
  const isEditing = !!editingBlock;
  const [step, setStep] = useState<Step>(isEditing ? 'content' : 'type');
  const [selectedType, setSelectedType] = useState<BoardBlockType | null>(editingBlock?.type || null);
  const [selectedSize, setSelectedSize] = useState<BoardBlockSize>(editingBlock?.size || 'SMALL');
  const [content, setContent] = useState<BoardBlockContent>(editingBlock?.content || {});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renderBgColorPicker = (showTextColor = true) => (
    <>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">自定义背景</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setContent(prev => {
              const { bgColor, bgGradient, ...rest } = prev;
              return rest;
            })}
            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-[8px] text-slate-400 dark:text-slate-500 ${!content.bgColor && !content.bgGradient ? 'border-slate-800 bg-slate-100 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}
          >
            默认
          </button>
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setContent(prev => ({ ...prev, bgColor: color, bgGradient: undefined }))}
              className={`w-8 h-8 rounded-lg border-2 ${content.bgColor === color && !content.bgGradient ? 'border-slate-800' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">渐变背景</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_GRADIENTS.map(gradient => (
            <button
              key={gradient}
              onClick={() => setContent(prev => ({ ...prev, bgGradient: gradient, bgColor: undefined }))}
              className={`w-8 h-8 rounded-lg border-2 ${content.bgGradient === gradient ? 'border-slate-800' : 'border-transparent'}`}
              style={{ backgroundImage: gradient }}
            />
          ))}
        </div>
      </div>
      {showTextColor && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">文字颜色</p>
          <div className="flex gap-2">
            <button
              onClick={() => setContent(prev => { const { textColor, ...rest } = prev; return rest; })}
              className={`px-2.5 h-8 rounded-lg border-2 text-[10px] text-slate-400 dark:text-slate-500 ${!content.textColor ? 'border-slate-800 bg-slate-100 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}
            >
              默认
            </button>
            <button
              onClick={() => setContent(prev => ({ ...prev, textColor: '#ffffff' }))}
              className={`w-8 h-8 rounded-lg border-2 ${content.textColor === '#ffffff' ? 'border-slate-800' : 'border-slate-200 dark:border-slate-700'}`}
              style={{ backgroundColor: '#ffffff' }}
            />
            <button
              onClick={() => setContent(prev => ({ ...prev, textColor: '#1E293B' }))}
              className={`w-8 h-8 rounded-lg border-2 ${content.textColor === '#1E293B' ? 'border-slate-800' : 'border-slate-200 dark:border-slate-700'}`}
              style={{ backgroundColor: '#1E293B' }}
            />
          </div>
        </div>
      )}
    </>
  );

  if (!isOpen) return null;

  const handleSelectType = (type: BoardBlockType) => {
    setSelectedType(type);
    const allowed = ALLOWED_SIZES[type];
    setSelectedSize(allowed[0]);
    setContent({});
    // Skip size step if only one size
    if (allowed.length === 1) {
      setStep('content');
    } else {
      setStep('size');
    }
  };

  const handleSelectSize = (size: BoardBlockSize) => {
    setSelectedSize(size);
    setStep('content');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('图片不能超过 5MB');
      return;
    }
    setUploading(true);
    try {
      const result = await boardApi.uploadImage(file);
      setContent(prev => ({
        ...prev,
        imageUrl: result.imageUrl,
        imageKey: result.imageKey,
      }));
    } catch (err: any) {
      toast.error(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!selectedType) return;
    const block: BoardBlock = {
      id: editingBlock?.id || crypto.randomUUID(),
      type: selectedType,
      size: selectedSize,
      sortOrder: editingBlock?.sortOrder ?? 999,
      content,
    };
    onSave(block);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('type');
    setSelectedType(null);
    setSelectedSize('SMALL');
    setContent({});
    onClose();
  };

  const canSave = (): boolean => {
    if (!selectedType) return false;
    switch (selectedType) {
      case 'IMAGE': return !!content.imageUrl;
      case 'TEXT': return !!(content.title || content.body);
      case 'LINK': return !!content.url;
      case 'COLOR': return !!(content.bgColor || content.bgGradient);
      case 'COUNTDOWN': return !!content.targetDate;
      case 'MUSIC': return !!content.songName;
      case 'STAT': return !!content.statValue;
      case 'COURSE': return true;
      case 'TASK': return true;
      default: return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={resetAndClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
            {step === 'type' ? '选择类型' : step === 'size' ? '选择尺寸' : (isEditing ? '编辑内容' : '填写内容')}
          </h3>
          <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <X size={16} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Step: Type Selection */}
        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3">
            {BLOCK_TYPES.map(({ type, label, icon, description }) => (
              <button
                key={type}
                onClick={() => handleSelectType(type)}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                  {icon}
                </div>
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step: Size Selection */}
        {step === 'size' && selectedType && (
          <div className="space-y-3">
            {ALLOWED_SIZES[selectedType].map((size) => (
              <button
                key={size}
                onClick={() => handleSelectSize(size)}
                className={`w-full p-4 rounded-2xl border flex items-center gap-4 active:scale-[0.98] transition-all ${
                  selectedSize === size ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-700'
                }`}
              >
                <div className={`${SIZE_LABELS[size].visual} rounded-lg bg-primary/20 shrink-0`} />
                <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{SIZE_LABELS[size].label}</span>
                <ChevronRight size={16} className="ml-auto text-slate-300" />
              </button>
            ))}
          </div>
        )}

        {/* Step: Content Editor */}
        {step === 'content' && selectedType && (
          <div className="space-y-4">
            {selectedType === 'IMAGE' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {content.imageUrl ? (
                  <div className="relative">
                    <img src={content.imageUrl} alt="" className="w-full h-40 object-cover rounded-2xl" />
                    <button
                      onClick={() => { setContent(prev => ({ ...prev, imageUrl: undefined, imageKey: undefined })); fileInputRef.current?.click(); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500"
                  >
                    {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                    <span className="text-sm">{uploading ? '上传中...' : '点击上传图片'}</span>
                  </button>
                )}
                <input
                  type="text"
                  placeholder="图片说明（可选）"
                  value={content.caption || ''}
                  onChange={e => setContent(prev => ({ ...prev, caption: e.target.value }))}
                  maxLength={50}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
              </>
            )}

            {selectedType === 'TEXT' && (
              <>
                <input
                  type="text"
                  placeholder="标题"
                  value={content.title || ''}
                  onChange={e => setContent(prev => ({ ...prev, title: e.target.value }))}
                  maxLength={50}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <textarea
                  placeholder="内容（可选）"
                  value={content.body || ''}
                  onChange={e => setContent(prev => ({ ...prev, body: e.target.value }))}
                  maxLength={200}
                  rows={3}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">背景颜色</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setContent(prev => ({ ...prev, bgColor: color, bgGradient: undefined }))}
                        className={`w-8 h-8 rounded-lg border-2 ${content.bgColor === color && !content.bgGradient ? 'border-slate-800' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">渐变背景</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_GRADIENTS.map(gradient => (
                      <button
                        key={gradient}
                        onClick={() => setContent(prev => ({ ...prev, bgGradient: gradient, bgColor: undefined }))}
                        className={`w-8 h-8 rounded-lg border-2 ${content.bgGradient === gradient ? 'border-slate-800' : 'border-transparent'}`}
                        style={{ backgroundImage: gradient }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedType === 'LINK' && (
              <>
                <input
                  type="url"
                  placeholder="https://..."
                  value={content.url || ''}
                  onChange={e => setContent(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="text"
                  placeholder="链接标题"
                  value={content.linkTitle || ''}
                  onChange={e => setContent(prev => ({ ...prev, linkTitle: e.target.value }))}
                  maxLength={50}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="text"
                  placeholder="描述（可选）"
                  value={content.linkDescription || ''}
                  onChange={e => setContent(prev => ({ ...prev, linkDescription: e.target.value }))}
                  maxLength={100}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
              </>
            )}

            {selectedType === 'COLOR' && (
              <>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">纯色</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setContent({ bgColor: color, bgGradient: undefined })}
                        className={`w-8 h-8 rounded-lg border-2 ${content.bgColor === color && !content.bgGradient ? 'border-slate-800' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">渐变</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_GRADIENTS.map(gradient => (
                      <button
                        key={gradient}
                        onClick={() => setContent({ bgGradient: gradient, bgColor: undefined })}
                        className={`w-8 h-8 rounded-lg border-2 ${content.bgGradient === gradient ? 'border-slate-800' : 'border-transparent'}`}
                        style={{ backgroundImage: gradient }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedType === 'COUNTDOWN' && (
              <>
                <DatePickerSheet
                  value={content.targetDate || ''}
                  onChange={(v) => setContent(prev => ({ ...prev, targetDate: v }))}
                />
                <input
                  type="text"
                  placeholder="标签（如：距离考试）"
                  value={content.label || ''}
                  onChange={e => setContent(prev => ({ ...prev, label: e.target.value }))}
                  maxLength={30}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                {renderBgColorPicker()}
              </>
            )}

            {selectedType === 'MUSIC' && (
              <>
                <input
                  type="text"
                  placeholder="歌曲名"
                  value={content.songName || ''}
                  onChange={e => setContent(prev => ({ ...prev, songName: e.target.value }))}
                  maxLength={50}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="text"
                  placeholder="歌手（可选）"
                  value={content.artistName || ''}
                  onChange={e => setContent(prev => ({ ...prev, artistName: e.target.value }))}
                  maxLength={50}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="url"
                  placeholder="音乐链接（可选）"
                  value={content.musicUrl || ''}
                  onChange={e => setContent(prev => ({ ...prev, musicUrl: e.target.value }))}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">平台</p>
                  <div className="flex gap-2">
                    {(['spotify', 'apple', 'other'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setContent(prev => ({ ...prev, platform: p }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                          content.platform === p
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {p === 'spotify' ? 'Spotify' : p === 'apple' ? 'Apple Music' : '其他'}
                      </button>
                    ))}
                  </div>
                </div>
                {renderBgColorPicker()}
              </>
            )}

            {selectedType === 'STAT' && (
              <>
                <input
                  type="text"
                  placeholder="数值（如：42）"
                  value={content.statValue || ''}
                  onChange={e => setContent(prev => ({ ...prev, statValue: e.target.value }))}
                  maxLength={10}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-center text-2xl font-black focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="text"
                  placeholder="标签（如：books read）"
                  value={content.statLabel || ''}
                  onChange={e => setContent(prev => ({ ...prev, statLabel: e.target.value }))}
                  maxLength={30}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                <input
                  type="text"
                  placeholder="图标 emoji（如：📚）"
                  value={content.statIcon || ''}
                  onChange={e => setContent(prev => ({ ...prev, statIcon: e.target.value }))}
                  maxLength={4}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-center text-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
                />
                {renderBgColorPicker()}
              </>
            )}

            {(selectedType === 'COURSE' || selectedType === 'TASK') && (
              <>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
                    {selectedType === 'COURSE' ? <GraduationCap size={24} /> : <CheckSquare size={24} />}
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    {selectedType === 'COURSE' ? '课程小组件' : '今日任务小组件'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {selectedType === 'COURSE'
                      ? '此组件将实时显示你正在修读的课程和进度'
                      : '此组件将实时显示今日任务的完成进度'}
                  </p>
                  <p className="text-[10px] text-slate-300 mt-2">
                    添加后，访问你主页的人将看到实时数据
                  </p>
                </div>
                {renderBgColorPicker()}
              </>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!canSave()}
              className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
                canSave()
                  ? 'bg-primary text-white active:scale-[0.98]'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}
            >
              {isEditing ? '保存修改' : '添加到展示板'}
            </button>
          </div>
        )}

        {/* Back button for size/content steps */}
        {step !== 'type' && !isEditing && (
          <button
            onClick={() => setStep(step === 'content' ? (ALLOWED_SIZES[selectedType!].length === 1 ? 'type' : 'size') : 'type')}
            className="w-full mt-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 font-medium"
          >
            返回上一步
          </button>
        )}
      </div>
    </div>
  );
};
