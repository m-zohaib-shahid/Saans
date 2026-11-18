import { pm25ToUsAqi } from './aqi';

export type ActivityType = 'walk' | 'motorbike' | 'school_run' | 'sport' | 'ventilation';

export interface ActivityConfig {
  id: ActivityType;
  labelEn: string;
  labelUr: string;
  breathingMultiplier: number; // Relative minute ventilation factor vs resting indoors
  defaultDurationHours: number;
}

export const ACTIVITIES: ActivityConfig[] = [
  {
    id: 'walk',
    labelEn: 'Brisk Walk',
    labelUr: 'تیز چہل قدمی',
    breathingMultiplier: 1.6,
    defaultDurationHours: 1,
  },
  {
    id: 'motorbike',
    labelEn: 'Bike / Motorbike Ride',
    labelUr: 'موٹر سائیکل سفر',
    breathingMultiplier: 2.1,
    defaultDurationHours: 1,
  },
  {
    id: 'school_run',
    labelEn: 'School Drop-off / Pick-up',
    labelUr: 'اسکول چھوڑنا / لانا',
    breathingMultiplier: 1.3,
    defaultDurationHours: 1,
  },
  {
    id: 'sport',
    labelEn: 'Outdoor Sport / Running',
    labelUr: 'بیرونی کھیل / دوڑ',
    breathingMultiplier: 3.2,
    defaultDurationHours: 1,
  },
  {
    id: 'ventilation',
    labelEn: 'Open Window Ventilation',
    labelUr: 'کھڑکیاں کھولنا',
    breathingMultiplier: 1.0,
    defaultDurationHours: 1,
  },
];

export interface HourlyExposureSlot {
  time: string;
  pm25: number;
  aqi: number;
  exposureScore: number;
  level: 'low' | 'moderate' | 'high' | 'severe';
}

/**
 * Exposure score = predicted PM2.5 (µg/m³) * breathing-rate multiplier * duration (hours).
 * Higher score means greater inhaled particulate dose.
 */
export function computeExposureScore(
  pm25: number,
  breathingMultiplier: number,
  durationHours: number
): number {
  return Math.round(pm25 * breathingMultiplier * durationHours * 10) / 10;
}

export function classifyExposure(score: number): 'low' | 'moderate' | 'high' | 'severe' {
  if (score <= 40) return 'low';
  if (score <= 95) return 'moderate';
  if (score <= 180) return 'high';
  return 'severe';
}

export function analyze24hExposure(
  hours: Array<{ time: string; pm25: number; aqi?: number }>,
  activityId: ActivityType,
  durationHours: number
): {
  slots: HourlyExposureSlot[];
  bestTop3: HourlyExposureSlot[];
  worstSlot: HourlyExposureSlot | null;
  best4hRiderBlocks: Array<{ startTime: string; endTime: string; avgPm25: number; avgAqi: number; totalExposure: number }>;
} {
  const activity = ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0];
  const next24 = hours.slice(0, 24);

  const slots: HourlyExposureSlot[] = next24.map((h) => {
    const score = computeExposureScore(h.pm25, activity.breathingMultiplier, durationHours);
    return {
      time: h.time,
      pm25: Math.round(h.pm25 * 10) / 10,
      aqi: h.aqi ?? pm25ToUsAqi(h.pm25),
      exposureScore: score,
      level: classifyExposure(score),
    };
  });

  const sorted = [...slots].sort((a, b) => a.exposureScore - b.exposureScore);
  const bestTop3 = sorted.slice(0, 3);
  const worstSlot = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const blocks: Array<{ startTime: string; endTime: string; avgPm25: number; avgAqi: number; totalExposure: number }> = [];
  for (let i = 0; i <= slots.length - 4; i++) {
    const slice = slots.slice(i, i + 4);
    const avgPm25 = Math.round((slice.reduce((s, x) => s + x.pm25, 0) / 4) * 10) / 10;
    const avgAqi = Math.round(slice.reduce((s, x) => s + x.aqi, 0) / 4);
    const totalExposure = Math.round(
      slice.reduce((s, x) => s + computeExposureScore(x.pm25, 2.1, 1), 0)
    );
    blocks.push({
      startTime: slice[0].time,
      endTime: slice[3].time,
      avgPm25,
      avgAqi,
      totalExposure,
    });
  }
  blocks.sort((a, b) => a.totalExposure - b.totalExposure);

  return {
    slots,
    bestTop3,
    worstSlot,
    best4hRiderBlocks: blocks.slice(0, 3),
  };
}

