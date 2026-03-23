import React, { useState } from 'react';
import {
  ChevronLeft, Heart, MessageCircle, Eye, Coins, ShoppingCart,
  User, Tag, Sparkles, X, Server, Key,
} from 'lucide-react';
import { useMarketplaceDetail, usePurchaseCard, useToggleCardLike, useCreateConversation, useAiModels } from '../../hooks/useAlumniChat';
import type { CreateConversationRequest } from '../../types';

interface CharacterCardDetailProps {
  cardId: number;
  onBack: () => void;
  onStartChat: (conversationId: number) => void;
}

const CharacterCardDetail: React.FC<CharacterCardDetailProps> = ({
  cardId,
  onBack,
  onStartChat,
}) => {
  const { data: card, isLoading } = useMarketplaceDetail(cardId);
  const purchaseCard = usePurchaseCard();
  const toggleLike = useToggleCardLike();
  const createConversation = useCreateConversation();
  const { data: models } = useAiModels();
  const [purchasing, setPurchasing] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerType, setProviderType] = useState<'SERVER' | 'CUSTOM'>('SERVER');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleStartChat = async () => {
    setCreating(true);
    try {
      const req: CreateConversationRequest = {
        characterCardId: cardId,
        title: card?.name ?? '新对话',
        aiProviderType: providerType,
        ...(providerType === 'SERVER'
          ? { serverModelId: selectedModelId }
          : { customApiUrl, customApiKey, customModelName }),
      };
      const conv = await createConversation.mutateAsync(req);
      setShowProviderModal(false);
      onStartChat(conv.id);
    } catch (e: any) {
      alert(e.message || '创建对话失败');
    } finally {
      setCreating(false);
    }
  };

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      await purchaseCard.mutateAsync(cardId);
    } catch (e: any) {
      alert(e.message || '购买失败');
    } finally {
      setPurchasing(false);
    }
  };

  if (isLoading || !card) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  const tags = card.tags ? (() => { try { return JSON.parse(card.tags) as string[]; } catch { return []; } })() : [];
  const suggestedReplies = card.suggestedReplies ? (() => { try { return JSON.parse(card.suggestedReplies) as string[]; } catch { return []; } })() : [];
  const openingDialogues = card.openingDialogues ? (() => { try { return JSON.parse(card.openingDialogues) as { role: string; text: string }[][]; } catch { return []; } })() : [];
  const canChat = card.isFree || card.isPurchased || card.isOwner;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full overflow-hidden">
      {/* Header image */}
      <div className="relative flex-shrink-0">
        <div className="w-full aspect-[3/2] bg-gradient-to-br from-purple-200 to-indigo-200 dark:from-purple-900/40 dark:to-indigo-900/40 overflow-hidden">
          {card.avatarUrl ? (
            <img src={card.avatarUrl} alt={card.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl">🤖</span>
            </div>
          )}
        </div>
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => toggleLike.mutate(cardId)}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
            card.isLiked ? 'bg-red-500 text-white' : 'bg-black/30 hover:bg-black/50 text-white'
          }`}
        >
          <Heart size={20} fill={card.isLiked ? 'white' : 'none'} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto -mt-4 relative">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-t-3xl px-4 pt-5 pb-4">
          {/* Name & Stats */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{card.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-0.5"><Eye size={12} /> {card.viewCount}</span>
                <span className="flex items-center gap-0.5"><Heart size={12} /> {card.likeCount}</span>
                <span className="flex items-center gap-0.5"><MessageCircle size={12} /> {card.chatCount}</span>
              </div>
            </div>
            {!card.isFree && (
              <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-medium">
                <Coins size={14} /> {card.priceCampusPoints}
              </div>
            )}
          </div>

          {/* Creator */}
          {card.creatorName && (
            <div className="flex items-center gap-2 mt-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {card.creatorAvatar ? (
                <img src={card.creatorAvatar} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                  <User size={14} className="text-slate-400" />
                </div>
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">{card.creatorName}</span>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full flex items-center gap-1">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          )}

          {/* Introduction */}
          {card.introduction && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">介绍</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{card.introduction}</p>
            </div>
          )}

          {/* Personality */}
          {card.personality && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">性格</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{card.personality}</p>
            </div>
          )}

          {/* Scenario */}
          {card.scenario && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">场景</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{card.scenario}</p>
            </div>
          )}

          {/* Detailed description */}
          {card.detailedDescription && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">详细描述</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{card.detailedDescription}</p>
            </div>
          )}

          {/* Suggested replies */}
          {suggestedReplies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">建议回复</h3>
              <div className="flex flex-wrap gap-2">
                {suggestedReplies.map((reply, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-400">
                    {reply}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Opening dialogues preview */}
          {openingDialogues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">开场对话 ({openingDialogues.length} 组)</h3>
              <div className="space-y-2">
                {openingDialogues.map((group, gi) => (
                  <div key={gi} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 space-y-1.5">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">对话组 {gi + 1}</span>
                    {group.map((msg, mi) => (
                      <div key={mi} className={`flex gap-2 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          msg.role === 'ai'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {msg.role === 'ai' ? 'AI' : '用户'}
                        </span>
                        <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed ${msg.role === 'user' ? 'text-right' : ''}`}>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gallery images */}
          {card.images.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">图库</h3>
              <div className="grid grid-cols-3 gap-2">
                {card.images.map((img) => (
                  <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={img.imageUrl} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
        {canChat ? (
          <button
            onClick={() => {
              if (models?.length) setSelectedModelId(models[0].modelId);
              setShowProviderModal(true);
            }}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> 开始聊天
          </button>
        ) : (
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            {purchasing ? '购买中...' : `购买 (${card.priceCampusPoints} 校园点)`}
          </button>
        )}
      </div>

      {/* AI Provider Selection Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowProviderModal(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">选择 AI 提供者</h3>
              <button onClick={() => setShowProviderModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Provider type toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setProviderType('SERVER')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  providerType === 'SERVER'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Server size={16} /> 平台模型
              </button>
              <button
                onClick={() => setProviderType('CUSTOM')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  providerType === 'CUSTOM'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Key size={16} /> 自定义 API
              </button>
            </div>

            {providerType === 'SERVER' ? (
              <div className="space-y-2">
                {models?.map(m => (
                  <button
                    key={m.modelId}
                    onClick={() => setSelectedModelId(m.modelId)}
                    className={`w-full p-3 rounded-xl text-left border transition-colors ${
                      selectedModelId === m.modelId
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-100">{m.displayName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      输入: {m.inputPriceCentsPerMillion} 分/1M · 输出: {m.outputPriceCentsPerMillion} 分/1M
                    </div>
                  </button>
                ))}
                {(!models || models.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">暂无可用模型</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">API URL</label>
                  <input
                    type="url"
                    value={customApiUrl}
                    onChange={e => setCustomApiUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">API Key</label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={e => setCustomApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">模型名称</label>
                  <input
                    type="text"
                    value={customModelName}
                    onChange={e => setCustomModelName(e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleStartChat}
              disabled={creating || (providerType === 'SERVER' && !selectedModelId) || (providerType === 'CUSTOM' && (!customApiUrl || !customApiKey || !customModelName))}
              className="w-full mt-4 py-3 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <MessageCircle size={18} /> 创建对话
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterCardDetail;
