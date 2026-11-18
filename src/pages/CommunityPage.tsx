import React, { useState } from 'react';
import { Award, MapPin, ThumbsUp, Camera, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { LAHORE_ZONES } from '../services/config';
import {
  HERO_BADGES,
  saveCommunityReport,
  toggleReportUpvote,
} from '../services/reportsService';
import type { CommunityReport, HeroProgress, Language, ReportType } from '../types';

interface CommunityPageProps {
  reports: CommunityReport[];
  onReportsChange: (next: CommunityReport[]) => void;
  hero: HeroProgress;
  heroName: string;
  userId?: string | null;
  onAwardPoints: (action: 'report' | 'mask') => void;
  lang: Language;
}

const REPORT_TYPES: Array<{ id: ReportType; en: string; ur: string }> = [
  { id: 'crop', en: 'Crop / Stubble Burning', ur: 'فصل کی باقیات جلانا' },
  { id: 'garbage', en: 'Garbage / Tire Burning', ur: 'کوڑا یا ٹائر جلانا' },
  { id: 'vehicle', en: 'Smoky Vehicle', ur: 'دھواں چھوڑتی گاڑی' },
  { id: 'kiln', en: 'Brick Kiln Smoke', ur: 'اینٹوں کا بھٹہ' },
  { id: 'dust', en: 'Construction Dust', ur: 'تعمیراتی گردوغبار' },
];

export const CommunityPage: React.FC<CommunityPageProps> = ({
  reports,
  onReportsChange,
  hero,
  heroName,
  userId,
  onAwardPoints,
  lang,
}) => {
  const isUr = lang === 'ur';
  const [type, setType] = useState<ReportType>('garbage');
  const [zoneId, setZoneId] = useState<string>(LAHORE_ZONES[0].id);
  const [lat, setLat] = useState<number>(LAHORE_ZONES[0].lat);
  const [lon, setLon] = useState<number>(LAHORE_ZONES[0].lon);
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const pledgedToday = hero.maskPledgedToday === today;

  const handleZoneChange = (id: string) => {
    setZoneId(id);
    const z = LAHORE_ZONES.find((item) => item.id === id);
    if (z) {
      setLat(z.lat);
      setLon(z.lon);
    }
  };

  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage(isUr ? 'لوکیشن دستیاب نہیں' : 'Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLon(Math.round(pos.coords.longitude * 10000) / 10000);
        setGeoMessage(isUr ? 'آپ کا مقام حاصل کر لیا گیا' : 'GPS coordinates attached');
      },
      () => {
        setGeoMessage(isUr ? 'لوکیشن کی اجازت نہیں ملی' : 'Location permission declined');
      }
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    try {
      const zone = LAHORE_ZONES.find((z) => z.id === zoneId);
      const { report } = await saveCommunityReport({
        type,
        lat,
        lon,
        zoneName: zone ? (isUr ? zone.nameUr : zone.name) : `${lat}, ${lon}`,
        description: description.trim(),
        photoDataUrl,
        author: heroName || 'Lahore Citizen',
        userId,
      });
      onReportsChange([report, ...reports]);
      onAwardPoints('report');
      setDescription('');
      setPhotoDataUrl(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    const updated = await toggleReportUpvote(id, reports, userId);
    onReportsChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Clean Air Hero Gamification */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isUr ? 'کلین ایئر ہیرو اور کمیونٹی ایکشن' : 'Clean Air Hero & Community Action'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {userId
                  ? isUr
                    ? 'آلودگی کی نشاندہی کریں، ماسک کا عہد کریں، اور InsForge کلاؤڈ پر پوائنٹس محفوظ کریں'
                    : 'Report pollution sources, take the daily N95 pledge, and sync badges to InsForge Cloud'
                  : isUr
                  ? 'مہمان موڈ: مقامی براؤزر اسٹوریج — کلاؤڈ سنک کے لیے سائن ان کریں'
                  : 'Guest mode (local preview) — sign in to publish reports & sync Hero points'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-end">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isUr ? 'آپ کے پوائنٹس' : 'Your Points'}
              </div>
              <div className="text-2xl font-bold font-mono-tabular text-teal-700 dark:text-teal-400">
                {hero.points}
              </div>
            </div>

            <button
              type="button"
              disabled={pledgedToday}
              onClick={() => onAwardPoints('mask')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                pledgedToday
                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30'
                  : 'bg-[#0B3C5D] text-white hover:bg-[#092f4a]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {pledgedToday
                  ? isUr
                    ? 'آج کا ماسک عہد مکمل (+20)'
                    : 'Mask Pledge Signed Today (+20)'
                  : isUr
                  ? 'آج N95 ماسک کا عہد کریں (+20)'
                  : 'Take Daily Mask Pledge (+20 pts)'}
              </span>
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HERO_BADGES.map((b) => {
            const unlocked = hero.points >= b.thresholdPoints;
            return (
              <div
                key={b.id}
                className={`p-3 rounded-xl border text-xs ${
                  unlocked
                    ? 'border-teal-500/40 bg-teal-500/10 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="text-lg">{b.icon}</div>
                <div className="font-semibold mt-1">{isUr ? b.labelUr : b.labelEn}</div>
                <div className="font-mono-tabular text-[11px] mt-0.5">{b.thresholdPoints} pts</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Report Form + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isUr ? 'دھواں / آگ لگنے کی اطلاع دیں (+25)' : 'Report Burning or Smoke Source (+25 pts)'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                {isUr ? 'آلودگی کی قسم' : 'Incident Type'}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              >
                {REPORT_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {isUr ? rt.ur : rt.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                {isUr ? 'علاقہ / زون' : 'Lahore Zone'}
              </label>
              <div className="flex gap-2">
                <select
                  value={zoneId}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {LAHORE_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {isUr ? z.nameUr : z.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>GPS</span>
                </button>
              </div>
              {geoMessage && (
                <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1">
                  {geoMessage} ({lat}, {lon})
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                {isUr ? 'تفصیل' : 'Description'}
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isUr ? 'مقام اور صورتحال لکھیں...' : 'Describe exact location and visible smoke...'
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400 cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>{isUr ? 'تصویر منسلک کریں (اختیاری)' : 'Attach Photo (optional)'}</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
              {photoDataUrl && (
                <img
                  src={photoDataUrl}
                  alt="Report preview"
                  className="mt-2 h-24 w-36 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] disabled:opacity-60"
            >
              {submitting
                ? isUr
                  ? 'محفوظ ہو رہا ہے...'
                  : 'Submitting...'
                : isUr
                ? 'رپورٹ جمع کروائیں'
                : 'Submit Citizen Report'}
            </button>
          </form>
        </section>

        {/* Citizen Reports Feed */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isUr ? 'کمیونٹی رپورٹس فیڈ' : 'Live Community Reports Feed'}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {userId
                ? isUr
                  ? 'InsForge کلاؤڈ ڈیٹا بیس'
                  : 'InsForge Cloud Postgres'
                : isUr
                ? 'مہمان مقامی پیش نظارہ'
                : 'Public feed · local guest preview'}
            </span>
          </div>

          {reports.length === 0 ? (
            <EmptyState
              titleEn="No citizen reports yet"
              titleUr="ابھی کوئی رپورٹ درج نہیں ہوئی"
              descEn="Submit the first verified smoke or waste-burning observation in Lahore to earn +25 Hero points."
              descUr="لاہور میں دھواں یا کوڑا جلانے کی پہلی اطلاع دیں اور +25 ہیرو پوائنٹس حاصل کریں۔"
              lang={lang}
            />
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => {
                const typeObj = REPORT_TYPES.find((r) => r.id === rep.type);
                return (
                  <div
                    key={rep.id}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {typeObj ? (isUr ? typeObj.ur : typeObj.en) : rep.type} · {rep.zoneName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {rep.author} · {new Date(rep.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpvote(rep.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                          rep.upvotedByMe
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="font-mono-tabular">{rep.upvotes}</span>
                      </button>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{rep.description}</p>
                    {rep.photoDataUrl && (
                      <img
                        src={rep.photoDataUrl}
                        alt={rep.zoneName}
                        className="h-32 w-48 object-cover rounded-lg"
                      />
                    )}
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
