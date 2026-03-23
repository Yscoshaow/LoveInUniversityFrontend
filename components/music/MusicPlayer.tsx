import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown, ChevronUp,
  Volume2, VolumeX, RotateCcw, RotateCw, List, MessageSquareText, X,
} from 'lucide-react';
import { musicApi, MusicBridge } from '../../lib/api';
import { isNativeIOS } from '../../lib/environment';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-client';

// ==================== Types ====================

export interface MusicTrack {
  hash: string;
  title: string;
  duration: number;
  audioUrl: string;
  subtitleUrl?: string;
  workId: number;
  workTitle: string;
  coverUrl: string;
  isWatchLater?: boolean;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface MusicPlayerState {
  playlist: MusicTrack[];
  currentIndex: number;
  currentTrack: MusicTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  playbackRate: number;
  subtitleText: string;
  subtitleCues: SubtitleCue[];
  analyserNode: AnalyserNode | null;
}

interface MusicPlayerAPI extends MusicPlayerState {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  seekBy: (delta: number) => void;
  next: () => void;
  prev: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleMute: () => void;
  setPlaylist: (tracks: MusicTrack[], startIndex?: number) => void;
  addToQueue: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
}

const defaultState: MusicPlayerAPI = {
  playlist: [],
  currentIndex: -1,
  currentTrack: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  muted: false,
  playbackRate: 1,
  subtitleText: '',
  subtitleCues: [],
  analyserNode: null,
  toggle: () => {},
  play: () => {},
  pause: () => {},
  seekTo: () => {},
  seekBy: () => {},
  next: () => {},
  prev: () => {},
  setPlaybackRate: () => {},
  toggleMute: () => {},
  setPlaylist: () => {},
  addToQueue: () => {},
  removeFromQueue: () => {},
};

const MusicPlayerContext = createContext<MusicPlayerAPI>(defaultState);

export const useMusicPlayer = () => useContext(MusicPlayerContext);

// ==================== WebVTT Parser ====================

function parseWebVTT(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) i++;

  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('-->')) {
      const parts = line.split('-->').map(s => s.trim());
      const start = parseTimeStamp(parts[0]);
      const end = parseTimeStamp(parts[1]);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      if (start >= 0 && end >= 0) {
        cues.push({ start, end, text: textLines.join('\n') });
      }
    } else {
      i++;
    }
  }
  return cues;
}

function parseTimeStamp(ts: string): number {
  // Handle both "HH:MM:SS.mmm" and "MM:SS.mmm"
  const cleaned = ts.replace(/[^\d:.]/g, '');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return -1;
}

// ==================== Provider ====================

