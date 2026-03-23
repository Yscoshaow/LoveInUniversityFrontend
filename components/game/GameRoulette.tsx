import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useGameSounds } from '../../hooks/useGameSounds';

interface GameRouletteProps {
  displayName: string;
  chamberPosition: number;
  onResult?: (died: boolean) => void;
  // 服务端结果（收到后展示）
  result?: { died: boolean; chamberFired: number; bulletWasAt: number } | null;
}

export default function GameRoulette({ displayName, chamberPosition, result }: GameRouletteProps) {
  const [step, setStep] = useState<'AIMING' | 'FIRING' | 'RESULT'>('AIMING');
  const { play } = useGameSounds();

  // 进入轮盘时播放装弹音效
  useEffect(() => {
    play('revolverReload', 0.7);
  }, [play]);

  useEffect(() => {
    if (!result) return;

    // 收到服务端结果后播放拉锤 → 开枪 → 结果
    play('revolverCock', 0.8);
    const timer1 = setTimeout(() => {
      setStep('FIRING');
      if (result.died) {
        play('gunshot', 0.8);
      } else {
        play('revolverClick', 0.7);
      }
      const timer2 = setTimeout(() => {
        setStep('RESULT');
      }, 1000);
      return () => clearTimeout(timer2);
    }, 2000);

    return () => clearTimeout(timer1);
  }, [result, play]);

  const died = result?.died ?? false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
    >
      <h2 className="text-3xl sm:text-4xl font-bold text-red-600 mb-6 uppercase tracking-widest text-center">
        俄罗斯轮盘
      </h2>

      <div className="text-xl sm:text-2xl text-stone-300 mb-10 text-center">
        {displayName} 扣下扳机...
      </div>

      {/* 弹膛 */}
      <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
        <motion.div
          animate={step === 'AIMING' ? { rotate: 360 } : { rotate: 0 }}
          transition={step === 'AIMING' ? { duration: 2, ease: 'linear', repeat: Infinity } : {}}
          className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border-8 border-stone-700 flex items-center justify-center relative"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`absolute w-8 h-8 sm:w-12 sm:h-12 rounded-full border-4 border-stone-800 ${
                i === chamberPosition && step !== 'AIMING' ? 'bg-red-900/50' : 'bg-stone-900'
              }`}
              style={{
                transform: `rotate(${i * 60}deg) translateY(-52px) sm:translateY(-64px)`,
              }}
            />
          ))}
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-stone-800" />
        </motion.div>

        {step === 'FIRING' && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [1, 2, 0], opacity: [1, 0, 0] }}
            transition={{ duration: 0.5 }}
            className={`absolute inset-0 rounded-full ${died ? 'bg-red-500' : 'bg-stone-400'}`}
            style={{ filter: 'blur(20px)' }}
          />
        )}
      </div>

      {step === 'RESULT' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`mt-10 text-4xl sm:text-5xl font-bold ${died ? 'text-red-500' : 'text-stone-400'}`}
        >
          {died ? '*砰！*' : '*咔嗒*'}
        </motion.div>
      )}

      {step === 'RESULT' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`mt-4 text-lg ${died ? 'text-red-400' : 'text-green-400'}`}
        >
          {died ? `${displayName} 被淘汰了！` : `${displayName} 幸存！`}
        </motion.p>
      )}
    </motion.div>
  );
}