export interface SchoolDecision {
  status: 'open' | 'limit_outdoor' | 'indoor_masks' | 'online_closure' | 'emergency';
  labelEn: string;
  labelUr: string;
  summaryEn: string;
  summaryUr: string;
  colorClass: string;
  maxAqi24h: number;
  currentAqi: number;
}

export function evaluateSchoolDecision(currentAqi: number, maxAqi24h: number): SchoolDecision {
  const governing = Math.max(currentAqi, maxAqi24h);
  if (governing > 300) {
    return {
      status: 'emergency',
      labelEn: 'Emergency Closure Recommended',
      labelUr: 'ہنگامی تعطیل / آن لائن کلاسز',
      summaryEn: 'Hazardous smog (>300 AQI). Suspend physical attendance and outdoor activity immediately.',
      summaryUr: 'خطرناک اسموگ (300 سے زائد AQI)۔ فوری طور پر اسکول اور بیرونی سرگرمیاں بند کریں۔',
      colorClass: 'bg-rose-950/15 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200 border-rose-700/40',
      maxAqi24h,
      currentAqi,
    };
  }
  if (governing > 200) {
    return {
      status: 'online_closure',
      labelEn: 'Recommend Closure / Online Classes',
      labelUr: 'اسکول بند / آن لائن کلاسز کی سفارش',
      summaryEn: 'Very Unhealthy air (>200 AQI). Shift classes online and cancel assemblies/commutes.',
      summaryUr: 'انتہائی غیر صحت بخش ہوا (200 سے زائد AQI)۔ آن لائن کلاسز اور گھر سے کام کو ترجیح دیں۔',
      colorClass: 'bg-purple-500/12 text-purple-900 dark:text-purple-200 border-purple-500/40',
      maxAqi24h,
      currentAqi,
    };
  }
  if (governing >= 151) {
    return {
      status: 'indoor_masks',
      labelEn: 'Indoor Only + Mandatory Masks',
      labelUr: 'صرف اندرونی کلاسز + لازمی ماسک',
      summaryEn: 'Unhealthy air (151–200 AQI). Cancel outdoor PE/recess, seal classrooms, enforce N95/surgical masks.',
      summaryUr: 'غیر صحت بخش ہوا (151–200 AQI)۔ میدان کی سرگرمیاں بند رکھیں اور ماسک لازمی قرار دیں۔',
      colorClass: 'bg-red-500/12 text-red-900 dark:text-red-200 border-red-500/40',
      maxAqi24h,
      currentAqi,
    };
  }
  if (governing >= 101) {
    return {
      status: 'limit_outdoor',
      labelEn: 'Limit Outdoor Sports',
      labelUr: 'بیرونی کھیل محدود رکھیں',
      summaryEn: 'Unhealthy for Sensitive Groups (101–150 AQI). Move sports indoors for asthma/young students.',
      summaryUr: 'حساس طلبہ کے لیے غیر صحت بخش (101–150 AQI)۔ دمہ کے شکار طلبہ کو اندر رکھیں۔',
      colorClass: 'bg-orange-500/12 text-orange-900 dark:text-orange-200 border-orange-500/40',
      maxAqi24h,
      currentAqi,
    };
  }
  return {
    status: 'open',
    labelEn: 'Normal Operations Open',
    labelUr: 'معمول کے مطابق کھلا',
    summaryEn: 'AQI below 100. Normal classes and outdoor schedules may proceed with routine monitoring.',
    summaryUr: 'AQI 100 سے کم ہے۔ معمول کے مطابق تعلیمی سرگرمیاں جاری رکھیں۔',
    colorClass: 'bg-emerald-500/12 text-emerald-900 dark:text-emerald-200 border-emerald-500/40',
    maxAqi24h,
    currentAqi,
  };
}
