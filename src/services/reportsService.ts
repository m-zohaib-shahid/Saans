import { insforge } from './insforgeClient';
import type { CommunityReport, HeroProgress, ReportType } from '../types';

const REPORTS_KEY = 'saans_community_reports_v1';
const HERO_KEY = 'saans_hero_progress_v1';

export interface BadgeDef {
  id: string;
  labelEn: string;
  labelUr: string;
  thresholdPoints: number;
  icon: string;
}

export const HERO_BADGES: BadgeDef[] = [
  { id: 'watcher', labelEn: 'Air Watcher', labelUr: 'فضا نگہبان', thresholdPoints: 10, icon: '👁️' },
  { id: 'masked', labelEn: 'Mask Guardian', labelUr: 'ماسک محافظ', thresholdPoints: 30, icon: '😷' },
  { id: 'reporter', labelEn: 'Smog Scout', labelUr: 'اسموگ اسکاؤٹ', thresholdPoints: 60, icon: '📍' },
  { id: 'champion', labelEn: 'Clean Air Hero', labelUr: 'صاف ہوا ہیرو', thresholdPoints: 120, icon: '🛡️' },
];

export interface DailyChallengeDef {
  id: string;
  labelEn: string;
  labelUr: string;
  points: number;
}

export const DAILY_CHALLENGES: DailyChallengeDef[] = [
  {
    id: 'mask_commute',
    labelEn: 'Wear an N95 mask on today’s commute',
    labelUr: 'آج کے سفر میں N95 ماسک پہنیں',
    points: 15,
  },
  {
    id: 'check_advice',
    labelEn: 'Check live AQI & advice before going out',
    labelUr: 'باہر نکلنے سے پہلے لائیو AQI اور مشورہ دیکھیں',
    points: 15,
  },
  {
    id: 'seal_windows',
    labelEn: 'Seal windows during evening smog peak',
    labelUr: 'شام کے اسموگ پیک کے دوران کھڑکیاں بند رکھیں',
    points: 15,
  },
];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function updateStreak(current: HeroProgress): { streakDays: number; lastActiveDate: string } {
  const today = getTodayIso();
  const yesterday = getYesterdayIso();
  const prevDate = current.lastActiveDate ?? null;
  const prevStreak = current.streakDays ?? 0;

  if (prevDate === today) {
    return { streakDays: Math.max(1, prevStreak), lastActiveDate: today };
  }
  if (prevDate === yesterday) {
    return { streakDays: prevStreak + 1, lastActiveDate: today };
  }
  return { streakDays: 1, lastActiveDate: today };
}

