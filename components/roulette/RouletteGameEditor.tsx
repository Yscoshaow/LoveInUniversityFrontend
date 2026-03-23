import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Dice5,
  Save,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image,
  AlertCircle,
  Tag,
  X,
  Target,
  Coins,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import type {
  CreateRouletteGameRequest,
  SpecialRuleActionType,
  RouletteTaskType,
  ModifyActionType,
} from '../../types';

interface RouletteGameEditorProps {
  gameId: number | null; // null = create new
  onBack: () => void;
  onSaved: () => void;
}

interface EditorSection {
  key: string; // client-side key for React
  name: string;
  sortOrder: number;
  isStart: boolean;
  tasks: EditorTask[];
  isExpanded: boolean;
  diceRangeMin: number;
  diceRangeMax: number;
  isRoundDeterminer: boolean;
  countsAsRound: boolean;
  backgroundImageUrl: string | null;
}

interface EditorTask {
  key: string;
  diceMin: number;
  diceMax: number;
  title: string;
  description: string;
  imageRequired: boolean;
  successNextSectionIndex: number | null; // sortOrder-based
  failureNextSectionIndex: number | null;
  taskType: string;
  targetValue: number | null;
  targetUnit: string;
  roundTargetValue: number | null;
}

interface EditorSpecialRule {
  key: string;
  ruleType: string;
  conditionValue: number;
  actionType: string;
  // EXTRA_TASK fields
  taskTitle: string;
  taskDescription: string;
  imageRequired: boolean;
  taskType: string;
  targetValue: number | null;
  targetUnit: string;
  // JUMP_SECTION fields
  nextSectionIndex: number | null;
  // MODIFY_DICE_RESULT fields
  targetSectionIndices: number[];
  modifyAction: string;
}

let keyCounter = 0;
const genKey = () => `k_${++keyCounter}`;

