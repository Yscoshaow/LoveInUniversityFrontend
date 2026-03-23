import { useState, useCallback, useRef } from 'react';
import aesjs from 'aes-js';
import type { BleConnectionState } from './useSuojiLockBox';
import { getBleAdapter, translateBleError } from '../lib/ble';
import type { BleConnection, BleDevice } from '../lib/ble';
import { isBleAvailable } from '../lib/environment';

// OKGSS BLE Protocol Constants
const OKGSS_SERVICE_UUID = '0000fee7-0000-1000-8000-00805f9b34fb';
const OKGSS_WRITE_CHAR_UUID = '000036f5-0000-1000-8000-00805f9b34fb';
const OKGSS_NOTIFY_CHAR_UUID = '000036f6-0000-1000-8000-00805f9b34fb';

export interface UseOkgssLockBoxReturn {
  connectionState: BleConnectionState;
  deviceName: string | null;
  macAddress: string | null;
  setMacAddress: (mac: string) => void;
  error: string | null;
  isSupported: boolean;
  battery: number | null;
  scanAndConnect: () => Promise<string | null>;
  connectToDevice: (device: BleDevice) => Promise<string | null>;
  handshake: (keyA: Uint8Array) => Promise<Uint8Array | null>;
  queryBattery: (keyA: Uint8Array, tokenA: Uint8Array) => Promise<number | null>;
  openLock: (keyA: Uint8Array, unlockKey: Uint8Array, tokenA: Uint8Array) => Promise<boolean>;
  disconnect: () => void;
}

// ========== AES-128-ECB 加密/解密 ==========

function aesEcbEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const aesEcb = new aesjs.ModeOfOperation.ecb(key);
  return new Uint8Array(aesEcb.encrypt(data));
}

function aesEcbDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const aesEcb = new aesjs.ModeOfOperation.ecb(key);
  return new Uint8Array(aesEcb.decrypt(data));
}

/** Build 16-byte message, pad with 0x00 */
function buildMessage(parts: Uint8Array[]): Uint8Array {
  const msg = new Uint8Array(16); // default all 0x00
  let offset = 0;
  for (const part of parts) {
    msg.set(part, offset);
    offset += part.length;
  }
  return msg;
}

