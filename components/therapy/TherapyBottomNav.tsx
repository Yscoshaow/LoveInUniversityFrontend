import { Shuffle, SlidersHorizontal, Play, Pause, Clock, List, Repeat, Repeat1 } from 'lucide-react';

export type PlaybackMode = 'single' | 'random' | 'loop';

interface TherapyBottomNavProps {
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenEditor: () => void;
  isEditorOpen: boolean;
  onOpenTimer: () => void;
  isTimerOpen: boolean;
  onOpenQueue: () => void;
  isQueueOpen: boolean;
  playDisabled?: boolean;
}

export default function TherapyBottomNav({
  playbackMode,
  onTogglePlaybackMode,
  isPlaying,
  onTogglePlay,
  onOpenEditor,
  isEditorOpen,
  onOpenTimer,
  isTimerOpen,
  onOpenQueue,
  isQueueOpen,
  playDisabled = false,
}: TherapyBottomNavProps) {
  const PlaybackIcon = playbackMode === 'single' ? Repeat1 : playbackMode === 'loop' ? Repeat : Shuffle;

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800/50 px-6 py-3 flex justify-around items-center z-30">
      {/* 播放模式 */}
      <button
        onClick={onTogglePlaybackMode}
        className="flex flex-col items-center gap-1 text-[#FFE28A]"
        title={playbackMode === 'random' ? '随机播放' : playbackMode === 'loop' ? '列表循环' : '单曲循环'}
      >
        <PlaybackIcon className="w-6 h-6" />
        <span className="text-[10px] text-zinc-500">
          {playbackMode === 'random' ? '随机' : playbackMode === 'loop' ? '循环' : '单曲'}
        </span>
      </button>

      {/* 波形编辑器 */}
      <button
        onClick={onOpenEditor}
        className={`flex flex-col items-center gap-1 transition-colors ${
          isEditorOpen ? 'text-[#FFE28A]' : 'text-zinc-400'
        }`}
      >
        <SlidersHorizontal className="w-6 h-6" />
        <span className="text-[10px]">编辑</span>
      </button>

      {/* 开关 (中央大按钮) */}
      <button
        onClick={onTogglePlay}
        disabled={playDisabled}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
          playDisabled
            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            : isPlaying
              ? 'bg-[#FFE28A] text-yellow-950'
              : 'bg-zinc-700 text-zinc-300'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" />
        )}
      </button>

      {/* 定时启停 */}
      <button
        onClick={onOpenTimer}
        className={`flex flex-col items-center gap-1 transition-colors ${
          isTimerOpen ? 'text-[#FFE28A]' : 'text-zinc-400'
        }`}
      >
        <Clock className="w-6 h-6" />
        <span className="text-[10px]">定时</span>
      </button>

      {/* 播放列表 */}
      <button
        onClick={onOpenQueue}
        className={`flex flex-col items-center gap-1 transition-colors ${
          isQueueOpen ? 'text-[#FFE28A]' : 'text-zinc-400'
        }`}
      >
        <List className="w-6 h-6" />
        <span className="text-[10px]">列表</span>
      </button>
    </div>
  );
}
