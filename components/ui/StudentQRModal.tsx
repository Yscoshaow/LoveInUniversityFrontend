import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { CometCard } from './comet-card';
import { getCardFaceTheme } from '../../lib/cardFaceThemes';

interface StudentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    studentId: string;
    username: string | null;
    avatar: string;
    cardExpiry: string;
    isPremium: boolean;
  };
  cardFaceThemeKey?: string;
}

export const StudentQRModal: React.FC<StudentQRModalProps> = ({
  isOpen,
  onClose,
  user,
  cardFaceThemeKey,
}) => {
  if (!isOpen) return null;

  const theme = getCardFaceTheme(cardFaceThemeKey);
  const isCustomTheme = theme.key !== 'default';
  const telegramUrl = user.username ? `https://t.me/${user.username}` : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Close Button - Above all other content */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 dark:bg-slate-800/10 flex items-center justify-center text-white hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
      >
        <X size={20} />
      </button>

      {/* QR Card - Rotated 90deg for landscape on mobile */}
      <div className="relative z-10 w-[122vh] max-w-3xl rotate-90 origin-center pointer-events-auto">
        <CometCard rotateDepth={8} translateDepth={14} className="w-full">
          <div className={`w-full aspect-[1.586] rounded-3xl relative overflow-hidden ${isCustomTheme ? theme.cardClassName : ''}`}>
            {/* Card Background */}
            {!isCustomTheme && (
              <>
                <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 z-0"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay"></div>
              </>
            )}

            {/* Watermark */}
            {theme.watermark && (
              <div className="absolute top-4 right-6 text-[120px] font-black text-white/10 leading-none select-none pointer-events-none z-2">
                {theme.watermark}
              </div>
            )}

            {/* Decorative Circles */}
            <div className={`absolute -top-24 -left-24 w-64 h-64 blur-3xl opacity-30 rounded-full ${theme.decorCircle1 || 'bg-primary'}`}></div>
            <div className={`absolute -bottom-24 -right-24 w-64 h-64 blur-3xl opacity-30 rounded-full ${theme.decorCircle2 || 'bg-secondary'}`}></div>

            {/* Card Content */}
            <div className="relative z-10 p-8 h-full flex gap-8 items-center">
              {/* Left: QR Code */}
              <div className="shrink-0">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg">
                  {telegramUrl ? (
                    <QRCodeSVG
                      value={telegramUrl}
                      size={170}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#1e293b"
                    />
                  ) : (
                    <div className="w-[170px] h-[170px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm text-center">
                      No username<br />available
                    </div>
                  )}
                </div>
                {telegramUrl && (
                  <p className="text-center text-white/50 text-xs mt-3">
                    Scan to add friend
                  </p>
                )}
              </div>

              {/* Right: User Info */}
              <div className="flex-1 text-white min-w-0">
                {/* Avatar & Name */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-18 h-18 rounded-xl overflow-hidden border-2 border-white/20 shrink-0">
                    <img src={user.avatar} className="w-full h-full object-cover" alt="Avatar" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xl leading-tight truncate">{user.name}</h3>
                    {user.username && (
                      <p className="text-white/60 text-base truncate">@{user.username}</p>
                    )}
                  </div>
                </div>

                {/* Student ID */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wide">Student ID</p>
                    <p className="font-mono text-xl tracking-wider">{user.studentId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wide">Since</p>
                    <p className="font-bold text-lg">{user.cardExpiry}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>
          </div>
        </CometCard>
      </div>
    </div>
  );
};
