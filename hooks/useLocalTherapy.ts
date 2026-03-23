import { useState, useCallback, useEffect, useRef } from 'react';
import { therapyApi, type LocalWaveformPreset } from '../lib/api';
import type { DeviceType } from '../contexts/TherapyContext';

export interface LocalTherapyState {
  /** 波形预设列表（从云端加载） */
  presets: LocalWaveformPreset[];
  presetsLoading: boolean;
  presetsError: string | null;

  /** 当前强度 (0-200) */
  strengthA: number;
  strengthB: number;
  /** 强度上限 */
  strengthLimitA: number;
  strengthLimitB: number;

  /** 当前波形名称 */
  currentWaveformA: string;
  currentWaveformB: string;
  /** 当前通道的波形 hex 数据（传给 BLE hook） */
  waveformDataA: string[] | null;
  waveformDataB: string[] | null;
  /** BLE hook 需要的强度目标 */
  bleStrengthTarget: { a: number; b: number } | null;

  /** 操作 */
  setStrength: (channel: 'A' | 'B', value: number) => void;
  changeWaveform: (name: string, channel: 'A' | 'B' | 'AB') => void;
  setStrengthLimit: (channel: 'A' | 'B', value: number) => void;
  reloadPresets: () => void;
}

export function useLocalTherapy(deviceType: DeviceType | null): LocalTherapyState {
  const [presets, setPresets] = useState<LocalWaveformPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  const [strengthA, setStrengthA] = useState(0);
  const [strengthB, setStrengthB] = useState(0);
  const [strengthLimitA, setStrengthLimitA] = useState(100);
  const [strengthLimitB, setStrengthLimitB] = useState(100);

  const [currentWaveformA, setCurrentWaveformA] = useState('呼吸');
  const [currentWaveformB, setCurrentWaveformB] = useState('呼吸');
  const [waveformDataA, setWaveformDataA] = useState<string[] | null>(null);
  const [waveformDataB, setWaveformDataB] = useState<string[] | null>(null);
  const [bleStrengthTarget, setBleStrengthTarget] = useState<{ a: number; b: number } | null>(null);

  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  // 加载波形预设
  const loadPresets = useCallback(async () => {
    if (!deviceType) return;
    setPresetsLoading(true);
    setPresetsError(null);
    try {
      const resp = await therapyApi.getWaveformPresets(deviceType);
      setPresets(resp.presets);
      // 默认选择"呼吸"波形
      const defaultPreset = resp.presets.find(p => p.name === '呼吸') ?? resp.presets[0];
      if (defaultPreset) {
        setWaveformDataA(defaultPreset.hexData);
        setWaveformDataB(defaultPreset.hexData);
        setCurrentWaveformA(defaultPreset.name);
        setCurrentWaveformB(defaultPreset.name);
      }
    } catch (e: any) {
      setPresetsError(e.message ?? '加载波形预设失败');
    } finally {
      setPresetsLoading(false);
    }
  }, [deviceType]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // 设置强度
  const setStrength = useCallback((channel: 'A' | 'B', value: number) => {
    const clamped = Math.max(0, Math.min(200, value));
    if (channel === 'A') {
      setStrengthA(clamped);
    } else {
      setStrengthB(clamped);
    }
    // 更新 BLE 强度目标
    setBleStrengthTarget(prev => ({
      a: channel === 'A' ? clamped : (prev?.a ?? 0),
      b: channel === 'B' ? clamped : (prev?.b ?? 0),
    }));
  }, []);

  // 切换波形
  const changeWaveform = useCallback((name: string, channel: 'A' | 'B' | 'AB') => {
    const preset = presetsRef.current.find(p => p.name === name);
    if (!preset) return;

    if (channel === 'A' || channel === 'AB') {
      setCurrentWaveformA(name);
      setWaveformDataA(preset.hexData);
    }
    if (channel === 'B' || channel === 'AB') {
      setCurrentWaveformB(name);
      setWaveformDataB(preset.hexData);
    }
  }, []);

  // 设置强度上限
  const setStrengthLimit = useCallback((channel: 'A' | 'B', value: number) => {
    if (channel === 'A') setStrengthLimitA(value);
    else setStrengthLimitB(value);
  }, []);

  return {
    presets,
    presetsLoading,
    presetsError,
    strengthA,
    strengthB,
    strengthLimitA,
    strengthLimitB,
    currentWaveformA,
    currentWaveformB,
    waveformDataA,
    waveformDataB,
    bleStrengthTarget,
    setStrength,
    changeWaveform,
    setStrengthLimit,
    reloadPresets: loadPresets,
  };
}
