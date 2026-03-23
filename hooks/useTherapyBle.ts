import { useState, useRef, useCallback, useEffect } from 'react';
import { getBleAdapter, translateBleError } from '../lib/ble';
import type { BleConnection } from '../lib/ble';

// ─── DG-Lab BLE 常量 ───

// V3 服务和特征
const V3_SERVICE = '0000180c-0000-1000-8000-00805f9b34fb';
const V3_CHAR_WRITE = '0000150a-0000-1000-8000-00805f9b34fb';    // B0/BF 命令写入
const V3_CHAR_BATTERY = '00001500-0000-1000-8000-00805f9b34fb';  // 电池通知
const V3_CHAR_NOTIFY = '00001501-0000-1000-8000-00805f9b34fb';   // 设备→主机通知

// V2 服务和特征（Base UUID: 955Axxxx-0FE2-F5AA-A094-84B8D4F3E8AD）
const V2_SERVICE = '955a180b-0fe2-f5aa-a094-84b8d4f3e8ad';
const V2_CHAR_PWM_AB2 = '955a1504-0fe2-f5aa-a094-84b8d4f3e8ad';  // 强度写入（3字节）
const V2_CHAR_PWM_A34 = '955a1505-0fe2-f5aa-a094-84b8d4f3e8ad';  // A通道波形（3字节）
const V2_CHAR_PWM_B34 = '955a1506-0fe2-f5aa-a094-84b8d4f3e8ad';  // B通道波形（3字节）
const V2_CHAR_BATTERY = '955a1500-0fe2-f5aa-a094-84b8d4f3e8ad';  // 电池通知

// V3 设备名称前缀
const V3_NAME_PREFIX = '47L121';
// V2 设备名称前缀
const V2_NAME_PREFIX = 'D-LAB ESTIM01';

// ─── V3 协议编码 ───

/** 编码 V3 B0 命令（20 字节）
 *
 * byte[0]   = 0xB0
 * byte[1]   = (seq << 4) | intensityParsing   (intensityParsing = 0b11 表示绝对值)
 * byte[2]   = strengthA (0-200)
 * byte[3]   = strengthB (0-200)
 * byte[4-7] = freqA (4 个 frequency 值, 各 1 字节, 10-240)
 * byte[8-11] = intA (4 个 intensity 值, 各 1 字节, 0-100)
 * byte[12-15] = freqB (4 个 frequency 值)
 * byte[16-19] = intB (4 个 intensity 值)
 */
function encodeV3B0(
  seq: number,
  strengthA: number,
  strengthB: number,
  freqA: number[],
  intA: number[],
  freqB: number[],
  intB: number[],
): Uint8Array {
  const buf = new Uint8Array(20);
  buf[0] = 0xB0;
  buf[1] = ((seq & 0x0F) << 4) | 0x03; // 0x03 = absolute intensity parsing
  buf[2] = strengthA & 0xFF;
  buf[3] = strengthB & 0xFF;
  // A channel: 4 freq + 4 int
  for (let i = 0; i < 4; i++) {
    buf[4 + i] = (freqA[i] ?? 0) & 0xFF;
    buf[8 + i] = (intA[i] ?? 0) & 0xFF;
  }
  // B channel: 4 freq + 4 int
  for (let i = 0; i < 4; i++) {
    buf[12 + i] = (freqB[i] ?? 0) & 0xFF;
    buf[16 + i] = (intB[i] ?? 0) & 0xFF;
  }
  return buf;
}

/** 编码 V3 BF 命令（7 字节）- 设置软上限 */
function encodeV3BF(limitA: number, limitB: number): Uint8Array {
  const buf = new Uint8Array(7);
  buf[0] = 0xBF;
  buf[1] = limitA & 0xFF;
  buf[2] = limitB & 0xFF;
  // buf[3..6] = 0 (保留)
  return buf;
}

/** 解析 V3 hex 字符串: "0A0A0A0A14141414" → 4 freq + 4 int */
function parseV3Hex(hex: string): { freq: number[]; int: number[] } {
  // 16 hex chars = 8 bytes = 4 freq + 4 int
  const freq: number[] = [];
  const int: number[] = [];
  for (let i = 0; i < 4; i++) {
    freq.push(parseInt(hex.substring(i * 2, i * 2 + 2), 16));
  }
  for (let i = 4; i < 8; i++) {
    int.push(parseInt(hex.substring(i * 2, i * 2 + 2), 16));
  }
  return { freq, int };
}

// ─── V2 协议编码 ───

