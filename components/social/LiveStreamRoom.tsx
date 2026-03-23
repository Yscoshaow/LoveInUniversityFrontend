import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  Video,
  VideoOff,
  Send,
  Gift,
  X,
  Loader2,
  Play,
  Clock,
  Users,
  Coins,
  Mic,
  MicOff,
  SwitchCamera,
} from 'lucide-react';
import { liveStreamApi } from '../../lib/api';
import { useLiveStream } from '../../hooks/useLiveStream';
import { useLiveStreamBroadcast } from '../../hooks/useLiveStreamBroadcast';
import { isTelegramMiniApp } from '../../lib/environment';
import { platformOpenLink } from '../../lib/platform-actions';
import type { LiveStreamReplay, LiveStreamChatMessage, LiveStreamGiftMessage } from '../../types';

interface LiveStreamRoomProps {
  onBack: () => void;
}

const LiveStreamRoom: React.FC<LiveStreamRoomProps> = ({ onBack }) => {
  const [view, setView] = useState<'room' | 'replays'>('room');

  return view === 'replays' ? (
    <ReplayListView onBack={() => setView('room')} />
  ) : (
    <LiveRoomView onBack={onBack} onShowReplays={() => setView('replays')} />
  );
};

// ==================== Live Room View ====================

const LiveRoomView: React.FC<{
  onBack: () => void;
  onShowReplays: () => void;
}> = ({ onBack, onShowReplays }) => {
  const {
    status: wsStatus,
    isLive,
    streamData,
    viewerCount,
    chatMessages,
    recentGifts,
    error: wsError,
    connect,
    disconnect,
    sendChatMessage,
    sendGift,
  } = useLiveStream();

  const {
    broadcastStatus,
    broadcastError,
    startBroadcast,
    stopBroadcast,
    localStream,
    isCameraOn,
    isMicOn,
    toggleCamera,
    toggleMic,
    switchCamera,
  } = useLiveStreamBroadcast();

  const { data: roomStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['live-stream', 'status'],
    queryFn: () => liveStreamApi.getStatus(),
    refetchInterval: wsStatus !== 'connected' ? 10000 : false,
  });

  const [chatInput, setChatInput] = useState('');
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const isBroadcaster = broadcastStatus === 'live' || broadcastStatus === 'starting';
  const actualIsLive = isLive || roomStatus?.isLive || false;
  const actualStream = streamData || roomStatus?.stream || null;
  const playbackToken = roomStatus?.playbackToken || null;

  // Connect WS on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, recentGifts]);

  // Attach local camera to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleSendChat = useCallback(() => {
    if (chatInput.trim()) {
      sendChatMessage(chatInput.trim());
      setChatInput('');
    }
  }, [chatInput, sendChatMessage]);

  const handleStartBroadcast = useCallback(async () => {
    setShowStartDialog(false);
    await startBroadcast(broadcastTitle);
    refetchStatus();
  }, [broadcastTitle, startBroadcast, refetchStatus]);

  const handleStopBroadcast = useCallback(async () => {
    await stopBroadcast();
    refetchStatus();
  }, [stopBroadcast, refetchStatus]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 z-10">
        <button onClick={onBack} className="text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 text-white text-sm">
          {actualIsLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/80 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-800 animate-pulse" />
              直播中
            </span>
          )}
          <span className="flex items-center gap-1 opacity-70">
            <Eye size={14} />
            {viewerCount}
          </span>
        </div>
        <button onClick={onShowReplays} className="text-white/70 text-xs px-2 py-1">
          回放
        </button>
      </div>

      {/* Main video area */}
      <div className="flex-1 relative bg-slate-900 min-h-0">
        {isBroadcaster ? (
          // Broadcaster: local camera preview
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
            />
            {!isCameraOn && (
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <div className="text-center text-white/40">
                  <VideoOff size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">摄像头已关闭</p>
                </div>
              </div>
            )}
          </>
        ) : actualIsLive && actualStream?.muxPlaybackId ? (
          // Viewer: HLS player
          <HlsPlayer
            playbackId={actualStream.muxPlaybackId}
            playbackToken={playbackToken}
          />
        ) : (
          // Idle state
          <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4">
            <Video size={48} className="opacity-30" />
            <p className="text-sm">暂无直播</p>
            <button
              onClick={() => setShowStartDialog(true)}
              className="px-6 py-2.5 bg-red-500 text-white rounded-full font-bold text-sm active:bg-red-600 transition-colors"
            >
              开始直播
            </button>
          </div>
        )}

        {/* Chat overlay */}
        {(actualIsLive || isBroadcaster) && (
          <div
            ref={chatContainerRef}
            className="absolute bottom-0 left-0 right-0 max-h-[40%] overflow-y-auto px-3 pb-2 pointer-events-none"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
          >
            {chatMessages.map((msg, i) => (
              <ChatBubble key={`chat-${i}`} message={msg} />
            ))}
            {recentGifts.slice(-10).map((gift, i) => (
              <GiftBubble key={`gift-${i}`} gift={gift} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bg-slate-900 border-t border-white/10 px-3 py-2 flex items-center gap-2">
        {(actualIsLive || isBroadcaster) ? (
          <>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="发送弹幕..."
              className="flex-1 bg-white/10 dark:bg-slate-800/10 text-white text-sm rounded-full px-3 py-2 outline-none placeholder:text-white/30"
            />
            <button
              onClick={handleSendChat}
              className="w-9 h-9 rounded-full bg-white/10 dark:bg-slate-800/10 flex items-center justify-center text-white/70 active:bg-white/20 dark:bg-slate-800/20"
            >
              <Send size={16} />
            </button>
            {!isBroadcaster && (
              <button
                onClick={() => setShowGiftPanel(true)}
                className="w-9 h-9 rounded-full bg-amber-500/80 flex items-center justify-center text-white active:bg-amber-600"
              >
                <Gift size={16} />
              </button>
            )}
            {isBroadcaster && (
              <>
                {/* Camera toggle */}
                <button
                  onClick={toggleCamera}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isCameraOn
                      ? 'bg-white/10 text-white/70 active:bg-white/20'
                      : 'bg-red-500/30 text-red-400 active:bg-red-500/40'
                  }`}
                >
                  {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>

                {/* Mic toggle */}
                <button
                  onClick={toggleMic}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isMicOn
                      ? 'bg-white/10 text-white/70 active:bg-white/20'
                      : 'bg-red-500/30 text-red-400 active:bg-red-500/40'
                  }`}
                >
                  {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>

                {/* Switch camera */}
                <button
                  onClick={switchCamera}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 transition-colors"
                >
                  <SwitchCamera size={16} />
                </button>

                {/* Stop broadcast */}
                <button
                  onClick={handleStopBroadcast}
                  className="px-4 py-2 bg-red-500 text-white text-xs rounded-full font-bold active:bg-red-600"
                >
                  {broadcastStatus === 'stopping' ? '下播中...' : '下播'}
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => {
                if (isTelegramMiniApp()) {
                  // Telegram WebView 不支持摄像头/麦克风，跳转外部浏览器
                  platformOpenLink(window.location.href);
                } else {
                  setShowStartDialog(true);
                }
              }}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-bold active:bg-red-600"
            >
              {isTelegramMiniApp() ? '在浏览器中开播' : '开始直播'}
            </button>
          </div>
        )}
      </div>

      {/* Start broadcast dialog */}
      {showStartDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-slate-800 w-full max-w-lg rounded-t-2xl p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">开始直播</h3>
              <button onClick={() => setShowStartDialog(false)} className="text-white/50">
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="直播标题（可选）"
              className="w-full bg-white/10 dark:bg-slate-800/10 text-white text-sm rounded-lg px-3 py-2.5 outline-none placeholder:text-white/30 mb-4"
              maxLength={100}
            />
            <button
              onClick={handleStartBroadcast}
              disabled={broadcastStatus === 'starting'}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {broadcastStatus === 'starting' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  正在开播...
                </>
              ) : (
                <>
                  <Video size={16} />
                  开播
                </>
              )}
            </button>
            {broadcastError && (
              <p className="text-red-400 text-xs text-center mt-2">{broadcastError}</p>
            )}
          </div>
        </div>
      )}

      {/* Gift panel */}
      {showGiftPanel && (
        <GiftPanel
          onClose={() => setShowGiftPanel(false)}
          onSendGift={(amount) => {
            sendGift(amount);
            setShowGiftPanel(false);
          }}
        />
      )}
    </div>
  );
};

// ==================== HLS Player ====================

const HlsPlayer: React.FC<{
  playbackId: string;
  playbackToken?: string | null;
}> = ({ playbackId, playbackToken }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const src = playbackToken
    ? `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`
    : `https://stream.mux.com/${playbackId}.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {});
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {});
            });
            return () => hls.destroy();
          }
        })
        .catch(() => {
          video.src = src;
        });
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-contain bg-black"
    />
  );
};

// ==================== Chat Bubble ====================

const ChatBubble: React.FC<{ message: LiveStreamChatMessage }> = ({ message }) => (
  <div className="py-0.5">
    <span className="text-xs">
      <span className="text-cyan-400 font-medium">{message.userName}</span>
      <span className="text-white/80 ml-1.5">{message.content}</span>
    </span>
  </div>
);

// ==================== Gift Bubble ====================

const GiftBubble: React.FC<{ gift: LiveStreamGiftMessage }> = ({ gift }) => (
  <div className="py-0.5">
    <span className="text-xs">
      <span className="text-amber-400 dark:text-amber-300 font-medium">🎁 {gift.fromUserName}</span>
      <span className="text-amber-200/80 ml-1.5">送出 {gift.amount} 校园点</span>
    </span>
  </div>
);

// ==================== Gift Panel ====================

const GIFT_PRESETS = [1, 5, 10, 50];

const GiftPanel: React.FC<{
  onClose: () => void;
  onSendGift: (amount: number) => void;
}> = ({ onClose, onSendGift }) => {
  const [customAmount, setCustomAmount] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-slate-800 w-full max-w-lg rounded-t-2xl p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">打赏主播</h3>
          <button onClick={onClose} className="text-white/50">
            <X size={18} />
          </button>
        </div>

        {/* Preset amounts */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {GIFT_PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => onSendGift(amount)}
              className="py-3 bg-amber-500/20 text-amber-400 dark:text-amber-300 rounded-xl font-bold text-sm active:bg-amber-500/30 flex flex-col items-center gap-1"
            >
              <Coins size={18} />
              {amount}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="自定义金额"
            min={1}
            className="flex-1 bg-white/10 dark:bg-slate-800/10 text-white text-sm rounded-lg px-3 py-2.5 outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => {
              const amount = parseInt(customAmount);
              if (amount > 0) onSendGift(amount);
            }}
            disabled={!customAmount || parseInt(customAmount) <= 0}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold active:bg-amber-600 disabled:opacity-40"
          >
            打赏
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Replay List View ====================

const ReplayListView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [playingReplay, setPlayingReplay] = useState<LiveStreamReplay | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['live-stream', 'replays'],
    queryFn: () => liveStreamApi.getReplays(),
  });

  if (playingReplay) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-3 px-3 py-2 bg-black/80">
          <button onClick={() => setPlayingReplay(null)} className="text-white p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold truncate">{playingReplay.title || '直播回放'}</p>
            <p className="text-white/50 text-xs">{playingReplay.hostName}</p>
          </div>
        </div>
        <div className="flex-1 bg-black">
          {playingReplay.muxAssetPlaybackId && (
            <HlsPlayer
              playbackId={playingReplay.muxAssetPlaybackId}
              playbackToken={playingReplay.playbackToken}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <button onClick={onBack} className="text-slate-600 dark:text-slate-300">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">直播回放</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
          </div>
        ) : !data?.replays.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <VideoOff size={32} className="mb-2 opacity-50" />
            <p className="text-sm">暂无回放</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.replays.map((replay) => (
              <button
                key={replay.id}
                onClick={() => setPlayingReplay(replay)}
                className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3 active:bg-slate-50 dark:bg-slate-900 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <Play size={18} className="text-red-500 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {replay.title || '直播回放'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{replay.hostName}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    {replay.durationSeconds != null && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {Math.floor(replay.durationSeconds / 60)}分钟
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Users size={10} />
                      峰值{replay.peakViewerCount}人
                    </span>
                    {replay.totalGiftPoints > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Gift size={10} />
                        {replay.totalGiftPoints}点
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveStreamRoom;
