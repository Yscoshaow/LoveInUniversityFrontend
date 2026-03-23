import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, GraduationCap, LogIn, ClipboardPaste, ChevronDown, ChevronUp } from 'lucide-react';
import { authApi, setJwtToken, User, UserWithRoles } from '../lib/api';
import { isCapacitorNative } from '../lib/environment';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'lovein_university_bot';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1';

interface BrowserLoginPageProps {
  onLogin: (token: string, user: User, permissions?: string[], roleNames?: string[]) => void;
}

export const BrowserLoginPage: React.FC<BrowserLoginPageProps> = ({ onLogin }) => {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const isNative = isCapacitorNative();

  useEffect(() => {
    if (isNative) {
      // Capacitor native: listen for deep link callback with JWT token
      let cleanup: (() => void) | undefined;
      const handleAuthCallback = async (urlStr: string) => {
        // Use string matching instead of new URL() — custom scheme parsing
        // is inconsistent across Android WebView versions
        if (!urlStr.includes('://auth/callback')) return false;
        const tokenMatch = urlStr.match(/[?&]token=([^&]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        if (!token) return false;

        setIsLoading(true);
        setError(null);
        try {
          setJwtToken(token);
          const data = await authApi.getCurrentUser();
          // Close the browser tab that was opened for login
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch {}
          onLogin(token, data.user, data.permissions, data.roleNames);
        } catch (err) {
          setError(err instanceof Error ? err.message : '登录失败，请重试');
          setIsLoading(false);
        }
        return true;
      };
      (async () => {
        try {
          const { App } = await import('@capacitor/app');

          // Cold start: check if app was launched by auth deep link
          const launchUrl = await App.getLaunchUrl();
          if (launchUrl?.url && await handleAuthCallback(launchUrl.url)) {
            return; // Handled via launch URL, no need for listener
          }

          // Warm start: listen for deep link events
          const listener = await App.addListener('appUrlOpen', async (event) => {
            await handleAuthCallback(event.url);
          });
          cleanup = () => listener.remove();
        } catch (e) {
          console.error('Failed to set up deep link listener:', e);
        }
      })();
      return () => { cleanup?.(); };
    } else {
      // Browser mode: embed Telegram Login Widget directly
      (window as any).onTelegramAuth = async (tgUser: any) => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await authApi.loginWithTelegramWidget({
            id: tgUser.id,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || undefined,
            username: tgUser.username || undefined,
            photoUrl: tgUser.photo_url || undefined,
            authDate: tgUser.auth_date,
            hash: tgUser.hash,
          });
          setJwtToken(response.token);
          onLogin(response.token, response.user, response.permissions, response.roleNames);
        } catch (err) {
          setError(err instanceof Error ? err.message : '登录失败，请重试');
          setIsLoading(false);
        }
      };

      if (widgetRef.current) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.setAttribute('data-radius', '12');
        script.async = true;
        widgetRef.current.appendChild(script);
      }

      return () => { delete (window as any).onTelegramAuth; };
    }
  }, [onLogin, isNative]);

  const handleNativeLogin = async () => {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: `${API_BASE_URL}/auth/app-login` });
    } catch (e) {
      setError('无法打开登录页面');
    }
  };

  const handleManualLogin = async () => {
    const input = manualUrl.trim();
    if (!input) return;
    // Accept scheme URL: com.lovein.university://auth/callback?token=xxx
    // Or raw JWT token string
    let token: string | null = null;
    if (input.includes('://auth/callback')) {
      const match = input.match(/[?&]token=([^&]+)/);
      token = match ? decodeURIComponent(match[1]) : null;
    } else if (input.length > 20 && !input.includes(' ')) {
      // Looks like a raw JWT token
      token = input;
    }
    if (!token) {
      setError('无法识别的链接或令牌格式');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setJwtToken(token);
      const data = await authApi.getCurrentUser();
      onLogin(token, data.user, data.permissions, data.roleNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : '令牌无效或已过期');
      setIsLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualUrl(text);
        // Auto-submit if it looks like a valid callback URL
        if (text.includes('://auth/callback') && text.includes('token=')) {
          setManualUrl(text);
          // Trigger login after state update
          setTimeout(() => {
            const input = text.trim();
            const match = input.match(/[?&]token=([^&]+)/);
            const token = match ? decodeURIComponent(match[1]) : null;
            if (token) {
              setIsLoading(true);
              setError(null);
              setJwtToken(token);
              authApi.getCurrentUser().then(data => {
                onLogin(token, data.user, data.permissions, data.roleNames);
              }).catch(err => {
                setError(err instanceof Error ? err.message : '令牌无效或已过期');
                setIsLoading(false);
              });
            }
          }, 0);
        }
      }
    } catch {
      setError('无法读取剪贴板，请手动粘贴');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <GraduationCap size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">LoveIn University</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{isNative ? 'App 登录' : '浏览器登录'}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">欢迎回来</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">使用 Telegram 账号登录以继续</p>
          </div>

          {isNative ? (
            /* Capacitor native: button to open external browser for login */
            isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">正在登录...</span>
              </div>
            ) : (
              <button
                onClick={handleNativeLogin}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-white bg-[#54a9eb] hover:bg-[#4a96d1] active:bg-[#4189c0] transition-colors"
              >
                <LogIn size={18} />
                使用 Telegram 登录
              </button>
            )
          ) : (
            /* Browser: embed Telegram Login Widget */
            isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">正在登录...</span>
              </div>
            ) : (
              <div ref={widgetRef} className="flex justify-center py-2" />
            )
          )}

          {/* Manual login fallback for LiveContainer / sideload environments */}
          {isNative && !isLoading && (
            <div className="space-y-3">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:text-slate-400 transition-colors py-1"
              >
                {showManualInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                手动输入登录链接
              </button>
              {showManualInput && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    使用 LiveContainer 等容器环境时，登录跳转可能失败。请在浏览器中复制回调链接，粘贴到下方：
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualLogin()}
                      placeholder="粘贴回调链接或令牌..."
                      className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                    <button
                      onClick={handlePasteFromClipboard}
                      className="shrink-0 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-primary hover:border-primary/30 transition-colors"
                      title="从剪贴板粘贴"
                    >
                      <ClipboardPaste size={18} />
                    </button>
                  </div>
                  <button
                    onClick={handleManualLogin}
                    disabled={!manualUrl.trim()}
                    className="w-full py-2 rounded-xl text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    登录
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!isNative && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 dark:text-slate-500">或</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Open in Telegram link */}
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}/university`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              >
                <ExternalLink size={16} />
                在 Telegram 中打开
              </a>
            </>
          )}
        </div>

        {!isNative && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-6">
            需要蓝牙功能？请使用 Chrome 或 Edge 浏览器
          </p>
        )}
      </div>
    </div>
  );
};
