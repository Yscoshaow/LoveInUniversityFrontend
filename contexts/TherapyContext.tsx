import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getTelegramInitData, getJwtToken } from '../lib/api';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

/**
 * 服务器连接状态
 */
export type ServerConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * 设备绑定状态
 * - PENDING: 等待 App 扫码
 * - APP_CONNECTED: App 已连接，等待绑定
 * - BOUND: 已绑定
 * - DISCONNECTED: 已断开
 */
export type DeviceBindStatus = 'PENDING' | 'APP_CONNECTED' | 'BOUND' | 'DISCONNECTED';

/**
 * 设备类型
 */
export type DeviceType = 'DGLAB_WEBSOCKET' | 'DGLAB_BLE_V2' | 'DGLAB_BLE_V3' | 'YCY_BLE_GEN1' | 'YCY_BLE_GEN2';

/**
 * 控制者信息
 */
export interface ControllerInfo {
  id: number;
  identity: string;
  name: string;
  status: string;
  position: number;
  controlStartedAt?: string;
}

/**
 * 智能强度设置
 */
export interface SmartStrengthSettings {
  // 随机跳变
  randomJump: {
    enabled: boolean;
    minStrength: number;  // 最小强度百分比
    maxStrength: number;  // 最大强度百分比
    intervalSeconds: number;  // 跳变间隔秒数
  };
  // 自动提升
  autoIncrease: {
    enabled: boolean;
    incrementAmount: number;  // 每次增加量
    intervalSeconds: number;  // 增加间隔秒数
  };
  // B跟随A
  bFollowA: {
    enabled: boolean;
    offset: number;  // B相对于A的偏移量（可为负）
  };
  // 随机间隔输出
  randomInterval: {
    enabled: boolean;
    workMinSeconds: number;     // 工作最小时长
    workMaxSeconds: number;     // 工作最大时长
    pauseMinSeconds: number;    // 暂停最小时长
    pauseMaxSeconds: number;    // 暂停最大时长
  };
}

/**
 * 设备信息（多设备支持）
 */
export interface DeviceInfo {
  deviceId: string;
  connectionId: string;
  bindStatus: DeviceBindStatus;
  deviceType: DeviceType;
  qrCodeUrl: string | null;
  strengthA: number;
  strengthB: number;
  strengthLimitA: number;
  strengthLimitB: number;
  currentWaveformA: string | null;
  currentWaveformB: string | null;
}

/**
 * 理疗会话信息
 */
export interface TherapySession {
  sessionId: number;
  shareCode: string;
  deviceId: string;
  strengthA: number;
  strengthB: number;
  strengthLimitA: number;
  strengthLimitB: number;
  queueLength: number;
  currentController?: ControllerInfo;
}

/**
 * 理疗 Context 状态
 */
interface TherapyContextState {
  // 服务器连接状态
  serverStatus: ServerConnectionStatus;
  serverError: string | null;

  // 活跃设备的绑定状态（便捷访问）
  deviceBindStatus: DeviceBindStatus;
  deviceQRCodeUrl: string | null;
  deviceConnectionId: string | null;

  // 会话信息
  session: TherapySession | null;

  // 活跃设备的当前强度
  strengthA: number;
  strengthB: number;

  // 控制状态（作为控制者）
  isControlling: boolean;
  controlTimeLeft: number;
  queuePosition: number | null;

  // 波形
  waveforms: string[];
  currentWaveformA: string | null;
  currentWaveformB: string | null;

  // 智能强度
  smartStrengthSettings: SmartStrengthSettings;

  // 多设备
  devices: DeviceInfo[];
  activeDeviceId: string | null;

  // BLE 状态（服务器下发的波形数据，由前端本地循环发送给设备）
  bleWaveformDataA: string[] | null;
  bleWaveformDataB: string[] | null;
  bleStrengthTarget: { a: number; b: number } | null;

