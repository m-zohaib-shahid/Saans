import React, { useState } from 'react';
import { MapPin, Bell, ArrowRight, Check } from 'lucide-react';
import { PERSONAS } from '../lib/i18n';
import type { Language, PersonaId } from '../types';

interface OnboardingModalProps {
  language: Language;
  persona: PersonaId;
  onSelectLanguage: (lang: Language) => void;
  onSelectPersona: (persona: PersonaId) => void;
  onEnableNotifications: () => Promise<void>;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  language,
  persona,
  onSelectLanguage,
  onSelectPersona,
  onEnableNotifications,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'granted' | 'skipped'>('idle');
  const isUr = language === 'ur';

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('skipped');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGeoStatus('granted'),
      () => setGeoStatus('skipped'),
      { timeout: 6000 }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        dir={isUr ? 'rtl' : 'ltr'}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {isUr ? `مرحلہ ${step} از 3` : `Step ${step} of 3`}
            </p>
            <h2 id="onboarding-title" className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {isUr ? 'سانس (Saans) میں خوش آمدید' : 'Welcome to Saans سانس'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2.5 py-1.5 rounded-lg"
          >
            {isUr ? 'چھوڑ دیں' : 'Skip'}
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isUr
                ? 'اپنی پسندیدہ زبان منتخب کریں۔ آپ کسی بھی وقت اوپر سے زبان بدل سکتے ہیں۔'
                : 'Choose your preferred language. You can switch between English and Urdu anytime.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectLanguage('en')}
                className={`p-4 rounded-xl border text-left transition-colors min-h-[72px] ${
                  language === 'en'
                    ? 'border-[#0B3C5D] bg-[#0B3C5D]/8 dark:border-teal-400 dark:bg-teal-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white">English</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Know before you breathe
                </div>
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('ur')}
                className={`p-4 rounded-xl border text-right font-urdu transition-colors min-h-[72px] ${
                  language === 'ur'
                    ? 'border-[#0B3C5D] bg-[#0B3C5D]/8 dark:border-teal-400 dark:bg-teal-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white">اردو</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  سانس لینے سے پہلے جانیں
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isUr
                ? 'آپ کس حیثیت سے اسموگ سے بچاؤ کے مشورے دیکھنا چاہتے ہیں؟'
                : 'Select your role so Saans tailors live smog verdicts and commute windows for you:'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPersona(p.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors min-h-[48px] ${
                    persona === p.id
                      ? 'border-[#0B3C5D] bg-[#0B3C5D] text-white dark:border-teal-500 dark:bg-teal-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span aria-hidden="true">{p.emoji}</span>
                  <span className="truncate">{isUr ? p.labelUr : p.labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isUr
                ? 'اختیاری: قریبی لاہور زون اور خطرناک AQI الرٹس کے لیے لوکیشن اور نوٹیفکیشن فعال کریں۔'
                : 'Optional: enable location for zone matching and browser alerts when AQI spikes.'}
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={requestLocation}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  {isUr ? 'مقام کی اجازت دیں (اختیاری)' : 'Allow location access (optional)'}
                </span>
                {geoStatus === 'granted' && <Check className="w-4 h-4 text-emerald-600" />}
              </button>
              <button
                type="button"
                onClick={() => void onEnableNotifications()}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                <span className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-teal-600" />
                  {isUr ? 'اسموگ الرٹ نوٹیفکیشن فعال کریں' : 'Enable AQI spike alerts'}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {isUr ? 'پیچھے' : 'Back'}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] transition-colors"
            >
              <span>{isUr ? 'اگلا مرحلہ' : 'Continue'}</span>
              <ArrowRight className={`w-4 h-4 ${isUr ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              <span>{isUr ? 'ڈیش بورڈ کھولیں' : 'Open Dashboard'}</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
