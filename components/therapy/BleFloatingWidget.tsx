import React, { useState, useEffect, useRef } from 'react';
import { Bluetooth, Battery, ChevronUp, ChevronDown } from 'lucide-react';

interface BleFloatingWidgetProps {
  strengthA: number;
  strengthB: number;
  batteryLevel: number | null;
  isConnected: boolean;
  maxStrength?: number;
}

/**
 * BLE 蓝牙浮窗
 *
 * 固定在右上角，显示 A/B 通道当前强度值和电池电量。
 * 通过频繁 UI 更新保持 app 前台运行，避免被系统杀掉。
 */
export const BleFloatingWidget: React.FC<BleFloatingWidgetProps> = ({
  strengthA,
  strengthB,
  batteryLevel,
  isConnected,
  maxStrength = 200,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // 保活：每 500ms 触发一次微小更新
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(timer);
  }, []);

  if (!isConnected) return null;

  const batteryColor = batteryLevel === null
    ? 'text-slate-400'
    : batteryLevel > 60
      ? 'text-green-400'
      : batteryLevel > 20
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="fixed top-16 right-3 z-40">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl shadow-lg overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Bluetooth size={12} className="text-blue-400" />
          <span className="text-slate-300 font-medium">BLE</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          {batteryLevel !== null && (
            <span className={`ml-auto ${batteryColor} flex items-center gap-0.5`}>
              <Battery size={10} />
              <span>{batteryLevel}%</span>
            </span>
          )}
          {collapsed ? <ChevronDown size={10} className="text-slate-500 ml-1" /> : <ChevronUp size={10} className="text-slate-500 ml-1" />}
        </button>

        {/* Expanded content */}
        {!collapsed && (
          <div className="px-3 pb-2 space-y-1">
            {/* Channel A */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-400 font-bold w-3">A</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(100, (strengthA / maxStrength) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-300 font-mono w-6 text-right">{strengthA}</span>
            </div>
            {/* Channel B */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-400 font-bold w-3">B</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(100, (strengthB / maxStrength) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-300 font-mono w-6 text-right">{strengthB}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
