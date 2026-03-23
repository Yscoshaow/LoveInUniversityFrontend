import { useState } from 'react';
import { X, Trash2, Shuffle, BarChart2, GripVertical, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { PlaybackMode } from './TherapyBottomNav';

interface TherapyQueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Queue for channel A */
  queueA: string[];
  /** Queue for channel B */
  queueB: string[];
  /** Current playing waveform name for A */
  currentWaveformA: string | null;
  /** Current playing waveform name for B */
  currentWaveformB: string | null;
  /** Available waveforms to add */
  availableWaveforms: string[];
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: () => void;
  /** Seconds between waveform switches */
  switchInterval: number;
  onChangeSwitchInterval: (sec: number) => void;
  onRemoveFromQueueA: (index: number) => void;
  onRemoveFromQueueB: (index: number) => void;
  onClearQueueA: () => void;
  onClearQueueB: () => void;
  onAddToQueueA: (name: string) => void;
  onAddToQueueB: (name: string) => void;
}

const SWITCH_INTERVALS = [10, 15, 20, 30, 60, 120, 300];

export default function TherapyQueuePanel({
  isOpen,
  onClose,
  queueA,
  queueB,
  currentWaveformA,
  currentWaveformB,
  availableWaveforms,
  playbackMode,
  onTogglePlaybackMode,
  switchInterval,
  onChangeSwitchInterval,
  onRemoveFromQueueA,
  onRemoveFromQueueB,
  onClearQueueA,
  onClearQueueB,
  onAddToQueueA,
  onAddToQueueB,
}: TherapyQueuePanelProps) {
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const queue = activeTab === 'A' ? queueA : queueB;
  const currentWaveform = activeTab === 'A' ? currentWaveformA : currentWaveformB;
  const onRemove = activeTab === 'A' ? onRemoveFromQueueA : onRemoveFromQueueB;
  const onClear = activeTab === 'A' ? onClearQueueA : onClearQueueB;
  const onAdd = activeTab === 'A' ? onAddToQueueA : onAddToQueueB;

  const nextInterval = () => {
    const idx = SWITCH_INTERVALS.indexOf(switchInterval);
    onChangeSwitchInterval(SWITCH_INTERVALS[(idx + 1) % SWITCH_INTERVALS.length]);
  };

  const fmtInterval = (s: number) => s < 60 ? `${s}s` : `${s / 60}m`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50 max-h-[85vh] flex flex-col"
          >
            {/* 拖动条 */}
            <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-3 flex-shrink-0" />

            <div className="px-4 pb-4 overflow-y-auto flex-1">
              {/* A/B 通道切换 */}
              <div className="flex gap-3 mb-4">
                {(['A', 'B'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setActiveTab(ch)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === ch
                        ? 'bg-[#FFE28A] text-yellow-950'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {ch} 通道
                  </button>
                ))}
              </div>

              {/* 标题 + 计数 */}
              <div className="mb-3">
                <div className="inline-block relative">
                  <span className="text-lg font-medium text-zinc-100">
                    {activeTab}: 当前播放
                  </span>
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-4 text-xs text-zinc-400 bg-zinc-800 rounded-full w-5 h-5 flex items-center justify-center">
                      {queue.length}
                    </span>
                  )}
                  <div className="h-0.5 w-full bg-[#FFE28A] mt-1.5" />
                </div>
              </div>

              {/* 控制栏 */}
              <div className="flex justify-between items-center mb-4 py-2 border-b border-zinc-800/50">
                <div className="flex gap-2">
                  <button
                    onClick={onTogglePlaybackMode}
                    className="flex items-center gap-1.5 bg-zinc-800/80 text-zinc-300 px-3 py-1.5 rounded-full text-sm"
                  >
                    <Shuffle className="w-4 h-4" />
                    {playbackMode === 'random' ? '随机播放' : playbackMode === 'loop' ? '列表循环' : '单曲循环'}
                  </button>
                  <button
                    onClick={nextInterval}
                    className="bg-zinc-800/80 text-zinc-300 px-3 py-1.5 rounded-full text-sm"
                  >
                    切换: {fmtInterval(switchInterval)}
                  </button>
                </div>
                <button onClick={onClear} className="text-zinc-500 p-2 hover:text-red-400 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* 队列列表 */}
              {queue.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  列表为空，从下方添加波形
                </div>
              ) : (
                <div className="space-y-1 mb-4">
                  {queue.map((name, i) => (
                    <div
                      key={`${name}-${i}`}
                      className="flex items-center justify-between py-3 border-b border-zinc-800/30"
                    >
                      <div className="flex items-center gap-3">
                        {name === currentWaveform ? (
                          <BarChart2 className="w-5 h-5 text-[#FFE28A]" />
                        ) : (
                          <span className="w-5 h-5 flex items-center justify-center text-zinc-600 text-sm">{i + 1}</span>
                        )}
                        <span className={`text-base ${name === currentWaveform ? 'text-[#FFE28A]' : 'text-zinc-300'}`}>
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-600">
                        <button onClick={() => onRemove(i)} className="hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                        <GripVertical className="w-4 h-4 cursor-grab" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加波形 */}
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-500 flex items-center justify-center gap-2 hover:border-[#FFE28A]/50 hover:text-[#FFE28A] transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加波形
              </button>

              {showAddMenu && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {availableWaveforms
                    .filter(w => !queue.includes(w))
                    .map(name => (
                      <button
                        key={name}
                        onClick={() => { onAdd(name); setShowAddMenu(false); }}
                        className="py-2.5 px-2 bg-zinc-800 rounded-xl text-zinc-300 text-sm hover:bg-zinc-700 hover:text-[#FFE28A] transition-colors text-center"
                      >
                        {name}
                      </button>
                    ))}
                  {availableWaveforms.filter(w => !queue.includes(w)).length === 0 && (
                    <div className="col-span-3 text-center text-zinc-600 text-sm py-2">
                      所有波形已在列表中
                    </div>
                  )}
                </div>
              )}

              <div className="h-20" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
