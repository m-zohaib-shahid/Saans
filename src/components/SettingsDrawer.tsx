import React from 'react';
import { X, Bell, Play, Square, Flame } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { ThemeMode, UserSettings } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdate: (patch: Partial<UserSettings>) => void;
  onRequestNotification: () => Promise<void>;
  demoActive: boolean;
  onToggleDemo: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  settings,
  onUpdate,
  onRequestNotification,
  demoActive,
  onToggleDemo,
}) => {
  if (!open) return null;
  const isUr = settings.language === 'ur';

  const themes: Array<{ id: ThemeMode; labelEn: string; labelUr: string }> = [
    { id: 'light', labelEn: 'Light', labelUr: 'روشن' },
    { id: 'dark', labelEn: 'Dark', labelUr: 'تاریک' },
    { id: 'high-contrast', labelEn: 'High Contrast', labelUr: 'ہائی کنٹراسٹ' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
      <div
        dir={isUr ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="w-full max-w-md h-full overflow-y-auto bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isUr ? 'ترتیبات' : 'Settings & Accessibility'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language & Numerals */}
        <section className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            {isUr ? 'زبان (Language)' : 'Language'}
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => onUpdate({ language: 'en' })}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                settings.language === 'en'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              English (LTR)
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ language: 'ur' })}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors font-urdu ${
                settings.language === 'ur'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              اردو (RTL)
            </button>
          </div>

          {settings.language === 'ur' && (
            <label className="flex items-center justify-between pt-1 cursor-pointer">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                اردو اعداد استعمال کریں (۰۱۲۳)
              </span>
              <input
                type="checkbox"
                checked={settings.useUrduNumerals}
                onChange={(e) => onUpdate({ useUrduNumerals: e.target.checked })}
                className="w-4 h-4 accent-teal-600"
              />
            </label>
          )}
        </section>

        {/* Theme */}
        <section className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            {isUr ? 'ظاہری تھیم' : 'Appearance Theme'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => onUpdate({ theme: th.id })}
                className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors ${
                  settings.theme === th.id
                    ? 'border-[#0B3C5D] bg-[#0B3C5D] text-white dark:border-teal-500 dark:bg-teal-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isUr ? th.labelUr : th.labelEn}
              </button>
            ))}
          </div>
        </section>

        {/* Low-bandwidth Lite Mode */}
        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {isUr ? 'لائٹ موڈ (کم انٹرنیٹ)' : 'Lite Mode (Low Bandwidth)'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'نقشے کے ٹائلز اور اینیمیشن بند کر کے ڈیٹا بچاتا ہے'
                  : 'Disables map tiles & chart animations to save mobile data'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.liteMode}
              onChange={(e) => onUpdate({ liteMode: e.target.checked })}
              className="w-5 h-5 accent-teal-600 shrink-0"
            />
          </label>
        </section>

        {/* AQI Notifications */}
        <section className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-900 dark:text-white">
              {isUr ? 'AQI الرٹ کی حد' : 'AQI Alert Threshold'}
            </label>
            <span className="font-mono-tabular text-sm font-semibold text-teal-700 dark:text-teal-400">
              {settings.alertThresholdAqi}
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={350}
            step={10}
            value={settings.alertThresholdAqi}
            onChange={(e) => onUpdate({ alertThresholdAqi: Number(e.target.value) })}
            className="w-full accent-teal-600"
          />
          <button
            type="button"
            onClick={() => void onRequestNotification()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Bell className="w-4 h-4 text-teal-600" />
            <span>
              {settings.notificationsEnabled
                ? isUr
                  ? 'براؤزر الرٹس فعال ہیں'
                  : 'Browser Alerts Enabled'
                : isUr
                ? 'براؤزر الرٹس فعال کریں'
                : 'Enable Browser AQI Alerts'}
            </span>
          </button>
        </section>

        {/* Optional NASA FIRMS Key */}
        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <label
            htmlFor="firms-key-input"
            className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
          >
            <Flame className="w-4 h-4 text-orange-500" />
            <span>
              {isUr ? 'NASA FIRMS کلید (اختیاری)' : 'NASA FIRMS MAP_KEY (Optional)'}
            </span>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isUr
              ? 'پنجاب میں فصل جلانے کے براہِ راست سیٹلائٹ مقامات دیکھنے کے لیے مفت NASA FIRMS کلید درج کریں۔'
              : 'Enter a free NASA FIRMS MAP_KEY to plot live VIIRS stubble-burning hotspots across Punjab. Stored locally in your browser.'}
          </p>
          <input
            id="firms-key-input"
            type="text"
            value={settings.firmsKey}
            onChange={(e) => onUpdate({ firmsKey: e.target.value })}
            placeholder="e.g. 1a2b3c4d5e..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono-tabular"
          />
        </section>

        {/* Community Hero Name */}
        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <label
            htmlFor="hero-name-input"
            className="block text-sm font-semibold text-slate-900 dark:text-white"
          >
            {isUr ? 'آپ کا نام (کمیونٹی رپورٹس کے لیے)' : 'Display Name (Community Reports)'}
          </label>
          <input
            id="hero-name-input"
            type="text"
            value={settings.heroName}
            onChange={(e) => onUpdate({ heroName: e.target.value })}
            placeholder="Lahore Citizen"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </section>

        {/* PWA Install & Live Pitch Demo Mode */}
        <section className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <PWAInstallButton lang={settings.language} />

          <button
            type="button"
            onClick={() => {
              onToggleDemo();
              onClose();
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
              demoActive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-teal-600/40 text-teal-800 dark:text-teal-300 hover:bg-teal-500/10'
            }`}
          >
            {demoActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>
              {demoActive
                ? isUr
                  ? 'ڈیمو بند کریں'
                  : 'Stop Live Pitch Demo'
                : isUr
                ? 'لائیو پچ ڈیمو چلائیں'
                : 'Run Live Pitch Demo'}
            </span>
          </button>
        </section>
      </div>
    </div>
  );
};
