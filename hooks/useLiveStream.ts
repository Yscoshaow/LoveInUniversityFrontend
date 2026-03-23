import { useState, useRef, useCallback, useEffect } from 'react';
import { getTelegramInitData, getJwtToken } from '../lib/api';
import type {
  LiveStreamData,
  LiveStreamChatMessage,
  LiveStreamGiftMessage,
  LiveStreamServerMessage,
} from '../types';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export type LiveStreamStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseLiveStreamReturn {
  status: LiveStreamStatus;
  isLive: boolean;
  streamData: LiveStreamData | null;
  viewerCount: number;
  chatMessages: LiveStreamChatMessage[];
  recentGifts: LiveStreamGiftMessage[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendChatMessage: (content: string) => void;
  sendGift: (amount: number) => void;
}

export function useLiveStream(): UseLiveStreamReturn {
  const [status, setStatus] = useState<LiveStreamStatus>('disconnected');
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState<LiveStreamData | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<LiveStreamChatMessage[]>([]);
  const [recentGifts, setRecentGifts] = useState<LiveStreamGiftMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: LiveStreamServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'CONNECTED':
          setStatus('connected');
          setError(null);
          if (data.stream) {
            setStreamData(data.stream);
            setIsLive(data.stream.status === 'LIVE');
            setViewerCount(data.stream.viewerCount);
          }
          break;

        case 'ROOM_STATUS':
          setIsLive(data.isLive);
          setStreamData(data.stream);
          break;

        case 'CHAT_MESSAGE':
          setChatMessages((prev) => [...prev.slice(-200), data as LiveStreamChatMessage]);
          break;

        case 'GIFT_RECEIVED':
          setRecentGifts((prev) => [...prev.slice(-50), data as LiveStreamGiftMessage]);
          // Also show gift as a chat-like entry
          break;

        case 'VIEWER_COUNT':
          setViewerCount(data.count);
          break;

        case 'STREAM_STARTED':
          setIsLive(true);
          setStreamData(data.stream);
          break;

        case 'STREAM_ENDED':
          setIsLive(false);
          setStreamData(null);
          break;

        case 'ERROR':
          setError(data.message);
          break;
      }
    } catch (e) {
      console.error('Failed to parse live stream message:', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setError(null);

    const initData = getTelegramInitData();
    const token = getJwtToken();

    let wsUrl = `${WS_BASE_URL}/live-stream/ws`;
    if (initData) {
      wsUrl += `?initData=${encodeURIComponent(initData)}`;
    } else if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Live stream WS connected');
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      setStatus('error');
      setError('连接失败');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
    };
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
    setChatMessages([]);
    setRecentGifts([]);
  }, []);

  const sendChatMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', content }));
  }, []);

  const sendGift = useCallback((amount: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'SEND_GIFT', amount }));
  }, []);

  return {
    status,
    isLive,
    streamData,
    viewerCount,
    chatMessages,
    recentGifts,
    error,
    connect,
    disconnect,
    sendChatMessage,
    sendGift,
  };
}
