import { motion } from 'motion/react';

interface GameTurnTimerProps {
  timeRemainingMs: number;
  totalMs?: number;
  isMyTurn: boolean;
}

export default function GameTurnTimer({ timeRemainingMs, totalMs = 60000, isMyTurn }: GameTurnTimerProps) {
  const pct = Math.max(0, Math.min(100, (timeRemainingMs / totalMs) * 100));
  const seconds = Math.ceil(timeRemainingMs / 1000);
  const isLow = seconds <= 10;

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 sm:w-32 h-2 bg-stone-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isLow ? 'bg-red-500' : isMyTurn ? 'bg-amber-500' : 'bg-stone-500'}`}
          style={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className={`text-sm font-mono min-w-[2.5rem] text-right ${isLow ? 'text-red-400 animate-pulse' : 'text-stone-400'}`}>
        {seconds}s
      </span>
    </div>
  );
}
