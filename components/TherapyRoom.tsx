import React, { useState, useEffect, useRef, useCallback } from 'react';
import { platformShare } from '../lib/platform-actions';
import {
  ChevronLeft,
  Wifi,
  WifiOff,
  Share2,
  Power,
  Loader2,
  AlertCircle,
  Clock,
  Users,
  Copy,
  Check,
  Zap,
  Smartphone,
  Activity,
  Settings2,
  Lock,
  Unlock,
  Pause,
  Play,
  Plus,
  X,
  Monitor,
  Bluetooth,
  Search,
} from 'lucide-react';
import { useTherapy, DeviceBindStatus, DeviceInfo, DeviceType, SmartStrengthSettings } from '../contexts/TherapyContext';
import QRCode from 'qrcode';
import { WaveformEditor } from './music/WaveformEditor';
import { KnobControl, Visualizer, AdjustmentModal } from './therapy';
import { isBleAvailable } from '../lib/environment';
import { useTherapyBle } from '../hooks/useTherapyBle';
import { useTherapyBleYcy } from '../hooks/useTherapyBleYcy';
import { useLocalTherapy } from '../hooks/useLocalTherapy';
import { BleFloatingWidget } from './therapy/BleFloatingWidget';
import { BleScanPicker } from './ui/BleScanPicker';
import TherapyControlPanel from './therapy/TherapyControlPanel';

interface TherapyRoomProps {
  onBack: () => void;
}

// 格式化时间
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 波形图标映射
const getWaveformIcon = (name: string): string => {
  const iconMap: Record<string, string> = {
    '呼吸': '🌬️',
    '潮汐': '🌊',
    '心跳': '💓',
    '按压': '👆',
    '敲击': '🔨',
    '快速按压': '⚡',
    '雨点': '💧',
    '信号灯': '🚦',
    '挣扎': '😰',
    '颤抖': '😨',
    '节奏步伐': '👟',
    '变速': '🎚️',
    '波浪': '〰️',
    '上升': '📈',
    '脉冲': '💫',
    '电击': '⚡',
  };
  return iconMap[name] || '〰️';
};

// 判断设备类型是否为 BLE
const isBleDeviceType = (dt: DeviceType) =>
  dt === 'DGLAB_BLE_V2' || dt === 'DGLAB_BLE_V3' || dt === 'YCY_BLE_GEN1' || dt === 'YCY_BLE_GEN2';

