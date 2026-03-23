import { useState, useRef, useCallback, useEffect } from 'react';
import { getBleAdapter, translateBleError } from '../lib/ble';
import type { BleConnection } from '../lib/ble';

// ─── YCY BLE 常量 ───

const YCY_SERVICE = '0000ff30-0000-1000-8000-00805f9b34fb';
const YCY_CHAR_WRITE = '0000ff31-0000-1000-8000-00805f9b34fb';   // WRITE_WITHOUT_RESPONSE
const YCY_CHAR_NOTIFY = '0000ff32-0000-1000-8000-00805f9b34fb';  // 设备通知

// 电池查询命令: [0x35, 0x71, 0x04, checksum]
const BATTERY_QUERY = new Uint8Array([0x35, 0x71, 0x04, (0x35 + 0x71 + 0x04) & 0xFF]);

// ─── YCY 协议编码 ───

/** 强度映射: 0-200 → 0-276 */
function mapStrength(s200: number): number {
  return Math.round(Math.min(200, Math.max(0, s200)) * 276 / 200);
}

/** 计算校验和: 所有字节之和 & 0xFF */
function checksum(bytes: number[]): number {
  return bytes.reduce((a, b) => a + b, 0) & 0xFF;
}

/**
 * Gen1 通道控制命令 — 固定 10 字节
 *
 * [0x35, 0x11, channel, state, str_h, str_l, mode, freq, pulse, checksum]
 * channel: 0x01=A, 0x02=B, 0x03=AB
 * state: 0x01=开
 * strength: 0x0001-0x0114 (1-276), 2字节大端序
 * mode: 0x11=自定义模式
 * freq: 1字节, 0x01-0x64 (1-100Hz)
 * pulse: 1字节, 0x00-0x64 (0-100us)
 */
function encodeYcyGen1(
  channel: number,
  strength: number,
  freq: number,
  pulse: number,
): Uint8Array {
  const bytes = [
    0x35,                         // 包头
    0x11,                         // 命令字
    channel,                      // 通道号
    0x01,                         // 通道开启
    (strength >> 8) & 0xFF,       // 强度高字节
    strength & 0xFF,              // 强度低字节
    0x11,                         // 自定义模式
    freq & 0xFF,                  // 频率 (1字节)
    pulse & 0xFF,                 // 脉冲时间 (1字节)
  ];
  bytes.push(checksum(bytes));    // 校验和
  return new Uint8Array(bytes);
}

/**
 * Gen2 实时模式命令 (0x02) — 固定 12 字节，AB 双通道同时
 *
 * [0x35, 0x11, 0x02, strA_h, strA_l, freqA, pulseA, strB_h, strB_l, freqB, pulseB, checksum]
 * Byte 2 = 命令字 0x11, Byte 3 = 模式 0x02 (实时模式)
 */
function encodeYcyGen2Realtime(
  strA: number, freqA: number, pulseA: number,
  strB: number, freqB: number, pulseB: number,
): Uint8Array {
  const bytes = [
    0x35,                         // 包头
    0x11,                         // 命令字
    0x02,                         // 实时模式
    (strA >> 8) & 0xFF, strA & 0xFF, freqA & 0xFF, pulseA & 0xFF,
    (strB >> 8) & 0xFF, strB & 0xFF, freqB & 0xFF, pulseB & 0xFF,
  ];
  bytes.push(checksum(bytes));    // 校验和
  return new Uint8Array(bytes);
}

/** 解析 YCY hex 字符串: "0A32" → { freq: 10, pulse: 50 } */
function parseYcyHex(hex: string): { freq: number; pulse: number } {
  const freq = parseInt(hex.substring(0, 2), 16);
  const pulse = parseInt(hex.substring(2, 4), 16);
  return { freq, pulse };
}

// ─── Hook 接口 ───

export interface UseTherapyBleYcyOptions {
  ycyVersion: 1 | 2;
  waveformDataA: string[] | null;   // ["0A32", "0A50", ...] freq+pulse hex
  waveformDataB: string[] | null;
  strengthTarget: { a: number; b: number } | null;  // 0-200 范围
  strengthLimitA: number;
  strengthLimitB: number;
  onConnected: () => void;
  onDisconnected: () => void;
  onStrengthFeedback?: (strengthA: number, strengthB: number) => void;
  // 输出模式参数
  gentleMode?: boolean;          // 轻柔模式: 强度 × 0.7
  freqBalanceA?: number;         // A 通道频率平衡 (0-255, 中性值=160)
  freqBalanceB?: number;         // B 通道频率平衡
  intensityBalanceA?: number;    // A 通道强度平衡 (0-255, 默认=0)
  intensityBalanceB?: number;    // B 通道强度平衡
}

