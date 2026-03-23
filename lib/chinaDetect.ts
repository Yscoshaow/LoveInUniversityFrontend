/**
 * 国内用户检测 + 高德定位偏好管理
 */

const STORAGE_KEY = 'amap-location-pref';
const CHINA_TIMEZONES = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi', 'Asia/Harbin', 'Asia/Kashgar'];

export type AmapPreference = 'auto' | 'on' | 'off';

/** 检测时区是否为中国时区 */
export function isLikelyChinaTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CHINA_TIMEZONES.includes(tz);
  } catch {
    return false;
  }
}

/** 读取用户偏好 */
export function getAmapPreference(): AmapPreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'on' || val === 'off') return val;
  } catch { /* ignore */ }
  return 'auto';
}

/** 保存用户偏好 */
export function setAmapPreference(pref: AmapPreference): void {
  try {
    if (pref === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch { /* ignore */ }
}

/** 综合判断：是否应使用高德定位 */
export function shouldUseAmap(): boolean {
  const pref = getAmapPreference();
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return isLikelyChinaTimezone();
}

/** 获取当前定位模式的显示标签 */
export function getLocationModeLabel(): string {
  const pref = getAmapPreference();
  if (pref === 'on') return '高德定位';
  if (pref === 'off') return 'GPS定位';
  return isLikelyChinaTimezone() ? '高德定位(自动)' : 'GPS定位(自动)';
}
