import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { User as UserIcon } from 'lucide-react';
import { CometCard } from './comet-card';
import { getCardFaceTheme } from '../../lib/cardFaceThemes';

interface StudentCardDisplayProps {
  user: {
    id: number;
    name: string;
    username: string | null;
    avatar: string;
    joinDate: string;
    isPremium: boolean;
  };
  /** If true, clicking the card will NOT open QR modal (for viewing other users) */
  disableQRClick?: boolean;
  /** Callback when card is clicked (for opening QR modal) */
  onCardClick?: () => void;
  /** If true, hide QR code and username (for privacy when viewing other users) */
  hideContactInfo?: boolean;
  /** Card face theme key (e.g. "alpha") */
  cardFaceThemeKey?: string;
}

export const StudentCardDisplay: React.FC<StudentCardDisplayProps> = ({
  user,
  disableQRClick = false,
  onCardClick,
  hideContactInfo = false,
  cardFaceThemeKey,
}) => {
  const theme = getCardFaceTheme(cardFaceThemeKey);
  const isCustomTheme = theme.key !== 'default';
  // Only show telegram info if not hidden by privacy setting
  const showTelegramInfo = !hideContactInfo && user.username;
  const telegramUrl = showTelegramInfo ? `https://t.me/${user.username}` : null;
  const studentId = String(user.id).padStart(6, '0');

  const handleClick = () => {
    if (!disableQRClick && onCardClick) {
      onCardClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={!disableQRClick && onCardClick ? 'cursor-pointer' : ''}
    >
      <CometCard rotateDepth={6} translateDepth={10} className="w-full">
        <div className={`w-full aspect-[1.586] rounded-2xl relative overflow-hidden ${isCustomTheme ? theme.cardClassName : ''}`}>
          {/* Card Background */}
          {!isCustomTheme && (
            <>
              <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 z-0" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay" />
            </>
          )}

          {/* Watermark */}
          {theme.watermark && (
            <div className="absolute top-2 right-4 text-[80px] font-black text-white/10 leading-none select-none pointer-events-none z-2">
              {theme.watermark}
            </div>
          )}

          {/* Decorative Circles */}
          <div className={`absolute -top-16 -left-16 w-48 h-48 blur-3xl opacity-30 rounded-full ${theme.decorCircle1 || 'bg-primary'}`} />
          <div className={`absolute -bottom-16 -right-16 w-48 h-48 blur-3xl opacity-30 rounded-full ${theme.decorCircle2 || 'bg-secondary'}`} />

          {/* Card Content */}
          <div className="relative z-10 p-4 h-full flex gap-4 items-center">
            {/* Left: QR Code or Avatar placeholder (smaller) */}
            <div className="shrink-0">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg">
                {telegramUrl ? (
                  <QRCodeSVG
                    value={telegramUrl}
                    size={80}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#1e293b"
                  />
                ) : hideContactInfo ? (
                  // Show avatar or placeholder when contact info is hidden
                  <div className="w-[80px] h-[80px] flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                    <img src={user.avatar} className="w-full h-full object-cover" alt="Avatar" />
                  </div>
                ) : (
                  <div className="w-[80px] h-[80px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-[10px] text-center">
                    No username
                  </div>
                )}
              </div>
              {!disableQRClick && telegramUrl && (
                <p className="text-center text-white/40 text-[9px] mt-1.5">
                  点击查看大图
                </p>
              )}
              {hideContactInfo && (
                <p className="text-center text-white/30 text-[9px] mt-1.5">
                  隐私保护中
                </p>
              )}
            </div>

            {/* Right: User Info */}
            <div className="flex-1 text-white min-w-0">
              {/* Avatar & Name */}
              <div className="flex items-center gap-3 mb-3">
                {!hideContactInfo && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0">
                    <img src={user.avatar} className="w-full h-full object-cover" alt="Avatar" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-sm leading-tight truncate">{user.name}</h3>
                  {showTelegramInfo && (
                    <p className="text-white/60 text-xs truncate">@{user.username}</p>
                  )}
                </div>
              </div>

              {/* Student ID */}
              <div className="flex gap-4">
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wide">Student ID</p>
                  <p className="font-mono text-sm tracking-wider">{studentId}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wide">Since</p>
                  <p className="font-bold text-xs">{user.joinDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
        </div>
      </CometCard>
    </div>
  );
};
