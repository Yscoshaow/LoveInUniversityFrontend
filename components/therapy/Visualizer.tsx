import React, { useEffect, useState, useRef } from 'react';

interface VisualizerProps {
  active: boolean;
  channelA?: number; // 0-100 强度百分比
  channelB?: number; // 0-100 强度百分比
  waveformName?: string;
  compact?: boolean;
}

/**
 * 信号可视化器
 * 显示当前波形的动态效果，参考 nexus-control-deck 设计
 */
const Visualizer: React.FC<VisualizerProps> = ({
  active,
  channelA = 0,
  channelB = 0,
  waveformName,
  compact = false,
}) => {
  const [bars, setBars] = useState<number[]>(Array(12).fill(15));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setBars(Array(12).fill(15));
      return;
    }

    // 活跃时生成随机动画
    const animate = () => {
      setBars((prev) =>
        prev.map((_, i) => {
          // 基于通道强度生成高度
          const baseHeight = Math.max(channelA, channelB) * 0.7 + 20;
          const variation = Math.random() * 30;
          return Math.min(100, Math.max(15, baseHeight + variation - 15));
        })
      );
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 100 + Math.random() * 100);
      });
    };

    animate();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, channelA, channelB]);

  if (compact) {
    return (
      <div className="flex items-end gap-0.5 h-8 px-2 justify-center">
        {bars.slice(0, 8).map((height, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-150 ${
              active ? 'bg-violet-400' : 'bg-slate-300'
            }`}
            style={{
              height: `${active ? height : 25}%`,
              opacity: active ? 0.6 + (height / 100) * 0.4 : 0.3,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-inner">
      {/* 波形名称显示 */}
      {waveformName && (
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Signal Monitor
          </span>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{waveformName}</span>
          </div>
        </div>
      )}

      {/* 可视化条形图 */}
      <div className="flex items-end gap-1.5 h-16 justify-center">
        {bars.map((height, i) => {
          // 前半为 A 通道颜色，后半为 B 通道颜色
          const isChannelA = i < bars.length / 2;
          const channelColor = active
            ? isChannelA
              ? 'bg-blue-400'
              : 'bg-pink-400'
            : 'bg-slate-300';

          return (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-150 ${channelColor}`}
              style={{
                height: `${active ? height : 20}%`,
                opacity: active ? 0.5 + (height / 100) * 0.5 : 0.25,
              }}
            />
          );
        })}
      </div>

      {/* 底部信息条 */}
      <div className="mt-3 flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
        <span
          className={`px-2 py-0.5 rounded ${
            active ? 'bg-blue-100 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700'
          }`}
        >
          A: {channelA}%
        </span>
        <span
          className={`px-2 py-0.5 rounded ${
            active ? 'bg-pink-100 text-pink-600 dark:text-pink-400' : 'bg-slate-100 dark:bg-slate-700'
          }`}
        >
          B: {channelB}%
        </span>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes pulse-bar {
          0% { height: 25%; opacity: 0.5; }
          100% { height: 90%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Visualizer;
