import React, { useState, useEffect, useMemo } from 'react';
import {
  ScheduleType,
  LockDifficulty,
  UnlockMethod,
  CreateScheduleRequest,
  CreateSelfLockRequest,
} from '../../types';
import {
  ChevronRight,
  Clock,
  Key,
  Users,
  ArrowLeft,
  MapPin,
  Type,
  Camera,
  Eye,
  EyeOff,
  Globe,
  Loader2,
} from 'lucide-react';
import { selfLockApi } from '../../lib/api';
import { TimePickerSheet } from '@/components/ui/mobile-picker';
import { CameraCapture } from '../ui';
import { useCreateSchedule, useCreateLock } from '../../hooks';

// Map categories to ScheduleType
const categories: { id: string; label: string; color: string; type: ScheduleType }[] = [
  { id: '1', label: '会议', color: 'bg-primary', type: 'MEETING' },
  { id: '2', label: '截止日期', color: 'bg-red-500', type: 'DEADLINE' },
  { id: '3', label: '提醒', color: 'bg-amber-500', type: 'REMINDER' },
  { id: '4', label: '活动', color: 'bg-purple-500', type: 'EVENT' },
  { id: '5', label: '其他', color: 'bg-slate-600', type: 'OTHER' },
];

const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];

// Difficulty options
const difficultyOptions: { value: LockDifficulty; label: string; description: string; color: string }[] = [
  { value: 'EASY', label: '简单', description: '2把钥匙，10%惩罚', color: 'text-green-500 dark:text-green-400' },
  { value: 'NORMAL', label: '普通', description: '3把钥匙，30%惩罚', color: 'text-blue-500 dark:text-blue-400' },
  { value: 'HARD', label: '困难', description: '5把钥匙，60%惩罚', color: 'text-orange-500 dark:text-orange-400' },
  { value: 'EXTREME', label: '极限', description: '8把钥匙，100%惩罚', color: 'text-red-500 dark:text-red-400' },
];

// Unlock method options
const unlockMethodOptions: { value: UnlockMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'TIME_ONLY', label: '计时解锁', icon: <Clock size={20} /> },
  { value: 'GUESS_KEY', label: '猜钥匙', icon: <Key size={20} /> },
  { value: 'VOTE', label: '投票解锁', icon: <Users size={20} /> },
];

interface CreateScheduleModalProps {
  isOpen: boolean;
  initialTab?: 'schedule' | 'lock';
  initialDate?: Date;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  initialTab = 'schedule',
  initialDate,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'lock'>('schedule');
  const [error, setError] = useState<string | null>(null);

  // React Query mutations
  const createScheduleMutation = useCreateSchedule();
  const createLockMutation = useCreateLock();

  // Schedule Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedCategory, setSelectedCategory] = useState<string>('1');
  const [description, setDescription] = useState('');

