/**
 * Local settings stored in cookies
 * These settings are client-side only and don't sync with the server
 */

// Cookie utility functions
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// Settings keys
const SETTINGS_KEYS = {
  CARD_3D_EFFECT: 'card_3d_effect_enabled',
  IMMERSIVE_INTERACTION: 'immersive_interaction_enabled',
  ROULETTE_COVER_BG: 'roulette_cover_bg_enabled',
} as const;

// Local settings interface
export interface LocalSettings {
  card3DEffectEnabled: boolean;
  immersiveInteractionEnabled: boolean;
  rouletteCoverBgEnabled: boolean;
}

// Default settings
const DEFAULT_SETTINGS: LocalSettings = {
  card3DEffectEnabled: true,
  immersiveInteractionEnabled: false,
  rouletteCoverBgEnabled: false,
};

/**
 * Get all local settings
 */
export function getLocalSettings(): LocalSettings {
  if (typeof document === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  return {
    card3DEffectEnabled: getCookie(SETTINGS_KEYS.CARD_3D_EFFECT) !== 'false',
    immersiveInteractionEnabled: getCookie(SETTINGS_KEYS.IMMERSIVE_INTERACTION) === 'true',
    rouletteCoverBgEnabled: getCookie(SETTINGS_KEYS.ROULETTE_COVER_BG) === 'true',
  };
}

/**
 * Check if 3D card effect is enabled
 */
export function isCard3DEffectEnabled(): boolean {
  if (typeof document === 'undefined') return true;
  return getCookie(SETTINGS_KEYS.CARD_3D_EFFECT) !== 'false';
}

/**
 * Set 3D card effect enabled state
 */
export function setCard3DEffectEnabled(enabled: boolean): void {
  setCookie(SETTINGS_KEYS.CARD_3D_EFFECT, enabled ? 'true' : 'false');
}

/**
 * Check if immersive interaction (biometric fingerprint) is enabled
 */
export function isImmersiveInteractionEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  return getCookie(SETTINGS_KEYS.IMMERSIVE_INTERACTION) === 'true';
}

/**
 * Set immersive interaction enabled state
 */
export function setImmersiveInteractionEnabled(enabled: boolean): void {
  setCookie(SETTINGS_KEYS.IMMERSIVE_INTERACTION, enabled ? 'true' : 'false');
}

/**
 * Check if roulette cover background is enabled by default
 */
export function isRouletteCoverBgEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  return getCookie(SETTINGS_KEYS.ROULETTE_COVER_BG) === 'true';
}

/**
 * Set roulette cover background default enabled state
 */
export function setRouletteCoverBgEnabled(enabled: boolean): void {
  setCookie(SETTINGS_KEYS.ROULETTE_COVER_BG, enabled ? 'true' : 'false');
}
