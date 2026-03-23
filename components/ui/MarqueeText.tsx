import React, { useRef, useEffect, useState } from 'react';

interface MarqueeTextProps {
  children: React.ReactNode;
  className?: string;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (container && text) {
      const overflow = text.scrollWidth - container.clientWidth;
      setScrollAmount(overflow > 0 ? overflow : 0);
    }
  }, [children]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className || ''}`}>
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${scrollAmount > 0 ? 'animate-marquee' : ''}`}
        style={scrollAmount > 0 ? { '--marquee-scroll': `-${scrollAmount}px` } as React.CSSProperties : undefined}
      >
        {children}
      </span>
    </div>
  );
};
