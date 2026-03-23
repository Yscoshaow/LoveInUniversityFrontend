import { isCapacitorNative } from '../environment';
import type { BleAdapter } from './types';

let adapter: BleAdapter | null = null;

/** Get the platform-appropriate BLE adapter (Web Bluetooth or Capacitor native) */
export async function getBleAdapter(): Promise<BleAdapter> {
  if (adapter) return adapter;

  if (isCapacitorNative()) {
    const { CapacitorBleAdapter } = await import('./capacitor-ble-adapter');
    adapter = new CapacitorBleAdapter();
  } else {
    const { WebBleAdapter } = await import('./web-ble-adapter');
    adapter = new WebBleAdapter();
  }

  return adapter;
}

export type { BleDevice, BleConnection, BleAdapter } from './types';

/** Translate common BLE plugin English error messages to Chinese */
export function translateBleError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : '';
  if (!msg) return fallback;
  if (msg.includes('Not connected')) return '未连接到设备';
  if (msg.includes('disconnected') || msg.includes('Disconnected')) return '设备已断开连接';
  if (msg.includes('cancelled') || msg.includes('canceled')) return '';
  if (msg.includes('timeout') || msg.includes('Timeout')) return '蓝牙操作超时';
  if (msg.includes('not found') || msg.includes('Not Found')) return '未找到蓝牙设备';
  if (msg.includes('not available') || msg.includes('Not Available')) return '蓝牙不可用';
  if (msg.includes('permission') || msg.includes('Permission')) return '蓝牙权限被拒绝';
  return fallback;
}
