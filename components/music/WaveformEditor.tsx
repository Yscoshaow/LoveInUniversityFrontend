import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  Eye,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import {
  useMyWaveforms,
  useSaveWaveform,
  useDeleteWaveform,
  usePreviewWaveform,
} from '../../hooks/useWaveforms';
import type { WaveformSection, CustomWaveform } from '../../types';
import { useConfirm } from '@/hooks/useConfirm';

interface WaveformEditorProps {
  onBack: () => void;
  onSelectWaveform?: (waveform: CustomWaveform) => void;
}

// Default section configuration
const createDefaultSection = (): WaveformSection => ({
  enabled: true,
  frequencyMode: 'fixed',
  frequencyMin: 10,
  frequencyMax: 100,
  intensityBars: [50, 50, 50, 50, 50, 50, 50, 50],
  durationMs: 100,
  restDurationMs: 0,
});

let sectionKeyCounter = 0;
const genSectionKey = () => `section_${++sectionKeyCounter}`;

interface EditorSection extends WaveformSection {
  key: string;
  isExpanded: boolean;
}

export const WaveformEditor: React.FC<WaveformEditorProps> = ({
  onBack,
  onSelectWaveform,
}) => {
  const confirm = useConfirm();

  // List view state
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingWaveformId, setEditingWaveformId] = useState<number | null>(null);

  // Editor state
  const [name, setName] = useState('');
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<{ frameCount: number; durationMs: number } | null>(null);

  // Query hooks
  const { data: waveformsData, isLoading: isLoadingList } = useMyWaveforms();
  const saveWaveform = useSaveWaveform();
  const deleteWaveform = useDeleteWaveform();
  const previewWaveform = usePreviewWaveform();

  // Initialize editor for new waveform
  const startNewWaveform = useCallback(() => {
    setEditingWaveformId(null);
    setName('');
    setSections([
      { ...createDefaultSection(), key: genSectionKey(), isExpanded: true },
    ]);
    setIsPublic(false);
    setPreviewData(null);
    setView('edit');
  }, []);

  // Load waveform for editing
  const loadWaveformForEdit = useCallback((waveform: CustomWaveform) => {
    setEditingWaveformId(waveform.id);
    setName(waveform.name);
    setSections(
      waveform.sections.map((s, i) => ({
        ...s,
        key: genSectionKey(),
        isExpanded: i === 0,
      }))
    );
    setIsPublic(waveform.isPublic);
    setPreviewData(null);
    setView('edit');
  }, []);

  // Add new section
  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { ...createDefaultSection(), key: genSectionKey(), isExpanded: true },
    ]);
  }, []);

  // Remove section
  const removeSection = useCallback((key: string) => {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }, []);

  // Update section
  const updateSection = useCallback((key: string, updates: Partial<EditorSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    );
  }, []);

  // Toggle section expanded
  const toggleSectionExpanded = useCallback((key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  }, []);

  // Update intensity bar
  const updateIntensityBar = useCallback((sectionKey: string, barIndex: number, value: number) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        const newBars = [...s.intensityBars];
        newBars[barIndex] = Math.max(0, Math.min(100, value));
        return { ...s, intensityBars: newBars };
      })
    );
  }, []);

  // Duplicate section
  const duplicateSection = useCallback((key: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copy: EditorSection = {
        ...original,
        key: genSectionKey(),
        isExpanded: false,
      };
      const result = [...prev];
      result.splice(idx + 1, 0, copy);
      return result;
    });
  }, []);

  // Preview waveform
  const handlePreview = useCallback(async () => {
    const sectionsData: WaveformSection[] = sections.map((s) => ({
      enabled: s.enabled,
      frequencyMode: s.frequencyMode,
      frequencyMin: s.frequencyMin,
      frequencyMax: s.frequencyMax,
      intensityBars: s.intensityBars,
      durationMs: s.durationMs,
      restDurationMs: s.restDurationMs,
    }));

    try {
      const result = await previewWaveform.mutateAsync({ sections: sectionsData });
      setPreviewData({ frameCount: result.frameCount, durationMs: result.durationMs });
    } catch (err) {
      console.error('Preview failed:', err);
    }
  }, [sections, previewWaveform]);

  // Save waveform
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.warning('请输入波形名称');
      return;
    }

    if (sections.length === 0) {
      toast.warning('请至少添加一个小节');
      return;
    }

    const sectionsData: WaveformSection[] = sections.map((s) => ({
      enabled: s.enabled,
      frequencyMode: s.frequencyMode,
      frequencyMin: s.frequencyMin,
      frequencyMax: s.frequencyMax,
      intensityBars: s.intensityBars,
      durationMs: s.durationMs,
      restDurationMs: s.restDurationMs,
    }));

    try {
      await saveWaveform.mutateAsync({
        id: editingWaveformId || undefined,
        name: name.trim(),
        sections: sectionsData,
        isPublic,
      });
      setView('list');
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('保存失败');
    }
  }, [name, sections, isPublic, editingWaveformId, saveWaveform]);

  // Delete waveform
  const handleDelete = useCallback(async (id: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个波形吗？', destructive: true }))) return;
    try {
      await deleteWaveform.mutateAsync(id);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('删除失败');
    }
  }, [deleteWaveform]);

  // Render list view
  const renderListView = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <div className="shrink-0 z-10 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-700/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-zinc-700/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">自定义波形</h1>
              <p className="text-xs text-zinc-500">管理你的波形</p>
            </div>
          </div>
          <button
            onClick={startNewWaveform}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : waveformsData?.waveforms.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">还没有自定义波形</p>
            <p className="text-zinc-500 text-sm mt-1">点击右上角新建一个</p>
          </div>
        ) : (
          waveformsData?.waveforms.map((waveform) => (
            <div
              key={waveform.id}
              className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{waveform.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">
                      {waveform.sections.length} 小节
                    </span>
                    {waveform.isPublic && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                        公开
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onSelectWaveform && (
                    <button
                      onClick={() => onSelectWaveform(waveform)}
                      className="p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 transition-colors"
                      title="使用此波形"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => loadWaveformForEdit(waveform)}
                    className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 transition-colors"
                    title="编辑"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(waveform.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Intensity preview bars */}
              <div className="mt-3 flex items-end gap-0.5 h-8">
                {waveform.sections.slice(0, 1).map((section, si) =>
                  section.intensityBars.map((bar, bi) => (
                    <div
                      key={`${si}-${bi}`}
                      className="flex-1 bg-purple-500/30 rounded-sm"
                      style={{ height: `${bar}%` }}
                    />
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render section editor
  const renderSectionEditor = (section: EditorSection, index: number) => (
    <div
      key={section.key}
      className={`bg-zinc-800/50 rounded-xl border transition-colors ${
        section.enabled ? 'border-zinc-700/50' : 'border-zinc-800 opacity-60'
      }`}
    >
      {/* Section header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => toggleSectionExpanded(section.key)}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateSection(section.key, { enabled: !section.enabled });
            }}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {section.enabled ? (
              <ToggleRight className="w-5 h-5 text-purple-400" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>
          <span className="text-white font-medium">小节 {index + 1}</span>
          <span className="text-xs text-zinc-500">
            {section.durationMs}ms + {section.restDurationMs}ms 休息
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateSection(section.key);
            }}
            className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="复制"
          >
            <Copy className="w-4 h-4" />
          </button>
          {sections.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSection(section.key);
              }}
              className="p-1.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {section.isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Section content */}
      {section.isExpanded && (
        <div className="px-3 pb-3 space-y-4">
          {/* Frequency mode */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">脉冲频率</label>
            <div className="flex gap-2">
              {(['fixed', 'random', 'sweep'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateSection(section.key, { frequencyMode: mode })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    section.frequencyMode === mode
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {mode === 'fixed' ? '固定' : mode === 'random' ? '随机' : '渐变'}
                </button>
              ))}
            </div>

            {/* Frequency range */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  {section.frequencyMode === 'fixed' ? '频率' : '最小'}
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={section.frequencyMin}
                  onChange={(e) =>
                    updateSection(section.key, { frequencyMin: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              {section.frequencyMode !== 'fixed' && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">最大</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={section.frequencyMax}
                    onChange={(e) =>
                      updateSection(section.key, { frequencyMax: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Intensity bars */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">强度曲线</label>
            <div className="flex items-end gap-1 h-32 p-3 bg-zinc-900/50 rounded-lg">
              {section.intensityBars.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="flex-1 w-full relative">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bar}
                      onChange={(e) =>
                        updateIntensityBar(section.key, i, Number(e.target.value))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ writingMode: 'vertical-lr' as any, direction: 'rtl' }}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-600 to-purple-400 rounded-sm transition-all"
                      style={{ height: `${bar}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500">{bar}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-600">起始</span>
              <span className="text-[10px] text-zinc-600">结束</span>
            </div>
          </div>

          {/* Duration settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">小节时长 (ms)</label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={section.durationMs}
                onChange={(e) =>
                  updateSection(section.key, { durationMs: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">休息时长 (ms)</label>
              <input
                type="number"
                min={0}
                max={10000}
                step={100}
                value={section.restDurationMs}
                onChange={(e) =>
                  updateSection(section.key, { restDurationMs: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render edit view
  const renderEditView = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <div className="shrink-0 z-10 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-700/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-lg hover:bg-zinc-700/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">
                {editingWaveformId ? '编辑波形' : '新建波形'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={previewWaveform.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {previewWaveform.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              预览
            </button>
            <button
              onClick={handleSave}
              disabled={saveWaveform.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saveWaveform.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Name input */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">波形名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入波形名称"
            className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500"
          />
        </div>

        {/* Public toggle */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg">
          <span className="text-sm text-zinc-300">公开分享</span>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {isPublic ? (
              <ToggleRight className="w-6 h-6 text-green-400" />
            ) : (
              <ToggleLeft className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Preview info */}
        {previewData && (
          <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <Check className="w-4 h-4" />
              <span>
                预览成功: {previewData.frameCount} 帧,{' '}
                {(previewData.durationMs / 1000).toFixed(1)} 秒
              </span>
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">小节列表</label>
            <button
              onClick={addSection}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加小节
            </button>
          </div>

          {sections.map((section, index) => renderSectionEditor(section, index))}
        </div>
      </div>
    </div>
  );

  return view === 'list' ? renderListView() : renderEditView();
};

export default WaveformEditor;
