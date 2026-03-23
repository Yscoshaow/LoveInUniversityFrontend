import { useState, useCallback, useRef } from 'react';
import { getBleAdapter, translateBleError } from '../lib/ble';
import type { BleConnection, BleDevice } from '../lib/ble';
import { isBleAvailable } from '../lib/environment';

// Suoji (索迹) BLE Protocol Constants — shared across all models
const SUOJI_SERVICE_UUID = '00008ac0-0000-1000-8000-00805f9b34fb';
const SUOJI_WRITE_CHAR_UUID = '00008ac1-0000-1000-8000-00805f9b34fb';

// All Suoji lock boxes share the "AA" name prefix
const SUOJI_DEVICE_PREFIX = 'AA';

// --- AA-A100 protocol (4-byte commands) ---
const CMD_A100_LOCK = new Uint8Array([0xaa, 0x01, 0x00, 0x00]);
const CMD_A100_UNLOCK = new Uint8Array([0xaa, 0x01, 0x01, 0x00]);

// --- AA1002 / AA10012 protocol (10-byte commands) ---
const CMD_V2_UNLOCK = new Uint8Array([0xaa, 0x09, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]);
const CMD_V2_LOCK = new Uint8Array([0xaa, 0x09, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]);

/** Detect device protocol version from BLE device name */
function isV2Protocol(name: string | null): boolean {
  if (!name) return false;
  // AA1002, AA10012, etc. — anything that is NOT "AA-A100*"
  return name.startsWith('AA') && !name.startsWith('AA-A100');
}

export type BleConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseSuojiLockBoxReturn {
  connectionState: BleConnectionState;
  deviceName: string | null;
  error: string | null;
  isSupported: boolean;
  namePrefix: string;
  scanAndConnect: () => Promise<string | null>;
  connectToDevice: (device: BleDevice) => Promise<string | null>;
  sendLockCommand: () => Promise<boolean>;
  sendUnlockCommand: () => Promise<boolean>;
  disconnect: () => void;
}

export function useSuojiLockBox(): UseSuojiLockBoxReturn {
  const [connectionState, setConnectionState] = useState<BleConnectionState>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<BleConnection | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const deviceNameRef = useRef<string | null>(null);

  const isSupported = isBleAvailable();

  const handleBleDisconnect = useCallback(() => {
    connectionRef.current = null;
    setConnectionState('disconnected');
    setError('蓝牙设备已断开连接');
  }, []);

  const scanAndConnect = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      setError('此浏览器不支持蓝牙功能');
      return null;
    }

    setConnectionState('connecting');
    setError(null);

    try {
      const adapter = await getBleAdapter();
      const device = await adapter.requestDevice({
        namePrefix: SUOJI_DEVICE_PREFIX,
        services: [SUOJI_SERVICE_UUID],
        optionalServices: [SUOJI_SERVICE_UUID],
      });

      deviceIdRef.current = device.id;
      deviceNameRef.current = device.name;
      setDeviceName(device.name);

      const conn = await adapter.connect(device.id, [SUOJI_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;
      setConnectionState('connected');

      return device.name;
    } catch (err) {
      const message = translateBleError(err, '蓝牙连接失败');
      if (!message) {
        setConnectionState('disconnected');
        setError(null);
      } else {
        setError(message);
        setConnectionState('error');
      }
      return null;
    }
  }, [isSupported, handleBleDisconnect]);

  const connectToDevice = useCallback(async (device: BleDevice): Promise<string | null> => {
    setConnectionState('connecting');
    setError(null);
    try {
      deviceIdRef.current = device.id;
      deviceNameRef.current = device.name;
      setDeviceName(device.name);
      const adapter = await getBleAdapter();
      const conn = await adapter.connect(device.id, [SUOJI_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;
      setConnectionState('connected');
      return device.name;
    } catch (err) {
      const message = translateBleError(err, '蓝牙连接失败');
      setError(message || null);
      setConnectionState(message ? 'error' : 'disconnected');
      return null;
    }
  }, [handleBleDisconnect]);

  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (connectionRef.current) return true;

    if (deviceIdRef.current) {
      try {
        setConnectionState('connecting');
        const adapter = await getBleAdapter();
        const conn = await adapter.connect(deviceIdRef.current, [SUOJI_SERVICE_UUID], handleBleDisconnect);
        connectionRef.current = conn;
        setConnectionState('connected');
        return true;
      } catch {
        setError('设备已断开，请重新连接');
        setConnectionState('error');
        return false;
      }
    }

    setError('未连接到设备');
    return false;
  }, [handleBleDisconnect]);

  const sendCommand = useCallback(async (cmd: Uint8Array): Promise<boolean> => {
    if (!(await ensureConnected())) return false;

    try {
      await connectionRef.current!.write(SUOJI_SERVICE_UUID, SUOJI_WRITE_CHAR_UUID, cmd.buffer);
      return true;
    } catch (err) {
      setError(translateBleError(err, '发送命令失败'));
      return false;
    }
  }, [ensureConnected]);

  const sendLockCommand = useCallback(() => {
    const cmd = isV2Protocol(deviceNameRef.current) ? CMD_V2_LOCK : CMD_A100_LOCK;
    return sendCommand(cmd);
  }, [sendCommand]);

  const sendUnlockCommand = useCallback(() => {
    const cmd = isV2Protocol(deviceNameRef.current) ? CMD_V2_UNLOCK : CMD_A100_UNLOCK;
    return sendCommand(cmd);
  }, [sendCommand]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect().catch(() => {});
    connectionRef.current = null;
    deviceIdRef.current = null;
    deviceNameRef.current = null;
    setConnectionState('disconnected');
    setDeviceName(null);
    setError(null);
  }, []);

  return {
    connectionState,
    deviceName,
    error,
    isSupported,
    namePrefix: SUOJI_DEVICE_PREFIX,
    scanAndConnect,
    connectToDevice,
    sendLockCommand,
    sendUnlockCommand,
    disconnect,
  };
}
