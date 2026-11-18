import type { Language } from '../types';

export interface AqiCategory {
  key: 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
  labelEn: string;
  labelUr: string;
  emoji: string;
  color: string;
  bgTint: string;
  textClass: string;
  borderClass: string;
  min: number;
  max: number;
}

export const AQI_CATEGORIES: AqiCategory[] = [
  {
    key: 'good',
    labelEn: 'Good',
    labelUr: 'اچھی ہوا',
    emoji: '🟢',
    color: '#16A34A',
    bgTint: 'bg-emerald-500/12',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/30',
    min: 0,
    max: 50,
  },
  {
    key: 'moderate',
    labelEn: 'Moderate',
    labelUr: 'معتدل',
    emoji: '🟡',
    color: '#CA8A04',
    bgTint: 'bg-amber-500/12',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-500/30',
    min: 51,
    max: 100,
  },
  {
    key: 'usg',
    labelEn: 'Sensitive Groups',
    labelUr: 'حساس افراد کے لیے غیر صحت بخش',
    emoji: '🟠',
    color: '#EA580C',
    bgTint: 'bg-orange-500/12',
    textClass: 'text-orange-800 dark:text-orange-300',
    borderClass: 'border-orange-500/30',
    min: 101,
    max: 150,
  },
  {
    key: 'unhealthy',
    labelEn: 'Unhealthy',
    labelUr: 'غیر صحت بخش',
    emoji: '🔴',
    color: '#DC2626',
    bgTint: 'bg-red-500/12',
    textClass: 'text-red-800 dark:text-red-300',
    borderClass: 'border-red-500/30',
    min: 151,
    max: 200,
  },
  {
    key: 'very_unhealthy',
    labelEn: 'Very Unhealthy',
    labelUr: 'انتہائی غیر صحت بخش',
    emoji: '🟣',
    color: '#7E22CE',
    bgTint: 'bg-purple-500/12',
    textClass: 'text-purple-800 dark:text-purple-300',
    borderClass: 'border-purple-500/30',
    min: 201,
    max: 300,
  },
  {
    key: 'hazardous',
    labelEn: 'Hazardous',
    labelUr: 'خطرناک',
    emoji: '🟤',
    color: '#881337',
    bgTint: 'bg-rose-950/15 dark:bg-rose-900/25',
    textClass: 'text-rose-900 dark:text-rose-200',
    borderClass: 'border-rose-800/40',
    min: 301,
    max: 999,
  },
];

export function getAqiCategory(aqi: number): AqiCategory {
  const safeAqi = Math.max(0, Math.round(aqi));
  for (const cat of AQI_CATEGORIES) {
    if (safeAqi >= cat.min && safeAqi <= cat.max) {
      return cat;
    }
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/**
 * Convert PM2.5 concentration (µg/m³) to US EPA AQI using standard piecewise-linear breakpoints.
 * Truncates PM2.5 to 0.1 µg/m³ per EPA technical assistance document.
 */
export function pm25ToUsAqi(pm25: number): number {
  const c = Math.max(0, Math.floor(pm25 * 10) / 10);
  const breakpoints: Array<[number, number, number, number]> = [
    [0.0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c >= cLow && c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  // Linear extrapolation above 500.4 µg/m³
  return Math.round(500 + ((c - 500.4) * 99) / 149.6);
}

export const WHO_GUIDELINE_24H = 15; // µg/m³
export const WHO_GUIDELINE_ANNUAL = 5; // µg/m³
export const CIGARETTE_PM25_EQUIVALENT = 22; // Berkeley Earth: 22 µg/m³ ≈ 1 cigarette/day

export function calcWhoMultipliers(pm25: number): { vsAnnual: number; vs24h: number } {
  return {
    vsAnnual: Math.round((pm25 / WHO_GUIDELINE_ANNUAL) * 10) / 10,
    vs24h: Math.round((pm25 / WHO_GUIDELINE_24H) * 10) / 10,
  };
}

export function calcCigaretteEquivalent(pm25: number): number {
  return Math.round((Math.max(0, pm25) / CIGARETTE_PM25_EQUIVALENT) * 10) / 10;
}

export function formatNumber(
  value: number,
  lang: Language,
  useUrduNumerals: boolean,
  decimals = 0
): string {
  const fixed = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  if (lang === 'ur' && useUrduNumerals) {
    const urduDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return fixed.replace(/\d/g, (d) => urduDigits[Number(d)]);
  }
  return fixed;
}

export function formatHourLabel(isoTime: string, lang: Language): string {
  const match = isoTime.match(/T(\d{2}):(\d{2})/);
  if (!match) return isoTime;
  const hour = Number(match[1]);
  if (lang === 'ur') {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 ? 'صبح' : hour < 17 ? 'دوپہر' : hour < 20 ? 'شام' : 'رات';
    return `${h12} ${period}`;
  }
  return `${String(hour).padStart(2, '0')}:00`;
}

export function windDirectionLabel(deg: number, lang: Language): string {
  const dirsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dirsUr = ['شمال', 'شمال مشرق', 'مشرق', 'جنوب مشرق', 'جنوب', 'جنوب مغرب', 'مغرب', 'شمال مغرب'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return lang === 'ur' ? dirsUr[idx] : dirsEn[idx];
}
