import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, RefreshCw, Settings, Trash2, Loader2, Info } from 'lucide-react';
import { useConversationDetail, useDeleteMessage } from '../../hooks/useAlumniChat';
import { useQueryClient } from '@tanstack/react-query';
import { getJwtToken, getTelegramInitData } from '../../lib/api';
import type { ChatStreamChunk, ChatMessageData, TokenUsageData } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1';

interface ChatPageProps {
  conversationId: number;
  onBack: () => void;
  onSettings?: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ conversationId, onBack, onSettings }) => {
  const qc = useQueryClient();
  const { data: detail, isLoading } = useConversationDetail(conversationId);
  const deleteMessage = useDeleteMessage();

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<TokenUsageData | null>(null);
  const [showUsage, setShowUsage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversation = detail?.conversation;
  const messages = detail?.messages ?? [];

  // Auto-scroll to bottom (use scrollTop instead of scrollIntoView to prevent parent scroll leaking)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const initData = getTelegramInitData();
    if (initData) {
      headers['X-Telegram-Init-Data'] = initData;
    } else {
      const token = getJwtToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput('');
    setOptimisticUserMsg(content);
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);
    setLastUsage(null);
    setShowUsage(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/alumni-chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const chunk: ChatStreamChunk = JSON.parse(jsonStr);
            switch (chunk.type) {
              case 'content':
                if (chunk.content) {
                  fullContent += chunk.content;
                  setStreamingContent(fullContent);
                }
                break;
              case 'usage':
                if (chunk.usage) setLastUsage(chunk.usage);
                break;
              case 'error':
                setError(chunk.error || 'Unknown error');
                break;
              case 'done':
                break;
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setOptimisticUserMsg(null);
      // Refresh conversation detail to get saved messages
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversation', conversationId] });
    }
  }, [input, isStreaming, conversationId, getAuthHeaders, qc]);

  const regenerate = useCallback(async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');
    setError(null);
    setLastUsage(null);
    setShowUsage(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/alumni-chat/conversations/${conversationId}/regenerate`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const chunk: ChatStreamChunk = JSON.parse(jsonStr);
            if (chunk.type === 'content' && chunk.content) {
              fullContent += chunk.content;
              setStreamingContent(fullContent);
            } else if (chunk.type === 'usage' && chunk.usage) {
              setLastUsage(chunk.usage);
            } else if (chunk.type === 'error') {
              setError(chunk.error || 'Unknown error');
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to regenerate');
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      qc.invalidateQueries({ queryKey: ['alumni-chat', 'conversation', conversationId] });
    }
  }, [isStreaming, conversationId, getAuthHeaders, qc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {conversation?.characterAvatarUrl ? (
            <img src={conversation.characterAvatarUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base">🤖</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
            {conversation?.title || conversation?.characterName || '聊天'}
          </h2>
          {conversation?.serverModelId && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{conversation.serverModelId}</p>
          )}
        </div>
        {onSettings && (
          <button onClick={onSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <Settings size={18} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onDelete={() => deleteMessage.mutate({ convId: conversationId, msgId: msg.id })}
          />
        ))}

        {/* Optimistic user message (shown during streaming before query refresh) */}
        {optimisticUserMsg && (
          <div className="flex gap-2 flex-row-reverse">
            <div className="max-w-[85%] bg-purple-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5">
              <p className="text-sm whitespace-pre-wrap break-words">{optimisticUserMsg}</p>
            </div>
          </div>
        )}

        {/* Streaming response */}
        {isStreaming && streamingContent && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-sm">🤖</span>
            </div>
            <div className="max-w-[85%]">
              <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{streamingContent}<span className="inline-block w-1 h-4 bg-purple-500 animate-pulse ml-0.5" /></p>
              </div>
            </div>
          </div>
        )}

        {/* Streaming indicator (no content yet) */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-sm">🤖</span>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Cost info toggle — shown after AI reply completes */}
        {!isStreaming && lastUsage && lastUsage.centsCharged > 0 && (
          <div className="ml-9">
            <button
              onClick={() => setShowUsage(v => !v)}
              className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Info size={10} />
              <span>{showUsage ? '收起' : '费用详情'}</span>
            </button>
            {showUsage && (
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5">
                <p>输入: {lastUsage.promptTokens} tokens</p>
                <p>输出: {lastUsage.completionTokens} tokens</p>
                <p>费用: ${(lastUsage.centsCharged / 100).toFixed(4)}</p>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Regenerate button */}
      {!isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
        <div className="flex justify-center pb-1">
          <button
            onClick={regenerate}
            className="flex items-center gap-1 px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-colors"
          >
            <RefreshCw size={12} /> 重新生成
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{
  message: ChatMessageData;
  onDelete: () => void;
}> = ({ message, onDelete }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 italic px-4">
        {message.content.length > 100 ? message.content.slice(0, 100) + '...' : message.content}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-sm">🤖</span>
        </div>
      )}
      <div className={`max-w-[85%] relative ${
        isUser
          ? 'bg-purple-600 text-white rounded-2xl rounded-tr-md'
          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-md shadow-sm border border-slate-100 dark:border-slate-700'
      } px-4 py-2.5`}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        {message.createdAt && (
          <p className={`text-[10px] mt-1 ${isUser ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
            {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all self-center"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

export default ChatPage;
