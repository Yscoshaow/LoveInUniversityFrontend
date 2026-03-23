import { useState, useRef, useCallback, useEffect } from 'react';
import { getTelegramInitData, getJwtToken } from '../lib/api';
import type {
  VoiceChatRole,
  VoiceChatMessage,
  VoiceChatServerMessage,
  PartnerInfo,
  QueueStats,
} from '../types';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export type VoiceChatStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'queuing'
  | 'matched'
  | 'chatting'
  | 'ended'
  | 'error';

export interface VoiceChatSession {
  sessionId: number;
  myRole: string;
  partnerRole: string;
  partnerInfo: PartnerInfo | null;
  isInitiator: boolean;
}

export interface UseVoiceChatReturn {
  status: VoiceChatStatus;
  queuePosition: number | null;
  waitingCount: number | null;
  queueStats: QueueStats | null;
  session: VoiceChatSession | null;
  messages: VoiceChatMessage[];
  error: string | null;
  callEndInfo: { duration: number; endedBy: string } | null;
  // WebRTC 信令回调
  onWebRTCOffer: ((sdp: string) => void) | null;
  onWebRTCAnswer: ((sdp: string) => void) | null;
  onICECandidate: ((candidate: RTCIceCandidateInit) => void) | null;
  // 操作
  connect: () => void;
  disconnect: () => void;
  joinQueue: (role: VoiceChatRole, anonymous: boolean) => void;
  leaveQueue: () => void;
  sendMessage: (content: string) => void;
  endChat: () => void;
  // WebRTC 信令发送
  sendWebRTCOffer: (sdp: string) => void;
  sendWebRTCAnswer: (sdp: string) => void;
  sendICECandidate: (candidate: RTCIceCandidateInit) => void;
  // 注册回调
  setOnWebRTCOffer: (callback: (sdp: string) => void) => void;
  setOnWebRTCAnswer: (callback: (sdp: string) => void) => void;
  setOnICECandidate: (callback: (candidate: RTCIceCandidateInit) => void) => void;
}

