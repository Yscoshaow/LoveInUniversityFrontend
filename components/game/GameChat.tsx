import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  timestamp: number;
}

interface GameChatProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function GameChat({ messages, onSend, isOpen, onToggle }: GameChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [readCount, setReadCount] = useState(0);

  // 新消息到达时自动滚底
  useEffect(() => {
    if (isOpen && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current!.scrollTop = listRef.current!.scrollHeight;
      });
    }
  }, [messages, isOpen]);

  // 打开面板时标记全部已读
  useEffect(() => {
    if (isOpen) {
      setReadCount(messages.length);
    }
  }, [isOpen, messages.length]);

  const unreadCount = isOpen ? 0 : messages.length - readCount;

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <>
      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-400 hover:text-white shadow-lg"
        >
          <MessageCircle size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
              {unreadCount > 99 ? '99' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* 聊天面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-0 right-0 z-40 w-72 h-80 bg-stone-900/95 backdrop-blur border-l border-t border-stone-700 rounded-tl-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-700">
              <span className="text-sm text-stone-300 font-medium">聊天</span>
              <button onClick={onToggle} className="text-stone-500 hover:text-stone-300">
                <X size={16} />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1.5 text-sm">
              {messages.map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} alt="" className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-stone-700 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <span className="text-amber-400 text-xs">{msg.displayName}</span>
                    <p className="text-stone-300 break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 p-2 border-t border-stone-700">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="发消息..."
                maxLength={500}
                className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-600"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-1.5 text-amber-500 hover:text-amber-400 disabled:text-stone-600"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
