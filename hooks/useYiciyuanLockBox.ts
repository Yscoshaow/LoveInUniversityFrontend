import { useState, useCallback, useRef } from 'react';
import aesjs from 'aes-js';
import type { BleConnectionState } from './useSuojiLockBox';
import { getBleAdapter, translateBleError } from '../lib/ble';
import type { BleConnection, BleDevice } from '../lib/ble';
import { isBleAvailable } from '../lib/environment';

// YS0x BLE Protocol Constants
const YS_SERVICE_UUID = '00009000-0000-1000-8000-57616c6b697a';
const YS_WRITE_CHAR_UUID = '00009001-0000-1000-8000-57616c6b697a';
const YS_NOTIFY_CHAR_UUID = '00009002-0000-1000-8000-57616c6b697a';

export interface UseYiciyuanLockBoxReturn {
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
  openLockBox: (keyA: Uint8Array, tokenB: Uint8Array, tokenA: Uint8Array) => Promise<boolean>;
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

// ========== 工具函数 ==========

/** hex 字符串转 Uint8Array */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Build a 16-byte message, randomly fill remaining bytes */
function buildMessage(parts: Uint8Array[]): Uint8Array {
  const msg = new Uint8Array(16);
  let offset = 0;
  for (const part of parts) {
    msg.set(part, offset);
    offset += part.length;
  }
  // Random fill remaining bytes
  if (offset < 16) {
    const random = new Uint8Array(16 - offset);
    crypto.getRandomValues(random);
    msg.set(random, offset);
  }
  return msg;
}

export function useYiciyuanLockBox(): UseYiciyuanLockBoxReturn {
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

  // Scan and connect to YS03/YS04 device
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
        namePrefix: 'YS0',
        services: [YS_SERVICE_UUID],
        optionalServices: [YS_SERVICE_UUID],
      });

      deviceIdRef.current = device.id;
      setDeviceName(device.name);

      // On Capacitor native (Android), macAddress is the real MAC; on web it's null
      if (device.macAddress) {
        setMacAddress(device.macAddress);
      }

      const conn = await adapter.connect(device.id, [YS_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;

      // On iOS, connect() may have read the MAC from device characteristics
      if (!device.macAddress && conn.device.macAddress) {
        setMacAddress(conn.device.macAddress);
      }

      // Start notifications on the notify characteristic
      await conn.startNotifications(YS_SERVICE_UUID, YS_NOTIFY_CHAR_UUID, (data: DataView) => {
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
      const conn = await adapter.connect(device.id, [YS_SERVICE_UUID], handleBleDisconnect);
      connectionRef.current = conn;

      if (!device.macAddress && conn.device.macAddress) setMacAddress(conn.device.macAddress);

      await conn.startNotifications(YS_SERVICE_UUID, YS_NOTIFY_CHAR_UUID, (data: DataView) => {
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
        const conn = await adapter.connect(deviceIdRef.current, [YS_SERVICE_UUID], handleBleDisconnect);
        connectionRef.current = conn;

        await conn.startNotifications(YS_SERVICE_UUID, YS_NOTIFY_CHAR_UUID, (data: DataView) => {
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
        YS_SERVICE_UUID,
        YS_WRITE_CHAR_UUID,
        encrypted.buffer,
      ).catch((err) => {
        clearTimeout(timeout);
        notifyCallbackRef.current = null;
        setError(translateBleError(err, '发送命令失败'));
        resolve(null);
      });
    });
  }, [ensureConnected]);

  // Handshake: get TokenA
  const handshake = useCallback(async (keyA: Uint8Array): Promise<Uint8Array | null> => {
    try {
      // Plaintext: [01 00 | 14 random bytes]
      const msg = buildMessage([new Uint8Array([0x01, 0x00])]);
      const response = await sendAndReceive(msg, keyA);

      if (!response) return null;

      // Response: [81 00 | TokenA(4 bytes) | ...]
      if (response[0] !== 0x81) {
        setError('握手响应格式错误');
        return null;
      }

      // TokenA at bytes 2-5
      const tokenA = response.slice(2, 6);
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
      // Plaintext: [10 02 | 00*10 | TokenA(4 bytes)]
      const msg = new Uint8Array(16);
      msg[0] = 0x10;
      msg[1] = 0x02;
      msg.set(tokenA, 12); // TokenA at bytes 12-15

      const response = await sendAndReceive(msg, keyA);
      if (!response) return null;

      // Response: [90 02 | data(battery hex) | ...]
      if (response[0] !== 0x90) {
        setError('电量查询响应格式错误');
        return null;
      }

      const batteryHex = response[2];
      const batteryPercent = Math.min(batteryHex, 100);
      setBattery(batteryPercent);
      return batteryPercent;
    } catch (err) {
      setError(translateBleError(err, '电量查询失败'));
      return null;
    }
  }, [sendAndReceive]);

  // Open lock box
  const openLockBox = useCallback(async (
    keyA: Uint8Array,
    tokenB: Uint8Array,
    tokenA: Uint8Array,
  ): Promise<boolean> => {
    try {
      // Plaintext: [20 01 | TokenB(6 bytes) | FF*4 | TokenA(4 bytes)]
      const msg = new Uint8Array(16);
      msg[0] = 0x20;
      msg[1] = 0x01;
      msg.set(tokenB.slice(0, 6), 2);
      msg.set(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]), 8);
      msg.set(tokenA.slice(0, 4), 12);

      const response = await sendAndReceive(msg, keyA);
      if (!response) return false;

      // Response: [A0 01 | status(1 byte) | padding(13 bytes)]
      if (response[0] !== 0xA0) {
        setError('开锁响应格式错误');
        return false;
      }

      const flag = response[2];
      if (flag === 0x00) {
        return true;
      } else {
        setError('开锁指令错误（TokenB 不正确）');
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
    openLockBox,
    disconnect,
  };
}
