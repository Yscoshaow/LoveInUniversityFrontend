import React, { useState, useEffect, useRef } from 'react';

interface DiceResult {
  systemRolls: number[];
  userRolls: number[];
  systemTotal: number;
  userTotal: number;
  resultType: 'WIN' | 'LOSE' | 'TIE';
}

interface DiceRollProps {
  isRolling: boolean;
  diceCount?: number;
  result?: DiceResult;
  onRollComplete?: () => void;
}

// Dice face dots positions
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
};

const DiceFace: React.FC<{ value: number; color: string; isRolling: boolean }> = ({ value, color, isRolling }) => {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];

  return (
    <div
      className={`w-16 h-16 rounded-xl shadow-lg flex items-center justify-center ${isRolling ? 'animate-bounce' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${color}dd, ${color})`,
        boxShadow: `0 4px 12px ${color}40`
      }}
    >
      <svg viewBox="0 0 100 100" className="w-12 h-12">
        {dots.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="10"
            fill="white"
            className={isRolling ? 'animate-pulse' : ''}
          />
        ))}
      </svg>
    </div>
  );
};

export const DiceRoll: React.FC<DiceRollProps> = ({
  isRolling,
  diceCount = 1,
  result,
  onRollComplete
}) => {
  const [systemValues, setSystemValues] = useState<number[]>(Array(diceCount).fill(1));
  const [userValues, setUserValues] = useState<number[]>(Array(diceCount).fill(1));
  const [phase, setPhase] = useState<'idle' | 'system' | 'user' | 'done'>('idle');
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRolling || !result) return;

    setPhase('system');
    let rollCount = 0;
    const maxRolls = 15;

    // System dice rolling animation
    const rollSystem = () => {
      if (rollCount < maxRolls) {
        setSystemValues(Array(diceCount).fill(0).map(() => Math.floor(Math.random() * 6) + 1));
        rollCount++;
        animationRef.current = setTimeout(rollSystem, 100);
      } else {
        // Show final system result
        setSystemValues(result.systemRolls);
        rollCount = 0;

        // Start user dice after a pause
        setTimeout(() => {
          setPhase('user');
          const rollUser = () => {
            if (rollCount < maxRolls) {
              setUserValues(Array(diceCount).fill(0).map(() => Math.floor(Math.random() * 6) + 1));
              rollCount++;
              animationRef.current = setTimeout(rollUser, 100);
            } else {
              // Show final user result
              setUserValues(result.userRolls);
              setPhase('done');
              setTimeout(() => {
                onRollComplete?.();
              }, 100);
            }
          };
          rollUser();
        }, 500);
      }
    };

    rollSystem();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isRolling, result, diceCount, onRollComplete]);

  // Reset when not rolling
  useEffect(() => {
    if (!isRolling && phase !== 'idle') {
      setPhase('idle');
    }
  }, [isRolling]);

  return (
    <div className="bg-gradient-to-br from-violet-100 to-purple-100 dark:to-purple-900 rounded-2xl p-6">
      <div className="flex justify-around items-center">
        {/* System Dice */}
        <div className="text-center">
          <div className="text-sm font-bold text-rose-500 dark:text-rose-400 mb-3">系统</div>
          <div className="flex gap-2 justify-center">
            {systemValues.map((value, i) => (
              <DiceFace
                key={`system-${i}`}
                value={value}
                color="#fb7185"
                isRolling={phase === 'system'}
              />
            ))}
          </div>
          {phase !== 'idle' && phase !== 'system' && (
            <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
              {result?.systemTotal || systemValues.reduce((a, b) => a + b, 0)}
            </div>
          )}
        </div>

        {/* VS */}
        <div className="text-2xl font-bold text-slate-400 dark:text-slate-500 px-4">VS</div>

        {/* User Dice */}
        <div className="text-center">
          <div className="text-sm font-bold text-violet-500 dark:text-violet-400 mb-3">你</div>
          <div className="flex gap-2 justify-center">
            {userValues.map((value, i) => (
              <DiceFace
                key={`user-${i}`}
                value={value}
                color="#a78bfa"
                isRolling={phase === 'user'}
              />
            ))}
          </div>
          {phase === 'done' && (
            <div className="mt-2 text-xl font-bold text-violet-600 dark:text-violet-400">
              {result?.userTotal || userValues.reduce((a, b) => a + b, 0)}
            </div>
          )}
        </div>
      </div>

      {/* Result indicator */}
      {phase === 'done' && result && (
        <div className={`mt-4 text-center py-2 rounded-xl font-bold ${
          result.resultType === 'WIN'
            ? 'bg-green-100 text-green-600 dark:text-green-400'
            : result.resultType === 'LOSE'
            ? 'bg-red-100 text-red-600 dark:text-red-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>
          {result.resultType === 'WIN' ? '🎉 你赢了!' : result.resultType === 'LOSE' ? '😢 你输了' : '🤝 平局'}
        </div>
      )}
    </div>
  );
};

export default DiceRoll;
