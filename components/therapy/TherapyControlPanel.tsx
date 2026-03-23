/**
 * TherapyControlPanel — 郊狼风格深色控制面板
 *
 * 替代原 ControlPanelView，功能：
 *  - 插槽式多设备切换 Header
 *  - 通道强度 +/- 控制卡
 *  - 波形选择卡（A / B / AB 通道切换）
 *  - BottomNav：播放模式 | 编辑器 | 开关 | 定时 | 列表
 *  - 定时启停面板（延时开始、随机间隔、停止输出）
 *  - 播放列表面板（队列管理、自动切换）
 *  - 更多设置侧边栏
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Settings,
  Activity,
  Minus,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Share2,
  X,
  HelpCircle,
  Gamepad2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { platformShare } from '../../lib/platform-actions';
import type { DeviceInfo, SmartStrengthSettings } from '../../contexts/TherapyContext';
import TherapyBottomNav, { type PlaybackMode } from './TherapyBottomNav';
import TherapyTimerPanel, { type ChannelTimerSettings, defaultChannelTimer } from './TherapyTimerPanel';
import TherapyQueuePanel from './TherapyQueuePanel';
import TherapyMoreSettings from './TherapyMoreSettings';
import { AdjustmentModal } from './index';

// ── 波形图标 ─────────────────────────────────────────────────
const WAVEFORM_ICONS: Record<string, string> = {
  '呼吸': '🌬️', '潮汐': '🌊', '心跳': '💓', '按压': '👆',
  '敲击': '🔨', '快速按压': '⚡', '雨点': '💧', '信号灯': '🚦',
  '挣扎': '😰', '颤抖': '😨', '节奏步伐': '👟', '变速': '🎚️',
  '波浪': '〰️', '上升': '📈', '脉冲': '💫', '电击': '⚡',
  '连击': '🔥', '按捏渐强': '📶', '心跳节奏': '🫀', '压缩': '🗜️',
};
const waveIcon = (name: string) => WAVEFORM_ICONS[name] ?? '〰️';

// ── 接口 ─────────────────────────────────────────────────────
interface TherapyControlPanelProps {
  session: {
    shareCode: string;
    strengthLimitA: number;
    strengthLimitB: number;
    queueLength: number;
    currentController?: { name: string };
  };
  strengthA: number;
  strengthB: number;
  onStrengthChange: (channel: 'A' | 'B', value: number) => void;
  onDisconnect: () => void;
  deviceConnected: boolean;
  controlTimeLeft?: number;
  waveforms: string[];
  currentWaveformA: string | null;
  currentWaveformB: string | null;
  onChangeWaveform: (name: string, channel?: 'A' | 'B') => void;
  smartStrengthSettings: SmartStrengthSettings;
  onUpdateSmartStrength: (settings: Partial<SmartStrengthSettings>) => void;
  onOpenWaveformEditor: () => void;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
  onRemoveDevice: (deviceId: string) => void;
  onBack: () => void;
  deviceName?: string;
  // 输出模式（受控，状态在 TherapyRoom 层）
  outputMode: 'standard' | 'gentle';
  onOutputModeChange: (mode: 'standard' | 'gentle') => void;
  freqBalanceA: number;
  freqBalanceB: number;
  intensityBalanceA: number;
  intensityBalanceB: number;
  onFreqBalanceAChange: (v: number) => void;
  onFreqBalanceBChange: (v: number) => void;
  onIntensityBalanceAChange: (v: number) => void;
  onIntensityBalanceBChange: (v: number) => void;
  onKickController?: () => void;
  // 本地 BLE 模式
  localMode?: boolean;
  onShare?: () => void;
  upgradingToOnline?: boolean;
}

// ── 强度增减步长 ─────────────────────────────────────────────
const STRENGTH_STEP = 5;

// ── 波形自动切换间隔选项 (秒) ─────────────────────────────────
const SWITCH_INTERVALS = [10, 15, 20, 30, 60, 120, 300];

export default function TherapyControlPanel({
  session,
  strengthA,
  strengthB,
  onStrengthChange,
  onDisconnect,
  deviceConnected,
  controlTimeLeft,
  waveforms,
  currentWaveformA,
  currentWaveformB,
  onChangeWaveform,
  smartStrengthSettings,
  onUpdateSmartStrength,
  onOpenWaveformEditor,
  devices,
  activeDeviceId,
  onSelectDevice,
  onAddDevice,
  onRemoveDevice,
  onBack,
  deviceName = '设备',
  outputMode,
  onOutputModeChange,
  freqBalanceA,
  freqBalanceB,
  intensityBalanceA,
  intensityBalanceB,
  onFreqBalanceAChange,
  onFreqBalanceBChange,
  onIntensityBalanceAChange,
  onIntensityBalanceBChange,
  onKickController,
  localMode = false,
  onShare,
  upgradingToOnline = false,
}: TherapyControlPanelProps) {
  const isBeingControlled = !!session.currentController;
  // ── 播放状态 ──────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(true);
  const savedStrengthA = useRef<number>(strengthA);
  const savedStrengthB = useRef<number>(strengthB);

  // ── AB 通道同步 ───────────────────────────────────────────
  const [syncChannels, setSyncChannels] = useState(false);

  // ── 播放模式 ──────────────────────────────────────────────
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('loop');
  const togglePlaybackMode = () => {
    setPlaybackMode(m => m === 'random' ? 'loop' : m === 'loop' ? 'single' : 'random');
  };

  // ── 波形通道选择 (A / B / AB) ─────────────────────────────
  const [waveChannel, setWaveChannel] = useState<'A' | 'B' | 'AB'>('A');

  // ── 面板显示状态 ──────────────────────────────────────────
  const [showTimer, setShowTimer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [editingKnob, setEditingKnob] = useState<'A' | 'B' | null>(null);

  // ── 分享复制 ──────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── 输出屏蔽 ──────────────────────────────────────────────
  const [outputBlocked, setOutputBlocked] = useState(false);

  // ── AB 输出同步（通过设置面板控制 syncChannels） ──────────
  const [syncOutput, setSyncOutput] = useState(false);

  // ── 定时器设置 ────────────────────────────────────────────
  const [timerA, setTimerA] = useState<ChannelTimerSettings>(defaultChannelTimer);
  const [timerB, setTimerB] = useState<ChannelTimerSettings>(defaultChannelTimer);

  // 定时器运行句柄
  const delayStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAfterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const randomIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerCountdown, setTimerCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 波形队列 ──────────────────────────────────────────────
  const [queueA, setQueueA] = useState<string[]>([]);
  const [queueB, setQueueB] = useState<string[]>([]);
  const [switchInterval, setSwitchInterval] = useState(30);
  const queueIndexA = useRef(0);
  const queueIndexB = useRef(0);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 强度上限（本地可调，覆盖会话初始值）──────────────────────
  const [localLimitA, setLocalLimitA] = useState(session.strengthLimitA);
  const [localLimitB, setLocalLimitB] = useState(session.strengthLimitB);
  const [showStrengthLimit, setShowStrengthLimit] = useState(false);
  const localLimitARef = useRef(session.strengthLimitA);
  const localLimitBRef = useRef(session.strengthLimitB);

  // ── 软启动 ────────────────────────────────────────────────
  const [softStart, setSoftStart] = useState(false);
  const [showSoftStartConfig, setShowSoftStartConfig] = useState(false);
  const [softStartSecs, setSoftStartSecs] = useState(3);  // 渐入时长（秒）
  const softStartSecsRef = useRef(3);
  const softStartRampRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 强度自适应 ────────────────────────────────────────────
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const [showAdaptiveConfig, setShowAdaptiveConfig] = useState(false);
  const [adaptiveIncrement, setAdaptiveIncrement] = useState(2);  // 每步加多少
  const [adaptiveIntervalSecs, setAdaptiveIntervalSecs] = useState(5);  // 间隔秒数
  const adaptiveIncrementRef = useRef(2);
  const adaptiveIntervalSecsRef = useRef(5);
  const adaptiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 随机挑逗 ──────────────────────────────────────────────
  const [randomTeaseActive, setRandomTeaseActive] = useState(false);
  const [showTeaseConfig, setShowTeaseConfig] = useState(false);
  const [teaseMinPct, setTeaseMinPct] = useState(30);  // 最低强度%（相对上限）
  const [teaseMaxPct, setTeaseMaxPct] = useState(80);  // 最高强度%
  const [teaseMinSecs, setTeaseMinSecs] = useState(2);  // 最短间隔秒
  const [teaseMaxSecs, setTeaseMaxSecs] = useState(8);  // 最长间隔秒
  const teaseMinPctRef = useRef(30);
  const teaseMaxPctRef = useRef(80);
  const teaseMinSecsRef = useRef(2);
  const teaseMaxSecsRef = useRef(8);
  const randomTeaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 实时强度 refs (供 timer 回调使用，避免闭包陈旧值) ────────
  const strengthARef = useRef(strengthA);
  const strengthBRef = useRef(strengthB);

  // 同步 refs
  useEffect(() => { strengthARef.current = strengthA; }, [strengthA]);
  useEffect(() => { strengthBRef.current = strengthB; }, [strengthB]);
  useEffect(() => { localLimitARef.current = localLimitA; }, [localLimitA]);
  useEffect(() => { localLimitBRef.current = localLimitB; }, [localLimitB]);
  useEffect(() => { softStartSecsRef.current = softStartSecs; }, [softStartSecs]);
  useEffect(() => { adaptiveIncrementRef.current = adaptiveIncrement; }, [adaptiveIncrement]);
  useEffect(() => { adaptiveIntervalSecsRef.current = adaptiveIntervalSecs; }, [adaptiveIntervalSecs]);
  useEffect(() => { teaseMinPctRef.current = teaseMinPct; }, [teaseMinPct]);
  useEffect(() => { teaseMaxPctRef.current = teaseMaxPct; }, [teaseMaxPct]);
  useEffect(() => { teaseMinSecsRef.current = teaseMinSecs; }, [teaseMinSecs]);
  useEffect(() => { teaseMaxSecsRef.current = teaseMaxSecs; }, [teaseMaxSecs]);

  // 卸载时清理额外定时器
  useEffect(() => {
    return () => {
      if (softStartRampRef.current) clearInterval(softStartRampRef.current);
      if (adaptiveTimerRef.current) clearInterval(adaptiveTimerRef.current);
      if (randomTeaseTimerRef.current) clearTimeout(randomTeaseTimerRef.current);
    };
  }, []);

  // ── 强度调节 ──────────────────────────────────────────────
  const changeStrength = useCallback((channel: 'A' | 'B', delta: number) => {
    if (!isPlaying || outputBlocked) return;
    const cur = channel === 'A' ? strengthA : strengthB;
    const lim = channel === 'A' ? localLimitA : localLimitB;
    const next = Math.max(0, Math.min(lim, cur + delta));
    onStrengthChange(channel, next);
    if (syncChannels || syncOutput) {
      const other = channel === 'A' ? 'B' : 'A';
      const otherLim = channel === 'A' ? localLimitB : localLimitA;
      onStrengthChange(other, Math.max(0, Math.min(otherLim, next)));
    }
  }, [isPlaying, outputBlocked, strengthA, strengthB, localLimitA, localLimitB, onStrengthChange, syncChannels, syncOutput]);

  // ── 播放 / 暂停 ───────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (delayStartTimerRef.current) clearTimeout(delayStartTimerRef.current);
    if (stopAfterTimerRef.current) clearTimeout(stopAfterTimerRef.current);
    if (randomIntervalRef.current) clearTimeout(randomIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setTimerCountdown(null);
  }, []);

  const doPlay = useCallback(() => {
    setIsPlaying(true);
    const targetA = savedStrengthA.current;
    const targetB = savedStrengthB.current;
    if (softStart && (targetA > 0 || targetB > 0)) {
      // 软启动：softStartSecs × 10步/秒 × 100ms/步
      if (softStartRampRef.current) clearInterval(softStartRampRef.current);
      let step = 0;
      const steps = Math.max(1, Math.round(softStartSecsRef.current * 10));
      softStartRampRef.current = setInterval(() => {
        step++;
        const ratio = step / steps;
        onStrengthChange('A', Math.round(targetA * ratio));
        onStrengthChange('B', Math.round(targetB * ratio));
        if (step >= steps) {
          clearInterval(softStartRampRef.current!);
          softStartRampRef.current = null;
          onStrengthChange('A', targetA);
          onStrengthChange('B', targetB);
        }
      }, 100);
    } else {
      onStrengthChange('A', targetA);
      onStrengthChange('B', targetB);
    }
  }, [onStrengthChange, softStart]);

  const doPause = useCallback(() => {
    setIsPlaying(false);
    // 用 ref 避免闭包陈旧值
    savedStrengthA.current = strengthARef.current;
    savedStrengthB.current = strengthBRef.current;
    onStrengthChange('A', 0);
    onStrengthChange('B', 0);
    // 停止自适应和随机挑逗
    if (adaptiveTimerRef.current) { clearInterval(adaptiveTimerRef.current); adaptiveTimerRef.current = null; }
    if (randomTeaseTimerRef.current) { clearTimeout(randomTeaseTimerRef.current); randomTeaseTimerRef.current = null; }
    setAdaptiveMode(false);
    setRandomTeaseActive(false);
  }, [onStrengthChange]);

  const handleTogglePlay = useCallback(() => {
    clearAllTimers();
    if (isPlaying) {
      doPause();
    } else {
      // 检查延时开始
      const delay = Math.max(timerA.delayStart.enabled ? timerA.delayStart.seconds : 0,
                             timerB.delayStart.enabled ? timerB.delayStart.seconds : 0);
      if (delay > 0) {
        setTimerCountdown(delay);
        countdownRef.current = setInterval(() => {
          setTimerCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownRef.current!);
              setTimerCountdown(null);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        delayStartTimerRef.current = setTimeout(() => {
          doPlay();
          scheduleStopAfterTimer();
          scheduleRandomInterval();
        }, delay * 1000);
      } else {
        doPlay();
        scheduleStopAfterTimer();
        scheduleRandomInterval();
      }
    }
  }, [isPlaying, timerA, timerB, doPlay, doPause, clearAllTimers]);

  const scheduleStopAfterTimer = useCallback(() => {
    const stopSec = Math.max(
      timerA.stopAfter.enabled ? timerA.stopAfter.seconds : 0,
      timerB.stopAfter.enabled ? timerB.stopAfter.seconds : 0,
    );
    if (stopSec > 0) {
      stopAfterTimerRef.current = setTimeout(() => {
        doPause();
      }, stopSec * 1000);
    }
  }, [timerA, timerB, doPause]);

  const scheduleRandomInterval = useCallback(() => {
    const ri = timerA.randomInterval.enabled ? timerA.randomInterval : timerB.randomInterval.enabled ? timerB.randomInterval : null;
    if (!ri?.enabled) return;

    const runCycle = () => {
      const outSec = ri.minOutputSec + Math.random() * (ri.maxOutputSec - ri.minOutputSec);
      const pauseSec = ri.minPauseSec + Math.random() * (ri.maxPauseSec - ri.minPauseSec);

      randomIntervalRef.current = setTimeout(() => {
        doPause();
        randomIntervalRef.current = setTimeout(() => {
          doPlay();
          runCycle();
        }, pauseSec * 1000);
      }, outSec * 1000);
    };
    runCycle();
  }, [timerA, timerB, doPause, doPlay]);

  // ── 波形切换 ──────────────────────────────────────────────
  const handleWaveformSelect = useCallback((name: string) => {
    if (waveChannel === 'AB') {
      onChangeWaveform(name, 'A');
      onChangeWaveform(name, 'B');
    } else {
      onChangeWaveform(name, waveChannel);
    }
  }, [waveChannel, onChangeWaveform]);

  // ── 强度自适应：每隔 N 秒增加可配置量，直到上限 ─────────────
  const handleToggleAdaptive = useCallback(() => {
    setAdaptiveMode(prev => {
      if (!prev) {
        const runAdaptive = () => {
          const newA = Math.min(localLimitARef.current, strengthARef.current + adaptiveIncrementRef.current);
          const newB = Math.min(localLimitBRef.current, strengthBRef.current + adaptiveIncrementRef.current);
          onStrengthChange('A', newA);
          onStrengthChange('B', newB);
          adaptiveTimerRef.current = setTimeout(runAdaptive, adaptiveIntervalSecsRef.current * 1000);
        };
        adaptiveTimerRef.current = setTimeout(runAdaptive, adaptiveIntervalSecsRef.current * 1000);
      } else {
        if (adaptiveTimerRef.current) { clearTimeout(adaptiveTimerRef.current); adaptiveTimerRef.current = null; }
      }
      return !prev;
    });
  }, [onStrengthChange]);

  // ── 随机挑逗：随机强度脉冲，间隔和强度范围均可配置 ──────────
  const handleToggleRandomTease = useCallback(() => {
    setRandomTeaseActive(prev => {
      if (!prev) {
        const runTease = () => {
          const minR = teaseMinPctRef.current / 100;
          const maxR = teaseMaxPctRef.current / 100;
          const ratio = minR + Math.random() * (maxR - minR);
          onStrengthChange('A', Math.round(ratio * localLimitARef.current));
          onStrengthChange('B', Math.round(ratio * localLimitBRef.current));
          const nextMs = (teaseMinSecsRef.current + Math.random() * (teaseMaxSecsRef.current - teaseMinSecsRef.current)) * 1000;
          randomTeaseTimerRef.current = setTimeout(runTease, nextMs);
        };
        runTease();
      } else {
        if (randomTeaseTimerRef.current) { clearTimeout(randomTeaseTimerRef.current); randomTeaseTimerRef.current = null; }
        onStrengthChange('A', strengthARef.current);
        onStrengthChange('B', strengthBRef.current);
      }
      return !prev;
    });
  }, [onStrengthChange]);

  // ── 一键开火：按住增加配置量，松手恢复 ──────────────────────
  const [showFireConfig, setShowFireConfig] = useState(false);
  const [fireBoost, setFireBoost] = useState(50);  // 配置：每次加多少强度
  const firePreA = useRef(0);
  const firePreB = useRef(0);
  const fireActiveRef = useRef(false);

  // ── 输出模式面板显示状态 ──────────────────────────────────
  const [showOutputMode, setShowOutputMode] = useState(false);

  const handleFireStart = useCallback(() => {
    if (!isPlaying || outputBlocked || fireActiveRef.current) return;
    fireActiveRef.current = true;
    firePreA.current = strengthARef.current;
    firePreB.current = strengthBRef.current;
    onStrengthChange('A', Math.min(localLimitARef.current, strengthARef.current + fireBoost));
    onStrengthChange('B', Math.min(localLimitBRef.current, strengthBRef.current + fireBoost));
  }, [isPlaying, outputBlocked, onStrengthChange, fireBoost]);

  const handleFireEnd = useCallback(() => {
    if (!fireActiveRef.current) return;
    fireActiveRef.current = false;
    onStrengthChange('A', firePreA.current);
    onStrengthChange('B', firePreB.current);
  }, [onStrengthChange]);

  // ── 队列自动切换 ──────────────────────────────────────────
  const advanceQueue = useCallback((channel: 'A' | 'B') => {
    const queue = channel === 'A' ? queueA : queueB;
    const indexRef = channel === 'A' ? queueIndexA : queueIndexB;
    if (queue.length === 0 || playbackMode === 'single') return;

    if (playbackMode === 'random') {
      const idx = Math.floor(Math.random() * queue.length);
      indexRef.current = idx;
      onChangeWaveform(queue[idx], channel);
    } else {
      const next = (indexRef.current + 1) % queue.length;
      indexRef.current = next;
      onChangeWaveform(queue[next], channel);
    }
  }, [queueA, queueB, playbackMode, onChangeWaveform]);

  useEffect(() => {
    if (!isPlaying || (queueA.length < 2 && queueB.length < 2)) {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      return;
    }
    queueTimerRef.current = setInterval(() => {
      if (queueA.length >= 2) advanceQueue('A');
      if (queueB.length >= 2) advanceQueue('B');
    }, switchInterval * 1000);
    return () => { if (queueTimerRef.current) clearInterval(queueTimerRef.current); };
  }, [isPlaying, queueA, queueB, switchInterval, advanceQueue]);

  // ── 屏蔽输出 ──────────────────────────────────────────────
  useEffect(() => {
    if (outputBlocked) {
      onStrengthChange('A', 0);
      onStrengthChange('B', 0);
    }
  }, [outputBlocked]);

  // 分享
  const handleShare = async () => {
    if (localMode && onShare) {
      onShare();
      return;
    }
    const link = `https://t.me/lovein_university_bot/university?startapp=therapy_${session.shareCode}`;
    const shared = await platformShare({ text: '⚡ 来控制我的理疗设备！', url: link, inlineQuery: `therapy:${session.shareCode}` });
    if (!shared) {
      try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    }
  };

  // 设备名称
  const activeDeviceName = (() => {
    const d = devices.find(d => d.deviceId === activeDeviceId);
    if (d?.deviceType) {
      const labels: Record<string, string> = {
        DGLAB_WEBSOCKET: '郊狼 App',
        DGLAB_BLE_V3: '郊狼 3.0',
        DGLAB_BLE_V2: '郊狼 2.0',
        YCY_BLE_GEN2: '役次元 二代',
        YCY_BLE_GEN1: '役次元 一代',
      };
      return labels[d.deviceType] ?? d.deviceType;
    }
    return deviceName;
  })();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-20">
      {/* ── 微调弹窗 ──────────────────────────────────────── */}
      <AdjustmentModal
        isOpen={editingKnob !== null}
        onClose={() => setEditingKnob(null)}
        label={editingKnob === 'A' ? 'A 通道' : 'B 通道'}
        value={editingKnob === 'A' ? strengthA : strengthB}
        min={0}
        max={editingKnob === 'A' ? localLimitA : localLimitB}
        onChange={val => editingKnob && onStrengthChange(editingKnob, val)}
        color={editingKnob === 'A' ? '#FFE28A' : '#FFE28A'}
      />

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 sticky top-0 bg-black/95 backdrop-blur z-20">
        {/* 左：返回 + 插槽选择 */}
        <div className="flex items-center gap-1">
          <button onClick={onBack} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-1 pl-1">
            <ChevronDown className="w-4 h-4 text-zinc-400" />
            <span className="text-[#FFE28A] font-medium text-sm">
              插槽 ({devices.length || 1})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {/* 右：添加设备 + 分享 + 设置 */}
        <div className="flex items-center gap-2">
          {/* 连接状态指示 */}
          <div className={`w-2 h-2 rounded-full ${deviceConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />

          {/* 分享/复制 */}
          <button
            onClick={handleShare}
            disabled={upgradingToOnline}
            className={`p-1.5 transition-colors ${
              localMode
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-zinc-400 hover:text-[#FFE28A]'
            } disabled:opacity-50`}
            title={localMode ? '分享给他人控制' : undefined}
          >
            {upgradingToOnline ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          {/* 添加设备 */}
          <button
            onClick={onAddDevice}
            className="p-1 rounded-full border border-[#FFE28A]/30 text-[#FFE28A]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 多设备切换栏 ──────────────────────────────────── */}
      {devices.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-zinc-800/30">
          {devices.map(d => (
            <button
              key={d.deviceId}
              onClick={() => onSelectDevice(d.deviceId)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                d.deviceId === activeDeviceId
                  ? 'bg-[#FFE28A] text-yellow-950'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${d.bindStatus === 'BOUND' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              {d.deviceId.replace('device_', '#')}
            </button>
          ))}
        </div>
      )}

      {/* ── 主内容区 ──────────────────────────────────────── */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">

        {/* ── 被控锁定横幅 ──────────────────────────────── */}
        {isBeingControlled && (
          <div className="mx-0 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <Gamepad2 className="w-4 h-4 flex-shrink-0" />
              <span>{session.currentController!.name} 控制中</span>
              {controlTimeLeft !== undefined && controlTimeLeft > 0 && (
                <span className="text-zinc-500 text-xs">· {controlTimeLeft}s</span>
              )}
            </div>
            {onKickController && (
              <button
                onClick={onKickController}
                className="text-xs text-red-400 px-2 py-0.5 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2"
              >
                踢出
              </button>
            )}
          </div>
        )}

        {/* ── 设备信息 + 通道控制卡 ─────────────────────── */}
        <div className="bg-[#141414] rounded-2xl p-4">
          {/* 设备状态 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${deviceConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />
              <span className="text-zinc-200 font-medium text-sm">{activeDeviceName}</span>
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs ${
                deviceConnected
                  ? 'border-emerald-500/40 text-emerald-400'
                  : 'border-[#FFE28A]/30 text-[#FFE28A]'
              }`}>
                {deviceConnected ? (
                  <><Wifi className="w-3 h-3" /><span>已连接</span></>
                ) : (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                      <WifiOff className="w-3 h-3" />
                    </motion.div>
                    <span>已断开</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setShowMore(true)} className="text-[#FFE28A]/70 hover:text-[#FFE28A] transition-colors p-1.5">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* 定时倒计时提示 */}
          {timerCountdown !== null && (
            <div className="mb-3 text-center text-sm text-[#FFE28A] bg-[#FFE28A]/10 rounded-xl py-2">
              ⏱ 延时启动: {timerCountdown} 秒后开始
            </div>
          )}

          {/* A/B 通道卡 */}
          <div className="flex gap-3">
            {(['A', 'B'] as const).map(ch => {
              const val = ch === 'A' ? strengthA : strengthB;
              const lim = ch === 'A' ? localLimitA : localLimitB;
              const pct = lim > 0 ? Math.round(val / lim * 100) : 0;
              return (
                <div key={ch} className="flex-1 bg-[#0E0E0E] rounded-2xl p-4 border border-white/5">
                  {/* 顶部：图标 + 通道标识 */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="bg-[#1A1A1A] p-2 rounded-lg">
                      <Activity className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">{ch} 通道</span>
                  </div>

                  {/* 强度数值 + 进度 */}
                  <div className="flex flex-col items-center justify-center mb-1">
                    <button
                      onClick={() => setEditingKnob(ch)}
                      className="text-5xl font-light text-zinc-100 mb-0.5 tabular-nums"
                    >
                      {val}
                    </button>
                    <div className="text-zinc-600 text-xs mb-2">{val}/{lim}</div>
                    {/* 进度条 */}
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FFE28A] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* +/- 按钮 */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => changeStrength(ch, -STRENGTH_STEP)}
                      disabled={isBeingControlled || !isPlaying || outputBlocked || val <= 0}
                      className="flex-1 bg-[#1A1A1A] hover:bg-[#222] active:scale-95 rounded-xl py-3 flex items-center justify-center text-[#FFE28A] transition-all disabled:opacity-30"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => changeStrength(ch, STRENGTH_STEP)}
                      disabled={isBeingControlled || !isPlaying || outputBlocked || val >= lim}
                      className="flex-1 bg-[#1A1A1A] hover:bg-[#222] active:scale-95 rounded-xl py-3 flex items-center justify-center text-[#FFE28A] transition-all disabled:opacity-30"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AB 同步切换 */}
          <button
            onClick={() => setSyncChannels(!syncChannels)}
            className={`w-full mt-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              syncChannels
                ? 'bg-[#FFE28A]/20 text-[#FFE28A] border border-[#FFE28A]/30'
                : 'bg-[#0E0E0E] text-zinc-500 border border-zinc-800'
            }`}
          >
            {syncChannels ? 'AB 同步调节中' : 'AB 独立调节'}
          </button>
        </div>

        {/* ── 波形选择卡 ────────────────────────────────── */}
        <div className="bg-[#141414] rounded-2xl p-4">
          {/* A / AB / B 通道切换 */}
          <div className="mb-4">
            {waveChannel === 'AB' ? (
              <button
                onClick={() => setWaveChannel('A')}
                className="w-full py-3 rounded-xl font-medium bg-[#FFE28A] text-yellow-950 text-sm"
              >
                AB 通道同步
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setWaveChannel('A')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    waveChannel === 'A' ? 'bg-[#FFE28A] text-yellow-950' : 'bg-[#0E0E0E] text-zinc-500'
                  }`}
                >
                  A 通道
                </button>
                <button
                  onClick={() => setWaveChannel('AB')}
                  className="px-3 py-2.5 rounded-xl bg-[#0E0E0E] text-zinc-500 hover:bg-[#1A1A1A] flex items-center gap-0.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setWaveChannel('B')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    waveChannel === 'B' ? 'bg-[#FFE28A] text-yellow-950' : 'bg-[#0E0E0E] text-zinc-500'
                  }`}
                >
                  B 通道
                </button>
              </div>
            )}
          </div>

          {/* 当前双通道状态提示 */}
          {currentWaveformA && currentWaveformB && currentWaveformA !== currentWaveformB && (
            <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
              <span>A: <span className="text-[#FFE28A]">{currentWaveformA}</span></span>
              <span>·</span>
              <span>B: <span className="text-zinc-300">{currentWaveformB}</span></span>
            </div>
          )}

          {/* 更多选项 + 切换到编辑器 */}
          <div className="flex justify-between items-center mb-4 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-zinc-400 text-sm">
              <span className="text-[#FFE28A] font-medium">经典波形</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFE28A]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowQueue(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 波形网格 */}
          {waveforms.length > 0 ? (
            <div className={`grid grid-cols-4 gap-3 ${isBeingControlled ? 'pointer-events-none opacity-50' : ''}`}>
              {waveforms.map(name => {
                const currentWave = waveChannel === 'B' ? currentWaveformB : currentWaveformA;
                const isActive = waveChannel === 'AB'
                  ? name === currentWaveformA || name === currentWaveformB
                  : name === currentWave;
                // 是否在当前通道的播放列表中（但未正在播放）
                const isInQueue = !isActive && (
                  waveChannel === 'A' ? queueA.includes(name) :
                  waveChannel === 'B' ? queueB.includes(name) :
                  queueA.includes(name) || queueB.includes(name)
                );
                return (
                  <button
                    key={name}
                    onClick={() => handleWaveformSelect(name)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className={`relative w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all active:scale-95 ${
                      isActive
                        ? 'bg-[#FFE28A]/20 border border-[#FFE28A]/50'
                        : isInQueue
                          ? 'bg-[#0E0E0E] border border-zinc-600/60'
                          : 'bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-transparent'
                    }`}>
                      {waveIcon(name)}
                      {/* 在播放列表中的小圆点指示器 */}
                      {isInQueue && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      )}
                    </div>
                    <span className={`text-[10px] text-center w-full truncate ${
                      isActive ? 'text-[#FFE28A]' : isInQueue ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-zinc-600 text-sm">加载波形中...</div>
          )}

          {/* 用户创作区（调用 WaveformEditor 的入口） */}
          <div className="mt-4 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-zinc-400 text-sm font-medium">我的创作</span>
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            </div>
            <button
              onClick={onOpenWaveformEditor}
              className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-500 flex items-center justify-center gap-2 hover:border-[#FFE28A]/40 hover:text-[#FFE28A] transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              创作新波形
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Nav ────────────────────────────────────── */}
      <TherapyBottomNav
        playbackMode={playbackMode}
        onTogglePlaybackMode={togglePlaybackMode}
        isPlaying={isPlaying && !outputBlocked}
        onTogglePlay={handleTogglePlay}
        onOpenEditor={onOpenWaveformEditor}
        isEditorOpen={false}
        onOpenTimer={() => setShowTimer(true)}
        isTimerOpen={showTimer}
        onOpenQueue={() => setShowQueue(true)}
        isQueueOpen={showQueue}
        playDisabled={isBeingControlled}
      />

      {/* ── 面板 & 弹窗 ──────────────────────────────────── */}
      <TherapyTimerPanel
        isOpen={showTimer}
        onClose={() => setShowTimer(false)}
        timerA={timerA}
        timerB={timerB}
        onChangeTimerA={setTimerA}
        onChangeTimerB={setTimerB}
      />

      <TherapyQueuePanel
        isOpen={showQueue}
        onClose={() => setShowQueue(false)}
        queueA={queueA}
        queueB={queueB}
        currentWaveformA={currentWaveformA}
        currentWaveformB={currentWaveformB}
        availableWaveforms={waveforms}
        playbackMode={playbackMode}
        onTogglePlaybackMode={togglePlaybackMode}
        switchInterval={switchInterval}
        onChangeSwitchInterval={setSwitchInterval}
        onRemoveFromQueueA={i => setQueueA(q => q.filter((_, idx) => idx !== i))}
        onRemoveFromQueueB={i => setQueueB(q => q.filter((_, idx) => idx !== i))}
        onClearQueueA={() => setQueueA([])}
        onClearQueueB={() => setQueueB([])}
        onAddToQueueA={name => setQueueA(q => [...q, name])}
        onAddToQueueB={name => setQueueB(q => [...q, name])}
      />

      {/* ── 强度上限面板 ──────────────────────────────────── */}
      <AnimatePresence>
        {showStrengthLimit && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowStrengthLimit(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50"
            >
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-medium text-zinc-100">强度上限保护</span>
                  <button onClick={() => setShowStrengthLimit(false)} className="text-zinc-400 p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-500 mb-5">调节后强度无法超过此上限，用于安全保护</p>

                {/* A 通道 */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">A 通道上限</span>
                    <span className="text-[#FFE28A] font-mono text-lg">{localLimitA}</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${localLimitA / 200 * 100}%` }} />
                    <input
                      type="range" min="0" max="200" value={localLimitA}
                      onChange={e => setLocalLimitA(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    />
                    <div
                      className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${localLimitA / 200 * 100}%` }}
                    />
                  </div>
                </div>

                {/* B 通道 */}
                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">B 通道上限</span>
                    <span className="text-[#FFE28A] font-mono text-lg">{localLimitB}</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${localLimitB / 200 * 100}%` }} />
                    <input
                      type="range" min="0" max="200" value={localLimitB}
                      onChange={e => setLocalLimitB(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    />
                    <div
                      className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${localLimitB / 200 * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-zinc-600 mt-4 text-center">
                  会话初始上限：A={session.strengthLimitA} / B={session.strengthLimitB}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 一键开火配置面板 ────────────────────────────────── */}
      <AnimatePresence>
        {showFireConfig && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { handleFireEnd(); setShowFireConfig(false); }}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50"
            >
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-medium text-zinc-100">一键开火</span>
                  <button onClick={() => { handleFireEnd(); setShowFireConfig(false); }} className="text-zinc-400 p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-500 mb-5">按住下方按钮期间，强度临时增加配置量；松手后自动恢复</p>

                {/* 加强度配置 */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">临时增加强度</span>
                    <span className="text-[#FFE28A] font-mono text-lg">+{fireBoost}</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-red-500 rounded-full" style={{ width: `${fireBoost / 200 * 100}%` }} />
                    <input
                      type="range" min="1" max="200" value={fireBoost}
                      onChange={e => setFireBoost(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    />
                    <div
                      className="absolute w-4 h-4 bg-red-500 rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${fireBoost / 200 * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 mt-2">
                    <span>+1</span>
                    <span>当前加 {fireBoost}，A: {Math.min(localLimitA, strengthA + fireBoost)} / B: {Math.min(localLimitB, strengthB + fireBoost)}</span>
                    <span>+200</span>
                  </div>
                </div>

                {/* 按住开火按钮 */}
                <button
                  onPointerDown={handleFireStart}
                  onPointerUp={handleFireEnd}
                  onPointerLeave={handleFireEnd}
                  onContextMenu={e => e.preventDefault()}
                  disabled={!isPlaying || outputBlocked}
                  className="w-full py-6 bg-red-500 hover:bg-red-400 active:bg-red-600 active:scale-[0.98] rounded-2xl text-white font-bold text-xl transition-all select-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🔥 按住开火
                </button>
                {(!isPlaying || outputBlocked) && (
                  <p className="text-center text-zinc-600 text-xs mt-3">
                    {outputBlocked ? '输出已屏蔽' : '请先开启播放'}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 软启动配置面板 ──────────────────────────────────── */}
      <AnimatePresence>
        {showSoftStartConfig && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSoftStartConfig(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50">
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-medium text-zinc-100">软启动</span>
                  <button onClick={() => setShowSoftStartConfig(false)} className="text-zinc-400 p-2"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-zinc-500 mb-5">开启后，每次播放时强度从 0 逐步升至目标值</p>

                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-200 font-medium">启用软启动</span>
                    <button onClick={() => setSoftStart(v => !v)}
                      className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${softStart ? 'bg-[#FFE28A]' : 'bg-zinc-700'}`}>
                      <span className={`absolute w-4 h-4 rounded-full top-1 transition-transform ${softStart ? 'bg-yellow-950 translate-x-7' : 'bg-zinc-400 translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">渐入时长</span>
                    <span className="text-[#FFE28A] font-mono">{softStartSecs} 秒</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${(softStartSecs - 1) / 29 * 100}%` }} />
                    <input type="range" min="1" max="30" value={softStartSecs} onChange={e => setSoftStartSecs(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${(softStartSecs - 1) / 29 * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 mt-2"><span>1 秒</span><span>30 秒</span></div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 强度自适应配置面板 ─────────────────────────────────── */}
      <AnimatePresence>
        {showAdaptiveConfig && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAdaptiveConfig(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50">
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-medium text-zinc-100">强度自适应</span>
                  <button onClick={() => setShowAdaptiveConfig(false)} className="text-zinc-400 p-2"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-zinc-500 mb-5">每隔一段时间自动增加强度，直到触及上限</p>

                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-200 font-medium">启用自适应</span>
                    <button onClick={() => { setShowAdaptiveConfig(false); handleToggleAdaptive(); }}
                      className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${adaptiveMode ? 'bg-[#FFE28A]' : 'bg-zinc-700'}`}>
                      <span className={`absolute w-4 h-4 rounded-full top-1 transition-transform ${adaptiveMode ? 'bg-yellow-950 translate-x-7' : 'bg-zinc-400 translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">每步增量</span>
                    <span className="text-[#FFE28A] font-mono">+{adaptiveIncrement}</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${(adaptiveIncrement - 1) / 19 * 100}%` }} />
                    <input type="range" min="1" max="20" value={adaptiveIncrement} onChange={e => setAdaptiveIncrement(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${(adaptiveIncrement - 1) / 19 * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 mt-2"><span>+1</span><span>+20</span></div>
                </div>

                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-zinc-200 font-medium">增加间隔</span>
                    <span className="text-[#FFE28A] font-mono">{adaptiveIntervalSecs} 秒</span>
                  </div>
                  <div className="relative h-2 bg-zinc-800 rounded-full">
                    <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${(adaptiveIntervalSecs - 1) / 59 * 100}%` }} />
                    <input type="range" min="1" max="60" value={adaptiveIntervalSecs} onChange={e => setAdaptiveIntervalSecs(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none"
                      style={{ left: `${(adaptiveIntervalSecs - 1) / 59 * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 mt-2"><span>1 秒</span><span>60 秒</span></div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 随机挑逗配置面板 ─────────────────────────────────── */}
      <AnimatePresence>
        {showTeaseConfig && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowTeaseConfig(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50 max-h-[88vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-medium text-zinc-100">随机挑逗</span>
                  <button onClick={() => setShowTeaseConfig(false)} className="text-zinc-400 p-2"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-zinc-500 mb-5">按随机间隔发送随机强度脉冲</p>

                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-200 font-medium">启用随机挑逗</span>
                    <button onClick={() => { setShowTeaseConfig(false); handleToggleRandomTease(); }}
                      className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${randomTeaseActive ? 'bg-[#FFE28A]' : 'bg-zinc-700'}`}>
                      <span className={`absolute w-4 h-4 rounded-full top-1 transition-transform ${randomTeaseActive ? 'bg-yellow-950 translate-x-7' : 'bg-zinc-400 translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3 space-y-4">
                  <span className="text-zinc-400 text-sm block">强度范围（% 相对上限）</span>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-zinc-300 text-sm">最低强度</span>
                      <span className="text-[#FFE28A] font-mono">{teaseMinPct}%</span>
                    </div>
                    <div className="relative h-2 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A]/60 rounded-full" style={{ width: `${teaseMinPct}%` }} />
                      <input type="range" min="0" max="100" value={teaseMinPct}
                        onChange={e => setTeaseMinPct(Math.min(Number(e.target.value), teaseMaxPct - 5))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none" style={{ left: `${teaseMinPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-zinc-300 text-sm">最高强度</span>
                      <span className="text-[#FFE28A] font-mono">{teaseMaxPct}%</span>
                    </div>
                    <div className="relative h-2 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${teaseMaxPct}%` }} />
                      <input type="range" min="0" max="100" value={teaseMaxPct}
                        onChange={e => setTeaseMaxPct(Math.max(Number(e.target.value), teaseMinPct + 5))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none" style={{ left: `${teaseMaxPct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-4">
                  <span className="text-zinc-400 text-sm block">间隔时间（秒）</span>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-zinc-300 text-sm">最短间隔</span>
                      <span className="text-[#FFE28A] font-mono">{teaseMinSecs} 秒</span>
                    </div>
                    <div className="relative h-2 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A]/60 rounded-full" style={{ width: `${(teaseMinSecs - 1) / 59 * 100}%` }} />
                      <input type="range" min="1" max="60" value={teaseMinSecs}
                        onChange={e => setTeaseMinSecs(Math.min(Number(e.target.value), teaseMaxSecs - 1))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none" style={{ left: `${(teaseMinSecs - 1) / 59 * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-zinc-300 text-sm">最长间隔</span>
                      <span className="text-[#FFE28A] font-mono">{teaseMaxSecs} 秒</span>
                    </div>
                    <div className="relative h-2 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${(teaseMaxSecs - 1) / 59 * 100}%` }} />
                      <input type="range" min="1" max="60" value={teaseMaxSecs}
                        onChange={e => setTeaseMaxSecs(Math.max(Number(e.target.value), teaseMinSecs + 1))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-1 shadow -ml-2 pointer-events-none" style={{ left: `${(teaseMaxSecs - 1) / 59 * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 输出模式配置面板 ─────────────────────────────────── */}
      <AnimatePresence>
        {showOutputMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowOutputMode(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 rounded-t-3xl border-t border-zinc-800/50 z-50 max-h-[88vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-8">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-medium text-zinc-100">输出模式</span>
                  <button onClick={() => setShowOutputMode(false)} className="text-zinc-400 p-2">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* 模式切换 */}
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => onOutputModeChange('standard')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${outputMode === 'standard' ? 'bg-[#FFE28A] text-yellow-950' : 'bg-zinc-800/80 text-zinc-400'}`}
                  >
                    标准模式
                  </button>
                  <button
                    onClick={() => onOutputModeChange('gentle')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${outputMode === 'gentle' ? 'bg-[#FFE28A] text-yellow-950' : 'bg-zinc-800/80 text-zinc-400'}`}
                  >
                    轻柔模式
                  </button>
                </div>

                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                  在"轻柔模式"下，通道强度对应的初始强度会更低，且强度上升更慢。
                </p>

                {/* A 通道 */}
                <div className="bg-zinc-800/40 rounded-2xl p-4 mb-4">
                  <div className="text-zinc-300 mb-5">A 通道设置</div>
                  <div className="mb-5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 text-sm">频率平衡参数</span>
                        <HelpCircle className="w-4 h-4 text-zinc-600" />
                      </div>
                      <span className="text-zinc-400 text-sm font-mono">{freqBalanceA}</span>
                    </div>
                    <div className="relative h-1.5 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${freqBalanceA / 255 * 100}%` }} />
                      <input type="range" min="0" max="255" value={freqBalanceA}
                        onChange={e => onFreqBalanceAChange(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-[5px] shadow -ml-2 pointer-events-none"
                        style={{ left: `${freqBalanceA / 255 * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 text-sm">强度平衡参数</span>
                        <HelpCircle className="w-4 h-4 text-zinc-600" />
                      </div>
                      <span className="text-zinc-400 text-sm font-mono">{intensityBalanceA}</span>
                    </div>
                    <div className="relative h-1.5 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${intensityBalanceA / 255 * 100}%` }} />
                      <input type="range" min="0" max="255" value={intensityBalanceA}
                        onChange={e => onIntensityBalanceAChange(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-[5px] shadow -ml-2 pointer-events-none"
                        style={{ left: `${intensityBalanceA / 255 * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* B 通道 */}
                <div className="bg-zinc-800/40 rounded-2xl p-4 mb-6">
                  <div className="text-zinc-300 mb-5">B 通道设置</div>
                  <div className="mb-5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 text-sm">频率平衡参数</span>
                        <HelpCircle className="w-4 h-4 text-zinc-600" />
                      </div>
                      <span className="text-zinc-400 text-sm font-mono">{freqBalanceB}</span>
                    </div>
                    <div className="relative h-1.5 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${freqBalanceB / 255 * 100}%` }} />
                      <input type="range" min="0" max="255" value={freqBalanceB}
                        onChange={e => onFreqBalanceBChange(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-[5px] shadow -ml-2 pointer-events-none"
                        style={{ left: `${freqBalanceB / 255 * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 text-sm">强度平衡参数</span>
                        <HelpCircle className="w-4 h-4 text-zinc-600" />
                      </div>
                      <span className="text-zinc-400 text-sm font-mono">{intensityBalanceB}</span>
                    </div>
                    <div className="relative h-1.5 bg-zinc-800 rounded-full">
                      <div className="absolute left-0 h-full bg-[#FFE28A] rounded-full" style={{ width: `${intensityBalanceB / 255 * 100}%` }} />
                      <input type="range" min="0" max="255" value={intensityBalanceB}
                        onChange={e => onIntensityBalanceBChange(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                      <div className="absolute w-4 h-4 bg-[#FFE28A] rounded-full -top-[5px] shadow -ml-2 pointer-events-none"
                        style={{ left: `${intensityBalanceB / 255 * 100}%` }} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { onOutputModeChange('standard'); onFreqBalanceAChange(160); onFreqBalanceBChange(160); onIntensityBalanceAChange(0); onIntensityBalanceBChange(0); }}
                  className="w-full py-4 text-red-500 bg-zinc-800/40 rounded-2xl text-center font-medium"
                >
                  恢复默认
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TherapyMoreSettings
        isOpen={showMore}
        onClose={() => setShowMore(false)}
        deviceName={activeDeviceName}
        shareCode={session.shareCode}
        onOpenTimer={() => { setShowMore(false); setShowTimer(true); }}
        onDisconnect={onDisconnect}
        syncOutput={syncOutput}
        onToggleSyncOutput={() => setSyncOutput(!syncOutput)}
        outputBlocked={outputBlocked}
        onToggleBlockOutput={() => setOutputBlocked(!outputBlocked)}
        softStart={softStart}
        onOpenSoftStartConfig={() => { setShowMore(false); setShowSoftStartConfig(true); }}
        adaptiveMode={adaptiveMode}
        onOpenAdaptiveConfig={() => { setShowMore(false); setShowAdaptiveConfig(true); }}
        randomTeaseActive={randomTeaseActive}
        onOpenTeaseConfig={() => { setShowMore(false); setShowTeaseConfig(true); }}
        onOpenFireConfig={() => { setShowMore(false); setShowFireConfig(true); }}
        onOpenStrengthLimit={() => { setShowMore(false); setShowStrengthLimit(true); }}
        onOpenOutputMode={() => { setShowMore(false); setShowOutputMode(true); }}
      />
    </div>
  );
}
