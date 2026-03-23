import React from 'react';
import { MessageCircle, Trash2, Clock, Coins, Plus } from 'lucide-react';
import { useMyConversations, useDeleteConversation } from '../../hooks/useAlumniChat';

interface ChatConversationListProps {
  onChat: (conversationId: number) => void;
  onStartChat: (cardId: number) => void;
}

const ChatConversationList: React.FC<ChatConversationListProps> = ({ onChat, onStartChat }) => {
  const { data: conversations, isLoading } = useMyConversations();
  const deleteConversation = useDeleteConversation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <span className="text-5xl mb-4">💬</span>
        <p className="text-slate-500 dark:text-slate-400 text-center">还没有对话</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">从市场选择角色卡开始聊天</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onChat(conv.id)}
          className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-shadow"
        >
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {conv.characterAvatarUrl ? (
              <img src={conv.characterAvatarUrl} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">🤖</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                {conv.title || conv.characterName || '未命名对话'}
              </h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                conv.aiProviderType === 'SERVER'
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {conv.aiProviderType === 'SERVER' ? '平台' : '自定义'}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              {conv.lastActiveAt && (
                <span className="flex items-center gap-0.5">
                  <Clock size={10} />
                  {new Date(conv.lastActiveAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {conv.totalCentsSpent > 0 && (
                <span className="flex items-center gap-0.5">
                  <Coins size={10} />
                  ${(conv.totalCentsSpent / 100).toFixed(2)}
                </span>
              )}
              {conv.serverModelId && (
                <span className="truncate max-w-[80px]">{conv.serverModelId}</span>
              )}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('确认删除此对话？')) deleteConversation.mutate(conv.id);
            }}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ChatConversationList;
