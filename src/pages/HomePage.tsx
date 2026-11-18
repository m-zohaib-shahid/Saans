import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  RefreshCw,
  Share2,
  Info,
  Wind,
  Eye,
  Sparkles,
  Flame,
  CheckSquare,
  Square,
  Clock,
  Trophy,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { AqiGauge } from '../components/AqiGauge';
import { CountUpNumber } from '../components/CountUpNumber';
import { EmptyState } from '../components/EmptyState';
import {
  calcCigaretteEquivalent,
  calcWhoMultipliers,
  formatHourLabel,
  formatNumber,
  getAqiCategory,
  windDirectionLabel,
} from '../lib/aqi';
import { PERSONAS, t } from '../lib/i18n';
import { simplifyToSimpleUrdu } from '../services/aiService';
import { DAILY_CHALLENGES } from '../services/reportsService';
import type {
  HeroProgress,
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
  PersonaId,
  RidgeForecastResult,
  StructuredAdvice,
} from '../types';

interface HomePageProps {
  userName: string;
  lahore: LocationAirSnapshot | null;
  cities: LocationAirSnapshot[];
  zones: LocationAirSnapshot[];
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  advice: StructuredAdvice | null;
  adviceLoading: boolean;
  hero: HeroProgress;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  persona: PersonaId;
  lastUpdated: number | null;
  onRefreshAdvice: () => void;
  onOpenShareModal: () => void;
  onAdviceCheckedPoints: () => void;
  onToggleChallenge: (challengeId: string) => void;
}

