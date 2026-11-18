import React, { useState } from 'react';
import { User, Award, Flame, FileText, LogOut, Trash2, Check } from 'lucide-react';
import { PERSONAS, t } from '../lib/i18n';
import { PAKISTAN_CITIES } from '../services/config';
import { HERO_BADGES } from '../services/reportsService';
import type { HeroProgress, PersonaId, UserSession, UserSettings } from '../types';

interface ProfilePageProps {
  session: UserSession;
  settings: UserSettings;
  hero: HeroProgress;
  reportsCount: number;
  onUpdateProfile: (patch: {
    name: string;
    persona: PersonaId;
    city: string;
    alertThresholdAqi: number;
  }) => void;
  onSignOut: () => void;
  onDeleteAllData: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  session,
  settings,
  hero,
  reportsCount,
  onUpdateProfile,
  onSignOut,
  onDeleteAllData,
}) => {
  const lang = settings.language;
  const isUr = lang === 'ur';
  const copy = t(lang);

  const [name, setName] = useState(session.name);
  const [persona, setPersona] = useState<PersonaId>(settings.persona);
  const [city, setCity] = useState(session.city || 'Lahore');
  const [threshold, setThreshold] = useState(settings.alertThresholdAqi);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim() || session.name,
      persona,
      city,
      alertThresholdAqi: threshold,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Profile Stats Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0B3C5D] to-teal-500 text-white font-bold text-lg flex items-center justify-center shrink-0">
              {session.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{session.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {session.isGuest ? (isUr ? 'مہمان سیشن' : 'Guest session') : session.email} ·{' '}
                {session.city}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" />
            <span>{copy.auth.signOut}</span>
          </button>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Award className="w-3.5 h-3.5 text-teal-600" />
              <span>{copy.profile.points}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {hero.points}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>{copy.profile.streak}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {hero.streakDays ?? 1} {copy.profile.days}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>{copy.profile.badgesCount}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {hero.badges.length} / {HERO_BADGES.length}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>{copy.profile.reportsCount}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {reportsCount}
            </div>
          </div>
        </div>
      </section>

      {/* Edit Preferences Form */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {copy.profile.title}
        </h3>

        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {copy.auth.fullName}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {copy.auth.role}
              </label>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as PersonaId)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {isUr ? p.labelUr : p.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {copy.auth.city}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {isUr ? c.nameUr : c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{isUr ? 'AQI الرٹ کی حد' : 'Alert Threshold (US AQI)'}</span>
              <span className="font-mono-tabular text-teal-700 dark:text-teal-400">
                {threshold}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={350}
              step={10}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] active:scale-[0.98] transition-all"
            >
              {saved && <Check className="w-4 h-4 text-teal-300" />}
              <span>{saved ? copy.profile.savedMsg : copy.profile.saveChanges}</span>
            </button>
          </div>
        </form>

        {/* Danger Zone: Delete local data */}
        <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="w-4 h-4" />
              <span>{copy.profile.deleteLocalData}</span>
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3 max-w-xl">
              <p className="text-xs text-red-900 dark:text-red-200">{copy.profile.deleteConfirm}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDeleteAllData}
                  className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  {isUr ? 'ہاں، سب حذف کریں' : 'Yes, delete everything'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {isUr ? 'منسوخ کریں' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
