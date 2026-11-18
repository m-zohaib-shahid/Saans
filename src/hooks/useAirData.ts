import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAllCitiesAirQuality,
  fetchAllLahoreZones,
  fetchFirmsHotspots,
} from '../services/airQualityService';
import { fetchLahoreWeather } from '../services/weatherService';
import { trainRidgeInIdle } from '../lib/ridge';
import type {
  FirmsHotspot,
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
  RidgeForecastResult,
} from '../types';

const CACHE_KEY = 'saans_live_cache_v1';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface CachedPayload {
  cities: LocationAirSnapshot[];
  zones: LocationAirSnapshot[];
  weather: LahoreWeatherSnapshot;
  firms: FirmsHotspot[];
  savedAt: number;
}

export interface AirDataState {
  cities: LocationAirSnapshot[];
  zones: LocationAirSnapshot[];
  lahore: LocationAirSnapshot | null;
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  firms: FirmsHotspot[];
  firmsError: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  usingCached: boolean;
  lastUpdated: number | null;
  minutesAgo: number;
  refresh: () => Promise<void>;
}

export function useAirData(options: {
  liteMode: boolean;
  firmsKey: string;
  lang: Language;
  alertThresholdAqi: number;
  notificationsEnabled: boolean;
}): AirDataState {
  const { liteMode, firmsKey, lang, alertThresholdAqi, notificationsEnabled } = options;

  const [cities, setCities] = useState<LocationAirSnapshot[]>([]);
  const [zones, setZones] = useState<LocationAirSnapshot[]>([]);
  const [weather, setWeather] = useState<LahoreWeatherSnapshot | null>(null);
  const [ridge, setRidge] = useState<RidgeForecastResult | null>(null);
  const [firms, setFirms] = useState<FirmsHotspot[]>([]);
  const [firmsError, setFirmsError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingCached, setUsingCached] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [minutesAgo, setMinutesAgo] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const lastAlertedAqiRef = useRef<number | null>(null);

  // Hydrate initial cache immediately for instant rendering / offline readiness
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedPayload;
        if (parsed.cities?.length && parsed.weather) {
          setCities(parsed.cities);
          setZones(parsed.zones ?? []);
          setWeather(parsed.weather);
          setFirms(parsed.firms ?? []);
          setLastUpdated(parsed.savedAt);
          setUsingCached(true);
          setLoading(false);
        }
      }
    } catch {
      // ignore corrupted cache
    }
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Live ticking "x min ago" counter
  useEffect(() => {
    const updateMinutes = () => {
      if (!lastUpdated) {
        setMinutesAgo(0);
      } else {
        setMinutesAgo(Math.max(0, Math.floor((Date.now() - lastUpdated) / 60000)));
      }
    };
    updateMinutes();
    const id = window.setInterval(updateMinutes, 15000);
    return () => window.clearInterval(id);
  }, [lastUpdated]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setFirmsError(null);

    try {
      const [citiesRes, zonesRes, weatherRes] = await Promise.all([
        fetchAllCitiesAirQuality(liteMode),
        fetchAllLahoreZones(liteMode),
        fetchLahoreWeather(14, 3),
      ]);

      let firmsRes: FirmsHotspot[] = [];
      if (firmsKey.trim()) {
        try {
          firmsRes = await fetchFirmsHotspots(firmsKey);
        } catch (err) {
          setFirmsError(err instanceof Error ? err.message : 'FIRMS fetch failed');
        }
      }

      const now = Date.now();
      setCities(citiesRes);
      setZones(zonesRes);
      setWeather(weatherRes);
      setFirms(firmsRes);
      setLastUpdated(now);
      setUsingCached(false);
      setLoading(false);

      const cachePayload: CachedPayload = {
        cities: citiesRes,
        zones: zonesRes,
        weather: weatherRes,
        firms: firmsRes,
        savedAt: now,
      };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      } catch {
        // storage quota full; safe to ignore
      }

      // Check user threshold alert
      const lahoreSnap = citiesRes.find((c) => c.location.id === 'lahore') ?? citiesRes[0];
      if (
        lahoreSnap &&
        notificationsEnabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const aqi = Math.round(lahoreSnap.current.us_aqi);
        if (aqi >= alertThresholdAqi && lastAlertedAqiRef.current !== aqi) {
          lastAlertedAqiRef.current = aqi;
          new Notification(`Saans Alert: Lahore AQI ${aqi}`, {
            body: `PM2.5 is ${lahoreSnap.current.pm2_5.toFixed(1)} µg/m³ (threshold: ${alertThresholdAqi}). Take precautions.`,
            icon: '/pwa-192x192.png',
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setUsingCached(true);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [liteMode, firmsKey, alertThresholdAqi, notificationsEnabled]);

  useEffect(() => {
    void loadAll();
    const timer = window.setInterval(() => {
      void loadAll();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  const lahore = cities.find((c) => c.location.id === 'lahore') ?? cities[0] ?? null;

  // Train Ridge ML model asynchronously in idle callback whenever Lahore AQ + weather updates
  useEffect(() => {
    if (!lahore || !weather) return;
    let cancelled = false;
    trainRidgeInIdle(lahore.hourly, weather.hourly, lahore.current.time, lang).then((res) => {
      if (!cancelled) {
        setRidge(res);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lahore, weather, lang]);

  return {
    cities,
    zones,
    lahore,
    weather,
    ridge,
    firms,
    firmsError,
    loading,
    refreshing,
    error,
    isOffline,
    usingCached,
    lastUpdated,
    minutesAgo,
    refresh: loadAll,
  };
}