export interface UseTherapyBleYcyReturn {
  isScanning: boolean;
  isConnected: boolean;
  error: string | null;
  batteryLevel: number | null;
  currentStrengthA: number;
  currentStrengthB: number;
  namePrefix: string;
  scan: () => Promise<void>;
  connectToDevice: (device: import('../lib/ble/types').BleDevice) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useTherapyBleYcy({
  ycyVersion,
  waveformDataA,
  waveformDataB,
  strengthTarget,
  strengthLimitA,
  strengthLimitB,
  onConnected,
  onDisconnected,
  onStrengthFeedback,
  gentleMode = false,
  freqBalanceA = 160,
  freqBalanceB = 160,
  intensityBalanceA = 0,
  intensityBalanceB = 0,
}: UseTherapyBleYcyOptions): UseTherapyBleYcyReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [currentStrengthA, setCurrentStrengthA] = useState(0);
  const [currentStrengthB, setCurrentStrengthB] = useState(0);

  const connectionRef = useRef<BleConnection | null>(null);
  const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batteryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 波形数据循环索引
  const waveIndexARef = useRef(0);
  const waveIndexBRef = useRef(0);

  // Refs 追踪最新值避免闭包陈旧
  const strengthTargetRef = useRef(strengthTarget);
  const waveformDataARef = useRef(waveformDataA);
  const waveformDataBRef = useRef(waveformDataB);
  const currentStrengthARef = useRef(0);
  const currentStrengthBRef = useRef(0);
  // 输出模式 refs
  const gentleModeRef = useRef(gentleMode);
  const freqBalanceARef = useRef(freqBalanceA);
  const freqBalanceBRef = useRef(freqBalanceB);
  const intensityBalanceARef = useRef(intensityBalanceA);
  const intensityBalanceBRef = useRef(intensityBalanceB);

  useEffect(() => { strengthTargetRef.current = strengthTarget; }, [strengthTarget]);
  useEffect(() => {
    if (waveformDataA !== waveformDataARef.current) {
      waveformDataARef.current = waveformDataA;
      waveIndexARef.current = 0;
    }
  }, [waveformDataA]);
  useEffect(() => {
    if (waveformDataB !== waveformDataBRef.current) {
      waveformDataBRef.current = waveformDataB;
      waveIndexBRef.current = 0;
    }
  }, [waveformDataB]);
  useEffect(() => { gentleModeRef.current = gentleMode; }, [gentleMode]);
  useEffect(() => { freqBalanceARef.current = freqBalanceA; }, [freqBalanceA]);
  useEffect(() => { freqBalanceBRef.current = freqBalanceB; }, [freqBalanceB]);
  useEffect(() => { intensityBalanceARef.current = intensityBalanceA; }, [intensityBalanceA]);
  useEffect(() => { intensityBalanceBRef.current = intensityBalanceB; }, [intensityBalanceB]);

  // 清除波形定时器
  const clearWaveformTimer = useCallback(() => {
    if (waveformTimerRef.current !== null) {
      clearInterval(waveformTimerRef.current);
      waveformTimerRef.current = null;
    }
  }, []);

