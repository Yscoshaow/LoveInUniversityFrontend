import GameCard from './GameCard';
import { motion } from 'motion/react';
import type { TavernGamePhase } from '../../types';

interface GameTableProps {
  targetRank: string;
  pileSize: number;
  phase: TavernGamePhase;
  revealedCards?: string[];
}

export default function GameTable({ targetRank, pileSize, phase, revealedCards }: GameTableProps) {
  const rankDisplay = targetRank === 'KING' ? 'K' : targetRank === 'QUEEN' ? 'Q' : targetRank === 'ACE' ? 'A' : targetRank;

  return (
    <div className="relative w-48 h-48 sm:w-80 sm:h-80 rounded-full bg-stone-800/40 border-8 border-stone-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
      <div className="absolute top-4 sm:top-8 text-center">
        <p className="text-stone-400 text-xs uppercase tracking-widest">目标</p>
        <p className="text-3xl sm:text-5xl font-bold text-amber-500 drop-shadow-lg">{rankDisplay}</p>
      </div>

      <div className="relative w-28 h-28 flex items-center justify-center mt-6">
        {pileSize === 0 ? (
          <p className="text-stone-500 italic text-sm">空牌桌</p>
        ) : (
          <div className="relative">
            {Array.from({ length: Math.min(pileSize, 10) }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: Math.random() * 180 }}
                animate={{ scale: 1, rotate: Math.random() * 40 - 20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ zIndex: i }}
              >
                <GameCard faceDown small className="shadow-md" />
              </motion.div>
            ))}

            {phase === 'CHALLENGE_REVEAL' && revealedCards && (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2 z-50"
              >
                {revealedCards.map((c, i) => (
                  <GameCard key={i} rank={c} className="w-14 h-20 sm:w-20 sm:h-28 shadow-2xl" />
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {pileSize > 0 && phase !== 'CHALLENGE_REVEAL' && (
        <div className="absolute bottom-3 sm:bottom-6 bg-stone-900/80 px-3 py-1 rounded-full text-amber-500 font-mono text-xs border border-stone-700">
          牌堆: {pileSize} 张
        </div>
      )}
    </div>
  );
}
