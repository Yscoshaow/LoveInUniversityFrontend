import { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ChannelTimerSettings {
  delayStart: { enabled: boolean; seconds: number };
  randomInterval: {
    enabled: boolean;
    minOutputSec: number;
    maxOutputSec: number;
    minPauseSec: number;
    maxPauseSec: number;
  };
  stopAfter: { enabled: boolean; seconds: number };
}

export const defaultChannelTimer: ChannelTimerSettings = {
  delayStart: { enabled: false, seconds: 60 },
  randomInterval: {
    enabled: false,
    minOutputSec: 10,
    maxOutputSec: 30,
    minPauseSec: 10,
    maxPauseSec: 30,
  },
  stopAfter: { enabled: false, seconds: 300 },
};

// ── 时间格式化 ──────────────────────────────────────────────
function fmtSec(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`;
  return `${(sec / 3600).toFixed(1)} 小时`;
}

// 非线性时间映射 0-100 → 1s-86400s (24h)
function sliderToSec(v: number): number {
  if (v <= 20) return Math.round(1 + (v / 20) * 59);       // 1s – 60s
  if (v <= 50) return Math.round(60 + ((v - 20) / 30) * 540); // 1m – 10m
  if (v <= 80) return Math.round(600 + ((v - 50) / 30) * 3000); // 10m – 60m
  return Math.round(3600 + ((v - 80) / 20) * 82800);       // 1h – 24h
}
function secToSlider(s: number): number {
  if (s <= 60) return (s - 1) / 59 * 20;
  if (s <= 600) return 20 + (s - 60) / 540 * 30;
  if (s <= 3600) return 50 + (s - 600) / 3000 * 30;
  return 80 + (s - 3600) / 82800 * 20;
}

// ── 开关组件 ──────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-[#FFE28A]' : 'bg-zinc-700'}`}
    >
      <span className={`absolute w-4 h-4 rounded-full top-1 transition-transform ${
        value ? 'bg-yellow-950 translate-x-7' : 'bg-zinc-400 translate-x-1'
      }`} />
    </button>
  );
}