function getGreeting(name: string, lang: Language): string {
  const hour = new Date().getHours();
  if (lang === 'ur') {
    if (hour < 12) return `صبح بخیر، ${name} 👋`;
    if (hour < 17) return `دوپہر بخیر، ${name} 👋`;
    return `شام بخیر، ${name} 👋`;
  }
  if (hour < 12) return `Good morning, ${name} 👋`;
  if (hour < 17) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 👋`;
}

export const HomePage: React.FC<HomePageProps> = ({
  userName,
  lahore,
  cities,
  zones,
  weather,
  ridge,
  advice,
  adviceLoading,
  hero,
  lang,
  useUrduNumerals,
  liteMode,
  persona,
  lastUpdated,
  onRefreshAdvice,
  onOpenShareModal,
  onAdviceCheckedPoints,
  onToggleChallenge,
}) => {
  const copy = t(lang);
  const isUr = lang === 'ur';
  const prefersReduced = useReducedMotion();
  const skipMotion = Boolean(liteMode || prefersReduced);

  const [simpleUrdu, setSimpleUrdu] = useState<string | null>(null);
  const [simplifying, setSimplifying] = useState(false);
  const [showZoneInfo, setShowZoneInfo] = useState(false);

  const rankedCities = useMemo(() => {
    return [...cities].sort((a, b) => b.current.us_aqi - a.current.us_aqi);
  }, [cities]);

  const lahoreRank = useMemo(() => {
    if (!lahore) return 0;
    const idx = rankedCities.findIndex((c) => c.location.id === lahore.location.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [rankedCities, lahore]);

  const past24hSparkline = useMemo(() => {
    if (!lahore) return [];
    const nowTime = lahore.current.time;
    return lahore.hourly
      .filter((h) => h.time <= nowTime && h.pm2_5 !== null)
      .slice(-24)
      .map((h) => ({
        label: h.time.slice(11, 16),
        pm25: Math.round((h.pm2_5 ?? 0) * 10) / 10,
      }));
  }, [lahore]);

  const bestOutsideWindow = useMemo(() => {
    if (advice?.bestWindow) return advice.bestWindow;
    if (ridge && ridge.future24h.length > 0) {
      const best = [...ridge.future24h].sort((a, b) => a.aqi - b.aqi)[0];
      return formatHourLabel(best.time, lang);
    }
    return isUr ? 'دوپہر 1 تا 4 بجے' : '13:00–16:00';
  }, [advice, ridge, lang, isUr]);

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  if (!lahore) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const aqi = Math.round(lahore.current.us_aqi);
  const pm25 = lahore.current.pm2_5;
  const cat = getAqiCategory(aqi);
  const who = calcWhoMultipliers(pm25);
  const cigarettes = calcCigaretteEquivalent(pm25);
  const visibility = weather?.current.visibility ?? 5000;
  const windSpeed = weather?.current.wind_speed_10m ?? 0;
  const lowVisibility = visibility < 1000;
  const activePersona = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];

  const cleanestCity = rankedCities[rankedCities.length - 1];
  const dirtiestCity = rankedCities[0];
  const todayIso = new Date().toISOString().slice(0, 10);
  const doneChallenges = hero.completedChallenges?.[todayIso] ?? [];

  const handleSimplify = async () => {
    if (!advice) return;
    setSimplifying(true);
    try {
      const fullText = `${advice.headline}. ${advice.actions.join(' ')} ${advice.ventilation}`;
      const res = await simplifyToSimpleUrdu(fullText, lahore, weather, ridge);
      setSimpleUrdu(res.simplified);
      onAdviceCheckedPoints();
    } finally {
      setSimplifying(false);
    }
  };

  const verdictLabel = (v: StructuredAdvice['verdict']) => {
    if (!isUr) return v;
    const map: Record<StructuredAdvice['verdict'], string> = {
      Safe: 'محفوظ',
      Caution: 'احتیاط',
      'Avoid outdoor': 'باہر نکلنے سے گریز',
      'Stay indoors': 'گھر کے اندر رہیں',
    };
    return map[v] ?? v;
  };

  const maskLabel = (m: StructuredAdvice['mask']) => {
    if (!isUr) return m === 'none' ? 'No mask needed' : m === 'surgical' ? 'Surgical mask' : 'N95 / KN95 respirator';
    return m === 'none' ? 'ماسک کی ضرورت نہیں' : m === 'surgical' ? 'سرجیکل ماسک' : 'N95 / KN95 ماسک';
  };

  return (
    <div className="space-y-6">
      {/* Low visibility alert banner */}
      {lowVisibility && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/12 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{copy.visibilityWarning}</span>
        </div>
      )}

      {/* MISSION CONTROL HERO */}
      <motion.section
        initial={skipMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 lg:p-8 space-y-6"
      >
        {/* Top Metadata & Greeting */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {getGreeting(userName, lang)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-teal-700 dark:text-teal-400">
                {isUr
                  ? `لاہور اس وقت پاکستان کے ${cities.length} شہروں میں #${lahoreRank} نمبر پر ہے`
                  : `Lahore is #${lahoreRank} of ${cities.length} Pakistani cities right now`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                {isUr ? `آج باہر نکلنے کا بہترین وقت: ${bestOutsideWindow}` : `Best time outside today: ${bestOutsideWindow}`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
              {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
            </span>
            <button
              type="button"
              onClick={onOpenShareModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B3C5D] text-white text-xs font-medium hover:bg-[#092f4a] active:scale-[0.98] transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copy.sharePostBtn}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Giant Gauge */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center">
            <AqiGauge
              aqi={aqi}
              pm25={pm25}
              lang={lang}
              useUrduNumerals={useUrduNumerals}
              liteMode={liteMode}
            />
          </div>

          {/* Right: Verdict + 4 Count-Up Quick Stat Tiles + 24h Mini Sparkline */}
          <div className="lg:col-span-8 space-y-5">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-teal-700 dark:text-teal-400">
                {activePersona.emoji} {isUr ? activePersona.labelUr : activePersona.labelEn}
                <span aria-hidden="true"> · </span>
                <span>{isUr ? 'مشن کنٹرول خلاصہ' : 'Mission Control Verdict'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
                {advice
                  ? advice.headline
                  : isUr
                  ? `لاہور کا AQI ${formatNumber(aqi, lang, useUrduNumerals)} (${cat.labelUr}) ہے`
                  : `Lahore is at AQI ${aqi} (${cat.labelEn}) right now`}
              </h2>
            </div>

            {/* 4 Quick Stat Tiles with CountUpNumber */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 transition-transform hover:-translate-y-0.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">PM2.5 (µg/m³)</div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                  <CountUpNumber
                    value={pm25}
                    decimals={1}
                    lang={lang}
                    useUrduNumerals={useUrduNumerals}
                    liteMode={liteMode}
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatNumber(who.vs24h, lang, useUrduNumerals, 1)}× WHO 24h
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 transition-transform hover:-translate-y-0.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isUr ? 'سگریٹ کے برابر' : '≈ Cigarettes/day'}
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                  <CountUpNumber
                    value={cigarettes}
                    decimals={1}
                    lang={lang}
                    useUrduNumerals={useUrduNumerals}
                    liteMode={liteMode}
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatNumber(who.vsAnnual, lang, useUrduNumerals, 1)}× WHO annual
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 transition-transform hover:-translate-y-0.5">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" />
                  <span>{copy.wind}</span>
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                  <CountUpNumber
                    value={windSpeed}
                    decimals={1}
                    lang={lang}
                    useUrduNumerals={useUrduNumerals}
                    liteMode={liteMode}
                  />{' '}
                  <span className="text-xs font-normal">km/h</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {weather ? windDirectionLabel(weather.current.wind_direction_10m, lang) : '—'} ·{' '}
                  {weather ? `${Math.round(weather.current.temperature_2m)}°C` : ''}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 transition-transform hover:-translate-y-0.5">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{copy.visibility}</span>
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-0.5">
                  {visibility >= 1000 ? (
                    <>
                      <CountUpNumber
                        value={visibility / 1000}
                        decimals={1}
                        lang={lang}
                        useUrduNumerals={useUrduNumerals}
                        liteMode={liteMode}
                      />{' '}
                      <span className="text-xs font-normal">km</span>
                    </>
                  ) : (
                    <>
                      <CountUpNumber
                        value={visibility}
                        decimals={0}
                        lang={lang}
                        useUrduNumerals={useUrduNumerals}
                        liteMode={liteMode}
                      />{' '}
                      <span className="text-xs font-normal">m</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {weather ? `${Math.round(weather.current.relative_humidity_2m)}% RH` : '—'}
                </div>
              </div>
            </div>

            {/* Mini Sparkline of Last 24h */}
            {past24hSparkline.length > 0 && !liteMode && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>
                    {isUr ? 'گزشتہ 24 گھنٹوں کا PM2.5 رجحان' : 'Last 24h PM2.5 Trend (µg/m³)'}
                  </span>
                  {ridge?.peakForecast && (
                    <span className="font-mono-tabular">
                      {isUr
                        ? `اگلی چوٹی: ${formatHourLabel(ridge.peakForecast.time, lang)}`
                        : `Next peak: ${formatHourLabel(ridge.peakForecast.time, lang)} (AQI ${ridge.peakForecast.aqi})`}
                    </span>
                  )}
                </div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={past24hSparkline} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sparkTeal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, fontSize: 11 }}
                        formatter={(val) => [`${val} µg/m³`, 'PM2.5']}
                      />
                      <Area
                        type="monotone"
                        dataKey="pm25"
                        stroke="#0D9488"
                        strokeWidth={2}
                        fill="url(#sparkTeal)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* DAILY STREAK & TODAY'S CLEAN AIR CHALLENGE + PERSONALIZED ADVICE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Streak & Challenge */}
        <motion.section
          initial={skipMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: skipMotion ? 0 : 0.06 }}
          className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isUr ? 'آج کا کلین ایئر چیلنج' : "Today's Clean Air Challenge"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isUr
                    ? `مسلسل ${hero.streakDays ?? 1} دن کا سلسلہ · ${hero.points} پوائنٹس`
                    : `${hero.streakDays ?? 1}-day streak · ${hero.points} Hero pts`}
                </p>
              </div>
            </div>
            <Trophy className="w-4 h-4 text-teal-600" />
          </div>

          <div className="space-y-2.5">
            {DAILY_CHALLENGES.map((ch) => {
              const checked = doneChallenges.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onToggleChallenge(ch.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-start transition-all active:scale-[0.98] ${
                    checked
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-xs font-medium leading-snug">
                    {isUr ? ch.labelUr : ch.labelEn}
                  </div>
                  <span className="text-[11px] font-mono-tabular font-semibold text-teal-700 dark:text-teal-400">
                    +{ch.points}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* TODAY'S PERSONALIZED ADVICE */}
        <motion.section
          initial={skipMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: skipMotion ? 0 : 0.12 }}
          className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>{copy.aiAdviceTitle}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {copy.aiDisclaimer}
                {advice?.isFallback ? ` · ${copy.fallbackBadge}` : ' · Gemini 2.5 Flash'}
              </p>
            </div>

            <button
              type="button"
              onClick={onRefreshAdvice}
              disabled={adviceLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${adviceLoading ? 'animate-spin' : ''}`} />
              <span>{isUr ? 'مشورہ تازہ کریں' : 'Refresh Advice'}</span>
            </button>
          </div>

          {adviceLoading && !advice ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ) : advice ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? 'فیصلہ' : 'Verdict'}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {verdictLabel(advice.verdict)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? 'ماسک کی سفارش' : 'Mask Recommendation'}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {maskLabel(advice.mask)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isUr ? 'بہترین بیرونی وقت' : 'Best Time Window'}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {advice.bestWindow}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    {isUr ? 'اہم احتیاطی اقدامات' : 'Recommended Actions'}
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc list-inside">
                    {advice.actions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isUr ? 'کھڑکیاں اور ہوا کا گزر' : 'Ventilation Guidance'}
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {advice.ventilation}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isUr ? 'سائنسی وجہ' : 'Grounded Reasoning'}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {advice.reasoning}
                    </p>
                  </div>
                </div>
              </div>

              {/* Explain like I'm 10 in Simple Urdu */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => void handleSimplify()}
                    disabled={simplifying}
                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                  >
                    {simplifying
                      ? isUr
                        ? 'آسان اردو تیار ہو رہی ہے...'
                        : 'Translating to simple Urdu...'
                      : copy.simplifyBtn}
                  </button>
                </div>
                {simpleUrdu && (
                  <div
                    dir="rtl"
                    className="rounded-xl bg-teal-500/10 border border-teal-500/25 p-4 text-base text-slate-900 dark:text-slate-100 font-urdu"
                  >
                    {simpleUrdu}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.section>
      </div>

      {/* CITY COMPARISON & LAHORE ZONES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {copy.cityRankTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
              </p>
            </div>
            {cleanestCity && dirtiestCity && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {copy.mostPolluted}:{' '}
                  <strong>{isUr ? dirtiestCity.location.nameUr : dirtiestCity.location.name}</strong>
                </span>
                <span aria-hidden="true"> · </span>
                <span>
                  {copy.cleanest}:{' '}
                  <strong>{isUr ? cleanestCity.location.nameUr : cleanestCity.location.name}</strong>
                </span>
              </div>
            )}
          </div>

          {rankedCities.length === 0 ? (
            <EmptyState
              titleEn="City readings unavailable"
              titleUr="شہروں کا ڈیٹا دستیاب نہیں"
              descEn="Could not load city comparison feeds right now."
              descUr="اس وقت دیگر شہروں کا ڈیٹا لوڈ نہیں ہو سکا۔"
              lang={lang}
            />
          ) : (
            <>
              {!liteMode && (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rankedCities.map((c) => ({
                        name: isUr ? c.location.nameUr : c.location.name,
                        aqi: Math.round(c.current.us_aqi),
                        color: getAqiCategory(c.current.us_aqi).color,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 12, fill: 'currentColor' }}
                      />
                      <Tooltip
                        formatter={(value) => [`AQI ${value}`, 'US AQI']}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="aqi" radius={[0, 6, 6, 0]} barSize={18}>
                        {rankedCities.map((c) => (
                          <Cell key={c.location.id} fill={getAqiCategory(c.current.us_aqi).color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2 text-start font-medium">#</th>
                      <th className="py-2 text-start font-medium">{isUr ? 'شہر' : 'City'}</th>
                      <th className="py-2 text-end font-medium">US AQI</th>
                      <th className="py-2 text-end font-medium">PM2.5</th>
                      <th className="py-2 text-end font-medium">
                        {isUr ? 'لاہور سے فرق' : 'Lahore Δ'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {rankedCities.map((c, idx) => {
                      const cAqi = Math.round(c.current.us_aqi);
                      const catItem = getAqiCategory(cAqi);
                      const delta = aqi - cAqi;
                      const isLhr = c.location.id === 'lahore';
                      return (
                        <tr
                          key={c.location.id}
                          className={isLhr ? 'bg-[#0B3C5D]/6 dark:bg-teal-500/10 font-semibold' : ''}
                        >
                          <td className="py-2.5 font-mono-tabular text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 text-slate-900 dark:text-white">
                            {isUr ? c.location.nameUr : c.location.name}
                          </td>
                          <td className="py-2.5 text-end font-mono-tabular">
                            <span aria-hidden="true">{catItem.emoji} </span>
                            {formatNumber(cAqi, lang, useUrduNumerals)}
                          </td>
                          <td className="py-2.5 text-end font-mono-tabular text-slate-600 dark:text-slate-300">
                            {formatNumber(c.current.pm2_5, lang, useUrduNumerals, 1)}
                          </td>
                          <td className="py-2.5 text-end font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                            {isLhr
                              ? '—'
                              : delta > 0
                              ? `+${delta}`
                              : delta < 0
                              ? `${delta}`
                              : '0'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* 7 Lahore Zones */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {copy.lahoreZonesTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowZoneInfo((v) => !v)}
              aria-label="Zone resolution info"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {showZoneInfo && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-600 dark:text-slate-300">
              {copy.zoneTooltip}
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isUr
              ? 'نوٹ: تقریباً 10 کلومیٹر گرڈ ماڈل کی وجہ سے علاقوں کے درمیان فرق محدود ہو سکتا ہے۔'
              : 'Model resolution is ~10 km, so nearby zone differences are modest.'}
          </p>

          {zones.length === 0 ? (
            <EmptyState
              titleEn="No zone data loaded"
              titleUr="زونز کا ڈیٹا دستیاب نہیں"
              descEn="Lahore neighborhood data is currently refreshing."
              descUr="لاہور کے علاقوں کا ڈیٹا ابھی دستیاب نہیں ہے۔"
              lang={lang}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {zones.map((z) => {
                const zAqi = Math.round(z.current.us_aqi);
                const zCat = getAqiCategory(zAqi);
                return (
                  <div key={z.location.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {isUr ? z.location.nameUr : z.location.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {zCat.emoji} {isUr ? zCat.labelUr : zCat.labelEn}
                      </div>
                    </div>
                    <div className="text-end font-mono-tabular">
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {formatNumber(zAqi, lang, useUrduNumerals)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(z.current.pm2_5, lang, useUrduNumerals, 1)} µg/m³
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
