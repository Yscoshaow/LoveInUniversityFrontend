/**
 * InlineTherapyController
 *
 * 通过深度链接 therapy_<shareCode> 进入的控制者界面。
 * 复用完整的 TherapyControlPanel UI，支持随机挑逗/一键开火/波形队列等所有功能。
 *
 * 渲染分支：
 *  loading   → 全屏加载中
 *  error     → 错误卡片
 *  waiting   → 排队等待视图
 *  controlling → TherapyControlPanel 控制面板 + 顶部倒计时横幅
 *  ended     → 控制结束视图
 */

import { useState, useCallback } from 'react';
import { Loader2, Gamepad2, Users, Clock, X } from 'lucide-react';
import { useTherapyController } from '../../hooks/useTherapyController';
import type { SmartStrengthSettings } from '../../contexts/TherapyContext';
import TherapyControlPanel from './TherapyControlPanel';
import WaveformEditor from '../music/WaveformEditor';

// ── 获取当前 Telegram 用户信息 ──────────────────────────────────
function getTelegramUser(): { id: number; first_name: string } | null {
  // @ts-ignore
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

const defaultSmartStrengthSettings: SmartStrengthSettings = {
  randomJump: { enabled: false, minStrength: 10, maxStrength: 50, intervalSeconds: 5 },
  autoIncrease: { enabled: false, incrementAmount: 1, intervalSeconds: 10 },
  bFollowA: { enabled: false, offset: 0 },
  randomInterval: { enabled: false, workMinSeconds: 5, workMaxSeconds: 15, pauseMinSeconds: 3, pauseMaxSeconds: 10 },
};

interface InlineTherapyControllerProps {
  shareCode: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export default function InlineTherapyController({ shareCode }: InlineTherapyControllerProps) {
  const user = getTelegramUser();
  const myName = user?.first_name ?? '控制者';
  const myIdentity = user ? `TELEGRAM:${user.id}` : `ANON:${Math.random().toString(36).slice(2)}`;

  const controller = useTherapyController({ shareCode, myName, myIdentity });

  // ── 本地输出模式状态（仅控制者自己，不影响设备主人的面板） ──
  const [outputMode, setOutputMode] = useState<'standard' | 'gentle'>('standard');
  const [freqBalanceA, setFreqBalanceA] = useState(160);
  const [freqBalanceB, setFreqBalanceB] = useState(160);
  const [intensityBalanceA, setIntensityBalanceA] = useState(128);
  const [intensityBalanceB, setIntensityBalanceB] = useState(128);
  const [smartStrengthSettings, setSmartStrengthSettings] = useState<SmartStrengthSettings>(defaultSmartStrengthSettings);
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);

  const handleStrengthChange = useCallback((channel: 'A' | 'B', value: number) => {
    // 轻柔模式：实际发送强度乘以 0.7
    const effectiveValue = outputMode === 'gentle' ? Math.round(value * 0.7) : value;
    controller.setStrength(channel, effectiveValue);
  }, [outputMode, controller]);

  const handleUpdateSmartStrength = useCallback((settings: Partial<SmartStrengthSettings>) => {
    setSmartStrengthSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const handleClose = useCallback(() => {
    controller.leaveQueue();
    // @ts-ignore
    window.Telegram?.WebApp?.close?.();
  }, [controller]);

  // ── loading ────────────────────────────────────────────────────
  if (controller.phase === 'loading') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFE28A] animate-spin" />
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────────
  if (controller.phase === 'error') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full text-center border border-zinc-800">
          <div className="text-4xl mb-3">😕</div>
          <p className="text-zinc-100 font-medium mb-1">无法连接</p>
          <p className="text-zinc-400 text-sm mb-6">{controller.error ?? '会话不存在或已关闭'}</p>
          <button
            onClick={handleClose}
            className="w-full py-3 bg-zinc-800 rounded-xl text-zinc-300 text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // ── ended ──────────────────────────────────────────────────────
  if (controller.phase === 'ended') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full text-center border border-zinc-800">
          <div className="text-4xl mb-3">🎮</div>
          <p className="text-zinc-100 font-medium mb-1">控制已结束</p>
          <p className="text-zinc-400 text-sm mb-6">感谢你的参与！</p>
          <button
            onClick={handleClose}
            className="w-full py-3 bg-zinc-800 rounded-xl text-zinc-300 text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // ── waiting ────────────────────────────────────────────────────
  if (controller.phase === 'waiting') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-800">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-5">
            <Gamepad2 className="w-5 h-5 text-[#FFE28A]" />
            <span className="text-zinc-100 font-semibold">等待控制</span>
            <span className="ml-auto text-xs text-zinc-500 font-mono">{shareCode}</span>
          </div>

          {/* 排队信息 */}
          <div className="bg-zinc-800/60 rounded-xl p-4 mb-4 text-center">
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-[#FFE28A]">
                  {controller.queuePosition ?? '—'}
                </span>
                <span className="text-xs text-zinc-500 mt-0.5">你的位置</span>
              </div>
              <div className="w-px h-8 bg-zinc-700" />
              <div className="flex flex-col items-center">
                <Users className="w-5 h-5 text-zinc-400 mb-0.5" />
                <span className="text-xs text-zinc-500">{controller.queueLength} 人排队</span>
              </div>
            </div>

            {/* 转圈动画 */}
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin mx-auto mb-3" />

            {/* 预计等待时间 */}
            {controller.estimatedWaitSeconds > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>预计等待：约 {formatTime(controller.estimatedWaitSeconds)}</span>
              </div>
            )}
          </div>

          {/* 当前波形 */}
          {(controller.currentWaveformA || controller.currentWaveformB) && (
            <div className="text-center text-xs text-zinc-500 mb-4">
              当前播放：{controller.currentWaveformA ?? '—'} / {controller.currentWaveformB ?? '—'}
            </div>
          )}

          {/* 退出按钮 */}
          <button
            onClick={handleClose}
            className="w-full py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            退出排队
          </button>
        </div>
      </div>
    );
  }

  // ── controlling ────────────────────────────────────────────────
  const sessionStatus = controller.sessionStatus;

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col">
      {/* 倒计时横幅 */}
      <div className="flex-shrink-0 px-4 py-2 bg-zinc-900 border-b border-zinc-800/50 flex items-center gap-3">
        <Gamepad2 className="w-4 h-4 text-[#FFE28A] flex-shrink-0" />
        <span className="text-[#FFE28A] text-sm font-medium">正在控制中</span>
        <span className="text-zinc-400 text-sm ml-auto flex-shrink-0">
          剩余 {formatTime(controller.controlTimeLeft)}
        </span>
        {/* 进度条 */}
        <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden min-w-0 max-w-[80px]">
          <div
            className="h-full bg-[#FFE28A] rounded-full transition-all duration-1000"
            style={{
              width: controller.controlDuration > 0
                ? `${(controller.controlTimeLeft / controller.controlDuration) * 100}%`
                : '0%',
            }}
          />
        </div>
      </div>

      {/* 控制面板 */}
      <div className="flex-1 overflow-hidden">
        <TherapyControlPanel
          session={{
            shareCode,
            strengthLimitA: sessionStatus?.strengthLimitA ?? 200,
            strengthLimitB: sessionStatus?.strengthLimitB ?? 200,
            queueLength: 0,
          }}
          strengthA={controller.strengthA}
          strengthB={controller.strengthB}
          onStrengthChange={handleStrengthChange}
          waveforms={controller.waveforms}
          currentWaveformA={controller.currentWaveformA}
          currentWaveformB={controller.currentWaveformB}
          onChangeWaveform={controller.changeWaveform}
          deviceConnected={true}
          onDisconnect={controller.leaveQueue}
          onBack={controller.leaveQueue}
          onOpenWaveformEditor={() => setShowWaveformEditor(true)}
          smartStrengthSettings={smartStrengthSettings}
          onUpdateSmartStrength={handleUpdateSmartStrength}
          devices={[]}
          activeDeviceId={null}
          onSelectDevice={() => {}}
          onAddDevice={() => {}}
          onRemoveDevice={() => {}}
          outputMode={outputMode}
          onOutputModeChange={setOutputMode}
          freqBalanceA={freqBalanceA}
          freqBalanceB={freqBalanceB}
          intensityBalanceA={intensityBalanceA}
          intensityBalanceB={intensityBalanceB}
          onFreqBalanceAChange={setFreqBalanceA}
          onFreqBalanceBChange={setFreqBalanceB}
          onIntensityBalanceAChange={setIntensityBalanceA}
          onIntensityBalanceBChange={setIntensityBalanceB}
        />
      </div>

      {/* 波形编辑器 */}
      {showWaveformEditor && (
        <WaveformEditor
          onBack={() => setShowWaveformEditor(false)}
          onSelectWaveform={(waveform) => {
            controller.changeWaveform(waveform.name, 'A');
            controller.changeWaveform(waveform.name, 'B');
            setShowWaveformEditor(false);
          }}
        />
      )}
    </div>
  );
}
