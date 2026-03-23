import React, { useState } from 'react';
import {
  ChevronLeft,
  Plus,
  Store,
  MessageCircle,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useMyCards, usePurchasedCards, useMyConversations } from '../../hooks/useAlumniChat';
import CharacterCardList from './CharacterCardList';
import CharacterCardMarketplace from './CharacterCardMarketplace';
import ChatConversationList from './ChatConversationList';

type Tab = 'marketplace' | 'conversations' | 'my-cards' | 'purchased';

interface AlumniChatPageProps {
  onBack: () => void;
  onCreateCard: () => void;
  onEditCard: (cardId: number) => void;
  onCardDetail: (cardId: number) => void;
  onChat: (conversationId: number) => void;
  onStartChat: (cardId: number) => void;
}

const AlumniChatPage: React.FC<AlumniChatPageProps> = ({
  onBack,
  onCreateCard,
  onEditCard,
  onCardDetail,
  onChat,
  onStartChat,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('marketplace');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'marketplace', label: '市场', icon: <Store size={15} /> },
    { key: 'conversations', label: '对话', icon: <MessageCircle size={15} /> },
    { key: 'my-cards', label: '我的', icon: <Sparkles size={15} /> },
    { key: 'purchased', label: '已购', icon: <ShoppingBag size={15} /> },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">校友聊天</h1>
        </div>
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'marketplace' && (
          <CharacterCardMarketplace
            onCardDetail={onCardDetail}
            onStartChat={onStartChat}
          />
        )}
        {activeTab === 'conversations' && (
          <ChatConversationList onChat={onChat} onStartChat={onStartChat} />
        )}
        {activeTab === 'my-cards' && (
          <CharacterCardList
            type="my"
            onCreateCard={onCreateCard}
            onEditCard={onEditCard}
            onCardDetail={onCardDetail}
          />
        )}
        {activeTab === 'purchased' && (
          <CharacterCardList
            type="purchased"
            onCardDetail={onCardDetail}
            onStartChat={onStartChat}
          />
        )}
      </div>

      {/* FAB for creating card */}
      {activeTab === 'my-cards' && (
        <button
          onClick={onCreateCard}
          className="fixed bottom-24 right-6 w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 active:scale-95 transition-all z-20"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
};

export default AlumniChatPage;