export function MusicPlayerProvider({ children, navVisible = false, inMusicRoom = false }: { children: React.ReactNode; navVisible?: boolean; inMusicRoom?: boolean }) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const corsFailedRef = useRef(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const [playlist, setPlaylistState] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleText, setSubtitleText] = useState('');

  // Progress save timer
  const lastSaveRef = useRef(0);
  const currentTrack = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;

  // Lazily initialize Web Audio API (must happen after user gesture)
  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current || !audioRef.current) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioContextRef.current = ctx;
      setAnalyserNode(analyser);
    } catch {}
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
    }

    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Save progress every 30 seconds
      const now = Date.now();
      if (now - lastSaveRef.current > 30000 && currentTrack) {
        lastSaveRef.current = now;
        musicApi.saveProgress(currentTrack.workId, currentTrack.hash, audio.currentTime, audio.duration).catch(() => {});
      }
    };
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      // Save progress on pause
      if (currentTrack && audio.currentTime > 0) {
        musicApi.saveProgress(currentTrack.workId, currentTrack.hash, audio.currentTime, audio.duration).catch(() => {});
      }
    };
    const onEnded = () => {
      // 稍后再听：作品最后一首播完后自动从歌单移除
      if (currentTrack?.isWatchLater) {
        const nextTrack = playlist[currentIndex + 1];
        if (!nextTrack || nextTrack.workId !== currentTrack.workId) {
          musicApi.removeFromWatchLater(currentTrack.workId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.music.watchLater() });
              queryClient.invalidateQueries({ queryKey: queryKeys.music.watchLaterItems() });
            })
            .catch(console.error);
        }
      }
      // Auto next
      setCurrentIndex(prev => {
        if (prev < playlist.length - 1) return prev + 1;
        setPlaying(false);
        return prev;
      });
    };
    // CORS fallback: if audio fails to load with CORS, retry without
    const onError = () => {
      if (!corsFailedRef.current && audio.crossOrigin === 'anonymous') {
        corsFailedRef.current = true;
        audio.crossOrigin = '';
        audio.load();
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentTrack, playlist.length]);

  // Load track when currentIndex changes
  useEffect(() => {
    if (!audioRef.current || currentIndex < 0 || currentIndex >= playlist.length) return;
    const track = playlist[currentIndex];
    const audio = audioRef.current;

    audio.src = track.audioUrl;
    audio.playbackRate = playbackRate;
    audio.muted = muted;
    setCurrentTime(0);
    setDuration(0);
    setSubtitleCues([]);
    setSubtitleText('');
    lastSaveRef.current = Date.now();

    // Load subtitle
    if (track.subtitleUrl) {
      fetch(track.subtitleUrl)
        .then(r => r.text())
        .then(text => setSubtitleCues(parseWebVTT(text)))
        .catch(() => setSubtitleCues([]));
    }

    audio.play().catch(() => {});
  }, [currentIndex, playlist]);

  // Update subtitle text based on current time
  useEffect(() => {
    if (subtitleCues.length === 0) {
      setSubtitleText('');
      return;
    }
    const cue = subtitleCues.find(c => currentTime >= c.start && currentTime <= c.end);
    setSubtitleText(cue?.text || '');
  }, [currentTime, subtitleCues]);

  // API
  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    ensureAudioContext();
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [ensureAudioContext]);

  const playAudio = useCallback(() => {
    if (!audioRef.current) return;
    ensureAudioContext();
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    audioRef.current.play().catch(() => {});
  }, [ensureAudioContext]);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const seekBy = useCallback((delta: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + delta));
  }, []);

  const next = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, playlist.length]);

  const prev = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  }, []);

  const setPlaylist = useCallback((tracks: MusicTrack[], startIndex = 0) => {
    setPlaylistState(tracks);
    setCurrentIndex(startIndex);
  }, []);

  const addToQueue = useCallback((track: MusicTrack) => {
    setPlaylistState(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setPlaylistState(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setCurrentIndex(ci => {
      if (index < ci) return ci - 1;
      if (index === ci) return ci; // will auto-play next track at same index
      return ci;
    });
  }, []);

  // Android widget: push state to native
  useEffect(() => {
    if (!MusicBridge) return;
    if (!currentTrack) {
      MusicBridge.clearState().catch(() => {});
      return;
    }
    MusicBridge.updateState({
      trackHash: currentTrack.hash,
      trackTitle: currentTrack.title,
      workTitle: currentTrack.workTitle || '',
      coverUrl: currentTrack.coverUrl || '',
      playing,
      currentTime,
      duration,
      currentIndex,
      playlistSize: playlist.length,
      subtitleText: subtitleText || '',
    }).catch(() => {});
  }, [currentTrack?.hash, playing, Math.floor(currentTime / 5), duration, currentIndex, playlist.length, subtitleText]);

  // Android widget: listen for commands from widget buttons
  useEffect(() => {
    if (!MusicBridge) return;
    let removed = false;
    let removeFn: (() => void) | null = null;
    MusicBridge.addListener('musicCommand', (data: { command: string }) => {
      if (removed) return;
      switch (data.command) {
        case 'play_pause': toggle(); break;
        case 'next': next(); break;
        case 'prev': prev(); break;
      }
    }).then(handle => { removeFn = handle.remove; });
    return () => { removed = true; removeFn?.(); };
  }, [toggle, next, prev]);

  const api = useMemo<MusicPlayerAPI>(() => ({
    playlist, currentIndex, currentTrack, playing, currentTime, duration,
    muted, playbackRate, subtitleText, subtitleCues, analyserNode,
    toggle, play: playAudio, pause: pauseAudio, seekTo, seekBy,
    next, prev, setPlaybackRate, toggleMute, setPlaylist, addToQueue, removeFromQueue,
  }), [
    playlist, currentIndex, currentTrack, playing, currentTime, duration,
    muted, playbackRate, subtitleText, subtitleCues, analyserNode,
    toggle, playAudio, pauseAudio, seekTo, seekBy,
    next, prev, setPlaybackRate, toggleMute, setPlaylist, addToQueue, removeFromQueue,
  ]);

  return (
    <MusicPlayerContext.Provider value={api}>
      {children}
      {currentTrack && <MusicPlayerBar navVisible={navVisible} inMusicRoom={inMusicRoom} />}
    </MusicPlayerContext.Provider>
  );
}

// ==================== Animated Spectrum Bars ====================

function AnimatedSpectrum({ playing, barCount = 16, height = 24, className = '' }: {
  playing: boolean;
  barCount?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-0.5 ${className}`} style={{ height }}>
      {Array.from({ length: barCount }).map((_, i) => {
        // Stagger animation delays for natural look
        const delay = (i * 0.08 + (i % 3) * 0.05).toFixed(2);
        const baseHeight = playing ? '20%' : '12%';
        return (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              background: `linear-gradient(to top, rgb(${147 + Math.floor((i / barCount) * 89)}, ${51 + Math.floor((i / barCount) * 30)}, ${234 - Math.floor((i / barCount) * 34)}), rgba(168,85,247,0.5))`,
              height: baseHeight,
              animation: playing ? `spectrumBounce 0.8s ease-in-out ${delay}s infinite alternate` : 'none',
              transition: 'height 0.3s ease',
              minWidth: 2,
            }}
          />
        );
      })}
      <style>{`
        @keyframes spectrumBounce {
          0% { height: 15%; }
          50% { height: ${Math.floor(height * 0.9)}px; }
          100% { height: 30%; }
        }
      `}</style>
    </div>
  );
}

// ==================== Real-time Spectrum (Web Audio API) ====================

function RealtimeSpectrum({ analyser, playing, barCount = 24, height = 40, className = '' }: {
  analyser: AnalyserNode | null;
  playing: boolean;
  barCount?: number;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [useFallback, setUseFallback] = useState(false);
  const zeroFramesRef = useRef(0);

  useEffect(() => {
    setUseFallback(false);
    zeroFramesRef.current = 0;
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || useFallback) return;

    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);

      analyser.getByteFrequencyData(dataArray);

      // Detect tainted audio (all zeros while playing)
      if (playing) {
        const hasData = dataArray.some(v => v > 0);
        if (!hasData) {
          zeroFramesRef.current++;
          if (zeroFramesRef.current > 60) {
            setUseFallback(true);
            return;
          }
        } else {
          zeroFramesRef.current = 0;
        }
      }

      const gap = 1;
      const barWidth = (w - (barCount - 1) * gap) / barCount;
      const step = Math.max(1, Math.floor(bufferLength / barCount));

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j] || 0;
        const value = (sum / step) / 255;
        const barHeight = Math.max(2, value * h * 0.95);
        const x = i * (barWidth + gap);

        const r = 147 + Math.floor((i / barCount) * 89);
        const g = 51 + Math.floor((i / barCount) * 30);
        const b = 234 - Math.floor((i / barCount) * 34);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + value * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(x, h - barHeight, barWidth, barHeight, 1);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser, playing, useFallback, barCount, height]);

  if (!analyser || useFallback) {
    return <AnimatedSpectrum playing={playing} barCount={barCount} height={height} className={className} />;
  }

  return <canvas ref={canvasRef} className={`w-full ${className}`} style={{ height }} />;
}

// ==================== Lyrics View (Apple Music style) ====================

function LyricsView({ cues, currentTime, onSeek, onClose }: {
  cues: SubtitleCue[];
  currentTime: number;
  onSeek: (time: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const userScrolling = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find current active cue index
  const activeIndex = useMemo(() => {
    for (let i = cues.length - 1; i >= 0; i--) {
      if (currentTime >= cues[i].start - 0.15) return i;
    }
    return -1;
  }, [cues, currentTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (userScrolling.current || !activeRef.current || !containerRef.current) return;
    activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  // Detect user scroll → pause auto-scroll for 4 seconds
  const handleScroll = useCallback(() => {
    userScrolling.current = true;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => { userScrolling.current = false; }, 4000);
  }, []);

  useEffect(() => {
    return () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-2 shrink-0">
        <h3 className="text-sm font-semibold text-white/50">字幕</h3>
        <button
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white/60 bg-white/10 dark:bg-slate-800/10 px-3 py-1 rounded-full transition-colors"
        >
          封面
        </button>
      </div>

      {/* Scrollable lyrics */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 pb-16 mask-fade-y"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        {/* Top spacer for centering first line */}
        <div className="h-[30vh]" />

        {cues.map((cue, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : undefined}
              onClick={() => {
                onSeek(cue.start);
                userScrolling.current = false;
              }}
              className={`block w-full text-left py-2.5 transition-all duration-500 ease-out ${
                isActive
                  ? 'scale-100 opacity-100'
                  : isPast
                    ? 'scale-[0.97] opacity-30'
                    : 'scale-[0.97] opacity-40'
              }`}
            >
              <p className={`whitespace-pre-wrap leading-relaxed transition-all duration-500 ${
                isActive
                  ? 'text-xl font-bold text-white'
                  : 'text-base font-medium text-white/70'
              }`}>
                {cue.text}
              </p>
            </button>
          );
        })}

        {/* Bottom spacer */}
        <div className="h-[40vh]" />
      </div>
    </div>
  );
}

// ==================== Player Bar (Bottom Fixed) ====================

function MusicPlayerBar({ navVisible, inMusicRoom }: { navVisible: boolean; inMusicRoom: boolean }) {
  const player = useMusicPlayer();
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const progressPercent = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const hasSubtitles = player.subtitleCues.length > 0;

  // Dynamic Island states: compact (default) vs expanded island
  const [islandExpanded, setIslandExpanded] = useState(false);
  const [showIslandSubtitle, setShowIslandSubtitle] = useState(true);
  const islandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTrackRef = useRef<string | null>(null);

  // Debounced subtitle text for island — holds last text for 2s to prevent rapid shrink/expand
  const [islandSubtitleText, setIslandSubtitleText] = useState('');
  const subtitleClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (player.subtitleText) {
      // New text arrived — show immediately, cancel any pending clear
      if (subtitleClearTimer.current) clearTimeout(subtitleClearTimer.current);
      setIslandSubtitleText(player.subtitleText);
    } else {
      // Text went blank — delay clearing to avoid flicker between cues
      subtitleClearTimer.current = setTimeout(() => {
        setIslandSubtitleText('');
      }, 2000);
    }
    return () => { if (subtitleClearTimer.current) clearTimeout(subtitleClearTimer.current); };
  }, [player.subtitleText]);

  // Auto-expand island briefly on track change
  useEffect(() => {
    if (!player.currentTrack) return;
    const trackKey = `${player.currentTrack.hash}-${player.currentIndex}`;
    if (prevTrackRef.current !== null && prevTrackRef.current !== trackKey) {
      // Track changed — briefly show expanded island
      setIslandExpanded(true);
      if (islandTimerRef.current) clearTimeout(islandTimerRef.current);
      islandTimerRef.current = setTimeout(() => setIslandExpanded(false), 3500);
    }
    prevTrackRef.current = trackKey;
    return () => {
      if (islandTimerRef.current) clearTimeout(islandTimerRef.current);
    };
  }, [player.currentTrack, player.currentIndex]);

  // Auto-collapse expanded island after inactivity
  useEffect(() => {
    if (!islandExpanded || inMusicRoom) return;
    if (islandTimerRef.current) clearTimeout(islandTimerRef.current);
    islandTimerRef.current = setTimeout(() => setIslandExpanded(false), 6000);
    return () => {
      if (islandTimerRef.current) clearTimeout(islandTimerRef.current);
    };
  }, [islandExpanded, inMusicRoom]);

  if (!player.currentTrack) return null;

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ---- Expanded full-screen player (shared for both modes) ----
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-b from-purple-900 via-indigo-900 to-slate-900 flex flex-col text-white">
        {/* Safe area spacer */}
        <div style={{ height: 'var(--safe-top, 0px)', flexShrink: 0 }} />
        {/* Collapse button */}
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <button onClick={() => setExpanded(false)} className="p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full">
            <ChevronDown size={24} />
          </button>
          <p className="text-xs text-white/50 truncate flex-1 text-center px-4">
            {player.currentTrack.workTitle}
          </p>
          <div className="flex items-center gap-1">
            {hasSubtitles && (
              <button
                onClick={() => { setShowLyrics(!showLyrics); setShowQueue(false); }}
                className={`p-2 rounded-full transition-colors ${showLyrics ? 'bg-white/20 dark:bg-slate-800/20 text-white' : 'hover:bg-white/10 dark:bg-slate-800/10 text-white/60'}`}
              >
                <MessageSquareText size={20} />
              </button>
            )}
            <button onClick={() => { setShowQueue(!showQueue); setShowLyrics(false); }} className="p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full">
              <List size={20} />
            </button>
          </div>
        </div>

        {showQueue ? (
          /* Queue list */
          <div className="flex-1 overflow-y-auto px-4 pb-4 lg:max-w-2xl lg:mx-auto lg:w-full">
            <h3 className="text-sm font-semibold text-white/60 mb-3">播放队列 ({player.playlist.length})</h3>
            <div className="space-y-1">
              {player.playlist.map((track, i) => (
                <div
                  key={`${track.hash}-${i}`}
                  className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors ${
                    i === player.currentIndex ? 'bg-white/15 dark:bg-slate-800/15' : 'hover:bg-white/5 dark:bg-slate-800/5'
                  }`}
                >
                  <button
                    onClick={() => player.setPlaylist(player.playlist, i)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className={`w-6 text-xs text-right shrink-0 ${i === player.currentIndex ? 'text-purple-300' : 'text-white/30'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${i === player.currentIndex ? 'text-white font-medium' : 'text-white/70'}`}>
                        {track.title}
                      </p>
                    </div>
                    {track.duration > 0 && (
                      <span className="text-xs text-white/30">{formatTime(track.duration)}</span>
                    )}
                  </button>
                  {player.playlist.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); player.removeFromQueue(i); }}
                      className="p-1 text-white/20 hover:text-red-400 transition-colors shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : showLyrics && hasSubtitles ? (
          /* Lyrics view */
          <div className="flex-1 flex flex-col min-h-0 lg:flex-row lg:gap-0">
            {/* Desktop left: small cover + info */}
            <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:w-80 lg:shrink-0 lg:px-6">
              <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-xl mb-4 bg-purple-800/50">
                {!imgError ? (
                  <img src={player.currentTrack.coverUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><div className="w-16 h-16 rounded-full bg-purple-600/50 animate-pulse" /></div>
                )}
              </div>
              <h2 className="text-base font-bold text-center truncate w-full mb-0.5">{player.currentTrack.title}</h2>
              <p className="text-xs text-white/50">{player.currentTrack.workTitle}</p>
            </div>
            {/* Lyrics scroll area */}
            <div className="flex-1 flex flex-col min-h-0">
              <LyricsView
                cues={player.subtitleCues}
                currentTime={player.currentTime}
                onSeek={player.seekTo}
                onClose={() => setShowLyrics(false)}
              />
            </div>
            {/* Bottom controls for lyrics view */}
            <div className="shrink-0 px-8 pb-4 lg:hidden">
              <div className="w-full">
                <input
                  type="range" min={0} max={player.duration || 1} value={player.currentTime}
                  onChange={e => player.seekTo(Number(e.target.value))}
                  className="w-full h-1 bg-white/20 dark:bg-slate-800/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white dark:bg-slate-800"
                  style={{ background: `linear-gradient(to right, rgba(168,85,247,0.8) ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)` }}
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>{formatTime(player.currentTime)}</span>
                  <span>{formatTime(player.duration)}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-3">
                <button onClick={player.prev} className="p-2 text-white/80 hover:text-white"><SkipBack size={22} /></button>
                <button onClick={player.toggle} className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:scale-105 transition-transform">
                  {player.playing ? <Pause size={24} className="text-purple-900" /> : <Play size={24} className="text-purple-900 ml-0.5" />}
                </button>
                <button onClick={player.next} className="p-2 text-white/80 hover:text-white"><SkipForward size={22} /></button>
              </div>
            </div>
          </div>
        ) : (
          /* Full player */
          <div className="flex-1 flex flex-col items-center justify-center px-8 lg:flex-row lg:items-center lg:gap-12 lg:px-12">
            {/* Left: Cover + Spectrum */}
            <div className="flex flex-col items-center lg:shrink-0">
              {/* Cover — tap to show lyrics if subtitles available */}
              <button
                onClick={hasSubtitles ? () => setShowLyrics(true) : undefined}
                className={`w-64 h-64 lg:w-80 lg:h-80 rounded-3xl overflow-hidden shadow-2xl mb-8 lg:mb-6 bg-purple-800/50 relative group ${hasSubtitles ? 'cursor-pointer' : ''}`}
              >
                {!imgError ? (
                  <img
                    src={player.currentTrack.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-purple-600/50 animate-pulse" />
                  </div>
                )}
                {hasSubtitles && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <MessageSquareText size={32} className="text-white drop-shadow-lg" />
                  </div>
                )}
              </button>

              {/* Spectrum */}
              <div className="mb-4 w-50 lg:w-64 lg:mb-0">
                <RealtimeSpectrum analyser={player.analyserNode} playing={player.playing} barCount={24} height={40} />
              </div>
            </div>

            {/* Right: Info + Controls */}
            <div className="w-full lg:flex-1 lg:max-w-md flex flex-col items-center">
              {/* Title */}
              <h2 className="text-lg font-bold text-center truncate w-full mb-1">
                {player.currentTrack.title}
              </h2>
              <p className="text-sm text-white/50 mb-1">
                {player.currentTrack.workTitle}
              </p>

              {/* Subtitle */}
              {player.subtitleText && (
                <button
                  onClick={() => setShowLyrics(true)}
                  className="bg-white/10 dark:bg-slate-800/10 backdrop-blur-sm rounded-xl px-4 py-2 mb-4 max-w-full hover:bg-white/15 dark:bg-slate-800/15 transition-colors"
                >
                  <p className="text-sm text-white/90 text-center whitespace-pre-wrap">
                    {player.subtitleText}
                  </p>
                </button>
              )}

              {/* Progress */}
              <div className="w-full mt-4">
                <input
                  type="range"
                  min={0}
                  max={player.duration || 1}
                  value={player.currentTime}
                  onChange={e => player.seekTo(Number(e.target.value))}
                  className="w-full h-1 bg-white/20 dark:bg-slate-800/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white dark:bg-slate-800"
                  style={{
                    background: `linear-gradient(to right, rgba(168, 85, 247, 0.8) ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>{formatTime(player.currentTime)}</span>
                  <span>{formatTime(player.duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <button onClick={() => player.seekBy(-10)} className="p-2 text-white/60 hover:text-white">
                  <RotateCcw size={20} />
                </button>
                <button onClick={player.prev} className="p-2 text-white/80 hover:text-white">
                  <SkipBack size={24} />
                </button>
                <button
                  onClick={player.toggle}
                  className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {player.playing
                    ? <Pause size={28} className="text-purple-900" />
                    : <Play size={28} className="text-purple-900 ml-1" />
                  }
                </button>
                <button onClick={player.next} className="p-2 text-white/80 hover:text-white">
                  <SkipForward size={24} />
                </button>
                <button onClick={() => player.seekBy(10)} className="p-2 text-white/60 hover:text-white">
                  <RotateCw size={20} />
                </button>
              </div>

              {/* Extra controls */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <button
                  onClick={() => {
                    const rates = [1, 1.25, 1.5, 2];
                    const idx = rates.indexOf(player.playbackRate);
                    player.setPlaybackRate(rates[(idx + 1) % rates.length]);
                  }}
                  className="text-xs text-white/50 bg-white/10 dark:bg-slate-800/10 px-2.5 py-1 rounded-lg hover:bg-white/20 dark:bg-slate-800/20"
                >
                  {player.playbackRate}x
                </button>
                <button onClick={player.toggleMute} className="p-2 text-white/50 hover:text-white">
                  {player.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Dynamic Island (when NOT in music room; skip on iOS native — uses system Dynamic Island) ----
  if (!inMusicRoom && !isNativeIOS()) {
    // Expanded island view — tap compact to get here, shows controls
    if (islandExpanded) {
      return (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out"
          style={{ top: 'calc(var(--safe-top, 0px) + 8px)' }}
        >
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-[28px] shadow-2xl shadow-black/30 border border-white/10 px-4 py-3 w-[calc(100vw-32px)] max-w-sm lg:max-w-md animate-[islandExpand_0.4s_ease-out]">
            {/* Top row: cover + title + close */}
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setIslandExpanded(false); setExpanded(true); }} className="shrink-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-purple-800 shadow-lg shadow-purple-900/40">
                  {!imgError ? (
                    <img src={player.currentTrack.coverUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-purple-600 to-indigo-600" />
                  )}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{player.currentTrack.title}</p>
                <p className="text-xs text-white/40 truncate leading-tight">{player.currentTrack.workTitle}</p>
              </div>
              <button
                onClick={() => setIslandExpanded(false)}
                className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Subtitle (always show in expanded if available) */}
            {islandSubtitleText && (
              <div className="mb-2.5 px-1">
                <p className="text-xs text-purple-300/80 text-center truncate">{islandSubtitleText}</p>
              </div>
            )}

            {/* Progress bar */}
            <div className="mb-2.5 px-1">
              <div className="relative h-1 bg-white/10 dark:bg-slate-800/10 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-linear-to-r from-purple-400 to-indigo-400 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>{formatTime(player.currentTime)}</span>
                <span>{formatTime(player.duration)}</span>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-2">
              {/* Subtitle toggle */}
              <button
                onClick={() => setShowIslandSubtitle(v => !v)}
                className={`p-1.5 rounded-full transition-colors ${showIslandSubtitle ? 'text-purple-400 bg-purple-400/10' : 'text-white/30 hover:text-white/50'}`}
                title={showIslandSubtitle ? '隐藏字幕' : '显示字幕'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
                </svg>
              </button>

              <div className="flex items-center gap-5">
                <button onClick={player.prev} className="p-1.5 text-white/60 hover:text-white transition-colors active:scale-90">
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={player.toggle}
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                >
                  {player.playing ? <Pause size={18} className="text-slate-900 dark:text-white" /> : <Play size={18} className="text-slate-900 dark:text-white ml-0.5" />}
                </button>
                <button onClick={player.next} className="p-1.5 text-white/60 hover:text-white transition-colors active:scale-90">
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Open full-screen */}
              <button
                onClick={() => { setIslandExpanded(false); setExpanded(true); }}
                className="p-1.5 text-white/30 hover:text-white/50 transition-colors"
                title="全屏播放"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Compact island view — default small pill
    return (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out"
        style={{ top: 'calc(var(--safe-top, 0px) + 8px)' }}
      >
        <button
          onClick={() => {
            setIslandExpanded(true);
            if (islandTimerRef.current) clearTimeout(islandTimerRef.current);
          }}
          className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xl rounded-full pl-1 pr-1 py-1 shadow-lg shadow-black/20 border border-white/10 hover:scale-[1.02] active:scale-[0.98] transition-transform animate-[islandShrink_0.35s_ease-out]"
        >
          {/* Cover thumbnail — round */}
          <div className="w-7 h-7 rounded-full overflow-hidden bg-purple-800 shrink-0">
            {!imgError ? (
              <img src={player.currentTrack.coverUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-purple-600 to-indigo-600" />
            )}
          </div>

          {/* Subtitle in compact mode — marquee scroll with smooth size transition */}
          <div
            className="overflow-hidden transition-all duration-700 ease-in-out"
            style={{
              maxWidth: showIslandSubtitle && islandSubtitleText ? '8rem' : '0px',
              opacity: showIslandSubtitle && islandSubtitleText ? 1 : 0,
            }}
          >
            <div className="flex gap-6 animate-[islandMarquee_8s_linear_infinite] whitespace-nowrap">
              <span className="text-[10px] text-purple-300/80 leading-tight">{islandSubtitleText}</span>
              <span className="text-[10px] text-purple-300/80 leading-tight">{islandSubtitleText}</span>
            </div>
          </div>

          {/* Mini spectrum */}
          <AnimatedSpectrum playing={player.playing} barCount={3} height={14} className="w-4 shrink-0" />

          {/* Play/Pause */}
          <div
            onClick={(e) => { e.stopPropagation(); player.toggle(); }}
            className="w-7 h-7 rounded-full bg-white/15 dark:bg-slate-800/15 flex items-center justify-center shrink-0 hover:bg-white/25 dark:bg-slate-800/25 transition-colors"
          >
            {player.playing ? <Pause size={11} className="text-white" /> : <Play size={11} className="text-white ml-0.5" />}
          </div>
        </button>

        {/* Thin progress line below compact island */}
        <div className="mt-0.5 mx-auto w-10 h-0.5 rounded-full bg-white/10 dark:bg-slate-800/10 overflow-hidden">
          <div className="h-full bg-purple-400/60 rounded-full transition-all duration-200" style={{ width: `${progressPercent}%` }} />
        </div>

        <style>{`
          @keyframes islandExpand {
            0% { opacity: 0.6; transform: scale(0.3) translateY(-8px); }
            60% { transform: scale(1.02) translateY(0); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes islandShrink {
            0% { opacity: 0.6; transform: scale(1.5); }
            60% { transform: scale(0.97); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes islandMarquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    );
  }

  // ---- Bottom bar (when IN music room) ----
  return (
    <div className={`fixed left-0 right-0 z-50 transition-all duration-300 lg:bottom-0 ${navVisible ? 'bottom-[100px]' : 'bottom-0'}`}>
      {/* Progress line */}
      <div className="h-0.5 bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 px-3 py-2 lg:px-6 flex items-center gap-3">
        {/* Cover thumbnail */}
        <button onClick={() => setExpanded(true)} className="shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-purple-100 shadow-sm">
            {!imgError ? (
              <img
                src={player.currentTrack.coverUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-purple-200 to-indigo-200" />
            )}
          </div>
        </button>

        {/* Track info */}
        <button onClick={() => setExpanded(true)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{player.currentTrack.title}</p>
          {player.subtitleText ? (
            <p className="text-xs text-purple-500 dark:text-purple-400 truncate">{player.subtitleText}</p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{player.currentTrack.workTitle}</p>
          )}
        </button>

        {/* Mini spectrum */}
        <AnimatedSpectrum playing={player.playing} barCount={8} height={20} className="w-10" />

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={player.prev} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <SkipBack size={18} />
          </button>
          <button
            onClick={player.toggle}
            className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white hover:bg-purple-700 transition-colors"
          >
            {player.playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button onClick={player.next} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <SkipForward size={18} />
          </button>
        </div>

        {/* Expand */}
        <button onClick={() => setExpanded(true)} className="p-1 text-slate-300">
          <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
}

export default MusicPlayerProvider;
