import React from 'react';
import type { BoardBlock, BoardBlockSize } from '../../types';
import { BoardBlockRenderer } from './BoardBlockRenderer';

const sizeClasses: Record<BoardBlockSize, string> = {
  SMALL: 'col-span-1 row-span-1',
  WIDE: 'col-span-2 row-span-1',
  LARGE: 'col-span-2 row-span-2',
  W3H2: 'col-span-3 row-span-2',
  W3H3: 'col-span-3 row-span-3',
  W3H4: 'col-span-3 row-span-4',
  W4H3: 'col-span-4 row-span-3',
};

interface BentoGridProps {
  blocks: BoardBlock[];
  userId?: number;
  editable?: boolean;
  onBlockClick?: (block: BoardBlock) => void;
  onBlockDelete?: (blockId: string) => void;
  onBlockMoveUp?: (blockId: string) => void;
  onBlockMoveDown?: (blockId: string) => void;
  onImageClick?: (imageUrl: string, allImages: { imageUrl: string }[], index: number) => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  blocks,
  userId,
  editable = false,
  onBlockClick,
  onBlockDelete,
  onBlockMoveUp,
  onBlockMoveDown,
  onImageClick,
}) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleBlockClick = (block: BoardBlock) => {
    if (editable) {
      onBlockClick?.(block);
    } else if (block.type === 'IMAGE' && block.content.imageUrl && onImageClick) {
      const imageBlocks = sortedBlocks.filter(b => b.type === 'IMAGE' && b.content.imageUrl);
      const images = imageBlocks.map(b => ({ imageUrl: b.content.imageUrl! }));
      const index = imageBlocks.findIndex(b => b.id === block.id);
      onImageClick(block.content.imageUrl, images, index);
    }
  };

  return (
    <div
      className="grid grid-cols-4 gap-2"
      style={{ gridAutoRows: '80px', gridAutoFlow: 'dense' }}
    >
      {sortedBlocks.map((block) => (
        <div
          key={block.id}
          className={`${sizeClasses[block.size]} rounded-2xl overflow-hidden relative group ${
            !editable && block.type === 'IMAGE' && block.content.imageUrl ? 'cursor-pointer' : ''
          }`}
        >
          {editable && (
            <div className="absolute inset-0 z-10 opacity-0 group-active:opacity-100 transition-opacity bg-black/10" />
          )}

          {/* Edit overlay */}
          {editable && (
            <div className="absolute top-1 right-1 z-20 flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onBlockDelete?.(block.id); }}
                className="w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center text-xs"
              >
                &times;
              </button>
            </div>
          )}

          {/* Reorder controls */}
          {editable && (
            <div className="absolute bottom-1 right-1 z-20 flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onBlockMoveUp?.(block.id); }}
                className="w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center text-[10px]"
              >
                &#x25B2;
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onBlockMoveDown?.(block.id); }}
                className="w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center text-[10px]"
              >
                &#x25BC;
              </button>
            </div>
          )}

          <div
            className="w-full h-full"
            onClick={() => handleBlockClick(block)}
          >
            <BoardBlockRenderer block={block} userId={userId} />
          </div>
        </div>
      ))}
    </div>
  );
};