// 创建会话视图 — 支持设备类型选择
const CreateSessionView: React.FC<{
  onCreate: (options: { strengthLimitA: number; strengthLimitB: number; deviceType?: DeviceType }) => void;
  onStartLocal: (options: { strengthLimitA: number; strengthLimitB: number; deviceType: DeviceType }) => void;
  isCreating: boolean;
}> = ({ onCreate, onStartLocal, isCreating }) => {
  const [strengthLimitA, setStrengthLimitA] = useState(100);
  const [strengthLimitB, setStrengthLimitB] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType>('DGLAB_WEBSOCKET');
  const bleAvailable = isBleAvailable();

  const deviceOptions: { type: DeviceType; icon: React.ReactNode; label: string; desc: string; disabled?: boolean }[] = [
    {
      type: 'DGLAB_WEBSOCKET',
      icon: <Smartphone size={24} />,
      label: '郊狼 App',
      desc: '通过郊狼 App 扫码连接',
    },
    {
      type: 'DGLAB_BLE_V3',
      icon: <Bluetooth size={24} />,
      label: '郊狼 3.0',
      desc: '蓝牙直连 Coyote 3.0',
      disabled: !bleAvailable,
    },
    {
      type: 'DGLAB_BLE_V2',
      icon: <Bluetooth size={24} />,
      label: '郊狼 2.0',
      desc: '蓝牙直连旧版 Coyote',
      disabled: !bleAvailable,
    },
    {
      type: 'YCY_BLE_GEN2' as DeviceType,
      icon: <Bluetooth size={24} />,
      label: '役次元 二代',
      desc: '蓝牙直连电击器二代',
      disabled: !bleAvailable,
    },
    {
      type: 'YCY_BLE_GEN1' as DeviceType,
      icon: <Bluetooth size={24} />,
      label: '役次元 一代',
      desc: '蓝牙直连电击器一代',
      disabled: !bleAvailable,
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6">
        <Zap size={40} />
      </div>

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">理疗房</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 text-center max-w-xs">
        选择连接方式，然后创建理疗会话
      </p>

      {/* Device Type Selection */}
      <div className="w-full max-w-sm mb-4 space-y-2">
        {deviceOptions.map(opt => (
          <button
            key={opt.type}
            onClick={() => !opt.disabled && setSelectedDeviceType(opt.type)}
            disabled={opt.disabled}
            className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
              selectedDeviceType === opt.type
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                : opt.disabled
                  ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedDeviceType === opt.type
                ? 'bg-violet-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {opt.icon}
            </div>
            <div className="flex-1 text-left">
              <div className={`text-sm font-medium ${
                selectedDeviceType === opt.type
                  ? 'text-violet-700 dark:text-violet-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}>
                {opt.label}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">{opt.desc}</div>
            </div>
            {selectedDeviceType === opt.type && (
              <Check size={18} className="text-violet-500" />
            )}
          </button>
        ))}

        {/* BLE Tip */}
        {(selectedDeviceType === 'DGLAB_BLE_V2' || selectedDeviceType === 'DGLAB_BLE_V3' || selectedDeviceType === 'YCY_BLE_GEN1' || selectedDeviceType === 'YCY_BLE_GEN2') && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              蓝牙模式建议使用官方 App 获得最佳体验。Telegram 小程序不支持蓝牙，浏览器蓝牙稳定性有限。
              使用蓝牙时请保持本页面在前台运行。
            </p>
          </div>
        )}

        {!bleAvailable && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            当前环境不支持蓝牙，蓝牙选项已禁用
          </p>
        )}
      </div>

      {/* Strength Limit Settings */}
      <div className="w-full max-w-sm mb-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-1"
        >
          <span>强度上限保护</span>
          <span>{showSettings ? '▲' : '▼'}</span>
        </button>

        {showSettings && (
          <div className="mt-3 p-4 bg-slate-900 rounded-xl space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">A 通道强度上限</span>
                <span className="text-sm font-bold text-amber-400 dark:text-amber-300">{strengthLimitA}</span>
              </div>
              <input
                type="range" min="0" max="200" value={strengthLimitA}
                onChange={(e) => setStrengthLimitA(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">B 通道强度上限</span>
                <span className="text-sm font-bold text-amber-400 dark:text-amber-300">{strengthLimitB}</span>
              </div>
              <input
                type="range" min="0" max="200" value={strengthLimitB}
                onChange={(e) => setStrengthLimitB(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              设置后无法超过此强度，保护您的安全
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          if (isBleDeviceType(selectedDeviceType)) {
            onStartLocal({ strengthLimitA, strengthLimitB, deviceType: selectedDeviceType });
          } else {
            onCreate({ strengthLimitA, strengthLimitB, deviceType: selectedDeviceType });
          }
        }}
        disabled={isCreating}
        className="w-full max-w-sm py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        {isCreating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            正在创建...
          </>
        ) : (
          <>
            <Zap size={18} />
            {isBleDeviceType(selectedDeviceType) ? '开始' : '创建会话'}
          </>
        )}
      </button>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl max-w-sm">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">使用步骤：</h3>
        {selectedDeviceType === 'DGLAB_WEBSOCKET' ? (
          <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <li>1. 点击上方按钮创建会话</li>
            <li>2. 打开郊狼 App，选择 WebSocket 模式</li>
            <li>3. 扫描网页显示的二维码</li>
            <li>4. 等待设备连接成功后即可控制</li>
          </ol>
        ) : (
          <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <li>1. 打开郊狼设备电源</li>
            <li>2. 点击上方按钮创建会话</li>
            <li>3. 点击"搜索设备"按钮</li>
            <li>4. 选择您的设备，等待连接成功</li>
          </ol>
        )}
      </div>
    </div>
  );
};

// 等待设备连接视图（显示二维码）
const WaitingDeviceView: React.FC<{
  qrCodeUrl: string | null;
  bindStatus: DeviceBindStatus;
  onCancel: () => void;
}> = ({ qrCodeUrl, bindStatus, onCancel }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // 生成二维码图片
  useEffect(() => {
    if (qrCodeUrl) {
      QRCode.toDataURL(qrCodeUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        }
      }).then(setQrCodeDataUrl).catch(console.error);
    }
  }, [qrCodeUrl]);

  const statusText = {
    PENDING: '等待扫码连接',
    APP_CONNECTED: '郊狼 App 已连接，正在绑定...',
    BOUND: '设备已连接',
    DISCONNECTED: '设备断开连接'
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* QR Code */}
      <div className="relative mb-6">
        {qrCodeDataUrl ? (
          <img
            src={qrCodeDataUrl}
            alt="扫描二维码连接设备"
            className="w-48 h-48 rounded-lg shadow-lg"
          />
        ) : (
          <div className="w-48 h-48 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
            <Loader2 size={32} className="text-violet-500 dark:text-violet-400 animate-spin" />
          </div>
        )}
        {bindStatus === 'APP_CONNECTED' && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Smartphone size={32} className="text-green-500 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">App 已连接</p>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
        {statusText[bindStatus]}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-xs">
        {bindStatus === 'PENDING' && '请使用郊狼 App 扫描上方二维码'}
        {bindStatus === 'APP_CONNECTED' && '正在与设备建立连接...'}
      </p>

      {(bindStatus === 'PENDING' || bindStatus === 'APP_CONNECTED') && (
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-6">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">等待中...</span>
        </div>
      )}

      <button
        onClick={onCancel}
        className="px-6 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        取消
      </button>
    </div>
  );
};

// 预设强度按钮配置
const PRESET_BUTTONS = [
  { label: '轻抚', emoji: '🪶', percentage: 10, color: 'from-green-400 to-emerald-500' },
  { label: '挑逗', emoji: '💋', percentage: 40, color: 'from-yellow-400 to-orange-500' },
  { label: '微重', emoji: '✋', percentage: 70, color: 'from-orange-500 to-red-500' },
  { label: '鞭挞', emoji: '🔥', percentage: 100, color: 'from-red-500 to-rose-600' },
] as const;

// 设备列表栏（多设备切换）
const DeviceListBar: React.FC<{
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
  onRemoveDevice: (deviceId: string) => void;
}> = ({ devices, activeDeviceId, onSelectDevice, onAddDevice, onRemoveDevice }) => {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <Monitor size={14} className="text-violet-500 dark:text-violet-400" />
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          设备
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">({devices.length}台)</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {devices.map((device) => {
          const isActive = device.deviceId === (activeDeviceId || devices[0]?.deviceId);
          const statusColor = device.bindStatus === 'BOUND' ? 'bg-emerald-400'
            : device.bindStatus === 'APP_CONNECTED' ? 'bg-yellow-400'
            : device.bindStatus === 'DISCONNECTED' ? 'bg-red-400'
            : 'bg-slate-300';

          return (
            <button
              key={device.deviceId}
              onClick={() => onSelectDevice(device.deviceId)}
              className={`relative flex-shrink-0 flex flex-col items-center p-2.5 rounded-xl border-2 transition-all min-w-[80px] ${
                isActive
                  ? 'border-violet-400 bg-violet-50 dark:bg-violet-950'
                  : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-200 dark:border-slate-700'
              }`}
            >
              {devices.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveDevice(device.deviceId); }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center"
                >
                  <X size={10} className="text-red-500 dark:text-red-400" />
                </button>
              )}
              <div className={`w-2 h-2 rounded-full ${statusColor} mb-1`} />
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                {device.deviceId.replace('device_', '#')}
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                A:{device.strengthA} B:{device.strengthB}
              </span>
            </button>
          );
        })}
        <button
          onClick={onAddDevice}
          className="flex-shrink-0 flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:bg-violet-950 transition-all min-w-[60px]"
        >
          <Plus size={16} className="text-slate-400 dark:text-slate-500" />
          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">添加</span>
        </button>
      </div>
    </section>
  );
};

// BLE 蓝牙搜索/连接视图
const BLE_DEVICE_LABELS: Record<string, string> = {
  DGLAB_BLE_V3: '郊狼 3.0',
  DGLAB_BLE_V2: '郊狼 2.0',
  YCY_BLE_GEN2: '役次元 二代',
  YCY_BLE_GEN1: '役次元 一代',
};

const BleConnectView: React.FC<{
  deviceType: string;
  isScanning: boolean;
  isConnected: boolean;
  error: string | null;
  namePrefix?: string;
  onScan: () => void;
  onConnectDevice: (device: import('../lib/ble/types').BleDevice) => void;
  onCancel: () => void;
}> = ({ deviceType, isScanning, isConnected, error, namePrefix, onScan, onConnectDevice, onCancel }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white mb-6">
        <Bluetooth size={40} />
      </div>

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        连接{BLE_DEVICE_LABELS[deviceType] ?? '蓝牙设备'}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-xs">
        请确保设备已开启，然后点击搜索按钮
      </p>

      {error && (
        <div className="w-full max-w-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
        </div>
      )}

      {isScanning ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            正在连接蓝牙设备...
          </p>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full max-w-sm py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Search size={18} />
          搜索设备
        </button>
      )}

      <button
        onClick={onCancel}
        className="mt-4 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      >
        取消
      </button>

      <BleScanPicker
        open={showPicker}
        namePrefixes={namePrefix ? [namePrefix] : []}
        onSelect={(device) => {
          setShowPicker(false);
          onConnectDevice(device);
        }}
        onCancel={() => setShowPicker(false)}
      />
    </div>
  );
};

// 控制面板视图 - Nexus 风格重构
const ControlPanelView: React.FC<{
  session: {
    shareCode: string;
    strengthA: number;
    strengthB: number;
    strengthLimitA: number;
    strengthLimitB: number;
    queueLength: number;
    currentController?: {
      name: string;
    };
  };
  strengthA: number;
  strengthB: number;
  onStrengthChange: (channel: 'A' | 'B', value: number) => void;
  onDisconnect: () => void;
  deviceConnected: boolean;
  controlTimeLeft?: number;
  ownerName?: string;
  waveforms: string[];
  currentWaveformA: string | null;
  currentWaveformB: string | null;
  onChangeWaveform: (name: string, channel?: 'A' | 'B') => void;
  smartStrengthSettings: SmartStrengthSettings;
  onUpdateSmartStrength: (settings: Partial<SmartStrengthSettings>) => void;
  onOpenWaveformEditor: () => void;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
  onRemoveDevice: (deviceId: string) => void;
}> = ({
  session,
  strengthA,
  strengthB,
  onStrengthChange,
  onDisconnect,
  deviceConnected,
  controlTimeLeft,
  ownerName = '用户',
  waveforms,
  currentWaveformA,
  currentWaveformB,
  onChangeWaveform,
  smartStrengthSettings,
  onUpdateSmartStrength,
  onOpenWaveformEditor,
  devices,
  activeDeviceId,
  onSelectDevice,
  onAddDevice,
  onRemoveDevice,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [syncChannels, setSyncChannels] = useState(false);
  const [isLocked, setIsLocked] = useState(true); // 安全锁定
  const [isPaused, setIsPaused] = useState(false);
  const [editingKnob, setEditingKnob] = useState<'A' | 'B' | null>(null);
  const [showSmartStrength, setShowSmartStrength] = useState(false);
  const [waveformChannel, setWaveformChannel] = useState<'A' | 'B'>('A');
  const [showNewDeviceQR, setShowNewDeviceQR] = useState<string | null>(null); // deviceId to show QR for
  const [newDeviceQRDataUrl, setNewDeviceQRDataUrl] = useState<string | null>(null);
  const prevDeviceCountRef = useRef(devices.length);

  // 当新设备被添加时自动弹出 QR 码
  useEffect(() => {
    if (devices.length > prevDeviceCountRef.current) {
      const newDevice = devices[devices.length - 1];
      if (newDevice && newDevice.bindStatus !== 'BOUND') {
        setShowNewDeviceQR(newDevice.deviceId);
      }
    }
    prevDeviceCountRef.current = devices.length;
  }, [devices.length]);

  // 生成 QR 码图片
  const pendingDevice = showNewDeviceQR ? devices.find(d => d.deviceId === showNewDeviceQR) : null;
  useEffect(() => {
    if (pendingDevice?.qrCodeUrl) {
      QRCode.toDataURL(pendingDevice.qrCodeUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      }).then(setNewDeviceQRDataUrl).catch(console.error);
    } else {
      setNewDeviceQRDataUrl(null);
    }
  }, [pendingDevice?.qrCodeUrl]);

  // 当 pending 设备绑定成功时自动关闭弹窗
  useEffect(() => {
    if (pendingDevice?.bindStatus === 'BOUND') {
      setShowNewDeviceQR(null);
      setNewDeviceQRDataUrl(null);
    }
  }, [pendingDevice?.bindStatus]);

  // Get Telegram WebApp
  const webApp = (window as any).Telegram?.WebApp;

  // 同步调节强度
  const handleStrengthChange = (channel: 'A' | 'B', value: number) => {
    if (isLocked) return;
    onStrengthChange(channel, value);
    if (syncChannels) {
      const otherChannel = channel === 'A' ? 'B' : 'A';
      const otherMax = channel === 'A' ? session.strengthLimitB : session.strengthLimitA;
      onStrengthChange(otherChannel, Math.min(value, otherMax));
    }
  };

  const handleCopyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(session.shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleShare = async () => {
    const miniAppLink = `https://t.me/lovein_university_bot/university?startapp=therapy_${session.shareCode}`;
    const shared = await platformShare({
      text: '⚡ 来控制我的理疗设备！',
      url: miniAppLink,
      inlineQuery: `therapy:${session.shareCode}`,
    });
    if (!shared) {
      setShareMessage('分享链接已复制！');
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  // 处理预设按钮点击
  const handlePresetClick = (percentage: number) => {
    if (isLocked) return;
    const valueA = Math.round(session.strengthLimitA * percentage / 100);
    const valueB = Math.round(session.strengthLimitB * percentage / 100);
    onStrengthChange('A', valueA);
    onStrengthChange('B', valueB);
  };

  // 紧急停止
  const handleEmergencyStop = () => {
    onStrengthChange('A', 0);
    onStrengthChange('B', 0);
    setIsPaused(true);
  };

  // 计算强度百分比
  const percentageA = Math.round((strengthA / session.strengthLimitA) * 100);
  const percentageB = Math.round((strengthB / session.strengthLimitB) * 100);

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* 微调弹窗 */}
      <AdjustmentModal
        isOpen={editingKnob !== null}
        onClose={() => setEditingKnob(null)}
        label={editingKnob === 'A' ? 'A 通道' : 'B 通道'}
        value={editingKnob === 'A' ? strengthA : strengthB}
        min={0}
        max={editingKnob === 'A' ? session.strengthLimitA : session.strengthLimitB}
        onChange={(val) => editingKnob && handleStrengthChange(editingKnob, val)}
        color={editingKnob === 'A' ? '#3b82f6' : '#ec4899'}
      />

      {/* 新设备 QR 码弹窗 */}
      {showNewDeviceQR && pendingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowNewDeviceQR(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                添加设备 {pendingDevice.deviceId.replace('device_', '#')}
              </h3>
              <button onClick={() => setShowNewDeviceQR(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={18} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>
            <div className="flex flex-col items-center">
              {newDeviceQRDataUrl ? (
                <img src={newDeviceQRDataUrl} alt="扫描连接设备" className="w-48 h-48 rounded-lg shadow-lg mb-4" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-4">
                  <Loader2 size={32} className="text-violet-500 dark:text-violet-400 animate-spin" />
                </div>
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                请使用郊狼 App 扫描上方二维码连接新设备
              </p>
              {pendingDevice.bindStatus === 'APP_CONNECTED' && (
                <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Smartphone size={16} />
                  <span className="text-sm font-medium">App 已连接，正在绑定...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header status bar */}
      <header className="flex justify-between items-center px-4 py-3 bg-white/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${deviceConnected ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100'}`}>
            {deviceConnected ? (
              <Wifi size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff size={16} className="text-red-500 dark:text-red-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {deviceConnected ? '已连接' : '已断开'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{session.shareCode}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyShareCode}
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {copied ? <Check size={16} className="text-green-500 dark:text-green-400" /> : <Copy size={16} className="text-slate-500 dark:text-slate-400" />}
          </button>
          <button
            onClick={handleShare}
            className="p-2 bg-violet-100 dark:bg-violet-950 rounded-lg hover:bg-violet-200 transition-colors"
          >
            <Share2 size={16} className="text-violet-600 dark:text-violet-400" />
          </button>
          <button
            onClick={onDisconnect}
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-500 dark:hover:text-red-400 transition-colors text-slate-500 dark:text-slate-400"
          >
            <Power size={16} />
          </button>
        </div>
      </header>

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 lg:pb-8">
        {/* 多设备切换栏 */}
        <DeviceListBar
          devices={devices}
          activeDeviceId={activeDeviceId}
          onSelectDevice={onSelectDevice}
          onAddDevice={onAddDevice}
          onRemoveDevice={onRemoveDevice}
        />

        {/* 信号监视器 */}
        <Visualizer
          active={deviceConnected && !isPaused && (strengthA > 0 || strengthB > 0)}
          channelA={percentageA}
          channelB={percentageB}
          waveformName={currentWaveformA || undefined}
        />

        {/* 旋钮控制模块 */}
        <section className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              强度控制
            </span>
            <button
              onClick={() => setSyncChannels(!syncChannels)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                syncChannels
                  ? 'bg-violet-100 text-violet-600 dark:text-violet-400 border border-violet-200'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncChannels ? 'bg-violet-500' : 'bg-slate-400'}`} />
              {syncChannels ? '同步' : '独立'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* A 通道旋钮 */}
            <div className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <div className="absolute top-2 left-2 w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              <KnobControl
                value={strengthA}
                min={0}
                max={session.strengthLimitA}
                onChange={(val) => handleStrengthChange('A', val)}
                label="A 通道"
                color="#3b82f6"
                onCenterClick={() => setEditingKnob('A')}
                disabled={isLocked || !deviceConnected}
              />
            </div>

            {/* B 通道旋钮 */}
            <div className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <KnobControl
                value={strengthB}
                min={0}
                max={session.strengthLimitB}
                onChange={(val) => handleStrengthChange('B', val)}
                label="B 通道"
                color="#ec4899"
                onCenterClick={() => setEditingKnob('B')}
                disabled={isLocked || !deviceConnected}
              />
            </div>
          </div>
        </section>

        {/* 预设模块 */}
        <section className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              快捷预设
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {/* 归零按钮 */}
            <button
              onClick={() => handlePresetClick(0)}
              disabled={isLocked || !deviceConnected}
              className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 text-lg"
            >
              ⏹️
            </button>
            {/* 预设按钮 */}
            {PRESET_BUTTONS.map((preset) => {
              const isActive =
                strengthA === Math.round(session.strengthLimitA * preset.percentage / 100) &&
                strengthB === Math.round(session.strengthLimitB * preset.percentage / 100);
              return (
                <button
                  key={preset.percentage}
                  onClick={() => handlePresetClick(preset.percentage)}
                  disabled={isLocked || !deviceConnected}
                  className={`aspect-square rounded-xl font-medium flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all disabled:opacity-40 ${
                    isActive
                      ? `bg-gradient-to-br ${preset.color} text-white shadow-lg`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="text-[10px]">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 波形选择模块 */}
        <section className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-violet-500 dark:text-violet-400" />
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                波形选择
              </span>
              {/* A/B 通道切换标签 */}
              <div className="flex ml-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setWaveformChannel('A')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                    waveformChannel === 'A'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  A通道
                </button>
                <button
                  onClick={() => setWaveformChannel('B')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                    waveformChannel === 'B'
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  B通道
                </button>
              </div>
            </div>
            <button
              onClick={onOpenWaveformEditor}
              disabled={isLocked || !deviceConnected}
              className="flex items-center gap-1 px-2 py-1 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:bg-violet-950 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Settings2 size={12} />
              <span>自定义</span>
            </button>
          </div>

          {/* 当前两通道波形提示 */}
          {currentWaveformA && currentWaveformB && currentWaveformA !== currentWaveformB && (
            <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="text-blue-500 dark:text-blue-400">A: {currentWaveformA}</span>
              <span>|</span>
              <span className="text-pink-500 dark:text-pink-400">B: {currentWaveformB}</span>
            </div>
          )}

          {waveforms.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {waveforms.map((name) => {
                const currentWaveform = waveformChannel === 'A' ? currentWaveformA : currentWaveformB;
                const isSelected = currentWaveform === name;
                const selectedColor = waveformChannel === 'A'
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                  : 'border-pink-400 bg-pink-50 dark:bg-pink-950 text-pink-700';
                return (
                  <button
                    key={name}
                    onClick={() => onChangeWaveform(name, waveformChannel)}
                    disabled={isLocked || !deviceConnected}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-40 ${
                      isSelected
                        ? `${selectedColor} shadow-sm`
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl mb-1">{getWaveformIcon(name)}</span>
                    <span className="text-[10px] font-medium truncate w-full text-center">{name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 text-sm text-center">
              加载波形列表中...
            </div>
          )}
        </section>

        {/* 智能强度控制 */}
        <section className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
          <button
            onClick={() => setShowSmartStrength(!showSmartStrength)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:bg-violet-950 transition-colors"
          >
            <span>🧠 智能强度设置</span>
            <span className="text-xs">{showSmartStrength ? '▲' : '▼'}</span>
          </button>

          {showSmartStrength && (
            <div className="p-4 pt-0 space-y-3">
              {/* 随机跳变 */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">🎲 随机跳变</span>
                  <button
                    onClick={() => onUpdateSmartStrength({
                      randomJump: { ...smartStrengthSettings.randomJump, enabled: !smartStrengthSettings.randomJump.enabled }
                    })}
                    disabled={isLocked || !deviceConnected}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      smartStrengthSettings.randomJump.enabled ? 'bg-violet-500' : 'bg-slate-300'
                    } disabled:opacity-50`}
                  >
                    <span className={`absolute w-4 h-4 bg-white dark:bg-slate-800 rounded-full top-0.5 transition-transform ${
                      smartStrengthSettings.randomJump.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {smartStrengthSettings.randomJump.enabled && (
                  <div className="pl-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">强度范围</span>
                      <span className="text-slate-800 dark:text-slate-100 font-mono">
                        {smartStrengthSettings.randomJump.minStrength}% - {smartStrengthSettings.randomJump.maxStrength}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={smartStrengthSettings.randomJump.maxStrength}
                      onChange={(e) => onUpdateSmartStrength({
                        randomJump: { ...smartStrengthSettings.randomJump, maxStrength: Number(e.target.value) }
                      })}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                  </div>
                )}
              </div>

              {/* 自动提升 */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">📈 自动提升</span>
                  <button
                    onClick={() => onUpdateSmartStrength({
                      autoIncrease: { ...smartStrengthSettings.autoIncrease, enabled: !smartStrengthSettings.autoIncrease.enabled }
                    })}
                    disabled={isLocked || !deviceConnected}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      smartStrengthSettings.autoIncrease.enabled ? 'bg-violet-500' : 'bg-slate-300'
                    } disabled:opacity-50`}
                  >
                    <span className={`absolute w-4 h-4 bg-white dark:bg-slate-800 rounded-full top-0.5 transition-transform ${
                      smartStrengthSettings.autoIncrease.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {smartStrengthSettings.autoIncrease.enabled && (
                  <div className="pl-2 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-300">每次 +{smartStrengthSettings.autoIncrease.incrementAmount}</span>
                      <span className="text-slate-400 dark:text-slate-500">·</span>
                      <span className="text-slate-600 dark:text-slate-300">间隔 {smartStrengthSettings.autoIncrease.intervalSeconds}s</span>
                    </div>
                  </div>
                )}
              </div>

              {/* B跟随A */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">🔗 B跟随A</span>
                  <button
                    onClick={() => onUpdateSmartStrength({
                      bFollowA: { ...smartStrengthSettings.bFollowA, enabled: !smartStrengthSettings.bFollowA.enabled }
                    })}
                    disabled={isLocked || !deviceConnected}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      smartStrengthSettings.bFollowA.enabled ? 'bg-violet-500' : 'bg-slate-300'
                    } disabled:opacity-50`}
                  >
                    <span className={`absolute w-4 h-4 bg-white dark:bg-slate-800 rounded-full top-0.5 transition-transform ${
                      smartStrengthSettings.bFollowA.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {smartStrengthSettings.bFollowA.enabled && (
                  <div className="pl-2 text-xs text-slate-500 dark:text-slate-400">
                    B = A {smartStrengthSettings.bFollowA.offset >= 0 ? '+' : ''}{smartStrengthSettings.bFollowA.offset}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer: 主控制栏 */}
      <footer className="absolute bottom-0 left-0 w-full bg-white/95 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700 p-4 backdrop-blur-md z-50">
        <div className="flex gap-3 items-center">
          {/* 安全锁按钮 */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              isLocked
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                : 'bg-violet-50 dark:bg-violet-950 border-violet-200 text-violet-600 dark:text-violet-400'
            }`}
          >
            {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
            <span className="text-[9px] font-bold uppercase mt-0.5">
              {isLocked ? '锁定' : '已解锁'}
            </span>
          </button>

          {/* 紧急停止按钮 */}
          <button
            onClick={handleEmergencyStop}
            disabled={!deviceConnected}
            className="flex-1 h-14 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Power size={20} />
            <span className="uppercase tracking-wide">紧急停止</span>
          </button>
        </div>

        {/* 队列信息 */}
        {(session.queueLength > 0 || session.currentController) && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span>等待队列：{session.queueLength} 人</span>
            </div>
            {session.currentController && controlTimeLeft !== undefined && (
              <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                <Clock size={14} />
                <span>{session.currentController.name} ({formatTime(controlTimeLeft)})</span>
              </div>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};

// 默认智能强度设置（本地模式使用）
const defaultSmartStrength: SmartStrengthSettings = {
  randomJump: { enabled: false, minStrength: 10, maxStrength: 80, intervalSeconds: 5 },
  autoIncrease: { enabled: false, incrementAmount: 1, intervalSeconds: 10 },
  bFollowA: { enabled: false, offset: 0 },
  randomInterval: { enabled: false, workMinSeconds: 3, workMaxSeconds: 8, pauseMinSeconds: 1, pauseMaxSeconds: 3 },
};

// 主组件
const TherapyRoom: React.FC<TherapyRoomProps> = ({ onBack }) => {
  const therapy = useTherapy();
  const serverConnectedRef = useRef(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);

  // ─── 本地 BLE 模式 ───
  // localMode: true = 纯本地 BLE，无 WebSocket
  // 当用户点击"分享"时切换到 online 模式
  const [localMode, setLocalMode] = useState(false);
  const [localDeviceType, setLocalDeviceType] = useState<DeviceType | null>(null);
  const [localStrengthLimitA, setLocalStrengthLimitA] = useState(100);
  const [localStrengthLimitB, setLocalStrengthLimitB] = useState(100);
  const [upgradingToOnline, setUpgradingToOnline] = useState(false);

  // 本地模式的波形/强度管理
  const localTherapy = useLocalTherapy(localMode ? localDeviceType : null);

  // 输出模式状态（在 TherapyRoom 层管理，以便传给 BLE hooks）
  const [outputMode, setOutputMode] = useState<'standard' | 'gentle'>('standard');
  const [freqBalanceA, setFreqBalanceA] = useState(160);
  const [freqBalanceB, setFreqBalanceB] = useState(160);
  const [intensityBalanceA, setIntensityBalanceA] = useState(0);
  const [intensityBalanceB, setIntensityBalanceB] = useState(0);

  // 自动连接/重连服务器（仅非本地模式或升级到在线时）
  useEffect(() => {
    if (localMode && !upgradingToOnline) return;
    const shouldConnect = therapy.serverStatus === 'idle' || therapy.serverStatus === 'error';
    if (shouldConnect && !serverConnectedRef.current) {
      serverConnectedRef.current = true;
      if (therapy.serverStatus === 'error') {
        const timer = setTimeout(() => therapy.connectServer(), 1000);
        return () => clearTimeout(timer);
      }
      therapy.connectServer();
    }
    if (therapy.serverStatus === 'connected') {
      serverConnectedRef.current = false;
    }
  }, [therapy.serverStatus, localMode, upgradingToOnline]);

  // 处理返回
  const handleBack = () => {
    onBack();
  };

  // 处理创建会话（WebSocket 模式 — 仅用于 DGLAB_WEBSOCKET）
  const handleCreateSession = (options: { strengthLimitA: number; strengthLimitB: number; deviceType?: DeviceType }) => {
    setIsCreatingSession(true);
    therapy.createSession(options);
  };

  // 处理开始本地 BLE 模式
  const handleStartLocal = (options: { strengthLimitA: number; strengthLimitB: number; deviceType: DeviceType }) => {
    setLocalMode(true);
    setLocalDeviceType(options.deviceType);
    setLocalStrengthLimitA(options.strengthLimitA);
    setLocalStrengthLimitB(options.strengthLimitB);
    localTherapy.setStrengthLimit('A', options.strengthLimitA);
    localTherapy.setStrengthLimit('B', options.strengthLimitB);
  };

  // 升级到在线模式（分享）
  const handleUpgradeToOnline = useCallback(() => {
    if (!localDeviceType) return;
    setUpgradingToOnline(true);
    // 开始连接 WS
    if (therapy.serverStatus === 'idle' || therapy.serverStatus === 'error') {
      therapy.connectServer();
    }
  }, [localDeviceType, therapy]);

  // 当 WS 连接成功后自动创建会话
  useEffect(() => {
    if (upgradingToOnline && therapy.serverStatus === 'connected' && !therapy.session) {
      therapy.createSession({
        strengthLimitA: localStrengthLimitA,
        strengthLimitB: localStrengthLimitB,
        deviceType: localDeviceType!,
      });
    }
  }, [upgradingToOnline, therapy.serverStatus, therapy.session]);

  // 会话创建后完成切换到在线模式
  useEffect(() => {
    if (upgradingToOnline && therapy.session) {
      setLocalMode(false);
      setUpgradingToOnline(false);
      // BLE 设备已连接，通知服务器
      if (bleHook.isConnected) {
        therapy.reportBleConnected();
      }
    }
  }, [upgradingToOnline, therapy.session]);

  // 会话创建后重置 isCreating 状态
  useEffect(() => {
    if (therapy.session) {
      setIsCreatingSession(false);
    }
  }, [therapy.session]);

  // 判断当前设备类型
  const activeDevice = therapy.devices[0] ?? null;
  const effectiveDeviceType = localMode ? localDeviceType : activeDevice?.deviceType;
  const isDglabBleDevice = effectiveDeviceType === 'DGLAB_BLE_V2' || effectiveDeviceType === 'DGLAB_BLE_V3';
  const isYcyBleDevice = effectiveDeviceType === 'YCY_BLE_GEN1' || effectiveDeviceType === 'YCY_BLE_GEN2';
  const isBleDevice = isDglabBleDevice || isYcyBleDevice;
  const bleVersion: 2 | 3 = effectiveDeviceType === 'DGLAB_BLE_V3' ? 3 : 2;

  // BLE hook callbacks
  const handleBleConnected = useCallback(() => {
    if (!localMode) {
      therapy.reportBleConnected();
    }
  }, [localMode, therapy.reportBleConnected]);

  const handleBleDisconnected = useCallback(() => {
    if (!localMode) {
      therapy.reportBleDisconnected();
    }
  }, [localMode, therapy.reportBleDisconnected]);

  const handleBleStrengthFeedback = useCallback((sA: number, sB: number) => {
    if (!localMode) {
      therapy.reportBleStrengthFeedback(sA, sB, activeDevice?.strengthLimitA ?? 100, activeDevice?.strengthLimitB ?? 100);
    }
  }, [localMode, therapy.reportBleStrengthFeedback, activeDevice?.strengthLimitA, activeDevice?.strengthLimitB]);

  // 本地模式下的数据源
  const bleWaveformDataA = localMode ? localTherapy.waveformDataA : (isDglabBleDevice ? therapy.bleWaveformDataA : null);
  const bleWaveformDataB = localMode ? localTherapy.waveformDataB : (isDglabBleDevice ? therapy.bleWaveformDataB : null);
  const bleStrengthTarget = localMode ? localTherapy.bleStrengthTarget : (isDglabBleDevice ? therapy.bleStrengthTarget : null);
  const ycyWaveformDataA = localMode ? localTherapy.waveformDataA : (isYcyBleDevice ? therapy.bleWaveformDataA : null);
  const ycyWaveformDataB = localMode ? localTherapy.waveformDataB : (isYcyBleDevice ? therapy.bleWaveformDataB : null);
  const ycyStrengthTarget = localMode ? localTherapy.bleStrengthTarget : (isYcyBleDevice ? therapy.bleStrengthTarget : null);
  const effectiveLimitA = localMode ? localStrengthLimitA : (activeDevice?.strengthLimitA ?? 100);
  const effectiveLimitB = localMode ? localStrengthLimitB : (activeDevice?.strengthLimitB ?? 100);

  // DG-Lab BLE hook (always called — React hooks cannot be conditional)
  const dglabBleHook = useTherapyBle({
    bleVersion,
    waveformDataA: bleWaveformDataA,
    waveformDataB: bleWaveformDataB,
    strengthTarget: bleStrengthTarget,
    strengthLimitA: effectiveLimitA,
    strengthLimitB: effectiveLimitB,
    onConnected: handleBleConnected,
    onDisconnected: handleBleDisconnected,
    onStrengthFeedback: handleBleStrengthFeedback,
    gentleMode: outputMode === 'gentle',
    freqBalanceA,
    freqBalanceB,
    intensityBalanceA,
    intensityBalanceB,
  });

  // YCY BLE hook (always called)
  const ycyBleHook = useTherapyBleYcy({
    ycyVersion: effectiveDeviceType === 'YCY_BLE_GEN2' ? 2 : 1,
    waveformDataA: ycyWaveformDataA,
    waveformDataB: ycyWaveformDataB,
    strengthTarget: ycyStrengthTarget,
    strengthLimitA: effectiveLimitA,
    strengthLimitB: effectiveLimitB,
    onConnected: handleBleConnected,
    onDisconnected: handleBleDisconnected,
    onStrengthFeedback: handleBleStrengthFeedback,
    gentleMode: outputMode === 'gentle',
    freqBalanceA,
    freqBalanceB,
    intensityBalanceA,
    intensityBalanceB,
  });

  // 统一引用当前活跃的 BLE hook
  const bleHook = isYcyBleDevice ? ycyBleHook : dglabBleHook;

  // 处理断开连接
  const handleDisconnect = () => {
    bleHook.disconnect();
    if (localMode) {
      setLocalMode(false);
      setLocalDeviceType(null);
    } else {
      therapy.closeSession();
    }
  };

  // 处理取消等待设备
  const handleCancelWaiting = () => {
    bleHook.disconnect();
    if (localMode) {
      setLocalMode(false);
      setLocalDeviceType(null);
    } else {
      therapy.closeSession();
    }
  };

  // 检查设备是否已连接
  const isDeviceConnected = isBleDevice
    ? bleHook.isConnected
    : therapy.devices.length > 0
      ? therapy.devices.some(d => d.bindStatus === 'BOUND')
      : therapy.deviceBindStatus === 'BOUND';

  const hasConfiguredDevice = isBleDevice
    ? bleHook.isConnected
    : therapy.devices.some(
        d => d.bindStatus === 'BOUND' || d.bindStatus === 'DISCONNECTED'
      );

  // 渲染当前状态的视图
  const renderContent = () => {
    // ─── 本地 BLE 模式 ───
    if (localMode) {
      // 波形加载中
      if (localTherapy.presetsLoading) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 size={32} className="text-violet-500 dark:text-violet-400 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-300">正在加载波形数据...</p>
          </div>
        );
      }

      // BLE 未连接 → 搜索界面
      if (!bleHook.isConnected) {
        return (
          <BleConnectView
            deviceType={localDeviceType ?? ''}
            isScanning={bleHook.isScanning}
            isConnected={bleHook.isConnected}
            error={bleHook.error || localTherapy.presetsError}
            namePrefix={bleHook.namePrefix}
            onScan={bleHook.scan}
            onConnectDevice={bleHook.connectToDevice}
            onCancel={handleCancelWaiting}
          />
        );
      }

      // BLE 已连接 → 本地控制面板
      const localSession = {
        shareCode: '',
        strengthLimitA: localStrengthLimitA,
        strengthLimitB: localStrengthLimitB,
        queueLength: 0,
      };

      return (
        <>
          <TherapyControlPanel
            session={localSession}
            strengthA={localTherapy.strengthA}
            strengthB={localTherapy.strengthB}
            onStrengthChange={localTherapy.setStrength}
            onDisconnect={handleDisconnect}
            deviceConnected={true}
            waveforms={localTherapy.presets.map(p => p.name)}
            currentWaveformA={localTherapy.currentWaveformA}
            currentWaveformB={localTherapy.currentWaveformB}
            onChangeWaveform={(name, ch) => localTherapy.changeWaveform(name, ch ?? 'AB')}
            smartStrengthSettings={defaultSmartStrength}
            onUpdateSmartStrength={() => {}}
            onOpenWaveformEditor={() => setShowWaveformEditor(true)}
            devices={[]}
            activeDeviceId={null}
            onSelectDevice={() => {}}
            onAddDevice={() => {}}
            onRemoveDevice={() => {}}
            onBack={handleBack}
            outputMode={outputMode}
            onOutputModeChange={setOutputMode}
            freqBalanceA={freqBalanceA}
            freqBalanceB={freqBalanceB}
            intensityBalanceA={intensityBalanceA}
            intensityBalanceB={intensityBalanceB}
            onFreqBalanceAChange={setFreqBalanceA}
            onFreqBalanceBChange={setFreqBalanceB}
            onIntensityBalanceAChange={setIntensityBalanceA}
            onIntensityBalanceBChange={setIntensityBalanceB}
            localMode
            onShare={handleUpgradeToOnline}
            upgradingToOnline={upgradingToOnline}
          />
          <BleFloatingWidget
            strengthA={bleHook.currentStrengthA}
            strengthB={bleHook.currentStrengthB}
            batteryLevel={bleHook.batteryLevel}
            isConnected={bleHook.isConnected}
            maxStrength={isYcyBleDevice ? 276 : 200}
          />
        </>
      );
    }

    // ─── 在线模式（原有逻辑） ───

    // 服务器空闲或连接中
    if (therapy.serverStatus === 'idle' || therapy.serverStatus === 'connecting') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 size={32} className="text-violet-500 dark:text-violet-400 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-300">正在连接服务器...</p>
        </div>
      );
    }

    // 服务器连接错误
    if (therapy.serverStatus === 'error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertCircle size={48} className="text-red-500 dark:text-red-400 mb-4" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">连接失败</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">{therapy.serverError}</p>
          <button
            onClick={() => therapy.connectServer()}
            className="px-6 py-2 bg-violet-500 text-white rounded-lg"
          >
            重试
          </button>
        </div>
      );
    }

    // 未创建会话
    if (!therapy.session) {
      return (
        <CreateSessionView
          onCreate={handleCreateSession}
          onStartLocal={handleStartLocal}
          isCreating={isCreatingSession}
        />
      );
    }

    // BLE 模式：会话已创建但 BLE 设备未连接 → 显示搜索界面
    if (isBleDevice && !bleHook.isConnected) {
      return (
        <BleConnectView
          deviceType={activeDevice?.deviceType ?? ''}
          isScanning={bleHook.isScanning}
          isConnected={bleHook.isConnected}
          error={bleHook.error}
          namePrefix={bleHook.namePrefix}
          onScan={bleHook.scan}
          onConnectDevice={bleHook.connectToDevice}
          onCancel={handleCancelWaiting}
        />
      );
    }

    // WebSocket 模式：等待设备连接
    if (!isBleDevice && !hasConfiguredDevice) {
      return (
        <WaitingDeviceView
          qrCodeUrl={therapy.deviceQRCodeUrl}
          bindStatus={therapy.deviceBindStatus}
          onCancel={handleCancelWaiting}
        />
      );
    }

    // 设备已连接，显示控制面板
    return (
      <>
        <TherapyControlPanel
          session={therapy.session}
          strengthA={therapy.strengthA}
          strengthB={therapy.strengthB}
          onStrengthChange={therapy.setStrength}
          onDisconnect={handleDisconnect}
          deviceConnected={isDeviceConnected}
          controlTimeLeft={therapy.controlTimeLeft}
          waveforms={therapy.waveforms}
          currentWaveformA={therapy.currentWaveformA}
          currentWaveformB={therapy.currentWaveformB}
          onChangeWaveform={therapy.changeWaveform}
          smartStrengthSettings={therapy.smartStrengthSettings}
          onUpdateSmartStrength={therapy.updateSmartStrength}
          onOpenWaveformEditor={() => setShowWaveformEditor(true)}
          devices={therapy.devices}
          activeDeviceId={therapy.activeDeviceId}
          onSelectDevice={therapy.selectDevice}
          onAddDevice={therapy.addDevice}
          onRemoveDevice={therapy.removeDevice}
          onBack={handleBack}
          outputMode={outputMode}
          onOutputModeChange={setOutputMode}
          freqBalanceA={freqBalanceA}
          freqBalanceB={freqBalanceB}
          intensityBalanceA={intensityBalanceA}
          intensityBalanceB={intensityBalanceB}
          onFreqBalanceAChange={setFreqBalanceA}
          onFreqBalanceBChange={setFreqBalanceB}
          onIntensityBalanceAChange={setIntensityBalanceA}
          onIntensityBalanceBChange={setIntensityBalanceB}
          onKickController={therapy.kickController}
        />
        {/* BLE 浮窗 */}
        {isBleDevice && bleHook.isConnected && (
          <BleFloatingWidget
            strengthA={bleHook.currentStrengthA}
            strengthB={bleHook.currentStrengthB}
            batteryLevel={bleHook.batteryLevel}
            isConnected={bleHook.isConnected}
            maxStrength={isYcyBleDevice ? 276 : 200}
          />
        )}
      </>
    );
  };

  // 显示波形编辑器
  if (showWaveformEditor) {
    return (
      <WaveformEditor
        onBack={() => setShowWaveformEditor(false)}
        onSelectWaveform={(waveform) => {
          if (localMode) {
            localTherapy.changeWaveform(waveform.name, 'AB');
          } else {
            therapy.changeWaveform(waveform.name, 'A');
            therapy.changeWaveform(waveform.name, 'B');
          }
          setShowWaveformEditor(false);
        }}
      />
    );
  }

  // 是否处于控制面板模式
  const isInControlPanel = localMode
    ? bleHook.isConnected
    : therapy.session != null &&
      ((isBleDevice && bleHook.isConnected) || (!isBleDevice && hasConfiguredDevice));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header — 控制面板模式下隐藏，因为 TherapyControlPanel 有内置 header */}
      {!isInControlPanel && (
        <div className="flex items-center p-4 border-b bg-white dark:bg-slate-800 sticky top-0 z-10">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="flex-1 text-center font-bold text-lg text-slate-800 dark:text-slate-100">
            理疗房
          </h1>
          <div className="w-10" />
        </div>
      )}

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default TherapyRoom;
