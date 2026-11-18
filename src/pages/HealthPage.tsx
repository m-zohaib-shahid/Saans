import React, { useMemo } from 'react';
import { HeartPulse, ShieldAlert, Stethoscope, Wind, Activity } from 'lucide-react';
import { formatNumber, pm25ToUsAqi } from '../lib/aqi';
import { t } from '../lib/i18n';
import type { Language, LocationAirSnapshot, RidgeForecastResult } from '../types';

interface HealthPageProps {
  lahore: LocationAirSnapshot | null;
  ridge: RidgeForecastResult | null;
  lang: Language;
  useUrduNumerals: boolean;
  lastUpdated: number | null;
  onOpenSymptomChecker: () => void;
}

export const HealthPage: React.FC<HealthPageProps> = ({
  lahore,
  ridge,
  lang,
  useUrduNumerals,
  lastUpdated,
  onOpenSymptomChecker,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const surgeData = useMemo(() => {
    if (!lahore) return null;
    const nowTime = lahore.current.time;
    const next48 = lahore.hourly
      .filter((h) => h.time >= nowTime && h.pm2_5 !== null)
      .slice(0, 48);
    const avgAqi =
      next48.length > 0
        ? Math.round(
            next48.reduce((s, h) => s + (h.us_aqi ?? pm25ToUsAqi(h.pm2_5 ?? 0)), 0) / next48.length
          )
        : Math.round(lahore.current.us_aqi);

    let level: 'Low' | 'Medium' | 'High' = 'Low';
    let levelUr = 'کم';
    let colorClass = 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 border-emerald-500/30';
    if (avgAqi >= 200) {
      level = 'High';
      levelUr = 'زیادہ';
      colorClass = 'bg-red-500/12 text-red-900 dark:text-red-200 border-red-500/30';
    } else if (avgAqi >= 130) {
      level = 'Medium';
      levelUr = 'درمیانہ';
      colorClass = 'bg-amber-500/12 text-amber-900 dark:text-amber-200 border-amber-500/30';
    }
    return { avgAqi, level, levelUr, colorClass };
  }, [lahore]);

  if (!lahore || !surgeData) {
    return <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />;
  }

  const currentAqi = Math.round(lahore.current.us_aqi);

  const groups = [
    {
      id: 'asthma',
      titleEn: 'Asthma / COPD / Heart Patients',
      titleUr: 'دمہ، سانس اور دل کے مریض',
      threshold: 100,
      adviceEn: 'Keep rescue inhaler ready; avoid outdoor air completely above AQI 150.',
      adviceUr: 'انہیلر ہمیشہ پاس رکھیں؛ AQI 150 سے اوپر باہر نکلنے سے مکمل گریز کریں۔',
    },
    {
      id: 'children',
      titleEn: 'Children & Infants',
      titleUr: 'بچے اور نوزائیدہ',
      threshold: 100,
      adviceEn: 'Developing lungs breathe faster per kg body weight; suspend outdoor play above AQI 125.',
      adviceUr: 'بچوں کے پھیپھڑے حساس ہوتے ہیں؛ AQI 125 سے اوپر بیرونی کھیل بند کر دیں۔',
    },
    {
      id: 'elderly',
      titleEn: 'Elderly (65+)',
      titleUr: 'بزرگ افراد (65+)',
      threshold: 120,
      adviceEn: 'Monitor blood pressure and shortness of breath; prefer midday indoor tasks.',
      adviceUr: 'بلڈ پریشر اور سانس کا خیال رکھیں، صبح اور رات کی دھند میں باہر نہ جائیں۔',
    },
    {
      id: 'pregnant',
      titleEn: 'Pregnant Women',
      titleUr: 'حاملہ خواتین',
      threshold: 100,
      adviceEn: 'Fine PM2.5 crosses into circulation; use N95 outdoors and keep bedroom air filtered.',
      adviceUr: 'باریک ذرات سے بچاؤ کے لیے باہر جاتے وقت N95 ماسک پہنیں اور کمرہ بند رکھیں۔',
    },
  ];

  const bestVentHour =
    ridge && ridge.future24h.length > 0
      ? [...ridge.future24h].sort((a, b) => a.aqi - b.aqi)[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Clinic Respiratory Surge Indicator + Symptom Checker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-teal-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isUr
                    ? 'کلینک انڈیکیٹر: سانس کے مریضوں میں متوقع اضافہ'
                    : 'Clinic View: Expected Respiratory Patient Surge'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 space-y-1.5 ${surgeData.colorClass}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {isUr ? `متوقع دباؤ: ${surgeData.levelUr}` : `Surge Indicator: ${surgeData.level}`}
              </span>
              <span className="font-mono-tabular text-xs font-semibold">
                48h Forecast Avg AQI: {formatNumber(surgeData.avgAqi, lang, useUrduNumerals)}
              </span>
            </div>
            <p className="text-xs opacity-90">
              {isUr
                ? 'یہ اگلے 48 گھنٹوں کے متوقع اوسط AQI پر مبنی ایک عمومی اشاریہ ہے، کوئی طبی پیشگوئی نہیں۔'
                : 'Operational triage indicator derived from the next 48h CAMS average AQI (not a formal medical prediction).'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {isUr
                ? 'کھانسی، گلے میں خراش یا سانس کی تکلیف کے بارے میں فوری رہنمائی حاصل کریں۔'
                : 'Experiencing cough, throat irritation, or wheezing? Use grounded symptom triage.'}
            </div>
            <button
              type="button"
              onClick={onOpenSymptomChecker}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-xs font-medium hover:bg-[#092f4a]"
            >
              <Stethoscope className="w-4 h-4" />
              <span>{isUr ? 'علامات چیکر کھولیں' : 'Open Symptom Checker AI'}</span>
            </button>
          </div>
        </section>

        {/* Indoor Air & N95 Guide */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Wind className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isUr ? 'اندرونی ہوا، پیوریفائر اور N95 گائیڈ' : 'Indoor Air, DIY Filter & N95 Guide'}
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed list-disc list-inside">
            <li>
              {isUr
                ? `کھڑکیاں کھولنے کا بہتر وقت: ${bestVentHour ? bestVentHour.time.slice(11, 16) : 'دوپہر 1-3 بجے'} (صرف 15 منٹ جب باہر AQI کم ہو)۔`
                : `Ventilation: keep windows sealed during morning/night peaks; briefly air rooms near ${
                    bestVentHour ? bestVentHour.time.slice(11, 16) : '13:00–15:00'
                  } (forecast AQI ${bestVentHour?.aqi ?? currentAqi}).`}
            </li>
            <li>
              {isUr
                ? 'کم لاگت DIY فلٹر: ایک عام باکس فین یا پیڈسٹل فین کے پیچھے MERV-13 / HEPA فلٹر ٹیپ سے جوڑ کر کمرے کی ہوا صاف کریں۔'
                : 'Low-cost DIY purifier: tape a MERV-13 or HEPA replacement panel behind a standard box fan to cut indoor PM2.5 significantly.'}
            </li>
            <li>
              {isUr
                ? 'کپڑے کا یا ڈھیلا سرجیکل ماسک PM2.5 کو نہیں روکتا؛ ناک کے اوپر کلپ دبا کر N95/KN95 پہنیں۔'
                : 'Cloth masks do not filter PM2.5. Use a certified N95 / KN95 / FFP2 respirator sealed tightly over the nose bridge.'}
            </li>
          </ul>
        </section>
      </div>

      {/* Vulnerable Group Alerts */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <HeartPulse className="w-5 h-5 text-rose-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isUr ? 'حساس گروپوں کے لیے انتباہات' : 'Vulnerable Group Threshold Alerts'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => {
            const triggered = currentAqi >= g.threshold;
            return (
              <div
                key={g.id}
                className={`p-4 rounded-xl border space-y-1.5 ${
                  triggered
                    ? 'border-rose-500/35 bg-rose-500/8'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {isUr ? g.titleUr : g.titleEn}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-semibold">
                    {triggered && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                    {triggered
                      ? isUr
                        ? `الرٹ (≥${g.threshold})`
                        : `Alert (≥${g.threshold})`
                      : isUr
                      ? 'محفوظ حد میں'
                      : `Below ${g.threshold}`}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {isUr ? g.adviceUr : g.adviceEn}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
