import React from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from 'recharts';
import { HelpCircle, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatHourLabel, formatNumber, getAqiCategory } from '../lib/aqi';
import { t } from '../lib/i18n';
import type { Language, RidgeForecastResult } from '../types';

interface ForecastPageProps {
  ridge: RidgeForecastResult | null;
  loading: boolean;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  lastUpdated: number | null;
  onOpenHowItWorks: () => void;
}

export const ForecastPage: React.FC<ForecastPageProps> = ({
  ridge,
  loading,
  lang,
  useUrduNumerals,
  liteMode,
  lastUpdated,
  onOpenHowItWorks,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  if (loading || !ridge) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  const peak = ridge.peakForecast;
  const peakCat = peak ? getAqiCategory(peak.aqi) : null;

  return (
    <div className="space-y-6">
      {/* Header + Honest Verdict */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isUr
                ? 'آن ڈیوائس ML پیشگوئی اور ماڈل رپورٹ کارڈ'
                : 'On-Device ML Forecaster & Model Report Card'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime} ·{' '}
              {isUr
                ? `${ridge.trainedSamples} گھنٹوں پر ٹرین شدہ، ${ridge.holdoutHours} گھنٹے کی جانچ`
                : `Trained in-browser on ${ridge.trainedSamples}h · Tested on held-out ${ridge.holdoutHours}h`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <HelpCircle className="w-4 h-4 text-teal-600" />
            <span>{isUr ? 'یہ ماڈل کیسے کام کرتا ہے؟' : 'How this model works'}</span>
          </button>
        </div>

        {/* Plain-language Verdict */}
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            ridge.beatsPersistence
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          }`}
        >
          {ridge.beatsPersistence ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          )}
          <div>
            <div className="font-semibold">
              {isUr ? ridge.verdictUr : ridge.verdictEn}
            </div>
            <div className="text-xs opacity-85 mt-1">{ridge.camsReferenceNote}</div>
          </div>
        </div>

        {/* Evaluation Table: MAE & RMSE in µg/m³ */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 text-start font-medium">{isUr ? 'ماڈل' : 'Model'}</th>
                <th className="py-2 text-end font-medium">MAE (µg/m³)</th>
                <th className="py-2 text-end font-medium">RMSE (µg/m³)</th>
                <th className="py-2 text-end font-medium">{isUr ? 'نوٹ' : 'Evaluation Method'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              <tr className="font-semibold text-slate-900 dark:text-white">
                <td className="py-3">
                  {isUr ? 'رج ریگریشن (ہمارا آن ڈیوائس ML)' : 'On-Device Ridge Regression'}
                </td>
                <td className="py-3 text-end font-mono-tabular">
                  {formatNumber(ridge.ridgeMetrics.mae, lang, useUrduNumerals, 1)}
                </td>
                <td className="py-3 text-end font-mono-tabular">
                  {formatNumber(ridge.ridgeMetrics.rmse, lang, useUrduNumerals, 1)}
                </td>
                <td className="py-3 text-end text-xs text-slate-500 dark:text-slate-400">
                  {isUr ? '48 گھنٹے پر 24h ریکرسیو رول آؤٹ' : '24h recursive rollout on 48h holdout'}
                </td>
              </tr>
              <tr>
                <td className="py-3 text-slate-700 dark:text-slate-300">
                  {isUr ? 'پرسسٹنس بیس لائن (گزشتہ 24 گھنٹے)' : '24h Persistence Baseline'}
                </td>
                <td className="py-3 text-end font-mono-tabular text-slate-700 dark:text-slate-300">
                  {formatNumber(ridge.persistenceMetrics.mae, lang, useUrduNumerals, 1)}
                </td>
                <td className="py-3 text-end font-mono-tabular text-slate-700 dark:text-slate-300">
                  {formatNumber(ridge.persistenceMetrics.rmse, lang, useUrduNumerals, 1)}
                </td>
                <td className="py-3 text-end text-xs text-slate-500 dark:text-slate-400">
                  {isUr ? 'کل کا یہی وقت' : 'Same hour yesterday (t - 24h)'}
                </td>
              </tr>
              <tr>
                <td className="py-3 text-slate-700 dark:text-slate-300">
                  {isUr ? 'Open-Meteo / CAMS ماڈل' : 'Open-Meteo / CAMS Atmospheric'}
                </td>
                <td className="py-3 text-end font-mono-tabular text-slate-500">Ref</td>
                <td className="py-3 text-end font-mono-tabular text-slate-500">Ref</td>
                <td className="py-3 text-end text-xs text-slate-500 dark:text-slate-400">
                  {isUr ? 'تاریخی ریفرنس سیریز + 72h پیشگوئی' : 'Reference series on archive; plotted live for +72h'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Peak Smog Callout + 48h Validation & 72h Forecast Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isUr
                ? '48 گھنٹے بیک ٹیسٹ اور آئندہ 72 گھنٹے کی پیشگوئی (PM2.5)'
                : '48h Backtest vs Next 72h Forecast (PM2.5 µg/m³)'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isUr
                ? 'پس منظر میں EPA AQI رنگوں کی پٹیاں (سبز تا جامنی) دکھائی گئی ہیں'
                : 'Shaded horizontal bands denote EPA PM2.5 risk zones (Moderate, USG, Unhealthy, Very Unhealthy)'}
            </p>
          </div>

          {peak && peakCat && (
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold ${peakCat.bgTint} ${peakCat.textClass} ${peakCat.borderClass}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>
                {isUr
                  ? `آئندہ 24 گھنٹے میں شدید اسموگ: ${formatHourLabel(peak.time, lang)} (AQI ${formatNumber(peak.aqi, lang, useUrduNumerals)})`
                  : `Peak smog expected at ${formatHourLabel(peak.time, lang)} · AQI ${peak.aqi} (${peak.pm25} µg/m³)`}
              </span>
            </div>
          )}
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ridge.chartSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <ReferenceArea y1={0} y2={35.4} fill="#16A34A" fillOpacity={0.06} />
              <ReferenceArea y1={35.4} y2={55.4} fill="#EA580C" fillOpacity={0.07} />
              <ReferenceArea y1={55.4} y2={150.4} fill="#DC2626" fillOpacity={0.07} />
              <ReferenceArea y1={150.4} y2={300} fill="#7E22CE" fillOpacity={0.08} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={8} />
              <YAxis tick={{ fontSize: 11 }} unit=" µg" width={54} />
              <Tooltip
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
                labelFormatter={(_, payload) => {
                  const pt = payload?.[0]?.payload as { time?: string } | undefined;
                  return pt?.time ? pt.time.replace('T', ' ') : '';
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="actualPm25"
                name={isUr ? 'حقیقی / ریفرنس PM2.5' : 'Actual (CAMS Archive)'}
                stroke="#0B3C5D"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={!liteMode}
              />
              <Line
                type="monotone"
                dataKey="ridgePm25"
                name={isUr ? 'ہمارا Ridge ML' : 'Our Ridge ML'}
                stroke="#0D9488"
                strokeWidth={2.5}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={!liteMode}
              />
              <Line
                type="monotone"
                dataKey="camsPm25"
                name={isUr ? 'CAMS پیشگوئی' : 'Open-Meteo / CAMS Forecast'}
                stroke="#EA580C"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!liteMode}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Feature Weights Transparency */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isUr ? 'ماڈل کے عوامل (Standardized Ridge Weights)' : 'Learned Feature Weights (Standardized)'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isUr
              ? 'یہ دکھاتا ہے کہ ماڈل نے گزشتہ 14 دنوں میں کس موسمی یا آلودگی کے عنصر کو زیادہ اہمیت دی۔'
              : 'Shows how strongly each meteorological & lag feature drives the next-hour PM2.5 prediction.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ridge.featureWeights.map((fw) => (
            <div
              key={fw.name}
              className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{fw.name}</div>
              <div
                className={`text-base font-bold font-mono-tabular mt-1 ${
                  fw.weight >= 0 ? 'text-rose-700 dark:text-rose-300' : 'text-teal-700 dark:text-teal-300'
                }`}
              >
                {fw.weight >= 0 ? `+${fw.weight}` : fw.weight}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
