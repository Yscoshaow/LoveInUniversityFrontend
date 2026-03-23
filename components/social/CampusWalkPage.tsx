import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  MapPin,
  StickyNote,
  Camera,
  Key,
  Package,
  Send,
  X,
  Plus,
  Minus,
  Loader2,
  BookOpen,
  Image as ImageIcon,
  Hourglass,
  Wine,
  Lock,
  Calendar,
  Compass,
  Navigation,
  Thermometer,
  Users,
  Flag,
  MapPinCheck,
  Footprints,
  Star,
  Radio,
  Signal,
  Coins,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { campusWalkApi } from '@/lib/api';
import { specialItemsApi, selfLockApi } from '@/lib/api';
import { getCurrentPosition, watchPosition, type GeoPosition } from '@/lib/geolocation';
import { getAmapPreference, setAmapPreference, shouldUseAmap, type AmapPreference } from '@/lib/chinaDetect';
import type { CampusDrop, CampusDropType, PickupDropResponse, DirectionHint, KeyBoxHint, ExplorationStats, FootprintSample, HeatmapCell, StrollUser, CampusLandmark, CampusBeacon, BeaconBaseType, BeaconContact, CampusCoin, CollectCoinResponse } from '@/types';
import { DatePickerSheet } from '@/components/ui/mobile-picker';
import { useTheme } from 'next-themes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const;

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const haversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDirectionArrow = (direction: string): string => {
  const arrows: Record<string, string> = {
    N: '↑', NE: '↗', E: '→', SE: '↘',
    S: '↓', SW: '↙', W: '←', NW: '↖',
  };
  return arrows[direction] || '•';
};

const DROP_TYPE_META: Record<
  CampusDropType,
  { label: string; color: string; markerColor: string; icon: React.ReactNode }
> = {
  STICKY_NOTE: {
    label: '便签',
    color: 'text-yellow-400',
    markerColor: '#FACC15',
    icon: <StickyNote className="w-5 h-5 text-yellow-400" />,
  },
  PHOTO_PAPER: {
    label: '相纸',
    color: 'text-blue-400',
    markerColor: '#60A5FA',
    icon: <Camera className="w-5 h-5 text-blue-400" />,
  },
  KEY_BOX: {
    label: '钥匙盒',
    color: 'text-purple-400',
    markerColor: '#C084FC',
    icon: <Key className="w-5 h-5 text-purple-400" />,
  },
  TIME_CAPSULE: {
    label: '时间胶囊',
    color: 'text-orange-400',
    markerColor: '#FB923C',
    icon: <Hourglass className="w-5 h-5 text-orange-400" />,
  },
  DRIFT_BOTTLE: {
    label: '漂流瓶',
    color: 'text-cyan-400',
    markerColor: '#22D3EE',
    icon: <Wine className="w-5 h-5 text-cyan-400" />,
  },
};

const buildMarkerIcon = (color: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const buildUserIcon = (): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#4F46E5" stroke="#ffffff" stroke-width="3"/></svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const buildLandmarkIcon = (checkedIn: boolean): L.DivIcon => {
  const color = checkedIn ? '#22C55E' : '#FBBF24';
  return L.divIcon({
    className: '',
    html: `<svg width="29" height="29" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
    iconSize: [29, 29],
    iconAnchor: [14, 14],
  });
};

const buildBeaconIcon = (color: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
    iconSize: [19, 19],
    iconAnchor: [10, 19],
  });

const buildCoinIcon = (): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="#FFD700" stroke="#DAA520" stroke-width="2"/></svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });


// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

const Toast: React.FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast) return null;
  const bg =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
        ? 'bg-red-600'
        : 'bg-blue-600';
  return (
    <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg ${bg} text-white text-sm max-w-xs text-center transition-all`}>
      {toast.message}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ImageLightbox — 全屏图片浏览（含左右切换）
// ---------------------------------------------------------------------------

const ImageLightbox: React.FC<{
  images: string[];
  initialIndex: number;
  onClose: () => void;
}> = ({ images, initialIndex, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white">
        <X className="w-6 h-6" />
      </button>
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm z-10">
          {index + 1} / {images.length}
        </div>
      )}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white"
        >
          <ArrowLeft className="w-5 h-5 rotate-180" />
        </button>
      )}
      <img
        src={images[index]}
        alt=""
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// DropDetailCard
// ---------------------------------------------------------------------------

interface DropDetailCardProps {
  drop: CampusDrop;
  userPosition: GeoPosition | null;
  onClose: () => void;
  onPickup: (dropId: number) => void;
  isPickingUp: boolean;
}