export function loadCommunityReports(): CommunityReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommunityReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cacheCommunityReports(reports: CommunityReport[]): void {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchCommunityReports(userId?: string | null): Promise<CommunityReport[]> {
  try {
    const { data, error } = await insforge.database
      .from('community_reports')
      .select('id, type, lat, lon, zone_name, description, photo_data_url, author_name, upvotes_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      return loadCommunityReports();
    }

    let upvotedIds = new Set<string>();
    if (userId) {
      const { data: votes } = await insforge.database
        .from('report_upvotes')
        .select('report_id')
        .eq('user_id', userId);
      if (Array.isArray(votes)) {
        upvotedIds = new Set(votes.map((v) => String(v.report_id)));
      }
    }

    const mapped: CommunityReport[] = data.map((row) => ({
      id: String(row.id),
      type: row.type as ReportType,
      lat: Number(row.lat),
      lon: Number(row.lon),
      zoneName: String(row.zone_name),
      description: String(row.description),
      photoDataUrl: row.photo_data_url ? String(row.photo_data_url) : undefined,
      upvotes: Number(row.upvotes_count ?? 1),
      upvotedByMe: upvotedIds.has(String(row.id)),
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
      author: String(row.author_name || 'Lahore Citizen'),
    }));

    cacheCommunityReports(mapped);
    return mapped;
  } catch {
    return loadCommunityReports();
  }
}

export async function saveCommunityReport(input: {
  type: ReportType;
  lat: number;
  lon: number;
  zoneName: string;
  description: string;
  photoDataUrl?: string;
  author: string;
  userId?: string | null;
}): Promise<{ report: CommunityReport; syncedToCloud: boolean }> {
  const existing = loadCommunityReports();

  if (input.userId) {
    const { data, error } = await insforge.database
      .from('community_reports')
      .insert([
        {
          user_id: input.userId,
          type: input.type,
          lat: input.lat,
          lon: input.lon,
          zone_name: input.zoneName,
          description: input.description,
          photo_data_url: input.photoDataUrl ?? null,
          author_name: input.author,
          upvotes_count: 1,
        },
      ])
      .select('id, type, lat, lon, zone_name, description, photo_data_url, author_name, upvotes_count, created_at')
      .single();

    if (!error && data) {
      const reportId = String(data.id);
      await insforge.database
        .from('report_upvotes')
        .insert([{ report_id: reportId, user_id: input.userId }]);

      const created: CommunityReport = {
        id: reportId,
        type: data.type as ReportType,
        lat: Number(data.lat),
        lon: Number(data.lon),
        zoneName: String(data.zone_name),
        description: String(data.description),
        photoDataUrl: data.photo_data_url ? String(data.photo_data_url) : undefined,
        upvotes: Number(data.upvotes_count ?? 1),
        upvotedByMe: true,
        createdAt: data.created_at ? new Date(String(data.created_at)).getTime() : Date.now(),
        author: String(data.author_name || input.author),
      };

      cacheCommunityReports([created, ...existing]);
      return { report: created, syncedToCloud: true };
    }
  }

  const fallbackCreated: CommunityReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    lat: input.lat,
    lon: input.lon,
    zoneName: input.zoneName,
    description: input.description,
    photoDataUrl: input.photoDataUrl,
    author: input.author,
    upvotes: 1,
    upvotedByMe: true,
    createdAt: Date.now(),
  };
  cacheCommunityReports([fallbackCreated, ...existing]);
  return { report: fallbackCreated, syncedToCloud: false };
}