  // 操作
  connectServer: () => void;
  disconnectServer: () => void;
  createSession: (options?: CreateSessionOptions) => void;
  closeSession: () => void;
  setStrength: (channel: 'A' | 'B', value: number) => void;
  sendControl: (action: string, value: string) => void;
  kickController: () => void;
  changeWaveform: (waveformName: string, channel?: 'A' | 'B') => void;
  updateSmartStrength: (settings: Partial<SmartStrengthSettings>) => void;
  addDevice: () => void;
  removeDevice: (deviceId: string) => void;
  selectDevice: (deviceId: string) => void;

  // BLE 操作
  reportBleConnected: (deviceId?: string) => void;
  reportBleDisconnected: (deviceId?: string) => void;
  reportBleStrengthFeedback: (strengthA: number, strengthB: number, limitA: number, limitB: number, deviceId?: string) => void;

  // 重置所有状态
  reset: () => void;
}

interface CreateSessionOptions {
  strengthLimitA?: number;
  strengthLimitB?: number;
  controlDurationSeconds?: number;
  deviceType?: DeviceType;
}

const TherapyContext = createContext<TherapyContextState | null>(null);

export const useTherapy = () => {
  const context = useContext(TherapyContext);
  if (!context) {
    throw new Error('useTherapy must be used within a TherapyProvider');
  }
  return context;
};

const defaultSmartStrengthSettings: SmartStrengthSettings = {
  randomJump: { enabled: false, minStrength: 10, maxStrength: 50, intervalSeconds: 5 },
  autoIncrease: { enabled: false, incrementAmount: 1, intervalSeconds: 10 },
  bFollowA: { enabled: false, offset: 0 },
  randomInterval: { enabled: false, workMinSeconds: 5, workMaxSeconds: 15, pauseMinSeconds: 3, pauseMaxSeconds: 10 },
};

/**
 * TherapyProvider - 全局理疗状态管理
 *
 * 新架构：
 * - 服务器作为 DG-Lab SOCKET 服务
 * - 用户网页只连接到服务器
 * - 郊狼 App 通过扫描二维码连接到服务器
 * - 服务器转发控制指令给郊狼 App
 * - 支持多设备同时连接，A/B通道独立波形
 */
