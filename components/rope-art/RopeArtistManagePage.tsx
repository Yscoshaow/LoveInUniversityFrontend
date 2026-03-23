import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, Plus, Trash2, Edit3, Calendar, Pause, Play,
  Star, Loader2, X, Image as ImageIcon, Upload, Check, Clock,
  AlertCircle, MapPin,
} from 'lucide-react';
import { ropeArtistApi } from '../../lib/api';
import type {
  RopeArtistData, PortfolioImage, PriceListItem, RopeBookingData,
  CreatePriceListRequest, UpdatePriceListRequest,
} from '../../types';

interface RopeArtistManagePageProps {
  onBack: () => void;
}

// ==================== Apply Form ====================

const ApplyForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: () => ropeArtistApi.apply({
      displayName,
      bio,
      city,
      specialties: specialties || undefined,
      experienceYears: experienceYears || undefined,
      applicationImageUrls: imageUrls,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ropeArtists'] });
      onSuccess();
    },
  });

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('images', f));
      const result = await ropeArtistApi.uploadImages(formData);
      setImageUrls(prev => [...prev, ...result.imageUrls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '图片上传失败');
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-sm text-purple-700 dark:text-purple-300">
        申请成为绳艺师，审核通过后即可开设自己的绳艺屋。
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">显示名称 *</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="你的艺名" maxLength={100}
          className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">城市 *</label>
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="你所在的城市" maxLength={100}
          className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">个人简介 *</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="介绍一下自己..." rows={3} maxLength={2000}
          className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">擅长风格</label>
        <input value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="如：日式/欧式/悬吊..." maxLength={500}
          className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">经验年数</label>
        <input type="number" min={0} max={50} value={experienceYears} onChange={e => setExperienceYears(Number(e.target.value))}
          className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
      </div>

      {/* Image upload */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">作品/资质图片</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-purple-400">
            {uploading ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <Plus size={20} className="text-gray-400" />}
            <input type="file" accept="image/*" multiple onChange={handleUploadImages} className="hidden" />
          </label>
        </div>
      </div>

      {applyMutation.error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <AlertCircle size={16} />
          {(applyMutation.error as Error).message}
        </div>
      )}

      <button
        onClick={() => applyMutation.mutate()}
        disabled={!displayName.trim() || !bio.trim() || !city.trim() || applyMutation.isPending}
        className="w-full py-3 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {applyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
        提交申请
      </button>
    </div>
  );
};

// ==================== Profile Editor ====================

const ProfileEditor: React.FC<{ profile: RopeArtistData; onClose: () => void }> = ({ profile, onClose }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city);
  const [specialties, setSpecialties] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [maxBookingDaysAhead, setMaxBookingDaysAhead] = useState(profile.maxBookingDaysAhead);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => ropeArtistApi.updateMyProfile({
      displayName, bio, city,
      specialties: specialties || undefined,
      experienceYears: experienceYears || undefined,
      maxBookingDaysAhead,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ropeArtists'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">编辑资料</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">显示名称</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">城市</label>
            <input value={city} onChange={e => setCity(e.target.value)} maxLength={100}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">简介</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={2000}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">擅长风格</label>
            <input value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="如：日式/欧式/悬吊..." maxLength={500}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">经验年数</label>
            <input type="number" min={0} max={50} value={experienceYears} onChange={e => setExperienceYears(Number(e.target.value))}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">最大预约天数</label>
            <input type="number" min={1} max={90} value={maxBookingDaysAhead} onChange={e => setMaxBookingDaysAhead(Number(e.target.value))}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
            className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />} 保存
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Price List Editor ====================

const PriceListEditor: React.FC<{
  existing?: PriceListItem;
  onSave: (data: CreatePriceListRequest) => Promise<void>;
  onClose: () => void;
}> = ({ existing, onSave, onClose }) => {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing?.priceText ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(existing?.images ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('images', f));
      const result = await ropeArtistApi.uploadImages(formData);
      setImageUrls(prev => [...prev, ...result.imageUrls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '图片上传失败');
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ title, description, priceText: price, imageUrls });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">{existing ? '编辑价目' : '新建价目'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">标题 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">描述 *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={2000}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">价格 *</label>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="如：200-500/小时" maxLength={100}
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">图片</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer">
                {uploading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <Plus size={16} className="text-gray-400" />}
                <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleSave} disabled={!title.trim() || !description.trim() || !price.trim() || saving}
            className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} 保存
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Dashboard (approved artist) ====================

