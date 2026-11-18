import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Copy, Download, Share2, X, Check } from 'lucide-react';
import { getAqiCategory, calcCigaretteEquivalent, calcWhoMultipliers } from '../lib/aqi';
import type { Language, LocationAirSnapshot } from '../types';

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
  lang: Language;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ open, onClose, lang }) => {
  if (!open) return null;
  const isUr = lang === 'ur';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-works-title"
    >
      <div
        dir={isUr ? 'rtl' : 'ltr'}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 id="how-works-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {isUr ? 'سانس (Saans) کیسے کام کرتا ہے اور حدود' : 'How Saans Works & Honest Limitations'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {isUr ? '1. براہِ راست فضائی اور موسمی ڈیٹا' : '1. Live Atmospheric & Weather Feeds'}
            </h3>
            <p>
              {isUr
                ? 'تمام شہروں اور لاہور کے علاقوں کا ڈیٹا Open-Meteo (Copernicus CAMS ~10 کلومیٹر ماڈل) سے براہِ راست حاصل کیا جاتا ہے۔ مقامی سڑکوں کے سینسر اس سے مختلف ہو سکتے ہیں۔'
                : 'All 7 Pakistani cities and 7 Lahore zones fetch live data directly from Open-Meteo Air Quality (Copernicus CAMS ~10 km grid) and Open-Meteo Weather APIs. Street-level ground monitors may differ locally.'}
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {isUr ? '2. براؤزر میں ٹرین ہونے والا Ridge ML ماڈل' : '2. On-Device Ridge Regression ML Forecaster'}
            </h3>
            <p>
              {isUr
                ? 'آپ کے براؤزر میں گزشتہ 14 دن کے گھنٹہ وار ڈیٹا پر 10 خصوصیات (PM2.5 تاخیر 1h/3h/24h، 6 گھنٹے کی اوسط، درجہ حرارت، نمی، ہوا کی رفتار، باؤنڈری لیئر ہائٹ، اور وقت) کی بنیاد پر ماڈل ٹرین ہوتا ہے۔ آخری 48 گھنٹے ٹیسٹ کے لیے محفوظ رکھے جاتے ہیں۔'
                : 'In your browser (zero backend ML needed), we train an L2-regularized Ridge Regression model on 14 days of hourly Lahore history using 10 features: PM2.5 lags (1h, 3h, 24h), 6h rolling mean, temperature, humidity, wind speed, log(boundary layer height), and sin/cos hour-of-day. The final 48h are held out strictly for honest MAE/RMSE evaluation against 24h persistence.'}
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {isUr ? '3. Gemini AI مشیر اور سائنسی شفافیت' : '3. Grounded Gemini AI & Medical Disclaimer'}
            </h3>
            <p>
              {isUr
                ? 'Gemini کو صرف موجودہ اور پیشگوئی شدہ اعدادوشمار دیے جاتے ہیں تاکہ وہ غلط اعداد ایجاد نہ کرے۔ یہ نظام طبی مشورے کا متبادل نہیں؛ سانس کی شدید تکلیف میں فوری ڈاکٹر سے رجوع کریں۔'
                : 'Every Gemini prompt is strictly grounded with live Open-Meteo and Ridge ML numbers. If the AI service is offline or rate-limited, Saans automatically switches to a deterministic WHO/EPA rule engine. Guidance is informational only and not medical advice.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  postText: string;
  loading: boolean;
  lahore: LocationAirSnapshot | null;
  lang: Language;
  onShared?: () => void;
}

export const ShareCardModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
  postText,
  loading,
  lahore,
  lang,
  onShared,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!open) return null;
  const isUr = lang === 'ur';
  const aqi = Math.round(lahore?.current.us_aqi ?? 0);
  const pm25 = lahore?.current.pm2_5 ?? 0;
  const cat = getAqiCategory(aqi);
  const who = calcWhoMultipliers(pm25);
  const cigs = calcCigaretteEquivalent(pm25);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
    onShared?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `saans-lahore-aqi-${aqi}.png`;
      link.href = dataUrl;
      link.click();
      onShared?.();
    } finally {
      setDownloading(false);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(postText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        dir={isUr ? 'rtl' : 'ltr'}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isUr ? 'شیئر کرنے کے لیے تیار کارڈ' : 'Shareable Smog Update'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branded visual card for PNG export */}
        <div
          ref={cardRef}
          className="rounded-2xl bg-[#0B3C5D] text-white p-6 space-y-4 border border-teal-500/30"
        >
          <div className="flex items-center justify-between text-xs text-teal-200">
            <span className="font-bold text-white text-base">Saans سانس · Lahore</span>
            <span>Open-Meteo / CAMS</span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-5xl font-bold font-mono-tabular">{aqi}</div>
              <div className="text-sm text-teal-100 mt-1">
                {cat.emoji} {isUr ? cat.labelUr : cat.labelEn} · PM2.5 {pm25.toFixed(1)} µg/m³
              </div>
            </div>
            <div className="text-right text-xs text-teal-100 space-y-1 font-mono-tabular">
              <div>{who.vs24h}× WHO 24h</div>
              <div>≈ {cigs} cigs/day</div>
            </div>
          </div>
          <div className="border-t border-white/15 pt-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-100">
            {loading ? (isUr ? 'تیار کیا جا رہا ہے...' : 'Generating grounded update...') : postText}
          </div>
          <div className="text-[11px] text-teal-200/80">
            CodeBlue Lahore · Know before you breathe · AI-generated, not medical advice
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (isUr ? 'کاپی ہو گیا' : 'Copied') : isUr ? 'متن کاپی کریں' : 'Copy Text'}</span>
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShared?.()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Share2 className="w-4 h-4" />
            <span>{isUr ? 'واٹس ایپ پر شیئر کریں' : 'Share via WhatsApp'}</span>
          </a>

          <button
            type="button"
            disabled={loading || downloading}
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a]"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? '...' : isUr ? 'تصویر ڈاؤن لوڈ کریں' : 'Download PNG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
