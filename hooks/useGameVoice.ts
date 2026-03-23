import { useState, useRef, useCallback, useEffect } from 'react';
import type { TavernServerMessage } from '../types';

export interface PeerConnection {
  seatIndex: number;
  pc: RTCPeerConnection;
  isSpeaking: boolean;
}

export interface UseGameVoiceReturn {
  isMicEnabled: boolean;
  isSpeaking: boolean;
  peerStates: Map<number, { connected: boolean; isSpeaking: boolean }>;
  toggleMic: () => void;
  initVoice: (ws: WebSocket | null, mySeat: number, totalSeats: number) => void;
  cleanupVoice: () => void;
  handleVoiceMessage: (data: TavernServerMessage) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useGameVoice(): UseGameVoiceReturn {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peerStates, setPeerStates] = useState<Map<number, { connected: boolean; isSpeaking: boolean }>>(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const mySeatRef = useRef<number>(-1);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cleanupVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupVoice = useCallback(() => {
    // 停止本地流
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // 关闭所有 peer 连接
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // 停止分析器
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;

    setIsMicEnabled(false);
    setIsSpeaking(false);
    setPeerStates(new Map());
  }, []);

  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const detect = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      setIsSpeaking(avg > 15);
      animFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  }, []);

  const createPeerConnection = useCallback(
    (targetSeat: number, isInitiator: boolean) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // 添加本地音频轨道
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // 处理远端流
      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
        setPeerStates((prev) => {
          const next = new Map(prev);
          next.set(targetSeat, { connected: true, isSpeaking: false });
          return next;
        });
      };

      // ICE 候选
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ICE_CANDIDATE',
              targetSeat,
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            })
          );
        }
      };

      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => {
          const next = new Map(prev);
          next.set(targetSeat, {
            connected: pc.connectionState === 'connected',
            isSpeaking: false,
          });
          return next;
        });
      };

      peersRef.current.set(targetSeat, pc);

      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'WEBRTC_OFFER',
                targetSeat,
                sdp: offer.sdp,
              })
            );
          }
        });
      }

      return pc;
    },
    []
  );

  const initVoice = useCallback(
    async (ws: WebSocket | null, mySeat: number, totalSeats: number) => {
      if (!ws) return;
      wsRef.current = ws;
      mySeatRef.current = mySeat;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;

        // 默认静音
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
        setIsMicEnabled(false);

        startSpeakingDetection(stream);

        // 与所有其他座位建立连接（较小的 seatIndex 作为发起方）
        for (let i = 0; i < totalSeats; i++) {
          if (i !== mySeat) {
            createPeerConnection(i, mySeat < i);
          }
        }
      } catch (e) {
        console.error('Failed to init voice:', e);
      }
    },
    [createPeerConnection, startSpeakingDetection]
  );

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks && tracks.length > 0) {
      const newEnabled = !tracks[0].enabled;
      tracks.forEach((t) => (t.enabled = newEnabled));
      setIsMicEnabled(newEnabled);
      if (!newEnabled) setIsSpeaking(false);
    }
  }, []);

  const handleVoiceMessage = useCallback(
    (data: TavernServerMessage) => {
      switch (data.type) {
        case 'WEBRTC_OFFER': {
          const fromSeat = data.fromSeat;
          if (fromSeat == null) return;
          let pc = peersRef.current.get(fromSeat);
          if (!pc) {
            pc = createPeerConnection(fromSeat, false);
          }
          pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
          pc.createAnswer().then((answer) => {
            pc!.setLocalDescription(answer);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'WEBRTC_ANSWER',
                  targetSeat: fromSeat,
                  sdp: answer.sdp,
                })
              );
            }
          });
          break;
        }

        case 'WEBRTC_ANSWER': {
          const fromSeat = data.fromSeat;
          if (fromSeat == null) return;
          const pc = peersRef.current.get(fromSeat);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
          }
          break;
        }

        case 'ICE_CANDIDATE': {
          const fromSeat = data.fromSeat;
          if (fromSeat == null || !data.candidate) return;
          const pc = peersRef.current.get(fromSeat);
          if (pc) {
            pc.addIceCandidate(
              new RTCIceCandidate({
                candidate: data.candidate,
                sdpMid: data.sdpMid ?? undefined,
                sdpMLineIndex: data.sdpMLineIndex ?? undefined,
              })
            );
          }
          break;
        }
      }
    },
    [createPeerConnection]
  );

  return {
    isMicEnabled,
    isSpeaking,
    peerStates,
    toggleMic,
    initVoice,
    cleanupVoice,
    handleVoiceMessage,
  };
}