const ArtistDashboard: React.FC<{ profile: RopeArtistData; onBack: () => void }> = ({ profile, onBack }) => {
  const [tab, setTab] = useState<'portfolio' | 'pricing' | 'bookings' | 'calendar'>('bookings');
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceListItem | null>(null);
  const [showNewPriceList, setShowNewPriceList] = useState(false);
  const [busyDateInput, setBusyDateInput] = useState('');
  const queryClient = useQueryClient();

  const togglePauseMutation = useMutation({
    mutationFn: () => ropeArtistApi.togglePause(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const { data: portfolio } = useQuery({
    queryKey: ['ropeArtists', 'myPortfolio'],
    queryFn: () => ropeArtistApi.getPortfolio(),
    enabled: tab === 'portfolio',
  });

  const { data: bookings } = useQuery({
    queryKey: ['ropeArtists', 'artistBookings'],
    queryFn: () => ropeArtistApi.getArtistBookings(),
    enabled: tab === 'bookings',
  });

  const { data: availability } = useQuery({
    queryKey: ['ropeArtists', 'availability', profile.id],
    queryFn: () => ropeArtistApi.getAvailability(profile.id),
    enabled: tab === 'calendar',
  });

  // Portfolio mutations
  const addPortfolioMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('images', f));
      const result = await ropeArtistApi.uploadImages(formData);
      for (const url of result.imageUrls) {
        await ropeArtistApi.addPortfolioImage(url);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists', 'myPortfolio'] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : '图片上传失败'),
  });

  const removePortfolioMutation = useMutation({
    mutationFn: (id: number) => ropeArtistApi.removePortfolioImage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists', 'myPortfolio'] }),
  });

  // Price list mutations
  const createPriceListMutation = useMutation({
    mutationFn: (data: CreatePriceListRequest) => ropeArtistApi.createPriceList(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const updatePriceListMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePriceListRequest }) => ropeArtistApi.updatePriceList(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const deletePriceListMutation = useMutation({
    mutationFn: (id: number) => ropeArtistApi.deletePriceList(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  // Booking mutations
  const confirmBookingMutation = useMutation({
    mutationFn: (id: number) => ropeArtistApi.confirmBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const rejectBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => ropeArtistApi.rejectBooking(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const completeBookingMutation = useMutation({
    mutationFn: (id: number) => ropeArtistApi.completeBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  // Busy date mutations
  const addBusyDateMutation = useMutation({
    mutationFn: (date: string) => ropeArtistApi.setBusyDates({ dates: [date] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  const removeBusyDateMutation = useMutation({
    mutationFn: (date: string) => ropeArtistApi.removeBusyDates({ dates: [date] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] }),
  });

  // Fetch detail for price lists
  const { data: detail } = useQuery({
    queryKey: ['ropeArtists', 'detail', profile.id],
    queryFn: () => ropeArtistApi.getArtistDetail(profile.id),
    enabled: tab === 'pricing',
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待确认', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    CONFIRMED: { label: '已确认', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    REVIEWED: { label: '已评价', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    CANCELLED_BY_CLIENT: { label: '客户取消', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1"><ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" /></button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">我的绳艺屋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProfileEditor(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <Edit3 size={18} className="text-gray-500" />
            </button>
            <button
              onClick={() => togglePauseMutation.mutate()}
              disabled={togglePauseMutation.isPending}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                profile.isPaused
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              }`}
            >
              {profile.isPaused ? <><Play size={12} className="inline mr-1" />恢复营业</> : <><Pause size={12} className="inline mr-1" />暂停营业</>}
            </button>
          </div>
        </div>

        {/* Profile summary */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1"><MapPin size={12} />{profile.city}</span>
          <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500" />{profile.averageRating.toFixed(1)} ({profile.reviewCount})</span>
          <span>{profile.totalBookings} 单</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['bookings', 'portfolio', 'pricing', 'calendar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                tab === t ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {t === 'bookings' ? '预约' : t === 'portfolio' ? '作品' : t === 'pricing' ? '价目' : '日历'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Bookings tab */}
        {tab === 'bookings' && (
          <div className="space-y-3">
            {!bookings?.length ? (
              <p className="text-center text-gray-400 py-12">暂无预约</p>
            ) : (
              bookings.map(b => {
                const st = statusLabels[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{b.clientName}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-500">{b.priceListTitle}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Calendar size={14} /> {b.bookingDate}</p>
                    {b.note && <p className="text-xs text-gray-400 mt-1">备注: {b.note}</p>}

                    <div className="flex gap-2 mt-3">
                      {b.status === 'PENDING' && (
                        <>
                          <button onClick={() => confirmBookingMutation.mutate(b.id)} disabled={confirmBookingMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white flex items-center gap-1">
                            <Check size={12} /> 确认
                          </button>
                          <button onClick={() => {
                            const reason = prompt('拒绝原因（可选）');
                            if (reason !== null) rejectBookingMutation.mutate({ id: b.id, reason });
                          }} disabled={rejectBookingMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                            拒绝
                          </button>
                        </>
                      )}
                      {b.status === 'CONFIRMED' && (
                        <button onClick={() => completeBookingMutation.mutate(b.id)} disabled={completeBookingMutation.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white flex items-center gap-1">
                          <Check size={12} /> 标记完成
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Portfolio tab */}
        {tab === 'portfolio' && (
          <div>
            <div className="flex justify-end mb-3">
              <label className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg cursor-pointer flex items-center gap-1">
                <Upload size={14} /> 上传作品
                <input type="file" accept="image/*" multiple
                  onChange={e => e.target.files && addPortfolioMutation.mutate(e.target.files)}
                  className="hidden" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {portfolio?.map(img => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img src={img.imageUrl} alt={img.caption} className="w-full h-full object-cover" />
                  <button onClick={() => removePortfolioMutation.mutate(img.id)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {addPortfolioMutation.isPending && (
                <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {!portfolio?.length && !addPortfolioMutation.isPending && (
              <p className="text-center text-gray-400 py-12">暂无作品，点击上方上传</p>
            )}
          </div>
        )}

        {/* Pricing tab */}
        {tab === 'pricing' && (
          <div className="space-y-3">
            <button onClick={() => setShowNewPriceList(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-sm flex items-center justify-center gap-2 hover:border-purple-400">
              <Plus size={16} /> 添加价目
            </button>
            {detail?.priceLists.map(pl => (
              <div key={pl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{pl.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{pl.description}</p>
                    <p className="text-sm font-bold text-purple-600 mt-1">{pl.priceText}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingPriceList(pl)} className="p-1.5 text-gray-400 hover:text-purple-500">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => {
                      if (confirm('确定删除此价目？')) deletePriceListMutation.mutate(pl.id);
                    }} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {pl.images.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {pl.images.map((url, i) => (
                      <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Calendar tab */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input type="date" value={busyDateInput} onChange={e => setBusyDateInput(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              <button
                onClick={() => { if (busyDateInput) { addBusyDateMutation.mutate(busyDateInput); setBusyDateInput(''); } }}
                disabled={!busyDateInput || addBusyDateMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white disabled:opacity-50"
              >
                标记忙碌
              </button>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">已标记的忙碌日期</h4>
              {!availability?.busyDates.length ? (
                <p className="text-sm text-gray-400">无忙碌日期</p>
              ) : (
                availability.busyDates.map(d => (
                  <div key={d.date} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{d.date} {d.reason && `- ${d.reason}`}</span>
                    <button onClick={() => removeBusyDateMutation.mutate(d.date)} className="p-1 text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showProfileEditor && <ProfileEditor profile={profile} onClose={() => setShowProfileEditor(false)} />}
      {showNewPriceList && (
        <PriceListEditor
          onSave={async (data) => { await createPriceListMutation.mutateAsync(data); }}
          onClose={() => setShowNewPriceList(false)}
        />
      )}
      {editingPriceList && (
        <PriceListEditor
          existing={editingPriceList}
          onSave={async (data) => { await updatePriceListMutation.mutateAsync({ id: editingPriceList.id, data }); }}
          onClose={() => setEditingPriceList(null)}
        />
      )}
    </div>
  );
};

// ==================== Main Management Page ====================

const RopeArtistManagePage: React.FC<RopeArtistManagePageProps> = ({ onBack }) => {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['ropeArtists', 'myProfile'],
    queryFn: () => ropeArtistApi.getMyProfile(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  // No profile — show apply form
  if (error || !profile) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1"><ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" /></button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">申请成为绳艺师</h1>
        </div>
        <ApplyForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['ropeArtists'] })} />
      </div>
    );
  }

  // Pending / Rejected status
  if (profile.status === 'PENDING') {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1"><ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" /></button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">申请审核中</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Clock size={48} className="text-yellow-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">申请审核中</h2>
          <p className="text-sm text-gray-500">你的绳艺师申请正在审核中，请耐心等待管理员审批。</p>
        </div>
      </div>
    );
  }

  if (profile.status === 'REJECTED') {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1"><ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" /></button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">申请未通过</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">申请未通过</h2>
          {profile.rejectionReason && (
            <p className="text-sm text-gray-500 mb-4">原因: {profile.rejectionReason}</p>
          )}
          <p className="text-sm text-gray-400">你可以修改资料后重新申请。</p>
        </div>
      </div>
    );
  }

  // Approved — show dashboard
  return <ArtistDashboard profile={profile} onBack={onBack} />;
};

export default RopeArtistManagePage;
