import { useState, useRef, useCallback } from 'react';
import { liveStreamApi, getTelegramInitData, getJwtToken } from '../lib/api';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export type BroadcastStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'error';

export interface UseLiveStreamBroadcastReturn {
  broadcastStatus: BroadcastStatus;
  broadcastError: string | null;
  startBroadcast: (title?: string) => Promise<void>;
  stopBroadcast: () => Promise<void>;
  localStream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  facingMode: 'user' | 'environment';
  toggleCamera: () => void;
  toggleMic: () => void;
  switchCamera: () => Promise<void>;
}

export function useLiveStreamBroadcast(): UseLiveStreamBroadcastReturn {
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus>('idle');
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ingestWsRef = useRef<WebSocket | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');

  const startBroadcast = useCallback(async (title: string = '') => {
    try {
      setBroadcastStatus('starting');
      setBroadcastError(null);

      // 1. Get camera + microphone FIRST (before creating server-side stream)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持摄像头访问，请使用 Chrome / Safari 并确保通过 HTTPS 访问');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingModeRef.current,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
      } catch (mediaErr: any) {
        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
          throw new Error('摄像头或麦克风权限被拒绝，请在浏览器设置中允许访问');
        } else if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
          throw new Error('未检测到摄像头或麦克风设备');
        } else if (mediaErr.name === 'NotReadableError' || mediaErr.name === 'TrackStartError') {
          throw new Error('摄像头或麦克风被其他应用占用');
        } else if (mediaErr.name === 'OverconstrainedError') {
          throw new Error('摄像头不支持请求的分辨率');
        } else {
          throw new Error(`无法访问摄像头: ${mediaErr.message || mediaErr.name}`);
        }
      }

      // 2. Camera granted — now create server-side stream
      const response = await liveStreamApi.startStream(title);
      mediaStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(true);
      setIsMicOn(true);

      // 3. Open ingest WebSocket
      const initData = getTelegramInitData();
      const token = getJwtToken();

      let wsUrl = `${WS_BASE_URL}/live-stream/ingest`;
      if (initData) {
        wsUrl += `?initData=${encodeURIComponent(initData)}`;
      } else if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`;
      }

      const ws = new WebSocket(wsUrl);
      ingestWsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('Ingest WebSocket 连接失败'));
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('连接超时')), 10000);
      });

      // 4. Start MediaRecorder → send binary chunks via WS
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1500000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ingestWsRef.current?.readyState === WebSocket.OPEN) {
          ingestWsRef.current.send(event.data);
        }
      };

      recorder.onerror = () => {
        setBroadcastError('录制出错');
        setBroadcastStatus('error');
      };

      // Record in 1-second chunks
      recorder.start(1000);
      setBroadcastStatus('live');
    } catch (err: any) {
      console.error('Start broadcast failed:', err);
      setBroadcastError(err.message || '开播失败');
      setBroadcastStatus('error');
      // Clean up on error
      cleanup();
    }
  }, []);

  const stopBroadcast = useCallback(async () => {
    try {
      setBroadcastStatus('stopping');

      // Stop MediaRecorder
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      mediaRecorderRef.current = null;

      // Stop media tracks
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setLocalStream(null);

      // Close ingest WS
      if (ingestWsRef.current) {
        ingestWsRef.current.close();
        ingestWsRef.current = null;
      }

      // Call REST API to stop
      await liveStreamApi.stopStream();

      setBroadcastStatus('idle');
    } catch (err: any) {
      console.error('Stop broadcast failed:', err);
      setBroadcastError(err.message || '下播失败');
      setBroadcastStatus('idle'); // Reset to idle even on error
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  }, []);

  const toggleMic = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  const switchCamera = useCallback(async () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    const newFacing = facingModeRef.current === 'user' ? 'environment' : 'user';

    try {
      // Get new video track with opposite facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      stream.addTrack(newVideoTrack);

      facingModeRef.current = newFacing;
      setFacingMode(newFacing);

      // Trigger re-render so video element picks up the updated stream
      setLocalStream(null);
      requestAnimationFrame(() => setLocalStream(stream));
    } catch (err) {
      console.error('Switch camera failed:', err);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setLocalStream(null);

    if (ingestWsRef.current) {
      ingestWsRef.current.close();
      ingestWsRef.current = null;
    }

    // Tell server to stop the stream if it was started
    liveStreamApi.stopStream().catch(() => {});
  }, []);

  return {
    broadcastStatus,
    broadcastError,
    startBroadcast,
    stopBroadcast,
    localStream,
    isCameraOn,
    isMicOn,
    facingMode,
    toggleCamera,
    toggleMic,
    switchCamera,
  };
}
