import { useState, useEffect } from 'react';
import { X, Coins, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { TavernEntryType } from '../../types';

interface GameEntryFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entryType: TavernEntryType, lockId?: number) => void;
  campusPoints: number;
  activeLocks: Array<{ id: number; name: string }>;
}

export default function GameEntryFeeModal({
  isOpen,
  onClose,
  onConfirm,
  campusPoints,
  activeLocks,
}: GameEntryFeeModalProps) {
  const [selected, setSelected] = useState<TavernEntryType>('CAMPUS_POINTS');
  const [selectedLockId, setSelectedLockId] = useState<number | undefined>(activeLocks[0]?.id);

  // activeLocks 异步加载后更新默认选中的锁
  const firstLockId = activeLocks[0]?.id;
  useEffect(() => {
    if (firstLockId && !selectedLockId) {
      setSelectedLockId(firstLockId);
    }
  }, [firstLockId, selectedLockId]);

  const canPayPoints = campusPoints >= 1;
  const canPayLock = activeLocks.length > 0;

  const handleConfirm = () => {
    if (selected === 'CAMPUS_POINTS' && canPayPoints) {
      onConfirm('CAMPUS_POINTS');
    } else if (selected === 'LOCK_TIME' && canPayLock) {
      const lockId = selectedLockId ?? activeLocks[0]?.id;
      if (lockId) onConfirm('LOCK_TIME', lockId);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-200">选择入场费</h3>
              <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-stone-400">参与游戏需要支付入场费。胜利者可获得丰厚奖励！</p>

            <div className="space-y-2">
              {/* 校园点数 */}
              <button
                onClick={() => setSelected('CAMPUS_POINTS')}
                disabled={!canPayPoints}
                className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                  selected === 'CAMPUS_POINTS'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-stone-700 hover:border-stone-600'
                } ${!canPayPoints ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Coins className="text-amber-400" size={20} />
                <div className="text-left">
                  <p className="text-stone-200 font-medium">1 校园点数</p>
                  <p className="text-xs text-stone-500">当前余额: {campusPoints}</p>
                </div>
              </button>

              {/* 时间锁 */}
              <button
                onClick={() => canPayLock && setSelected('LOCK_TIME')}
                disabled={!canPayLock}
                className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                  selected === 'LOCK_TIME'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-stone-700 hover:border-stone-600'
                } ${!canPayLock ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Clock className="text-blue-400" size={20} />
                <div className="text-left">
                  <p className="text-stone-200 font-medium">+3h 时间锁</p>
                  <p className="text-xs text-stone-500">
                    {canPayLock ? `${activeLocks.length} 个可用锁` : '无激活的时间锁'}
                  </p>
                </div>
              </button>

              {selected === 'LOCK_TIME' && canPayLock && activeLocks.length > 1 && (
                <select
                  value={selectedLockId}
                  onChange={(e) => setSelectedLockId(Number(e.target.value))}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200"
                >
                  {activeLocks.map((lock) => (
                    <option key={lock.id} value={lock.id}>
                      {lock.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-stone-800/50 rounded-lg p-3 text-xs text-stone-500 space-y-1">
              <p>🏆 胜利者奖励: +3 校园点</p>
              <p>🔓 若用锁时间入场，胜利后退还 3h</p>
              <p>💀 失败者仅扣除入场费，无额外惩罚</p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={(selected === 'CAMPUS_POINTS' && !canPayPoints) || (selected === 'LOCK_TIME' && !canPayLock)}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold rounded-lg transition-colors"
            >
              确认入场
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
