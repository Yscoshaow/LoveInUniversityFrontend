import { motion } from 'motion/react';
import { Trophy, ArrowLeft, RotateCcw } from 'lucide-react';

interface GameOverScreenProps {
  winnerName: string;
  winnerSeat: number;
  mySeat: number;
  rewardCampusPoints: number;
  totalRounds: number;
  onExit: () => void;
  onPlayAgain?: () => void;
  playAgainLoading?: boolean;
}

export default function GameOverScreen({
  winnerName,
  winnerSeat,
  mySeat,
  rewardCampusPoints,
  totalRounds,
  onExit,
  onPlayAgain,
  playAgainLoading,
}: GameOverScreenProps) {
  const isWinner = winnerSeat === mySeat;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <Trophy className={`w-20 h-20 ${isWinner ? 'text-amber-400' : 'text-stone-600'}`} />
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`text-4xl sm:text-5xl font-bold mt-6 ${isWinner ? 'text-amber-500' : 'text-stone-300'}`}
      >
        {isWinner ? '你赢了！' : '游戏结束'}
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-xl text-stone-400 mt-4"
      >
        {isWinner ? '你是最后的幸存者！' : `${winnerName} 是最后的幸存者！`}
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 bg-stone-800/50 border border-stone-700 rounded-xl p-6 text-center space-y-2"
      >
        <p className="text-stone-400">
          总回合数: <span className="text-stone-200 font-bold">{totalRounds}</span>
        </p>
        {isWinner && rewardCampusPoints > 0 && (
          <p className="text-amber-400">
            奖励: <span className="font-bold">+{rewardCampusPoints} 校园点</span>
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 flex items-center gap-4"
      >
        <button
          onClick={onExit}
          className="px-8 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={18} />
          返回大厅
        </button>
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            disabled={playAgainLoading}
            className="px-8 py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <RotateCcw size={18} className={playAgainLoading ? 'animate-spin' : ''} />
            {playAgainLoading ? '准备中...' : '再来一把'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
