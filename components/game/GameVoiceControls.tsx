import { Mic, MicOff } from 'lucide-react';

interface GameVoiceControlsProps {
  isMicEnabled: boolean;
  isSpeaking: boolean;
  onToggleMic: () => void;
  peerStates: Map<number, { connected: boolean; isSpeaking: boolean }>;
}

export default function GameVoiceControls({
  isMicEnabled,
  isSpeaking,
  onToggleMic,
  peerStates,
}: GameVoiceControlsProps) {
  const connectedCount = Array.from(peerStates.values()).filter((p) => p.connected).length;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMic}
        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
          isMicEnabled
            ? isSpeaking
              ? 'bg-green-600/30 border-green-500 text-green-400'
              : 'bg-stone-800 border-amber-500 text-amber-400'
            : 'bg-stone-800 border-stone-600 text-stone-500'
        }`}
      >
        {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
      </button>
      {connectedCount > 0 && (
        <span className="text-xs text-stone-500">{connectedCount} 人语音中</span>
      )}
    </div>
  );
}
