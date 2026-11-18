import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { Language } from '../types';

export const PWAInstallButton: React.FC<{ lang: Language }> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isUr = lang === 'ur';

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0B3C5D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#092f4a] transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>{isUr ? 'ایپ انسٹال کریں (PWA)' : 'Install Saans App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>{isUr ? 'iPhone پر انسٹال کریں' : 'Install on iPhone / iPad'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isUr ? 'iOS پر انسٹال کا طریقہ' : 'Install on iPhone / iPad'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {isUr
                  ? '1. سفاری میں Share بٹن دبائیں۔ 2. نیچے اسکرول کر کے Add to Home Screen منتخب کریں۔'
                  : '1. Tap the Share button in Safari toolbar. 2. Scroll down and tap Add to Home Screen.'}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 py-2.5 text-sm font-medium text-slate-900 dark:text-white"
              >
                {isUr ? 'بند کریں' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
