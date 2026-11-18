import React from 'react';
import { motion } from 'motion/react';
import { formatNumber, getAqiCategory } from '../lib/aqi';
import type { Language } from '../types';

interface AqiGaugeProps {
  aqi: number;
  pm25: number;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
}

export const AqiGauge: React.FC<AqiGaugeProps> = ({
  aqi,
  pm25,
  lang,
  useUrduNumerals,
  liteMode,
}) => {
  const cat = getAqiCategory(aqi);
  const clamped = Math.min(500, Math.max(0, aqi));
  const pct = clamped / 500;

  // 240-degree radial arc
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (240 / 360);
  const filledLength = arcLength * pct;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 220 190"
        className="w-56 h-48 overflow-visible"
        role="img"
        aria-label={`Lahore US AQI ${Math.round(aqi)}, ${cat.labelEn}`}
      >
        {/* Background track arc */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-800"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform="rotate(150 110 110)"
        />
        {/* Active value arc */}
        <motion.circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke={cat.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={liteMode ? { strokeDashoffset: arcLength - filledLength } : { strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - filledLength }}
          transition={liteMode ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          transform="rotate(150 110 110)"
        />
        {/* Center readout */}
        <text
          x="110"
          y="98"
          textAnchor="middle"
          className="fill-slate-900 dark:fill-white font-mono-tabular font-bold"
          style={{ fontSize: '44px' }}
        >
          {formatNumber(aqi, lang, useUrduNumerals)}
        </text>
        <text
          x="110"
          y="122"
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-medium"
          style={{ fontSize: '12px' }}
        >
          US AQI · PM2.5 {formatNumber(pm25, lang, useUrduNumerals, 1)} µg/m³
        </text>
      </svg>

      {/* Accessible category indicator: emoji + color + text label */}
      <div
        className={`-mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-semibold ${cat.bgTint} ${cat.textClass} ${cat.borderClass}`}
      >
        <span aria-hidden="true">{cat.emoji}</span>
        <span>{lang === 'ur' ? cat.labelUr : cat.labelEn}</span>
      </div>
    </div>
  );
};
