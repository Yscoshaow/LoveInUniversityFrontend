import React from 'react';
import { X, Minus, Plus } from 'lucide-react';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
  unit?: string;
}

/**
 * 强度微调弹窗
 * 参考 nexus-control-deck 的 AdjustmentModal 设计
 */
const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  label,
  value,
  min,
  max,
  onChange,
  color = '#8b5cf6',
  unit = '',
}) => {
  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
            {label}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {/* 主体 */}
        <div className="p-6 space-y-6">
          {/* 当前值显示 */}
          <div className="text-center">
            <div
              className="text-5xl font-bold mb-1"
              style={{ color }}
            >
              {value}
              <span className="text-xl text-slate-400 dark:text-slate-500 ml-1">{unit}</span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              {min} - {max}
            </div>
          </div>

          {/* 进度条 */}
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{ width: `${percentage}%`, backgroundColor: color }}
            />
          </div>

          {/* 控制按钮 */}
          <div className="grid grid-cols-4 gap-2">
            {/* -5 */}
            <button
              onClick={() => handleAdjust(-5)}
              disabled={value <= min}
              className="py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300 font-bold"
            >
              -5
            </button>
            {/* -1 */}
            <button
              onClick={() => handleAdjust(-1)}
              disabled={value <= min}
              className="py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus size={18} className="mx-auto text-slate-600 dark:text-slate-300" />
            </button>
            {/* +1 */}
            <button
              onClick={() => handleAdjust(1)}
              disabled={value >= max}
              className="py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: color }}
            >
              <Plus size={18} className="mx-auto text-white" />
            </button>
            {/* +5 */}
            <button
              onClick={() => handleAdjust(5)}
              disabled={value >= max}
              className="py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold"
              style={{ backgroundColor: color }}
            >
              +5
            </button>
          </div>

          {/* 快捷百分比 */}
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 25, 50, 75, 100].map((pct) => {
              const targetValue = Math.round(min + ((max - min) * pct) / 100);
              const isActive = value === targetValue;
              return (
                <button
                  key={pct}
                  onClick={() => onChange(targetValue)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  style={isActive ? { backgroundColor: color } : undefined}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
        </div>

        {/* 底部归零按钮 */}
        <div className="p-4 pt-0">
          <button
            onClick={() => onChange(0)}
            className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 font-medium text-sm active:scale-[0.98] transition-all"
          >
            归零
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentModal;
