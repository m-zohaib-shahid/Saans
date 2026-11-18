import {
  LAHORE_ZONES,
  NASA_FIRMS_BASE,
  OPEN_METEO_AQ_BASE,
  PAKISTAN_CITIES,
} from './config';
import type { FirmsHotspot, GeoPoint, HourlyAirPoint, LocationAirSnapshot } from '../types';

interface OpenMeteoAqResponse {
  current?: {
    time: string;
    us_aqi: number;
    pm2_5: number;
    pm10: number;
    ozone: number;
    nitrogen_dioxide: number;
    carbon_monoxide: number;
  };
  hourly?: {
    time: string[];
    pm2_5: Array<number | null>;
    us_aqi: Array<number | null>;
  };
}

async function fetchJsonWithRetry<T>(url: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function fetchLocationAirQuality(
  location: GeoPoint,
  pastDays: number,
  forecastDays: number
): Promise<LocationAirSnapshot> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide',
    hourly: 'pm2_5,us_aqi',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: 'Asia/Karachi',
  });

  const data = await fetchJsonWithRetry<OpenMeteoAqResponse>(
    `${OPEN_METEO_AQ_BASE}?${params.toString()}`
  );

  if (!data.current) {
    throw new Error(`Missing current air quality for ${location.name}`);
  }

  const times = data.hourly?.time ?? [];
  const pm25s = data.hourly?.pm2_5 ?? [];
  const aqis = data.hourly?.us_aqi ?? [];

  const hourly: HourlyAirPoint[] = times.map((time, idx) => ({
    time,
    pm2_5: pm25s[idx] ?? null,
    us_aqi: aqis[idx] ?? null,
  }));

  return {
    location,
    current: {
      time: data.current.time,
      us_aqi: Number(data.current.us_aqi ?? 0),
      pm2_5: Number(data.current.pm2_5 ?? 0),
      pm10: Number(data.current.pm10 ?? 0),
      ozone: Number(data.current.ozone ?? 0),
      nitrogen_dioxide: Number(data.current.nitrogen_dioxide ?? 0),
      carbon_monoxide: Number(data.current.carbon_monoxide ?? 0),
    },
    hourly,
    fetchedAt: Date.now(),
  };
}

export async function fetchAllCitiesAirQuality(liteMode: boolean): Promise<LocationAirSnapshot[]> {
  const tasks = PAKISTAN_CITIES.map((city) => {
    const isLahore = city.id === 'lahore';
    const pastDays = isLahore ? 14 : 0;
    const forecastDays = isLahore ? 3 : liteMode ? 1 : 2;
    return fetchLocationAirQuality(city, pastDays, forecastDays);
  });

  const settled = await Promise.allSettled(tasks);
  const results: LocationAirSnapshot[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(item.value);
    }
  }
  if (results.length === 0) {
    throw new Error('Failed to fetch air quality for all Pakistan cities');
  }
  return results;
}

export async function fetchAllLahoreZones(liteMode: boolean): Promise<LocationAirSnapshot[]> {
  const tasks = LAHORE_ZONES.map((zone) =>
    fetchLocationAirQuality(zone, 0, liteMode ? 1 : 2)
  );
  const settled = await Promise.allSettled(tasks);
  const results: LocationAirSnapshot[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(item.value);
    }
  }
  return results;
}

export async function fetchFirmsHotspots(mapKey: string): Promise<FirmsHotspot[]> {
  const cleanKey = mapKey.trim();
  if (!cleanKey) return [];

  const url = `${NASA_FIRMS_BASE}/${encodeURIComponent(cleanKey)}/VIIRS_SNPP_NRT/72,28,76,34/1`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`NASA FIRMS HTTP ${res.status}`);
  }
  const csv = await res.text();
  if (csv.toLowerCase().includes('invalid map_key')) {
    throw new Error('Invalid NASA FIRMS MAP_KEY');
  }

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const brightIdx = headers.indexOf('bright_ti4');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const confIdx = headers.indexOf('confidence');
  const frpIdx = headers.indexOf('frp');

  const hotspots: FirmsHotspot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = Number(cols[latIdx]);
    const lon = Number(cols[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    hotspots.push({
      latitude: lat,
      longitude: lon,
      brightness: Number(cols[brightIdx] ?? 0),
      acqDate: cols[dateIdx] ?? '',
      acqTime: cols[timeIdx] ?? '',
      confidence: cols[confIdx] ?? 'n',
      frp: Number(cols[frpIdx] ?? 0),
    });
  }
  return hotspots;
}
