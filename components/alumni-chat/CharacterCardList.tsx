import React from 'react';
import { Plus, Eye, Heart, MessageCircle, Edit3, Trash2 } from 'lucide-react';
import { useMyCards, usePurchasedCards, useDeleteCard } from '../../hooks/useAlumniChat';
import type { CharacterCardSummary } from '../../types';

interface CharacterCardListProps {
  type: 'my' | 'purchased';
  onCreateCard?: () => void;
  onEditCard?: (cardId: number) => void;
  onCardDetail?: (cardId: number) => void;
  onStartChat?: (cardId: number) => void;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    PENDING_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    DRAFT: '草稿',
    PENDING_REVIEW: '审核中',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[status] || styles.DRAFT}`}>
      {labels[status] || status}
    </span>
  );
};

const CardItem: React.FC<{
  card: CharacterCardSummary;
  type: 'my' | 'purchased';
  onEdit?: () => void;
  onDetail?: () => void;
  onStartChat?: () => void;
  onDelete?: () => void;
}> = ({ card, type, onEdit, onDetail, onStartChat, onDelete }) => {
  const tags = card.tags ? (() => { try { return JSON.parse(card.tags) as string[]; } catch { return []; } })() : [];

  return (
    <div
      onClick={onDetail}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Avatar */}
      <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center overflow-hidden">
        {card.avatarUrl ? (
          <img src={card.avatarUrl} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl">🤖</span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate flex-1">{card.name}</h3>
          {type === 'my' && <StatusBadge status={card.reviewStatus} />}
        </div>

        {card.introduction && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{card.introduction}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-0.5"><Eye size={10} /> {card.viewCount}</span>
          <span className="flex items-center gap-0.5"><Heart size={10} /> {card.likeCount}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {card.chatCount}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          {type === 'my' && onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex-1 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <Edit3 size={12} className="inline mr-1" />编辑
            </button>
          )}
          {onStartChat && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartChat(); }}
              className="flex-1 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <MessageCircle size={12} className="inline mr-1" />聊天
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const CharacterCardList: React.FC<CharacterCardListProps> = ({
  type,
  onCreateCard,
  onEditCard,
  onCardDetail,
  onStartChat,
}) => {
  const { data: myCards, isLoading: myLoading } = useMyCards();
  const { data: purchasedCards, isLoading: purchasedLoading } = usePurchasedCards();
  const deleteCard = useDeleteCard();

  const cards = type === 'my' ? myCards : purchasedCards;
  const isLoading = type === 'my' ? myLoading : purchasedLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <span className="text-5xl mb-4">🤖</span>
        <p className="text-slate-500 dark:text-slate-400 text-center">
          {type === 'my' ? '还没有角色卡，创建一个吧!' : '还没有购买的角色卡'}
        </p>
        {type === 'my' && onCreateCard && (
          <button
            onClick={onCreateCard}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} className="inline mr-1" />创建角色卡
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          type={type}
          onEdit={type === 'my' && onEditCard ? () => onEditCard(card.id) : undefined}
          onDetail={onCardDetail ? () => onCardDetail(card.id) : undefined}
          onStartChat={onStartChat ? () => onStartChat(card.id) : undefined}
        />
      ))}
    </div>
  );
};

export default CharacterCardList;