const DropDetailCard: React.FC<DropDetailCardProps> = ({
  drop,
  userPosition,
  onClose,
  onPickup,
  isPickingUp,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const meta = DROP_TYPE_META[drop.dropType];
  const distance = userPosition
    ? haversineDistance(
        userPosition.latitude,
        userPosition.longitude,
        drop.latitude,
        drop.longitude,
      )
    : null;
  const withinRange = distance !== null && distance <= drop.pickupRadiusMeters;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp">
      <div className="bg-gray-800 rounded-t-2xl p-4 mx-2 mb-0 shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {meta.icon}
            <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700 transition">
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Dropper info */}
        <div className="flex items-center gap-2 mb-3">
          <a href={`/profile/${drop.dropperId}`} className="flex items-center gap-2 min-w-0">
            {drop.dropperAvatar ? (
              <img
                src={drop.dropperAvatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <span className="text-sm text-gray-300 dark:text-gray-500 hover:text-indigo-400 transition truncate">
              {drop.dropperName || '匿名用户'}
            </span>
          </a>
          {distance !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-auto">
              距离 {formatDistance(distance)}
            </span>
          )}
        </div>

        {/* Content preview (hidden for locked time capsules) */}
        {drop.content && !drop.isLocked && (
          <p className="text-sm text-gray-200 dark:text-gray-600 mb-3 line-clamp-3 whitespace-pre-wrap">
            {drop.content}
          </p>
        )}
        {drop.isLocked && drop.dropType === 'TIME_CAPSULE' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 italic mb-3">
            <Lock className="w-3 h-3 inline mr-1" />
            内容已封存，到期后方可查看
          </p>
        )}

        {/* Image previews — all images, clickable to enlarge */}
        {drop.imageUrls && drop.imageUrls.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {drop.imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-16 h-16 rounded-lg object-cover shrink-0 cursor-pointer active:scale-95 transition"
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        )}
        {lightboxIndex !== null && drop.imageUrls && (
          <ImageLightbox images={drop.imageUrls} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}

        {/* Lock warning for KEY_BOX */}
        {drop.dropType === 'KEY_BOX' && drop.lockId && (
          <div className="bg-purple-900/40 border border-purple-700 rounded-lg p-2 mb-3 text-xs text-purple-300">
            <Key className="w-3 h-3 inline mr-1" />
            此钥匙盒关联了一个自锁，拾取后将影响对应锁
          </div>
        )}

        {/* Time capsule locked info */}
        {drop.dropType === 'TIME_CAPSULE' && drop.opensAt && (
          <div className={`border rounded-lg p-2 mb-3 text-xs ${
            drop.isLocked
              ? 'bg-orange-900/40 border-orange-700 text-orange-300'
              : 'bg-green-900/40 border-green-700 text-green-300'
          }`}>
            {drop.isLocked ? (
              <>
                <Lock className="w-3 h-3 inline mr-1" />
                时间胶囊尚未到期，开启日期: {new Date(drop.opensAt).toLocaleDateString('zh-CN')}
              </>
            ) : (
              <>
                <Hourglass className="w-3 h-3 inline mr-1" />
                时间胶囊已到期，可以打开了！
              </>
            )}
          </div>
        )}

        {/* Drift bottle info */}
        {drop.dropType === 'DRIFT_BOTTLE' && (
          <div className="bg-cyan-900/40 border border-cyan-700 rounded-lg p-2 mb-3 text-xs text-cyan-300">
            <Wine className="w-3 h-3 inline mr-1" />
            漂流瓶每24小时随机漂移到新位置
          </div>
        )}

        {/* Pickup radius info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-3">
          拾取范围: {formatDistance(drop.pickupRadiusMeters)}
          {!withinRange && distance !== null && (
            <span className="text-orange-400 ml-2">
              (还需靠近 {formatDistance(distance - drop.pickupRadiusMeters)})
            </span>
          )}
        </div>

        {/* Pickup button */}
        <button
          onClick={() => onPickup(drop.id)}
          disabled={isPickingUp || !withinRange || drop.isLocked}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
            drop.isLocked
              ? 'bg-orange-800 text-orange-300 cursor-not-allowed'
              : withinRange
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'
                : 'bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          {isPickingUp ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : drop.isLocked ? (
            '时间胶囊尚未到期'
          ) : withinRange ? (
            '拾取'
          ) : (
            '不在拾取范围内'
          )}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PlaceDropSheet
// ---------------------------------------------------------------------------

interface PlaceDropSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userPosition: GeoPosition | null;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastState['type']) => void;
}

