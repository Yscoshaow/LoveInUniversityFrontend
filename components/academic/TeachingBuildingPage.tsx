import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { userProfileApi } from '@/lib/api';
import { useUserSettings } from '@/hooks/useUser';
import { ALL_SHORTCUT_ITEMS, DEFAULT_HOMEPAGE_SHORTCUTS } from '../features/Dashboard';
import {
  ChevronLeft,
  Building2,
  Mic,
  Heart,
  Dice5,
  Skull,
  ChevronRight,
  Lock,
  Palette,
  Film,
  Video,
  Music,
  Trophy,
  Swords,
  Bot,
  Ribbon,
  Settings,
  X,
  Check,
  BookOpen,
  PartyPopper,
  Footprints,
  Loader2,
} from 'lucide-react';

interface TeachingBuildingPageProps {
  onBack: () => void;
  onNavigateToRoom: (room: 'voice-chat' | 'therapy-room' | 'roulette-room' | 'punishment-room' | 'art-gallery' | 'cinema' | 'live-stream' | 'music-room' | 'auditorium' | 'liars-tavern' | 'alumni-chat' | 'rope-art' | 'library' | 'activity-center' | 'campus-walk') => void;
}

interface RoomCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isAvailable: boolean;
  onClick: () => void;
  gradient: string;
}

