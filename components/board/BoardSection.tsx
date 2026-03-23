import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { boardApi } from '../../lib/api';
import { queryKeys } from '../../lib/query-client';
import { BentoGrid } from './BentoGrid';
import { ImageLightbox } from '../ui/ImageLightbox';

interface BoardSectionProps {
  userId: number;
}

export const BoardSection: React.FC<BoardSectionProps> = ({ userId }) => {
  const { data } = useQuery({
    queryKey: queryKeys.board.byUser(userId),
    queryFn: () => boardApi.getBoard(userId),
    staleTime: 5 * 60 * 1000,
  });

  const [lightboxState, setLightboxState] = useState<{
    images: { imageUrl: string }[];
    initialIndex: number;
  } | null>(null);

  if (!data?.blocks?.length) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <LayoutGrid size={16} className="text-secondary" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">展示板</h3>
      </div>
      <BentoGrid
        blocks={data.blocks}
        userId={userId}
        onImageClick={(_imageUrl, allImages, index) => {
          setLightboxState({ images: allImages, initialIndex: index });
        }}
      />
      {lightboxState && (
        <ImageLightbox
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          onClose={() => setLightboxState(null)}
        />
      )}
    </div>
  );
};
