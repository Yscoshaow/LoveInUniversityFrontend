import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2, Save } from 'lucide-react';
import { boardApi } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';
import { BentoGrid } from '../board/BentoGrid';
import { BlockEditorModal } from '../board/BlockEditorModal';
import type { BoardBlock } from '../../types';

const MAX_BLOCKS = 12;

interface BoardEditorPageProps {
  onBack: () => void;
}

export const BoardEditorPage: React.FC<BoardEditorPageProps> = ({ onBack }) => {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<BoardBlock[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BoardBlock | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.board.my(),
    queryFn: () => boardApi.getMyBoard(),
  });

  useEffect(() => {
    if (data?.blocks) {
      setBlocks(data.blocks);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (blocksToSave: BoardBlock[]) => boardApi.saveBoard(blocksToSave),
    onSuccess: (result) => {
      setBlocks(result.blocks);
      setHasChanges(false);
      // Invalidate all board caches
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(blocks);
  };

  const handleAddOrEditBlock = (block: BoardBlock) => {
    setBlocks(prev => {
      const exists = prev.findIndex(b => b.id === block.id);
      let updated: BoardBlock[];
      if (exists >= 0) {
        updated = prev.map(b => b.id === block.id ? block : b);
      } else {
        updated = [...prev, { ...block, sortOrder: prev.length }];
      }
      return updated;
    });
    setHasChanges(true);
    setEditingBlock(null);
    setShowAddModal(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId).map((b, i) => ({ ...b, sortOrder: i })));
    setHasChanges(true);
  };

  const handleMoveUp = (blockId: string) => {
    setBlocks(prev => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex(b => b.id === blockId);
      if (idx <= 0) return prev;
      [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
      return sorted.map((b, i) => ({ ...b, sortOrder: i }));
    });
    setHasChanges(true);
  };

  const handleMoveDown = (blockId: string) => {
    setBlocks(prev => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex(b => b.id === blockId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
      return sorted.map((b, i) => ({ ...b, sortOrder: i }));
    });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bgMain)]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">返回</span>
          </button>
          <h1 className="font-bold text-base text-slate-800 dark:text-slate-100">展示板编辑</h1>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              hasChanges && !saveMutation.isPending
                ? 'bg-primary text-white active:scale-95'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
            }`}
          >
            {saveMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            保存
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-24">
        {/* Error message */}
        {saveMutation.isError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 rounded-xl text-sm text-red-600 dark:text-red-400">
            保存失败: {(saveMutation.error as Error)?.message || '未知错误'}
          </div>
        )}

        {/* Success message */}
        {saveMutation.isSuccess && !hasChanges && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-xl text-sm text-green-600 dark:text-green-400">
            已保存
          </div>
        )}

        {/* Preview Grid */}
        {blocks.length > 0 ? (
          <BentoGrid
            blocks={blocks}
            editable
            onBlockClick={(block) => setEditingBlock(block)}
            onBlockDelete={handleDeleteBlock}
            onBlockMoveUp={handleMoveUp}
            onBlockMoveDown={handleMoveDown}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
              <Plus size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium">你的展示板还是空的</p>
            <p className="text-xs mt-1">点击下方按钮添加内容块</p>
          </div>
        )}

        {/* Add block button */}
        {blocks.length < MAX_BLOCKS && (
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 active:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">添加内容块 ({blocks.length}/{MAX_BLOCKS})</span>
          </button>
        )}

        {blocks.length >= MAX_BLOCKS && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
            已达到上限 {MAX_BLOCKS} 个块
          </p>
        )}
      </div>

      {/* Add/Edit Modal */}
      <BlockEditorModal
        isOpen={showAddModal || !!editingBlock}
        onClose={() => { setShowAddModal(false); setEditingBlock(null); }}
        onSave={handleAddOrEditBlock}
        editingBlock={editingBlock}
      />
    </div>
  );
};
