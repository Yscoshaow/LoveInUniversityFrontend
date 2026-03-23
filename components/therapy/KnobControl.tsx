import React, { useState, useEffect } from 'react';

interface KnobControlProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label?: string;
  color?: string;
  onCenterClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 圆形旋钮控制器
 * 基于 nexus-control-deck 的设计，带有 SVG 弧形进度可视化
 */
const KnobControl: React.FC<KnobControlProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  color = '#8b5cf6', // violet-500
  onCenterClick,
  disabled = false,
  size = 'md',
}) => {
  const [rotation, setRotation] = useState(-135);

  // 尺寸配置
  const sizeConfig = {
    sm: { container: 80, knob: 56, center: 32, indicator: 'w-1 h-2', text: 'text-[8px]', label: 'text-[8px]' },
    md: { container: 112, knob: 80, center: 48, indicator: 'w-1.5 h-3', text: 'text-[10px]', label: 'text-[10px]' },
    lg: { container: 144, knob: 104, center: 56, indicator: 'w-2 h-4', text: 'text-sm', label: 'text-xs' },
  };

  const config = sizeConfig[size];
  const svgSize = config.container;
  const center = svgSize / 2;
  const radius = (svgSize / 2) - 12;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270度弧

  useEffect(() => {
    const percentage = (value - min) / (max - min);
    const deg = -135 + percentage * 270;
    setRotation(deg);
  }, [value, min, max]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(parseInt(e.target.value));
    }
  };

  const percentage = (value - min) / (max - min);
  const activeDash = percentage * arcLength;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center"
        style={{ width: config.container, height: config.container }}
      >
        {/* SVG 弧形进度 */}
        <svg
          className="absolute w-full h-full pointer-events-none z-0"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{ transform: 'rotate(135deg)' }}
        >
          {/* 背景轨道 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e2e8f0" // slate-200
            strokeWidth="6"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* 活动值弧 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={disabled ? '#94a3b8' : color}
            strokeWidth="6"
            strokeDasharray={`${activeDash} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-75 ease-out"
          />
        </svg>

        {/* 旋钮主体 */}
        <div
          className={`rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center absolute z-10 border border-slate-100 dark:border-slate-700 transition-transform ${
            disabled ? 'opacity-60' : ''
          }`}
          style={{
            width: config.knob,
            height: config.knob,
            transform: `rotate(${rotation}deg)`,
            boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -2px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* 指示器标记 */}
          <div
            className={`absolute top-2 rounded-full ${config.indicator}`}
            style={{ backgroundColor: disabled ? '#94a3b8' : color }}
          />
          {/* 纹理线 */}
          <div className="absolute inset-0 rounded-full border border-slate-50 dark:border-slate-700 opacity-50" />
        </div>

        {/* 不可见的输入控件用于拖拽（touch-action: pan-y 允许移动端滚动） */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleInput}
          disabled={disabled}
          className={`absolute inset-0 w-full h-full opacity-0 z-20 ${
            disabled ? 'cursor-not-allowed' : 'cursor-ns-resize'
          }`}
          style={{ touchAction: 'pan-y' }}
          title={label}
        />

        {/* 中心按钮 */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              onCenterClick?.();
            }
          }}
          className={`absolute z-30 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center shadow-inner border transition-all ${
            disabled
              ? 'cursor-not-allowed border-transparent'
              : 'cursor-pointer border-transparent hover:border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95'
          }`}
          style={{ width: config.center, height: config.center }}
          title={disabled ? undefined : '点击微调'}
        >
          <span
            className={`font-bold select-none transition-colors ${config.text} ${
              disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {value}
          </span>
        </div>
      </div>

      {/* 标签 */}
      {label && (
        <button
          onClick={() => !disabled && onCenterClick?.()}
          disabled={disabled}
          className={`font-bold uppercase tracking-widest transition-colors ${config.label} ${
            disabled
              ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:text-violet-400 cursor-pointer'
          }`}
        >
          {label}
        </button>
      )}
    </div>
  );
};

export default KnobControl;
