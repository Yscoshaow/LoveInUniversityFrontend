import { useState, useEffect } from 'react';

const SPEED_MAP: Record<string, number> = {
  slow: 80,
  normal: 40,
  fast: 20,
  instant: 0,
};

export default function TypewriterText({
  text,
  speed = 'normal',
  onComplete,
}: {
  text: string;
  speed?: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const ms = SPEED_MAP[speed] ?? 40;

  useEffect(() => {
    if (ms === 0) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, ms);
    return () => clearInterval(interval);
  }, [text, ms]);

  return <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{displayedText}<span className="animate-pulse">|</span></p>;
}