  // Lock Form State
  const [lockDuration, setLockDuration] = useState(25);
  const [difficulty, setDifficulty] = useState<LockDifficulty>('NORMAL');
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>('TIME_ONLY');
  const [hideRemainingTime, setHideRemainingTime] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [voteRequired, setVoteRequired] = useState(5);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Generate next 14 days for date picker
  const dateOptions = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
      // Reset schedule form
      setTitle('');
      setLocation('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('10:00');
      setSelectedCategory('1');
      // Set initial date if provided, otherwise use today
      setSelectedDate(initialDate || new Date());
      // Reset lock form
      setLockDuration(25);
      setDifficulty('NORMAL');
      setUnlockMethod('TIME_ONLY');
      setHideRemainingTime(false);
      setIsPublic(false);
      setVoteRequired(5);
      setSelectedImage(null);
      setImagePreview(null);
      setIsCameraOpen(false);
    }
  }, [isOpen, initialTab, initialDate]);

  // Handle camera capture - original for upload, blurred for preview
  const handleCameraCapture = (originalImage: string, blurredPreview: string) => {
    // Show blurred preview to user
    setImagePreview(blurredPreview);
    // Convert original (unblurred) image to File for upload
    const byteString = atob(originalImage.split(',')[1]);
    const mimeString = originalImage.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8ClampedArray(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], 'reward-image.jpg', { type: mimeString });
    setSelectedImage(file);
  };

  // Clear captured image
  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const isSubmitting = createScheduleMutation.isPending || createLockMutation.isPending;

  const handleSubmit = async () => {
    setError(null);

    try {
      if (activeTab === 'schedule') {
        if (!title.trim()) {
          setError('请输入标题');
          return;
        }

        // Format date using local timezone (NOT UTC)
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        const selectedCat = categories.find(c => c.id === selectedCategory);

        const request: CreateScheduleRequest = {
          title: title.trim(),
          date: formattedDate,
          startTime: startTime + ':00', // Convert to HH:mm:ss
          endTime: endTime ? endTime + ':00' : undefined,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          type: selectedCat?.type || 'OTHER',
        };

        await createScheduleMutation.mutateAsync(request);
        onSuccess?.();
        onClose();
      } else {
        // Create lock
        const request: CreateSelfLockRequest = {
          durationMinutes: lockDuration,
          difficulty,
          unlockMethod,
          hideRemainingTime,
          isPublic,
          voteRequired: unlockMethod === 'VOTE' ? voteRequired : 0,
        };

        const result = await createLockMutation.mutateAsync(request);

        // Upload image if selected
        if (selectedImage && result.lock.id) {
          try {
            await selfLockApi.uploadLockImage(result.lock.id, selectedImage);
          } catch (imgError) {
            console.error('Failed to upload image:', imgError);
            // Continue even if image upload fails
          }
        }

        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  return (
    <div
      className={`
        fixed inset-0 z-50 transition-all duration-500 ease-in-out
        lg:bg-black/50 lg:flex lg:items-center lg:justify-center
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
    <div
      className={`
        w-full h-full bg-white dark:bg-slate-800 flex flex-col transition-transform duration-500 ease-in-out
        lg:max-w-2xl lg:max-h-[90vh] lg:rounded-2xl lg:overflow-hidden lg:shadow-2xl lg:h-auto
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none transition-opacity duration-500 opacity-50">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path
            fill={activeTab === 'schedule' ? '#EE5A7C' : '#7B6EF6'}
            d="M45,-76.3C58.9,-69.3,71.4,-59.1,80.6,-46.7C89.8,-34.3,95.8,-19.7,94.8,-5.5C93.8,8.7,85.8,22.5,76.5,34.8C67.2,47.1,56.6,57.9,44.2,66.3C31.8,74.7,17.6,80.7,3.1,75.4C-11.4,70.1,-26.2,53.5,-39.8,40.8C-53.4,28.1,-65.8,19.3,-72.6,6.3C-79.4,-6.7,-80.6,-23.9,-73.1,-38.3C-65.6,-52.7,-49.4,-64.3,-34.1,-70.5C-18.8,-76.7,-4.4,-77.5,10.1,-77.3"
            transform="translate(100 0) scale(1.4)"
            className="transition-all duration-500"
          />
        </svg>
      </div>

      {/* Header */}
      <div className="pt-8 px-6 pb-2 flex justify-between items-center relative z-20">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="p-2 -ml-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="text-slate-800 dark:text-slate-100 font-bold text-lg">
          {activeTab === 'schedule' ? '创建日程' : '创建时间锁'}
        </div>
        <div className="w-10"></div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-2 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="px-6 relative z-10 flex-1 overflow-y-auto no-scrollbar pt-4">
        {/* Schedule Form */}
        {activeTab === 'schedule' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-8 max-w-[80%] leading-tight">
              轻松设置
              <br />
              你的日程
            </h1>

            {/* Title Input */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">标题</label>
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-secondary/20 transition-all">
                <Type size={20} className="text-slate-400 dark:text-slate-500 mr-3" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：每周团队会议"
                  className="bg-transparent w-full text-slate-800 dark:text-slate-100 font-semibold placeholder:text-slate-400 dark:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Date Selection */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">选择日期</label>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mask-linear-fade">
                {dateOptions.map((date, index) => {
                  const isSelected = isSameDay(date, selectedDate);
                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`
                        flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-2xl cursor-pointer transition-all duration-200 border-2
                        ${
                          isSelected
                            ? 'bg-secondary border-secondary text-white shadow-glow-secondary scale-105'
                            : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      <span className="text-xl font-bold">{date.getDate()}</span>
                      <span className="text-xs font-medium">{daysOfWeek[date.getDay()]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Selection */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">选择时间</label>
              <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4 flex justify-between items-center border-2 border-transparent focus-within:border-secondary/20 transition-all">
                <div className="flex flex-col relative group">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mb-1 pl-1">开始</span>
                  <TimePickerSheet
                    value={startTime}
                    onChange={setStartTime}
                    className="bg-transparent font-bold text-xl text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <ChevronRight className="text-slate-400 dark:text-slate-500" size={20} />
                <div className="flex flex-col items-end relative group">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mb-1 pr-1">结束</span>
                  <TimePickerSheet
                    value={endTime}
                    onChange={setEndTime}
                    className="bg-transparent font-bold text-xl text-slate-800 dark:text-slate-100 focus:outline-none text-right cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Location Input */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">地点</label>
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-secondary/20 transition-all">
                <MapPin size={20} className="text-slate-400 dark:text-slate-500 mr-3" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例如：B会议室"
                  className="bg-transparent w-full text-slate-800 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Category Selection */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">类别</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`
                        flex items-center gap-2 rounded-full px-4 py-2 transition-all border-2
                        ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 border-secondary text-secondary shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }
                      `}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></div>
                      <span className="text-xs font-bold">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-24 bg-slate-100 dark:bg-slate-700 rounded-2xl resize-none focus:outline-none p-4 text-sm text-slate-700 dark:text-slate-200 border-2 border-transparent focus:border-secondary/20 transition-all"
                placeholder="添加具体细节、议程或链接..."
              ></textarea>
            </div>
          </div>
        )}

        {/* Self Lock Form */}
        {activeTab === 'lock' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-8 max-w-[90%] leading-tight">
              创建一个
              <br />
              <span className="text-secondary">时间锁</span>
            </h1>

            {/* Duration */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">
                时长（分钟）
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={480}
                  value={lockDuration}
                  onChange={(e) => setLockDuration(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
                <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2 text-center">
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{lockDuration}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">min</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
                <span>5分钟</span>
                <span>8小时</span>
              </div>
            </div>

            {/* Unlock Method */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">解锁方式</label>
              <div className="grid grid-cols-3 gap-3">
                {unlockMethodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setUnlockMethod(option.value)}
                    className={`h-20 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                      unlockMethod === option.value
                        ? 'border-secondary bg-secondary/5 text-secondary'
                        : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {option.icon}
                    <span className="text-[10px] font-bold">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty (only for GUESS_KEY) */}
            {unlockMethod === 'GUESS_KEY' && (
              <div className="mb-6">
                <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">难度</label>
                <div className="grid grid-cols-2 gap-3">
                  {difficultyOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDifficulty(option.value)}
                      className={`p-4 rounded-2xl flex flex-col items-start border-2 transition-all ${
                        difficulty === option.value
                          ? 'border-secondary bg-secondary/5'
                          : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className={`font-bold ${option.color}`}>{option.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vote Required (only for VOTE method) */}
            {unlockMethod === 'VOTE' && (
              <div className="mb-6">
                <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 block">所需投票数</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={voteRequired}
                    onChange={(e) => setVoteRequired(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                  />
                  <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2 text-center">
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{voteRequired}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Options */}
            <div className="mb-6 space-y-3">
              {/* Hide Remaining Time */}
              <button
                onClick={() => setHideRemainingTime(!hideRemainingTime)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${
                  hideRemainingTime
                    ? 'border-secondary bg-secondary/5'
                    : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {hideRemainingTime ? <EyeOff size={20} className="text-secondary" /> : <Eye size={20} className="text-slate-400 dark:text-slate-500" />}
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">隐藏剩余时间</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">神秘模式 - 不知道何时解锁</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${hideRemainingTime ? 'bg-secondary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow mt-0.5 transition-transform ${hideRemainingTime ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {/* Public Lock */}
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${
                  isPublic
                    ? 'border-secondary bg-secondary/5'
                    : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe size={20} className={isPublic ? 'text-secondary' : 'text-slate-400 dark:text-slate-500'} />
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">公开锁</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">其他人可以看到并点赞你的锁</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${isPublic ? 'bg-secondary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow mt-0.5 transition-transform ${isPublic ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>

            {/* Reward Image - Camera Capture */}
            <div className="mb-6">
              <label className="text-slate-600 dark:text-slate-300 font-semibold mb-3 flex justify-between">
                <span>奖励图片</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">可选 - 中心会模糊处理</span>
              </label>
              {imagePreview ? (
                <div className="relative w-full h-40 rounded-3xl overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex-1 py-2 bg-white/90 dark:bg-slate-800/90 rounded-xl text-slate-800 dark:text-slate-100 text-xs font-semibold"
                    >
                      重拍
                    </button>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="flex-1 py-2 bg-red-500/90 rounded-xl text-white text-xs font-semibold"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all bg-slate-50 dark:bg-slate-900"
                >
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center">
                    <Camera size={20} />
                  </div>
                  <span className="text-xs font-medium">拍摄奖励照片</span>
                  <span className="text-[10px] text-slate-300">中心区域将在解锁前保持模糊</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="absolute bottom-6 left-6 right-6 z-30">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full text-white font-bold py-4 rounded-3xl shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
            activeTab === 'schedule'
              ? 'bg-slate-900 shadow-slate-900/30'
              : 'bg-secondary shadow-glow-secondary'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>创建中...</span>
            </>
          ) : (
            <span>{activeTab === 'schedule' ? '创建日程' : '开始锁定'}</span>
          )}
        </button>
      </div>

      {/* Camera Capture Modal - placed outside scrollable area for proper z-index */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        blurRadius={20}
      />
    </div>
    </div>
  );
};
