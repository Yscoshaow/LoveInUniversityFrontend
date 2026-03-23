import React, { useState, useEffect } from 'react';
import { therapyApi } from '../../lib/api';
import { platformClose } from '../../lib/platform-actions';

const getWaveformIcon = (name: string): string => {
  const iconMap: Record<string, string> = {
    '呼吸': '🌬️',
    '潮汐': '🌊',
    '心跳': '💓',
    '按压': '👆',
    '敲击': '🔨',
    '快速按压': '⚡',
    '雨点': '💧',
    '信号灯': '🚦',
    '挣扎': '😰',
    '颤抖': '😨',
    '节奏步伐': '👟',
    '变速': '🎚️',
    '波浪': '〰️',
    '上升': '📈',
    '脉冲': '💫',
    '电击': '⚡',
  };
  return iconMap[name] || '〰️';
};

interface WaveformPickerProps {
  shareCode: string;
}

export const WaveformPicker: React.FC<WaveformPickerProps> = ({ shareCode }) => {
  const [waveforms, setWaveforms] = useState<string[]>([]);
  const [currentWaveformA, setCurrentWaveformA] = useState<string>('');
  const [currentWaveformB, setCurrentWaveformB] = useState<string>('');
  const [channel, setChannel] = useState<'A' | 'B' | 'AB'>('AB');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    therapyApi.getWaveforms(shareCode)
      .then(data => {
        setWaveforms(data.waveforms);
        setCurrentWaveformA(data.currentWaveformA);
        setCurrentWaveformB(data.currentWaveformB);
        setLoading(false);
      })
      .catch(err => {
        const msg = err?.message || String(err);
        if (msg.includes('403') || msg.includes('Forbidden')) {
          setError('请先加入队列才能切换波形');
        } else if (msg.includes('404') || msg.includes('Not Found')) {
          setError('会话不存在或已关闭');
        } else {
          setError(msg);
        }
        setLoading(false);
      });
  }, [shareCode]);

  const handleSelect = async (name: string) => {
    if (selecting) return;
    setSelecting(name);
    try {
      await therapyApi.changeWaveform(shareCode, name, channel);
      // Update local state
      if (channel === 'A' || channel === 'AB') setCurrentWaveformA(name);
      if (channel === 'B' || channel === 'AB') setCurrentWaveformB(name);
      setSuccess(name);
      setTimeout(() => {
        platformClose();
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('403') || msg.includes('Forbidden')) {
        setError('请先加入队列才能切换波形');
      } else {
        setError(msg);
      }
      setSelecting(null);
    }
  };

  // Determine which waveform is "selected" based on current channel tab
  const getIsSelected = (name: string) => {
    if (channel === 'AB') return currentWaveformA === name && currentWaveformB === name;
    if (channel === 'A') return currentWaveformA === name;
    return currentWaveformB === name;
  };

  const selectedColor = channel === 'B'
    ? 'border-pink-400 bg-pink-50 dark:bg-pink-950 text-pink-700'
    : channel === 'A'
      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
      : 'border-violet-400 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400';

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-center py-4 border-b border-slate-100 dark:border-slate-700 gap-3">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">选择波形</h1>
        {/* A/B/AB channel tabs */}
        {!loading && !error && !success && (
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setChannel('AB')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                channel === 'AB'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              A+B
            </button>
            <button
              onClick={() => setChannel('A')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                channel === 'A'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              A通道
            </button>
            <button
              onClick={() => setChannel('B')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                channel === 'B'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              B通道
            </button>
          </div>
        )}
      </div>

      {/* Current waveform hint */}
      {!loading && !error && !success && currentWaveformA && currentWaveformB && (
        <div className="flex items-center justify-center gap-3 py-2 text-xs text-slate-400 dark:text-slate-500 border-b border-slate-50 dark:border-slate-700">
          <span className="text-blue-500 dark:text-blue-400">A: {currentWaveformA}</span>
          <span>|</span>
          <span className="text-pink-500 dark:text-pink-400">B: {currentWaveformB}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="text-4xl">😔</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{error}</p>
            <button
              onClick={() => platformClose()}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
            >
              关闭
            </button>
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="text-5xl animate-bounce">✅</div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {channel === 'AB' ? 'A+B' : channel}通道已切换为: <span className="text-violet-600 dark:text-violet-400">{success}</span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">正在关闭...</p>
          </div>
        )}

        {!loading && !error && !success && (
          <div className="grid grid-cols-4 gap-2">
            {waveforms.map((name) => {
              const isSelecting = selecting === name;
              const isSelected = getIsSelected(name);
              return (
                <button
                  key={name}
                  onClick={() => handleSelect(name)}
                  disabled={!!selecting}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-50 ${
                    isSelecting
                      ? `${selectedColor} shadow-sm`
                      : isSelected
                        ? `${selectedColor} shadow-sm`
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {isSelecting ? (
                    <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mb-1" />
                  ) : (
                    <span className="text-xl mb-1">{getWaveformIcon(name)}</span>
                  )}
                  <span className="text-[10px] font-medium truncate w-full text-center">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