export const RouletteGameEditor: React.FC<RouletteGameEditorProps> = ({
  gameId,
  onBack,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [specialRules, setSpecialRules] = useState<EditorSpecialRule[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [roundExitEnabled, setRoundExitEnabled] = useState(false);
  const [priceCampusPoints, setPriceCampusPoints] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpecialRules, setShowSpecialRules] = useState(false);

  const isEditing = gameId !== null;

  useEffect(() => {
    if (isEditing) {
      loadGame();
    } else {
      // Default: one start section with one task
      setSections([{
        key: genKey(),
        name: '关卡 1',
        sortOrder: 0,
        isStart: true,
        isExpanded: true,
        diceRangeMin: 1,
        diceRangeMax: 6,
        isRoundDeterminer: false,
        countsAsRound: false,
        backgroundImageUrl: null,
        tasks: [{
          key: genKey(),
          diceMin: 1,
          diceMax: 6,
          title: '',
          description: '',
          imageRequired: false,
          successNextSectionIndex: null,
          failureNextSectionIndex: null,
          taskType: 'MANUAL',
          targetValue: null,
          targetUnit: '',
          roundTargetValue: null,
        }],
      }]);
    }
  }, [gameId]);

  const loadGame = async () => {
    setIsLoading(true);
    try {
      const game = await rouletteApi.getGame(gameId!);
      setTitle(game.title);
      setDescription(game.description);
      setCoverImageUrl(game.coverImageUrl || '');
      setTags(game.tags || []);
      setRoundExitEnabled(game.roundExitEnabled ?? false);
      setPriceCampusPoints(game.priceCampusPoints ?? 0);
      setSections(
        game.sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(s => ({
            key: genKey(),
            name: s.name,
            sortOrder: s.sortOrder,
            isStart: s.isStart,
            isExpanded: false,
            diceRangeMin: s.diceRangeMin ?? 1,
            diceRangeMax: s.diceRangeMax ?? 6,
            isRoundDeterminer: s.isRoundDeterminer ?? false,
            countsAsRound: s.countsAsRound ?? false,
            backgroundImageUrl: s.backgroundImageUrl ?? null,
            tasks: s.tasks.map(t => ({
              key: genKey(),
              diceMin: t.diceMin,
              diceMax: t.diceMax,
              title: t.title,
              description: t.description || '',
              imageRequired: t.imageRequired,
              successNextSectionIndex: t.successNextSectionId
                ? game.sections.find(sec => sec.id === t.successNextSectionId)?.sortOrder ?? null
                : null,
              failureNextSectionIndex: t.failureNextSectionId
                ? game.sections.find(sec => sec.id === t.failureNextSectionId)?.sortOrder ?? null
                : null,
              taskType: t.taskType || 'MANUAL',
              targetValue: t.targetValue ?? null,
              targetUnit: t.targetUnit || '',
              roundTargetValue: t.roundTargetValue ?? null,
            })),
          }))
      );
      setSpecialRules(
        (game.specialRules || []).map(r => ({
          key: genKey(),
          ruleType: r.ruleType,
          conditionValue: r.conditionValue || 3,
          actionType: r.actionType || 'EXTRA_TASK',
          taskTitle: r.taskTitle || '',
          taskDescription: r.taskDescription || '',
          imageRequired: r.imageRequired,
          taskType: r.taskType || 'MANUAL',
          targetValue: r.targetValue ?? null,
          targetUnit: r.targetUnit || '',
          nextSectionIndex: r.nextSectionId
            ? game.sections.find(sec => sec.id === r.nextSectionId)?.sortOrder ?? null
            : null,
          targetSectionIndices: r.targetSectionIds
            ? r.targetSectionIds.map(sid =>
                game.sections.find(sec => sec.id === sid)?.sortOrder ?? -1
              ).filter(o => o >= 0)
            : [],
          modifyAction: r.modifyAction || 'SWAP_SUCCESS_FAILURE',
        }))
      );
      if (game.specialRules && game.specialRules.length > 0) {
        setShowSpecialRules(true);
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const buildRequest = (): CreateRouletteGameRequest => ({
    title: title.trim(),
    description: description.trim(),
    coverImageUrl: coverImageUrl.trim() || undefined,
    tags,
    roundExitEnabled,
    priceCampusPoints,
    gameType: 'GRAPH',
    sections: sections.map(s => ({
      name: s.name,
      sortOrder: s.sortOrder,
      isStart: s.isStart,
      diceRangeMin: s.diceRangeMin,
      diceRangeMax: s.diceRangeMax,
      isRoundDeterminer: s.isRoundDeterminer,
      countsAsRound: s.countsAsRound,
      backgroundImageUrl: s.backgroundImageUrl || undefined,
      tasks: s.tasks.map(t => ({
        diceMin: t.diceMin,
        diceMax: t.diceMax,
        title: t.title,
        description: t.description || undefined,
        imageRequired: t.imageRequired,
        successNextSectionIndex: t.successNextSectionIndex,
        failureNextSectionIndex: t.failureNextSectionIndex,
        taskType: t.taskType as RouletteTaskType,
        targetValue: t.taskType !== 'MANUAL' ? t.targetValue ?? undefined : undefined,
        targetUnit: t.taskType !== 'MANUAL' ? t.targetUnit || undefined : undefined,
        roundTargetValue: t.roundTargetValue,
      })),
    })),
    specialRules: specialRules.map(r => ({
      ruleType: r.ruleType,
      conditionValue: r.conditionValue,
      actionType: r.actionType as SpecialRuleActionType,
      taskTitle: r.actionType === 'EXTRA_TASK' ? r.taskTitle : undefined,
      taskDescription: r.actionType === 'EXTRA_TASK' ? (r.taskDescription || undefined) : undefined,
      imageRequired: r.actionType === 'EXTRA_TASK' ? r.imageRequired : false,
      taskType: (r.actionType === 'EXTRA_TASK' ? r.taskType : 'MANUAL') as RouletteTaskType,
      targetValue: r.actionType === 'EXTRA_TASK' && r.taskType !== 'MANUAL' ? r.targetValue ?? undefined : undefined,
      targetUnit: r.actionType === 'EXTRA_TASK' && r.taskType !== 'MANUAL' ? r.targetUnit || undefined : undefined,
      nextSectionIndex: r.actionType === 'JUMP_SECTION' || r.actionType === 'EXTRA_TASK' ? r.nextSectionIndex : null,
      targetSectionIndices: r.actionType === 'MODIFY_DICE_RESULT' ? r.targetSectionIndices : undefined,
      modifyAction: r.actionType === 'MODIFY_DICE_RESULT' ? r.modifyAction as ModifyActionType : undefined,
    })),
  });

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const request = buildRequest();
      if (isEditing) {
        await rouletteApi.updateGame(gameId!, request);
      } else {
        await rouletteApi.createGame(request);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const request = buildRequest();
      let savedGameId = gameId;
      if (isEditing) {
        await rouletteApi.updateGame(gameId!, request);
      } else {
        const created = await rouletteApi.createGame(request);
        savedGameId = created.id;
      }
      // Publish
      setIsPublishing(true);
      await rouletteApi.publishGame(savedGameId!);
      onSaved();
    } catch (e: any) {
      setError(e.message || '发布失败');
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  // Section operations
  const addSection = () => {
    const newOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sortOrder)) + 1 : 0;
    setSections([...sections, {
      key: genKey(),
      name: `关卡 ${sections.length + 1}`,
      sortOrder: newOrder,
      isStart: sections.length === 0,
      isExpanded: true,
      diceRangeMin: 1,
      diceRangeMax: 6,
      isRoundDeterminer: false,
      countsAsRound: false,
      backgroundImageUrl: null,
      tasks: [{
        key: genKey(),
        diceMin: 1,
        diceMax: 6,
        title: '',
        description: '',
        imageRequired: false,
        successNextSectionIndex: null,
        failureNextSectionIndex: null,
        taskType: 'MANUAL',
        targetValue: null,
        targetUnit: '',
        roundTargetValue: null,
      }],
    }]);
  };

  const removeSection = (sectionKey: string) => {
    const updated = sections.filter(s => s.key !== sectionKey);
    // If removed section was start, set first remaining as start
    if (updated.length > 0 && !updated.some(s => s.isStart)) {
      updated[0].isStart = true;
    }
    setSections(updated);
  };

  const updateSection = (key: string, updates: Partial<EditorSection>) => {
    setSections(sections.map(s => {
      if (s.key !== key) {
        // If setting isStart, unset others
        if (updates.isStart) return { ...s, isStart: false };
        return s;
      }
      return { ...s, ...updates };
    }));
  };

  const toggleSectionExpand = (key: string) => {
    setSections(sections.map(s =>
      s.key === key ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  // Task operations
  const addTask = (sectionKey: string) => {
    setSections(sections.map(s => {
      if (s.key !== sectionKey) return s;
      return {
        ...s,
        tasks: [...s.tasks, {
          key: genKey(),
          diceMin: s.diceRangeMin,
          diceMax: s.diceRangeMin,
          title: '',
          description: '',
          imageRequired: false,
          successNextSectionIndex: null,
          failureNextSectionIndex: null,
          taskType: 'MANUAL',
          targetValue: null,
          targetUnit: '',
          roundTargetValue: null,
        }],
      };
    }));
  };

  const removeTask = (sectionKey: string, taskKey: string) => {
    setSections(sections.map(s => {
      if (s.key !== sectionKey) return s;
      return { ...s, tasks: s.tasks.filter(t => t.key !== taskKey) };
    }));
  };

  const updateTask = (sectionKey: string, taskKey: string, updates: Partial<EditorTask>) => {
    setSections(sections.map(s => {
      if (s.key !== sectionKey) return s;
      return {
        ...s,
        tasks: s.tasks.map(t => t.key === taskKey ? { ...t, ...updates } : t),
      };
    }));
  };

  // Special rule operations
  const addSpecialRule = () => {
    setSpecialRules([...specialRules, {
      key: genKey(),
      ruleType: 'SAME_ROLL',
      conditionValue: 3,
      actionType: 'EXTRA_TASK',
      taskTitle: '',
      taskDescription: '',
      imageRequired: false,
      taskType: 'MANUAL',
      targetValue: null,
      targetUnit: '',
      nextSectionIndex: null,
      targetSectionIndices: [],
      modifyAction: 'SWAP_SUCCESS_FAILURE',
    }]);
    setShowSpecialRules(true);
  };

  const removeSpecialRule = (key: string) => {
    setSpecialRules(specialRules.filter(r => r.key !== key));
  };

  const updateSpecialRule = (key: string, updates: Partial<EditorSpecialRule>) => {
    setSpecialRules(specialRules.map(r => r.key === key ? { ...r, ...updates } : r));
  };

  // Cover image upload
  const handleCoverUpload = async (file: File) => {
    try {
      const result = await rouletteApi.uploadImage(file);
      setCoverImageUrl(result.imageUrl);
    } catch (e: any) {
      setError(e.message || '上传失败');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={32} />
      </div>
    );
  }

  const sectionOptions = sections.map(s => ({
    sortOrder: s.sortOrder,
    label: s.name || `关卡 ${s.sortOrder + 1}`,
  }));

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <button onClick={onBack} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="flex-1 font-semibold text-slate-800 dark:text-slate-100">
          {isEditing ? '编辑游戏' : '创建游戏'}
        </h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50"
        >
          {isSaving && !isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        </button>
        <button
          onClick={handlePublish}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          发布
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950 rounded-xl p-3 text-sm text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">游戏标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入游戏标题..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">游戏描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述你的游戏..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors resize-none"
              maxLength={500}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">封面图片</label>
            <div className="flex items-center gap-3">
              {coverImageUrl ? (
                <div className="relative">
                  <img src={coverImageUrl} alt="Cover" className="w-20 h-20 rounded-xl object-cover" />
                  <button
                    onClick={() => setCoverImageUrl('')}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-teal-400 transition-colors">
                  <Image size={24} className="text-slate-300" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              <Tag size={12} className="inline mr-1" />
              标签
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 dark:bg-teal-950 text-teal-700 rounded-full text-xs"
                >
                  {tag}
                  <button
                    onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                    className="text-teal-400 hover:text-teal-600 dark:text-teal-400"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim();
                    if (!tags.includes(t) && tags.length < 5) {
                      setTags([...tags, t]);
                    }
                    setTagInput('');
                  }
                }}
                placeholder="输入标签后回车添加（最多5个）"
                className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-teal-400"
                maxLength={20}
              />
              <button
                onClick={() => {
                  const t = tagInput.trim();
                  if (t && !tags.includes(t) && tags.length < 5) {
                    setTags([...tags, t]);
                  }
                  setTagInput('');
                }}
                disabled={!tagInput.trim() || tags.length >= 5}
                className="px-2.5 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">收费设置</span>
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

        {/* Round Exit Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-violet-500 dark:text-violet-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">轮次退出条件</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const newVal = !roundExitEnabled;
                setRoundExitEnabled(newVal);
                if (!newVal) {
                  // 关闭时清除所有section的轮次标记
                  setSections(sections.map(s => ({ ...s, isRoundDeterminer: false, countsAsRound: false })));
                }
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                roundExitEnabled ? 'bg-violet-500' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${
                roundExitEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          {roundExitEnabled && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              启用后，需指定一个"轮次决定器"关卡（骰子值 = 目标轮次数）和至少一个"计入轮次"关卡。达到轮次后游戏自动结束。
            </p>
          )}
        </div>

        {/* Sections */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Dice5 size={16} className="text-teal-500 dark:text-teal-400" />
              关卡 ({sections.length})
            </h2>
            <button
              onClick={addSection}
              className="flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2.5 py-1.5 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Plus size={14} /> 添加关卡
            </button>
          </div>

          <div className="space-y-3">
            {sections.map((section, sIdx) => (
              <SectionEditor
                key={section.key}
                section={section}
                sectionIndex={sIdx}
                sectionOptions={sectionOptions}
                onUpdate={(updates) => updateSection(section.key, updates)}
                onToggleExpand={() => toggleSectionExpand(section.key)}
                onRemove={() => removeSection(section.key)}
                onAddTask={() => addTask(section.key)}
                onRemoveTask={(taskKey) => removeTask(section.key, taskKey)}
                onUpdateTask={(taskKey, updates) => updateTask(section.key, taskKey, updates)}
                canRemove={sections.length > 1}
                roundExitEnabled={roundExitEnabled}
              />
            ))}
          </div>
        </div>

        {/* Special Rules */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowSpecialRules(!showSpecialRules)}
              className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
            >
              <Dice5 size={16} className="text-amber-500 dark:text-amber-400" />
              特殊规则 ({specialRules.length})
              {showSpecialRules ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={addSpecialRule}
              className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
            >
              <Plus size={14} /> 添加规则
            </button>
          </div>

          {showSpecialRules && (
            <div className="space-y-3">
              {specialRules.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-50 dark:border-slate-700 text-center text-sm text-slate-400 dark:text-slate-500">
                  暂无特殊规则。特殊规则会在满足条件时覆盖普通骰子任务。
                </div>
              ) : (
                specialRules.map(rule => (
                  <SpecialRuleEditor
                    key={rule.key}
                    rule={rule}
                    sectionOptions={sectionOptions}
                    onUpdate={(updates) => updateSpecialRule(rule.key, updates)}
                    onRemove={() => removeSpecialRule(rule.key)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Spacer for bottom */}
        <div className="h-4" />
      </div>
    </div>
  );
};

// ==================== Section Editor ====================

interface SectionEditorProps {
  section: EditorSection;
  sectionIndex: number;
  sectionOptions: { sortOrder: number; label: string }[];
  onUpdate: (updates: Partial<EditorSection>) => void;
  onToggleExpand: () => void;
  onRemove: () => void;
  onAddTask: () => void;
  onRemoveTask: (taskKey: string) => void;
  onUpdateTask: (taskKey: string, updates: Partial<EditorTask>) => void;
  canRemove: boolean;
  roundExitEnabled: boolean;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section, sectionIndex, sectionOptions, onUpdate, onToggleExpand, onRemove,
  onAddTask, onRemoveTask, onUpdateTask, canRemove, roundExitEnabled,
}) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border ${section.isStart ? 'border-teal-200' : 'border-slate-50 dark:border-slate-700'} overflow-hidden`}>
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
          section.isStart ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>
          {sectionIndex + 1}
        </div>
        <input
          type="text"
          value={section.name}
          onChange={e => onUpdate({ name: e.target.value })}
          onClick={e => e.stopPropagation()}
          placeholder="关卡名称"
          className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none focus:bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg transition-colors"
        />
        <div className="flex items-center gap-1">
          {!section.isStart && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate({ isStart: true }); }}
              className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-full hover:bg-teal-100"
            >
              设为起始
            </button>
          )}
          {section.isStart && (
            <span className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-100 px-2 py-0.5 rounded-full">起始</span>
          )}
          {canRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          {section.isExpanded ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />}
        </div>
      </div>

      {/* Tasks */}
      {section.isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 dark:border-slate-700 pt-3">
          {/* Dice range config */}
          <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-100 dark:border-amber-900 space-y-2">
            <div className="flex items-center gap-1.5">
              <Dice5 size={14} className="text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">骰子范围</span>
              <span className="text-[10px] text-amber-500 dark:text-amber-400 ml-auto">
                {section.diceRangeMin} ~ {section.diceRangeMax}（{section.diceRangeMax - section.diceRangeMin + 1} 个值）
              </span>
            </div>
            <div className="flex gap-1">
              {[0,1,2,3,4,5,6,7,8,9].map(n => {
                const inRange = n >= section.diceRangeMin && n <= section.diceRangeMax;
                const isMin = n === section.diceRangeMin;
                const isMax = n === section.diceRangeMax;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      if (inRange) {
                        if (section.diceRangeMin === section.diceRangeMax) {
                          // Already single value - clicking does nothing, click outside to expand
                          return;
                        }
                        // Clicking min edge: collapse to single value at min
                        if (n === section.diceRangeMin) {
                          onUpdate({ diceRangeMax: n });
                          return;
                        }
                        // Clicking max edge: collapse to single value at max
                        if (n === section.diceRangeMax) {
                          onUpdate({ diceRangeMin: n });
                          return;
                        }
                        // Clicking middle: shrink toward clicked number
                        const mid = (section.diceRangeMin + section.diceRangeMax) / 2;
                        if (n <= mid) {
                          onUpdate({ diceRangeMin: n });
                        } else {
                          onUpdate({ diceRangeMax: n });
                        }
                      } else {
                        // Clicking outside range: expand to include clicked number
                        if (n < section.diceRangeMin) {
                          onUpdate({ diceRangeMin: n });
                        } else {
                          onUpdate({ diceRangeMax: n });
                        }
                      }
                    }}
                    className={`flex-1 h-7 rounded-lg text-xs font-bold transition-all ${
                      inRange
                        ? isMin || isMax
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-amber-400 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-500 dark:text-amber-400'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Round exit section flags */}
          {roundExitEnabled && (
            <div className="px-3 py-2.5 bg-violet-50 dark:bg-violet-950 rounded-xl border border-violet-100 space-y-2">
              <div className="flex items-center gap-1.5">
                <Target size={14} className="text-violet-500 dark:text-violet-400" />
                <span className="text-xs font-medium text-violet-700 dark:text-violet-400">轮次设定</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ isRoundDeterminer: !section.isRoundDeterminer, countsAsRound: false })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    section.isRoundDeterminer
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-violet-400 border border-violet-200 hover:border-violet-400'
                  }`}
                >
                  轮次决定器
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ countsAsRound: !section.countsAsRound, isRoundDeterminer: false })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    section.countsAsRound
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-violet-400 border border-violet-200 hover:border-violet-400'
                  }`}
                >
                  计入轮次
                </button>
              </div>
              {section.isRoundDeterminer && (
                <p className="text-[10px] text-violet-500 dark:text-violet-400">此关卡的骰子值将决定需要完成的轮次数，且只能掷一次</p>
              )}
              {section.countsAsRound && (
                <p className="text-[10px] text-violet-500 dark:text-violet-400">完成此关卡的任务时，轮次+1</p>
              )}
            </div>
          )}

          {/* Background image */}
          <div className="px-3 py-2.5 bg-sky-50 rounded-xl border border-sky-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Image size={14} className="text-sky-500" />
              <span className="text-xs font-medium text-sky-700">关卡背景图</span>
              <span className="text-[10px] text-sky-400 ml-auto">进入此关卡时显示的背景</span>
            </div>
            {section.backgroundImageUrl ? (
              <div className="flex items-center gap-2">
                <img src={section.backgroundImageUrl} alt="" className="w-16 h-10 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => onUpdate({ backgroundImageUrl: null })}
                  className="text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:text-rose-400"
                >
                  移除
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-1 py-2 border border-dashed border-sky-200 rounded-lg text-xs text-sky-500 cursor-pointer hover:border-sky-400 hover:text-sky-600 transition-colors">
                <Plus size={12} /> 上传背景图
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await rouletteApi.uploadImage(file);
                      onUpdate({ backgroundImageUrl: result.imageUrl });
                    } catch {}
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {section.tasks.map((task, tIdx) => (
            <TaskEditor
              key={task.key}
              task={task}
              taskIndex={tIdx}
              sectionOptions={sectionOptions}
              currentSectionOrder={section.sortOrder}
              diceRangeMin={section.diceRangeMin}
              diceRangeMax={section.diceRangeMax}
              onUpdate={(updates) => onUpdateTask(task.key, updates)}
              onRemove={() => onRemoveTask(task.key)}
              canRemove={section.tasks.length > 1}
              isRoundDeterminer={section.isRoundDeterminer}
            />
          ))}
          <button
            onClick={onAddTask}
            className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 dark:text-slate-500 hover:border-teal-400 hover:text-teal-500 dark:text-teal-400 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={14} /> 添加任务
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== Task Editor ====================

interface TaskEditorProps {
  task: EditorTask;
  taskIndex: number;
  sectionOptions: { sortOrder: number; label: string }[];
  currentSectionOrder: number;
  diceRangeMin: number;
  diceRangeMax: number;
  onUpdate: (updates: Partial<EditorTask>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isRoundDeterminer: boolean;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  MANUAL: '手动完成',
  COUNT: '计数任务',
  DURATION: '计时任务',
  LOCK: '锁任务',
};

const TASK_UNIT_OPTIONS: Record<string, string[]> = {
  COUNT: ['次', '个', '组', '下', '圈'],
  DURATION: ['分钟', '小时', '秒'],
  LOCK: ['分钟', '小时'],
};

const TaskEditor: React.FC<TaskEditorProps> = ({
  task, taskIndex, sectionOptions, currentSectionOrder, diceRangeMin, diceRangeMax, onUpdate, onRemove, canRemove, isRoundDeterminer,
}) => {
  const diceOptions = Array.from({ length: diceRangeMax - diceRangeMin + 1 }, (_, i) => diceRangeMin + i);
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">任务 {taskIndex + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 transition-colors">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Title */}
      <input
        type="text"
        value={task.title}
        onChange={e => onUpdate({ title: e.target.value })}
        placeholder="任务标题"
        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-teal-400"
      />

      {/* Dice range */}
      <div className="space-y-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">骰子：{task.diceMin} ~ {task.diceMax}</span>
        <div className="flex gap-1">
          {diceOptions.map(n => {
            const inRange = n >= task.diceMin && n <= task.diceMax;
            const isEdge = n === task.diceMin || n === task.diceMax;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (inRange) {
                    if (task.diceMin === task.diceMax) {
                      // Already single value - clicking does nothing, click outside to expand
                      return;
                    }
                    // Clicking min edge: collapse to single value at min
                    if (n === task.diceMin) {
                      onUpdate({ diceMax: n });
                      return;
                    }
                    // Clicking max edge: collapse to single value at max
                    if (n === task.diceMax) {
                      onUpdate({ diceMin: n });
                      return;
                    }
                    // Clicking middle: shrink toward clicked number
                    const mid = (task.diceMin + task.diceMax) / 2;
                    if (n <= mid) {
                      onUpdate({ diceMin: n });
                    } else {
                      onUpdate({ diceMax: n });
                    }
                  } else {
                    // Clicking outside range: expand to include clicked number
                    if (n < task.diceMin) {
                      onUpdate({ diceMin: n });
                    } else {
                      onUpdate({ diceMax: n });
                    }
                  }
                }}
                className={`flex-1 h-6 rounded-md text-[10px] font-bold transition-all ${
                  inRange
                    ? isEdge
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-teal-400 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-teal-300 hover:text-teal-500 dark:text-teal-400'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task type */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">类型：</span>
        <select
          value={task.taskType}
          onChange={e => {
            const newType = e.target.value;
            onUpdate({
              taskType: newType,
              targetUnit: newType !== 'MANUAL' ? (TASK_UNIT_OPTIONS[newType]?.[0] || '') : '',
            });
          }}
          className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-teal-400"
        >
          {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Target value & unit (shown for non-MANUAL types) */}
      {task.taskType !== 'MANUAL' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">目标：</span>
          <input
            type="number"
            value={task.targetValue ?? ''}
            onChange={e => onUpdate({ targetValue: e.target.value ? Number(e.target.value) : null })}
            placeholder="数值"
            className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-teal-400"
            min={0}
            step="any"
          />
          <select
            value={task.targetUnit || (TASK_UNIT_OPTIONS[task.taskType]?.[0] || '')}
            onChange={e => onUpdate({ targetUnit: e.target.value })}
            className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-teal-400"
          >
            {(TASK_UNIT_OPTIONS[task.taskType] || []).map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
      )}

      {/* Round target value (shown for tasks in round determiner sections) */}
      {isRoundDeterminer && (
        <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950 rounded-lg px-2.5 py-1.5 border border-violet-100">
          <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">设定轮次：</span>
          <input
            type="number"
            value={task.roundTargetValue ?? ''}
            onChange={e => onUpdate({ roundTargetValue: e.target.value ? Number(e.target.value) : null })}
            placeholder="掷中此任务时设定的轮次数"
            className="flex-1 px-2 py-1 border border-violet-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 bg-white dark:bg-slate-800"
            min={1}
          />
          <span className="text-[10px] text-violet-400">留空则使用骰子值</span>
        </div>
      )}

      {/* Description */}
      <textarea
        value={task.description}
        onChange={e => onUpdate({ description: e.target.value })}
        placeholder="任务描述（可选）"
        rows={2}
        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-teal-400 resize-none"
      />

      {/* Next sections */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 block">成功跳转</label>
          <select
            value={task.successNextSectionIndex ?? 'END'}
            onChange={e => onUpdate({
              successNextSectionIndex: e.target.value === 'END' ? null : Number(e.target.value)
            })}
            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-teal-400"
          >
            <option value="END">游戏结束</option>
            {sectionOptions.map(opt => (
              <option key={opt.sortOrder} value={opt.sortOrder}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 block">失败跳转</label>
          <select
            value={task.failureNextSectionIndex ?? 'END'}
            onChange={e => onUpdate({
              failureNextSectionIndex: e.target.value === 'END' ? null : Number(e.target.value)
            })}
            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-teal-400"
          >
            <option value="END">游戏结束</option>
            {sectionOptions.map(opt => (
              <option key={opt.sortOrder} value={opt.sortOrder}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Image required toggle */}
      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={task.imageRequired}
          onChange={e => onUpdate({ imageRequired: e.target.checked })}
          className="rounded border-slate-300 dark:border-slate-600 text-teal-500 dark:text-teal-400 focus:ring-teal-500"
        />
        需要图片证明
      </label>
    </div>
  );
};

// ==================== Special Rule Editor ====================

interface SpecialRuleEditorProps {
  rule: EditorSpecialRule;
  sectionOptions: { sortOrder: number; label: string }[];
  onUpdate: (updates: Partial<EditorSpecialRule>) => void;
  onRemove: () => void;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  EXTRA_TASK: '额外任务',
  JUMP_SECTION: '跳转关卡',
  MODIFY_DICE_RESULT: '修改骰子结果',
};

const MODIFY_ACTION_LABELS: Record<string, string> = {
  SWAP_SUCCESS_FAILURE: '成功/失败互换',
  FORCE_SUCCESS: '强制成功',
  FORCE_FAILURE: '强制失败',
};

const SpecialRuleEditor: React.FC<SpecialRuleEditorProps> = ({
  rule, sectionOptions, onUpdate, onRemove,
}) => {
  const toggleTargetSection = (sortOrder: number) => {
    const current = rule.targetSectionIndices || [];
    if (current.includes(sortOrder)) {
      onUpdate({ targetSectionIndices: current.filter(s => s !== sortOrder) });
    } else {
      onUpdate({ targetSectionIndices: [...current, sortOrder] });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-amber-100 dark:border-amber-900 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
          连续相同点数规则
        </span>
        <button onClick={onRemove} className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:text-rose-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Condition */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">连续次数：</span>
        <select
          value={rule.conditionValue}
          onChange={e => onUpdate({ conditionValue: Number(e.target.value) })}
          className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
        >
          {[2,3,4,5].map(n => <option key={n} value={n}>{n} 次</option>)}
        </select>
      </div>

      {/* Action type */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">触发效果：</span>
        <select
          value={rule.actionType}
          onChange={e => onUpdate({ actionType: e.target.value })}
          className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
        >
          {Object.entries(ACTION_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* EXTRA_TASK fields */}
      {rule.actionType === 'EXTRA_TASK' && (
        <>
          <input
            type="text"
            value={rule.taskTitle}
            onChange={e => onUpdate({ taskTitle: e.target.value })}
            placeholder="特殊任务标题"
            className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
          />

          <textarea
            value={rule.taskDescription}
            onChange={e => onUpdate({ taskDescription: e.target.value })}
            placeholder="特殊任务描述（可选）"
            rows={2}
            className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-amber-400 resize-none"
          />

          {/* Task type for extra task */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">任务类型：</span>
            <select
              value={rule.taskType}
              onChange={e => onUpdate({ taskType: e.target.value })}
              className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
            >
              {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {rule.taskType !== 'MANUAL' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">目标：</span>
              <input
                type="number"
                value={rule.targetValue ?? ''}
                onChange={e => onUpdate({ targetValue: e.target.value ? Number(e.target.value) : null })}
                placeholder="数值"
                className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                min={0}
                step="any"
              />
              <select
                value={rule.targetUnit || (TASK_UNIT_OPTIONS[rule.taskType]?.[0] || '')}
                onChange={e => onUpdate({ targetUnit: e.target.value })}
                className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-400"
              >
                {(TASK_UNIT_OPTIONS[rule.taskType] || []).map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 block">完成后跳转</label>
            <select
              value={rule.nextSectionIndex ?? 'END'}
              onChange={e => onUpdate({
                nextSectionIndex: e.target.value === 'END' ? null : Number(e.target.value)
              })}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="END">游戏结束</option>
              {sectionOptions.map(opt => (
                <option key={opt.sortOrder} value={opt.sortOrder}>{opt.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.imageRequired}
              onChange={e => onUpdate({ imageRequired: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600 text-amber-500 dark:text-amber-400 focus:ring-amber-500"
            />
            需要图片证明
          </label>
        </>
      )}

      {/* JUMP_SECTION fields */}
      {rule.actionType === 'JUMP_SECTION' && (
        <div>
          <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 block">跳转到关卡</label>
          <select
            value={rule.nextSectionIndex ?? 'END'}
            onChange={e => onUpdate({
              nextSectionIndex: e.target.value === 'END' ? null : Number(e.target.value)
            })}
            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="END">游戏结束</option>
            {sectionOptions.map(opt => (
              <option key={opt.sortOrder} value={opt.sortOrder}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* MODIFY_DICE_RESULT fields */}
      {rule.actionType === 'MODIFY_DICE_RESULT' && (
        <>
          <div>
            <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 block">修改方式</label>
            <select
              value={rule.modifyAction}
              onChange={e => onUpdate({ modifyAction: e.target.value })}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-amber-400"
            >
              {Object.entries(MODIFY_ACTION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 block">影响的关卡（可多选）</label>
            <div className="flex flex-wrap gap-1.5">
              {sectionOptions.map(opt => {
                const selected = (rule.targetSectionIndices || []).includes(opt.sortOrder);
                return (
                  <button
                    key={opt.sortOrder}
                    onClick={() => toggleTargetSection(opt.sortOrder)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                      selected
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RouletteGameEditor;
