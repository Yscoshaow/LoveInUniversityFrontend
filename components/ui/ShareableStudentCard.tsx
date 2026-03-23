import React, { forwardRef } from 'react';

interface ShareableStudentCardProps {
  name: string;
  avatarDataUrl: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  major: string;
  studentId: string;
  joinDate: string;
  themeKey?: string;
}

/**
 * Static student card for image capture (html-to-image).
 * - No CometCard 3D wrapper
 * - No interactive elements (QR button)
 * - Pseudo-elements replaced with real DOM
 * - Fixed 600×360 size for consistent capture
 *
 * Sizes are scaled ~1.75x from the profile page card (which renders at ~343px on mobile)
 * so the generated image looks proportionally identical when viewed on screen.
 */
export const ShareableStudentCard = forwardRef<HTMLDivElement, ShareableStudentCardProps>(
  ({ name, avatarDataUrl, level, xp, nextLevelXp, major, studentId, joinDate, themeKey }, ref) => {
    const isAlpha = themeKey === 'alpha';

    // Alpha theme inline styles (replacing CSS class + pseudo-elements)
    const alphaBackground: React.CSSProperties = {
      background: `
        linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 35%, transparent 50%),
        linear-gradient(135deg, #312e81 0%, #581c87 40%, #1e1b4b 70%, #0f172a 100%)
      `,
      border: '1px solid rgba(255, 255, 255, 0.25)',
      boxShadow: '0 0 30px rgba(125, 211, 252, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    };

    // Default theme: slate gradient
    const defaultBackground: React.CSSProperties = {
      background: 'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)',
    };

    return (
      <div
        ref={ref}
        style={{
          width: 600,
          height: 360,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          ...(isAlpha ? alphaBackground : defaultBackground),
        }}
      >
        {/* Noise texture overlay (default theme only) */}
        {!isAlpha && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.08,
              background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 4px 4px',
              zIndex: 0,
            }}
          />
        )}

        {/* Alpha: Holographic sweep (static, positioned at ~40% for a nice captured frame) */}
        {isAlpha && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(
                105deg,
                transparent 20%,
                rgba(167, 139, 250, 0.1) 30%,
                rgba(125, 211, 252, 0.15) 40%,
                rgba(255, 255, 255, 0.2) 50%,
                rgba(125, 211, 252, 0.15) 60%,
                rgba(167, 139, 250, 0.1) 70%,
                transparent 80%
              )`,
              backgroundSize: '200% 100%',
              backgroundPosition: '60% 0',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}

        {/* Alpha: Carbon fibre texture overlay (same-origin from public/, no CORS issues) */}
        {isAlpha && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url("/textures/carbon-fibre.png")',
              backgroundRepeat: 'repeat',
              opacity: 0.15,
              mixBlendMode: 'overlay' as const,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}

        {/* Watermark (alpha only) */}
        {isAlpha && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 16,
              fontSize: 140,
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.1)',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            01
          </div>
        )}

        {/* Decorative Circles */}
        <div
          style={{
            position: 'absolute',
            top: -48,
            right: -48,
            width: 192,
            height: 192,
            borderRadius: '50%',
            filter: 'blur(48px)',
            opacity: 0.3,
            background: isAlpha ? 'rgba(56, 189, 248, 0.2)' : '#6366f1',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -48,
            left: -48,
            width: 192,
            height: 192,
            borderRadius: '50%',
            filter: 'blur(48px)',
            opacity: 0.3,
            background: isAlpha ? 'rgba(168, 85, 247, 0.2)' : '#ec4899',
          }}
        />

        {/* Card Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            padding: 34,
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            height: '100%',
          }}
        >
          {/* Top Row: Logo & Chip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: '2.5px solid rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 10, height: 10, background: 'white', borderRadius: '50%' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
                Campus ID
              </span>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, transform: 'rotate(90deg)' }}>
              <path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />
            </svg>
          </div>

          {/* Main Row: Photo & Details */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 20,
                overflow: 'hidden',
                border: '3px solid rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}
            >
              <img
                src={avatarDataUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                alt="ID"
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8 }}>
                <div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: 0 }}>
                    ID
                  </p>
                  <p style={{ fontFamily: 'monospace', fontSize: 20, letterSpacing: '0.1em', opacity: 0.9, margin: 0 }}>
                    {studentId}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: 0 }}>
                    Since
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, opacity: 0.9, margin: 0 }}>
                    {joinDate}
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code Icon (matches profile page) */}
            <div
              style={{
                background: 'white',
                padding: 10,
                borderRadius: 12,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1" />
                <rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" />
                <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" />
                <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                <path d="M3 12h.01" />
                <path d="M12 3h.01" />
                <path d="M12 16v.01" />
                <path d="M16 12h1" />
                <path d="M21 12v.01" />
                <path d="M12 21v-1" />
              </svg>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '22px 0' }} />

          {/* Level & XP Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 900 }}>LV.{level}</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{major}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                {xp} / {nextLevelXp} XP
              </span>
            </div>

            {/* XP Progress Bar */}
            <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(xp / nextLevelXp) * 100}%`,
                  background: 'linear-gradient(to right, #EE5A7C, #7B6EF6)',
                  borderRadius: 9999,
                }}
              />
            </div>
          </div>
        </div>

        {/* Shine Effect Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top right, transparent, rgba(255,255,255,0.05), transparent)',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }
);

ShareableStudentCard.displayName = 'ShareableStudentCard';
