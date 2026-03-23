import React, { useState, useEffect, useRef } from 'react';

interface DiceResult {
  systemRolls: number[];
  userRolls: number[];
  systemTotal: number;
  userTotal: number;
  resultType: 'WIN' | 'LOSE' | 'TIE';
}

interface PhysicsDiceProps {
  isRolling: boolean;
  diceCount?: number;
  result?: DiceResult;
  onRollComplete?: () => void;
}

// Dice face dot positions (percentage based)
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
};

interface DiceProps {
  value: number;
  isRolling: boolean;
  color: 'rose' | 'violet';
  style?: React.CSSProperties;
  size?: number;
}

const Dice: React.FC<DiceProps> = ({ value, isRolling, color, style, size = 80 }) => {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  const dotSize = size * 0.15;

  const bgGradient = color === 'rose'
    ? 'linear-gradient(135deg, #fda4af 0%, #fb7185 50%, #e11d48 100%)'
    : 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #7c3aed 100%)';

  const borderColor = color === 'rose' ? '#be123c' : '#5b21b6';
  const shadowColor = color === 'rose' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(139, 92, 246, 0.4)';

  return (
    <div
      className={`relative rounded-2xl ${isRolling ? 'animate-bounce' : ''}`}
      style={{
        width: size,
        height: size,
        background: bgGradient,
        border: `3px solid ${borderColor}`,
        boxShadow: `0 8px 24px ${shadowColor}, inset 0 2px 4px rgba(255,255,255,0.3)`,
        ...style
      }}
    >
      {/* Dots */}
      {dots.map(([x, y], i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white dark:bg-slate-800"
          style={{
            width: dotSize,
            height: dotSize,
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)'
          }}
        />
      ))}

      {/* Shine effect */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)',
        }}
      />
    </div>
  );
};

export const PhysicsDice: React.FC<PhysicsDiceProps> = ({
  isRolling,
  result,
  onRollComplete
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [systemValue, setSystemValue] = useState(1);
  const [userValue, setUserValue] = useState(1);
  const [systemDiceStyle, setSystemDiceStyle] = useState<React.CSSProperties>({});
  const [userDiceStyle, setUserDiceStyle] = useState<React.CSSProperties>({});
  const [showResult, setShowResult] = useState(false);
  const hasStartedRef = useRef(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rolling animation - both dice at the same time
  useEffect(() => {
    if (!isRolling) {
      hasStartedRef.current = false;
      return;
    }

    if (hasStartedRef.current || !result) {
      return;
    }

    hasStartedRef.current = true;
    setIsAnimating(true);
    setShowResult(false);

    // Clear any existing timeouts/intervals
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
    }

    // Both dice rolling animation simultaneously
    let rollCount = 0;
    const maxRolls = 25;

    rollIntervalRef.current = setInterval(() => {
      if (rollCount < maxRolls) {
        // Random values while rolling
        setSystemValue(Math.floor(Math.random() * 6) + 1);
        setUserValue(Math.floor(Math.random() * 6) + 1);

        // Random position for throwing effect
        setSystemDiceStyle({
          transform: `translate(${Math.random() * 16 - 8}px, ${Math.random() * 16 - 8}px) rotate(${Math.random() * 20 - 10}deg)`,
          transition: 'transform 0.06s ease-out'
        });
        setUserDiceStyle({
          transform: `translate(${Math.random() * 16 - 8}px, ${Math.random() * 16 - 8}px) rotate(${Math.random() * 20 - 10}deg)`,
          transition: 'transform 0.06s ease-out'
        });

        rollCount++;
      } else {
        // Animation complete - show final values
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
        }

        setSystemValue(result.systemRolls[0] || 1);
        setUserValue(result.userRolls[0] || 1);
        setSystemDiceStyle({
          transform: 'translate(0, 0) rotate(0deg)',
          transition: 'transform 0.3s ease-out'
        });
        setUserDiceStyle({
          transform: 'translate(0, 0) rotate(0deg)',
          transition: 'transform 0.3s ease-out'
        });

        // Show result after dice settle
        animationTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
          setShowResult(true);
          onRollComplete?.();
        }, 400);
      }
    }, 70);

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, [isRolling, result, onRollComplete]);

  return (
    <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-6 relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #64748b 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Dice container */}
      <div className="relative flex justify-center items-center gap-8 py-4">
        {/* System Dice */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-3 py-1 rounded-full">
            系统
          </span>
          <div className="relative">
            <Dice
              value={systemValue}
              isRolling={isAnimating}
              color="rose"
              style={systemDiceStyle}
              size={80}
            />
          </div>
          {showResult && (
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result?.systemTotal || systemValue}</span>
          )}
        </div>

        {/* VS */}
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-slate-300">VS</span>
        </div>

        {/* User Dice */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-3 py-1 rounded-full">
            你
          </span>
          <div className="relative">
            <Dice
              value={userValue}
              isRolling={isAnimating}
              color="violet"
              style={userDiceStyle}
              size={80}
            />
          </div>
          {showResult && (
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{result?.userTotal || userValue}</span>
          )}
        </div>
      </div>

      {/* Result indicator */}
      {showResult && result && (
        <div className={`mt-4 text-center py-3 rounded-xl font-bold text-lg ${
          result.resultType === 'WIN'
            ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400'
            : result.resultType === 'LOSE'
            ? 'bg-rose-100 text-rose-600 dark:text-rose-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>
          {result.resultType === 'WIN'
            ? '🎉 你赢了!'
            : result.resultType === 'LOSE'
            ? '😢 你输了'
            : '🤝 平局'}
        </div>
      )}

      {/* Rolling indicator */}
      {isAnimating && (
        <div className="mt-4 text-center text-slate-500 dark:text-slate-400 text-sm">
          🎲 投掷中...
        </div>
      )}
    </div>
  );
};

export default PhysicsDice;