export async function toggleReportUpvote(
  id: string,
  currentReports: CommunityReport[],
  userId?: string | null
): Promise<CommunityReport[]> {
  if (userId && !id.startsWith('rep_')) {
    const { data, error } = await insforge.database.rpc('toggle_report_upvote', {
      p_report_id: id,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      const updated = currentReports.map((r) =>
        r.id === id
          ? {
              ...r,
              upvotedByMe: Boolean(row.upvoted),
              upvotes: Number(row.upvotes_count ?? r.upvotes),
            }
          : r
      );
      cacheCommunityReports(updated);
      return updated;
    }
  }

  const updated = currentReports.map((r) => {
    if (r.id !== id) return r;
    const nextUpvoted = !r.upvotedByMe;
    return {
      ...r,
      upvotedByMe: nextUpvoted,
      upvotes: Math.max(0, r.upvotes + (nextUpvoted ? 1 : -1)),
    };
  });
  cacheCommunityReports(updated);
  return updated;
}

export function loadHeroProgress(): HeroProgress {
  try {
    const raw = localStorage.getItem(HERO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HeroProgress;
      return {
        points: parsed.points ?? 0,
        badges: parsed.badges ?? [],
        actionsCount: parsed.actionsCount ?? {
          reports: 0,
          shares: 0,
          adviceChecks: 0,
          maskPledges: 0,
        },
        maskPledgedToday: parsed.maskPledgedToday ?? null,
        streakDays: parsed.streakDays ?? 1,
        lastActiveDate: parsed.lastActiveDate ?? getTodayIso(),
        completedChallenges: parsed.completedChallenges ?? {},
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    points: 0,
    badges: [],
    actionsCount: { reports: 0, shares: 0, adviceChecks: 0, maskPledges: 0 },
    maskPledgedToday: null,
    streakDays: 1,
    lastActiveDate: getTodayIso(),
    completedChallenges: {},
  };
}

export async function fetchHeroProgressFromCloud(userId: string): Promise<HeroProgress> {
  const local = loadHeroProgress();
  try {
    const { data, error } = await insforge.database
      .from('user_profiles')
      .select(
        'hero_points, streak_days, last_active_date, mask_pledged_today, actions_count, completed_challenges, badges'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return local;
    }

    const cloudPoints = Number(data.hero_points ?? 0);
    // Preserve whichever is further along if user had points before syncing
    if (local.points > cloudPoints && cloudPoints === 0) {
      void syncHeroProgressToCloud(userId, local);
      return local;
    }

    const synced: HeroProgress = {
      points: cloudPoints,
      badges: Array.isArray(data.badges) ? (data.badges as string[]) : [],
      actionsCount: (data.actions_count as HeroProgress['actionsCount']) ?? {
        reports: 0,
        shares: 0,
        adviceChecks: 0,
        maskPledges: 0,
      },
      maskPledgedToday: (data.mask_pledged_today as string | null) ?? null,
      streakDays: Number(data.streak_days ?? 1),
      lastActiveDate: (data.last_active_date as string | null) ?? getTodayIso(),
      completedChallenges:
        (data.completed_challenges as Record<string, string[]>) ?? {},
    };
    localStorage.setItem(HERO_KEY, JSON.stringify(synced));
    return synced;
  } catch {
    return local;
  }
}

export async function syncHeroProgressToCloud(
  userId: string,
  progress: HeroProgress
): Promise<void> {
  try {
    await insforge.database
      .from('user_profiles')
      .update({
        hero_points: progress.points,
        streak_days: progress.streakDays ?? 1,
        last_active_date: progress.lastActiveDate ?? getTodayIso(),
        mask_pledged_today: progress.maskPledgedToday,
        actions_count: progress.actionsCount,
        completed_challenges: progress.completedChallenges ?? {},
        badges: progress.badges,
      })
      .eq('id', userId);
  } catch {
    // ignore offline errors; local cache retains latest state
  }
}

export function awardHeroPoints(
  action: 'report' | 'share' | 'advice' | 'mask',
  userId?: string | null
): HeroProgress {
  const current = loadHeroProgress();
  const today = getTodayIso();

  if (action === 'mask' && current.maskPledgedToday === today) {
    return current;
  }

  const ptsMap = { report: 25, share: 15, advice: 10, mask: 20 };
  const nextPoints = current.points + ptsMap[action];
  const nextCounts = { ...current.actionsCount };
  if (action === 'report') nextCounts.reports += 1;
  if (action === 'share') nextCounts.shares += 1;
  if (action === 'advice') nextCounts.adviceChecks += 1;
  if (action === 'mask') nextCounts.maskPledges += 1;

  const unlocked = HERO_BADGES.filter((b) => nextPoints >= b.thresholdPoints).map((b) => b.id);
  const streak = updateStreak(current);

  const next: HeroProgress = {
    points: nextPoints,
    badges: unlocked,
    actionsCount: nextCounts,
    maskPledgedToday: action === 'mask' ? today : current.maskPledgedToday,
    streakDays: streak.streakDays,
    lastActiveDate: streak.lastActiveDate,
    completedChallenges: current.completedChallenges ?? {},
  };
  localStorage.setItem(HERO_KEY, JSON.stringify(next));
  if (userId) {
    void syncHeroProgressToCloud(userId, next);
  }
  return next;
}

export function toggleDailyChallenge(
  challengeId: string,
  userId?: string | null
): HeroProgress {
  const current = loadHeroProgress();
  const today = getTodayIso();
  const existingForDay = current.completedChallenges?.[today] ?? [];
  const challenge = DAILY_CHALLENGES.find((c) => c.id === challengeId);
  const pts = challenge?.points ?? 15;

  const alreadyDone = existingForDay.includes(challengeId);
  const nextForDay = alreadyDone
    ? existingForDay.filter((id) => id !== challengeId)
    : [...existingForDay, challengeId];

  const nextPoints = Math.max(0, current.points + (alreadyDone ? -pts : pts));
  const unlocked = HERO_BADGES.filter((b) => nextPoints >= b.thresholdPoints).map((b) => b.id);
  const streak = updateStreak(current);

  const next: HeroProgress = {
    ...current,
    points: nextPoints,
    badges: unlocked,
    streakDays: streak.streakDays,
    lastActiveDate: streak.lastActiveDate,
    completedChallenges: {
      ...(current.completedChallenges ?? {}),
      [today]: nextForDay,
    },
  };
  localStorage.setItem(HERO_KEY, JSON.stringify(next));
  if (userId) {
    void syncHeroProgressToCloud(userId, next);
  }
  return next;
}