  // 清除电池查询定时器
  const clearBatteryTimer = useCallback(() => {
    if (batteryTimerRef.current !== null) {
      clearInterval(batteryTimerRef.current);
      batteryTimerRef.current = null;
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(async () => {
    clearWaveformTimer();
    clearBatteryTimer();
    if (connectionRef.current) {
      try {
        await connectionRef.current.disconnect();
      } catch { /* ignore */ }
      connectionRef.current = null;
    }
    setIsConnected(false);
    setCurrentStrengthA(0);
    setCurrentStrengthB(0);
    currentStrengthARef.current = 0;
    currentStrengthBRef.current = 0;
    setBatteryLevel(null);
  }, [clearWaveformTimer, clearBatteryTimer]);

  // 100ms 波形循环
  const startWaveformLoop = useCallback(() => {
    clearWaveformTimer();
    const conn = connectionRef.current;
    if (!conn) return;

    waveformTimerRef.current = setInterval(async () => {
      try {
        const dataA = waveformDataARef.current;
        const dataB = waveformDataBRef.current;
        const target = strengthTargetRef.current;
        const sA = target ? target.a : currentStrengthARef.current;
        const sB = target ? target.b : currentStrengthBRef.current;

        // 更新本地强度
        if (target) {
          currentStrengthARef.current = sA;
          currentStrengthBRef.current = sB;
          setCurrentStrengthA(sA);
          setCurrentStrengthB(sB);
        }

        // 应用轻柔模式后映射到 YCY 强度范围 (0-276)
        const gentle = gentleModeRef.current;
        const effSA = gentle ? Math.round(sA * 0.7) : sA;
        const effSB = gentle ? Math.round(sB * 0.7) : sB;
        const ycyStrA = mapStrength(effSA);
        const ycyStrB = mapStrength(effSB);

        // 获取当前波形帧（默认 10Hz 50us，无波形时也能输出）
        let freqA = 10, pulseA = 50;
        let freqB = 10, pulseB = 50;

        if (dataA && dataA.length > 0) {
          const hex = dataA[waveIndexARef.current % dataA.length];
          const parsed = parseYcyHex(hex);
          // 频率平衡: offset = freqBalance-160, 缩放到 YCY 范围 1-100 (÷2)
          const freqOffA = Math.round((freqBalanceARef.current - 160) / 2);
          freqA = Math.max(1, Math.min(100, parsed.freq + freqOffA));
          // 强度平衡: 0-255 → 0-100 加成
          const pulseOffA = Math.round(intensityBalanceARef.current * 100 / 255);
          pulseA = Math.max(0, Math.min(100, parsed.pulse + pulseOffA));
          waveIndexARef.current = (waveIndexARef.current + 1) % dataA.length;
        }

        if (dataB && dataB.length > 0) {
          const hex = dataB[waveIndexBRef.current % dataB.length];
          const parsed = parseYcyHex(hex);
          const freqOffB = Math.round((freqBalanceBRef.current - 160) / 2);
          freqB = Math.max(1, Math.min(100, parsed.freq + freqOffB));
          const pulseOffB = Math.round(intensityBalanceBRef.current * 100 / 255);
          pulseB = Math.max(0, Math.min(100, parsed.pulse + pulseOffB));
          waveIndexBRef.current = (waveIndexBRef.current + 1) % dataB.length;
        }

        if (ycyVersion === 2) {
          // Gen2: 一条命令同时控制 AB 双通道
          const cmd = encodeYcyGen2Realtime(ycyStrA, freqA, pulseA, ycyStrB, freqB, pulseB);
          await conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmd.buffer);
        } else {
          // Gen1: 分别发送 A 和 B 通道命令
          const cmdA = encodeYcyGen1(0x01, ycyStrA, freqA, pulseA);
          await conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmdA.buffer);
          const cmdB = encodeYcyGen1(0x02, ycyStrB, freqB, pulseB);
          await conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmdB.buffer);
        }
      } catch (e) {
        console.error(`[BLE-YCY-G${ycyVersion}] Waveform write error:`, e);
      }
    }, 100);
  }, [ycyVersion, clearWaveformTimer]);

