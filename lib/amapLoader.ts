/**
 * 高德地图 JS API 动态加载器（仅加载定位插件，不加载地图）
 */

let loadPromise: Promise<void> | null = null;

/**
 * 动态加载高德 JS API 并初始化 Geolocation 插件。
 * 多次调用会复用同一个 Promise。
 */
export function loadAMapGeolocation(key: string): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // 已经加载过
    if ((window as any).AMap?.Geolocation) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geolocation`;
    script.async = true;

    const timeout = setTimeout(() => {
      loadPromise = null;
      reject(new Error('AMap SDK load timeout'));
    }, 8000);

    script.onload = () => {
      clearTimeout(timeout);
      // 等待 AMap 初始化完成
      const check = () => {
        if ((window as any).AMap) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      loadPromise = null;
      reject(new Error('AMap SDK load failed'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface AMapGeoResult {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * 使用高德定位获取当前位置（返回 GCJ-02 坐标）
 */
export function amapGetCurrentPosition(): Promise<AMapGeoResult> {
  return new Promise((resolve, reject) => {
    const AMap = (window as any).AMap;
    if (!AMap) return reject(new Error('AMap not loaded'));

    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 8000,
      // 优先使用 WiFi/IP 定位，精度更高
      GeoLocationFirst: false,
      // 不需要地图展示
      noIpLocate: 0, // 允许 IP 定位作为兜底
    });

    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete' && result.position) {
        resolve({
          lat: result.position.lat,
          lng: result.position.lng,
          accuracy: result.accuracy || 100,
        });
      } else {
        reject(new Error(result?.message || 'AMap geolocation failed'));
      }
    });
  });
}
