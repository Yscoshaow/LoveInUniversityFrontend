import { X, SlidersHorizontal, Shield, TrendingUp, RefreshCw, Clock, Shuffle, Flame, Activity, Download, MonitorOff, HelpCircle, ShieldAlert, Gauge, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TherapyMoreSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName: string;
  shareCode: string;
  onOpenTimer: () => void;
  onDisconnect: () => void;
  /** Sync output between A/B channels */
  syncOutput: boolean;
  onToggleSyncOutput: () => void;
  /** Block output (emergency silence) */
  outputBlocked: boolean;
  onToggleBlockOutput: () => void;
  /** 软启动：开启后播放时逐步升强度 */
  softStart: boolean;
  onOpenSoftStartConfig: () => void;
  /** 强度自适应：自动定时增加强度 */
  adaptiveMode: boolean;
  onOpenAdaptiveConfig: () => void;
  /** 随机挑逗：随机强度脉冲 */
  randomTeaseActive: boolean;
  onOpenTeaseConfig: () => void;
  /** 一键开火：打开配置面板（按住增加强度） */
  onOpenFireConfig: () => void;
  /** 打开强度上限设置面板 */
  onOpenStrengthLimit: () => void;
  /** 打开输出模式设置面板 */
  onOpenOutputMode: () => void;
}

interface SettingItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}

export default function TherapyMoreSettings({
  isOpen,
  onClose,
  deviceName,
  shareCode,
  onOpenTimer,
  onDisconnect,
  syncOutput,
  onToggleSyncOutput,
  outputBlocked,
  onToggleBlockOutput,
  softStart,
  onOpenSoftStartConfig,
  adaptiveMode,
  onOpenAdaptiveConfig,
  randomTeaseActive,
  onOpenTeaseConfig,
  onOpenFireConfig,
  onOpenStrengthLimit,
  onOpenOutputMode,
}: TherapyMoreSettingsProps) {
  const outputSettings: SettingItem[] = [
    {
      icon: <SlidersHorizontal className="w-5 h-5" />,
      label: '输出模式',
      onClick: onOpenOutputMode,
    },
    {
      icon: <Shield className="w-5 h-5" />,
      label: '强度上限',
      onClick: onOpenStrengthLimit,
    },
    {
      icon: <TrendingUp className={`w-5 h-5 ${softStart ? 'text-[#FFE28A]' : ''}`} />,
      label: softStart ? '软启动已开' : '软启动',
      onClick: onOpenSoftStartConfig,
      active: softStart,
    },
    {
      icon: <RefreshCw className={`w-5 h-5 ${syncOutput ? 'text-[#FFE28A]' : ''}`} />,
      label: syncOutput ? 'AB 已同步' : '输出同步',
      onClick: onToggleSyncOutput,
      active: syncOutput,
    },
    {
      icon: <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${adaptiveMode ? 'border-[#FFE28A]' : 'border-current'}`}>A</div>,
      label: adaptiveMode ? '自适应中' : '强度自适应',
      onClick: onOpenAdaptiveConfig,
      active: adaptiveMode,
    },
    {
      icon: <MonitorOff className={`w-5 h-5 ${outputBlocked ? 'text-red-400' : ''}`} />,
      label: outputBlocked ? '已屏蔽输出' : '屏蔽输出',
      onClick: onToggleBlockOutput,
      active: outputBlocked,
      danger: outputBlocked,
    },
  ];

  const gameplaySettings: SettingItem[] = [
    {
      icon: <Clock className="w-5 h-5" />,
      label: '定时启停',
      onClick: () => { onClose(); onOpenTimer(); },
    },
    {
      icon: <Shuffle className={`w-5 h-5 ${randomTeaseActive ? 'text-[#FFE28A]' : ''}`} />,
      label: randomTeaseActive ? '挑逗中' : '随机挑逗',
      onClick: onOpenTeaseConfig,
      active: randomTeaseActive,
    },
    {
      icon: <Flame className="w-5 h-5 text-red-400" />,
      label: '一键开火',
      onClick: onOpenFireConfig,
    },
  ];

  const moreSettings: SettingItem[] = [
    { icon: <Activity className="w-5 h-5" />, label: '波形图像', onClick: () => {} },
    { icon: <Download className="w-5 h-5" />, label: '分享码', onClick: () => {} },
    { icon: <Gauge className="w-5 h-5" />, label: '负载检测', onClick: () => {} },
    { icon: <HelpCircle className="w-5 h-5" />, label: '使用教程', onClick: () => {} },
    { icon: <ShieldAlert className="w-5 h-5" />, label: '安全须知', onClick: () => {} },
  ];

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-zinc-900 z-50 overflow-y-auto border-l border-zinc-800/50"
          >
            {/* 头部 */}
            <div className="flex justify-between items-center p-5 sticky top-0 bg-zinc-900 z-10 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 font-medium">{deviceName}</span>
                <span className="text-[#FFE28A] text-xs border border-[#FFE28A]/50 px-2 py-0.5 rounded-full font-mono">
                  {shareCode}
                </span>
              </div>
              <button onClick={onClose} className="text-zinc-400 p-2 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-7">
              <Section label="输出设置" items={outputSettings} />
              <Section label="玩法设置" items={gameplaySettings} />
              <Section label="更多功能" items={moreSettings} />

              <div className="pt-2 border-t border-zinc-800">
                <button
                  onClick={() => { onClose(); onDisconnect(); }}
                  className="w-full py-4 text-red-400 flex items-center justify-center gap-2 font-medium hover:bg-red-500/10 transition-colors rounded-xl"
                >
                  <Trash2 className="w-5 h-5" />
                  断开并删除会话
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ label, items }: { label: string; items: SettingItem[] }) {
  return (
    <div>
      <span className="text-zinc-500 text-sm mb-4 block">{label}</span>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`flex flex-col items-center gap-2 hover:text-[#FFE28A] transition-colors ${
              item.active ? 'text-[#FFE28A]' : item.danger ? 'text-red-400' : 'text-zinc-400'
            }`}
          >
            {item.icon}
            <span className="text-xs text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
