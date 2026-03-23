import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Mic,
  MicOff,
  Headphones,
  MessageCircle,
  Loader2,
  Phone,
  PhoneOff,
  User as UserIcon,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { useVoiceChat, type VoiceChatStatus } from '../../hooks/useVoiceChat';
import { useWebRTC } from '../../hooks/useWebRTC';
import type { VoiceChatRole, PartnerInfo } from '../../types';

interface VoiceChatRoomProps {
  onBack: () => void;
}

// 格式化通话时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Role selector component with anonymous toggle
const RoleSelector: React.FC<{
  onSelect: (role: VoiceChatRole, anonymous: boolean) => void;
  isConnecting: boolean;
  isConnected: boolean;
  listenerCount: number;
  speakerCount: number;
}> = ({ onSelect, isConnecting, isConnected, listenerCount, speakerCount }) => {
  const [anonymous, setAnonymous] = useState(true);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">选择你的角色</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
        倾听者与倾诉者更容易匹配成功
      </p>

      {/* Anonymous toggle */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <UserIcon size={16} className="text-slate-500 dark:text-slate-400" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">匿名匹配</span>
          </div>
          <button
            onClick={() => setAnonymous(!anonymous)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              anonymous ? 'bg-violet-500' : 'bg-slate-300'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white dark:bg-slate-800 rounded-full transition-transform ${
                anonymous ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 px-1">
          {anonymous ? '对方将看不到你的用户名和头像' : '对方可以看到你的用户名和头像'}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Listener */}
        <button
          onClick={() => onSelect('LISTENER', anonymous)}
          disabled={!isConnected}
          className="w-full p-5 bg-gradient-to-r from-emerald-50 dark:from-emerald-950 to-teal-50 dark:to-teal-950 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl transition-all active:scale-[0.98] hover:border-emerald-400 hover:shadow-md disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Headphones size={28} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">倾听者</h3>
                {listenerCount > 0 && (
                  <span className="text-xs bg-emerald-100 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                    {listenerCount}人等待中
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">我想倾听他人的心声</p>
            </div>
          </div>
        </button>

        {/* Speaker */}
        <button
          onClick={() => onSelect('SPEAKER', anonymous)}
          disabled={!isConnected}
          className="w-full p-5 bg-gradient-to-r from-violet-50 dark:from-violet-950 to-purple-50 dark:to-purple-950 border-2 border-violet-200 dark:border-violet-800 rounded-2xl transition-all active:scale-[0.98] hover:border-violet-400 hover:shadow-md disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <MessageCircle size={28} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">倾诉者</h3>
                {speakerCount > 0 && (
                  <span className="text-xs bg-violet-100 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
                    {speakerCount}人等待中
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">我想分享我的故事</p>
            </div>
          </div>
        </button>
      </div>

      {!isConnected && (
        <div className="mt-6 flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{isConnecting ? '正在连接...' : '准备中...'}</span>
        </div>
      )}
    </div>
  );
};

// Matching view component
const MatchingView: React.FC<{
  role: VoiceChatRole;
  position: number | null;
  waitingCount: number | null;
  onCancel: () => void;
}> = ({ role, position, waitingCount, onCancel }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6">
    <div className="relative">
      <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white">
        {role === 'LISTENER' ? <Headphones size={40} /> : <MessageCircle size={40} />}
      </div>
      <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-violet-200 animate-ping" />
    </div>

    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-8 mb-2">正在匹配中...</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
      你是一名{role === 'LISTENER' ? '倾听者' : '倾诉者'}
    </p>

    {position !== null && waitingCount !== null && (
      <div className="bg-violet-50 dark:bg-violet-950 px-4 py-2 rounded-full">
        <p className="text-sm text-violet-700 dark:text-violet-400">
          队列位置: <span className="font-bold">{position}</span> / {waitingCount}
        </p>
      </div>
    )}

    <button
      onClick={onCancel}
      className="mt-8 px-6 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
    >
      取消匹配
    </button>
  </div>
);

// Connecting view (WebRTC establishing)
const ConnectingView: React.FC<{
  partnerInfo: PartnerInfo | null;
  partnerRole: string;
}> = ({ partnerInfo, partnerRole }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6">
    <div className="relative">
      <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white overflow-hidden">
        {partnerInfo?.avatarUrl ? (
          <img src={partnerInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserIcon size={40} />
        )}
      </div>
      <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-green-200 dark:border-green-800 animate-pulse" />
    </div>

    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-8 mb-2">正在建立连接...</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
      {partnerInfo?.username || '匿名用户'} ({partnerRole === 'LISTENER' ? '倾听者' : '倾诉者'})
    </p>

    <div className="mt-6 flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">正在请求麦克风权限...</span>
    </div>
  </div>
);

// Call view component (voice calling)
const CallView: React.FC<{
  partnerInfo: PartnerInfo | null;
  partnerRole: string;
  callDuration: number;
  isMuted: boolean;
  callStatus: 'idle' | 'connecting' | 'connected' | 'failed';
  onToggleMute: () => void;
  onEndCall: () => void;
}> = ({ partnerInfo, partnerRole, callDuration, isMuted, callStatus, onToggleMute, onEndCall }) => (
  <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
    {/* Partner info */}
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Avatar */}
      <div className="relative">
        <div className="w-28 h-28 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white overflow-hidden shadow-2xl">
          {partnerInfo?.avatarUrl ? (
            <img src={partnerInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon size={48} />
          )}
        </div>
        {/* Connection indicator */}
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center ${
          callStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
        }`}>
          {callStatus === 'connected' ? (
            <Volume2 size={12} className="text-white" />
          ) : (
            <Loader2 size={12} className="text-white animate-spin" />
          )}
        </div>
      </div>

      {/* Name and role */}
      <h2 className="text-xl font-semibold text-white mt-6">
        {partnerInfo?.username || '匿名用户'}
      </h2>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
        {partnerRole === 'LISTENER' ? '倾听者' : '倾诉者'}
      </p>

      {/* Call duration */}
      <div className="mt-8 px-6 py-3 bg-white/10 dark:bg-slate-800/10 rounded-full">
        <p className="text-2xl font-mono text-white tracking-wider">
          {formatDuration(callDuration)}
        </p>
      </div>

      {/* Audio wave animation */}
      {callStatus === 'connected' && (
        <div className="mt-6 flex items-end gap-1 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-violet-400 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 24 + 8}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.5s',
              }}
            />
          ))}
        </div>
      )}

      {callStatus === 'connecting' && (
        <p className="mt-6 text-sm text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          正在连接语音...
        </p>
      )}
    </div>

    {/* Call controls */}
    <div className="p-6 pb-10">
      <div className="flex justify-center gap-8">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-red-500 text-white'
              : 'bg-white/10 dark:bg-slate-800/10 text-white hover:bg-white/20 dark:bg-slate-800/20'
          }`}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        {/* End call button */}
        <button
          onClick={onEndCall}
          className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  </div>
);

// Call ended view
const CallEndedView: React.FC<{
  endedBy: string;
  duration: number;
  onBack: () => void;
  onNewCall: () => void;
}> = ({ endedBy, duration, onBack, onNewCall }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6">
    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
      <Phone size={36} className="text-slate-400 dark:text-slate-500" />
    </div>

    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">通话已结束</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-2">
      {endedBy === 'PARTNER' ? '对方结束了通话' : '你结束了通话'}
    </p>
    {duration > 0 && (
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-8">
        通话时长: {formatDuration(duration)}
      </p>
    )}

    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        返回
      </button>
      <button
        onClick={onNewCall}
        className="px-6 py-2.5 bg-violet-500 text-white rounded-full hover:bg-violet-600 transition-colors"
      >
        开始新通话
      </button>
    </div>
  </div>
);

// Error view
const ErrorView: React.FC<{
  error: string;
  onRetry: () => void;
  onBack: () => void;
}> = ({ error, onRetry, onBack }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6">
    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
      <AlertCircle size={36} className="text-red-500 dark:text-red-400" />
    </div>

    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">出错了</h2>
    <p className="text-sm text-red-500 dark:text-red-400 text-center mb-8">{error}</p>

    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        返回
      </button>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-violet-500 text-white rounded-full hover:bg-violet-600 transition-colors"
      >
        重试
      </button>
    </div>
  </div>
);

export const VoiceChatRoom: React.FC<VoiceChatRoomProps> = ({ onBack }) => {
  const {
    status,
    queuePosition,
    waitingCount,
    queueStats,
    session,
    error,
    callEndInfo,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    endChat,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate,
    setOnWebRTCOffer,
    setOnWebRTCAnswer,
    setOnICECandidate,
  } = useVoiceChat();

  const [selectedRole, setSelectedRole] = useState<VoiceChatRole | null>(null);
  const [webRTCError, setWebRTCError] = useState<string | null>(null);

  // Remote audio element ref
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Track if WebRTC has been initialized for current session
  const webrtcInitializedRef = useRef<number | null>(null);

  // WebRTC hook
  const {
    callStatus,
    remoteStream,
    isMuted,
    callDuration,
    initializeCall,
    handleOffer,
    handleAnswer,
    handleICECandidate,
    toggleMute,
    endCall: endWebRTCCall,
  } = useWebRTC({
    onLocalOffer: (sdp) => {
      console.log('Sending WebRTC offer');
      sendWebRTCOffer(sdp);
    },
    onLocalAnswer: (sdp) => {
      console.log('Sending WebRTC answer');
      sendWebRTCAnswer(sdp);
    },
    onICECandidate: (candidate) => {
      console.log('Sending ICE candidate');
      sendICECandidate(candidate);
    },
    onError: (err) => {
      console.error('WebRTC error:', err);
      setWebRTCError(err);
    },
  });

  // Connect WebSocket on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  // Set up WebRTC signal handlers (only once on mount)
  useEffect(() => {
    setOnWebRTCOffer((sdp) => {
      console.log('Received WebRTC offer');
      handleOffer(sdp);
    });

    setOnWebRTCAnswer((sdp) => {
      console.log('Received WebRTC answer');
      handleAnswer(sdp);
    });

    setOnICECandidate((candidate) => {
      console.log('Received ICE candidate');
      handleICECandidate(candidate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize WebRTC when matched (only once per session)
  useEffect(() => {
    if (status === 'matched' && session && webrtcInitializedRef.current !== session.sessionId) {
      console.log('Match found, initializing WebRTC. isInitiator:', session.isInitiator);
      webrtcInitializedRef.current = session.sessionId;
      initializeCall(session.isInitiator);
    }
  }, [status, session?.sessionId, session?.isInitiator]);

  // Play remote audio stream
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(console.error);
    }
  }, [remoteStream]);

  const handleRoleSelect = (role: VoiceChatRole, anonymous: boolean) => {
    setSelectedRole(role);
    setWebRTCError(null);
    joinQueue(role, anonymous);
  };

  const handleLeaveQueue = () => {
    setSelectedRole(null);
    leaveQueue();
  };

  const handleEndCall = () => {
    endWebRTCCall();
    endChat();
  };

  const handleNewCall = () => {
    setSelectedRole(null);
    setWebRTCError(null);
    webrtcInitializedRef.current = null;
    endWebRTCCall();
    disconnect();
    connect();
  };

  const handleBack = () => {
    endWebRTCCall();
    disconnect();
    onBack();
  };

  // Determine if we're in a call state
  const isInCall = status === 'matched' || (status === 'chatting' && callStatus !== 'idle');

  // Render based on status
  const renderContent = () => {
    // Show WebRTC error if any
    if (webRTCError) {
      return (
        <ErrorView
          error={webRTCError}
          onRetry={() => {
            setWebRTCError(null);
            handleNewCall();
          }}
          onBack={handleBack}
        />
      );
    }

    // Show connection error
    if (status === 'error' && error) {
      return (
        <ErrorView
          error={error}
          onRetry={() => {
            disconnect();
            connect();
          }}
          onBack={handleBack}
        />
      );
    }

    // Call ended
    if (status === 'ended') {
      return (
        <CallEndedView
          endedBy={callEndInfo?.endedBy || 'ME'}
          duration={callEndInfo?.duration || callDuration}
          onBack={handleBack}
          onNewCall={handleNewCall}
        />
      );
    }

    // In call (matched or chatting)
    if (isInCall && session) {
      // Still connecting WebRTC
      if (callStatus === 'idle' || callStatus === 'connecting') {
        return (
          <ConnectingView
            partnerInfo={session.partnerInfo}
            partnerRole={session.partnerRole}
          />
        );
      }

      // Call view (connected or failed but still showing)
      return (
        <CallView
          partnerInfo={session.partnerInfo}
          partnerRole={session.partnerRole}
          callDuration={callDuration}
          isMuted={isMuted}
          callStatus={callStatus}
          onToggleMute={toggleMute}
          onEndCall={handleEndCall}
        />
      );
    }

    // Queuing
    if (status === 'queuing' && selectedRole) {
      return (
        <MatchingView
          role={selectedRole}
          position={queuePosition}
          waitingCount={waitingCount}
          onCancel={handleLeaveQueue}
        />
      );
    }

    // Default: role selection (idle, connecting, connected)
    return (
      <RoleSelector
        onSelect={handleRoleSelect}
        isConnecting={status === 'connecting'}
        isConnected={status === 'connected'}
        listenerCount={queueStats?.listenerCount ?? 0}
        speakerCount={queueStats?.speakerCount ?? 0}
      />
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Header - only show when not in call */}
      {!isInCall && status !== 'ended' && (
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white px-4 pt-12 lg:pt-8 pb-6 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-slate-800/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 dark:bg-slate-800/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          {/* Back button */}
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Title */}
          <div className="text-center relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 dark:bg-slate-800/20 rounded-2xl mb-3">
              <Mic size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-1">语音聊天房</h1>
            <p className="text-white/70 text-sm">匿名匹配，倾听与倾诉</p>
          </div>
        </div>
      )}

      {/* Back button for call view */}
      {isInCall && (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleBack}
            className="p-2 bg-white/10 dark:bg-slate-800/10 backdrop-blur rounded-full hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        </div>
      )}

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default VoiceChatRoom;
