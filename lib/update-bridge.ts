import { Capacitor, registerPlugin } from '@capacitor/core';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  changelog: string;
  apkUrl: string;
  apkSize: number;
  publishedAt: string;
  releaseUrl: string;
}

export interface DownloadResult {
  filePath: string;
}

export interface DownloadProgressEvent {
  progress: number;    // 0-100
  downloaded: number;  // bytes
  total: number;       // bytes
}

export interface UpdateBridgePlugin {
  checkForUpdate(): Promise<UpdateCheckResult>;
  downloadUpdate(options: { url: string }): Promise<DownloadResult>;
  installUpdate(): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    cb: (event: DownloadProgressEvent) => void,
  ): Promise<{ remove: () => void }>;
}

export const UpdateBridge: UpdateBridgePlugin | null = Capacitor.isNativePlatform()
  ? registerPlugin<UpdateBridgePlugin>('UpdateBridge')
  : null;