export const TherapyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 服务器连接状态
  const [serverStatus, setServerStatus] = useState<ServerConnectionStatus>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  // 会话信息
  const [session, setSession] = useState<TherapySession | null>(null);

  // 控制状态
  const [isControlling, setIsControlling] = useState(false);
  const [controlTimeLeft, setControlTimeLeft] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  // 波形状态
  const [waveforms, setWaveforms] = useState<string[]>([]);
  const [currentWaveformA, setCurrentWaveformA] = useState<string | null>(null);
  const [currentWaveformB, setCurrentWaveformB] = useState<string | null>(null);

  // 智能强度设置
  const [smartStrengthSettings, setSmartStrengthSettings] = useState<SmartStrengthSettings>(defaultSmartStrengthSettings);

  // 多设备状态
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  // BLE 状态（服务器下发的波形 hex 数据，由前端本地循环发送给 BLE 设备）
  const [bleWaveformDataA, setBleWaveformDataA] = useState<string[] | null>(null);
  const [bleWaveformDataB, setBleWaveformDataB] = useState<string[] | null>(null);
  const [bleStrengthTarget, setBleStrengthTarget] = useState<{ a: number; b: number } | null>(null);

  // 服务器 WebSocket ref
  const serverWsRef = useRef<WebSocket | null>(null);
  // 标记是否为主动断开（避免 onclose 中的闭包陈旧问题）
  const isDisconnectingRef = useRef(false);
  // Ref 保证 WebSocket onmessage 始终使用最新的 handler（避免闭包陈旧）
  const handleServerMessageRef = useRef<(event: MessageEvent) => void>(() => {});
  // 追踪当前活跃设备是否为 BLE（供 WebSocket handler 中使用，避免闭包陈旧）
  const isBleDeviceRef = useRef(false);

  // 活跃设备的便捷访问
  const activeDevice = useMemo(() => {
    if (!activeDeviceId) return devices[0] ?? null;
    return devices.find(d => d.deviceId === activeDeviceId) ?? devices[0] ?? null;
  }, [devices, activeDeviceId]);

  const deviceBindStatus: DeviceBindStatus = activeDevice?.bindStatus ?? 'PENDING';
  const deviceQRCodeUrl = activeDevice?.qrCodeUrl ?? null;
  const deviceConnectionId = activeDevice?.connectionId ?? null;
  const strengthA = activeDevice?.strengthA ?? 0;
  const strengthB = activeDevice?.strengthB ?? 0;

  // 保持 BLE ref 与设备类型同步
  const isBle = activeDevice?.deviceType === 'DGLAB_BLE_V2' || activeDevice?.deviceType === 'DGLAB_BLE_V3'
    || activeDevice?.deviceType === 'YCY_BLE_GEN1' || activeDevice?.deviceType === 'YCY_BLE_GEN2';
  isBleDeviceRef.current = isBle;

  // 发送服务器消息
  const sendServerMessage = useCallback((message: object) => {
    console.log('sendServerMessage called:', message, 'readyState:', serverWsRef.current?.readyState);
    if (serverWsRef.current?.readyState === WebSocket.OPEN) {
      serverWsRef.current.send(JSON.stringify(message));
      console.log('Message sent successfully');
    } else {
      console.warn('WebSocket not ready, message not sent');
    }
  }, []);

  // 更新指定设备的状态
  const updateDevice = useCallback((deviceId: string, updater: (device: DeviceInfo) => DeviceInfo) => {
    setDevices(prev => prev.map(d => d.deviceId === deviceId ? updater(d) : d));
  }, []);

  // 处理服务器消息
  const handleServerMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Therapy server message:', data);

      switch (data.type) {
        case 'SESSION_CREATED': {
          console.log('Received SESSION_CREATED:', data);
          setSession({
            sessionId: data.sessionId,
            shareCode: data.shareCode,
            deviceId: data.deviceId,
            strengthA: 0,
            strengthB: 0,
            strengthLimitA: 100,
            strengthLimitB: 100,
            queueLength: 0
          });
          // 初始化首台设备
          const actualDeviceId = data.deviceName || 'device_1';
          const firstDevice: DeviceInfo = {
            deviceId: actualDeviceId,
            connectionId: data.deviceId,
            bindStatus: 'PENDING',
            deviceType: data.deviceType || 'DGLAB_WEBSOCKET',
            qrCodeUrl: null,
            strengthA: 0,
            strengthB: 0,
            strengthLimitA: 100,
            strengthLimitB: 100,
            currentWaveformA: null,
            currentWaveformB: null,
          };
          setDevices([firstDevice]);
          setActiveDeviceId(actualDeviceId);
          // 重置 BLE 状态
          setBleWaveformDataA(null);
          setBleWaveformDataB(null);
          setBleStrengthTarget(null);
          break;
        }

        case 'DEVICE_QRCODE': {
          // 收到二维码信息
          console.log('Received DEVICE_QRCODE:', data.qrCodeUrl);
          const targetDeviceId = data.deviceId;
          if (targetDeviceId) {
            updateDevice(targetDeviceId, d => ({ ...d, qrCodeUrl: data.qrCodeUrl, connectionId: data.connectionId }));
          } else {
            // 向后兼容：无 deviceId 时更新主设备
            setDevices(prev => {
              if (prev.length > 0) {
                const updated = [...prev];
                updated[0] = { ...updated[0], qrCodeUrl: data.qrCodeUrl, connectionId: data.connectionId };
                return updated;
              }
              return prev;
            });
          }
          break;
        }

        case 'DEVICE_BIND_STATUS': {
          const targetDeviceId = data.deviceId;
          const status = data.status as DeviceBindStatus;
          if (targetDeviceId) {
            updateDevice(targetDeviceId, d => ({ ...d, bindStatus: status }));
          } else {
            // 向后兼容：无 deviceId 时更新主设备
            setDevices(prev => {
              if (prev.length > 0) {
                const updated = [...prev];
                updated[0] = { ...updated[0], bindStatus: status };
                return updated;
              }
              return prev;
            });
          }
          break;
        }

        case 'CONNECTED':
          setSession({
            sessionId: data.sessionId,
            shareCode: data.shareCode,
            deviceId: data.deviceId,
            strengthA: data.strengthA,
            strengthB: data.strengthB,
            strengthLimitA: data.strengthLimitA,
            strengthLimitB: data.strengthLimitB,
            queueLength: data.queueLength,
            currentController: data.currentController
          });
          break;

        case 'DEVICE_STATUS': {
          const targetDeviceId = data.deviceId;
          if (targetDeviceId) {
            updateDevice(targetDeviceId, d => ({
              ...d,
              strengthA: data.strengthA,
              strengthB: data.strengthB,
              ...(data.strengthLimitA !== undefined && { strengthLimitA: data.strengthLimitA }),
              ...(data.strengthLimitB !== undefined && { strengthLimitB: data.strengthLimitB }),
            }));
          } else {
            // 向后兼容
            setDevices(prev => {
              if (prev.length > 0) {
                const updated = [...prev];
                updated[0] = {
                  ...updated[0],
                  strengthA: data.strengthA,
                  strengthB: data.strengthB,
                  ...(data.strengthLimitA !== undefined && { strengthLimitA: data.strengthLimitA }),
                  ...(data.strengthLimitB !== undefined && { strengthLimitB: data.strengthLimitB }),
                };
                return updated;
              }
              return prev;
            });
          }
          setSession(prev => prev ? {
            ...prev,
            strengthA: data.strengthA,
            strengthB: data.strengthB,
            ...(data.strengthLimitA !== undefined && { strengthLimitA: data.strengthLimitA }),
            ...(data.strengthLimitB !== undefined && { strengthLimitB: data.strengthLimitB }),
          } : null);

          // BLE 设备冗余更新：确保 bleStrengthTarget 同步
          // (BLE_STRENGTH_UPDATE 是主要路径，但 DEVICE_STATUS 作为后备)
          if (isBleDeviceRef.current) {
            setBleStrengthTarget({ a: data.strengthA, b: data.strengthB });
          }
          break;
        }

        case 'CONTROL_EXECUTED':
          // 更新活跃设备
          if (activeDeviceId) {
            updateDevice(activeDeviceId, d => ({
              ...d,
              strengthA: data.newStrengthA,
              strengthB: data.newStrengthB,
            }));
          }
          setSession(prev => prev ? {
            ...prev,
            strengthA: data.newStrengthA,
            strengthB: data.newStrengthB
          } : null);
          break;

        case 'CONTROLLER_CHANGED':
          setSession(prev => prev ? {
            ...prev,
            currentController: data.controller,
            queueLength: data.queueLength
          } : null);
          break;

        case 'CONTROL_STARTED':
          setIsControlling(true);
          setControlTimeLeft(data.durationSeconds);
          break;

        case 'CONTROL_ENDED':
          setIsControlling(false);
          setControlTimeLeft(0);
          break;

        case 'CONTROL_TIME_UPDATE':
          setControlTimeLeft(data.timeLeftSeconds);
          break;

        case 'QUEUE_STATUS':
        case 'QUEUE_JOINED':
          setQueuePosition(data.position);
          break;

        case 'SESSION_CLOSED':
          setSession(null);
          setIsControlling(false);
          setDevices([]);
          setActiveDeviceId(null);
          setBleWaveformDataA(null);
          setBleWaveformDataB(null);
          setBleStrengthTarget(null);
          break;

        case 'WAVEFORM_LIST':
          setWaveforms(data.waveforms || []);
          setCurrentWaveformA(data.currentWaveformA ?? data.currentWaveform ?? null);
          setCurrentWaveformB(data.currentWaveformB ?? data.currentWaveform ?? null);
          break;

        case 'WAVEFORM_CHANGED': {
          const channel = data.channel || 'A';
          if (channel === 'B') {
            setCurrentWaveformB(data.waveformName || null);
          } else {
            setCurrentWaveformA(data.waveformName || null);
          }
          // 更新设备中的波形信息
          const wfDeviceId = data.deviceId;
          if (wfDeviceId) {
            updateDevice(wfDeviceId, d => ({
              ...d,
              ...(channel === 'B'
                ? { currentWaveformB: data.waveformName || null }
                : { currentWaveformA: data.waveformName || null }),
            }));
          }
          break;
        }

        case 'DEVICE_LIST':
          // 完整设备列表更新（保留已有的 qrCodeUrl，因为 QR 码单独发送）
          setDevices(prev => {
            const prevMap = new Map(prev.map(d => [d.deviceId, d]));
            return data.devices.map((d: any) => ({
              deviceId: d.deviceId,
              connectionId: d.connectionId,
              bindStatus: d.bindStatus as DeviceBindStatus,
              deviceType: d.deviceType || 'DGLAB_WEBSOCKET',
              qrCodeUrl: prevMap.get(d.deviceId)?.qrCodeUrl ?? null,
              strengthA: d.strengthA,
              strengthB: d.strengthB,
              strengthLimitA: d.strengthLimitA,
              strengthLimitB: d.strengthLimitB,
              currentWaveformA: d.currentWaveformA,
              currentWaveformB: d.currentWaveformB,
            }));
          });
          if (!activeDeviceId && data.devices.length > 0) {
            setActiveDeviceId(data.devices[0].deviceId);
          }
          break;

        case 'DEVICE_ADDED': {
          // 新设备添加
          const newDevice: DeviceInfo = {
            deviceId: data.deviceId,
            connectionId: data.connectionId,
            bindStatus: 'PENDING',
            deviceType: data.deviceType || 'DGLAB_WEBSOCKET',
            qrCodeUrl: data.qrCodeUrl,
            strengthA: 0,
            strengthB: 0,
            strengthLimitA: 100,
            strengthLimitB: 100,
            currentWaveformA: null,
            currentWaveformB: null,
          };
          setDevices(prev => [...prev, newDevice]);
          // 自动切换到新设备
          setActiveDeviceId(data.deviceId);
          break;
        }

        // ─── BLE 消息 ───
        case 'BLE_WAVEFORM_DATA': {
          // 服务器下发完整波形 hex 数组，前端本地循环发送给 BLE 设备
          const ch = data.channel as string;
          if (ch === 'A') {
            setBleWaveformDataA(data.hexData);
          } else if (ch === 'B') {
            setBleWaveformDataB(data.hexData);
          }
          break;
        }

        case 'BLE_STRENGTH_UPDATE': {
          // 服务器通知前端更新 BLE 设备强度
          setBleStrengthTarget({ a: data.strengthA, b: data.strengthB });
          break;
        }

        case 'BLE_CLEAR_WAVEFORM': {
          // 服务器通知清除某通道波形
          const ch = data.channel as string;
          if (ch === 'A') {
            setBleWaveformDataA(null);
          } else if (ch === 'B') {
            setBleWaveformDataB(null);
          }
          break;
        }

        case 'ERROR':
          setServerError(data.message);
          break;
      }
    } catch (e) {
      console.error('Failed to parse therapy server message:', e);
    }
  }, [updateDevice, activeDeviceId]);

  // 保持 ref 同步，使 WebSocket 始终调用最新 handler
  handleServerMessageRef.current = handleServerMessage;

  // 连接服务器
  const connectServer = useCallback(() => {
    if (serverWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const initData = getTelegramInitData();
    const jwtToken = getJwtToken();
    if (!initData && !jwtToken) {
      setServerError('未找到认证信息');
      setServerStatus('error');
      return;
    }

    setServerStatus('connecting');
    setServerError(null);

    const authParam = initData
      ? `initData=${encodeURIComponent(initData)}`
      : `token=${encodeURIComponent(jwtToken!)}`;
    const wsUrl = `${WS_BASE_URL}/therapy/owner?${authParam}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Therapy server WebSocket connected');
      setServerStatus('connected');
      setServerError(null);
    };

    ws.onmessage = (event: MessageEvent) => handleServerMessageRef.current(event);

    ws.onclose = (event) => {
      console.log('Therapy server WebSocket closed:', event.code, event.reason);
      serverWsRef.current = null;
      if (isDisconnectingRef.current) {
        // 主动断开，不设置错误状态
        isDisconnectingRef.current = false;
      } else {
        // 非主动断开（服务器断开/网络错误）
        setServerStatus('error');
        setServerError('服务器连接已断开');
      }
    };

    ws.onerror = (event) => {
      console.error('Therapy server WebSocket error:', event);
      setServerStatus('error');
      setServerError('服务器连接失败');
    };

    serverWsRef.current = ws;
  }, []);

  // 断开服务器
  const disconnectServer = useCallback(() => {
    isDisconnectingRef.current = true;
    if (serverWsRef.current) {
      serverWsRef.current.close();
      serverWsRef.current = null;
    }
    setServerStatus('idle');
    setServerError(null);
    setSession(null);
    setIsControlling(false);
    setQueuePosition(null);
    setDevices([]);
    setActiveDeviceId(null);
    setWaveforms([]);
    setCurrentWaveformA(null);
    setCurrentWaveformB(null);
  }, []);

  // 创建会话
  const createSession = useCallback((options?: CreateSessionOptions) => {
    sendServerMessage({
      type: 'CREATE_SESSION',
      strengthLimitA: options?.strengthLimitA ?? 100,
      strengthLimitB: options?.strengthLimitB ?? 100,
      controlDurationSeconds: options?.controlDurationSeconds ?? 60,
      ...(options?.deviceType && { deviceType: options.deviceType }),
    });
  }, [sendServerMessage]);

  // 关闭会话（不断开 WebSocket，允许用户创建新会话）
  const closeSession = useCallback(() => {
    sendServerMessage({ type: 'CLOSE_SESSION' });
    setSession(null);
    setDevices([]);
    setActiveDeviceId(null);
    setIsControlling(false);
    setControlTimeLeft(0);
    setQueuePosition(null);
    setWaveforms([]);
    setCurrentWaveformA(null);
    setCurrentWaveformB(null);
    setSmartStrengthSettings(defaultSmartStrengthSettings);
    setBleWaveformDataA(null);
    setBleWaveformDataB(null);
    setBleStrengthTarget(null);
  }, [sendServerMessage]);

  // 设置强度（通过服务器发送给设备）
  const setStrength = useCallback((channel: 'A' | 'B', value: number) => {
    sendServerMessage({
      type: 'CONTROL',
      action: channel === 'A' ? 'STRENGTH_A' : 'STRENGTH_B',
      value: value.toString(),
      targetDeviceId: activeDeviceId,
    });

    // 乐观更新本地设备状态
    if (activeDeviceId) {
      updateDevice(activeDeviceId, d => {
        if (channel === 'A') {
          const clamped = Math.max(0, Math.min(value, d.strengthLimitA));
          return { ...d, strengthA: clamped };
        } else {
          const clamped = Math.max(0, Math.min(value, d.strengthLimitB));
          return { ...d, strengthB: clamped };
        }
      });
    }
  }, [sendServerMessage, activeDeviceId, updateDevice]);

  // 发送控制指令
  const sendControl = useCallback((action: string, value: string) => {
    sendServerMessage({
      type: 'CONTROL',
      action,
      value,
      targetDeviceId: activeDeviceId,
    });
  }, [sendServerMessage, activeDeviceId]);

  // 踢出当前控制者
  const kickController = useCallback(() => {
    sendServerMessage({ type: 'KICK_CONTROLLER' });
  }, [sendServerMessage]);

  // 切换波形（支持 A/B 通道）
  const changeWaveform = useCallback((waveformName: string, channel: 'A' | 'B' = 'A') => {
    sendServerMessage({
      type: 'CHANGE_WAVEFORM',
      waveformName,
      channel,
      targetDeviceId: activeDeviceId,
    });
  }, [sendServerMessage, activeDeviceId]);

  // 更新智能强度设置
  const updateSmartStrength = useCallback((settings: Partial<SmartStrengthSettings>) => {
    setSmartStrengthSettings(prev => {
      const newSettings = {
        randomJump: { ...prev.randomJump, ...settings.randomJump },
        autoIncrease: { ...prev.autoIncrease, ...settings.autoIncrease },
        bFollowA: { ...prev.bFollowA, ...settings.bFollowA },
        randomInterval: { ...prev.randomInterval, ...settings.randomInterval },
      };
      // 发送到服务器
      sendServerMessage({ type: 'UPDATE_SMART_STRENGTH', settings: newSettings });
      return newSettings;
    });
  }, [sendServerMessage]);

  // 添加新设备
  const addDevice = useCallback(() => {
    sendServerMessage({ type: 'ADD_DEVICE' });
  }, [sendServerMessage]);

  // 移除设备
  const removeDevice = useCallback((deviceId: string) => {
    sendServerMessage({ type: 'REMOVE_DEVICE', targetDeviceId: deviceId });
    // 如果移除的是当前活跃设备，切换到主设备
    setActiveDeviceId(prev => {
      if (prev === deviceId) return null; // 会自动回退到 devices[0]
      return prev;
    });
  }, [sendServerMessage]);

  // BLE: 报告设备已连接
  const reportBleConnected = useCallback((deviceId?: string) => {
    sendServerMessage({
      type: 'BLE_DEVICE_CONNECTED',
      targetDeviceId: deviceId ?? activeDeviceId,
    });
  }, [sendServerMessage, activeDeviceId]);

  // BLE: 报告设备已断开
  const reportBleDisconnected = useCallback((deviceId?: string) => {
    sendServerMessage({
      type: 'BLE_DEVICE_DISCONNECTED',
      targetDeviceId: deviceId ?? activeDeviceId,
    });
  }, [sendServerMessage, activeDeviceId]);

  // BLE: 报告强度反馈（前端从设备读取后上报给服务器）
  const reportBleStrengthFeedback = useCallback((strengthA: number, strengthB: number, limitA: number, limitB: number, deviceId?: string) => {
    sendServerMessage({
      type: 'BLE_STRENGTH_FEEDBACK',
      strengthA,
      strengthB,
      strengthLimitA: limitA,
      strengthLimitB: limitB,
      targetDeviceId: deviceId ?? activeDeviceId,
    });
  }, [sendServerMessage, activeDeviceId]);

  // 选择活跃设备
  const selectDevice = useCallback((deviceId: string) => {
    setActiveDeviceId(deviceId);
    // 更新波形显示为该设备的波形
    const device = devices.find(d => d.deviceId === deviceId);
    if (device) {
      setCurrentWaveformA(device.currentWaveformA);
      setCurrentWaveformB(device.currentWaveformB);
    }
  }, [devices]);

  // 当设备绑定成功但波形列表为空时，主动请求波形列表
  useEffect(() => {
    const anyBound = devices.some(d => d.bindStatus === 'BOUND');
    if (anyBound && waveforms.length === 0) {
      console.log('Device bound but waveforms empty, requesting waveform list');
      sendServerMessage({ type: 'GET_WAVEFORM_LIST' });
    }
  }, [devices, waveforms.length, sendServerMessage]);

  // 重置所有状态
  const reset = useCallback(() => {
    disconnectServer();
    setSmartStrengthSettings(defaultSmartStrengthSettings);
  }, [disconnectServer]);

  const value: TherapyContextState = {
    // 服务器状态
    serverStatus,
    serverError,

    // 活跃设备绑定状态
    deviceBindStatus,
    deviceQRCodeUrl,
    deviceConnectionId,

    // 会话
    session,

    // 活跃设备强度
    strengthA,
    strengthB,

    // 控制状态
    isControlling,
    controlTimeLeft,
    queuePosition,

    // 波形
    waveforms,
    currentWaveformA,
    currentWaveformB,

    // 智能强度
    smartStrengthSettings,

    // 多设备
    devices,
    activeDeviceId,

    // BLE 状态
    bleWaveformDataA,
    bleWaveformDataB,
    bleStrengthTarget,

    // 操作
    connectServer,
    disconnectServer,
    createSession,
    closeSession,
    setStrength,
    sendControl,
    kickController,
    changeWaveform,
    updateSmartStrength,
    addDevice,
    removeDevice,
    selectDevice,

    // BLE 操作
    reportBleConnected,
    reportBleDisconnected,
    reportBleStrengthFeedback,

    reset
  };

  return (
    <TherapyContext.Provider value={value}>
      {children}
    </TherapyContext.Provider>
  );
};

export default TherapyContext;
