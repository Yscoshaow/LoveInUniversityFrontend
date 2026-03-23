import { useRef, useCallback } from 'react';

const SOUND_FILES = {
  cardFlip: '/audio/card-flip.wav',
  cardPlay: '/audio/card-play.wav',
  revolverReload: '/audio/revolver-reload.wav',
  revolverCock: '/audio/revolver-cock.wav',
  gunshot: '/audio/gunshot.mp3',
  revolverClick: '/audio/revolver-click.mp3',
} as const;

type SoundName = keyof typeof SOUND_FILES;

/**
 * 骗子酒馆游戏音效 hook
 * 预加载音频，提供 play 方法
 */
export function useGameSounds() {
  const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map());

  const getAudio = useCallback((name: SoundName): HTMLAudioElement => {
    let audio = audioCache.current.get(name);
    if (!audio) {
      audio = new Audio(SOUND_FILES[name]);
      audio.preload = 'auto';
      audioCache.current.set(name, audio);
    }
    return audio;
  }, []);

  const play = useCallback((name: SoundName, volume = 0.6) => {
    try {
      const audio = getAudio(name);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, [getAudio]);

  return { play };
}