/**
 * 编码 V2 强度值（3 字节）
 *
 * V2 强度范围 0-2047（11 bit），但 wave.json 使用 0-200 映射
 * PWM_AB2: 3 bytes = bits[23:13]=channelA, bits[12:2]=channelB, bits[1:0]=0
 * 即 (a << 11) | (b) 然后 big-endian 3 字节
 *
 * 实际上根据协议文档，V2强度范围0-2047，但我们用0-200做映射
 */
function encodeV2Strength(a200: number, b200: number): Uint8Array {
  // 0-200 → 0-2047
  const a = Math.round((a200 / 200) * 2047);
  const b = Math.round((b200 / 200) * 2047);
  // Pack: (a << 11) | b → 22 bits, stored in 3 bytes big-endian
  const value = ((a & 0x7FF) << 11) | (b & 0x7FF);
  const buf = new Uint8Array(3);
  buf[0] = (value >> 16) & 0xFF;
  buf[1] = (value >> 8) & 0xFF;
  buf[2] = value & 0xFF;
  return buf;
}

/**
 * 解析 V2 波形 hex 字符串: "0A0A0A" = 3 bytes
 *
 * V2 PWM_A34/B34 直接写 3 字节到对应通道特征
 */
function parseV2WaveHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── Hook 接口 ───

export interface UseTherapyBleOptions {
  bleVersion: 2 | 3;
  waveformDataA: string[] | null;
  waveformDataB: string[] | null;
  strengthTarget: { a: number; b: number } | null;
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

export interface UseTherapyBleReturn {
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

export function useTherapyBle({
  bleVersion,
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
}: UseTherapyBleOptions): UseTherapyBleReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [currentStrengthA, setCurrentStrengthA] = useState(0);
  const [currentStrengthB, setCurrentStrengthB] = useState(0);

  const connectionRef = useRef<BleConnection | null>(null);
  const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef(0);

  // 波形数据循环索引
  const waveIndexARef = useRef(0);
  const waveIndexBRef = useRef(0);