const PlaceDropSheet: React.FC<PlaceDropSheetProps> = ({
  isOpen,
  onClose,
  userPosition,
  onSuccess,
  showToast,
}) => {
  const queryClient = useQueryClient();

  const [dropType, setDropType] = useState<CampusDropType>('STICKY_NOTE');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pickupRadius, setPickupRadius] = useState(500);
  const [selectedLockId, setSelectedLockId] = useState<number | null>(null);
  const [opensAtDate, setOpensAtDate] = useState('');

  // Fetch inventory for available drop items
  const { data: inventory } = useQuery({
    queryKey: ['specialItems', 'inventory'],
    queryFn: () => specialItemsApi.getInventory(),
    enabled: isOpen,
  });

  // Fetch active self-locks for KEY_BOX
  const { data: myLocks } = useQuery({
    queryKey: ['locks', 'my', 'active'],
    queryFn: () => selfLockApi.getMyLocks(true),
    enabled: isOpen,
  });

  const stickyNoteCount = inventory?.find((i) => i.itemType === 'STICKY_NOTE')?.quantity ?? 0;
  const photoPaperCount = inventory?.find((i) => i.itemType === 'PHOTO_PAPER')?.quantity ?? 0;
  const keyBoxCount = inventory?.find((i) => i.itemType === 'KEY_BOX')?.quantity ?? 0;
  const timeCapsuleCount = inventory?.find((i) => i.itemType === 'TIME_CAPSULE')?.quantity ?? 0;
  const driftBottleCount = inventory?.find((i) => i.itemType === 'DRIFT_BOTTLE')?.quantity ?? 0;
  const hasActiveLocks = myLocks && myLocks.length > 0;

  const placeMutation = useMutation({
    mutationFn: (data: {
      dropType: string;
      latitude: number;
      longitude: number;
      pickupRadiusMeters: number;
      content?: string;
      lockId?: number;
      opensAt?: string;
      images?: File[];
    }) => campusWalkApi.placeDrop(data),
    onSuccess: () => {
      showToast('物品已放置', 'success');
      queryClient.invalidateQueries({ queryKey: ['campusWalk'] });
      resetForm();
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      showToast(err.message || '放置失败', 'error');
    },
  });

  const resetForm = () => {
    setDropType('STICKY_NOTE');
    setContent('');
    setImages([]);
    setImagePreviews([]);
    setPickupRadius(500);
    setSelectedLockId(null);
    setOpensAtDate('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 9 - images.length;
    const toAdd = files.slice(0, remaining);
    setImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!userPosition) {
      showToast('无法获取当前位置', 'error');
      return;
    }

    if (dropType === 'STICKY_NOTE' && !content.trim()) {
      showToast('请输入便签内容', 'error');
      return;
    }

    if (dropType === 'PHOTO_PAPER' && images.length === 0) {
      showToast('请至少选择一张图片', 'error');
      return;
    }

    if (dropType === 'KEY_BOX' && !selectedLockId) {
      showToast('请选择关联的自锁', 'error');
      return;
    }

    if (dropType === 'TIME_CAPSULE' && !content.trim()) {
      showToast('请输入时间胶囊内容', 'error');
      return;
    }

    if (dropType === 'TIME_CAPSULE' && !opensAtDate) {
      showToast('请设置开启日期', 'error');
      return;
    }

    if (dropType === 'DRIFT_BOTTLE' && !content.trim()) {
      showToast('请输入漂流瓶内容', 'error');
      return;
    }

    placeMutation.mutate({
      dropType,
      latitude: userPosition.latitude,
      longitude: userPosition.longitude,
      pickupRadiusMeters: dropType === 'DRIFT_BOTTLE' ? 200 : pickupRadius,
      content: content.trim() || undefined,
      lockId: selectedLockId ?? undefined,
      opensAt: opensAtDate ? new Date(opensAtDate).toISOString() : undefined,
      images: images.length > 0 ? images : undefined,
    });
  };

  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-gray-900 rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">放置物品</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition">
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Drop type selector */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">选择物品类型</label>
          <div className="flex gap-2">
            {/* STICKY_NOTE */}
            <button
              onClick={() => setDropType('STICKY_NOTE')}
              disabled={stickyNoteCount <= 0}
              className={`flex-1 p-3 rounded-xl border transition text-center ${
                dropType === 'STICKY_NOTE'
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-gray-700 bg-gray-800'
              } ${stickyNoteCount <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <StickyNote className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-xs text-gray-300 dark:text-gray-500">便签</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">x{stickyNoteCount}</div>
            </button>

            {/* PHOTO_PAPER */}
            <button
              onClick={() => setDropType('PHOTO_PAPER')}
              disabled={photoPaperCount <= 0}
              className={`flex-1 p-3 rounded-xl border transition text-center ${
                dropType === 'PHOTO_PAPER'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-800'
              } ${photoPaperCount <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Camera className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-xs text-gray-300 dark:text-gray-500">相纸</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">x{photoPaperCount}</div>
            </button>

            {/* KEY_BOX */}
            {keyBoxCount > 0 && hasActiveLocks && (
              <button
                onClick={() => setDropType('KEY_BOX')}
                className={`flex-1 p-3 rounded-xl border transition text-center ${
                  dropType === 'KEY_BOX'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <Key className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <div className="text-xs text-gray-300 dark:text-gray-500">钥匙盒</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">x{keyBoxCount}</div>
              </button>
            )}
          </div>
          {/* Second row: TIME_CAPSULE + DRIFT_BOTTLE */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setDropType('TIME_CAPSULE')}
              disabled={timeCapsuleCount <= 0}
              className={`flex-1 p-3 rounded-xl border transition text-center ${
                dropType === 'TIME_CAPSULE'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800'
              } ${timeCapsuleCount <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Hourglass className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <div className="text-xs text-gray-300 dark:text-gray-500">时间胶囊</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">x{timeCapsuleCount}</div>
            </button>

            <button
              onClick={() => setDropType('DRIFT_BOTTLE')}
              disabled={driftBottleCount <= 0}
              className={`flex-1 p-3 rounded-xl border transition text-center ${
                dropType === 'DRIFT_BOTTLE'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800'
              } ${driftBottleCount <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Wine className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
              <div className="text-xs text-gray-300 dark:text-gray-500">漂流瓶</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">x{driftBottleCount}</div>
            </button>
          </div>
        </div>

        {/* Content input for STICKY_NOTE */}
        {dropType === 'STICKY_NOTE' && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">便签内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="写下你想说的话..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 transition"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right mt-1">{content.length}/500</div>
          </div>
        )}

        {/* Image upload for PHOTO_PAPER */}
        {dropType === 'PHOTO_PAPER' && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">
              选择图片 ({images.length}/9)
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img
                    src={preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {images.length < 9 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition">
                  <ImageIcon className="w-6 h-6 text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">添加图片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {/* Optional text for photo paper */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="添加一段文字（可选）"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        )}

        {/* Lock selector for KEY_BOX */}
        {dropType === 'KEY_BOX' && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">选择关联的自锁</label>
            <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-2 mb-3 text-xs text-orange-300">
              <Key className="w-3 h-3 inline mr-1" />
              警告：放置钥匙盒后，拾取者将能够影响你选择的自锁。请谨慎操作。
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {myLocks?.map((lock) => (
                <button
                  key={lock.id}
                  onClick={() => setSelectedLockId(lock.id)}
                  className={`w-full p-3 rounded-xl border text-left transition ${
                    selectedLockId === lock.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-sm text-white">锁 #{lock.id}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {lock.status} &middot; {lock.lockType}
                        {lock.remainingMinutes != null && ` &middot; 剩余 ${lock.remainingMinutes} 分钟`}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Optional text */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="添加留言（可选）"
              rows={2}
              className="w-full mt-3 bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        )}

        {/* Content input for TIME_CAPSULE */}
        {dropType === 'TIME_CAPSULE' && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">胶囊内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 1000))}
              placeholder="写下未来要看到的话..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 transition"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right mt-1">{content.length}/1000</div>
            <label className="text-sm text-gray-400 dark:text-gray-500 mt-3 mb-2 block">
              <Calendar className="w-4 h-4 inline mr-1" />
              设置开启日期
            </label>
            <DatePickerSheet
              value={opensAtDate}
              onChange={setOpensAtDate}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              max={new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">到期前任何人都无法查看内容</div>
          </div>
        )}

        {/* Content input for DRIFT_BOTTLE */}
        {dropType === 'DRIFT_BOTTLE' && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">漂流瓶内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="写下你想让陌生人看到的话..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 transition"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right mt-1">{content.length}/500</div>
            <div className="bg-cyan-900/30 border border-cyan-700 rounded-lg p-2 mt-2 text-xs text-cyan-300">
              <Wine className="w-3 h-3 inline mr-1" />
              漂流瓶拾取范围固定200米，每24小时随机漂移到新位置
            </div>
          </div>
        )}

        {/* Pickup radius slider (hidden for DRIFT_BOTTLE) */}
        {dropType !== 'DRIFT_BOTTLE' && <div className="mb-5">
          <label className="text-sm text-gray-400 dark:text-gray-500 mb-2 block">
            拾取范围: {formatDistance(pickupRadius)}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPickupRadius((r) => Math.max(100, r - 100))}
              className="p-1 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition"
            >
              <Minus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={pickupRadius}
              onChange={(e) => setPickupRadius(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <button
              onClick={() => setPickupRadius((r) => Math.min(5000, r + 100))}
              className="p-1 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition"
            >
              <Plus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-1">
            <span>100m</span>
            <span>5km</span>
          </div>
        </div>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={placeMutation.isPending || !userPosition}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-white font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {placeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              确认放置
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PickupJournalSheet
// ---------------------------------------------------------------------------

interface PickupJournalSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const PickupJournalSheet: React.FC<PickupJournalSheetProps> = ({ isOpen, onClose }) => {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const { data: pickups, isLoading } = useQuery({
    queryKey: ['campusWalk', 'myPickups'],
    queryFn: () => campusWalkApi.getMyPickups(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-gray-900 rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">我的日志</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition">
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!pickups || pickups.length === 0) && (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-gray-600 dark:text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">还没有拾取记录</p>
          </div>
        )}

        {/* List */}
        {!isLoading && pickups && pickups.length > 0 && (
          <div className="space-y-3">
            {pickups.map((drop) => {
              const meta = DROP_TYPE_META[drop.dropType];
              return (
                <div
                  key={drop.id}
                  className="bg-gray-800 rounded-xl p-3 border border-gray-700"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                        <a href={`/profile/${drop.dropperId}`} className="text-xs text-gray-500 hover:text-indigo-400 transition">
                          来自 {drop.dropperName || '匿名用户'}
                        </a>
                      </div>
                      {drop.content && (
                        <p className="text-xs text-gray-300 dark:text-gray-500 whitespace-pre-wrap">
                          {drop.content}
                        </p>
                      )}
                      {drop.imageUrls && drop.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {drop.imageUrls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="w-16 h-16 rounded-lg object-cover cursor-pointer active:scale-95 transition"
                              onClick={() => setLightbox({ images: drop.imageUrls!, index: i })}
                            />
                          ))}
                        </div>
                      )}
                      {drop.pickedUpAt && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1.5">
                          拾取于{' '}
                          {new Date(drop.pickedUpAt).toLocaleString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Image lightbox */}
        {lightbox && (
          <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CampusWalkPage (Main)
// ---------------------------------------------------------------------------

interface CampusWalkPageProps {
  onBack: () => void;
}

const CampusWalkPage: React.FC<CampusWalkPageProps> = ({ onBack }) => {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [userPosition, setUserPosition] = useState<GeoPosition | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<CampusDrop | null>(null);
  const [isPlaceSheetOpen, setIsPlaceSheetOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Location mode (Amap / GPS)
  const [locationPref, setLocationPref] = useState<AmapPreference>(getAmapPreference);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const usingAmap = locationPref === 'on' || (locationPref === 'auto' && shouldUseAmap());

  // F7: Stroll mode state
  const [isStrolling, setIsStrolling] = useState(false);
  const [strollBio, setStrollBio] = useState('');
  // F9: Landmark state
  const landmarkMarkersRef = useRef<L.Marker[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<CampusLandmark | null>(null);

  // Beacon state
  const beaconMarkersRef = useRef<L.Marker[]>([]);
  const beaconCirclesRef = useRef<L.Circle[]>([]);
  const [selectedBeacon, setSelectedBeacon] = useState<CampusBeacon | null>(null);
  const [isPlaceBeaconOpen, setIsPlaceBeaconOpen] = useState(false);
  const [selectedBaseType, setSelectedBaseType] = useState<BeaconBaseType>('IRON');
  const [showBeaconContacts, setShowBeaconContacts] = useState(false);

  // Beacon contacts query (only for owner viewing contacts)
  const { data: beaconContacts, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['campusWalk', 'beaconContacts', selectedBeacon?.id],
    queryFn: () => campusWalkApi.getBeaconContacts(selectedBeacon!.id),
    enabled: !!selectedBeacon && selectedBeacon.isOwner && showBeaconContacts,
  });

  // Coin state
  const coinMarkersRef = useRef<L.Marker[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CampusCoin | null>(null);

  const hasCenteredRef = useRef(false);

  // ---- Toast helper ----
  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // ---- Geolocation ----
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    getCurrentPosition()
      .then((pos) => {
        setUserPosition(pos);
      })
      .catch(() => {
        showToast('无法获取位置信息', 'error');
      });

    cleanup = watchPosition(
      (pos) => setUserPosition(pos),
      () => {},
    );

    return () => {
      cleanup?.();
    };
  }, [showToast]);

  // ---- Nearby drops query ----
  const {
    data: nearbyDrops,
    isLoading: isLoadingDrops,
    refetch: refetchDrops,
  } = useQuery({
    queryKey: ['campusWalk', 'nearby', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.getNearbyDrops(userPosition.latitude, userPosition.longitude);
    },
    enabled: !!userPosition,
    refetchInterval: 30000,
  });

  const { data: directionHints } = useQuery({
    queryKey: ['campusWalk', 'directionHints', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => userPosition ? campusWalkApi.getDirectionHints(userPosition.latitude, userPosition.longitude) : Promise.resolve([]),
    enabled: !!userPosition,
    refetchInterval: 30000,
  });

  const { data: keyBoxHints } = useQuery({
    queryKey: ['campusWalk', 'keyBoxHints', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => userPosition ? campusWalkApi.getMyKeyBoxHints(userPosition.latitude, userPosition.longitude) : Promise.resolve([]),
    enabled: !!userPosition,
    refetchInterval: 30000,
  });

  // ---- F5: Exploration stats ----
  // Record position every 30 seconds when map is open
  useEffect(() => {
    if (!userPosition || !mapLoaded) return;
    // Record immediately
    campusWalkApi.recordPosition(userPosition.latitude, userPosition.longitude).catch(() => {});
    const interval = setInterval(() => {
      if (userPosition) {
        campusWalkApi.recordPosition(userPosition.latitude, userPosition.longitude).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [userPosition?.latitude, userPosition?.longitude, mapLoaded]);

  const { data: explorationStats } = useQuery({
    queryKey: ['campusWalk', 'explorationStats'],
    queryFn: () => campusWalkApi.getExplorationStats(),
    enabled: mapLoaded,
    refetchInterval: 60000,
  });

  // ---- F6: Footprint / Heatmap data hooks (visualization skipped) ----
  const { data: myFootprints } = useQuery({
    queryKey: ['campusWalk', 'myFootprints'],
    queryFn: () => campusWalkApi.getMyFootprints(7),
    enabled: mapLoaded,
    refetchInterval: 120000,
  });

  const { data: globalHeatmap } = useQuery({
    queryKey: ['campusWalk', 'globalHeatmap'],
    queryFn: () => campusWalkApi.getGlobalHeatmap(7),
    enabled: mapLoaded,
    refetchInterval: 120000,
  });

  // ---- F7: Stroll mode mutations & queries ----
  const startStrollMutation = useMutation({
    mutationFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.startStroll(userPosition.latitude, userPosition.longitude, strollBio || undefined);
    },
    onSuccess: () => {
      setIsStrolling(true);
      showToast('漫步模式已开启', 'success');
    },
    onError: (err: Error) => {
      showToast(err.message || '开启失败', 'error');
    },
  });

  const stopStrollMutation = useMutation({
    mutationFn: () => campusWalkApi.stopStroll(),
    onSuccess: () => {
      setIsStrolling(false);
      showToast('漫步模式已关闭', 'info');
    },
    onError: (err: Error) => {
      showToast(err.message || '关闭失败', 'error');
    },
  });

  // Update stroll position every 10 seconds while strolling
  useEffect(() => {
    if (!isStrolling || !userPosition) return;
    const interval = setInterval(() => {
      if (userPosition) {
        campusWalkApi.updateStroll(userPosition.latitude, userPosition.longitude).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isStrolling, userPosition?.latitude, userPosition?.longitude]);

  const { data: nearbyStrollers } = useQuery({
    queryKey: ['campusWalk', 'nearbyStrollers', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.getNearbyStrollers(userPosition.latitude, userPosition.longitude);
    },
    enabled: isStrolling && !!userPosition,
    refetchInterval: 10000,
  });

  const sendWaveMutation = useMutation({
    mutationFn: (userId: number) => campusWalkApi.sendWave(userId),
    onSuccess: () => {
      showToast('已发送打招呼!', 'success');
    },
    onError: (err: Error) => {
      showToast(err.message || '发送失败', 'error');
    },
  });

  // ---- F9: Campus landmarks ----
  const { data: landmarks } = useQuery({
    queryKey: ['campusWalk', 'landmarks'],
    queryFn: () => campusWalkApi.getLandmarks(),
    enabled: mapLoaded,
  });

  const checkinLandmarkMutation = useMutation({
    mutationFn: (id: number) => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.checkinLandmark(id, userPosition.latitude, userPosition.longitude);
    },
    onSuccess: (response) => {
      showToast(response.message || '签到成功!', 'success');
      setSelectedLandmark(null);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'landmarks'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '签到失败', 'error');
    },
  });

  // ---- Beacon queries & mutations ----
  const { data: nearbyBeacons, refetch: refetchBeacons } = useQuery({
    queryKey: ['campusWalk', 'beacons', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.getNearbyBeacons(userPosition.latitude, userPosition.longitude);
    },
    enabled: !!userPosition && mapLoaded,
    refetchInterval: 30000,
  });

  const placeBeaconMutation = useMutation({
    mutationFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.placeBeacon({
        latitude: userPosition.latitude,
        longitude: userPosition.longitude,
        baseType: selectedBaseType,
      });
    },
    onSuccess: () => {
      showToast('信标放置成功!', 'success');
      setIsPlaceBeaconOpen(false);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'beacons'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '放置失败', 'error');
    },
  });

  const recallBeaconMutation = useMutation({
    mutationFn: (id: number) => campusWalkApi.recallBeacon(id),
    onSuccess: () => {
      showToast('信标已收回', 'success');
      setSelectedBeacon(null);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'beacons'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '收回失败', 'error');
    },
  });

  const swapBaseMutation = useMutation({
    mutationFn: ({ id, newBaseType }: { id: number; newBaseType: BeaconBaseType }) =>
      campusWalkApi.swapBeaconBase(id, { newBaseType }),
    onSuccess: (beacon) => {
      showToast('底座更换成功!', 'success');
      setSelectedBeacon(beacon);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'beacons'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '更换失败', 'error');
    },
  });

  const interactBeaconMutation = useMutation({
    mutationFn: (id: number) => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.interactBeacon(id, userPosition.latitude, userPosition.longitude);
    },
    onSuccess: (beacon) => {
      showToast('已成为信标接触者!', 'success');
      setSelectedBeacon(beacon);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'beacons'] });
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'nearby'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '交互失败', 'error');
    },
  });

  // ---- Coin queries & mutations ----
  const { data: nearbyCoins, refetch: refetchCoins } = useQuery({
    queryKey: ['campusWalk', 'coins', userPosition?.latitude, userPosition?.longitude],
    queryFn: () => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.getNearbyCoins(userPosition.latitude, userPosition.longitude);
    },
    enabled: !!userPosition && mapLoaded,
    refetchInterval: 15000,
  });

  const collectCoinMutation = useMutation({
    mutationFn: (coinId: number) => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.collectCoin(coinId, userPosition.latitude, userPosition.longitude);
    },
    onSuccess: (response: CollectCoinResponse) => {
      showToast(response.message || '+1 校园点数', 'success');
      setSelectedCoin(null);
      queryClient.invalidateQueries({ queryKey: ['campusWalk', 'coins'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '拾取失败', 'error');
    },
  });

  // ---- Pickup mutation ----
  const pickupMutation = useMutation({
    mutationFn: (dropId: number) => {
      if (!userPosition) throw new Error('No position');
      return campusWalkApi.pickupDrop(dropId, userPosition.latitude, userPosition.longitude);
    },
    onSuccess: (response: PickupDropResponse) => {
      showToast(response.message || '拾取成功!', 'success');
      if (response.lockEffect) {
        showToast(response.lockEffect, 'info');
      }
      setSelectedDrop(null);
      queryClient.invalidateQueries({ queryKey: ['campusWalk'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '拾取失败', 'error');
    },
  });

  // ---- Initialize Leaflet Map ----
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultCenter: L.LatLngExpression = userPosition
      ? [userPosition.latitude, userPosition.longitude]
      : [39.9042, 116.4074]; // Beijing fallback

    try {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      const tileUrl = resolvedTheme === 'dark' ? TILE_URLS.dark : TILE_URLS.light;
      const tileLayer = L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapRef.current = map;
      setMapLoaded(true);
    } catch (err: any) {
      setMapError(err.message || '地图加载失败');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // ---- Swap tile layer when theme changes ----
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const tileUrl = resolvedTheme === 'dark' ? TILE_URLS.dark : TILE_URLS.light;
    tileLayerRef.current.setUrl(tileUrl);
  }, [resolvedTheme]);

  // ---- Update user marker / center map ----
  useEffect(() => {
    if (!userPosition || !mapLoaded || !mapRef.current) return;

    const pos: L.LatLngExpression = [userPosition.latitude, userPosition.longitude];

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(pos);
    } else {
      userMarkerRef.current = L.marker(pos, {
        icon: buildUserIcon(),
        zIndexOffset: 999,
        title: '我的位置',
      }).addTo(mapRef.current);
    }
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      mapRef.current.panTo(pos);
    }
  }, [userPosition, mapLoaded]);

  // ---- Update drop markers ----
  useEffect(() => {
    if (!mapLoaded || !nearbyDrops || !mapRef.current) return;

    const activeDrops = nearbyDrops.filter((d) => d.status === 'ACTIVE');

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    activeDrops.forEach((drop) => {
      const meta = DROP_TYPE_META[drop.dropType];
      const marker = L.marker([drop.latitude, drop.longitude], {
        icon: buildMarkerIcon(meta.markerColor),
        title: meta.label,
      }).addTo(mapRef.current!);
      marker.on('click', () => setSelectedDrop(drop));
      markersRef.current.push(marker);
    });
  }, [nearbyDrops, mapLoaded]);

  // ---- F9: Update landmark markers ----
  useEffect(() => {
    if (!mapLoaded || !landmarks || !mapRef.current) return;

    landmarkMarkersRef.current.forEach((m) => m.remove());
    landmarkMarkersRef.current = [];

    landmarks.forEach((lm: CampusLandmark) => {
      const marker = L.marker([lm.latitude, lm.longitude], {
        icon: buildLandmarkIcon(lm.checkedIn),
        zIndexOffset: 500,
        title: lm.name,
      }).addTo(mapRef.current!);
      marker.on('click', () => setSelectedLandmark(lm));
      landmarkMarkersRef.current.push(marker);
    });
  }, [landmarks, mapLoaded]);

  // ---- Update beacon markers + range circles ----
  useEffect(() => {
    if (!mapLoaded || !nearbyBeacons || !mapRef.current) return;

    beaconMarkersRef.current.forEach((m) => m.remove());
    beaconMarkersRef.current = [];
    beaconCirclesRef.current.forEach((c) => c.remove());
    beaconCirclesRef.current = [];

    nearbyBeacons.forEach((beacon: CampusBeacon) => {
      const color = beacon.isOwner ? '#22C55E' : beacon.isContact ? '#60A5FA' : '#EF4444';

      const marker = L.marker([beacon.latitude, beacon.longitude], {
        icon: buildBeaconIcon(color),
        zIndexOffset: 600,
        title: `信标 (${beacon.baseType})`,
      }).addTo(mapRef.current!);
      marker.on('click', () => setSelectedBeacon(beacon));
      beaconMarkersRef.current.push(marker);

      const circle = L.circle([beacon.latitude, beacon.longitude], {
        radius: beacon.radiusMeters,
        fillColor: color,
        fillOpacity: 0.04,
        color: color,
        weight: 1,
        opacity: 0.3,
        interactive: false,
      }).addTo(mapRef.current!);
      beaconCirclesRef.current.push(circle);
    });
  }, [nearbyBeacons, mapLoaded]);

  // ---- Update coin markers ----
  useEffect(() => {
    if (!mapLoaded || !nearbyCoins || !mapRef.current) return;

    coinMarkersRef.current.forEach((m) => m.remove());
    coinMarkersRef.current = [];

    const activeCoins = nearbyCoins.filter((c) => c.status === 'ACTIVE');
    activeCoins.forEach((coin) => {
      const marker = L.marker([coin.latitude, coin.longitude], {
        icon: buildCoinIcon(),
        zIndexOffset: 400,
        title: `+${coin.value} 点`,
      }).addTo(mapRef.current!);
      marker.on('click', () => {
        if (coin.canCollect) {
          collectCoinMutation.mutate(coin.id);
        } else {
          setSelectedCoin(coin);
        }
      });
      coinMarkersRef.current.push(marker);
    });
  }, [nearbyCoins, mapLoaded]);

  // ---- Refresh handler ----
  const handleRefresh = useCallback(() => {
    refetchDrops();
    refetchBeacons();
    refetchCoins();
    showToast('正在刷新...', 'info');
  }, [refetchDrops, refetchBeacons, refetchCoins, showToast]);

  // ---- Compute nearby count ----
  const activeDropCount = nearbyDrops?.filter((d) => d.status === 'ACTIVE').length ?? 0;

  return (
    <div className="fixed inset-0 z-40 bg-gray-100 dark:bg-gray-900">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 isolate" />

      {/* Map fallback / loading states */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">正在加载地图...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center px-6">
            <MapPin className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">地图加载失败</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{mapError}</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] bg-gradient-to-b from-gray-900/90 to-transparent pb-6">
          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-gray-800/80 backdrop-blur flex items-center justify-center border border-gray-700/50 active:scale-95 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">漫步校园</h1>
          </div>
          <div className="flex items-center gap-2 pt-3">
            {/* Location mode toggle */}
            <div className="relative">
              <button
                onClick={() => setShowLocationMenu(v => !v)}
                className={`h-9 px-2.5 rounded-full backdrop-blur flex items-center gap-1.5 border active:scale-95 transition text-xs font-medium ${
                  usingAmap
                    ? 'bg-blue-600/80 border-blue-500/50 text-blue-100'
                    : 'bg-gray-800/80 border-gray-700/50 text-gray-300 dark:text-gray-500'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                {usingAmap ? '高德' : 'GPS'}
              </button>
              {showLocationMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLocationMenu(false)} />
                  <div className="absolute right-0 top-11 bg-gray-800/95 backdrop-blur rounded-xl border border-gray-700 shadow-2xl z-50 min-w-[140px] py-1">
                    {([
                      { key: 'auto' as AmapPreference, label: '自动检测', desc: '根据时区判断' },
                      { key: 'on' as AmapPreference, label: '高德定位', desc: '国内精度更高' },
                      { key: 'off' as AmapPreference, label: 'GPS定位', desc: '原生浏览器定位' },
                    ]).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setAmapPreference(opt.key);
                          setLocationPref(opt.key);
                          setShowLocationMenu(false);
                          showToast(`已切换为${opt.label}，重新定位中...`, 'success');
                          // Re-fetch position with new setting
                          getCurrentPosition()
                            .then((pos: GeoPosition) => setUserPosition(pos))
                            .catch(() => {});
                        }}
                        className={`w-full flex flex-col px-3.5 py-2 text-left transition-colors ${
                          locationPref === opt.key ? 'bg-blue-600/30' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <span className={`text-xs font-medium ${locationPref === opt.key ? 'text-blue-300' : 'text-gray-200 dark:text-gray-600'}`}>
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoadingDrops}
              className="w-9 h-9 rounded-full bg-gray-800/80 backdrop-blur flex items-center justify-center border border-gray-700/50 active:scale-95 transition"
            >
              <RefreshCw
                className={`w-4 h-4 text-white ${isLoadingDrops ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* F5: Exploration stats badge */}
      {explorationStats && (
        <div className="absolute top-20 left-3 z-20">
          <div className="bg-gray-900/90 backdrop-blur rounded-xl px-3 py-2 border border-gray-700 flex items-center gap-2">
            <Footprints className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-300 dark:text-gray-500">
              已探索 <span className="text-white font-semibold">{explorationStats.percentage}%</span>
            </span>
          </div>
        </div>
      )}

      {/* Direction hints panel */}
      {directionHints && directionHints.length > 0 && (
        <div className="absolute bottom-24 left-3 z-20 bg-gray-900/90 backdrop-blur rounded-xl p-3 max-w-[200px] border border-gray-700">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
            <Compass className="w-3 h-3" />
            远处线索
          </div>
          <div className="space-y-1.5">
            {directionHints.slice(0, 5).map((hint) => {
              const meta = DROP_TYPE_META[hint.dropType];
              return (
                <div key={hint.dropId} className="flex items-center gap-2 text-xs">
                  <span className={meta?.color || 'text-gray-400 dark:text-gray-500'}>{getDirectionArrow(hint.direction)}</span>
                  <span className="text-gray-300 dark:text-gray-500">{meta?.label || hint.dropType}</span>
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-auto">{hint.distanceRange}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key box temperature hints */}
      {keyBoxHints && keyBoxHints.length > 0 && (
        <div className="absolute top-20 right-3 z-20 space-y-2">
          {keyBoxHints.map((hint) => {
            const tempColors = {
              burning: 'bg-red-600/90 border-red-500 text-red-100',
              hot: 'bg-orange-600/90 border-orange-500 text-orange-100',
              warm: 'bg-yellow-600/90 border-yellow-500 text-yellow-100',
              cold: 'bg-blue-600/90 border-blue-500 text-blue-100',
            };
            const tempLabels = { burning: '极热', hot: '热', warm: '暖', cold: '冷' };
            return (
              <div key={hint.dropId} className={`backdrop-blur rounded-xl px-3 py-2 border text-xs ${tempColors[hint.temperature]}`}>
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3 h-3" />
                  <span className="font-semibold">钥匙盒 {tempLabels[hint.temperature]}</span>
                </div>
                <div className="mt-0.5 opacity-80">
                  {getDirectionArrow(hint.direction)} {hint.distanceRange}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom control panel */}
      {!selectedDrop && !selectedCoin && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-3 mb-4 bg-gray-800/90 backdrop-blur rounded-2xl border border-gray-700/50 shadow-2xl p-4">
            {/* Nearby count */}
            <div className="flex items-center justify-center mb-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-300 dark:text-gray-500">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>
                  附近有 <span className="text-white font-semibold">{activeDropCount}</span> 个物品
                </span>
                {isLoadingDrops && (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-1" />
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsPlaceSheetOpen(true)}
                disabled={!userPosition}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-white font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                放置物品
              </button>
              <button
                onClick={() => setIsPlaceBeaconOpen(true)}
                disabled={!userPosition}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-white font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                放置信标
              </button>
              <button
                onClick={() => setIsJournalOpen(true)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                日志
              </button>
            </div>

            {/* F7: Stroll mode toggle */}
            <div className="mt-3">
              {!isStrolling ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={strollBio}
                    onChange={(e) => setStrollBio(e.target.value.slice(0, 50))}
                    placeholder="一句话介绍自己（可选）"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    onClick={() => startStrollMutation.mutate()}
                    disabled={!userPosition || startStrollMutation.isPending}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-white text-xs font-semibold rounded-xl transition active:scale-[0.98] flex items-center gap-1.5"
                  >
                    {startStrollMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Users className="w-3 h-3" />
                    )}
                    漫步模式
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => stopStrollMutation.mutate()}
                  disabled={stopStrollMutation.isPending}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-xs font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  {stopStrollMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  关闭漫步模式
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop detail card */}
      {selectedDrop && (
        <DropDetailCard
          drop={selectedDrop}
          userPosition={userPosition}
          onClose={() => setSelectedDrop(null)}
          onPickup={(id) => pickupMutation.mutate(id)}
          isPickingUp={pickupMutation.isPending}
        />
      )}

      {/* Place drop sheet */}
      <PlaceDropSheet
        isOpen={isPlaceSheetOpen}
        onClose={() => setIsPlaceSheetOpen(false)}
        userPosition={userPosition}
        onSuccess={() => refetchDrops()}
        showToast={showToast}
      />

      {/* Pickup journal sheet */}
      <PickupJournalSheet
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
      />

      {/* F7: Nearby strollers panel */}
      {isStrolling && nearbyStrollers && nearbyStrollers.length > 0 && !selectedDrop && !selectedLandmark && (
        <div className="absolute bottom-48 right-3 z-20 bg-gray-900/95 backdrop-blur rounded-xl border border-gray-700 shadow-2xl max-w-55 max-h-70 overflow-y-auto">
          <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-3 py-2 border-b border-gray-700">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              附近的人 ({nearbyStrollers.length})
            </div>
          </div>
          <div className="p-2 space-y-2">
            {nearbyStrollers.map((stroller) => (
              <div key={stroller.userId} className="bg-gray-800 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1">
                  {stroller.avatarUrl ? (
                    <img src={stroller.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
                      <Users className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white font-medium truncate">{stroller.displayName}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {getDirectionArrow(stroller.approximateDirection)} {stroller.approximateDistance}
                    </div>
                  </div>
                </div>
                {stroller.bio && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 line-clamp-1">{stroller.bio}</p>
                )}
                <button
                  onClick={() => sendWaveMutation.mutate(stroller.userId)}
                  disabled={sendWaveMutation.isPending}
                  className="w-full py-1 bg-indigo-600/80 hover:bg-indigo-500 text-[10px] text-white rounded-md transition active:scale-[0.98] flex items-center justify-center gap-1"
                >
                  <span>&#128075;</span> 打招呼
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F9: Landmark detail popup */}
      {selectedLandmark && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp">
          <div className="bg-gray-800 rounded-t-2xl p-4 mx-2 mb-0 shadow-2xl border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className={`w-5 h-5 ${selectedLandmark.checkedIn ? 'text-green-400' : 'text-yellow-400'}`} />
                <span className="font-semibold text-white">{selectedLandmark.name}</span>
              </div>
              <button onClick={() => setSelectedLandmark(null)} className="p-1 rounded-full hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            {/* Description */}
            {selectedLandmark.description && (
              <p className="text-sm text-gray-300 dark:text-gray-500 mb-3">{selectedLandmark.description}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <Flag className="w-3 h-3" />
                <span>累计签到 {selectedLandmark.totalCheckins} 次</span>
              </div>
              {selectedLandmark.checkedIn && (
                <div className="flex items-center gap-1 text-green-400">
                  <MapPinCheck className="w-3 h-3" />
                  <span>已打卡</span>
                </div>
              )}
            </div>

            {/* Checkin button */}
            <button
              onClick={() => checkinLandmarkMutation.mutate(selectedLandmark.id)}
              disabled={checkinLandmarkMutation.isPending || selectedLandmark.checkedInToday}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                selectedLandmark.checkedInToday
                  ? 'bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white active:scale-[0.98]'
              }`}
            >
              {checkinLandmarkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : selectedLandmark.checkedInToday ? (
                '今日已签到'
              ) : (
                '签到'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Beacon detail popup */}
      {selectedBeacon && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp">
          <div className="bg-gray-800 rounded-t-2xl p-4 mx-2 mb-0 shadow-2xl border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className={`w-5 h-5 ${selectedBeacon.isContact ? 'text-green-400' : 'text-red-400'}`} />
                <span className="font-semibold text-white">
                  {selectedBeacon.ownerName ? `${selectedBeacon.ownerName}的信标` : '信标'}
                </span>
              </div>
              <button onClick={() => { setSelectedBeacon(null); setShowBeaconContacts(false); }} className="p-1 rounded-full hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            {/* Info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <Signal className="w-3 h-3" />
                <span>
                  {selectedBeacon.baseType === 'IRON' ? '铁质' : selectedBeacon.baseType === 'GOLD' ? '金制' : '钻石'}底座
                </span>
              </div>
              <div>半径 {(selectedBeacon.radiusMeters / 1000).toFixed(0)}km</div>
              <div>接触者 {selectedBeacon.contactCount} 人</div>
              <div>{Math.round(selectedBeacon.distanceMeters)}m</div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedBeacon.isContact && (
                <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full border border-green-700/50">已接触</span>
              )}
              {selectedBeacon.canInteract && !selectedBeacon.isContact && (
                <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 text-xs rounded-full border border-yellow-700/50">可交互 (50m内)</span>
              )}
            </div>

            {/* Owner: Contact list toggle */}
            {selectedBeacon.isOwner && selectedBeacon.contactCount > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => setShowBeaconContacts(!showBeaconContacts)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  {showBeaconContacts ? '收起接触者' : `查看 ${selectedBeacon.contactCount} 位接触者`}
                </button>
                {showBeaconContacts && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                    {isLoadingContacts && (
                      <div className="flex justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {beaconContacts?.map((contact) => (
                      <a
                        key={contact.userId}
                        href={`/profile/${contact.userId}`}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition"
                      >
                        {contact.photoUrl ? (
                          <img src={contact.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-gray-300">
                            {contact.firstName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">
                            {contact.firstName}{contact.lastName ? ` ${contact.lastName}` : ''}
                          </div>
                          {contact.username && (
                            <div className="text-[10px] text-gray-500 truncate">@{contact.username}</div>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 shrink-0">
                          {new Date(contact.contactedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {/* Owner actions */}
              {selectedBeacon.isOwner && (() => {
                const hoursSincePlaced = (Date.now() - new Date(selectedBeacon.createdAt).getTime()) / (1000 * 60 * 60);
                const canRecall = hoursSincePlaced >= 24;
                const remainingHours = Math.ceil(24 - hoursSincePlaced);
                return (
                  <>
                    <button
                      onClick={() => recallBeaconMutation.mutate(selectedBeacon.id)}
                      disabled={recallBeaconMutation.isPending || !canRecall}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                      title={!canRecall ? `放置后24h内不可收回，还需${remainingHours}h` : undefined}
                    >
                      {recallBeaconMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {canRecall ? '收回信标' : `${remainingHours}h后可收回`}
                    </button>
                    <Select value="" onValueChange={(newBaseType) => swapBaseMutation.mutate({ id: selectedBeacon.id, newBaseType: newBaseType as BeaconBaseType })}>
                      <SelectTrigger className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl" disabled={swapBaseMutation.isPending}>
                        <SelectValue placeholder="更换底座" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedBeacon.baseType !== 'IRON' && <SelectItem value="IRON">铁质 (5km)</SelectItem>}
                        {selectedBeacon.baseType !== 'GOLD' && <SelectItem value="GOLD">金制 (10km)</SelectItem>}
                        {selectedBeacon.baseType !== 'DIAMOND' && <SelectItem value="DIAMOND">钻石 (15km)</SelectItem>}
                      </SelectContent>
                    </Select>
                  </>
                );
              })()}
              {/* Non-owner: interact */}
              {!selectedBeacon.isContact && selectedBeacon.canInteract && (
                <button
                  onClick={() => interactBeaconMutation.mutate(selectedBeacon.id)}
                  disabled={interactBeaconMutation.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  {interactBeaconMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  接触信标
                </button>
              )}
              {!selectedBeacon.isContact && !selectedBeacon.canInteract && (
                <div className="flex-1 py-2.5 bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm text-center rounded-xl">
                  需在50m内才能交互
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Place beacon sheet */}
      {isPlaceBeaconOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setIsPlaceBeaconOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-lg bg-gray-800 rounded-t-2xl p-5 border border-gray-700 shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-400" />
                放置信标
              </h3>
              <button onClick={() => setIsPlaceBeaconOpen(false)} className="p-1 rounded-full hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">选择底座类型，信标将放置在你当前位置</p>

            <div className="space-y-2 mb-4">
              {([
                { type: 'IRON' as BeaconBaseType, label: '铁质底座', radius: '5km', price: 100, color: 'border-gray-500' },
                { type: 'GOLD' as BeaconBaseType, label: '金制底座', radius: '10km', price: 300, color: 'border-yellow-500' },
                { type: 'DIAMOND' as BeaconBaseType, label: '钻石底座', radius: '15km', price: 800, color: 'border-cyan-400' },
              ]).map((base) => (
                <button
                  key={base.type}
                  onClick={() => setSelectedBaseType(base.type)}
                  className={`w-full p-3 rounded-xl border-2 transition text-left ${
                    selectedBaseType === base.type
                      ? `${base.color} bg-gray-700`
                      : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{base.label}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">半径 {base.radius}</div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{base.price} 校园点</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">
              放置需消耗 1个信标 + 1个底座。收回时两者归还。
            </div>

            <button
              onClick={() => placeBeaconMutation.mutate()}
              disabled={placeBeaconMutation.isPending || !userPosition}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-white font-semibold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {placeBeaconMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              放置信标
            </button>
          </div>
        </div>
      )}

      {/* Coin detail card */}
      {selectedCoin && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp">
          <div className="bg-gray-800 rounded-t-2xl p-4 mx-2 mb-0 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="font-semibold text-yellow-400">校园硬币</span>
              </div>
              <button onClick={() => setSelectedCoin(null)} className="p-1 rounded-full hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-300 dark:text-gray-500 mb-2">
              价值: +{selectedCoin.value} 校园点数
            </p>
            {selectedCoin.distanceMeters != null && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
                距离: {formatDistance(selectedCoin.distanceMeters)}
                {selectedCoin.canCollect ? ' (可拾取)' : ' (需≤30m)'}
              </p>
            )}
            <button
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2 bg-yellow-500 text-black dark:text-white disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500"
              disabled={!selectedCoin.canCollect || collectCoinMutation.isPending}
              onClick={() => collectCoinMutation.mutate(selectedCoin.id)}
            >
              {collectCoinMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coins className="w-4 h-4" />
              )}
              {collectCoinMutation.isPending ? '拾取中...' : selectedCoin.canCollect ? '拾取硬币' : '走近拾取'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast toast={toast} />

      {/* Slide-up animation style */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CampusWalkPage;
