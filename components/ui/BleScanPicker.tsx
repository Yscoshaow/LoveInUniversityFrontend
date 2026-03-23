import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bluetooth, Loader2, ChevronRight, X, RefreshCw } from 'lucide-react';
import { getBleAdapter } from '../../lib/ble';
import type { BleDevice } from '../../lib/ble/types';

interface BleScanPickerProps {
  /** Name prefixes to filter by (e.g. ['YS0', 'OKGSS']) */
  namePrefixes: string[];
  /** Optional BLE service UUIDs */
  optionalServices?: string[];
  /** Called when user picks a device */
  onSelect: (device: BleDevice) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Scan timeout in ms (default 15000) */
  timeoutMs?: number;
  /** Whether the picker is open */
  open: boolean;
}

export const BleScanPicker: React.FC<BleScanPickerProps> = ({
  namePrefixes, optionalServices, onSelect, onCancel, timeoutMs = 15000, open,
}) => {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const stopScan = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    setDevices([]);
    setError(null);
    setScanning(true);
    try {
      const adapter = await getBleAdapter();

      // If custom scan is available (Capacitor), use it
      if (adapter.scanDevices) {
        const stop = await adapter.scanDevices({
          namePrefixes,
          onFound: (device) => {
            if (!mountedRef.current) return;
            setDevices(prev => prev.some(d => d.id === device.id) ? prev : [...prev, device]);
          },
          timeoutMs,
        });
        stopRef.current = () => {
          stop();
          if (mountedRef.current) setScanning(false);
        };
        // Auto-stop after timeout
        setTimeout(() => {
          if (mountedRef.current) setScanning(false);
        }, timeoutMs);
      } else {
        // Web BLE: use system picker directly, return result
        const device = await adapter.requestDevice({
          namePrefixes,
          optionalServices,
        });
        if (device.name) {
          onSelect(device);
        }
        setScanning(false);
        return;
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : '搜索失败');
        setScanning(false);
      }
    }
  }, [namePrefixes, optionalServices, onSelect, timeoutMs]);

  // Auto-start scan when opened
  useEffect(() => {
    if (open) {
      startScan();
    }
    return () => {
      stopScan();
    };
  }, [open, startScan, stopScan]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth size={18} className="text-primary" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">搜索蓝牙设备</h3>
          </div>
          <div className="flex items-center gap-1">
            {!scanning && (
              <button
                onClick={(e) => { e.stopPropagation(); startScan(); }}
                className="p-1.5 text-gray-400 hover:text-primary rounded-lg"
                title="重新搜索"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {scanning ? '正在搜索...' : `找到 ${devices.length} 个设备`}
          </span>
          {scanning && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-y-auto">
          {devices.length === 0 && scanning && (
            <div className="px-4 py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-gray-400">正在搜索附近的蓝牙设备...</p>
            </div>
          )}
          {devices.length === 0 && !scanning && !error && (
            <div className="px-4 py-10 text-center">
              <p className="text-xs text-gray-400">未找到设备，请确认设备已开启</p>
            </div>
          )}
          {error && (
            <div className="px-4 py-4 text-center text-xs text-red-500">{error}</div>
          )}
          {devices.map(device => (
            <button
              key={device.id}
              type="button"
              onClick={() => {
                stopScan();
                onSelect(device);
              }}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 border-gray-100 dark:border-gray-700/50 transition-colors active:bg-gray-100 dark:active:bg-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bluetooth size={14} className="text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{device.name || '未知设备'}</div>
                <div className="text-[10px] text-gray-400 truncate">{device.id}</div>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCancel}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