  // 连接到已选设备（不含扫描步骤）
  const connectToDevice = useCallback(async (device: import('../lib/ble/types').BleDevice) => {
    if (isConnected) return;

    setIsScanning(true);
    setError(null);

    try {
      const adapter = await getBleAdapter();

      console.log(`[BLE-YCY] Connecting to device: ${device.name} (${device.id})`);

      const connection = await adapter.connect(device.id, [YCY_SERVICE], () => {
        console.log('[BLE-YCY] Device disconnected');
        clearWaveformTimer();
        clearBatteryTimer();
        connectionRef.current = null;
        setIsConnected(false);
        setBatteryLevel(null);
        onDisconnected();
      });

      connectionRef.current = connection;
      setIsConnected(true);

      // 订阅设备通知 (FF32)
      try {
        await connection.startNotifications(YCY_SERVICE, YCY_CHAR_NOTIFY, (data) => {
          if (data.byteLength < 4) return;
          const header = data.getUint8(0);
          if (header !== 0x35) return;

          const cmd = data.getUint8(1);
          if (cmd === 0x71) {
            const subCmd = data.getUint8(2);
            if (subCmd === 0x04 && data.byteLength >= 5) {
              const level = data.getUint8(3);
              setBatteryLevel(Math.min(100, level));
            } else if ((subCmd === 0x01 || subCmd === 0x02) && data.byteLength >= 9) {
              const ch = subCmd;
              const str = (data.getUint8(5) << 8) | data.getUint8(6);
              const s200 = Math.round(str * 200 / 276);
              if (ch === 0x01) {
                currentStrengthARef.current = s200;
                setCurrentStrengthA(s200);
              } else {
                currentStrengthBRef.current = s200;
                setCurrentStrengthB(s200);
              }
              onStrengthFeedback?.(currentStrengthARef.current, currentStrengthBRef.current);
            }
          }
        });
      } catch (e) {
        console.warn('[BLE-YCY] Notify subscription failed:', e);
      }

      // 查询电池电量
      try {
        await connection.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, BATTERY_QUERY.buffer);
      } catch (e) {
        console.warn('[BLE-YCY] Battery query failed:', e);
      }

      // 定期查询电池 (每 60s)
      batteryTimerRef.current = setInterval(async () => {
        try {
          if (connectionRef.current) {
            await connectionRef.current.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, BATTERY_QUERY.buffer);
          }
        } catch { /* ignore */ }
      }, 60000);

      startWaveformLoop();
      onConnected();
    } catch (e) {
      const msg = translateBleError(e, '蓝牙连接失败');
      if (msg) setError(msg);
      console.error('[BLE-YCY] Connect error:', e);
    } finally {
      setIsScanning(false);
    }
  }, [isConnected, clearWaveformTimer, clearBatteryTimer, onConnected, onDisconnected, onStrengthFeedback, startWaveformLoop]);

  // 搜索并连接设备（系统原生选择器 — 仅作为后备）
  const scan = useCallback(async () => {
    if (isScanning || isConnected) return;

    setIsScanning(true);
    setError(null);

    try {
      const adapter = await getBleAdapter();
      const device = await adapter.requestDevice({ services: [YCY_SERVICE] });
      await connectToDevice(device);
    } catch (e) {
      const msg = translateBleError(e, '蓝牙连接失败');
      if (msg) setError(msg);
      console.error('[BLE-YCY] Scan/connect error:', e);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, isConnected, connectToDevice]);

  // 当波形数据变化时重启循环
  useEffect(() => {
    if (!isConnected || !connectionRef.current) return;
    startWaveformLoop();
  }, [isConnected, waveformDataA, waveformDataB, startWaveformLoop]);

  // 当强度变化且没有波形循环时单独发送
  useEffect(() => {
    if (!isConnected || !connectionRef.current || !strengthTarget) return;
    if (waveformDataA || waveformDataB) return; // 波形循环中已处理

    const conn = connectionRef.current;
    const ycyStrA = mapStrength(strengthTarget.a);
    const ycyStrB = mapStrength(strengthTarget.b);

    if (ycyVersion === 2) {
      // 默认 10Hz 50us，确保频率在有效范围内 (0x01-0x64)
      const cmd = encodeYcyGen2Realtime(ycyStrA, 10, 50, ycyStrB, 10, 50);
      conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmd.buffer).catch(e => {
        console.error('[BLE-YCY] Strength write error:', e);
      });
    } else {
      const cmdA = encodeYcyGen1(0x01, ycyStrA, 10, 50);
      conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmdA.buffer).catch(e => {
        console.error('[BLE-YCY] Strength write error:', e);
      });
      const cmdB = encodeYcyGen1(0x02, ycyStrB, 10, 50);
      conn.writeWithoutResponse(YCY_SERVICE, YCY_CHAR_WRITE, cmdB.buffer).catch(e => {
        console.error('[BLE-YCY] Strength write error:', e);
      });
    }

    currentStrengthARef.current = strengthTarget.a;
    currentStrengthBRef.current = strengthTarget.b;
    setCurrentStrengthA(strengthTarget.a);
    setCurrentStrengthB(strengthTarget.b);
  }, [strengthTarget, isConnected, ycyVersion, waveformDataA, waveformDataB]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearWaveformTimer();
      clearBatteryTimer();
      if (connectionRef.current) {
        connectionRef.current.disconnect().catch(() => {});
        connectionRef.current = null;
      }
    };
  }, [clearWaveformTimer, clearBatteryTimer]);

  return {
    isScanning,
    isConnected,
    error,
    batteryLevel,
    currentStrengthA,
    currentStrengthB,
    namePrefix: '', // YCY devices filter by service UUID, not name prefix
    scan,
    connectToDevice,
    disconnect,
  };
}
