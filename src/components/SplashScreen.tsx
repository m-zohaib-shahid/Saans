import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Language } from '../types';

interface SplashScreenProps {
  dataReady: boolean;
  liteMode: boolean;
  lang: Language;
  onComplete: () => void;
}

interface Particle {
  id: number;
  leftPct: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  dataReady,
  liteMode,
  lang,
  onComplete,
}) => {
  const prefersReduced = useReducedMotion();
  const minimalMotion = Boolean(prefersReduced || liteMode);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [skippable, setSkippable] = useState(false);
  const [hazeCleared, setHazeCleared] = useState(false);
  const [exiting, setExiting] = useState(false);

  const particles = useMemo<Particle[]>(() => {
    if (minimalMotion) return [];
    return Array.from({ length: 38 }, (_, i) => ({
      id: i,
      leftPct: ((i * 29 + 7) % 96) + 2,
      size: (i % 3) + 2,
      duration: 2.6 + (i % 5) * 0.45,
      delay: (i % 7) * 0.18,
      opacity: 0.16 + (i % 4) * 0.08,
    }));
  }, [minimalMotion]);

  useEffect(() => {
    const start = Date.now();
    const tick = window.setInterval(() => {
      const ms = Date.now() - start;
      setElapsedMs(ms);
      if (ms >= 1500) setSkippable(true);
      if (ms >= 1850) setHazeCleared(true);
      if (ms >= 3400) {
        window.clearInterval(tick);
        setExiting(true);
        window.setTimeout(onComplete, 420);
      }
    }, 60);

    return () => window.clearInterval(tick);
  }, [onComplete]);

  const handleSkip = () => {
    if (!skippable || exiting) return;
    setExiting(true);
    window.setTimeout(onComplete, 320);
  };

  // Live prefetch status synced with actual airData readiness
  let statusText =
    lang === 'ur' ? 'براہِ راست فضائی ڈیٹا سے جڑ رہا ہے…' : 'Connecting to live air data…';
  if (elapsedMs > 900) {
    statusText = lang === 'ur' ? 'لاہور کی ہوا پڑھی جا رہی ہے…' : "Reading Lahore's air…";
  }
  if (elapsedMs > 1900) {
    statusText = lang === 'ur' ? 'AI مشیر تیار ہو رہا ہے…' : 'Warming up AI…';
  }
  if (elapsedMs > 2650 || (dataReady && elapsedMs > 2100)) {
    statusText = lang === 'ur' ? 'تیار ہے' : 'Ready';
  }

  const progressPct = Math.min(100, Math.round((elapsedMs / 3400) * 100));
  const brandLetters = ['S', 'a', 'a', 'n', 's'];

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={skippable ? 'Tap to skip splash screen' : 'Loading Saans'}
      onClick={handleSkip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleSkip();
      }}
      initial={{ opacity: 1, scale: 1 }}
      animate={exiting ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden select-none text-white px-6 py-8 cursor-pointer"
      style={{
        background: hazeCleared
          ? 'linear-gradient(155deg, #092C48 0%, #0E6278 52%, #1D8FB0 100%)'
          : 'linear-gradient(155deg, #061E33 0%, #0B3C5D 55%, #0E7C86 100%)',
        transition: 'background 1.2s ease',
      }}
    >
      {/* Drifting Smog Fog Blobs (fade out to symbolize clearing skies) */}
      {!minimalMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000"
          style={{ opacity: hazeCleared ? 0.08 : 0.85 }}
        >
          <motion.div
            animate={{ x: [-30, 35, -20], y: [-10, 20, -15] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-slate-400/25 blur-3xl"
          />
          <motion.div
            animate={{ x: [25, -40, 20], y: [15, -20, 10] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-500/20 blur-3xl"
          />
          <motion.div
            animate={{ x: [-20, 30, -10], y: [20, -15, 25] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-24 left-1/4 w-96 h-96 rounded-full bg-orange-400/15 blur-3xl"
          />
        </div>
      )}

      {/* Fine Floating PM2.5 Particles */}
      {!minimalMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000"
          style={{ opacity: hazeCleared ? 0.25 : 0.9 }}
        >
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ y: '105vh', opacity: 0 }}
              animate={{ y: '-10vh', opacity: [0, p.opacity, p.opacity, 0] }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute rounded-full bg-teal-100"
              style={{
                left: `${p.leftPct}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Top Spacer */}
      <div className="relative z-10 w-full max-w-md min-h-[24px]" />

      {/* Center Animated Lungs / Wind / Leaf Emblem + Title */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-5 max-w-md">
        <div className="relative flex items-center justify-center w-36 h-36">
          {/* Soft pulsing glow ring */}
          {!minimalMotion && (
            <motion.div
              animate={{ scale: [0.94, 1.08, 0.94], opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full bg-teal-400/20 blur-md border border-teal-300/30"
            />
          )}

          {/* Custom Lungs + Wind + Leaf SVG Logo */}
          <svg
            viewBox="0 0 160 160"
            className="relative w-32 h-32 drop-shadow-lg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="saansTealFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.82" />
              </linearGradient>
            </defs>

            {/* Trachea / Central Stem */}
            <motion.path
              d="M80 24 L80 68 M80 62 C68 62 60 54 48 54 C30 54 22 72 22 94 C22 114 34 126 50 126 C62 126 68 118 68 104 L68 74 M80 62 C92 62 100 54 112 54 C130 54 138 72 138 94 C138 114 126 126 110 126 C98 126 92 118 92 104 L92 74"
              fill={hazeCleared || minimalMotion ? 'url(#saansTealFill)' : 'none'}
              stroke="#E2F8F5"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={minimalMotion ? { pathLength: 1, opacity: 0 } : { pathLength: 0, opacity: 1 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: minimalMotion ? 0.5 : 1.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ transition: 'fill 0.8s ease' }}
            />

            {/* Wind Breath + Leaf Vein Motif */}
            <motion.path
              d="M42 94 C50 86 58 86 64 92 M96 92 C102 86 110 86 118 94 M80 24 C88 18 98 20 100 28 C92 32 84 30 80 24 Z"
              fill="none"
              stroke="#99F6E4"
              strokeWidth="3"
              strokeLinecap="round"
              initial={minimalMotion ? { opacity: 1 } : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: minimalMotion ? 0 : 0.9 }}
            />
          </svg>
        </div>

        {/* Brand Name: Saans + سانس */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1 text-4xl sm:text-5xl font-extrabold tracking-tight font-display">
            {brandLetters.map((ch, idx) => (
              <motion.span
                key={idx}
                initial={minimalMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: minimalMotion ? 0 : 0.6 + idx * 0.08 }}
              >
                {ch}
              </motion.span>
            ))}
          </div>

          <motion.div
            dir="rtl"
            initial={minimalMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: minimalMotion ? 0 : 1.05 }}
            className="text-3xl sm:text-4xl font-bold text-teal-200 font-urdu"
          >
            سانس
          </motion.div>

          <motion.p
            initial={minimalMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: minimalMotion ? 0 : 1.35 }}
            className="text-sm sm:text-base text-teal-100/90 pt-1"
          >
            Know before you breathe · <span className="font-urdu">سانس لینے سے پہلے جانیں</span>
          </motion.p>
        </div>
      </div>

      {/* Bottom Live Prefetch Progress & Hackathon Credit */}
      <div className="relative z-10 w-full max-w-sm space-y-3 text-center">
        <div className="space-y-2">
          <div className="text-xs font-medium text-teal-100">{statusText}</div>
          <div className="h-1 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-teal-300 rounded-full transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <p className="text-[11px] text-teal-100/70">
          Built for CodeBlue Lahore — Hack 4 Clean Air
        </p>
      </div>
    </motion.div>
  );
};
