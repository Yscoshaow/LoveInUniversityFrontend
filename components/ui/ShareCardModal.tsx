import React, { useEffect } from 'react';
import { X, Download, Send, Loader2, Image as ImageIcon } from 'lucide-react';
import { platformShare } from '../../lib/platform-actions';
import { ShareableStudentCard } from './ShareableStudentCard';
import { useCardImage, type CardData } from '../../hooks/useCardImage';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | undefined;
  cardData: CardData;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  userId,
  cardData,
}) => {
  const { imageUrl, isGenerating, avatarDataUrl, cardRef, generateImage, downloadCard } =
    useCardImage(userId);

  // Auto-generate when modal opens or theme changes
  useEffect(() => {
    if (isOpen && userId) {
      generateImage(cardData);
    }
  }, [isOpen, userId, cardData.themeKey]);

  if (!isOpen) return null;

  const handleShare = () => {
    platformShare({
      text: `来看看我的校园主页吧！我是 Lv.${cardData.level}，快来加入我们！`,
      url: window.location.origin,
      inlineQuery: 'card:',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 dark:bg-slate-800/10 flex items-center justify-center text-white hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
      >
        <X size={20} />
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-lg w-full">
        {/* Title */}
        <h2 className="text-white font-bold text-lg">分享我的学生卡</h2>

        {/* Card Preview */}
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl">
          {isGenerating ? (
            <div className="w-full aspect-[5/3] bg-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="text-white/60 animate-spin" />
              <p className="text-white/50 text-sm">正在生成学生卡图片...</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Student Card"
              className="w-full"
              style={{ aspectRatio: '5/3' }}
            />
          ) : (
            <div className="w-full aspect-[5/3] bg-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
              <ImageIcon size={32} className="text-white/40" />
              <p className="text-white/50 text-sm">图片生成失败</p>
              <button
                onClick={() => generateImage(cardData)}
                className="px-4 py-2 bg-white/10 dark:bg-slate-800/10 rounded-xl text-white text-sm hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => downloadCard(cardData)}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-2xl bg-white/10 dark:bg-slate-800/10 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/20 dark:bg-slate-800/20 transition-colors disabled:opacity-50"
          >
            <Download size={18} />
            保存图片
          </button>
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-2xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send size={18} />
            分享到 Telegram
          </button>
        </div>
      </div>

      {/* Hidden card for screenshot capture (opacity:0 keeps it in viewport for html-to-image) */}
      <div style={{ position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        <ShareableStudentCard
          ref={cardRef}
          name={cardData.name}
          avatarDataUrl={avatarDataUrl || cardData.avatarUrl}
          level={cardData.level}
          xp={cardData.xp}
          nextLevelXp={cardData.nextLevelXp}
          major={cardData.major}
          studentId={cardData.studentId}
          joinDate={cardData.joinDate}
          themeKey={cardData.themeKey}
        />
      </div>
    </div>
  );
};
