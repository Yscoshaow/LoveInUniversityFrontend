/**
 * Cross-platform action utilities.
 *
 * Provides unified APIs for sharing, opening links, haptics, etc.
 * Falls back gracefully across Telegram Mini App → Capacitor native → browser.
 */

import { detectEnvironment } from './environment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWebApp(): any {
  return (window as any).Telegram?.WebApp;
}

function isTg(): boolean {
  return detectEnvironment() === 'telegram-mini-app';
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

export interface ShareOptions {
  /** Text to share */
  text: string;
  /** Optional URL to include */
  url?: string;
  /** Telegram inline query (used when in TG Mini App with switchInlineQuery) */
  inlineQuery?: string;
  /** Telegram inline query chat types */
  inlineChatTypes?: string[];
}

/**
 * Share content — tries in order:
 * 1. Telegram switchInlineQuery (if in TG + inlineQuery provided)
 * 2. Telegram share URL via openTelegramLink
 * 3. Web Share API (navigator.share — works on Capacitor + modern mobile browsers)
 * 4. Copy to clipboard as last resort
 *
 * Returns true if shared, false if fell through to clipboard.
 */
export async function platformShare(options: ShareOptions): Promise<boolean> {
  const { text, url, inlineQuery, inlineChatTypes = ['users', 'groups', 'channels'] } = options;
  const webApp = getWebApp();

  // 1. Telegram inline mode
  if (inlineQuery != null && webApp?.switchInlineQuery) {
    webApp.switchInlineQuery(inlineQuery, inlineChatTypes);
    return true;
  }

  // 2. Telegram share URL
  if (webApp?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url || window.location.origin)}&text=${encodeURIComponent(text)}`;
    webApp.openTelegramLink(shareUrl);
    return true;
  }

  // 3. Web Share API (Capacitor native + mobile browsers)
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return true;
    } catch {
      // User cancelled or share failed — fall through
    }
  }

  // 4. Clipboard fallback
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  } catch {
    // Clipboard also failed — nothing we can do
  }
  return false;
}

// ---------------------------------------------------------------------------
// Open external link
// ---------------------------------------------------------------------------

/**
 * Open a URL in the appropriate way for the current platform.
 * - TG Mini App → webApp.openLink (opens external browser)
 * - Others → window.open
 */
export function platformOpenLink(url: string) {
  const webApp = getWebApp();
  if (webApp?.openLink) {
    webApp.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ---------------------------------------------------------------------------
// Open Telegram chat / profile
// ---------------------------------------------------------------------------

/**
 * Open a Telegram user's profile/chat.
 * - TG Mini App → webApp.openTelegramLink
 * - Others → window.open t.me link
 */
export function platformOpenTelegramChat(username?: string | null, telegramId?: number) {
  const webApp = getWebApp();

  if (username) {
    const url = `https://t.me/${username}`;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else if (telegramId) {
    // tg:// protocol works in Telegram's WebView and when Telegram is installed
    window.location.href = `tg://user?id=${telegramId}`;
  }
}

// ---------------------------------------------------------------------------
// Open Telegram link (t.me/*)
// ---------------------------------------------------------------------------

/**
 * Open a t.me link. In Telegram, uses the native handler; otherwise opens in browser.
 */
export function platformOpenTelegramLink(url: string) {
  const webApp = getWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ---------------------------------------------------------------------------
// Haptic feedback
// ---------------------------------------------------------------------------

/**
 * Trigger haptic feedback. Silently no-ops if unavailable.
 * - TG Mini App → WebApp.HapticFeedback
 * - Capacitor → navigator.vibrate (basic)
 * - Browser → navigator.vibrate if available
 */
export function platformHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const webApp = getWebApp();
    if (webApp?.HapticFeedback?.impactOccurred) {
      webApp.HapticFeedback.impactOccurred(style);
      return;
    }
    // Fallback: Web Vibration API
    if (navigator.vibrate) {
      const ms = style === 'light' ? 10 : style === 'medium' ? 25 : 50;
      navigator.vibrate(ms);
    }
  } catch {
    // Silently ignore
  }
}

// ---------------------------------------------------------------------------
// Close / go back
// ---------------------------------------------------------------------------

/**
 * Close the mini app or navigate back.
 * - TG Mini App → webApp.close()
 * - Others → history.back()
 */
export function platformClose() {
  const webApp = getWebApp();
  if (webApp?.close) {
    webApp.close();
  } else {
    window.history.back();
  }
}
