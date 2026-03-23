import React, { useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useUserDisplayName, useUserAvatar } from '../../lib/auth-context';
import { userProfileApi } from '../../lib/api';
import { TypewriterEffectSmooth } from './typewriter-effect';
import { StatusEditSheet } from './StatusEditSheet';
import { GuestbookSection } from '../profile/GuestbookSection';
import { X } from 'lucide-react';

// 根据时间段的问候语
const greetingsByTimeOfDay = {
  morning: [
    '早上好！新的一天开始啦 ☀️',
    '早安！今天也要加油哦 💪',
    '美好的早晨，元气满满！',
    '早上好！愿你今天顺利 ✨',
    '新的一天，新的开始！',
    '早安！今天会是美好的一天',
  ],
  afternoon: [
    '下午好！继续保持状态 💪',
    '午安！别忘了休息一下',
    '下午好！加油，你很棒！',
    '午后时光，效率满满 ☕',
    '下午好！坚持就是胜利',
    '继续加油，你可以的！',
  ],
  evening: [
    '傍晚好！辛苦了一天 🌅',
    '晚上好！今天过得怎么样？',
    '傍晚好！放松一下吧',
    '晚上好！记得照顾好自己',
    '傍晚时分，适合放松 🍵',
    '晚上好！今天也很棒哦',
  ],
  night: [
    '夜深了，早点休息哦 🌙',
    '晚安！明天又是新的一天',
    '夜已深，别太累了 💤',
    '晚安！好好休息吧',
    '夜深了，照顾好自己 🌟',
    '晚安！做个好梦',
  ],
};

// 获取当前时间段
const getTimeOfDay = (): keyof typeof greetingsByTimeOfDay => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

// 随机选择问候语
const getRandomGreeting = (): string => {
  const timeOfDay = getTimeOfDay();
  const greetings = greetingsByTimeOfDay[timeOfDay];
  const randomIndex = Math.floor(Math.random() * greetings.length);
  return greetings[randomIndex];
};

// 将问候语转换为 TypewriterEffectSmooth 的 words 格式
const greetingToWords = (greeting: string): { text: string; className?: string }[] => {
  // 分割成单词，保留emoji
  return greeting.split(' ').map(word => ({ text: word }));
};

interface ProfileHeaderProps {
  subtitle?: string;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  subtitle,
}) => {
  // 使用 useMemo 确保每次组件挂载时生成一个随机问候语，但不会在每次渲染时变化
  const dynamicGreeting = useMemo(() => getRandomGreeting(), []);
  const greetingWords = useMemo(() => greetingToWords(subtitle || dynamicGreeting), [subtitle, dynamicGreeting]);
  const { isLoading, user } = useAuth();
  const displayName = useUserDisplayName();
  const avatarUrl = useUserAvatar();
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showGuestbook, setShowGuestbook] = useState(false);

  // 长按检测
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handlePointerDown = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowGuestbook(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current) {
      setShowStatusSheet(true);
    }
  }, []);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // 获取状态图片URL
  const statusImageUrl = useMemo(() => {
    if (!user?.statusImageKey) return null;
    // 使用 public bucket CDN URL 模式
    const apiBase = import.meta.env.VITE_API_URL || 'https://university.lovein.fun/api/v1';
    const cdnBase = import.meta.env.VITE_CDN_URL;
    if (cdnBase) return `${cdnBase}/${user.statusImageKey}`;
    // fallback: 通过后端获取，但这里直接用 key 构造 URL
    return null;
  }, [user?.statusImageKey]);

  return (
    <>
      <div className="flex justify-between items-center mb-6 pt-2">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <>
              <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
              <div className="h-4 w-24 bg-slate-100 dark:bg-slate-700 rounded mt-1 animate-pulse"></div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{displayName}</h1>
              <TypewriterEffectSmooth
                words={greetingWords}
                className="my-0! text-slate-400!"
                cursorClassName="h-3! bg-slate-300!"
              />
              {user?.statusText && (
                <button
                  onClick={() => setShowStatusSheet(true)}
                  className="mt-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium truncate max-w-[200px] hover:bg-primary/20 transition-colors"
                >
                  {user.statusText}
                </button>
              )}
            </>
          )}
        </div>
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          onContextMenu={e => e.preventDefault()}
          className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-200 dark:bg-slate-700 shrink-0 active:scale-95 transition-transform relative"
        >
          {isLoading ? (
            <div className="w-full h-full animate-pulse"></div>
          ) : (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          )}
        </button>
      </div>

      <StatusEditSheet
        isOpen={showStatusSheet}
        onClose={() => setShowStatusSheet(false)}
        currentStatusText={user?.statusText}
        currentStatusImageKey={user?.statusImageKey}
        currentStatusImageUrl={statusImageUrl}
      />

      {showGuestbook && user && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowGuestbook(false)}>
          <div
            className="w-full sm:max-w-md max-h-[80vh] bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl overflow-y-auto animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-5 pt-5 pb-2 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">我的留言板</h3>
              <button onClick={() => setShowGuestbook(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="px-5 pb-8 sm:pb-5">
              <GuestbookSection profileUserId={user.id} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
