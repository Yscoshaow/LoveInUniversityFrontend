import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Save,
  Play,
  CheckCircle,
  AlertTriangle,
  Layout,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Smartphone,
  Settings,
  X,
  Image as ImageIcon,
  Plus,
  Users,
} from 'lucide-react';
import type { NodeCategory, ScriptValidationResult, NodeGraphDataV2, ChapterData, CharacterDef } from './types';
import { NODE_CATEGORY_LABELS, NODE_CATEGORY_COLORS, normalizeGraphData, createEmptyV2 } from './types';
import { getNodesByCategory } from './nodeDefinitions';
import { createEditor, addNode, serializeGraph, deserializeGraph, updateGameConfig } from './editor/createEditor';
import { rouletteApi } from '../../lib/api';
import { ColorPicker } from '@/components/ui/mobile-picker';

export interface GameMeta {
  title: string;
  description: string;
  coverImageUrl: string;
  tags: string[];
}

interface NodeScriptEditorProps {
  gameId: number;
  graphData?: string;
  initialMeta?: GameMeta;
  onSave: (graphJson: string, meta: GameMeta) => Promise<void>;
  onValidate: () => Promise<ScriptValidationResult>;
  onPublish: () => Promise<void>;
  onBack: () => void;
}

export default function NodeScriptEditor({
  gameId,
  graphData,
  initialMeta,
  onSave,
  onValidate,
  onPublish,
  onBack,
}: NodeScriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Awaited<ReturnType<typeof createEditor>> | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validationResult, setValidationResult] = useState<ScriptValidationResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['flow', 'player']));
  const [showSettings, setShowSettings] = useState(false);

  // 游戏元数据
  const [title, setTitle] = useState(initialMeta?.title || '');
  const [description, setDescription] = useState(initialMeta?.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialMeta?.coverImageUrl || '');
  const [tags, setTags] = useState<string[]>(initialMeta?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // V2 数据 & 章节/角色
  const [v2Data, setV2Data] = useState<NodeGraphDataV2>(createEmptyV2());
  const v2DataRef = useRef(v2Data);
  v2DataRef.current = v2Data;
  const [currentChapterId, setCurrentChapterId] = useState('main');
  const currentChapterIdRef = useRef('main');
  currentChapterIdRef.current = currentChapterId;
  const [activeTab, setActiveTab] = useState<'nodes' | 'chapters' | 'characters'>('nodes');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterName, setEditingChapterName] = useState('');
  const charAvatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);

  // 当 initialMeta 加载后同步
  useEffect(() => {
    if (initialMeta) {
      setTitle(initialMeta.title || '');
      setDescription(initialMeta.description || '');
      setCoverImageUrl(initialMeta.coverImageUrl || '');
      setTags(initialMeta.tags || []);
    }
  }, [initialMeta]);

  // 检测移动端
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 同步游戏配置到编辑器控件
  useEffect(() => {
    updateGameConfig({
      characters: v2Data.gameConfig.characters,
      chapters: Object.values(v2Data.chapters)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(c => ({ id: c.id, name: c.name })),
    });
  }, [v2Data]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current || isMobile) return;
    let destroyed = false;

    const init = async () => {
      const editorInstance = await createEditor(containerRef.current!, {
        uploadImage: rouletteApi.uploadImage,
      });
      if (destroyed) { editorInstance.destroy(); return; }
      editorRef.current = editorInstance;

      let loadedGraphData = graphData;
      if (!loadedGraphData && gameId > 0) {
        try {
          const script = await rouletteApi.getScript(gameId);
          loadedGraphData = script.graphData ?? undefined;
        } catch {}
      }

      if (loadedGraphData) {
        try {
          const raw = JSON.parse(loadedGraphData);
          const v2 = normalizeGraphData(raw);
          setV2Data(v2);
          v2DataRef.current = v2;

          const sortedChs = Object.values(v2.chapters).sort((a, b) => a.sortOrder - b.sortOrder);
          const firstCh = sortedChs[0];
          if (firstCh) {
            await deserializeGraph(editorInstance.editor, editorInstance.area, {
              version: 1,
              nodes: firstCh.nodes,
              connections: firstCh.connections,
              metadata: {
                nodeCount: Object.keys(firstCh.nodes).length,
                editorViewport: firstCh.viewport || { x: 0, y: 0, zoom: 1 },
              },
            });
            setCurrentChapterId(firstCh.id);
            currentChapterIdRef.current = firstCh.id;
          }

          updateGameConfig({
            characters: v2.gameConfig.characters,
            chapters: sortedChs.map(c => ({ id: c.id, name: c.name })),
          });
        } catch (e) {
          console.error('Failed to load graph data:', e);
        }
      } else {
        const v2 = createEmptyV2();
        setV2Data(v2);
        v2DataRef.current = v2;
        await addNode(editorInstance.editor, editorInstance.area, 'StartNode', { x: 200, y: 300 });
      }
    };

    init();

    return () => {
      destroyed = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [isMobile]);

  const getMeta = useCallback((): GameMeta => ({
    title: title.trim() || '脚本游戏',
    description: description.trim(),
    coverImageUrl: coverImageUrl.trim(),
    tags,
  }), [title, description, coverImageUrl, tags]);

  // 获取当前画布数据并合并到 V2
  const getCurrentV2 = useCallback((): NodeGraphDataV2 => {
    const base = v2DataRef.current;
    if (!editorRef.current) return base;
    const g = serializeGraph(editorRef.current.editor, editorRef.current.area);
    const chapters = { ...base.chapters };
    chapters[currentChapterIdRef.current] = {
      ...chapters[currentChapterIdRef.current],
      nodes: g.nodes,
      connections: g.connections,
    };
    let n = 0;
    for (const ch of Object.values(chapters)) n += Object.keys(ch.nodes).length;
    return { ...base, chapters, metadata: { nodeCount: n } };
  }, []);

  // ─── 章节管理 ─────────────────────────────

  const switchChapter = useCallback(async (targetId: string) => {
    if (!editorRef.current || targetId === currentChapterIdRef.current) return;
    const updated = getCurrentV2();
    setV2Data(updated);
    v2DataRef.current = updated;

    const target = updated.chapters[targetId];
    if (target) {
      await deserializeGraph(editorRef.current.editor, editorRef.current.area, {
        version: 1,
        nodes: target.nodes,
        connections: target.connections,
        metadata: {
          nodeCount: Object.keys(target.nodes).length,
          editorViewport: target.viewport || { x: 0, y: 0, zoom: 1 },
        },
      });
    }
    setCurrentChapterId(targetId);
  }, [getCurrentV2]);

  const addChapter = useCallback(() => {
    const current = getCurrentV2();
    const id = `ch_${Date.now()}`;
    const count = Object.keys(current.chapters).length;
    const maxOrder = Math.max(0, ...Object.values(current.chapters).map(c => c.sortOrder));
    const startNodeId = `csn_${Date.now()}`;
    const newChapter: ChapterData = {
      id,
      name: `第${count + 1}章`,
      sortOrder: maxOrder + 1,
      nodes: {
        [startNodeId]: {
          id: startNodeId,
          type: 'ChapterStartNode',
          position: { x: 200, y: 300 },
          data: { chapterId: id },
        },
      },
      connections: [],
    };
    const updated = { ...current, chapters: { ...current.chapters, [id]: newChapter } };
    setV2Data(updated);
    v2DataRef.current = updated;
  }, [getCurrentV2]);

  const deleteChapter = useCallback(async (id: string) => {
    const current = getCurrentV2();
    if (Object.keys(current.chapters).length <= 1) return;
    const chapters = { ...current.chapters };
    delete chapters[id];
    const updated = { ...current, chapters };
    setV2Data(updated);
    v2DataRef.current = updated;

    if (currentChapterIdRef.current === id) {
      const first = Object.values(chapters).sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (first && editorRef.current) {
        await deserializeGraph(editorRef.current.editor, editorRef.current.area, {
          version: 1,
          nodes: first.nodes,
          connections: first.connections,
          metadata: {
            nodeCount: Object.keys(first.nodes).length,
            editorViewport: first.viewport || { x: 0, y: 0, zoom: 1 },
          },
        });
        setCurrentChapterId(first.id);
      }
    }
  }, [getCurrentV2]);

  const renameChapter = useCallback((id: string, name: string) => {
    setV2Data(prev => {
      const updated = { ...prev, chapters: { ...prev.chapters } };
      updated.chapters[id] = { ...updated.chapters[id], name };
      v2DataRef.current = updated;
      return updated;
    });
  }, []);

  // ─── 角色管理 ─────────────────────────────

  const addCharacter = useCallback(() => {
    setV2Data(prev => {
      const updated = {
        ...prev,
        gameConfig: {
          ...prev.gameConfig,
          characters: [...prev.gameConfig.characters, { id: `char_${Date.now()}`, name: '新角色' }],
        },
      };
      v2DataRef.current = updated;
      return updated;
    });
  }, []);

  const updateCharacter = useCallback((id: string, updates: Partial<CharacterDef>) => {
    setV2Data(prev => {
      const updated = {
        ...prev,
        gameConfig: {
          ...prev.gameConfig,
          characters: prev.gameConfig.characters.map(c => c.id === id ? { ...c, ...updates } : c),
        },
      };
      v2DataRef.current = updated;
      return updated;
    });
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setV2Data(prev => {
      const updated = {
        ...prev,
        gameConfig: {
          ...prev.gameConfig,
          characters: prev.gameConfig.characters.filter(c => c.id !== id),
        },
      };
      v2DataRef.current = updated;
      return updated;
    });
  }, []);

  const handleCharAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingCharId) return;
    try {
      const result = await rouletteApi.uploadImage(file);
      updateCharacter(uploadingCharId, { avatar: result.imageUrl });
    } catch {}
    setUploadingCharId(null);
    if (charAvatarInputRef.current) charAvatarInputRef.current.value = '';
  }, [uploadingCharId, updateCharacter]);

  // ─── 保存/验证/发布 ─────────────────────────────

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const v2 = getCurrentV2();
      setV2Data(v2);
      v2DataRef.current = v2;
      await onSave(JSON.stringify(v2), getMeta());
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [onSave, getMeta, getCurrentV2]);

  const handleValidate = useCallback(async () => {
    if (editorRef.current) {
      const v2 = getCurrentV2();
      setV2Data(v2);
      v2DataRef.current = v2;
      await onSave(JSON.stringify(v2), getMeta());
    }
    setValidating(true);
    try {
      const result = await onValidate();
      setValidationResult(result);
    } catch (e) {
      console.error('Validation failed:', e);
    } finally {
      setValidating(false);
    }
  }, [onValidate, onSave, getMeta, getCurrentV2]);

  const handlePublish = useCallback(async () => {
    if (!title.trim()) {
      setShowSettings(true);
      return;
    }
    setPublishing(true);
    try {
      await handleSave();
      await onPublish();
    } catch (e) {
      console.error('Publish failed:', e);
    } finally {
      setPublishing(false);
    }
  }, [onPublish, handleSave, title]);

  // 拖拽节点到编辑器
  const handleDragNode = useCallback(
    async (nodeType: string) => {
      if (!editorRef.current) return;
      await addNode(editorRef.current.editor, editorRef.current.area, nodeType, {
        x: 400 + Math.random() * 200,
        y: 200 + Math.random() * 200,
      });
    },
    []
  );

  // 自动排列
  const handleAutoArrange = useCallback(async () => {
    if (!editorRef.current) return;
    await editorRef.current.arrange.layout();
  }, []);

  // 分类展开/折叠
  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // 封面上传
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setCoverUploading(true);
    try {
      const result = await rouletteApi.uploadImage(file);
      setCoverImageUrl(result.imageUrl);
    } catch {
      // ignore
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // 标签管理
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // 排序后的章节列表
  const sortedChapters = Object.values(v2Data.chapters).sort((a, b) => a.sortOrder - b.sortOrder);

  // 移动端提示
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Smartphone className="w-16 h-16 text-zinc-500 mb-4" />
        <h2 className="text-xl font-bold text-zinc-200 mb-2">请在电脑上使用</h2>
        <p className="text-zinc-400 max-w-sm">
          节点编辑器需要在桌面浏览器上使用，以获得最佳的拖拽交互体验。
        </p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-zinc-700 rounded-lg text-zinc-200 hover:bg-zinc-600"
        >
          返回
        </button>
      </div>
    );
  }

  const categories = Object.keys(NODE_CATEGORY_LABELS) as NodeCategory[];

  return (
    <div className="flex h-full bg-zinc-900">
      {/* 左侧面板 */}
      <div className="w-64 bg-zinc-800 border-r border-zinc-700 flex flex-col overflow-hidden">
        {/* 游戏设置折叠面板 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center w-full px-3 py-2.5 border-b border-zinc-700 hover:bg-zinc-700/50 transition-colors"
        >
          <Settings className="w-4 h-4 mr-2 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-300 flex-1 text-left">游戏设置</span>
          {!title.trim() && (
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" title="未设置标题" />
          )}
          {showSettings ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {showSettings && (
          <div className="border-b border-zinc-700 p-3 space-y-3 overflow-y-auto max-h-[50vh]">
            {/* 标题 */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">游戏标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入游戏标题..."
                maxLength={100}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">游戏介绍</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入游戏介绍..."
                maxLength={500}
                rows={3}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400 resize-none"
              />
            </div>

            {/* 封面图 */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">封面图片</label>
              {coverImageUrl ? (
                <div className="relative group">
                  <img
                    src={coverImageUrl}
                    alt="封面"
                    className="w-full h-28 object-cover rounded border border-zinc-600"
                  />
                  <button
                    onClick={() => setCoverImageUrl('')}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-1 right-1 px-2 py-0.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    替换
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="w-full h-20 border border-dashed border-zinc-600 rounded flex flex-col items-center justify-center hover:border-zinc-400 transition-colors"
                >
                  {coverUploading ? (
                    <span className="text-xs text-zinc-500">上传中...</span>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
                      <span className="text-xs text-zinc-500">点击上传封面</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
              />
            </div>

            {/* 标签 */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">标签</label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-700 text-xs text-zinc-300 rounded"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-zinc-100">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="添加标签..."
                    maxLength={20}
                    className="flex-1 min-w-0 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                  />
                  <button
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 栏 */}
        <div className="flex border-b border-zinc-700">
          {([
            { key: 'nodes' as const, label: '节点' },
            { key: 'chapters' as const, label: '章节' },
            { key: 'characters' as const, label: '角色' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-zinc-200 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── 节点 Tab ─── */}
          {activeTab === 'nodes' && (
            <div className="p-2 space-y-1">
              {categories.map((cat) => {
                const nodes = getNodesByCategory(cat);
                const isExpanded = expandedCategories.has(cat);
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="flex items-center w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-700"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 mr-1 text-zinc-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-1 text-zinc-500" />
                      )}
                      <span
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: NODE_CATEGORY_COLORS[cat] }}
                      />
                      <span className="text-zinc-300">{NODE_CATEGORY_LABELS[cat]}</span>
                      <span className="ml-auto text-xs text-zinc-600">{nodes.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5">
                        {nodes.map((nodeDef) => (
                          <button
                            key={nodeDef.type}
                            onClick={() => handleDragNode(nodeDef.type)}
                            className="flex items-center w-full px-2 py-1 rounded text-xs hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 group"
                            title={nodeDef.description}
                          >
                            <GripVertical className="w-3 h-3 mr-1.5 text-zinc-600 group-hover:text-zinc-400" />
                            {nodeDef.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── 章节 Tab ─── */}
          {activeTab === 'chapters' && (
            <div className="p-2 space-y-1">
              {sortedChapters.map((chapter) => (
                <div
                  key={chapter.id}
                  onClick={() => switchChapter(chapter.id)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer group ${
                    chapter.id === currentChapterId
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {editingChapterId === chapter.id ? (
                    <input
                      autoFocus
                      value={editingChapterName}
                      onChange={(e) => setEditingChapterName(e.target.value)}
                      onBlur={() => {
                        if (editingChapterName.trim()) renameChapter(chapter.id, editingChapterName.trim());
                        setEditingChapterId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingChapterName.trim()) renameChapter(chapter.id, editingChapterName.trim());
                          setEditingChapterId(null);
                        }
                        if (e.key === 'Escape') setEditingChapterId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 px-1 py-0 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingChapterId(chapter.id);
                        setEditingChapterName(chapter.name);
                      }}
                    >
                      {chapter.name}
                    </span>
                  )}
                  <span className="text-xs text-zinc-600 tabular-nums">
                    {Object.keys(chapter.nodes).length}
                  </span>
                  {Object.keys(v2Data.chapters).length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
                      className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addChapter}
                className="flex items-center gap-1 w-full px-2 py-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                新建章节
              </button>
            </div>
          )}

          {/* ─── 角色 Tab ─── */}
          {activeTab === 'characters' && (
            <div className="p-2 space-y-2">
              <input
                ref={charAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCharAvatarUpload}
              />
              {v2Data.gameConfig.characters.map((char) => (
                <div key={char.id} className="p-2 bg-zinc-900 rounded space-y-2">
                  <div className="flex items-center gap-2">
                    {/* 头像 */}
                    <div
                      className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden shrink-0 cursor-pointer flex items-center justify-center hover:ring-2 hover:ring-zinc-500 transition-shadow"
                      style={{ border: `2px solid ${char.color || '#555'}` }}
                      onClick={() => {
                        setUploadingCharId(char.id);
                        charAvatarInputRef.current?.click();
                      }}
                      title="点击上传头像"
                    >
                      {char.avatar ? (
                        <img src={char.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Users className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    {/* 名称 */}
                    <input
                      value={char.name}
                      onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 outline-none focus:border-zinc-500"
                      placeholder="角色名称"
                    />
                    {/* 颜色 */}
                    <ColorPicker
                      value={char.color || '#888888'}
                      onChange={(color) => updateCharacter(char.id, { color })}
                    />
                    {/* 删除 */}
                    <button
                      onClick={() => deleteCharacter(char.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addCharacter}
                className="flex items-center gap-1 w-full px-2 py-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                新建角色
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 中央编辑器区域 */}
      <div className="flex-1 flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center px-4 py-2 bg-zinc-800 border-b border-zinc-700 gap-2">
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
          >
            返回
          </button>
          <div className="w-px h-5 bg-zinc-600" />

          {/* 当前标题 + 章节名 */}
          <span className="text-sm text-zinc-400 truncate max-w-48" title={title || '未命名'}>
            {title || <span className="italic text-zinc-600">未命名游戏</span>}
          </span>
          <span className="text-xs text-zinc-600">
            / {v2Data.chapters[currentChapterId]?.name || ''}
          </span>

          <button
            onClick={handleAutoArrange}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
            title="自动排列"
          >
            <Layout className="w-4 h-4" />
            排列
          </button>

          <div className="flex-1" />

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded disabled:opacity-50 transition-colors ${
              saveStatus === 'success'
                ? 'bg-green-600/30 text-green-400'
                : saveStatus === 'error'
                  ? 'bg-red-600/30 text-red-400'
                  : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
            }`}
          >
            {saveStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : saveStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? '保存中...' : saveStatus === 'success' ? '已保存' : saveStatus === 'error' ? '保存失败' : '保存'}
          </button>

          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {validating ? '验证中...' : '验证'}
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {publishing ? '发布中...' : '发布'}
          </button>
        </div>

        {/* 验证结果 */}
        {validationResult && (
          <div
            className={`px-4 py-2 text-sm border-b ${
              validationResult.valid
                ? 'bg-green-900/30 border-green-800 text-green-400'
                : 'bg-red-900/30 border-red-800 text-red-400'
            }`}
          >
            {validationResult.valid ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                验证通过
              </span>
            ) : (
              <div>
                <span className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  发现 {validationResult.errors.length} 个问题
                </span>
                <ul className="ml-6 text-xs space-y-0.5">
                  {validationResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      {err.severity === 'ERROR' ? '❌' : '⚠️'} {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Rete.js 编辑器容器 */}
        <div ref={containerRef} className="flex-1 relative" />
      </div>
    </div>
  );
}
