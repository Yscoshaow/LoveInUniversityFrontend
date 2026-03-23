export type AppEnvironment = 'telegram-mini-app' | 'browser' | 'capacitor-native';

let cachedEnvironment: AppEnvironment | null = null;

/** Detect if running inside Capacitor native shell (Android/iOS) */
export function isCapacitorNative(): boolean {
  return typeof (window as any).Capacitor !== 'undefined'
    && (window as any).Capacitor.isNativePlatform?.() === true;
}

export function detectEnvironment(): AppEnvironment {
  if (cachedEnvironment) return cachedEnvironment;

  if (isCapacitorNative()) {
    cachedEnvironment = 'capacitor-native';
  } else {
    const webApp = (window as any).Telegram?.WebApp;
    if (webApp && webApp.initData && webApp.initData.length > 0) {
      cachedEnvironment = 'telegram-mini-app';
    } else {
      cachedEnvironment = 'browser';
    }
  }
  return cachedEnvironment;
}

export function isTelegramMiniApp(): boolean {
  return detectEnvironment() === 'telegram-mini-app';
}

/** Returns true for browser AND Capacitor native (both use JWT auth, not Telegram initData) */
export function isBrowser(): boolean {
  const env = detectEnvironment();
  return env === 'browser' || env === 'capacitor-native';
}

/** Running inside Capacitor on iOS — has native Dynamic Island, no need for web island */
export function isNativeIOS(): boolean {
  return isCapacitorNative() && (window as any).Capacitor?.getPlatform?.() === 'ios';
}

/** Whether BLE is available — always true on Capacitor native, depends on browser otherwise */
export function isBleAvailable(): boolean {
  if (isCapacitorNative()) return true;
  return !isTelegramMiniApp() && typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
