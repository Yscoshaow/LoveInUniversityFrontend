import { useState, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import { cardImageApi } from '../lib/api';

export interface CardData {
  name: string;
  avatarUrl: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  major: string;
  studentId: string;
  joinDate: string;
  themeKey?: string;
}

// Bump this when the card template changes visually (layout, sizes, colors, icons)
const CARD_TEMPLATE_VERSION = 3;

function computeHash(data: CardData): string {
  const raw = `v${CARD_TEMPLATE_VERSION}|${data.avatarUrl}|${data.level}|${data.themeKey || 'default'}`;
  return btoa(raw).slice(0, 16);
}

/**
 * Fetch avatar as data URL.
 * 1. Try direct fetch (works for same-origin or CORS-enabled URLs)
 * 2. Fallback: fetch via our backend proxy (bypasses Telegram CDN CORS)
 */
async function fetchAvatarAsDataUrl(url: string): Promise<string> {
  // Try direct fetch first
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    }
  } catch {
    // CORS blocked - expected for Telegram CDN
  }

  // Fallback: fetch via backend proxy (bypasses Telegram CDN CORS)
  try {
    const blob = await cardImageApi.fetchProxyImage(url);
    return await blobToDataUrl(blob);
  } catch {
    // Proxy also failed
  }

  // Last resort: generate initials-based placeholder
  return generateAvatarPlaceholder(url);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function generateAvatarPlaceholder(url: string): string {
  // Extract initials from URL or use default
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('U', 64, 64);
  return canvas.toDataURL('image/png');
}

export function useCardImage(userId: number | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = useCallback(
    async (cardData: CardData): Promise<string | null> => {
      if (!userId) return null;
      setIsGenerating(true);
      setImageUrl(null); // Clear old image so loader shows immediately

      try {
        const hash = computeHash(cardData);

        // Always regenerate from current template (skip server cache)
        // Preprocess avatar for CORS (Telegram CDN blocks direct access)
        const dataUrl = await fetchAvatarAsDataUrl(cardData.avatarUrl);
        setAvatarDataUrl(dataUrl);

        // Wait for React to re-render the card with the new avatar data URL
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (!cardRef.current) {
          throw new Error('Card ref not available');
        }

        // Generate PNG from the hidden card element
        const pngDataUrl = await toPng(cardRef.current, {
          pixelRatio: 2,
          width: 600,
          height: 360,
          cacheBust: true,
          skipAutoScale: true,
          imagePlaceholder: generateAvatarPlaceholder(''),
        });

        // Convert data URL to blob for upload
        const res = await fetch(pngDataUrl);
        const blob = await res.blob();

        // Upload to server cache
        try {
          const result = await cardImageApi.uploadCardImage(userId, blob, hash);
          setImageUrl(result.imageUrl);
          return result.imageUrl;
        } catch {
          // If upload fails, use local data URL directly
          setImageUrl(pngDataUrl);
          return pngDataUrl;
        }
      } catch (err) {
        console.error('Failed to generate card image:', err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [userId]
  );

  const downloadCard = useCallback(
    async (cardData: CardData) => {
      let url = imageUrl;
      if (!url) {
        url = await generateImage(cardData);
      }
      if (!url) return;

      const link = document.createElement('a');
      link.href = url;
      link.download = `campus-card-${cardData.studentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [imageUrl, generateImage]
  );

  return {
    imageUrl,
    isGenerating,
    avatarDataUrl,
    cardRef,
    generateImage,
    downloadCard,
  };
}
