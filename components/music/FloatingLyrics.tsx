import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PictureInPicture2 } from 'lucide-react';
import { useMusicPlayer } from './MusicPlayer';

// TypeScript declarations for Document Picture-in-Picture API
interface DocumentPictureInPictureWindow extends Window {
  close(): void;
}

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: {
    width?: number;
    height?: number;
  }): Promise<DocumentPictureInPictureWindow>;
  window: DocumentPictureInPictureWindow | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

const PIP_WIDTH = 320;
const PIP_HEIGHT = 180;

const PIP_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    overflow: hidden;
    width: ${PIP_WIDTH}px;
    height: ${PIP_HEIGHT}px;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .pip-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px 0;
    flex-shrink: 0;
  }
  .pip-cover {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    background: #1e293b;
    flex-shrink: 0;
  }
  .pip-info {
    flex: 1;
    min-width: 0;
  }
  .pip-title {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #f1f5f9;
    line-height: 1.3;
  }
  .pip-work {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .pip-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .pip-status.playing { background: #a78bfa; animation: pulse 1.5s ease-in-out infinite; }
  .pip-status.paused { background: #475569; }
  .pip-lyrics {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 18px;
    text-align: center;
  }
  .pip-lyric-text {
    font-size: 15px;
    font-weight: 500;
    color: #e2e8f0;
    line-height: 1.5;
    transition: opacity 0.35s ease, transform 0.35s ease;
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .pip-lyric-text.fade-in {
    opacity: 1;
    transform: translateY(0);
  }
  .pip-lyric-text.fade-out {
    opacity: 0;
    transform: translateY(4px);
  }
  .pip-empty {
    font-size: 12px;
    color: #475569;
    font-style: italic;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

export function FloatingLyricsButton({ className = '' }: { className?: string }) {
  const player = useMusicPlayer();
  const [pipWindow, setPipWindow] = useState<DocumentPictureInPictureWindow | null>(null);
  const lyricRef = useRef<string>('');
  const animFrameRef = useRef<number>(0);

  const isSupported = typeof window !== 'undefined' && !!window.documentPictureInPicture;
  const isOpen = !!pipWindow;

  // Update PiP window content reactively
  useEffect(() => {
    if (!pipWindow) return;

    const doc = pipWindow.document;

    // Update title
    const titleEl = doc.getElementById('pip-title');
    if (titleEl) titleEl.textContent = player.currentTrack?.title || '';

    // Update work title
    const workEl = doc.getElementById('pip-work');
    if (workEl) workEl.textContent = player.currentTrack?.workTitle || '';

    // Update cover
    const coverEl = doc.getElementById('pip-cover') as HTMLImageElement | null;
    if (coverEl && player.currentTrack?.coverUrl) {
      coverEl.src = player.currentTrack.coverUrl;
    }
  }, [pipWindow, player.currentTrack?.title, player.currentTrack?.workTitle, player.currentTrack?.coverUrl]);

  // Update playing status indicator
  useEffect(() => {
    if (!pipWindow) return;
    const statusEl = pipWindow.document.getElementById('pip-status');
    if (statusEl) {
      statusEl.className = `pip-status ${player.playing ? 'playing' : 'paused'}`;
    }
  }, [pipWindow, player.playing]);

  // Update lyrics with animation
  useEffect(() => {
    if (!pipWindow) return;
    const lyricEl = pipWindow.document.getElementById('pip-lyric');
    if (!lyricEl) return;

    const newText = player.subtitleText || '';
    if (newText === lyricRef.current) return;

    // Fade out
    lyricEl.classList.remove('fade-in');
    lyricEl.classList.add('fade-out');

    cancelAnimationFrame(animFrameRef.current);
    const timeout = setTimeout(() => {
      lyricRef.current = newText;
      if (newText) {
        lyricEl.textContent = newText;
        lyricEl.className = 'pip-lyric-text fade-in';
      } else {
        lyricEl.innerHTML = '<span class="pip-empty">♪</span>';
        lyricEl.className = 'pip-lyric-text fade-in';
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [pipWindow, player.subtitleText]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      pipWindow?.close();
    };
  }, [pipWindow]);

  const openPip = useCallback(async () => {
    if (!window.documentPictureInPicture) {
      // Show a simple toast-like alert for unsupported browsers
      if (typeof document !== 'undefined') {
        const toast = document.createElement('div');
        toast.textContent = '当前浏览器不支持画中画歌词 (需要 Chrome 116+)';
        Object.assign(toast.style, {
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f1f5f9', padding: '10px 20px',
          borderRadius: '12px', fontSize: '13px', zIndex: '9999',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', transition: 'opacity 0.3s',
        });
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 2500);
        setTimeout(() => toast.remove(), 3000);
      }
      return;
    }

    // If already open, close it
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
      });

      // Inject styles
      const style = pip.document.createElement('style');
      style.textContent = PIP_STYLES;
      pip.document.head.appendChild(style);

      // Build content
      const track = player.currentTrack;
      pip.document.body.innerHTML = `
        <div class="pip-header">
          <img id="pip-cover" class="pip-cover" src="${track?.coverUrl || ''}" alt="" onerror="this.style.display='none'" />
          <div class="pip-info">
            <div id="pip-title" class="pip-title">${track?.title || ''}</div>
            <div id="pip-work" class="pip-work">${track?.workTitle || ''}</div>
          </div>
          <div id="pip-status" class="pip-status ${player.playing ? 'playing' : 'paused'}"></div>
        </div>
        <div class="pip-lyrics">
          <div id="pip-lyric" class="pip-lyric-text fade-in">
            ${player.subtitleText || '<span class="pip-empty">♪</span>'}
          </div>
        </div>
      `;

      lyricRef.current = player.subtitleText || '';

      // Listen for close
      pip.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
    } catch (err) {
      console.warn('Failed to open PiP window:', err);
    }
  }, [pipWindow, player.currentTrack, player.playing, player.subtitleText]);

  if (!isSupported) return null;

  return (
    <button
      onClick={openPip}
      className={`p-2 transition-colors ${
        isOpen
          ? 'text-purple-400 bg-purple-400/10 rounded-full'
          : 'text-white/50 hover:text-white'
      } ${className}`}
      title={isOpen ? '关闭悬浮歌词' : '悬浮歌词'}
    >
      <PictureInPicture2 size={18} />
    </button>
  );
}

export default FloatingLyricsButton;
