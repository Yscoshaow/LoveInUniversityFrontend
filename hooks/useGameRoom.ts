import { useState, useRef, useCallback, useEffect } from 'react';
import { getTelegramInitData, getJwtToken } from '../lib/api';
import type {
  TavernServerMessage,
  TavernRoomDetail,
  TavernPlayerInfo,
  TavernEntryType,
} from '../types';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export type GameRoomStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'matchmaking'
  | 'matched'
  | 'waiting'
  | 'starting'
  | 'in_game'
  | 'error';

export interface UseGameRoomReturn {
  status: GameRoomStatus;
  room: TavernRoomDetail | null;
  roomWs: WebSocket | null;
  sessionToken: string | null;
  yourSeatIndex: number;
  error: string | null;
  matchmakingInfo: { playersInQueue: number; requiredPlayers: number } | null;
  // 房间 WebSocket 操作
  connectToRoom: (roomId: number) => void;
  disconnectFromRoom: () => void;
  sendReady: () => void;
  sendStartGame: () => void;
  sendAddBot: (difficulty: string) => void;
  sendRemoveBot: (seatIndex: number) => void;
  // 匹配 WebSocket 操作
  connectToMatchmaking: () => void;
  disconnectFromMatchmaking: () => void;
  joinMatchmaking: (entryType: TavernEntryType, lockId?: number) => void;
  leaveMatchmaking: () => void;
  // 游戏阶段事件回调注册
  onGameStarting: React.MutableRefObject<((countdown: number) => void) | null>;
  onMatchFound: React.MutableRefObject<((roomId: number) => void) | null>;
  onRoomUpdate: React.MutableRefObject<((room: TavernRoomDetail) => void) | null>;
}

