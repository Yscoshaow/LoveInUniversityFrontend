import React from 'react';
import { Download, ExternalLink, X, Loader2, AlertCircle } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';

export const UpdateDialog: React.FC = () => {
  const {
    updateAvailable,
    latestVersion,
    changelog,
    releaseUrl,
    downloadProgress,
    isDownloading,
    error,
    canSelfInstall,
    downloadAndInstall,
    dismiss,
  } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            发现新版本
          </h3>
          <button
            onClick={dismiss}
            disabled={isDownloading}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">最新版本</span>
            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full">
              v{latestVersion}
            </span>
          </div>

          {changelog && (
            <div className="text-sm text-slate-600 dark:text-slate-300 max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-lg p-3 whitespace-pre-wrap">
              {changelog}
            </div>
          )}

          {isDownloading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>下载中...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, downloadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg p-3">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 space-y-2">
          {canSelfInstall ? (
            <button
              onClick={downloadAndInstall}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  下载中 {downloadProgress}%
                </>
              ) : (
                <>
                  <Download size={18} />
                  下载并安装
                </>
              )}
            </button>
          ) : (
            <a
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={18} />
              查看更新
            </a>
          )}
          <button
            onClick={dismiss}
            disabled={isDownloading}
            className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
};
