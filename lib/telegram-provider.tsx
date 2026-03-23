import React, { useEffect, useState } from 'react';

interface TelegramProviderProps {
  children: React.ReactNode;
}

// Store for raw init data
let storedInitData: string | null = null;
// Store for start parameter (from Direct Link: ?startapp=xxx)
let storedStartParam: string | null = null;

export const getInitDataRaw = () => storedInitData;
export const getStartParam = () => storedStartParam;

export const TelegramProvider: React.FC<TelegramProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initTelegram = async () => {
      try {
        // Check if we're in Telegram environment
        // @ts-ignore
        const webApp = window.Telegram?.WebApp;

        if (webApp) {
          // Store the init data for API calls
          storedInitData = webApp.initData;

          // Store the start parameter (from Direct Link: ?startapp=xxx)
          // 格式: user_123456 表示查看用户 123456 的主页
          storedStartParam = webApp.initDataUnsafe?.start_param || null;
          if (storedStartParam) {
            console.log('Start param:', storedStartParam);
          }

          // Tell Telegram the app is ready
          webApp.ready();

          // Expand to full height
          webApp.expand();

          console.log('Telegram WebApp initialized');
        } else {
          // Browser mode — no Telegram WebApp available
          console.log('Browser mode: Running without Telegram WebApp');
        }

        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize Telegram:', err);
        // Continue anyway — browser mode
        setIsReady(true);
      }
    };

    initTelegram();
  }, []);

  if (!isReady) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
