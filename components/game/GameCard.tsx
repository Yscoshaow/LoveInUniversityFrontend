import { motion } from 'motion/react';

interface GameCardProps {
  rank?: string;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  small?: boolean;
}

export default function GameCard({ rank, faceDown, selected, onClick, className = '', small }: GameCardProps) {
  const sizeClass = small ? 'w-10 h-14' : 'w-16 h-24 sm:w-24 sm:h-36';

  return (
    <motion.div
      onClick={onClick}
      animate={{ y: selected ? -20 : 0 }}
      className={`relative ${sizeClass} rounded-lg shadow-xl cursor-pointer select-none border-2 ${
        selected ? 'border-amber-400 shadow-amber-500/50' : 'border-stone-800'
      } ${className}`}
    >
      {/* 正面 */}
      <div
        className={`absolute inset-0 w-full h-full rounded-lg flex flex-col items-center justify-center bg-stone-100 text-stone-900 ${
          faceDown ? 'hidden' : ''
        }`}
      >
        {rank === 'JOKER' ? (
          <span className={small ? 'text-lg' : 'text-2xl sm:text-4xl font-bold text-red-600'}>🃏</span>
        ) : (
          <>
            <span
              className={`${small ? 'text-sm' : 'text-xl sm:text-3xl'} font-bold ${
                rank === 'KING' ? 'text-stone-900' : rank === 'QUEEN' ? 'text-red-700' : 'text-stone-900'
              }`}
            >
              {rank === 'KING' ? 'K' : rank === 'QUEEN' ? 'Q' : rank === 'ACE' ? 'A' : rank}
            </span>
            <span className={small ? 'text-base' : 'text-2xl sm:text-4xl mt-1'}>
              {rank === 'KING' ? '♠' : rank === 'QUEEN' ? '♥' : '♣'}
            </span>
          </>
        )}
      </div>
      {/* 背面 */}
      <div
        className={`absolute inset-0 w-full h-full rounded-lg bg-red-900 border-2 border-stone-900 flex items-center justify-center ${
          !faceDown ? 'hidden' : ''
        }`}
      >
        <div className="w-full h-full opacity-30 bg-[radial-gradient(circle,_transparent_20%,_#000_120%)] rounded-lg" />
        <span className={`text-stone-900/50 absolute ${small ? 'text-xl' : 'text-4xl'}`}>☠</span>
      </div>
    </motion.div>
  );
}
