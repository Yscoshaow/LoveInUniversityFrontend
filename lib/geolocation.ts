import { Geolocation } from '@capacitor/geolocation';
import { detectEnvironment } from './environment';
import { shouldUseAmap } from './chinaDetect';
import { loadAMapGeolocation, amapGetCurrentPosition } from './amapLoader';
import { gcj02ToWgs84 } from './coordTransform';

// 高德 JS API Key — 仅定位用，不加载地图
const AMAP_KEY = '2e3642960d1410ba56c4c47647495216';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** 通过高德获取 WGS-84 坐标，失败返回 null */
async function getPositionViaAmap(): Promise<GeoPosition | null> {
  try {
    await loadAMapGeolocation(AMAP_KEY);
    const result = await amapGetCurrentPosition();
    const [lat, lng] = gcj02ToWgs84(result.lat, result.lng);
    return { latitude: lat, longitude: lng, accuracy: result.accuracy };
  } catch {
    return null;
  }
}

/** 通过原生浏览器 API 获取位置 */
function getPositionViaBrowser(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export async function getCurrentPosition(): Promise<GeoPosition> {
  const env = detectEnvironment();

  if (env === 'capacitor-native') {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  if (env === 'telegram-mini-app') {
    return new Promise((resolve, reject) => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.LocationManager) return reject(new Error('LocationManager not available'));
      tg.LocationManager.init(() => {
        if (!tg.LocationManager.isLocationAvailable) {
          return reject(new Error('Location not available'));
        }
        tg.LocationManager.getLocation((location: any) => {
          if (!location) return reject(new Error('Location denied'));
          resolve({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.horizontal_accuracy || 50,
          });
        });
      });
    });
  }

  // Browser: try Amap for Chinese users, fallback to native
  if (shouldUseAmap()) {
    const amapPos = await getPositionViaAmap();
    if (amapPos) return amapPos;
  }

  return getPositionViaBrowser();
}

export function watchPosition(
  callback: (pos: GeoPosition) => void,
  errorCallback?: (err: Error) => void
): () => void {
  const env = detectEnvironment();

  if (env === 'capacitor-native') {
    let watchId: string | null = null;
    Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err) {
          errorCallback?.(new Error(err.message));
          return;
        }
        if (pos) {
          callback({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      }
    ).then(id => { watchId = id; });

    return () => {
      if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }

  // Telegram Mini App: poll via LocationManager (avoid browser geolocation permission prompts)
  if (env === 'telegram-mini-app') {
    let stopped = false;
    const tg = (window as any).Telegram?.WebApp;

    if (!tg?.LocationManager) {
      errorCallback?.(new Error('LocationManager not available'));
      return () => {};
    }

    const poll = () => {
      if (stopped) return;
      tg.LocationManager.getLocation((location: any) => {
        if (stopped || !location) return;
        callback({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.horizontal_accuracy || 50,
        });
      });
    };

    // Init once, then start polling
    let intervalId: ReturnType<typeof setInterval> | null = null;
    tg.LocationManager.init(() => {
      if (stopped || !tg.LocationManager.isLocationAvailable) return;
      poll(); // initial
      intervalId = setInterval(poll, 5000);
    });

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }

  // Browser: Amap polling mode for Chinese users
  if (shouldUseAmap()) {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fallbackCleanup: (() => void) | null = null;

    // Try loading Amap; if it works, poll every 3s
    loadAMapGeolocation(AMAP_KEY)
      .then(() => {
        if (stopped) return;

        // Initial position
        amapGetCurrentPosition()
          .then(r => {
            if (stopped) return;
            const [lat, lng] = gcj02ToWgs84(r.lat, r.lng);
            callback({ latitude: lat, longitude: lng, accuracy: r.accuracy });
          })
          .catch(() => {});

        // Poll every 3 seconds
        intervalId = setInterval(() => {
          amapGetCurrentPosition()
            .then(r => {
              if (stopped) return;
              const [lat, lng] = gcj02ToWgs84(r.lat, r.lng);
              callback({ latitude: lat, longitude: lng, accuracy: r.accuracy });
            })
            .catch(() => {});
        }, 3000);
      })
      .catch(() => {
        // Amap load failed, fall back to native watchPosition
        if (stopped) return;
        fallbackCleanup = watchPositionNative(callback, errorCallback);
      });

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      fallbackCleanup?.();
    };
  }

  return watchPositionNative(callback, errorCallback);
}

/** Native browser watchPosition (extracted helper) */
function watchPositionNative(
  callback: (pos: GeoPosition) => void,
  errorCallback?: (err: Error) => void
): () => void {
  if (!navigator.geolocation) {
    errorCallback?.(new Error('Geolocation not supported'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => callback({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }),
    (err) => errorCallback?.(new Error(err.message)),
    { enableHighAccuracy: true }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
