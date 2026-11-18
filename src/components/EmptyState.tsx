import React from 'react';
import type { Language } from '../types';

interface EmptyStateProps {
  titleEn: string;
  titleUr: string;
  descEn: string;
  descUr: string;
  lang: Language;
  actionLabelEn?: string;
  actionLabelUr?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  titleEn,
  titleUr,
  descEn,
  descUr,
  lang,
  actionLabelEn,
  actionLabelUr,
  onAction,
}) => {
  const isUr = lang === 'ur';

  return (
    <div className="py-10 px-4 flex flex-col items-center justify-center text-center space-y-3">
      <svg
        viewBox="0 0 120 90"
        className="w-28 h-20 text-slate-300 dark:text-slate-700"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="60" cy="45" r="34" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
        <path
          d="M36 48C44 48 49 36 58 36C67 36 70 54 79 54C84 54 88 48 92 48"
          stroke="#0D9488"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="84" cy="28" r="5" fill="#14B8A6" fillOpacity="0.4" />
      </svg>

      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
        {isUr ? titleUr : titleEn}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
        {isUr ? descUr : descEn}
      </p>

      {onAction && actionLabelEn && actionLabelUr && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-4 py-2 rounded-xl bg-[#0B3C5D] text-white text-xs font-medium hover:bg-[#092f4a] active:scale-[0.98] transition-transform"
        >
          {isUr ? actionLabelUr : actionLabelEn}
        </button>
      )}
    </div>
  );
};
