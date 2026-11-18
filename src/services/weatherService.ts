import { OPEN_METEO_WEATHER_BASE } from './config';
import type { HourlyWeatherPoint, LahoreWeatherSnapshot } from '../types';

interface OpenMeteoWeatherResponse {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    visibility: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: Array<number | null>;
    relative_humidity_2m: Array<number | null>;
    wind_speed_10m: Array<number | null>;
    boundary_layer_height: Array<number | null>;
    visibility: Array<number | null>;
  };
}

export async function fetchLahoreWeather(
  pastDays = 14,
  forecastDays = 3
): Promise<LahoreWeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: '31.5204',
    longitude: '74.3587',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,visibility',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,boundary_layer_height,visibility',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: 'Asia/Karachi',
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${OPEN_METEO_WEATHER_BASE}?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
      const data = (await res.json()) as OpenMeteoWeatherResponse;
      if (!data.current) throw new Error('Missing current weather payload');

      const times = data.hourly?.time ?? [];
      const temps = data.hourly?.temperature_2m ?? [];
      const hums = data.hourly?.relative_humidity_2m ?? [];
      const winds = data.hourly?.wind_speed_10m ?? [];
      const blhs = data.hourly?.boundary_layer_height ?? [];
      const vis = data.hourly?.visibility ?? [];

      const hourly: HourlyWeatherPoint[] = times.map((time, idx) => ({
        time,
        temperature_2m: temps[idx] ?? null,
        relative_humidity_2m: hums[idx] ?? null,
        wind_speed_10m: winds[idx] ?? null,
        boundary_layer_height: blhs[idx] ?? null,
        visibility: vis[idx] ?? null,
      }));

      return {
        current: {
          time: data.current.time,
          temperature_2m: Number(data.current.temperature_2m ?? 0),
          relative_humidity_2m: Number(data.current.relative_humidity_2m ?? 0),
          wind_speed_10m: Number(data.current.wind_speed_10m ?? 0),
          wind_direction_10m: Number(data.current.wind_direction_10m ?? 0),
          visibility: Number(data.current.visibility ?? 10000),
        },
        hourly,
        fetchedAt: Date.now(),
      };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}
