import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  MapPin,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Star,
  Flag,
  Building,
  TreePine,
  Coffee,
  BookOpen,
  Dumbbell,
} from 'lucide-react';
import { CampusLandmark } from '../../types';
import { adminApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LandmarkEditorPageProps {
  onBack: () => void;
}

interface LandmarkFormData {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  iconType: string;
}

const initialFormData: LandmarkFormData = {
  name: '',
  description: '',
  latitude: 0,
  longitude: 0,
  radiusMeters: 50,
  iconType: 'star',
};

const ICON_TYPES = [
  { value: 'star', label: '星标', icon: Star },
  { value: 'flag', label: '旗帜', icon: Flag },
  { value: 'building', label: '建筑', icon: Building },
  { value: 'tree', label: '自然', icon: TreePine },
  { value: 'cafe', label: '餐饮', icon: Coffee },
  { value: 'library', label: '图书馆', icon: BookOpen },
  { value: 'sports', label: '运动', icon: Dumbbell },
  { value: 'pin', label: '地点', icon: MapPin },
];


export const LandmarkEditorPage: React.FC<LandmarkEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [landmarks, setLandmarks] = useState<CampusLandmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLandmark, setEditingLandmark] = useState<CampusLandmark | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<LandmarkFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getLandmarks();
      setLandmarks(data);
    } catch (err) {
      console.error('Failed to fetch landmarks:', err);
      setError('加载地标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLandmarks = landmarks.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEditing = isCreating || editingLandmark !== null;

  // Initialize map when entering edit mode
  useEffect(() => {
    if (!isEditing || !mapContainerRef.current) return;

    const center: L.LatLngExpression = formData.latitude && formData.longitude
      ? [formData.latitude, formData.longitude]
      : [31.0, 121.0]; // Default: Shanghai area

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 16,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;

    const marker = L.marker(center, {
      draggable: true,
      title: '拖动选择位置',
    }).addTo(map);
    markerRef.current = marker;

    const circle = L.circle(center, {
      radius: formData.radiusMeters,
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      color: '#3b82f6',
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    // Update form when marker is dragged
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const lat = Math.round(pos.lat * 100000) / 100000;
      const lng = Math.round(pos.lng * 100000) / 100000;
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
      circle.setLatLng(pos);
    });

    // Update marker when clicking on map
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
      const lat = Math.round(e.latlng.lat * 100000) / 100000;
      const lng = Math.round(e.latlng.lng * 100000) / 100000;
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
    });

    setMapLoaded(true);

    return () => {
      map.remove();
      markerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [isEditing]);

  // Update circle radius when form changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(formData.radiusMeters);
    }
  }, [formData.radiusMeters]);

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingLandmark(null);
  };

  const handleEdit = (landmark: CampusLandmark) => {
    setFormData({
      name: landmark.name,
      description: landmark.description || '',
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      radiusMeters: landmark.radiusMeters,
      iconType: landmark.iconType,
    });
    setEditingLandmark(landmark);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingLandmark(null);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入地标名称');
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      setError('请在地图上选择位置');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const request = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        radiusMeters: formData.radiusMeters,
        iconType: formData.iconType,
      };

      if (editingLandmark) {
        await adminApi.updateLandmark(editingLandmark.id, request);
      } else {
        await adminApi.createLandmark(request);
      }

      await fetchData();
      handleCancel();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定删除此地标？已有的打卡记录不受影响。', destructive: true }))) return;
    try {
      await adminApi.deleteLandmark(id);
      await fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('删除失败');
    }
  };

  const getIconComponent = (iconType: string) => {
    const found = ICON_TYPES.find(t => t.value === iconType);
    const Icon = found?.icon || MapPin;
    return <Icon size={18} />;
  };

  // ============ Edit / Create Form ============
  if (isEditing) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
          <button onClick={handleCancel} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">
            {editingLandmark ? '编辑地标' : '创建地标'}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <X size={16} /> {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">地标名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例：图书馆、操场、食堂..."
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="关于这个地标的说明..."
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Icon Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">图标类型</label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setFormData(prev => ({ ...prev, iconType: type.value }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                    formData.iconType === type.value
                      ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <type.icon size={20} />
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              打卡范围: {formData.radiusMeters}m
            </label>
            <input
              type="range"
              min={20}
              max={500}
              step={10}
              value={formData.radiusMeters}
              onChange={e => setFormData(prev => ({ ...prev, radiusMeters: parseInt(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
              <span>20m</span>
              <span>500m</span>
            </div>
          </div>

          {/* Map Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              位置 * <span className="text-slate-400 dark:text-slate-500 font-normal">（点击或拖动标记选择）</span>
            </label>
            <div
              ref={mapContainerRef}
              className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700"
            />
            {formData.latitude !== 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
              </p>
            )}
          </div>

          {/* Manual coordinate input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">纬度</label>
              <input
                type="number"
                step="0.00001"
                value={formData.latitude || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setFormData(prev => ({ ...prev, latitude: val }));
                    if (markerRef.current && mapRef.current) {
                      const pos = L.latLng(val, formData.longitude);
                      markerRef.current.setLatLng(pos);
                      circleRef.current?.setLatLng(pos);
                      mapRef.current.panTo(pos);
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">经度</label>
              <input
                type="number"
                step="0.00001"
                value={formData.longitude || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setFormData(prev => ({ ...prev, longitude: val }));
                    if (markerRef.current && mapRef.current) {
                      const pos = L.latLng(formData.latitude, val);
                      markerRef.current.setLatLng(pos);
                      circleRef.current?.setLatLng(pos);
                      mapRef.current.panTo(pos);
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ List View ============
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 pb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 dark:bg-slate-800/10 flex items-center justify-center hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">校园地标管理</h1>
            <p className="text-xs text-white/60 mt-0.5">
              {landmarks.length} 个地标
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="w-10 h-10 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center hover:bg-white/30 dark:bg-slate-800/30 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索地标..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/10 dark:bg-slate-800/10 rounded-xl text-sm placeholder-white/40 focus:outline-none focus:bg-white/20 dark:bg-slate-800/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 -mt-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400 dark:text-slate-500" />
          </div>
        ) : filteredLandmarks.length === 0 ? (
          <div className="text-center py-12">
            <MapPin size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {searchQuery ? '没有找到匹配的地标' : '还没有地标，点击右上角 + 创建'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLandmarks.map(landmark => (
              <div
                key={landmark.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    {getIconComponent(landmark.iconType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{landmark.name}</h3>
                    {landmark.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{landmark.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <span>{landmark.latitude.toFixed(4)}, {landmark.longitude.toFixed(4)}</span>
                      <span>范围 {landmark.radiusMeters}m</span>
                      <span>{landmark.totalCheckins} 次打卡</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(landmark)}
                      className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(landmark.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
