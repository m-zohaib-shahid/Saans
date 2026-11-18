import React, { useMemo, useState } from 'react';
import { Clock, Bike, ArrowLeftRight, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { formatHourLabel, formatNumber, getAqiCategory, pm25ToUsAqi } from '../lib/aqi';
import { ACTIVITIES, analyze24hExposure, type ActivityType } from '../lib/exposure';
import { t } from '../lib/i18n';
import type { Language, LocationAirSnapshot, RidgeForecastResult } from '../types';

interface PlannerPageProps {
  lahore: LocationAirSnapshot | null;
  zones: LocationAirSnapshot[];
  ridge: RidgeForecastResult | null;
  lang: Language;
  useUrduNumerals: boolean;
  lastUpdated: number | null;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({
  lahore,
  zones,
  ridge,
  lang,
  useUrduNumerals,
  lastUpdated,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const [activity, setActivity] = useState<ActivityType>('walk');
  const [duration, setDuration] = useState<number>(1);
  const [fromZoneId, setFromZoneId] = useState<string>('gulberg');
  const [toZoneId, setToZoneId] = useState<string>('dha5');

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const next24Hours = useMemo(() => {
    if (ridge && ridge.future24h.length >= 12) {
      return ridge.future24h.map((h) => ({ time: h.time, pm25: h.pm25, aqi: h.aqi }));
    }
    if (!lahore) return [];
    const nowTime = lahore.current.time;
    return lahore.hourly
      .filter((h) => h.time > nowTime && h.pm2_5 !== null)
      .slice(0, 24)
      .map((h) => ({
        time: h.time,
        pm25: h.pm2_5 ?? 0,
        aqi: h.us_aqi ?? pm25ToUsAqi(h.pm2_5 ?? 0),
      }));
  }, [ridge, lahore]);

  const analysis = useMemo(() => {
    return analyze24hExposure(next24Hours, activity, duration);
  }, [next24Hours, activity, duration]);

  const zoneComparison = useMemo(() => {
    const fromZone = zones.find((z) => z.location.id === fromZoneId) ?? zones[0];
    const toZone = zones.find((z) => z.location.id === toZoneId) ?? zones[1] ?? zones[0];
    if (!fromZone || !toZone) return null;

    const avgExp = (z: LocationAirSnapshot) => {
      const hrs = z.hourly.filter((h) => h.pm2_5 !== null).slice(0, 12);
      if (hrs.length === 0) return Math.round(z.current.pm2_5 * 1.5);
      const meanPm = hrs.reduce((s, x) => s + (x.pm2_5 ?? 0), 0) / hrs.length;
      return Math.round(meanPm * 1.5 * 10) / 10;
    };

    const fromExp = avgExp(fromZone);
    const toExp = avgExp(toZone);
    const cleaner = fromExp <= toExp ? fromZone : toZone;
    return { fromZone, toZone, fromExp, toExp, cleaner };
  }, [zones, fromZoneId, toZoneId]);

  if (!lahore) {
    return <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Controls + 24h Heat Strip */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isUr ? 'محفوظ سانس اور سفر پلانر (24 گھنٹے)' : 'Breathe-Safe Mobility Planner (Next 24h)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime} ·{' '}
              {isUr
                ? 'ایکسپوژر اسکور = متوقع PM2.5 × سانس لینے کی شرح × دورانیہ'
                : 'Exposure score = predicted PM2.5 × activity breathing-rate multiplier × duration'}
            </p>
          </div>
        </div>

        {/* Activity + Duration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-9 space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isUr ? 'سرگرمی منتخب کریں' : 'Choose Activity'}
            </label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setActivity(act.id)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    activity === act.id
                      ? 'border-[#0B3C5D] bg-[#0B3C5D] text-white dark:border-teal-500 dark:bg-teal-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {isUr ? act.labelUr : act.labelEn} (×{act.breathingMultiplier})
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{isUr ? 'دورانیہ' : 'Duration'}</span>
              <span className="font-mono-tabular">
                {formatNumber(duration, lang, useUrduNumerals, 1)} {isUr ? 'گھنٹے' : 'hrs'}
              </span>
            </label>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>
        </div>

        {/* 24-hour Heat Strip */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {isUr ? 'گھنٹہ وار نمائش کا نقشہ (اگلے 24 گھنٹے)' : 'Hour-by-Hour Exposure Heat Strip'}
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {analysis.slots.map((slot) => {
              const cat = getAqiCategory(slot.aqi);
              return (
                <div
                  key={slot.time}
                  title={`${slot.time} — AQI ${slot.aqi}, PM2.5 ${slot.pm25} µg/m³, Exposure ${slot.exposureScore}`}
                  className="rounded-lg p-2 text-center border border-slate-200/70 dark:border-slate-800"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  <div className="text-[11px] font-mono-tabular text-slate-700 dark:text-slate-200">
                    {slot.time.slice(11, 16)}
                  </div>
                  <div
                    className="text-xs font-bold font-mono-tabular mt-0.5"
                    style={{ color: cat.color }}
                  >
                    {formatNumber(slot.aqi, lang, useUrduNumerals)}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">
                    {formatNumber(slot.exposureScore, lang, useUrduNumerals, 0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top-3 Best Windows + Worst Window */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{isUr ? 'آئندہ 24 گھنٹے کے 3 بہترین اوقات' : 'Top-3 Cleanest Windows'}</span>
            </div>
            <div className="space-y-1.5">
              {analysis.bestTop3.map((b) => (
                <div
                  key={b.time}
                  className="flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <span>
                    <Clock className="w-3.5 h-3.5 inline me-1.5 text-emerald-600" />
                    {formatHourLabel(b.time, lang)}
                  </span>
                  <span className="font-mono-tabular">
                    AQI {formatNumber(b.aqi, lang, useUrduNumerals)} · Score{' '}
                    {formatNumber(b.exposureScore, lang, useUrduNumerals, 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {analysis.worstSlot && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-900 dark:text-rose-200">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>{isUr ? 'اس وقت سے بچیں (بدترین گھنٹہ)' : 'Worst Window to Avoid'}</span>
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white font-mono-tabular">
                {formatHourLabel(analysis.worstSlot.time, lang)} · AQI{' '}
                {formatNumber(analysis.worstSlot.aqi, lang, useUrduNumerals)} (PM2.5{' '}
                {formatNumber(analysis.worstSlot.pm25, lang, useUrduNumerals, 1)} µg/m³)
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isUr
                  ? `متوقع ایکسپوژر اسکور ${formatNumber(analysis.worstSlot.exposureScore, lang, useUrduNumerals, 0)} — اگر لازمی ہو تو N95 ماسک پہنیں۔`
                  : `Exposure score ${analysis.worstSlot.exposureScore} — reschedule or wear a sealed N95 mask.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Delivery Rider Shift Planner & Zone Commute Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Rider 4h Shift Blocks */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Bike className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isUr ? 'ڈیلیوری رائیڈر شفٹ پلانر (4 گھنٹے بلاکس)' : 'Delivery Rider Shift Planner (Best 4h Blocks)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'موٹر سائیکل سانس کی شرح (×2.1) کے مطابق کم سے کم آلودہ 4 گھنٹے کے بلاکس'
                  : 'Lowest inhaled PM2.5 4-hour riding shifts using motorbike breathing multiplier (×2.1)'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {analysis.best4hRiderBlocks.map((blk, i) => (
              <div
                key={blk.startTime}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    #{i + 1} · {formatHourLabel(blk.startTime, lang)} – {formatHourLabel(blk.endTime, lang)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                    Avg AQI {formatNumber(blk.avgAqi, lang, useUrduNumerals)} · Avg PM2.5{' '}
                    {formatNumber(blk.avgPm25, lang, useUrduNumerals, 1)} µg/m³
                  </div>
                </div>
                <div className="text-end font-mono-tabular">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? 'کل اسکور' : 'Dose Score'}
                  </div>
                  <div className="text-base font-bold text-teal-700 dark:text-teal-400">
                    {formatNumber(blk.totalExposure, lang, useUrduNumerals)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Compare Zones for My Commute */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <ArrowLeftRight className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isUr ? 'سفر کے لیے علاقوں کا موازنہ' : 'Compare Zones for My Commute'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'جانچیں کہ کس علاقے میں انتظار کرنا یا رہنا کم نقصان دہ ہے (~10km CAMS گرڈ)'
                  : 'Compare 12h average commute exposure between origin & destination zones'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {isUr ? 'کہاں سے' : 'From Zone'}
              </label>
              <select
                value={fromZoneId}
                onChange={(e) => setFromZoneId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {zones.map((z) => (
                  <option key={z.location.id} value={z.location.id}>
                    {isUr ? z.location.nameUr : z.location.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {isUr ? 'کہاں تک' : 'To Zone'}
              </label>
              <select
                value={toZoneId}
                onChange={(e) => setToZoneId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {zones.map((z) => (
                  <option key={z.location.id} value={z.location.id}>
                    {isUr ? z.location.nameUr : z.location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {zoneComparison && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? zoneComparison.fromZone.location.nameUr : zoneComparison.fromZone.location.name}
                  </div>
                  <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                    AQI {Math.round(zoneComparison.fromZone.current.us_aqi)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    12h Exp: {zoneComparison.fromExp}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? zoneComparison.toZone.location.nameUr : zoneComparison.toZone.location.name}
                  </div>
                  <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                    AQI {Math.round(zoneComparison.toZone.current.us_aqi)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    12h Exp: {zoneComparison.toExp}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 text-xs text-slate-800 dark:text-slate-200">
                {isUr
                  ? `مشورہ: ان دو علاقوں میں "${zoneComparison.cleaner.location.nameUr}" میں ہوا قدرے بہتر ہے، تاہم ~10km ماڈل کی وجہ سے دونوں میں فرق کم ہے۔`
                  : `Suggestion: "${zoneComparison.cleaner.location.name}" has slightly lower modeled 12h exposure — wait indoors there if timing your trip.`}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
