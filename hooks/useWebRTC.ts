import { useState, useRef, useCallback, useEffect } from 'react';

export type WebRTCCallStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export interface UseWebRTCOptions {
  onLocalOffer?: (sdp: string) => void;
  onLocalAnswer?: (sdp: string) => void;
  onICECandidate?: (candidate: RTCIceCandidateInit) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export interface UseWebRTCReturn {
  callStatus: WebRTCCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  callDuration: number;
  initializeCall: (isInitiator: boolean) => Promise<void>;
  handleOffer: (sdp: string) => Promise<void>;
  handleAnswer: (sdp: string) => Promise<void>;
  handleICECandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  toggleMute: () => void;
  endCall: () => void;
}

// STUN 服务器配置
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// 音频约束
const audioConstraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

export function useWebRTC(options: UseWebRTCOptions = {}): UseWebRTCReturn {
  const {
    onLocalOffer,
    onLocalAnswer,
    onICECandidate,
    onConnected,
    onDisconnected,
    onError,
  } = options;

  const [callStatus, setCallStatus] = useState<WebRTCCallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Store callbacks in refs to avoid stale closures
  const onLocalOfferRef = useRef(onLocalOffer);
  const onLocalAnswerRef = useRef(onLocalAnswer);
  const onICECandidateRef = useRef(onICECandidate);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onLocalOfferRef.current = onLocalOffer;
    onLocalAnswerRef.current = onLocalAnswer;
    onICECandidateRef.current = onICECandidate;
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onErrorRef.current = onError;
  });
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    // 停止通话计时器
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // 关闭 PeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 停止本地音频流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setCallDuration(0);
    callStartTimeRef.current = null;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 开始通话计时
  const startCallTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    callTimerRef.current = window.setInterval(() => {
      if (callStartTimeRef.current) {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }
    }, 1000);
  }, []);

  // 创建 PeerConnection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(rtcConfig);

    // 处理 ICE 候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onICECandidateRef.current?.({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    // 处理连接状态变化
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          setCallStatus('connected');
          startCallTimer();
          onConnectedRef.current?.();
          break;
        case 'disconnected':
        case 'failed':
          setCallStatus('failed');
          onDisconnectedRef.current?.();
          break;
        case 'closed':
          cleanup();
          break;
      }
    };

    // 处理 ICE 连接状态
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        onErrorRef.current?.('ICE 连接失败，请检查网络');
        setCallStatus('failed');
      }
    };

    // 处理远程流
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    return pc;
  }, [startCallTimer, cleanup]);

  // 获取本地音频流
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get local stream:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error('麦克风权限被拒绝');
        } else if (error.name === 'NotFoundError') {
          throw new Error('未找到麦克风设备');
        }
      }
      throw new Error('无法访问麦克风');
    }
  }, []);

  // 初始化通话（作为发起方或接收方）
  const initializeCall = useCallback(async (isInitiator: boolean) => {
    try {
      setCallStatus('connecting');

      // 获取本地音频流
      const stream = await getLocalStream();

      // 创建 PeerConnection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // 添加本地轨道
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 如果是发起方，创建 offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (offer.sdp) {
          onLocalOfferRef.current?.(offer.sdp);
        }
      }
    } catch (error) {
      console.error('Failed to initialize call:', error);
      setCallStatus('failed');
      onErrorRef.current?.(error instanceof Error ? error.message : '初始化通话失败');
      cleanup();
    }
  }, [getLocalStream, createPeerConnection, cleanup]);

  // 处理收到的 offer
  const handleOffer = useCallback(async (sdp: string) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('PeerConnection not initialized');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

      // 创建 answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (answer.sdp) {
        onLocalAnswerRef.current?.(answer.sdp);
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
      onErrorRef.current?.('处理通话请求失败');
    }
  }, []);

  // 处理收到的 answer
  const handleAnswer = useCallback(async (sdp: string) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('PeerConnection not initialized');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch (error) {
      console.error('Failed to handle answer:', error);
      onErrorRef.current?.('处理通话响应失败');
    }
  }, []);

  // 处理 ICE 候选
  const handleICECandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('PeerConnection not initialized');
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  // 切换静音
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // 结束通话
  const endCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    callStatus,
    localStream,
    remoteStream,
    isMuted,
    callDuration,
    initializeCall,
    handleOffer,
    handleAnswer,
    handleICECandidate,
    toggleMute,
    endCall,
  };
}
