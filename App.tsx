import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { MainLayout } from './components/layout';
import { TelegramProvider } from './lib/telegram-provider';
import { AuthProvider, useAuth, useUserDisplayName } from './lib/auth-context';
import { TherapyProvider } from './contexts/TherapyContext';
import { EnrollmentWelcome } from './components/academic/EnrollmentWelcome';
import { BrowserLoginPage } from './components/BrowserLoginPage';
import { Loader2 } from 'lucide-react';
import { queryClient } from './lib/query-client';
import { detectEnvironment } from './lib/environment';
import { UpdateDialog } from './components/UpdateDialog';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmProvider } from '@/hooks/useConfirm';

// Set safe area top inset based on environment
function useSafeAreaInset() {
  useEffect(() => {
    const env = detectEnvironment();

    const updateSafeTop = () => {
      let safeTop = '0px';
      if (env === 'capacitor-native') {
        safeTop = '32px';
      } else if (env === 'telegram-mini-app') {
        const webApp = (window as any).Telegram?.WebApp;
        // Only need safe area when fullscreen (TG header is hidden)
        if (webApp?.isFullscreen) {
          const platform = webApp.platform || '';
          const isMobile = platform === 'android' || platform === 'ios';
          safeTop = isMobile ? '80px' : '0px';
        }
      }
      document.documentElement.style.setProperty('--safe-top', safeTop);
    };

    updateSafeTop();

    // Listen for fullscreen changes in TG Mini App
    if (env === 'telegram-mini-app') {
      const webApp = (window as any).Telegram?.WebApp;
      webApp?.onEvent?.('fullscreenChanged', updateSafeTop);
      return () => webApp?.offEvent?.('fullscreenChanged', updateSafeTop);
    }
  }, []);
}

// Block right-click / long-press on images, prevent Ctrl+S / drag
function useImageProtection() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'IMG') {
        e.preventDefault();
      }
    };
    const handleDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'IMG') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);
}

// Inner component that uses auth context
const AppContent: React.FC = () => {
  useSafeAreaInset();
  useImageProtection();
  const { isLoading, isAuthenticated, showEnrollment, isEnrolling, needsBrowserLogin, loginWithWidget, completeEnrollment } = useAuth();
  const displayName = useUserDisplayName();

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="h-dvh-safe w-full bg-slate-900 flex flex-col">
        <div className="bg-slate-900" style={{ height: 'var(--safe-top)', flexShrink: 0 }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 size={48} className="text-secondary animate-spin mx-auto" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">正在连接...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show browser login page when in browser mode without auth
  if (needsBrowserLogin) {
    return <BrowserLoginPage onLogin={loginWithWidget} />;
  }

  // Show enrollment welcome for users who haven't completed enrollment
  if (isAuthenticated && showEnrollment) {
    return (
      <div style={{ paddingTop: 'var(--safe-top)' }}>
        <EnrollmentWelcome
          userName={displayName}
          onComplete={completeEnrollment}
          isEnrolling={isEnrolling}
        />
      </div>
    );
  }

  // Show main app
  return (
    <div className="h-dvh-safe w-full bg-slate-50 dark:bg-slate-900 font-sans overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      <MainLayout />
      <UpdateDialog />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="lovein-theme">
      <QueryClientProvider client={queryClient}>
        <TelegramProvider>
          <AuthProvider>
            <TherapyProvider>
              <ConfirmProvider>
                <AppContent />
                <Toaster position="top-center" richColors closeButton duration={2500} />
              </ConfirmProvider>
            </TherapyProvider>
          </AuthProvider>
        </TelegramProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