export function useGameRoom(): UseGameRoomReturn {
  const [status, setStatus] = useState<GameRoomStatus>('idle');
  const [room, setRoom] = useState<TavernRoomDetail | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [yourSeatIndex, setYourSeatIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [matchmakingInfo, setMatchmakingInfo] = useState<{
    playersInQueue: number;
    requiredPlayers: number;
  } | null>(null);
  const [roomWs, setRoomWs] = useState<WebSocket | null>(null);

  const roomWsRef = useRef<WebSocket | null>(null);
  const matchWsRef = useRef<WebSocket | null>(null);

  // 事件回调
  const onGameStarting = useRef<((countdown: number) => void) | null>(null);
  const onMatchFound = useRef<((roomId: number) => void) | null>(null);
  const onRoomUpdate = useRef<((room: TavernRoomDetail) => void) | null>(null);

  useEffect(() => {
    return () => {
      roomWsRef.current?.close();
      matchWsRef.current?.close();
    };
  }, []);

  const getAuthParams = useCallback(() => {
    const initData = getTelegramInitData();
    const token = getJwtToken();
    if (initData) return `initData=${encodeURIComponent(initData)}`;
    if (token) return `token=${encodeURIComponent(token)}`;
    return '';
  }, []);

  // ===== 房间 WebSocket =====

  const handleRoomMessage = useCallback((event: MessageEvent) => {
    try {
      const data: TavernServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'CONNECTED':
          setSessionToken(data.sessionToken ?? null);
          setYourSeatIndex(data.yourSeatIndex ?? -1);
          setStatus('waiting');
          break;

        case 'ROOM_UPDATE':
          if (data.room) {
            setRoom(data.room);
            onRoomUpdate.current?.(data.room);
            if (data.room.status === 'IN_GAME') {
              setStatus('in_game');
            }
          }
          break;

        case 'GAME_STARTING':
          setStatus('starting');
          onGameStarting.current?.(data.countdownSeconds ?? 3);
          break;

        case 'GAME_STATE':
        case 'ROUND_START':
        case 'TURN_START':
          setStatus('in_game');
          break;

        case 'ERROR':
          setError(data.message ?? 'Unknown error');
          break;
      }
    } catch (e) {
      console.error('Failed to parse room WS message:', e);
    }
  }, []);

  const connectToRoom = useCallback(
    (roomId: number) => {
      if (roomWsRef.current) roomWsRef.current.close();

      setStatus('connecting');
      setError(null);

      const ws = new WebSocket(`${WS_BASE_URL}/tavern/ws/room/${roomId}?${getAuthParams()}`);

      ws.onopen = () => {
        console.log('Connected to tavern room', roomId);
      };

      ws.onmessage = handleRoomMessage;

      ws.onerror = () => {
        setStatus('error');
        setError('连接失败');
      };

      ws.onclose = () => {
        if (status !== 'error') {
          setStatus('idle');
        }
      };

      roomWsRef.current = ws;
      setRoomWs(ws);
    },
    [getAuthParams, handleRoomMessage, status]
  );

  const disconnectFromRoom = useCallback(() => {
    roomWsRef.current?.close();
    roomWsRef.current = null;
    setRoomWs(null);
    setStatus('idle');
    setRoom(null);
    setSessionToken(null);
  }, []);

  const sendRoomMessage = useCallback((msg: Record<string, unknown>) => {
    if (roomWsRef.current?.readyState === WebSocket.OPEN) {
      roomWsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendReady = useCallback(() => sendRoomMessage({ type: 'READY' }), [sendRoomMessage]);
  const sendStartGame = useCallback(() => sendRoomMessage({ type: 'START_GAME' }), [sendRoomMessage]);
  const sendAddBot = useCallback(
    (difficulty: string) => sendRoomMessage({ type: 'ADD_BOT', botDifficulty: difficulty }),
    [sendRoomMessage]
  );
  const sendRemoveBot = useCallback(
    (seatIndex: number) => sendRoomMessage({ type: 'REMOVE_BOT', seatIndex }),
    [sendRoomMessage]
  );

  // ===== 匹配 WebSocket =====

  const handleMatchMessage = useCallback((event: MessageEvent) => {
    try {
      const data: TavernServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'MATCHMAKING_STATUS':
          setMatchmakingInfo({
            playersInQueue: data.playersInQueue ?? 0,
            requiredPlayers: data.requiredPlayers ?? 4,
          });
          break;

        case 'MATCH_FOUND':
          setStatus('matched');
          if (data.roomId) {
            onMatchFound.current?.(data.roomId);
          }
          break;

        case 'ERROR':
          setError(data.message ?? 'Unknown error');
          break;
      }
    } catch (e) {
      console.error('Failed to parse matchmaking WS message:', e);
    }
  }, []);

  const connectToMatchmaking = useCallback(() => {
    if (matchWsRef.current) matchWsRef.current.close();

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(`${WS_BASE_URL}/tavern/ws/matchmaking?${getAuthParams()}`);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = handleMatchMessage;

    ws.onerror = () => {
      setStatus('error');
      setError('匹配服务连接失败');
    };

    ws.onclose = () => {
      setMatchmakingInfo(null);
    };

    matchWsRef.current = ws;
  }, [getAuthParams, handleMatchMessage]);

  const disconnectFromMatchmaking = useCallback(() => {
    matchWsRef.current?.close();
    matchWsRef.current = null;
    setStatus('idle');
    setMatchmakingInfo(null);
  }, []);

  const joinMatchmaking = useCallback(
    (entryType: TavernEntryType, lockId?: number) => {
      if (matchWsRef.current?.readyState === WebSocket.OPEN) {
        setStatus('matchmaking');
        matchWsRef.current.send(
          JSON.stringify({
            type: 'JOIN_MATCHMAKING',
            entryType,
            lockId,
          })
        );
      }
    },
    []
  );

  const leaveMatchmaking = useCallback(() => {
    if (matchWsRef.current?.readyState === WebSocket.OPEN) {
      matchWsRef.current.send(JSON.stringify({ type: 'LEAVE_MATCHMAKING' }));
      setStatus('connected');
    }
  }, []);

  return {
    status,
    room,
    roomWs,
    sessionToken,
    yourSeatIndex,
    error,
    matchmakingInfo,
    connectToRoom,
    disconnectFromRoom,
    sendReady,
    sendStartGame,
    sendAddBot,
    sendRemoveBot,
    connectToMatchmaking,
    disconnectFromMatchmaking,
    joinMatchmaking,
    leaveMatchmaking,
    onGameStarting,
    onMatchFound,
    onRoomUpdate,
  };
}