export function useVoiceChat(): UseVoiceChatReturn {
  const [status, setStatus] = useState<VoiceChatStatus>('idle');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [session, setSession] = useState<VoiceChatSession | null>(null);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callEndInfo, setCallEndInfo] = useState<{ duration: number; endedBy: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // WebRTC 信令回调引用
  const onWebRTCOfferRef = useRef<((sdp: string) => void) | null>(null);
  const onWebRTCAnswerRef = useRef<((sdp: string) => void) | null>(null);
  const onICECandidateRef = useRef<((candidate: RTCIceCandidateInit) => void) | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: VoiceChatServerMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);

      switch (data.type) {
        case 'CONNECTED':
          setStatus('connected');
          setError(null);
          if (data.queueStats) {
            setQueueStats(data.queueStats);
          }
          break;

        case 'QUEUE_STATS':
          setQueueStats({
            listenerCount: data.listenerCount,
            speakerCount: data.speakerCount,
          });
          break;

        case 'QUEUE_STATUS':
          setStatus('queuing');
          setQueuePosition(data.position);
          setWaitingCount(data.waitingCount);
          break;

        case 'MATCH_FOUND':
          setStatus('matched');
          setSession({
            sessionId: data.sessionId,
            myRole: data.myRole,
            partnerRole: data.partnerRole,
            partnerInfo: data.partnerInfo || null,
            isInitiator: data.isInitiator,
          });
          setQueuePosition(null);
          setWaitingCount(null);
          setMessages([]);
          setCallEndInfo(null);
          break;

        case 'MESSAGE_RECEIVED':
          setMessages((prev) => [...prev, data.message]);
          break;

        case 'CHAT_ENDED':
          setStatus('ended');
          setCallEndInfo({ duration: 0, endedBy: data.endedBy });
          break;

        case 'CALL_ENDED':
          setStatus('ended');
          setCallEndInfo({ duration: data.duration, endedBy: data.endedBy });
          break;

        // WebRTC 信令
        case 'WEBRTC_OFFER':
          onWebRTCOfferRef.current?.(data.sdp);
          break;

        case 'WEBRTC_ANSWER':
          onWebRTCAnswerRef.current?.(data.sdp);
          break;

        case 'ICE_CANDIDATE':
          onICECandidateRef.current?.({
            candidate: data.candidate,
            sdpMid: data.sdpMid ?? undefined,
            sdpMLineIndex: data.sdpMLineIndex ?? undefined,
          });
          break;

        case 'ERROR':
          setError(data.message);
          break;
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const initData = getTelegramInitData();
    const jwtToken = getJwtToken();
    if (!initData && !jwtToken) {
      setError('未找到认证信息');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError(null);

    const authParam = initData
      ? `initData=${encodeURIComponent(initData)}`
      : `token=${encodeURIComponent(jwtToken!)}`;
    const wsUrl = `${WS_BASE_URL}/voice-chat/ws?${authParam}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Status will be set to 'connected' when we receive CONNECTED message
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      wsRef.current = null;

      if (status !== 'ended' && status !== 'error') {
        // Only show disconnected error if we weren't intentionally ending
        if (status === 'chatting' || status === 'queuing' || status === 'matched') {
          setError('连接已断开');
          setStatus('error');
        } else {
          setStatus('idle');
        }
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('连接失败');
      setStatus('error');
    };

    wsRef.current = ws;
  }, [handleMessage, status]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('idle');
    setQueuePosition(null);
    setWaitingCount(null);
    setQueueStats(null);
    setSession(null);
    setMessages([]);
    setError(null);
    setCallEndInfo(null);
  }, []);

  const sendWsMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  const joinQueue = useCallback((role: VoiceChatRole, anonymous: boolean) => {
    sendWsMessage({ type: 'JOIN_QUEUE', role, anonymous });
  }, [sendWsMessage]);

  const leaveQueue = useCallback(() => {
    sendWsMessage({ type: 'LEAVE_QUEUE' });
    setStatus('connected');
    setQueuePosition(null);
    setWaitingCount(null);
  }, [sendWsMessage]);

  const sendMessage = useCallback((content: string) => {
    if (content.trim()) {
      sendWsMessage({ type: 'SEND_MESSAGE', content: content.trim() });
    }
  }, [sendWsMessage]);

  const endChat = useCallback(() => {
    sendWsMessage({ type: 'END_CHAT' });
  }, [sendWsMessage]);

  // WebRTC 信令发送
  const sendWebRTCOffer = useCallback((sdp: string) => {
    sendWsMessage({ type: 'WEBRTC_OFFER', sdp });
  }, [sendWsMessage]);

  const sendWebRTCAnswer = useCallback((sdp: string) => {
    sendWsMessage({ type: 'WEBRTC_ANSWER', sdp });
  }, [sendWsMessage]);

  const sendICECandidate = useCallback((candidate: RTCIceCandidateInit) => {
    sendWsMessage({
      type: 'ICE_CANDIDATE',
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });
  }, [sendWsMessage]);

  // 注册回调
  const setOnWebRTCOffer = useCallback((callback: (sdp: string) => void) => {
    onWebRTCOfferRef.current = callback;
  }, []);

  const setOnWebRTCAnswer = useCallback((callback: (sdp: string) => void) => {
    onWebRTCAnswerRef.current = callback;
  }, []);

  const setOnICECandidate = useCallback((callback: (candidate: RTCIceCandidateInit) => void) => {
    onICECandidateRef.current = callback;
  }, []);

  // 更新 status 为 chatting 当 WebRTC 连接建立
  const updateStatusToChatting = useCallback(() => {
    if (status === 'matched') {
      setStatus('chatting');
    }
  }, [status]);

  return {
    status,
    queuePosition,
    waitingCount,
    queueStats,
    session,
    messages,
    error,
    callEndInfo,
    onWebRTCOffer: onWebRTCOfferRef.current,
    onWebRTCAnswer: onWebRTCAnswerRef.current,
    onICECandidate: onICECandidateRef.current,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    sendMessage,
    endChat,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate,
    setOnWebRTCOffer,
    setOnWebRTCAnswer,
    setOnICECandidate,
  };
}
