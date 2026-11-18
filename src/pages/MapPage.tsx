import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Flame, Navigation, MapPin } from 'lucide-react';
import { AQI_CATEGORIES, formatNumber, getAqiCategory, windDirectionLabel } from '../lib/aqi';
import { t } from '../lib/i18n';
import type {
  CommunityReport,
  FirmsHotspot,
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
} from '../types';

interface MapPageProps {
  cities: LocationAirSnapshot[];
  zones: LocationAirSnapshot[];
  weather: LahoreWeatherSnapshot | null;
  firms: FirmsHotspot[];
  firmsError: string | null;
  hasFirmsKey: boolean;
  reports: CommunityReport[];
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  lastUpdated: number | null;
  onOpenSettings: () => void;
}

export const MapPage: React.FC<MapPageProps> = ({
  cities,
  zones,
  weather,
  firms,
  firmsError,
  hasFirmsKey,
  reports,
  lang,
  useUrduNumerals,
  liteMode,
  lastUpdated,
  onOpenSettings,
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const [focusView, setFocusView] = useState<'lahore' | 'pakistan'>('lahore');

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const windArrowIcon = useMemo(() => {
    const deg = weather?.current.wind_direction_10m ?? 0;
    const speed = weather?.current.wind_speed_10m ?? 0;
    return L.divIcon({
      className: 'saans-wind-marker',
      html: `<div style="display:flex;align-items:center;gap:4px;background:#0B3C5D;color:#fff;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.25);white-space:nowrap;">
        <span style="display:inline-block;transform:rotate(${deg}deg);">↓</span>
        <span>${speed.toFixed(1)} km/h</span>
      </div>`,
      iconSize: [96, 26],
      iconAnchor: [48, 13],
    });
  }, [weather]);

  const reportIcon = useMemo(() => {
    return L.divIcon({
      className: 'saans-report-marker',
      html: `<div style="width:16px;height:16px;border-radius:999px;background:#F97316;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }, []);

  const center: [number, number] = focusView === 'lahore' ? [31.5204, 74.3587] : [30.8, 71.5];
  const zoom = focusView === 'lahore' ? 11 : 6;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isUr ? 'براہِ راست اسموگ اور ہاٹ اسپاٹ نقشہ' : 'Live Smog & Hotspot Map'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {copy.sourceLabel} · {copy.lastUpdated}: {formattedTime}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setFocusView('lahore')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  focusView === 'lahore'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isUr ? 'لاہور زونز' : 'Lahore Zones'}
              </button>
              <button
                type="button"
                onClick={() => setFocusView('pakistan')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  focusView === 'pakistan'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isUr ? 'پاکستان کے شہر' : 'Pakistan Cities'}
              </button>
            </div>
          </div>
        </div>

        {/* NASA FIRMS status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Flame className="w-4 h-4 text-orange-500 shrink-0" />
            {hasFirmsKey ? (
              firmsError ? (
                <span className="text-red-600 dark:text-red-400">
                  NASA FIRMS: {firmsError}
                </span>
              ) : (
                <span>
                  {isUr
                    ? `گزشتہ 24 گھنٹوں میں پنجاب کے اطراف ${formatNumber(firms.length, lang, useUrduNumerals)} آگ کے مقامات (VIIRS)`
                    : `NASA FIRMS (last 24h Punjab): ${firms.length} active thermal hotspots plotted`}
                </span>
              )
            ) : (
              <span>
                {isUr
                  ? 'فصل جلانے کے مقامات دیکھنے کے لیے ترتیبات میں مفت NASA FIRMS کلید شامل کریں۔'
                  : 'Add a free NASA FIRMS MAP_KEY in Settings to enable stubble-burning hotspots.'}
              </span>
            )}
          </div>
          {!hasFirmsKey && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
            >
              {isUr ? 'کلید شامل کریں' : 'Add FIRMS key'}
            </button>
          )}
        </div>

        {/* Map container or Lite Mode fallback */}
        {liteMode ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
            <MapPin className="w-6 h-6 mx-auto text-slate-400" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {isUr ? 'لائٹ موڈ میں نقشہ بند ہے' : 'Interactive Map Paused in Lite Mode'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isUr
                ? 'ڈیٹا بچانے کے لیے نقشے کے ٹائلز لوڈ نہیں کیے گئے۔ نیچے تمام زونز کا خلاصہ دیکھیں۔'
                : 'Map tiles are disabled to conserve bandwidth. Disable Lite Mode in Settings to view the interactive map.'}
            </p>
          </div>
        ) : (
          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <MapContainer
              key={`${focusView}`}
              center={center}
              zoom={zoom}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Cities */}
              {cities.map((c) => {
                const aqi = Math.round(c.current.us_aqi);
                const cat = getAqiCategory(aqi);
                return (
                  <CircleMarker
                    key={c.location.id}
                    center={[c.location.lat, c.location.lon]}
                    radius={focusView === 'pakistan' ? 14 : 11}
                    pathOptions={{
                      color: cat.color,
                      fillColor: cat.color,
                      fillOpacity: 0.72,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-slate-900">
                          {isUr ? c.location.nameUr : c.location.name}
                        </div>
                        <div>
                          {cat.emoji} US AQI: <strong>{aqi}</strong> ({isUr ? cat.labelUr : cat.labelEn})
                        </div>
                        <div>PM2.5: {c.current.pm2_5.toFixed(1)} µg/m³</div>
                        <div className="text-slate-500">Updated: {c.current.time.replace('T', ' ')}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* Lahore Zones */}
              {zones.map((z) => {
                const aqi = Math.round(z.current.us_aqi);
                const cat = getAqiCategory(aqi);
                return (
                  <CircleMarker
                    key={z.location.id}
                    center={[z.location.lat, z.location.lon]}
                    radius={9}
                    pathOptions={{
                      color: '#0B3C5D',
                      fillColor: cat.color,
                      fillOpacity: 0.85,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-slate-900">
                          {isUr ? z.location.nameUr : z.location.name}
                        </div>
                        <div>
                          {cat.emoji} US AQI: <strong>{aqi}</strong>
                        </div>
                        <div>PM2.5: {z.current.pm2_5.toFixed(1)} µg/m³</div>
                        <div className="text-slate-500">CAMS ~10km grid</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* Wind Direction Overlay */}
              {weather && <Marker position={[31.56, 74.35]} icon={windArrowIcon} />}

              {/* Optional NASA FIRMS Fire Hotspots */}
              {firms.map((f, idx) => (
                <CircleMarker
                  key={`firms_${idx}`}
                  center={[f.latitude, f.longitude]}
                  radius={5}
                  pathOptions={{
                    color: '#9A3412',
                    fillColor: '#F97316',
                    fillOpacity: 0.85,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-orange-700">VIIRS Fire Hotspot</div>
                      <div>Date: {f.acqDate} {f.acqTime} UTC</div>
                      <div>FRP: {f.frp} MW · Confidence: {f.confidence}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Community Reports */}
              {reports.map((rep) => (
                <Marker key={rep.id} position={[rep.lat, rep.lon]} icon={reportIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-900">{rep.zoneName}</div>
                      <div>{rep.description}</div>
                      <div className="text-slate-500">Confirmed by {rep.upvotes} citizens</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Map Legend & Wind Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            {AQI_CATEGORIES.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: c.color }}
                />
                <span>{isUr ? c.labelUr : c.labelEn}</span>
              </span>
            ))}
          </div>
          {weather && (
            <div className="inline-flex items-center gap-1.5 font-mono-tabular">
              <Navigation className="w-3.5 h-3.5 text-teal-600" />
              <span>
                {isUr ? 'ہوا کا رخ' : 'Wind'}: {weather.current.wind_speed_10m} km/h{' '}
                {windDirectionLabel(weather.current.wind_direction_10m, lang)}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
