import { motion } from 'motion/react';
import { Copy, Check, UserPlus, UserMinus, Play, ArrowLeft, Bot } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { TavernRoomDetail } from '../../types';

interface GameWaitingRoomProps {
  room: TavernRoomDetail;
  isOwner: boolean;
  onStartGame: () => void;
  onLeave: () => void;
  onAddBot: (difficulty: string) => void;
  onRemoveBot: (seatIndex: number) => void;
  onReady: () => void;
}

export default function GameWaitingRoom({
  room,
  isOwner,
  onStartGame,
  onLeave,
  onAddBot,
  onRemoveBot,
  onReady,
}: GameWaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState('NORMAL');

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [room.inviteCode]);

  const canStart = room.players.length >= room.maxPlayers;
  const isFull = room.players.length >= room.maxPlayers;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-stone-900 to-black">
      {/* 顶栏 */}
      <div className="flex items-center justify-between p-4 border-b border-stone-800">
        <button onClick={onLeave} className="text-stone-400 hover:text-white flex items-center gap-1.5">
          <ArrowLeft size={18} />
          <span className="text-sm">离开</span>
        </button>
        <h2 className="text-lg font-bold text-amber-500">等待房间</h2>
        <div />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 邀请码 */}
        <div className="bg-stone-800/50 rounded-xl p-4 text-center">
          <p className="text-stone-400 text-sm mb-2">邀请码</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400">
              {room.inviteCode}
            </span>
            <button
              onClick={copyCode}
              className="p-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 transition-colors"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* 玩家列表 */}
        <div className="space-y-3">
          <h3 className="text-sm text-stone-400 font-medium">
            玩家 ({room.players.length}/{room.maxPlayers})
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {room.players.map((player) => (
              <motion.div
                key={player.seatIndex}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-stone-800/50 border border-stone-700 rounded-xl p-3 flex items-center gap-3"
              >
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-stone-400">
                    {player.isBot ? '🤖' : player.displayName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-stone-200 text-sm font-medium truncate">
                    {player.displayName}
                  </p>
                  <p className="text-xs text-stone-500">
                    座位 {player.seatIndex + 1}
                    {player.isBot && ' · AI'}
                  </p>
                </div>
                {isOwner && player.isBot && (
                  <button
                    onClick={() => onRemoveBot(player.seatIndex)}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </motion.div>
            ))}

            {/* 空位 */}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="bg-stone-800/20 border border-stone-800 border-dashed rounded-xl p-3 flex items-center justify-center text-stone-600 text-sm"
              >
                等待加入...
              </div>
            ))}
          </div>
        </div>

        {/* AI 添加（房主） */}
        {isOwner && !isFull && (
          <div className="bg-stone-800/30 rounded-xl p-4 space-y-3">
            <h3 className="text-sm text-stone-400 font-medium flex items-center gap-1.5">
              <Bot size={14} />
              添加 AI 机器人
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value)}
                className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200"
              >
                <option value="EASY">简单</option>
                <option value="NORMAL">普通</option>
                <option value="HARD">困难</option>
              </select>
              <button
                onClick={() => onAddBot(botDifficulty)}
                className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
              >
                <UserPlus size={14} />
                添加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="p-4 border-t border-stone-800 space-y-2">
        {isOwner ? (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Play size={18} />
            开始游戏 {!canStart && `(需满 ${room.maxPlayers} 人)`}
          </button>
        ) : (
          <button
            onClick={onReady}
            className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
          >
            准备就绪
          </button>
        )}
      </div>
    </div>
  );
}
