import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatNumber } from '../lib/aqi';
import type { Language } from '../types';

interface CountUpNumberProps {
  value: number;
  decimals?: number;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode?: boolean;
  durationMs?: number;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  decimals = 0,
  lang,
  useUrduNumerals,
  liteMode = false,
  durationMs = 550,
}) => {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced || liteMode) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const startVal = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + (value - startVal) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs, prefersReduced, liteMode]);

  return <>{formatNumber(display, lang, useUrduNumerals, decimals)}</>;
};
