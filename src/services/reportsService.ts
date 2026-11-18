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

export function saveCommunityReport(input: {
  type: ReportType;
  lat: number;
  lon: number;
  zoneName: string;
  description: string;
  photoDataUrl?: string;
  author: string;
}): CommunityReport {
  const existing = loadCommunityReports();
  const created: CommunityReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    upvotes: 1,
    upvotedByMe: true,
    createdAt: Date.now(),
  };
  const updated = [created, ...existing];
  localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  return created;
}

export function toggleReportUpvote(id: string): CommunityReport[] {
  const existing = loadCommunityReports();
  const updated = existing.map((r) => {
    if (r.id !== id) return r;
    const nextUpvoted = !r.upvotedByMe;
    return {
      ...r,
      upvotedByMe: nextUpvoted,
      upvotes: Math.max(0, r.upvotes + (nextUpvoted ? 1 : -1)),
    };
  });
  localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
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

export function awardHeroPoints(
  action: 'report' | 'share' | 'advice' | 'mask'
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
  return next;
}

export function toggleDailyChallenge(challengeId: string): HeroProgress {
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
  return next;
}
