import React, { useState } from 'react';
import { ChevronLeft, Save, Loader2, Plus, X, BookOpen, Camera, Check, MessageSquare, Trash2, ImagePlus } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import {
  useCreateCard, useUpdateCard, useCardDetail,
  useUploadAvatar, useUploadImages, useDeleteImage, useWorldBook,
  useCreateWorldBookEntry, useUpdateWorldBookEntry, useDeleteWorldBookEntry,
} from '../../hooks/useAlumniChat';
import type { CreateCharacterCardRequest, CreateWorldBookEntryRequest, WorldBookEntryData } from '../../types';

type Step = 'identity' | 'personality' | 'content' | 'advanced' | 'worldbook';
const STEPS: Step[] = ['identity', 'personality', 'content', 'advanced', 'worldbook'];
const STEP_LABELS: Record<Step, string> = {
  identity: '基本',
  personality: '性格',
  content: '内容',
  advanced: '高级',
  worldbook: '世界书',
};

interface DialogueMessage {
  role: 'ai' | 'user';
  text: string;
}
type DialogueGroup = DialogueMessage[];

interface CharacterCardWizardProps {
  cardId?: number | null;
  onBack: () => void;
  onComplete: (cardId: number) => void;
}

const CharacterCardWizard: React.FC<CharacterCardWizardProps> = ({ cardId, onBack, onComplete }) => {
  const isEdit = !!cardId;
  const { data: existingCard } = useCardDetail(cardId ?? null);
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const uploadAvatar = useUploadAvatar();
  const uploadImages = useUploadImages();
  const deleteImage = useDeleteImage();

  const [step, setStep] = useState<Step>('identity');
  const [saving, setSaving] = useState(false);

  // Identity
  const [name, setName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Personality
  const [personality, setPersonality] = useState('');
  const [scenario, setScenario] = useState('');

  // Content
  const [systemPrompt, setSystemPrompt] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [openingDialogues, setOpeningDialogues] = useState<DialogueGroup[]>([]);

  // Advanced
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [priceCampusPoints, setPriceCampusPoints] = useState(0);

  React.useEffect(() => {
    if (existingCard) {
      setName(existingCard.name);
      setIntroduction(existingCard.introduction || '');
      setPersonality(existingCard.personality || '');
      setScenario(existingCard.scenario || '');
      setSystemPrompt(existingCard.systemPrompt || '');
      setDetailedDescription(existingCard.detailedDescription || '');
      setPriceCampusPoints(existingCard.priceCampusPoints);
      if (existingCard.avatarUrl) setAvatarPreview(existingCard.avatarUrl);
      try { setTags(existingCard.tags ? JSON.parse(existingCard.tags) : []); } catch { /* ignore */ }
      try { setSuggestedReplies(existingCard.suggestedReplies ? JSON.parse(existingCard.suggestedReplies) : []); } catch { /* ignore */ }
      try { setOpeningDialogues(existingCard.openingDialogues ? JSON.parse(existingCard.openingDialogues) : []); } catch { /* ignore */ }
    }
  }, [existingCard]);

  const stepIndex = STEPS.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };

  const addReply = () => {
    const r = replyInput.trim();
    if (r && !suggestedReplies.includes(r)) { setSuggestedReplies([...suggestedReplies, r]); setReplyInput(''); }
  };

  // Opening dialogues helpers
  const addDialogueGroup = () => {
    setOpeningDialogues([...openingDialogues, [{ role: 'ai', text: '' }]]);
  };

  const removeDialogueGroup = (groupIndex: number) => {
    setOpeningDialogues(openingDialogues.filter((_, i) => i !== groupIndex));
  };

  const addMessageToGroup = (groupIndex: number, role: 'ai' | 'user') => {
    const updated = [...openingDialogues];
    updated[groupIndex] = [...updated[groupIndex], { role, text: '' }];
    setOpeningDialogues(updated);
  };

  const updateMessage = (groupIndex: number, msgIndex: number, text: string) => {
    const updated = [...openingDialogues];
    updated[groupIndex] = [...updated[groupIndex]];
    updated[groupIndex][msgIndex] = { ...updated[groupIndex][msgIndex], text };
    setOpeningDialogues(updated);
  };

  const removeMessage = (groupIndex: number, msgIndex: number) => {
    const updated = [...openingDialogues];
    updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== msgIndex);
    if (updated[groupIndex].length === 0) {
      setOpeningDialogues(updated.filter((_, i) => i !== groupIndex));
    } else {
      setOpeningDialogues(updated);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: { file: File; preview: string }[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ file, preview: reader.result as string });
        if (newImages.length === files.length) {
          setPendingImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingImage = (imageId: number) => {
    if (!cardId) return;
    if (confirm('删除这张图片？')) {
      deleteImage.mutate({ cardId, imageId });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('请输入角色名称');
    setSaving(true);
    try {
      const cleanDialogues = openingDialogues
        .map(group => group.filter(msg => msg.text.trim()))
        .filter(group => group.length > 0);

      const request: CreateCharacterCardRequest = {
        name: name.trim(),
        introduction: introduction || undefined,
        personality: personality || undefined,
        scenario: scenario || undefined,
        systemPrompt: systemPrompt || undefined,
        detailedDescription: detailedDescription || undefined,
        tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
        suggestedReplies: suggestedReplies.length > 0 ? JSON.stringify(suggestedReplies) : undefined,
        openingDialogues: cleanDialogues.length > 0 ? JSON.stringify(cleanDialogues) : undefined,
        priceCampusPoints,
      };

      let finalCardId: number;
      if (isEdit && cardId) {
        await updateCard.mutateAsync({ id: cardId, request });
        finalCardId = cardId;
      } else {
        const result = await createCard.mutateAsync(request);
        finalCardId = result.id;
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        await uploadAvatar.mutateAsync({ cardId: finalCardId, formData });
      }

      // Upload gallery images
      if (pendingImages.length > 0) {
        setUploadingImages(true);
        const formData = new FormData();
        pendingImages.forEach(img => formData.append('images', img.file));
        await uploadImages.mutateAsync({ cardId: finalCardId, formData });
        setUploadingImages(false);
      }

      onComplete(finalCardId);
    } catch (e: any) {
      alert(e.message || '保存失败');
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  };

  const existingImages = existingCard?.images || [];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          {isEdit ? '编辑角色卡' : '创建角色卡'}
        </h2>
      </div>

      {/* Step indicator */}
      <div className="px-3 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const isPast = i < stepIndex;
            const isCurrent = s === step;
            return (
              <React.Fragment key={s}>
                <button
                  onClick={() => setStep(s)}
                  className="flex flex-col items-center gap-1 flex-1 min-w-0"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCurrent
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/50'
                      : isPast
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}>
                    {isPast ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium truncate ${
                    isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded-full -mt-3 mx-0.5 ${
                    i < stepIndex ? 'bg-purple-400 dark:bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === 'identity' && (
          <>
            {/* Avatar */}
            <div className="flex flex-col items-center pt-2 pb-2">
              <label className="relative w-24 h-24 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all group">
                {avatarPreview ? (
                  <>
                    <img src={avatarPreview} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={20} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera size={22} className="text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-medium">上传头像</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <Field label="角色名称" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="给角色取个名字" />
            </Field>

            <Field label="角色介绍" hint="对用户可见，不会发送给 AI">
              <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="简短描述这个角色..." rows={3} className="resize-none" />
            </Field>

            {/* Image Gallery */}
            <Field label="图库" hint="上传多张图片展示在详情页画廊中">
              <div className="grid grid-cols-4 gap-2">
                {/* Existing images (from server) */}
                {existingImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 group">
                    <img src={img.imageUrl} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDeleteExistingImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* Pending images (not yet uploaded) */}
                {pendingImages.map((img, i) => (
                  <div key={`pending-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 group ring-2 ring-purple-400/50">
                    <img src={img.preview} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePendingImage(i)}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-white text-[9px] text-center py-0.5">待上传</div>
                  </div>
                ))}

                {/* Add button */}
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/10">
                  <ImagePlus size={20} className="text-slate-300 dark:text-slate-600" />
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">添加</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryAdd} />
                </label>
              </div>
            </Field>
          </>
        )}

        {step === 'personality' && (
          <>
            <Field label="性格特征" hint="描述角色的性格、说话方式等">
              <Textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="例如：温柔体贴，说话慢条斯理，喜欢用比喻..." rows={5} className="resize-none" />
            </Field>

            <Field label="场景设定" hint="对话发生的背景和情境">
              <Textarea value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="例如：在一间安静的咖啡厅里，窗外下着小雨..." rows={5} className="resize-none" />
            </Field>
          </>
        )}

        {step === 'content' && (
          <>
            <Field label="系统指令" hint="指导 AI 扮演和表现角色的具体规则（System Prompt）">
              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="你是一个...请始终保持...不要..." rows={6} className="resize-none font-mono text-xs leading-relaxed" />
            </Field>

            <Field label="详细描述" hint="角色的背景故事、经历、能力特长等详细信息">
              <Textarea value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} placeholder="角色的完整背景故事、人生经历、独特能力..." rows={6} className="resize-none" />
            </Field>

            {/* Suggested replies */}
            <Field label="建议回复" hint="玩家开始新对话后可快速点击的预设选项，可添加多个">
              {suggestedReplies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {suggestedReplies.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                      "{r}"
                      <button onClick={() => setSuggestedReplies(suggestedReplies.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReply())}
                  placeholder="输入建议回复后按回车"
                  className="flex-1"
                />
                <button onClick={addReply} className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors shrink-0">添加</button>
              </div>
            </Field>

            {/* Opening dialogues */}
            <Field label="开场对话" hint="预设好的 AI 与用户对话，可提供多组供随机选择，帮助聊天开始更具指引性">
              <div className="space-y-3">
                {openingDialogues.map((group, gi) => (
                  <div key={gi} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">对话组 {gi + 1}</span>
                      <button onClick={() => removeDialogueGroup(gi)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {group.map((msg, mi) => (
                      <div key={mi} className="flex gap-2 items-start">
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-2 ${
                          msg.role === 'ai'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {msg.role === 'ai' ? 'AI' : '用户'}
                        </span>
                        <Textarea
                          value={msg.text}
                          onChange={(e) => updateMessage(gi, mi, e.target.value)}
                          placeholder={msg.role === 'ai' ? 'AI 说的话...' : '用户说的话...'}
                          rows={2}
                          className="flex-1 resize-none text-xs"
                        />
                        <button onClick={() => removeMessage(gi, mi)} className="shrink-0 p-1 mt-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-slate-300 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => addMessageToGroup(gi, 'ai')}
                        className="flex-1 py-1.5 text-[11px] font-medium text-purple-500 bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> AI 消息
                      </button>
                      <button
                        onClick={() => addMessageToGroup(gi, 'user')}
                        className="flex-1 py-1.5 text-[11px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> 用户消息
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addDialogueGroup}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-400 hover:text-purple-500 hover:border-purple-300 dark:hover:border-purple-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} /> 添加一组开场对话
                </button>
              </div>
            </Field>
          </>
        )}

        {step === 'advanced' && (
          <>
            {/* Tags */}
            <Field label="标签">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                      {tag}
                      <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="输入标签后按回车"
                  className="flex-1"
                />
                <button onClick={addTag} className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors shrink-0">添加</button>
              </div>
            </Field>

            <Field label="定价" hint="设为 0 则免费使用">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={priceCampusPoints}
                  onChange={(e) => setPriceCampusPoints(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-32"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">校园点</span>
              </div>
            </Field>
          </>
        )}

        {step === 'worldbook' && (
          <WorldBookEditor cardId={cardId ?? null} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0">
        {!isFirstStep && (
          <button
            onClick={() => setStep(STEPS[stepIndex - 1])}
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            上一步
          </button>
        )}
        {!isLastStep ? (
          <button
            onClick={() => setStep(STEPS[stepIndex + 1])}
            className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            下一步
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (uploadingImages ? '上传图片中...' : '保存中...') : '保存角色卡'}
          </button>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2 -mt-0.5">{hint}</p>}
    {children}
  </div>
);

// ==================== World Book Editor ====================

const WorldBookEditor: React.FC<{ cardId: number | null }> = ({ cardId }) => {
  const { data: entries, isLoading } = useWorldBook(cardId);
  const createEntry = useCreateWorldBookEntry();
  const updateEntry = useUpdateWorldBookEntry();
  const deleteEntry = useDeleteWorldBookEntry();
  const [editingEntry, setEditingEntry] = useState<WorldBookEntryData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (!cardId) {
    return (
      <div className="text-center py-12">
        <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-400 dark:text-slate-500">请先保存角色卡，然后再编辑世界书</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <BookOpen size={16} /> 世界书条目 ({entries?.length || 0})
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
        >
          <Plus size={12} /> 添加
        </button>
      </div>

      {(!entries || entries.length === 0) && (
        <div className="text-center py-8">
          <p className="text-xs text-slate-400 dark:text-slate-500">暂无条目，点击上方"添加"创建</p>
        </div>
      )}

      {entries?.map((entry) => (
        <div key={entry.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{entry.name}</span>
                {entry.isAlwaysActive && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">常驻</span>
                )}
                {!entry.isEnabled && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full">禁用</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{entry.content}</p>
              {entry.triggerKeywords && (
                <p className="text-[10px] text-purple-500 dark:text-purple-400 mt-1">
                  触发: {(() => { try { return JSON.parse(entry.triggerKeywords).join(', '); } catch { return entry.triggerKeywords; } })()}
                </p>
              )}
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button
                onClick={() => setEditingEntry(entry)}
                className="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              >
                编辑
              </button>
              <button
                onClick={() => { if (confirm('删除此条目？')) deleteEntry.mutate({ cardId, entryId: entry.id }); }}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {(showCreate || editingEntry) && (
        <WorldBookEntryForm
          cardId={cardId}
          entry={editingEntry ?? undefined}
          onClose={() => { setShowCreate(false); setEditingEntry(null); }}
          onCreate={(req) => createEntry.mutate({ cardId, request: req })}
          onUpdate={(entryId, req) => updateEntry.mutate({ cardId, entryId, request: req })}
        />
      )}
    </div>
  );
};

const WorldBookEntryForm: React.FC<{
  cardId: number;
  entry?: WorldBookEntryData;
  onClose: () => void;
  onCreate: (req: CreateWorldBookEntryRequest) => void;
  onUpdate: (entryId: number, req: any) => void;
}> = ({ entry, onClose, onCreate, onUpdate }) => {
  const [name, setName] = useState(entry?.name || '');
  const [content, setContent] = useState(entry?.content || '');
  const [isAlwaysActive, setIsAlwaysActive] = useState(entry?.isAlwaysActive ?? false);
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>(
    entry?.triggerKeywords ? (() => { try { return JSON.parse(entry.triggerKeywords!); } catch { return []; } })() : []
  );
  const [kwInput, setKwInput] = useState('');
  const [isEnabled, setIsEnabled] = useState(entry?.isEnabled ?? true);

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;
    const data = {
      name: name.trim(),
      content: content.trim(),
      isEnabled,
      isAlwaysActive,
      triggerKeywords: triggerKeywords.length > 0 ? JSON.stringify(triggerKeywords) : undefined,
    };
    if (entry) {
      onUpdate(entry.id, data);
    } else {
      onCreate(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl lg:rounded-2xl w-full lg:max-w-lg max-h-[80vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{entry ? '编辑条目' : '新建条目'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">名称</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="条目名称" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">内容</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="条目内容..." rows={4} className="resize-none" />
        </div>

        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={isAlwaysActive} onChange={(e) => setIsAlwaysActive(e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
            常驻激活
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
            启用
          </label>
        </div>

        {!isAlwaysActive && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">触发关键词</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {triggerKeywords.map((kw, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                  {kw}
                  <button onClick={() => setTriggerKeywords(triggerKeywords.filter((_, j) => j !== i))}><X size={10} /></button>
                </span>
              ))}
            </div>
            <Input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const k = kwInput.trim(); if (k) { setTriggerKeywords([...triggerKeywords, k]); setKwInput(''); } } }}
              placeholder="输入关键词后按回车"
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">取消</button>
          <button onClick={handleSave} disabled={!name.trim() || !content.trim()} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">保存</button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCardWizard;