  // 使用 ref 追踪最新值避免闭包陈旧
  const strengthTargetRef = useRef(strengthTarget);
  const waveformDataARef = useRef(waveformDataA);
  const waveformDataBRef = useRef(waveformDataB);
  const strengthLimitARef = useRef(strengthLimitA);
  const strengthLimitBRef = useRef(strengthLimitB);
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
      waveIndexARef.current = 0; // 波形变化时重置索引
    }
  }, [waveformDataA]);
  useEffect(() => {
    if (waveformDataB !== waveformDataBRef.current) {
      waveformDataBRef.current = waveformDataB;
      waveIndexBRef.current = 0;
    }
  }, [waveformDataB]);
  useEffect(() => { strengthLimitARef.current = strengthLimitA; }, [strengthLimitA]);
  useEffect(() => { strengthLimitBRef.current = strengthLimitB; }, [strengthLimitB]);
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

  // 断开连接
  const disconnect = useCallback(async () => {
    clearWaveformTimer();
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
  }, [clearWaveformTimer]);

  // V3: 100ms 波形循环
  const startV3WaveformLoop = useCallback(() => {
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

        // 应用输出模式: 轻柔模式降低强度
        const gentle = gentleModeRef.current;
        const effSA = gentle ? Math.round(sA * 0.7) : sA;
        const effSB = gentle ? Math.round(sB * 0.7) : sB;

        // 解析当前波形帧
        let freqA = [0, 0, 0, 0], intA = [0, 0, 0, 0];
        let freqB = [0, 0, 0, 0], intB = [0, 0, 0, 0];

        if (dataA && dataA.length > 0) {
          const hex = dataA[waveIndexARef.current % dataA.length];
          const parsed = parseV3Hex(hex);
          // 应用频率平衡 (偏移量 = freqBalance - 160, 范围钳制 10-240)
          const freqOffA = freqBalanceARef.current - 160;
          freqA = parsed.freq.map(f => Math.max(10, Math.min(240, f + freqOffA)));
          // 应用强度平衡 (0-255 → 0-100 加成, 钳制 0-100)
          const intOffA = Math.round(intensityBalanceARef.current * 100 / 255);
          intA = parsed.int.map(v => Math.max(0, Math.min(100, v + intOffA)));
          waveIndexARef.current = (waveIndexARef.current + 1) % dataA.length;
        }

        if (dataB && dataB.length > 0) {
          const hex = dataB[waveIndexBRef.current % dataB.length];
          const parsed = parseV3Hex(hex);
          const freqOffB = freqBalanceBRef.current - 160;
          freqB = parsed.freq.map(f => Math.max(10, Math.min(240, f + freqOffB)));
          const intOffB = Math.round(intensityBalanceBRef.current * 100 / 255);
          intB = parsed.int.map(v => Math.max(0, Math.min(100, v + intOffB)));
          waveIndexBRef.current = (waveIndexBRef.current + 1) % dataB.length;
        }

        const seq = seqRef.current;
        seqRef.current = (seqRef.current + 1) & 0x0F;

        const cmd = encodeV3B0(seq, effSA, effSB, freqA, intA, freqB, intB);
        await conn.writeWithoutResponse(V3_SERVICE, V3_CHAR_WRITE, cmd.buffer);
      } catch (e) {
        console.error('[BLE-V3] Waveform write error:', e);
      }
    }, 100);
  }, [clearWaveformTimer]);

  // V2: 100ms 波形循环
  const startV2WaveformLoop = useCallback(() => {
    clearWaveformTimer();
    const conn = connectionRef.current;
    if (!conn) return;

    waveformTimerRef.current = setInterval(async () => {
      try {
        const dataA = waveformDataARef.current;
        const dataB = waveformDataBRef.current;
        const target = strengthTargetRef.current;

        // 更新强度
        if (target) {
          const sA = target.a;
          const sB = target.b;
          if (sA !== currentStrengthARef.current || sB !== currentStrengthBRef.current) {
            currentStrengthARef.current = sA;
            currentStrengthBRef.current = sB;
            setCurrentStrengthA(sA);
            setCurrentStrengthB(sB);
            // 应用轻柔模式
            const gentle = gentleModeRef.current;
            const effSA = gentle ? Math.round(sA * 0.7) : sA;
            const effSB = gentle ? Math.round(sB * 0.7) : sB;
            const strengthCmd = encodeV2Strength(effSA, effSB);
            await conn.write(V2_SERVICE, V2_CHAR_PWM_AB2, strengthCmd.buffer);
          }
        }

        // A 通道波形
        if (dataA && dataA.length > 0) {
          const hex = dataA[waveIndexARef.current % dataA.length];
          const waveBytes = parseV2WaveHex(hex);
          await conn.write(V2_SERVICE, V2_CHAR_PWM_A34, waveBytes.buffer);
          waveIndexARef.current = (waveIndexARef.current + 1) % dataA.length;
        }

        // B 通道波形
        if (dataB && dataB.length > 0) {
          const hex = dataB[waveIndexBRef.current % dataB.length];
          const waveBytes = parseV2WaveHex(hex);
          await conn.write(V2_SERVICE, V2_CHAR_PWM_B34, waveBytes.buffer);
          waveIndexBRef.current = (waveIndexBRef.current + 1) % dataB.length;
        }
      } catch (e) {
        console.error('[BLE-V2] Waveform write error:', e);
      }
    }, 100);
  }, [clearWaveformTimer]);

  // 连接到已选设备（不含扫描步骤）
  const connectToDevice = useCallback(async (device: import('../lib/ble/types').BleDevice) => {
    if (isConnected) return;

    setIsScanning(true);
    setError(null);

    try {
      const adapter = await getBleAdapter();
      const services = bleVersion === 3 ? [V3_SERVICE] : [V2_SERVICE];

      console.log(`[BLE] Connecting to device: ${device.name} (${device.id})`);

      const connection = await adapter.connect(device.id, services, () => {
        console.log('[BLE] Device disconnected');
        clearWaveformTimer();
        connectionRef.current = null;
        setIsConnected(false);
        setBatteryLevel(null);
        onDisconnected();
      });

      connectionRef.current = connection;
      setIsConnected(true);

      // 订阅电池通知
      try {
        const batteryCharUuid = bleVersion === 3 ? V3_CHAR_BATTERY : V2_CHAR_BATTERY;
        const batteryServiceUuid = bleVersion === 3 ? V3_SERVICE : V2_SERVICE;
        await connection.startNotifications(batteryServiceUuid, batteryCharUuid, (data) => {
          if (data.byteLength >= 1) {
            setBatteryLevel(data.getUint8(0));
          }
        });
      } catch (e) {
        console.warn('[BLE] Battery notification not available:', e);
      }

      // V3: 发送 BF 命令设置软上限
      if (bleVersion === 3) {
        try {
          const bfCmd = encodeV3BF(strengthLimitARef.current, strengthLimitBRef.current);
          await connection.writeWithoutResponse(V3_SERVICE, V3_CHAR_WRITE, bfCmd.buffer);
          console.log('[BLE-V3] Sent BF limits command');
        } catch (e) {
          console.warn('[BLE-V3] Failed to send BF command:', e);
        }
      }

      // V3: 订阅设备通知
      if (bleVersion === 3) {
        try {
          await connection.startNotifications(V3_SERVICE, V3_CHAR_NOTIFY, (data) => {
            if (data.byteLength >= 3 && data.getUint8(0) === 0xB1) {
              const sA = data.getUint8(1);
              const sB = data.getUint8(2);
              setCurrentStrengthA(sA);
              setCurrentStrengthB(sB);
              currentStrengthARef.current = sA;
              currentStrengthBRef.current = sB;
              onStrengthFeedback?.(sA, sB);
            }
          });
        } catch (e) {
          console.warn('[BLE-V3] Notify subscription failed:', e);
        }
      }

      // 启动波形循环
      if (bleVersion === 3) {
        startV3WaveformLoop();
      } else {
        startV2WaveformLoop();
      }

      onConnected();
    } catch (e) {
      const msg = translateBleError(e, '蓝牙连接失败');
      if (msg) setError(msg);
      console.error('[BLE] Connect error:', e);
    } finally {
      setIsScanning(false);
    }
  }, [isConnected, bleVersion, clearWaveformTimer, onConnected, onDisconnected, onStrengthFeedback, startV3WaveformLoop, startV2WaveformLoop]);

  // 搜索并连接设备（系统原生选择器 — 仅作为后备）
  const scan = useCallback(async () => {
    if (isScanning || isConnected) return;

    setIsScanning(true);
    setError(null);

    try {
      const adapter = await getBleAdapter();
      const namePrefix = bleVersion === 3 ? V3_NAME_PREFIX : V2_NAME_PREFIX;
      const services = bleVersion === 3 ? [V3_SERVICE] : [V2_SERVICE];

      const device = await adapter.requestDevice({ namePrefix, services });
      await connectToDevice(device);
    } catch (e) {
      const msg = translateBleError(e, '蓝牙连接失败');
      if (msg) setError(msg);
      console.error('[BLE] Scan/connect error:', e);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, isConnected, bleVersion, connectToDevice]);

  // 当波形数据变化时重启循环（只在已连接时）
  useEffect(() => {
    if (!isConnected || !connectionRef.current) return;
    if (bleVersion === 3) {
      startV3WaveformLoop();
    } else {
      startV2WaveformLoop();
    }
  }, [isConnected, waveformDataA, waveformDataB, bleVersion, startV3WaveformLoop, startV2WaveformLoop]);

  // V3: 当强度目标变化但没有波形循环时，单独发送强度
  useEffect(() => {
    if (!isConnected || !connectionRef.current || !strengthTarget) return;
    if (bleVersion === 2) {
      // V2: 在波形循环中处理，但如果没有波形循环则单独写入
      if (!waveformDataA && !waveformDataB) {
        const conn = connectionRef.current;
        const cmd = encodeV2Strength(strengthTarget.a, strengthTarget.b);
        conn.write(V2_SERVICE, V2_CHAR_PWM_AB2, cmd.buffer).catch(e => {
          console.error('[BLE-V2] Strength write error:', e);
        });
        currentStrengthARef.current = strengthTarget.a;
        currentStrengthBRef.current = strengthTarget.b;
        setCurrentStrengthA(strengthTarget.a);
        setCurrentStrengthB(strengthTarget.b);
      }
    }
    // V3: 强度在 B0 命令中一起发送，无需额外操作
  }, [strengthTarget, isConnected, bleVersion, waveformDataA, waveformDataB]);

  // V3: 当强度上限变化时发送 BF 命令
  useEffect(() => {
    if (!isConnected || !connectionRef.current || bleVersion !== 3) return;
    const conn = connectionRef.current;
    const bfCmd = encodeV3BF(strengthLimitA, strengthLimitB);
    conn.writeWithoutResponse(V3_SERVICE, V3_CHAR_WRITE, bfCmd.buffer).catch(e => {
      console.warn('[BLE-V3] Failed to update BF limits:', e);
    });
  }, [strengthLimitA, strengthLimitB, isConnected, bleVersion]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearWaveformTimer();
      if (connectionRef.current) {
        connectionRef.current.disconnect().catch(() => {});
        connectionRef.current = null;
      }
    };
  }, [clearWaveformTimer]);

  return {
    isScanning,
    isConnected,
    error,
    batteryLevel,
    currentStrengthA,
    currentStrengthB,
    namePrefix: bleVersion === 3 ? V3_NAME_PREFIX : V2_NAME_PREFIX,
    scan,
    connectToDevice,
    disconnect,
  };
}
