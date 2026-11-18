import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard,
  TrendingUp,
  Map as MapIcon,
  Clock,
  MessageSquare,
  School,
  HeartPulse,
  Sliders,
  Users,
  RefreshCw,
  Settings,
  Menu,
  X,
  WifiOff,
  Languages,
  HelpCircle,
  Bell,
  ChevronDown,
  User as UserIcon,
  LogOut,
  SunMoon,
  AlertTriangle,
} from 'lucide-react';
import { AppGate } from './components/AppGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HowItWorksModal, ShareCardModal } from './components/Modals';
import { HomePage } from './pages/HomePage';
import { ForecastPage } from './pages/ForecastPage';
import { MapPage } from './pages/MapPage';
import { PlannerPage } from './pages/PlannerPage';
import { AskAiPage } from './pages/AskAiPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { HealthPage } from './pages/HealthPage';
import { PolicyPage } from './pages/PolicyPage';
import { CommunityPage } from './pages/CommunityPage';
import { ProfilePage } from './pages/ProfilePage';
import { useAirData } from './hooks/useAirData';
import { PERSONAS, t } from './lib/i18n';
import { authService } from './services/authService';
import { fetchPersonalizedAdvice, generateSharePost } from './services/aiService';
import {
  awardHeroPoints,
  loadCommunityReports,
  loadHeroProgress,
  toggleDailyChallenge,
} from './services/reportsService';
import type {
  CommunityReport,
  HeroProgress,
  Language,
  NavTab,
  PersonaId,
  StructuredAdvice,
  UserSession,
  UserSettings,
} from './types';

const SETTINGS_KEY = 'saans_user_settings_v1';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  useUrduNumerals: false,
  theme: 'light',
  liteMode: false,
  persona: 'general',
  firmsKey: '',
  alertThresholdAqi: 200,
  notificationsEnabled: false,
  onboardingDone: false,
  heroName: 'Lahore Citizen',
};

function loadInitialSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const [settings, setSettings] = useState<UserSettings>(loadInitialSettings);
  const [session, setSession] = useState<UserSession | null>(() => authService.getSession());
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [askMode, setAskMode] = useState<'general' | 'health'>('general');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [smogBannerDismissed, setSmogBannerDismissed] = useState(false);

  // Personalized Advice state
  const [advice, setAdvice] = useState<StructuredAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  // Share Card Modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePostText, setSharePostText] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  // Community & Gamification state
  const [reports, setReports] = useState<CommunityReport[]>(loadCommunityReports);
  const [hero, setHero] = useState<HeroProgress>(loadHeroProgress);

  // Live Pitch Demo mode
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  // Mobile pull-to-refresh gesture
  const touchStartYRef = useRef<number | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  // Sync HTML dir, lang, dark, high-contrast classes
  useEffect(() => {
    const root = document.documentElement;
    root.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
    root.lang = settings.language;
    root.classList.toggle(
      'dark',
      settings.theme === 'dark' || settings.theme === 'high-contrast'
    );
    root.classList.toggle('high-contrast', settings.theme === 'high-contrast');
  }, [settings.language, settings.theme]);

  const airData = useAirData({
    liteMode: settings.liteMode,
    firmsKey: settings.firmsKey,
    lang: settings.language,
    alertThresholdAqi: settings.alertThresholdAqi,
    notificationsEnabled: settings.notificationsEnabled,
  });

  const loadAdvice = useCallback(async () => {
    if (!airData.lahore) return;
    setAdviceLoading(true);
    try {
      const res = await fetchPersonalizedAdvice(
        airData.lahore,
        airData.weather,
        airData.ridge,
        settings.persona,
        settings.language
      );
      setAdvice(res);
    } finally {
      setAdviceLoading(false);
    }
  }, [airData.lahore, airData.weather, airData.ridge, settings.persona, settings.language]);

  useEffect(() => {
    void loadAdvice();
  }, [loadAdvice]);

  // Live Pitch Demo Tour sequencer
  useEffect(() => {
    if (!demoActive) return;
    const sequence: Array<{ tab: NavTab; lang: Language }> = [
      { tab: 'home', lang: 'en' },
      { tab: 'forecast', lang: 'en' },
      { tab: 'home', lang: 'ur' },
      { tab: 'planner', lang: 'en' },
      { tab: 'schools', lang: 'en' },
      { tab: 'map', lang: 'en' },
    ];
    const current = sequence[demoStep % sequence.length];
    setActiveTab(current.tab);
    updateSettings({ language: current.lang });

    const id = window.setInterval(() => {
      setDemoStep((s) => s + 1);
    }, 6000);
    return () => window.clearInterval(id);
  }, [demoActive, demoStep, updateSettings]);

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      updateSettings({ notificationsEnabled: true });
    }
  };

  const handleOpenShareModal = async () => {
    if (!airData.lahore) return;
    setShareOpen(true);
    setShareLoading(true);
    try {
      const res = await generateSharePost({
        lahore: airData.lahore,
        weather: airData.weather,
        ridge: airData.ridge,
        language: settings.language,
        kind: 'community',
      });
      setSharePostText(res.post);
    } finally {
      setShareLoading(false);
    }
  };

  const handleAwardPoints = (action: 'report' | 'share' | 'advice' | 'mask') => {
    setHero(awardHeroPoints(action));
  };

  const handleToggleChallenge = (challengeId: string) => {
    setHero(toggleDailyChallenge(challengeId));
  };

  const handleSignOut = () => {
    authService.signOut();
    setSession(null);
    setUserMenuOpen(false);
    setActiveTab('home');
  };

  const handleDeleteAllData = () => {
    authService.deleteAllLocalData();
    setSession(null);
    setReports([]);
    setHero(loadHeroProgress());
    setSettings(DEFAULT_SETTINGS);
    setActiveTab('home');
  };

  const activeAlerts = useMemo(() => {
    const list: Array<{ id: string; en: string; ur: string }> = [];
    if (airData.lahore) {
      const aqi = Math.round(airData.lahore.current.us_aqi);
      if (aqi >= settings.alertThresholdAqi) {
        list.push({
          id: 'threshold',
          en: `Lahore AQI (${aqi}) crossed your alert threshold (${settings.alertThresholdAqi}).`,
          ur: `لاہور کا AQI (${aqi}) آپ کی مقرر کردہ حد (${settings.alertThresholdAqi}) سے تجاوز کر گیا ہے۔`,
        });
      }
      if (aqi > 200) {
        list.push({
          id: 'very_unhealthy',
          en: 'Very Unhealthy smog (>200 AQI): avoid outdoor activity & enforce N95 masks.',
          ur: 'انتہائی غیر صحت بخش اسموگ (>200 AQI): باہر نکلنے سے گریز کریں اور N95 ماسک پہنیں۔',
        });
      }
    }
    if (airData.weather && airData.weather.current.visibility < 1000) {
      list.push({
        id: 'visibility',
        en: `Low visibility (${Math.round(airData.weather.current.visibility)} m) on roads.`,
        ur: `سڑکوں پر حدِ نگاہ کم ہے (${Math.round(airData.weather.current.visibility)} میٹر)۔`,
      });
    }
    return list;
  }, [airData.lahore, airData.weather, settings.alertThresholdAqi]);

  const copy = t(settings.language);
  const isUr = settings.language === 'ur';
  const skipMotion = Boolean(settings.liteMode || prefersReduced);

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: copy.nav.home, icon: LayoutDashboard },
    { id: 'forecast', label: copy.nav.forecast, icon: TrendingUp },
    { id: 'map', label: copy.nav.map, icon: MapIcon },
    { id: 'planner', label: copy.nav.planner, icon: Clock },
    { id: 'ask', label: copy.nav.ask, icon: MessageSquare },
    { id: 'schools', label: copy.nav.schools, icon: School },
    { id: 'health', label: copy.nav.health, icon: HeartPulse },
    { id: 'policy', label: copy.nav.policy, icon: Sliders },
    { id: 'community', label: copy.nav.community, icon: Users },
    { id: 'profile', label: copy.nav.profile, icon: UserIcon },
  ];

  const mobileBottomTabs = navItems.slice(0, 5);
  const mobileMoreTabs = navItems.slice(5);

  const formattedTime = airData.lastUpdated
    ? new Date(airData.lastUpdated).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const lahoreAqi = Math.round(airData.lahore?.current.us_aqi ?? 0);
  const showSmogAlertBanner = lahoreAqi > 200 && !smogBannerDismissed;
  const userName = session?.name || settings.heroName || 'Citizen';
  const userInitials = userName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ErrorBoundary>
      <AppGate
        dataReady={Boolean(airData.lahore)}
        lahore={airData.lahore}
        language={settings.language}
        useUrduNumerals={settings.useUrduNumerals}
        liteMode={settings.liteMode}
        persona={settings.persona}
        session={session}
        onSessionChange={(nextSession, chosenPersona) => {
          setSession(nextSession);
          if (nextSession) {
            updateSettings({
              persona: chosenPersona ?? nextSession.persona,
              heroName: nextSession.name,
            });
          }
        }}
        onSelectLanguage={(language) => updateSettings({ language })}
        onSelectPersona={(persona) => updateSettings({ persona })}
        onEnableNotifications={handleRequestNotifications}
        onOnboardingDone={() => updateSettings({ onboardingDone: true })}
      >
        <div
          className="min-h-screen flex flex-col lg:flex-row bg-[#F6F8FA] dark:bg-[#0B131E] text-slate-900 dark:text-slate-100"
          onTouchStart={(e) => {
            if (window.scrollY === 0) {
              touchStartYRef.current = e.touches[0].clientY;
            }
          }}
          onTouchEnd={(e) => {
            if (touchStartYRef.current !== null && window.scrollY === 0) {
              const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
              if (deltaY > 85 && !airData.refreshing) {
                setPullRefreshing(true);
                void airData.refresh().finally(() => setPullRefreshing(false));
              }
            }
            touchStartYRef.current = null;
          }}
        >
          {/* Screen-reader live region */}
          <div className="sr-only" aria-live="polite">
            {airData.lahore
              ? `Lahore AQI updated to ${lahoreAqi} at ${formattedTime}`
              : ''}
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface z-30">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xl font-extrabold tracking-tight text-[#0B3C5D] dark:text-white">
                {copy.brand}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{copy.tagline}</p>
            </div>

            <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'ask') setAskMode('general');
                      setActiveTab(item.id);
                    }}
                    className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={skipMotion ? undefined : 'sidebarActiveTab'}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 rounded-xl bg-[#0B3C5D] dark:bg-teal-600"
                      />
                    )}
                    <Icon className="relative z-10 w-4 h-4 shrink-0" />
                    <span className="relative z-10 truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>{copy.live} · Open-Meteo</span>
                <span className="font-mono-tabular">{formattedTime}</span>
              </div>
              <button
                type="button"
                onClick={() => setHowItWorksOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                <HelpCircle className="w-4 h-4 text-teal-600" />
                <span>{copy.howItWorks}</span>
              </button>
            </div>
          </aside>

          {/* Main Workspace */}
          <div className="flex-1 lg:ps-64 flex flex-col min-h-screen">
            {/* Compact Header (3 zones, <= 56px mobile height) */}
            <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between gap-4">
              {/* Zone 1: Brand (mobile) / Page Title (desktop) */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="lg:hidden text-base font-extrabold text-[#0B3C5D] dark:text-white whitespace-nowrap shrink-0">
                  {copy.brand}
                </span>
                <span className="hidden lg:inline text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-mono-tabular whitespace-nowrap truncate">
                  · {copy.live} ·{' '}
                  {airData.minutesAgo === 0 ? copy.justNow : `${airData.minutesAgo} ${copy.minAgo}`}
                </span>
              </div>

              {/* Zone 2 & 3: Refresh, Alerts Bell, User Avatar Dropdown */}
              <div className="flex items-center gap-2 shrink-0 relative">
                <button
                  type="button"
                  onClick={() => void airData.refresh()}
                  disabled={airData.refreshing}
                  aria-label={copy.refresh}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px] whitespace-nowrap active:scale-[0.97]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${airData.refreshing || pullRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{copy.refresh}</span>
                </button>

                {/* Notification Bell */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAlertsOpen((v) => !v);
                      setUserMenuOpen(false);
                    }}
                    aria-label="Notifications"
                    className="relative inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[36px] min-h-[36px]"
                  >
                    <Bell className="w-4 h-4" />
                    {activeAlerts.length > 0 && (
                      <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {activeAlerts.length}
                      </span>
                    )}
                  </button>

                  {alertsOpen && (
                    <div className="absolute end-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-3 z-50">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>{isUr ? 'فعال الرٹس' : 'Active Air Alerts'}</span>
                        <button
                          type="button"
                          onClick={() => setAlertsOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {activeAlerts.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isUr
                            ? `اس وقت کوئی انتباہ نہیں (حد: ${settings.alertThresholdAqi} AQI)۔`
                            : `No active alerts right now (threshold: ${settings.alertThresholdAqi} AQI).`}
                        </p>
                      ) : (
                        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                          {activeAlerts.map((al) => (
                            <li
                              key={al.id}
                              className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25"
                            >
                              {isUr ? al.ur : al.en}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen((v) => !v);
                      setAlertsOpen(false);
                    }}
                    aria-label="User menu"
                    className="inline-flex items-center gap-2 ps-1.5 pe-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px]"
                  >
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0B3C5D] to-teal-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {userInitials}
                    </span>
                    <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[96px] truncate">
                      {userName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute end-0 mt-2 w-52 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-2 z-50 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('profile');
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <UserIcon className="w-4 h-4 text-teal-600" />
                        <span>{copy.nav.profile}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(true);
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Settings className="w-4 h-4 text-teal-600" />
                        <span>{copy.settings}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ language: settings.language === 'en' ? 'ur' : 'en' });
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Languages className="w-4 h-4 text-teal-600" />
                        <span>{settings.language === 'en' ? 'اردو (RTL)' : 'English (LTR)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextTheme =
                            settings.theme === 'light'
                              ? 'dark'
                              : settings.theme === 'dark'
                              ? 'high-contrast'
                              : 'light';
                          updateSettings({ theme: nextTheme });
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <SunMoon className="w-4 h-4 text-teal-600" />
                        <span>
                          {isUr ? 'تھیم بدلیں' : `Theme: ${settings.theme}`}
                        </span>
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{copy.auth.signOut}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Persona Selector Toolbar */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-4 lg:px-8 py-2.5">
              <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 me-1">
                  {isUr ? 'کردار:' : 'View as:'}
                </span>
                {PERSONAS.map((p) => {
                  const active = settings.persona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateSettings({ persona: p.id })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 active:scale-[0.97] ${
                        active
                          ? 'bg-[#0B3C5D] text-white dark:bg-teal-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span aria-hidden="true">{p.emoji}</span>
                      <span>{isUr ? p.labelUr : p.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dismissible Animated Smog Alert Banner (AQI > 200) */}
            <AnimatePresence>
              {showSmogAlertBanner && (
                <motion.div
                  initial={skipMotion ? false : { opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  role="alert"
                  className="bg-purple-900 text-white px-4 lg:px-8 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>
                      {isUr
                        ? `شدید اسموگ الرٹ: لاہور کا AQI ${lahoreAqi} (>200) ہے۔ اسکول آن لائن کلاسز پر غور کریں اور شہری N95 ماسک پہنیں۔`
                        : `Smog Alert: Lahore AQI is ${lahoreAqi} (>200 Very Unhealthy). Schools should consider online classes & everyone should wear N95 indoors/outdoors.`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('schools')}
                      className="underline font-semibold"
                    >
                      {isUr ? 'اسکول پالیسی دیکھیں' : 'School Protocol'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmogBannerDismissed(true)}
                      aria-label="Dismiss smog alert"
                      className="p-1 rounded hover:bg-white/15"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Demo mode bar */}
            {demoActive && (
              <div className="bg-teal-700 text-white px-4 py-2 text-xs flex items-center justify-between">
                <span>
                  {isUr
                    ? 'لائیو پچ ڈیمو موڈ فعال ہے — اہم اسکرینز خودکار چل رہی ہیں'
                    : 'Live Pitch Demo active — cycling key screens automatically'}
                </span>
                <button
                  type="button"
                  onClick={() => setDemoActive(false)}
                  className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-semibold"
                >
                  {copy.stopDemo}
                </button>
              </div>
            )}

            {/* Offline / Cached Banner */}
            {(airData.isOffline || (airData.error && airData.usingCached)) && (
              <div
                role="status"
                className="bg-amber-500/15 border-b border-amber-500/30 px-4 lg:px-8 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>
                    {copy.offlineBanner} {airData.minutesAgo} {copy.minAgo}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void airData.refresh()}
                  className="underline font-semibold"
                >
                  {copy.retry}
                </button>
              </div>
            )}

            {/* Main Content Viewport with smooth animated tab transitions */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-10">
              {airData.loading && !airData.lahore ? (
                <div className="space-y-4 py-8 text-center">
                  <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">{copy.loadingData}</p>
                </div>
              ) : airData.error && !airData.lahore ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    {copy.errorFetch}
                  </p>
                  <button
                    type="button"
                    onClick={() => void airData.refresh()}
                    className="px-4 py-2 rounded-xl bg-[#0B3C5D] text-white text-xs font-medium"
                  >
                    {copy.retry}
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={skipMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={skipMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {activeTab === 'home' && (
                      <HomePage
                        userName={userName}
                        lahore={airData.lahore}
                        cities={airData.cities}
                        zones={airData.zones}
                        weather={airData.weather}
                        ridge={airData.ridge}
                        advice={advice}
                        adviceLoading={adviceLoading}
                        hero={hero}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        liteMode={settings.liteMode}
                        persona={settings.persona}
                        lastUpdated={airData.lastUpdated}
                        onRefreshAdvice={() => void loadAdvice()}
                        onOpenShareModal={() => void handleOpenShareModal()}
                        onAdviceCheckedPoints={() => handleAwardPoints('advice')}
                        onToggleChallenge={handleToggleChallenge}
                      />
                    )}
                    {activeTab === 'forecast' && (
                      <ForecastPage
                        ridge={airData.ridge}
                        loading={airData.loading}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        liteMode={settings.liteMode}
                        lastUpdated={airData.lastUpdated}
                        onOpenHowItWorks={() => setHowItWorksOpen(true)}
                      />
                    )}
                    {activeTab === 'map' && (
                      <MapPage
                        cities={airData.cities}
                        zones={airData.zones}
                        weather={airData.weather}
                        firms={airData.firms}
                        firmsError={airData.firmsError}
                        hasFirmsKey={Boolean(settings.firmsKey.trim())}
                        reports={reports}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        liteMode={settings.liteMode}
                        lastUpdated={airData.lastUpdated}
                        onOpenSettings={() => setSettingsOpen(true)}
                      />
                    )}
                    {activeTab === 'planner' && (
                      <PlannerPage
                        lahore={airData.lahore}
                        zones={airData.zones}
                        ridge={airData.ridge}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        lastUpdated={airData.lastUpdated}
                      />
                    )}
                    {activeTab === 'ask' && (
                      <AskAiPage
                        lahore={airData.lahore}
                        weather={airData.weather}
                        ridge={airData.ridge}
                        persona={settings.persona}
                        lang={settings.language}
                        initialMode={askMode}
                      />
                    )}
                    {activeTab === 'schools' && (
                      <SchoolsPage
                        lahore={airData.lahore}
                        weather={airData.weather}
                        ridge={airData.ridge}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        lastUpdated={airData.lastUpdated}
                      />
                    )}
                    {activeTab === 'health' && (
                      <HealthPage
                        lahore={airData.lahore}
                        ridge={airData.ridge}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        lastUpdated={airData.lastUpdated}
                        onOpenSymptomChecker={() => {
                          setAskMode('health');
                          setActiveTab('ask');
                        }}
                      />
                    )}
                    {activeTab === 'policy' && (
                      <PolicyPage
                        lahore={airData.lahore}
                        firms={airData.firms}
                        hasFirmsKey={Boolean(settings.firmsKey.trim())}
                        lang={settings.language}
                        useUrduNumerals={settings.useUrduNumerals}
                        liteMode={settings.liteMode}
                        lastUpdated={airData.lastUpdated}
                      />
                    )}
                    {activeTab === 'community' && (
                      <CommunityPage
                        reports={reports}
                        onReportsChange={setReports}
                        hero={hero}
                        heroName={userName}
                        onAwardPoints={(act) => handleAwardPoints(act)}
                        lang={settings.language}
                      />
                    )}
                    {activeTab === 'profile' && session && (
                      <ProfilePage
                        session={session}
                        settings={settings}
                        hero={hero}
                        reportsCount={reports.length}
                        onUpdateProfile={(patch) => {
                          const updated = authService.updateProfile({
                            name: patch.name,
                            persona: patch.persona,
                            city: patch.city,
                          });
                          if (updated) setSession(updated);
                          updateSettings({
                            heroName: patch.name,
                            persona: patch.persona,
                            alertThresholdAqi: patch.alertThresholdAqi,
                          });
                        }}
                        onSignOut={handleSignOut}
                        onDeleteAllData={handleDeleteAllData}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-4 lg:px-8 py-6 pb-24 lg:pb-6 text-xs text-slate-500 dark:text-slate-400">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {copy.footerHackathon}
                  </div>
                  <div>{copy.dataSources}</div>
                  <div>{copy.footerDisclaimer}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setHowItWorksOpen(true)}
                  className="font-semibold text-teal-700 dark:text-teal-400 hover:underline shrink-0"
                >
                  {copy.howItWorks}
                </button>
              </div>
            </footer>
          </div>

          {/* Mobile Fixed Bottom Navigation Bar */}
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-6 items-center"
          >
            {mobileBottomTabs.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    setActiveTab(item.id);
                  }}
                  className={`flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium ${
                    active
                      ? 'text-[#0B3C5D] dark:text-teal-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="mt-0.5 truncate max-w-[54px]">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreSheetOpen((v) => !v)}
              className="flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium text-slate-500 dark:text-slate-400"
            >
              <Menu className="w-5 h-5" />
              <span className="mt-0.5">{copy.nav.more}</span>
            </button>
          </nav>

          {/* Mobile "More" Drawer Sheet */}
          {moreSheetOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 flex items-end">
              <div className="w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {copy.nav.more}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMoreSheetOpen(false)}
                    className="p-2 rounded-lg text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {mobileMoreTabs.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMoreSheetOpen(false);
                        }}
                        className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200"
                      >
                        <Icon className="w-4 h-4 text-teal-600" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setMoreSheetOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200"
                  >
                    <Settings className="w-4 h-4 text-teal-600" />
                    <span>{copy.settings}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreSheetOpen(false);
                      setHowItWorksOpen(true);
                    }}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200"
                  >
                    <HelpCircle className="w-4 h-4 text-teal-600" />
                    <span>{copy.howItWorks}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modals & Drawers */}
          <SettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onUpdate={updateSettings}
            onRequestNotification={handleRequestNotifications}
            demoActive={demoActive}
            onToggleDemo={() => {
              setDemoStep(0);
              setDemoActive((v) => !v);
            }}
          />

          <HowItWorksModal
            open={howItWorksOpen}
            onClose={() => setHowItWorksOpen(false)}
            lang={settings.language}
          />

          <ShareCardModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            postText={sharePostText}
            loading={shareLoading}
            lahore={airData.lahore}
            lang={settings.language}
            onShared={() => handleAwardPoints('share')}
          />
        </div>
      </AppGate>
    </ErrorBoundary>
  );
}
