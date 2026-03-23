import { useEffect, useRef, useState, useCallback } from 'react';
import { therapyApi, type TherapySessionStatusData } from '../lib/api';

export type ControllerPhase = 'loading' | 'waiting' | 'controlling' | 'ended' | 'error';

interface UseTherapyControllerOptions {
  shareCode: string;
  myName: string;
  myIdentity: string;
}

interface UseTherapyControllerReturn {
  phase: ControllerPhase;
  queuePosition: number | null;
  queueLength: number;
  estimatedWaitSeconds: number;
  controlTimeLeft: number;
  controlDuration: number;
  sessionStatus: TherapySessionStatusData | null;
  waveforms: string[];
  currentWaveformA: string | null;
  currentWaveformB: string | null;
  strengthA: number;
  strengthB: number;
  setStrength: (channel: 'A' | 'B', value: number) => void;
  changeWaveform: (name: string, channel?: 'A' | 'B') => void;
  leaveQueue: () => void;
  error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1';
const WS_BASE_URL = API_BASE_URL.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');

export function useTherapyController({
  shareCode,
  myName,
  myIdentity,
}: UseTherapyControllerOptions): UseTherapyControllerReturn {
  const [phase, setPhase] = useState<ControllerPhase>('loading');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState(0);
  const [controlTimeLeft, setControlTimeLeft] = useState(0);
  const [controlDuration, setControlDuration] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<TherapySessionStatusData | null>(null);
  const [waveforms, setWaveforms] = useState<string[]>([]);
  const [currentWaveformA, setCurrentWaveformA] = useState<string | null>(null);
  const [currentWaveformB, setCurrentWaveformB] = useState<string | null>(null);
  const [strengthA, setStrengthA] = useState(0);
  const [strengthB, setStrengthB] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const phaseRef = useRef<ControllerPhase>('loading');
  const debounceTimerA = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerB = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveformsLoadedRef = useRef(false);
  const isUnmountingRef = useRef(false);

  const updatePhase = useCallback((p: ControllerPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const leaveQueue = useCallback(() => {
    sendMessage({ type: 'LEAVE_QUEUE' });
    wsRef.current?.close();
    updatePhase('ended');
  }, [sendMessage, updatePhase]);

  const setStrength = useCallback((channel: 'A' | 'B', value: number) => {
    if (channel === 'A') {
      setStrengthA(value);
      if (debounceTimerA.current) clearTimeout(debounceTimerA.current);
      debounceTimerA.current = setTimeout(() => {
        sendMessage({ type: 'CONTROL', action: 'STRENGTH_A', value: String(value) });
      }, 200);
    } else {
      setStrengthB(value);
      if (debounceTimerB.current) clearTimeout(debounceTimerB.current);
      debounceTimerB.current = setTimeout(() => {
        sendMessage({ type: 'CONTROL', action: 'STRENGTH_B', value: String(value) });
      }, 200);
    }
  }, [sendMessage]);

  const changeWaveform = useCallback((name: string, channel: 'A' | 'B' = 'A') => {
    therapyApi.changeWaveform(shareCode, name, channel).catch(() => {});
    if (channel === 'A') {
      setCurrentWaveformA(name);
    } else {
      setCurrentWaveformB(name);
    }
  }, [shareCode]);

  useEffect(() => {
    isUnmountingRef.current = false;
    waveformsLoadedRef.current = false;
    phaseRef.current = 'loading';

    // Fetch initial session status (public endpoint)
    therapyApi.getSessionStatus(shareCode, myIdentity)
      .then(status => {
        if (isUnmountingRef.current) return;
        setSessionStatus(status);
        setStrengthA(status.strengthA);
        setStrengthB(status.strengthB);
      })
      .catch(() => {});

    // Connect WebSocket
    const wsUrl = `${WS_BASE_URL}/therapy/control/${encodeURIComponent(shareCode)}?identity=${encodeURIComponent(myIdentity)}&name=${encodeURIComponent(myName)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountingRef.current) return;
      ws.send(JSON.stringify({ type: 'JOIN_QUEUE', name: myName }));
    };

    ws.onmessage = (event) => {
      if (isUnmountingRef.current) return;
      try {
        const msg = JSON.parse(event.data as string);
        const type: string = msg.type;

        if (type === 'QUEUE_JOINED') {
          setQueuePosition(msg.position);
          setQueueLength(msg.totalWaiting);
          setEstimatedWaitSeconds(msg.estimatedWaitSeconds ?? 0);
          // Only set 'waiting' if not already promoted to 'controlling'
          // (advanceQueue sends CONTROL_STARTED before QUEUE_JOINED arrives)
          if (phaseRef.current !== 'controlling') {
            updatePhase('waiting');
          }

          if (!waveformsLoadedRef.current) {
            waveformsLoadedRef.current = true;
            therapyApi.getWaveforms(shareCode)
              .then(data => {
                if (isUnmountingRef.current) return;
                setWaveforms(data.waveforms);
                setCurrentWaveformA(data.currentWaveformA);
                setCurrentWaveformB(data.currentWaveformB);
              })
              .catch(() => {});
          }
        } else if (type === 'QUEUE_STATUS') {
          setQueuePosition(msg.position);
          setQueueLength(msg.totalWaiting);
          setEstimatedWaitSeconds(msg.estimatedWaitSeconds ?? 0);
          if (phaseRef.current === 'loading' || phaseRef.current === 'waiting') {
            updatePhase('waiting');
          }
        } else if (type === 'CONTROL_STARTED') {
          setControlDuration(msg.durationSeconds);
          setControlTimeLeft(msg.durationSeconds);
          setStrengthA(msg.strengthA ?? 0);
          setStrengthB(msg.strengthB ?? 0);
          if (msg.strengthLimitA !== undefined || msg.strengthLimitB !== undefined) {
            setSessionStatus(prev => prev ? {
              ...prev,
              strengthLimitA: msg.strengthLimitA ?? prev.strengthLimitA,
              strengthLimitB: msg.strengthLimitB ?? prev.strengthLimitB,
            } : prev);
          }
          updatePhase('controlling');
        } else if (type === 'CONTROL_TIME_UPDATE') {
          setControlTimeLeft(msg.timeLeftSeconds);
        } else if (type === 'CONTROL_ENDED') {
          updatePhase('ended');
        } else if (type === 'CONTROL_EXECUTED') {
          setStrengthA(msg.newStrengthA);
          setStrengthB(msg.newStrengthB);
        } else if (type === 'CONTROLLER_CHANGED') {
          if (msg.queueLength !== undefined) setQueueLength(msg.queueLength);
        } else if (type === 'SESSION_CLOSED') {
          updatePhase('ended');
        } else if (type === 'ERROR') {
          setError(msg.message ?? '发生错误');
          updatePhase('error');
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      if (isUnmountingRef.current) return;
      if (phaseRef.current !== 'controlling' && phaseRef.current !== 'ended') {
        setError('连接失败，请稍后重试');
        updatePhase('error');
      }
    };

    return () => {
      isUnmountingRef.current = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try { ws.send(JSON.stringify({ type: 'LEAVE_QUEUE' })); } catch { /* ignore */ }
        ws.close();
      }
      if (debounceTimerA.current) clearTimeout(debounceTimerA.current);
      if (debounceTimerB.current) clearTimeout(debounceTimerB.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, myIdentity, myName]);

  return {
    phase,
    queuePosition,
    queueLength,
    estimatedWaitSeconds,
    controlTimeLeft,
    controlDuration,
    sessionStatus,
    waveforms,
    currentWaveformA,
    currentWaveformB,
    strengthA,
    strengthB,
    setStrength,
    changeWaveform,
    leaveQueue,
    error,
  };
}
