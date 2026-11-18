import React, { useMemo, useState } from 'react';
import { School, Copy, Share2, Check } from 'lucide-react';
import { evaluateSchoolDecision } from '../lib/exposure';
import { formatNumber } from '../lib/aqi';
import { generateSharePost } from '../services/aiService';
import { t } from '../lib/i18n';
import type {
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
  RidgeForecastResult,
} from '../types';

interface SchoolsPageProps {
  lahore: LocationAirSnapshot | null;
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  lang: Language;
  useUrduNumerals: boolean;
  lastUpdated: number | null;
}

export const SchoolsPage: React.FC<SchoolsPageProps> = ({
  lahore,
  weather,
  ridge,
  lang,
  useUrduNumerals,
  lastUpdated,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const decision = useMemo(() => {
    if (!lahore) return null;
    const currentAqi = Math.round(lahore.current.us_aqi);
    const max24 = ridge?.peakForecast?.aqi ?? currentAqi;
    return evaluateSchoolDecision(currentAqi, max24);
  }, [lahore, ridge]);

  if (!lahore || !decision) {
    return <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />;
  }

  const handleGenerateAdvisory = async () => {
    setGenerating(true);
    try {
      const res = await generateSharePost({
        lahore,
        weather,
        ridge,
        language: 'bilingual',
        kind: 'school',
        decisionSummary: `${decision.labelEn} — ${decision.summaryEn}`,
      });
      setAdvisory(res.post);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!advisory) return;
    await navigator.clipboard.writeText(advisory);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rules = [
    { range: 'AQI < 100', en: 'Open normally', ur: 'معمول کے مطابق کھلا', active: decision.status === 'open' },
    { range: '101 – 150', en: 'Limit outdoor sports', ur: 'بیرونی کھیل محدود', active: decision.status === 'limit_outdoor' },
    { range: '151 – 200', en: 'Indoor only + masks', ur: 'صرف اندر + ماسک لازمی', active: decision.status === 'indoor_masks' },
    { range: '201 – 300', en: 'Recommend closure / online classes', ur: 'آن لائن کلاسز / چھٹی', active: decision.status === 'online_closure' },
    { range: '> 300', en: 'Emergency closure', ur: 'ہنگامی تعطیل', active: decision.status === 'emergency' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <School className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isUr ? 'اسکول اور دفتر فیصلہ انجن' : 'School & Office Decision Engine'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
              </p>
            </div>
          </div>
          <div className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
            Live AQI {formatNumber(decision.currentAqi, lang, useUrduNumerals)} · 24h Max{' '}
            {formatNumber(decision.maxAqi24h, lang, useUrduNumerals)}
          </div>
        </div>

        {/* Main Decision Card */}
        <div className={`rounded-2xl border p-6 space-y-2 ${decision.colorClass}`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {isUr ? 'موجودہ اور 24 گھنٹے کی پیشگوئی کی بنیاد پر فیصلہ' : 'Automated Protocol Decision'}
          </div>
          <h3 className="text-2xl font-bold">
            {isUr ? decision.labelUr : decision.labelEn}
          </h3>
          <p className="text-sm opacity-90">{isUr ? decision.summaryUr : decision.summaryEn}</p>
        </div>

        {/* Threshold Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {rules.map((r) => (
            <div
              key={r.range}
              className={`p-3 rounded-xl border text-xs ${
                r.active
                  ? 'border-[#0B3C5D] bg-[#0B3C5D]/8 dark:border-teal-400 dark:bg-teal-500/15 font-semibold text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="font-mono-tabular font-bold">{r.range}</div>
              <div className="mt-1">{isUr ? r.ur : r.en}</div>
            </div>
          ))}
        </div>

        {/* One-click Parent Advisory Generator */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isUr ? 'والدین کے لیے دو لسانی نوٹس (اردو + انگریزی)' : 'One-Click Parent / Staff Advisory'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'Gemini AI براہِ راست AQI کی بنیاد پر واٹس ایپ نوٹس تیار کرتا ہے'
                  : 'Generates a ready-to-send Urdu + English WhatsApp circular grounded on live numbers'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateAdvisory()}
              disabled={generating}
              className="px-4 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] disabled:opacity-50"
            >
              {generating
                ? isUr
                  ? 'تیار ہو رہا ہے...'
                  : 'Generating...'
                : isUr
                ? 'والدین کا نوٹس بنائیں'
                : 'Generate Parent Advisory (Urdu + English)'}
            </button>
          </div>

          {advisory && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
              <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100 font-sans leading-relaxed">
                {advisory}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (isUr ? 'کاپی ہو گیا' : 'Copied') : isUr ? 'کاپی کریں' : 'Copy'}</span>
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(advisory)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isUr ? 'واٹس ایپ پر بھیجیں' : 'Share on WhatsApp'}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
