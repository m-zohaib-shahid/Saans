import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Sliders, Calculator, Flame } from 'lucide-react';
import { formatNumber, pm25ToUsAqi } from '../lib/aqi';
import { t } from '../lib/i18n';
import type { FirmsHotspot, Language, LocationAirSnapshot } from '../types';

interface PolicyPageProps {
  lahore: LocationAirSnapshot | null;
  firms: FirmsHotspot[];
  hasFirmsKey: boolean;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  lastUpdated: number | null;
}

export const PolicyPage: React.FC<PolicyPageProps> = ({
  lahore,
  firms,
  hasFirmsKey,
  lang,
  useUrduNumerals,
  liteMode,
  lastUpdated,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  // Cost of Smog editable inputs
  const [populationMillions, setPopulationMillions] = useState(13);
  const [smogDays, setSmogDays] = useState(45);
  const [lostWorkPct, setLostWorkPct] = useState(8);
  const [dailyValuePkr, setDailyValuePkr] = useState(1800);
  const [healthCostPerPersonPkr, setHealthCostPerPersonPkr] = useState(320);

  // Intervention Simulator sliders & transparent source-share assumptions
  const [reduceVehiclesPct, setReduceVehiclesPct] = useState(30);
  const [closeKilnsPct, setCloseKilnsPct] = useState(60);
  const [stopStubblePct, setStopStubblePct] = useState(50);

  const [shareTransport, setShareTransport] = useState(43);
  const [shareKilns, setShareKilns] = useState(22);
  const [shareStubble, setShareStubble] = useState(20);

  const costSummary = useMemo(() => {
    const pop = populationMillions * 1_000_000;
    const workforce = pop * 0.36; // ~36% labor participation
    const lostWorkdays = Math.round(workforce * smogDays * (lostWorkPct / 100));
    const productivityLossPkr = lostWorkdays * dailyValuePkr;
    const healthcareLossPkr = Math.round(pop * healthCostPerPersonPkr * (smogDays / 30));
    const totalBillionPkr = Math.round(((productivityLossPkr + healthcareLossPkr) / 1e9) * 10) / 10;
    return {
      lostWorkdaysMillion: Math.round((lostWorkdays / 1e6) * 10) / 10,
      totalBillionPkr,
    };
  }, [populationMillions, smogDays, lostWorkPct, dailyValuePkr, healthCostPerPersonPkr]);

  const currentPm25 = lahore?.current.pm2_5 ?? 80;
  const currentAqi = Math.round(lahore?.current.us_aqi ?? pm25ToUsAqi(currentPm25));

  const simResult = useMemo(() => {
    const totalShares = Math.max(100, shareTransport + shareKilns + shareStubble);
    const tW = shareTransport / totalShares;
    const kW = shareKilns / totalShares;
    const sW = shareStubble / totalShares;

    const reductionFrac =
      tW * (reduceVehiclesPct / 100) +
      kW * (closeKilnsPct / 100) +
      sW * (stopStubblePct / 100);

    const afterPm25 = Math.max(5, Math.round(currentPm25 * (1 - reductionFrac) * 10) / 10);
    const afterAqi = pm25ToUsAqi(afterPm25);
    const reductionPct = Math.round(reductionFrac * 1000) / 10;

    return {
      afterPm25,
      afterAqi,
      reductionPct,
      chartData: [
        {
          stage: isUr ? 'موجودہ سطح' : 'Current Baseline',
          pm25: Math.round(currentPm25 * 10) / 10,
          aqi: currentAqi,
        },
        {
          stage: isUr ? 'مداخلت کے بعد' : 'After Interventions',
          pm25: afterPm25,
          aqi: afterAqi,
        },
      ],
    };
  }, [
    currentPm25,
    currentAqi,
    reduceVehiclesPct,
    closeKilnsPct,
    stopStubblePct,
    shareTransport,
    shareKilns,
    shareStubble,
    isUr,
  ]);

  return (
    <div className="space-y-6">
      {/* FIRMS Regulator Summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-500 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isUr ? 'پالیسی اور ریگولیٹر تجزیہ لیب' : 'Policy & Regulator Analytics Lab'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime} ·{' '}
              {hasFirmsKey
                ? isUr
                  ? `پنجاب ہاٹ اسپاٹس (24 گھنٹے): ${firms.length}`
                  : `Punjab FIRMS hotspots (24h): ${firms.length}`
                : isUr
                ? 'FIRMS سیٹلائٹ کلید شامل نہیں (ترتیبات میں شامل کریں)'
                : 'Optional NASA FIRMS satellite layer not configured'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost of Smog Calculator */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Calculator className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isUr ? 'اسموگ کی معاشی لاگت کیلکولیٹر' : 'Cost of Smog Calculator'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'شفاف اور قابلِ ترمیم مفروضوں پر مبنی مثالی تخمینہ'
                  : 'Illustrative economic estimate with transparent, editable assumptions'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-600 dark:text-slate-300">
                {isUr ? 'متاثرہ آبادی (ملین)' : 'Population Exposed (M)'}
              </span>
              <input
                type="number"
                min={1}
                max={50}
                value={populationMillions}
                onChange={(e) => setPopulationMillions(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 dark:text-slate-300">
                {isUr ? 'AQI > 200 کے دن' : 'Days Above AQI 200'}
              </span>
              <input
                type="number"
                min={1}
                max={180}
                value={smogDays}
                onChange={(e) => setSmogDays(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 dark:text-slate-300">
                {isUr ? 'کام کے دنوں کا نقصان (%)' : 'Lost Workday Rate (%)'}
              </span>
              <input
                type="number"
                min={1}
                max={50}
                value={lostWorkPct}
                onChange={(e) => setLostWorkPct(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 dark:text-slate-300">
                {isUr ? 'یومیہ پیداواری لاگت (PKR)' : 'Daily Output Value (PKR)'}
              </span>
              <input
                type="number"
                min={500}
                max={10000}
                step={100}
                value={dailyValuePkr}
                onChange={(e) => setDailyValuePkr(Number(e.target.value) || 500)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white"
              />
            </label>
          </div>

          <label className="block text-xs space-y-1">
            <span className="text-slate-600 dark:text-slate-300">
              {isUr
                ? 'ماہانہ فی کس صحت کی لاگت کا مفروضہ (PKR)'
                : 'Health Cost Assumption per Person / 30d (PKR)'}
            </span>
            <input
              type="number"
              min={50}
              max={5000}
              step={50}
              value={healthCostPerPersonPkr}
              onChange={(e) => setHealthCostPerPersonPkr(Number(e.target.value) || 50)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isUr ? 'ضائع شدہ کام کے دن' : 'Approx. Lost Workdays'}
              </div>
              <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                {formatNumber(costSummary.lostWorkdaysMillion, lang, useUrduNumerals, 1)}M
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isUr ? 'تخمینی معاشی و طبی لاگت' : 'Estimated Total Cost'}
              </div>
              <div className="text-2xl font-bold font-mono-tabular text-rose-700 dark:text-rose-400 mt-0.5">
                PKR {formatNumber(costSummary.totalBillionPkr, lang, useUrduNumerals, 1)}B
              </div>
            </div>
          </div>
        </section>

        {/* Intervention Simulator */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isUr ? 'پالیسی مداخلت سمیولیٹر' : 'Intervention Scenario Simulator'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isUr
                  ? 'مثالی منظرنامہ ماڈل (پیمانہ نہیں) — ذرائع کا حصہ نیچے قابلِ ترمیم ہے'
                  : 'Illustrative scenario model (not a measurement) using editable source-contribution shares'}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 dark:text-slate-200">
                <span>
                  {isUr ? 'ٹریفک / گاڑیوں میں کمی' : 'Reduce Vehicles / Transport Emissions'}
                </span>
                <span className="font-mono-tabular">{reduceVehiclesPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={reduceVehiclesPct}
                onChange={(e) => setReduceVehiclesPct(Number(e.target.value))}
                className="w-full accent-teal-600 mt-1"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 dark:text-slate-200">
                <span>
                  {isUr ? 'بھٹوں کی بندش / زگ زیگ منتقلی' : 'Close / Retrofit Brick Kilns'}
                </span>
                <span className="font-mono-tabular">{closeKilnsPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={closeKilnsPct}
                onChange={(e) => setCloseKilnsPct(Number(e.target.value))}
                className="w-full accent-teal-600 mt-1"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 dark:text-slate-200">
                <span>
                  {isUr ? 'فصل جلانے کا خاتمہ' : 'Stop Stubble / Crop Residue Burning'}
                </span>
                <span className="font-mono-tabular">{stopStubblePct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={stopStubblePct}
                onChange={(e) => setStopStubblePct(Number(e.target.value))}
                className="w-full accent-teal-600 mt-1"
              />
            </div>
          </div>

          {/* Transparent editable source contribution assumptions */}
          <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {isUr ? 'ٹریفک حصہ %' : 'Transport Share %'}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={shareTransport}
                onChange={(e) => setShareTransport(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-tabular"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {isUr ? 'بھٹہ/صنعت %' : 'Kilns/Ind. Share %'}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={shareKilns}
                onChange={(e) => setShareKilns(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-tabular"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {isUr ? 'فصل جلانا %' : 'Stubble Share %'}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={shareStubble}
                onChange={(e) => setShareStubble(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-tabular"
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-700 dark:text-slate-200">
              {isUr ? 'تخمینی PM2.5 کمی' : 'Projected PM2.5 Reduction'}:{' '}
              <span className="text-teal-700 dark:text-teal-400 font-mono-tabular">
                -{simResult.reductionPct}%
              </span>
            </span>
            <span className="font-mono-tabular text-slate-900 dark:text-white">
              AQI {currentAqi} → {simResult.afterAqi}
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simResult.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" µg" width={54} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar
                  dataKey="pm25"
                  name="PM2.5 (µg/m³)"
                  fill="#0D9488"
                  radius={[8, 8, 0, 0]}
                  barSize={44}
                  isAnimationActive={!liteMode}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