const RoomCard: React.FC<RoomCardProps> = ({
  icon,
  title,
  description,
  isAvailable,
  onClick,
  gradient,
}) => (
  <button
    onClick={onClick}
    disabled={!isAvailable}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      isAvailable
        ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 active:scale-[0.98] hover:shadow-md'
        : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 opacity-60 cursor-not-allowed'
    }`}
  >
    <div className={`w-14 h-14 rounded-xl ${gradient} flex items-center justify-center text-white shadow-lg`}>
      {icon}
    </div>
    <div className="flex-1 text-left">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    {isAvailable ? (
      <ChevronRight size={20} className="text-slate-400 dark:text-slate-500" />
    ) : (
      <Lock size={18} className="text-slate-400 dark:text-slate-500" />
    )}
  </button>
);

// 所有房间/功能定义
const ALL_ROOMS = [
  { id: 'library', icon: <BookOpen size={28} />, title: '图书馆', description: '课程学习与学分管理', gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
  { id: 'activity-center', icon: <PartyPopper size={28} />, title: '活动中心', description: '校园活动与社团', gradient: 'bg-gradient-to-br from-rose-500 to-pink-600' },
  { id: 'campus-walk', icon: <Footprints size={28} />, title: '漫步校园', description: '校园社交与动态', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 'voice-chat', icon: <Mic size={28} />, title: '语音聊天房', description: '匿名匹配，倾听与倾诉', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  { id: 'therapy-room', icon: <Heart size={28} />, title: '理疗房', description: '连接郊狼设备，远程控制', gradient: 'bg-gradient-to-br from-pink-500 to-rose-500' },
  { id: 'roulette-room', icon: <Dice5 size={28} />, title: '游戏室', description: '创建和游玩轮盘赌游戏', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 'liars-tavern', icon: <Swords size={28} />, title: '骗子酒馆', description: '4人欺骗纸牌对战，赢取奖励', gradient: 'bg-gradient-to-br from-amber-700 to-stone-900' },
  { id: 'punishment-room', icon: <Skull size={28} />, title: '惩罚室', description: '违反校规者在此接受惩罚', gradient: 'bg-gradient-to-br from-slate-700 to-slate-900' },
  { id: 'art-gallery', icon: <Palette size={28} />, title: '美术馆', description: '欣赏和分享精美写真作品', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600' },
  { id: 'cinema', icon: <Film size={28} />, title: '电影院', description: '上传和观看精彩视频', gradient: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  { id: 'live-stream', icon: <Video size={28} />, title: '直播间', description: '开播或观看校园直播', gradient: 'bg-gradient-to-br from-red-500 to-pink-600' },
  { id: 'music-room', icon: <Music size={28} />, title: '音乐室', description: '聆听和收藏音声作品', gradient: 'bg-gradient-to-br from-purple-500 to-indigo-600' },
  { id: 'auditorium', icon: <Trophy size={28} />, title: '礼堂', description: '学分排行榜', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  { id: 'rope-art', icon: <Ribbon size={28} />, title: '绳艺室', description: '绳艺师作品展示与预约', gradient: 'bg-gradient-to-br from-rose-500 to-pink-600' },
  { id: 'alumni-chat', icon: <Bot size={28} />, title: '校友聊天', description: '与 AI 角色卡聊天互动', gradient: 'bg-gradient-to-br from-fuchsia-500 to-purple-600', adminOnly: true },
];

// Icon map for edit mode
const ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen size={22} />, PartyPopper: <PartyPopper size={22} />, Footprints: <Footprints size={22} />,
  Mic: <Mic size={22} />, Heart: <Heart size={22} />, Dice5: <Dice5 size={22} />, Swords: <Swords size={22} />,
  Skull: <Skull size={22} />, Palette: <Palette size={22} />, Film: <Film size={22} />, Video: <Video size={22} />,
  Music: <Music size={22} />, Trophy: <Trophy size={22} />, Ribbon: <Ribbon size={22} />,
};

export const TeachingBuildingPage: React.FC<TeachingBuildingPageProps> = ({
  onBack,
  onNavigateToRoom,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const queryClient = useQueryClient();

  const { data: settings } = useUserSettings();
  const currentShortcuts = settings?.homepageShortcuts?.length
    ? settings.homepageShortcuts
    : DEFAULT_HOMEPAGE_SHORTCUTS;

  const [editMode, setEditMode] = useState(false);
  const [editShortcuts, setEditShortcuts] = useState<string[]>([]);

  useEffect(() => {
    if (editMode) setEditShortcuts([...currentShortcuts]);
  }, [editMode]);

  const saveMutation = useMutation({
    mutationFn: (shortcuts: string[]) =>
      userProfileApi.updateSettings({ homepageShortcuts: shortcuts }),
    onSuccess: (data) => {
      queryClient.setQueryData(['user', 'settings'], data);
      setEditMode(false);
    },
  });

  const toggleShortcut = (id: string) => {
    if (editShortcuts.includes(id)) {
      setEditShortcuts(editShortcuts.filter(s => s !== id));
    } else if (editShortcuts.length < 3) {
      setEditShortcuts([...editShortcuts, id]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white px-4 pt-12 lg:pt-8 pb-6 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-slate-800/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 dark:bg-slate-800/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Edit button */}
        <button
          onClick={() => setEditMode(!editMode)}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
        >
          {editMode ? <X size={24} /> : <Settings size={24} />}
        </button>

        {/* Title */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 dark:bg-slate-800/20 rounded-2xl mb-3">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1">教学楼</h1>
          <p className="text-white/70 text-sm">
            {editMode ? '选择 3 个放到首页快捷方式' : '选择你想进入的房间'}
          </p>
        </div>
      </div>

      {/* Edit Mode Panel */}
      {editMode && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              首页快捷方式（{editShortcuts.length}/3）
            </span>
            <button
              onClick={() => saveMutation.mutate(editShortcuts)}
              disabled={editShortcuts.length !== 3 || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-full disabled:opacity-50 transition-opacity"
            >
              {saveMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              保存
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {ALL_SHORTCUT_ITEMS.map(item => {
              const isSelected = editShortcuts.includes(item.id);
              const canSelect = editShortcuts.length < 3;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleShortcut(item.id)}
                  disabled={!isSelected && !canSelect}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950'
                      : canSelect
                        ? 'border-transparent bg-slate-50 dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-600'
                        : 'border-transparent bg-slate-50 dark:bg-slate-900 opacity-40'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center`}>
                    <span className={item.iconColor}>{ICON_MAP[item.icon]}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight text-center">{item.label}</span>
                  {isSelected && (
                    <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {ALL_ROOMS
            .filter(room => !currentShortcuts.includes(room.id))
            .filter(room => !room.adminOnly || isAdmin)
            .map(room => (
              <RoomCard
                key={room.id}
                icon={room.icon}
                title={room.title}
                description={room.description}
                isAvailable={true}
                onClick={() => onNavigateToRoom(room.id as any)}
                gradient={room.gradient}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default TeachingBuildingPage;
