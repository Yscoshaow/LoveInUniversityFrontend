import React, { useState, useEffect, useRef } from 'react';

interface WheelSegment {
  type: string;
  value: number;
  color: string;
  label: string;
}

interface FortuneWheelProps {
  segments: WheelSegment[];
  isSpinning: boolean;
  targetRotation?: number;
  onSpinComplete?: () => void;
}

// Default segments - only add/remove time
const DEFAULT_SEGMENTS: WheelSegment[] = [
  { type: 'ADD_TIME', value: 15, color: '#f43f5e', label: '+15分' },
  { type: 'REMOVE_TIME', value: 15, color: '#10b981', label: '-15分' },
  { type: 'ADD_TIME', value: 30, color: '#e11d48', label: '+30分' },
  { type: 'REMOVE_TIME', value: 30, color: '#059669', label: '-30分' },
  { type: 'ADD_TIME', value: 60, color: '#fb7185', label: '+60分' },
  { type: 'REMOVE_TIME', value: 60, color: '#34d399', label: '-60分' }
];

export const FortuneWheel: React.FC<FortuneWheelProps> = ({
  segments,
  isSpinning,
  targetRotation = 0,
  onSpinComplete
}) => {
  const [rotation, setRotation] = useState(0);
  const wheelSegments = segments.length > 0 ? segments : DEFAULT_SEGMENTS;
  const animationRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const baseRotationRef = useRef(0);

  // Spin animation - only trigger when isSpinning changes to true
  useEffect(() => {
    // Only start animation when isSpinning becomes true and we haven't started yet
    if (!isSpinning) {
      hasStartedRef.current = false;
      return;
    }

    if (hasStartedRef.current || targetRotation === 0) {
      return;
    }

    hasStartedRef.current = true;
    const startTime = Date.now();
    const startRotation = baseRotationRef.current;
    const duration = 6000; // 6 seconds for a more dramatic spin
    let animationStopped = false;

    const animate = () => {
      if (animationStopped) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const newRotation = startRotation + targetRotation * eased;

      setRotation(newRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        baseRotationRef.current = newRotation;
        animationRef.current = null;
        onSpinComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      animationStopped = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isSpinning, targetRotation, onSpinComplete]);

  const segmentAngle = 360 / wheelSegments.length;

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Wheel */}
      <div
        className="w-full h-full rounded-full overflow-hidden shadow-xl border-4 border-slate-700"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {wheelSegments.map((segment, i) => {
            const startAngle = i * segmentAngle - 90;
            const endAngle = (i + 1) * segmentAngle - 90;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = 50 + 50 * Math.cos(startRad);
            const y1 = 50 + 50 * Math.sin(startRad);
            const x2 = 50 + 50 * Math.cos(endRad);
            const y2 = 50 + 50 * Math.sin(endRad);

            const largeArc = segmentAngle > 180 ? 1 : 0;

            const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

            // Label position
            const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
            const labelX = 50 + 32 * Math.cos(midAngle);
            const labelY = 50 + 32 * Math.sin(midAngle);
            const textRotation = (startAngle + endAngle) / 2 + 90;

            return (
              <g key={i}>
                <path d={path} fill={segment.color} stroke="#fff" strokeWidth="0.5" />
                <text
                  x={labelX}
                  y={labelY}
                  fill="white"
                  fontSize="6"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation}, ${labelX}, ${labelY})`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}
          {/* Center circle */}
          <circle cx="50" cy="50" r="8" fill="#fb7185" stroke="#e11d48" strokeWidth="2" />
          <circle cx="50" cy="50" r="4" fill="#fda4af" />
        </svg>
      </div>

      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-rose-500 drop-shadow-lg" />
      </div>

      {/* Glow effect when spinning */}
      {isSpinning && (
        <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-r from-pink-500/20 to-purple-500/20" />
      )}
    </div>
  );
};

export default FortuneWheel;
