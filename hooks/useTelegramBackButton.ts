import { useEffect, useCallback, useRef } from 'react';
import { isTelegramMiniApp } from '../lib/environment';

interface UseTelegramBackButtonOptions {
  /** Whether the back button should be visible */
  shouldShow: boolean;
  /** Callback when back button is pressed */
  onBack: () => void;
}

/**
 * Manages the Telegram Mini App native BackButton.
 * Shows/hides the button and registers the click handler.
 * No-ops when not running inside Telegram.
 */
export function useTelegramBackButton({ shouldShow, onBack }: UseTelegramBackButtonOptions) {
  const callbackRef = useRef(onBack);
  callbackRef.current = onBack;

  // Stable function identity for onClick/offClick registration
  const stableHandler = useCallback(() => callbackRef.current(), []);

  useEffect(() => {
    if (!isTelegramMiniApp()) return;

    const bb = (window as any).Telegram?.WebApp?.BackButton;
    if (!bb) return;

    if (shouldShow) {
      bb.show();
      bb.onClick(stableHandler);
    } else {
      bb.hide();
      bb.offClick(stableHandler);
    }

    return () => {
      bb.offClick(stableHandler);
      bb.hide();
    };
  }, [shouldShow, stableHandler]);
}
