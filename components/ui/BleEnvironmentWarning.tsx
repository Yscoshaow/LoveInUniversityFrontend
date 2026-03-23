import React from 'react';
import { Bluetooth, ExternalLink } from 'lucide-react';
import { isTelegramMiniApp, isCapacitorNative } from '../../lib/environment';

interface BleEnvironmentWarningProps {
  /** Compact mode for inline use in panels */
  compact?: boolean;
}

const APP_URL = import.meta.env.VITE_APP_URL || 'https://university.lovein.fun';

export const BleEnvironmentWarning: React.FC<BleEnvironmentWarningProps> = ({ compact = false }) => {
  // No warning needed in Capacitor native — native BLE always works
  if (isCapacitorNative()) return null;

  const inMiniApp = isTelegramMiniApp();

  const handleOpenInBrowser = () => {
    if (inMiniApp) {
      const webApp = (window as any).Telegram?.WebApp;
      // openLink opens URL in external browser
      webApp?.openLink?.(APP_URL);
    } else {
      window.open(APP_URL, '_blank');
    }
  };

  if (compact) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <Bluetooth size={16} />
          <span>蓝牙功能不可用</span>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {inMiniApp
            ? 'Telegram 内置浏览器不支持蓝牙。请在 Chrome 或 Edge 中打开使用。'
            : '当前浏览器不支持蓝牙。请使用 Chrome 或 Edge 浏览器。'}
        </p>
        {inMiniApp && (
          <button
            onClick={handleOpenInBrowser}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-400"
          >
            <ExternalLink size={12} />
            在浏览器中打开
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Bluetooth size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold">蓝牙功能不可用</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {inMiniApp
              ? 'Telegram 内置浏览器不支持蓝牙连接'
              : '当前浏览器不支持 Web Bluetooth API'}
          </p>
        </div>
      </div>
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {inMiniApp
          ? '索迹锁盒需要蓝牙连接。请在 Chrome 或 Edge 浏览器中打开网页版使用蓝牙功能。'
          : '索迹锁盒需要蓝牙连接。请使用 Chrome 或 Edge 浏览器以启用蓝牙功能。'}
      </p>
      {inMiniApp && (
        <button
          onClick={handleOpenInBrowser}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors"
        >
          <ExternalLink size={16} />
          在浏览器中打开
        </button>
      )}
    </div>
  );
};
