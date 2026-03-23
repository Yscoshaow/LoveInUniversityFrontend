import GameCard from './GameCard';
import { motion } from 'motion/react';
import { Skull, Wifi, WifiOff } from 'lucide-react';
import type { TavernPlayerGameView } from '../../types';

interface GamePlayerAreaProps {
  player: TavernPlayerGameView;
  position: 'bottom' | 'top' | 'left' | 'right';
  isTurn: boolean;
  isMe?: boolean;
  myCards?: string[];
  selectedCards?: Set<number>;
  onCardClick?: (index: number) => void;
  isSpeaking?: boolean;
}

export default function GamePlayerArea({
  player,
  position,
  isTurn,
  isMe,
  myCards,
  selectedCards,
  onCardClick,
  isSpeaking,
}: GamePlayerAreaProps) {
  const isHorizontal = position === 'top' || position === 'bottom';

  if (player.status === 'ELIMINATED') {
    return (
      <div className={`flex flex-col items-center justify-center opacity-50 ${position === 'bottom' ? 'mt-auto' : ''}`}>
        <Skull className="w-10 h-10 text-red-800" />
        <span className="text-red-800 font-bold mt-1 line-through text-sm">{player.displayName}</span>
      </div>
    );
  }

  const isDisconnected = player.status === 'DISCONNECTED';

  return (
    <div className={`flex flex-col items-center ${position === 'bottom' ? 'mt-auto' : ''}`}>
      <div className={`flex items-center gap-2 mb-2 ${position === 'top' ? 'flex-col-reverse' : 'flex-col'}`}>
        <div
          className={`px-3 py-1 rounded-full border text-sm flex items-center gap-1.5 ${
            isTurn
              ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
              : 'bg-stone-800/50 border-stone-700 text-stone-400'
          } ${isSpeaking ? 'ring-2 ring-green-400/60' : ''}`}
        >
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
          ) : null}
          {player.displayName}
          {player.isBot && <span className="text-xs opacity-60">🤖</span>}
          {isDisconnected && <WifiOff size={12} className="text-red-400" />}
        </div>
        {/* 弹膛指示器 */}
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i < player.chamberPosition ? 'bg-red-600' : 'bg-stone-600'}`}
            />
          ))}
        </div>
      </div>

      <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} justify-center`}>
        {isMe && myCards ? (
          myCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={isHorizontal ? '-ml-6 sm:-ml-10 first:ml-0' : '-mt-14 sm:-mt-20 first:mt-0'}
              style={{ zIndex: i }}
            >
              <GameCard
                rank={card}
                selected={selectedCards?.has(i)}
                onClick={() => onCardClick?.(i)}
                className="hover:-translate-y-3 transition-transform"
              />
            </motion.div>
          ))
        ) : (
          Array.from({ length: player.cardCount }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={isHorizontal ? '-ml-8 sm:-ml-12 first:ml-0' : '-mt-16 sm:-mt-24 first:mt-0'}
              style={{ zIndex: i }}
            >
              <GameCard faceDown />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