export function useOkgssLockBox(): UseOkgssLockBoxReturn {
  const [connectionState, setConnectionState] = useState<BleConnectionState>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [macAddress, setMacAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);

  const connectionRef = useRef<BleConnection | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const notifyCallbackRef = useRef<((data: DataView) => void) | null>(null);

  const isSupported = isBleAvailable();

  const handleBleDisconnect = useCallback(() => {
    connectionRef.current = null;
    setConnectionState('disconnected');
    setError('蓝牙设备已断开连接');
  }, []);

  // Scan and connect to OKGSS device
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
        namePrefix: 'OKGSS',
        services: [OKGSS_SERVICE_UUID],
        optionalServices: [OKGSS_SERVICE_UUID],
      });

      deviceIdRef.current = device.id;
      setDeviceName(device.name);

      // On Capacitor native (Android), macAddress is the real MAC; on web it's null
      if (device.macAddress) {
        setMacAddress(device.macAddress);
      }

      const conn = await adapter.connect(device.id, [OKGSS_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;

      // Start notifications
      await conn.startNotifications(OKGSS_SERVICE_UUID, OKGSS_NOTIFY_CHAR_UUID, (data: DataView) => {
        notifyCallbackRef.current?.(data);
      });

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

  // Connect to a pre-selected BleDevice (used when the caller already ran requestDevice)
  const connectToDevice = useCallback(async (device: BleDevice): Promise<string | null> => {
    setConnectionState('connecting');
    setError(null);
    try {
      deviceIdRef.current = device.id;
      setDeviceName(device.name);
      if (device.macAddress) setMacAddress(device.macAddress);

      const adapter = await getBleAdapter();
      const conn = await adapter.connect(device.id, [OKGSS_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;

      await conn.startNotifications(OKGSS_SERVICE_UUID, OKGSS_NOTIFY_CHAR_UUID, (data: DataView) => {
        notifyCallbackRef.current?.(data);
      });

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
  }, [handleBleDisconnect]);

  // Ensure connection is active
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (connectionRef.current) return true;

    if (deviceIdRef.current) {
      try {
        setConnectionState('connecting');
        const adapter = await getBleAdapter();
        const conn = await adapter.connect(deviceIdRef.current, [OKGSS_SERVICE_UUID], handleBleDisconnect);
        connectionRef.current = conn;

        await conn.startNotifications(OKGSS_SERVICE_UUID, OKGSS_NOTIFY_CHAR_UUID, (data: DataView) => {
          notifyCallbackRef.current?.(data);
        });

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

  // Send encrypted message and wait for notification response
  const sendAndReceive = useCallback(async (
    plaintext: Uint8Array,
    keyA: Uint8Array,
    timeoutMs: number = 5000,
  ): Promise<Uint8Array | null> => {
    if (!(await ensureConnected())) return null;

    const encrypted = aesEcbEncrypt(plaintext, keyA);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        notifyCallbackRef.current = null;
        setError('设备响应超时');
        resolve(null);
      }, timeoutMs);

      notifyCallbackRef.current = (data: DataView) => {
        clearTimeout(timeout);
        notifyCallbackRef.current = null;
        const encryptedResponse = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const decrypted = aesEcbDecrypt(encryptedResponse, keyA);
        resolve(decrypted);
      };

      connectionRef.current!.writeWithoutResponse(
        OKGSS_SERVICE_UUID,
        OKGSS_WRITE_CHAR_UUID,
        encrypted.buffer,
      ).catch((err) => {
        clearTimeout(timeout);
        notifyCallbackRef.current = null;
        setError(translateBleError(err, '发送命令失败'));
        resolve(null);
      });
    });
  }, [ensureConnected]);

  // Handshake: get Session Token (TokenA)
  const handshake = useCallback(async (keyA: Uint8Array): Promise<Uint8Array | null> => {
    try {
      // Plaintext: [06 01 01 01 | 0x00*12]
      const msg = buildMessage([new Uint8Array([0x06, 0x01, 0x01, 0x01])]);
      const response = await sendAndReceive(msg, keyA);

      if (!response) return null;

      // Response: [06 02 XX TokenA(4 bytes) | 0x00*9]
      if (response[0] !== 0x06 || response[1] !== 0x02) {
        setError('握手响应格式错误');
        return null;
      }

      // TokenA at bytes 3-6
      const tokenA = response.slice(3, 7);
      return tokenA;
    } catch (err) {
      setError(translateBleError(err, '握手失败'));
      return null;
    }
  }, [sendAndReceive]);

  // Query battery
  const queryBattery = useCallback(async (
    keyA: Uint8Array,
    tokenA: Uint8Array,
  ): Promise<number | null> => {
    try {
      // Plaintext: [02 01 01 01 | TokenA(4 bytes) | 0x00*8]
      const msg = buildMessage([
        new Uint8Array([0x02, 0x01, 0x01, 0x01]),
        tokenA.slice(0, 4),
      ]);

      const response = await sendAndReceive(msg, keyA);
      if (!response) return null;

      // Response: [02 02 XX battery | 0x00*11]
      if (response[0] !== 0x02 || response[1] !== 0x02) {
        setError('电量查询响应格式错误');
        return null;
      }

      // Battery at index 3
      const batteryPercent = Math.min(response[3], 100);
      setBattery(batteryPercent);
      return batteryPercent;
    } catch (err) {
      setError(translateBleError(err, '电量查询失败'));
      return null;
    }
  }, [sendAndReceive]);

  // Open lock
  const openLock = useCallback(async (
    keyA: Uint8Array,
    unlockKey: Uint8Array, // 6-byte Unlock Key (TokenB)
    tokenA: Uint8Array,
  ): Promise<boolean> => {
    try {
      // Plaintext: [05 01 06 | UnlockKey(6 bytes) | TokenA(4 bytes) | 0x00*3]
      const msg = buildMessage([
        new Uint8Array([0x05, 0x01, 0x06]),
        unlockKey.slice(0, 6),
        tokenA.slice(0, 4),
      ]);

      const response = await sendAndReceive(msg, keyA);
      if (!response) return false;

      // Response: [05 status | 0x00*14]
      if (response[0] !== 0x05) {
        setError('开锁响应格式错误');
        return false;
      }

      const status = response[1];
      if (status === 0x01 || status === 0x02) {
        return true;
      } else {
        setError('开锁指令错误（Unlock Key 不正确）');
        return false;
      }
    } catch (err) {
      setError(translateBleError(err, '开锁失败'));
      return false;
    }
  }, [sendAndReceive]);

  // Disconnect
  const disconnect = useCallback(() => {
    notifyCallbackRef.current = null;
    connectionRef.current?.disconnect().catch(() => {});
    connectionRef.current = null;
    deviceIdRef.current = null;
    setConnectionState('disconnected');
    setDeviceName(null);
    setError(null);
    setBattery(null);
  }, []);

  return {
    connectionState,
    deviceName,
    macAddress,
    setMacAddress,
    error,
    isSupported,
    battery,
    scanAndConnect,
    connectToDevice,
    handshake,
    queryBattery,
    openLock,
    disconnect,
  };
}
