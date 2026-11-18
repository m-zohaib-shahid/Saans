import { formatHourLabel, pm25ToUsAqi } from './aqi';
import type {
  ForecastChartPoint,
  HourlyAirPoint,
  HourlyWeatherPoint,
  ModelMetrics,
  RidgeForecastResult,
} from '../types';

interface AlignedRow {
  time: string;
  hourOfDay: number;
  pm25: number | null;
  camsAqi: number | null;
  temp: number | null;
  humidity: number | null;
  wind: number | null;
  blh: number | null;
}

const FEATURE_NAMES = [
  'PM2.5 (t-1h)',
  'PM2.5 (t-3h)',
  'PM2.5 (t-24h)',
  '6h Rolling Mean',
  'Temperature (°C)',
  'Humidity (%)',
  'Wind Speed (km/h)',
  'log(Boundary Layer)',
  'Hour sin(2πh/24)',
  'Hour cos(2πh/24)',
];

/**
 * Linearly interpolate isolated gaps (up to maxGap consecutive nulls) so minor
 * missing sensor/model ticks do not discard entire training windows.
 */
function interpolateSeries(values: Array<number | null>, maxGap = 3): Array<number | null> {
  const out = [...values];
  const n = out.length;
  let i = 0;
  while (i < n) {
    if (out[i] === null) {
      let j = i;
      while (j < n && out[j] === null) j++;
      const gapLen = j - i;
      if (gapLen <= maxGap && i > 0 && j < n) {
        const startVal = out[i - 1]!;
        const endVal = out[j]!;
        for (let k = 0; k < gapLen; k++) {
          out[i + k] = startVal + ((endVal - startVal) * (k + 1)) / (gapLen + 1);
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/**
 * Solve linear system A * x = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, idx) => [...row, b[idx]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = r;
      }
    }
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = Math.abs(M[col][col]) < 1e-10 ? 1e-10 : M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

function buildFeatureVector(
  pmSeries: number[],
  idx: number,
  row: AlignedRow
): number[] | null {
  if (idx < 24) return null;
  const lag1 = pmSeries[idx - 1];
  const lag3 = pmSeries[idx - 3];
  const lag24 = pmSeries[idx - 24];
  let sum6 = 0;
  for (let k = 1; k <= 6; k++) {
    const v = pmSeries[idx - k];
    if (!Number.isFinite(v)) return null;
    sum6 += v;
  }
  const rolling6 = sum6 / 6;

  if (
    !Number.isFinite(lag1) ||
    !Number.isFinite(lag3) ||
    !Number.isFinite(lag24) ||
    row.temp === null ||
    row.humidity === null ||
    row.wind === null ||
    row.blh === null
  ) {
    return null;
  }

  const angle = (2 * Math.PI * row.hourOfDay) / 24;
  return [
    lag1,
    lag3,
    lag24,
    rolling6,
    row.temp,
    row.humidity,
    row.wind,
    Math.log(Math.max(row.blh, 10)),
    Math.sin(angle),
    Math.cos(angle),
  ];
}

function computeMetrics(actual: number[], predicted: number[]): ModelMetrics {
  if (actual.length === 0) return { mae: 0, rmse: 0 };
  let absSum = 0;
  let sqSum = 0;
  for (let i = 0; i < actual.length; i++) {
    const err = predicted[i] - actual[i];
    absSum += Math.abs(err);
    sqSum += err * err;
  }
  return {
    mae: Math.round((absSum / actual.length) * 10) / 10,
    rmse: Math.round(Math.sqrt(sqSum / actual.length) * 10) / 10,
  };
}

export function trainAndForecastRidge(
  hourlyAir: HourlyAirPoint[],
  hourlyWeather: HourlyWeatherPoint[],
  currentIsoTime: string,
  lang: 'en' | 'ur'
): RidgeForecastResult | null {
  const weatherByTime = new Map<string, HourlyWeatherPoint>();
  for (const w of hourlyWeather) {
    weatherByTime.set(w.time, w);
  }

  const rawAligned: AlignedRow[] = hourlyAir.map((air) => {
    const w = weatherByTime.get(air.time);
    const match = air.time.match(/T(\d{2})/);
    const hourOfDay = match ? Number(match[1]) : 0;
    return {
      time: air.time,
      hourOfDay,
      pm25: air.pm2_5,
      camsAqi: air.us_aqi,
      temp: w?.temperature_2m ?? null,
      humidity: w?.relative_humidity_2m ?? null,
      wind: w?.wind_speed_10m ?? null,
      blh: w?.boundary_layer_height ?? null,
    };
  });

  if (rawAligned.length < 96) return null;

  const pmInterp = interpolateSeries(rawAligned.map((r) => r.pm25));
  const tempInterp = interpolateSeries(rawAligned.map((r) => r.temp));
  const humInterp = interpolateSeries(rawAligned.map((r) => r.humidity));
  const windInterp = interpolateSeries(rawAligned.map((r) => r.wind));
  const blhInterp = interpolateSeries(rawAligned.map((r) => r.blh));

  const aligned: AlignedRow[] = rawAligned.map((r, idx) => ({
    ...r,
    pm25: pmInterp[idx],
    temp: tempInterp[idx],
    humidity: humInterp[idx],
    wind: windInterp[idx],
    blh: blhInterp[idx],
  }));

  // Locate current hour index (last historical/present timestamp <= currentIsoTime)
  let nowIdx = aligned.findIndex((r) => r.time >= currentIsoTime);
  if (nowIdx === -1) {
    nowIdx = Math.max(0, aligned.length - 73);
  }

  // Ensure at least 48h holdout + 48h training + 24h lags
  if (nowIdx < 120) return null;

  const holdoutStart = nowIdx - 47;
  const fullPmSeries = aligned.map((r) => r.pm25 ?? NaN);

  // Assemble training samples strictly before holdoutStart to avoid any leakage
  const trainX: number[][] = [];
  const trainY: number[] = [];
  for (let i = 24; i < holdoutStart; i++) {
    const y = fullPmSeries[i];
    if (!Number.isFinite(y)) continue;
    const x = buildFeatureVector(fullPmSeries, i, aligned[i]);
    if (!x) continue;
    trainX.push(x);
    trainY.push(y);
  }

  if (trainX.length < 48) return null;

  const numFeatures = trainX[0].length;
  const n = trainX.length;

  // Standardize features (zero mean, unit variance) and center y
  const means = new Array<number>(numFeatures).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < numFeatures; j++) means[j] += trainX[i][j];
  }
  for (let j = 0; j < numFeatures; j++) means[j] /= n;

  const stds = new Array<number>(numFeatures).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < numFeatures; j++) {
      const d = trainX[i][j] - means[j];
      stds[j] += d * d;
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    stds[j] = Math.sqrt(stds[j] / n);
    if (stds[j] < 1e-6) stds[j] = 1;
  }

  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += trainY[i];
  yMean /= n;

  const Xstd = trainX.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
  const yCentered = trainY.map((v) => v - yMean);

  // Normal equations: (X^T X + lambda * I) * w = X^T y
  const lambda = 14.0;
  const XtX: number[][] = Array.from({ length: numFeatures }, () =>
    new Array<number>(numFeatures).fill(0)
  );
  const Xty = new Array<number>(numFeatures).fill(0);

  for (let i = 0; i < n; i++) {
    const row = Xstd[i];
    const target = yCentered[i];
    for (let j = 0; j < numFeatures; j++) {
      Xty[j] += row[j] * target;
      for (let k = j; k < numFeatures; k++) {
        XtX[j][k] += row[j] * row[k];
      }
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    for (let k = 0; k < j; k++) {
      XtX[j][k] = XtX[k][j];
    }
    XtX[j][j] += lambda;
  }

  const weights = solveLinearSystem(XtX, Xty);

  const predictRow = (pmBuf: number[], idx: number): number | null => {
    const rawVec = buildFeatureVector(pmBuf, idx, aligned[idx]);
    if (!rawVec) return null;
    let pred = yMean;
    for (let j = 0; j < numFeatures; j++) {
      pred += weights[j] * ((rawVec[j] - means[j]) / stds[j]);
    }
    return Math.max(1, Math.round(pred * 10) / 10);
  };

  // Evaluate 48h holdout using two 24-hour recursive rollouts (honest multi-step test)
  const holdoutActual: number[] = [];
  const holdoutRidge: number[] = [];
  const holdoutPersistence: number[] = [];
  const holdoutPredMap = new Map<number, number>();

  for (const blockOffset of [0, 24]) {
    const blockStart = holdoutStart + blockOffset;
    const blockEnd = Math.min(nowIdx, blockStart + 23);
    const simBuf = [...fullPmSeries];

    for (let idx = blockStart; idx <= blockEnd; idx++) {
      const actualVal = fullPmSeries[idx];
      const pred = predictRow(simBuf, idx);
      if (pred !== null) {
        simBuf[idx] = pred;
        holdoutPredMap.set(idx, pred);
      }
      const pers = fullPmSeries[idx - 24];
      if (Number.isFinite(actualVal) && pred !== null && Number.isFinite(pers)) {
        holdoutActual.push(actualVal);
        holdoutRidge.push(pred);
        holdoutPersistence.push(pers);
      }
    }
  }

  const ridgeMetrics = computeMetrics(holdoutActual, holdoutRidge);
  const persistenceMetrics = computeMetrics(holdoutActual, holdoutPersistence);

  const improvementVsPersistencePct =
    persistenceMetrics.mae > 0
      ? Math.round(((persistenceMetrics.mae - ridgeMetrics.mae) / persistenceMetrics.mae) * 1000) / 10
      : 0;
  const beatsPersistence = ridgeMetrics.mae < persistenceMetrics.mae;

  const absImp = Math.abs(improvementVsPersistencePct);
  const verdictEn = beatsPersistence
    ? `Our Ridge model beats 24h persistence by ${absImp}% on MAE (${ridgeMetrics.mae} vs ${persistenceMetrics.mae} µg/m³) over the 48h holdout.`
    : `Honest check: 24h persistence beats our Ridge model by ${absImp}% on MAE (${persistenceMetrics.mae} vs ${ridgeMetrics.mae} µg/m³) during this period.`;

  const verdictUr = beatsPersistence
    ? `ہمارا رج ماڈل 48 گھنٹے کی جانچ میں 24 گھنٹے کے پرسسٹنس بیس لائن سے ${absImp}% بہتر رہا (${ridgeMetrics.mae} بمقابلہ ${persistenceMetrics.mae} µg/m³)۔`
    : `ایماندارانہ جائزہ: اس وقت 24 گھنٹے کا پرسسٹنس بیس لائن ہمارے رج ماڈل سے ${absImp}% بہتر رہا (${persistenceMetrics.mae} بمقابلہ ${ridgeMetrics.mae} µg/m³)۔`;

  // Recursive 24h future prediction using Open-Meteo weather forecast covariates
  const futureSimBuf = [...fullPmSeries];
  const future24h: RidgeForecastResult['future24h'] = [];
  const futureRidgeMap = new Map<number, number>();

  const futureEnd = Math.min(aligned.length - 1, nowIdx + 24);
  for (let idx = nowIdx + 1; idx <= futureEnd; idx++) {
    const pred = predictRow(futureSimBuf, idx);
    const camsPm25 = aligned[idx].pm25 ?? pred ?? 0;
    const finalPm = pred ?? camsPm25;
    futureSimBuf[idx] = finalPm;
    futureRidgeMap.set(idx, finalPm);

    future24h.push({
      time: aligned[idx].time,
      pm25: Math.round(finalPm * 10) / 10,
      aqi: pm25ToUsAqi(finalPm),
      camsPm25: Math.round(camsPm25 * 10) / 10,
      camsAqi: aligned[idx].camsAqi ?? pm25ToUsAqi(camsPm25),
    });
  }

  let peakForecast: RidgeForecastResult['peakForecast'] = null;
  for (const item of future24h) {
    if (!peakForecast || item.pm25 > peakForecast.pm25) {
      peakForecast = { time: item.time, pm25: item.pm25, aqi: item.aqi };
    }
  }

  // Build combined chart series: 48h holdout + up to 72h future forecast
  const chartEnd = Math.min(aligned.length - 1, nowIdx + 72);
  const chartSeries: ForecastChartPoint[] = [];
  for (let idx = holdoutStart; idx <= chartEnd; idx++) {
    const row = aligned[idx];
    const isFuture = idx > nowIdx;
    const ridgeVal = isFuture ? (futureRidgeMap.get(idx) ?? null) : (holdoutPredMap.get(idx) ?? null);
    const camsVal = row.pm25 !== null ? Math.round(row.pm25 * 10) / 10 : null;
    chartSeries.push({
      time: row.time,
      label: formatHourLabel(row.time, lang),
      actualPm25: !isFuture && row.pm25 !== null ? Math.round(row.pm25 * 10) / 10 : null,
      ridgePm25: ridgeVal !== null ? Math.round(ridgeVal * 10) / 10 : null,
      camsPm25: isFuture ? camsVal : camsVal,
      ridgeAqi: ridgeVal !== null ? pm25ToUsAqi(ridgeVal) : null,
      camsAqi: camsVal !== null ? (row.camsAqi ?? pm25ToUsAqi(camsVal)) : null,
      isFuture,
    });
  }

  const featureWeights = FEATURE_NAMES.map((name, i) => ({
    name,
    weight: Math.round(weights[i] * 100) / 100,
  })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return {
    trainedSamples: trainX.length,
    holdoutHours: holdoutActual.length,
    ridgeMetrics,
    persistenceMetrics,
    camsReferenceNote:
      lang === 'ur'
        ? 'اوپن میٹیو/CAMS تاریخی سیریز خود حوالہ جاتی ڈیٹا ہے؛ مستقبل کا گراف 72 گھنٹے کی CAMS پیشگوئی دکھاتا ہے۔'
        : 'Open-Meteo CAMS historical archive serves as the reference series for the 48h holdout; future horizon compares Ridge ML vs CAMS forecast.',
    improvementVsPersistencePct,
    beatsPersistence,
    verdictEn,
    verdictUr,
    chartSeries,
    future24h,
    peakForecast,
    featureWeights,
  };
}

export function trainRidgeInIdle(
  hourlyAir: HourlyAirPoint[],
  hourlyWeather: HourlyWeatherPoint[],
  currentIsoTime: string,
  lang: 'en' | 'ur'
): Promise<RidgeForecastResult | null> {
  return new Promise((resolve) => {
    const run = () => resolve(trainAndForecastRidge(hourlyAir, hourlyWeather, currentIsoTime, lang));
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
        run,
        { timeout: 350 }
      );
    } else {
      setTimeout(run, 16);
    }
  });
}
