import { useState, useEffect, useCallback, useRef } from 'react';
import { UpdateBridge } from '../lib/update-bridge';
import type { UpdateCheckResult, DownloadProgressEvent } from '../lib/update-bridge';
import { Capacitor } from '@capacitor/core';

// Module-level flag: only check once per app session
let sessionChecked = false;

export interface AppUpdateState {
  updateAvailable: boolean;
  latestVersion: string;
  changelog: string;
  releaseUrl: string;
  downloadProgress: number;
  isDownloading: boolean;
  isChecking: boolean;
  error: string | null;
  canSelfInstall: boolean;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(-1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const apkUrlRef = useRef('');
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const canSelfInstall = isAndroid;

  const checkForUpdate = useCallback(async () => {
    if (!UpdateBridge) return;
    setIsChecking(true);
    setError(null);

    try {
      const result: UpdateCheckResult = await UpdateBridge.checkForUpdate();
      setLatestVersion(result.latestVersion);
      setChangelog(result.changelog);
      setReleaseUrl(result.releaseUrl);
      apkUrlRef.current = result.apkUrl;

      if (result.updateAvailable) {
        setUpdateAvailable(true);
        setDismissed(false);
      }
    } catch (e: any) {
      // Silently fail on auto-check — don't bother user with network errors
      console.warn('Update check failed:', e.message);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!UpdateBridge || !apkUrlRef.current) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);

    try {
      // Listen for progress events
      listenerRef.current = await UpdateBridge.addListener(
        'downloadProgress',
        (event: DownloadProgressEvent) => {
          setDownloadProgress(event.progress);
        },
      );

      // Download
      await UpdateBridge.downloadUpdate({ url: apkUrlRef.current });

      // Remove listener
      listenerRef.current?.remove();
      listenerRef.current = null;

      setDownloadProgress(100);

      // Install (may redirect to settings for install permission)
      try {
        await UpdateBridge.installUpdate();
      } catch (installErr: any) {
        if (installErr.message === 'INSTALL_PERMISSION_REQUIRED') {
          // User was redirected to settings. They'll come back and retry.
          setError('请允许安装权限后重试');
        } else {
          throw installErr;
        }
      }
    } catch (e: any) {
      if (!error) setError(e.message || '下载失败');
      listenerRef.current?.remove();
      listenerRef.current = null;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Auto-check on mount (once per session)
  useEffect(() => {
    if (!UpdateBridge || sessionChecked) return;
    sessionChecked = true;

    // Delay check slightly so it doesn't block app startup
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    updateAvailable: updateAvailable && !dismissed,
    latestVersion,
    changelog,
    releaseUrl,
    downloadProgress,
    isDownloading,
    isChecking,
    error,
    canSelfInstall,
    checkForUpdate,
    downloadAndInstall,
    dismiss,
  };
}