// ── 滑杆组件 ──────────────────────────────────────────────
function TimeSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 86400,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const sliderVal = secToSlider(value);
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-zinc-300 text-sm">{label}: <span className="text-[#FFE28A]">{fmtSec(value)}</span></span>
      </div>
      <div className="relative h-2 bg-zinc-800 rounded-full mb-1">
        <div
          className="absolute left-0 h-full bg-[#FFE28A] rounded-full"
          style={{ width: `${sliderVal}%` }}
        />
        <input
          type="range" min="0" max="100" step="1"
          value={sliderVal}
          onChange={e => {
            const s = sliderToSec(Number(e.target.value));
            onChange(Math.max(min, Math.min(max, s)));
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
          style={{ left: `${sliderVal}%` }}
        />
      </div>
    </div>
  );
}

// ── 双端滑杆组件 ──────────────────────────────────────────────
function RangeSlider({
  label,
  minVal,
  maxVal,
  onChangeMin,
  onChangeMax,
}: {
  label: string;
  minVal: number;
  maxVal: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  const minSlider = secToSlider(minVal);
  const maxSlider = secToSlider(maxVal);
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-zinc-300 text-sm">{label}:
          <span className="text-[#FFE28A]"> {fmtSec(minVal)} - {fmtSec(maxVal)}</span>
        </span>
        <span className="text-[#FFE28A] text-xs border border-[#FFE28A]/50 rounded-full px-2 py-0.5">随机时间</span>
      </div>
      <div className="relative h-2 bg-zinc-800 rounded-full mb-1">
        <div
          className="absolute h-full bg-[#FFE28A]/40 rounded-full"
          style={{ left: `${minSlider}%`, right: `${100 - maxSlider}%` }}
        />
        {/* Min handle */}
        <input
          type="range" min="0" max="100" step="1"
          value={minSlider}
          onChange={e => {
            const s = sliderToSec(Number(e.target.value));
            onChangeMin(Math.min(s, maxVal - 1));
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
          style={{ left: `${minSlider}%` }}
        />
        {/* Max handle */}
        <input
          type="range" min="0" max="100" step="1"
          value={maxSlider}
          onChange={e => {
            const s = sliderToSec(Number(e.target.value));
            onChangeMax(Math.max(s, minVal + 1));
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 1 }}
        />
        <div
          className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -mr-2 pointer-events-none"
          style={{ left: `${maxSlider}%` }}
        />
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────
interface TherapyTimerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  timerA: ChannelTimerSettings;
  timerB: ChannelTimerSettings;
  onChangeTimerA: (t: ChannelTimerSettings) => void;
  onChangeTimerB: (t: ChannelTimerSettings) => void;
}

export default function TherapyTimerPanel({
  isOpen,
  onClose,
  timerA,
  timerB,
  onChangeTimerA,
  onChangeTimerB,
}: TherapyTimerPanelProps) {
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const timer = activeTab === 'A' ? timerA : timerB;
  const setTimer = activeTab === 'A' ? onChangeTimerA : onChangeTimerB;

  const upd = (patch: Partial<ChannelTimerSettings>) =>
    setTimer({ ...timer, ...patch });

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
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50 max-h-[88vh] overflow-y-auto"
          >
            {/* 拖动条 */}
            <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />

            <div className="px-4 pb-6">
              {/* 标题 */}
              <div className="flex justify-between items-center mb-5">
                <span className="text-xl font-medium text-zinc-100">定时启停</span>
                <button onClick={onClose} className="text-zinc-400 p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* A/B 通道切换 */}
              <div className="flex gap-4 mb-5 border-b border-zinc-800">
                {(['A', 'B'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setActiveTab(ch)}
                    className={`flex-1 pb-3 font-medium transition-colors ${
                      activeTab === ch
                        ? 'text-[#FFE28A] border-b-2 border-[#FFE28A]'
                        : 'text-zinc-500'
                    }`}
                  >
                    {ch} 通道
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {/* ── 延时开始输出 ── */}
                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-medium">延时开始输出</span>
                      <HelpCircle className="w-4 h-4 text-zinc-600" />
                    </div>
                    <Toggle
                      value={timer.delayStart.enabled}
                      onChange={v => upd({ delayStart: { ...timer.delayStart, enabled: v } })}
                    />
                  </div>
                  {timer.delayStart.enabled && (
                    <TimeSlider
                      label="延时时间"
                      value={timer.delayStart.seconds}
                      onChange={v => upd({ delayStart: { ...timer.delayStart, seconds: v } })}
                    />
                  )}
                </div>

                {/* ── 随机间隔输出 ── */}
                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-medium">随机间隔输出</span>
                      <HelpCircle className="w-4 h-4 text-zinc-600" />
                    </div>
                    <Toggle
                      value={timer.randomInterval.enabled}
                      onChange={v =>
                        upd({ randomInterval: { ...timer.randomInterval, enabled: v } })
                      }
                    />
                  </div>
                  {timer.randomInterval.enabled && (
                    <div className="space-y-4">
                      <RangeSlider
                        label="输出时长"
                        minVal={timer.randomInterval.minOutputSec}
                        maxVal={timer.randomInterval.maxOutputSec}
                        onChangeMin={v => upd({ randomInterval: { ...timer.randomInterval, minOutputSec: v } })}
                        onChangeMax={v => upd({ randomInterval: { ...timer.randomInterval, maxOutputSec: v } })}
                      />
                      <RangeSlider
                        label="暂停时长"
                        minVal={timer.randomInterval.minPauseSec}
                        maxVal={timer.randomInterval.maxPauseSec}
                        onChangeMin={v => upd({ randomInterval: { ...timer.randomInterval, minPauseSec: v } })}
                        onChangeMax={v => upd({ randomInterval: { ...timer.randomInterval, maxPauseSec: v } })}
                      />
                    </div>
                  )}
                </div>

                {/* ── 停止输出 ── */}
                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-medium">停止输出</span>
                      <HelpCircle className="w-4 h-4 text-zinc-600" />
                    </div>
                    <Toggle
                      value={timer.stopAfter.enabled}
                      onChange={v => upd({ stopAfter: { ...timer.stopAfter, enabled: v } })}
                    />
                  </div>
                  {timer.stopAfter.enabled && (
                    <TimeSlider
                      label="停止时间"
                      value={timer.stopAfter.seconds}
                      onChange={v => upd({ stopAfter: { ...timer.stopAfter, seconds: v } })}
                    />
                  )}
                </div>
              </div>

              <div className="h-20" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
