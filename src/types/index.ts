export type Language = 'en' | 'ur';

export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export type PersonaId =
  | 'general'
  | 'parent'
  | 'rider'
  | 'asthma'
  | 'school'
  | 'office'
  | 'farmer';

export type NavTab =
  | 'home'
  | 'forecast'
  | 'map'
  | 'planner'
  | 'ask'
  | 'schools'
  | 'health'
  | 'policy'
  | 'community'
  | 'profile';

export interface GeoPoint {
  id: string;
  name: string;
  nameUr: string;
  lat: number;
  lon: number;
  kind: 'city' | 'zone';
}

export interface AirQualityCurrent {
  time: string;
  us_aqi: number;
  pm2_5: number;
  pm10: number;
  ozone: number;
  nitrogen_dioxide: number;
  carbon_monoxide: number;
}

export interface HourlyAirPoint {
  time: string;
  pm2_5: number | null;
  us_aqi: number | null;
}

export interface WeatherCurrent {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  visibility: number;
}

export interface HourlyWeatherPoint {
  time: string;
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  wind_speed_10m: number | null;
  boundary_layer_height: number | null;
  visibility: number | null;
}

export interface LocationAirSnapshot {
  location: GeoPoint;
  current: AirQualityCurrent;
  hourly: HourlyAirPoint[];
  fetchedAt: number;
}

export interface LahoreWeatherSnapshot {
  current: WeatherCurrent;
  hourly: HourlyWeatherPoint[];
  fetchedAt: number;
}

export interface FirmsHotspot {
  latitude: number;
  longitude: number;
  brightness: number;
  acqDate: string;
  acqTime: string;
  confidence: string;
  frp: number;
}

export interface ForecastChartPoint {
  time: string;
  label: string;
  actualPm25: number | null;
  ridgePm25: number | null;
  camsPm25: number | null;
  ridgeAqi: number | null;
  camsAqi: number | null;
  isFuture: boolean;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
}

export interface RidgeForecastResult {
  trainedSamples: number;
  holdoutHours: number;
  ridgeMetrics: ModelMetrics;
  persistenceMetrics: ModelMetrics;
  camsReferenceNote: string;
  improvementVsPersistencePct: number;
  beatsPersistence: boolean;
  verdictEn: string;
  verdictUr: string;
  chartSeries: ForecastChartPoint[];
  future24h: Array<{
    time: string;
    pm25: number;
    aqi: number;
    camsPm25: number;
    camsAqi: number;
  }>;
  peakForecast: {
    time: string;
    pm25: number;
    aqi: number;
  } | null;
  featureWeights: Array<{ name: string; weight: number }>;
}

export type AdviceVerdict = 'Safe' | 'Caution' | 'Avoid outdoor' | 'Stay indoors';

export interface StructuredAdvice {
  verdict: AdviceVerdict;
  headline: string;
  actions: string[];
  mask: 'none' | 'surgical' | 'N95';
  ventilation: string;
  bestWindow: string;
  reasoning: string;
  isFallback?: boolean;
  generatedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  simplifiedUr?: string;
}

export type ReportType = 'crop' | 'garbage' | 'vehicle' | 'kiln' | 'dust';

export interface CommunityReport {
  id: string;
  type: ReportType;
  lat: number;
  lon: number;
  zoneName: string;
  description: string;
  photoDataUrl?: string;
  upvotes: number;
  upvotedByMe?: boolean;
  createdAt: number;
  author: string;
}

export interface UserSettings {
  language: Language;
  useUrduNumerals: boolean;
  theme: ThemeMode;
  liteMode: boolean;
  persona: PersonaId;
  firmsKey: string;
  alertThresholdAqi: number;
  notificationsEnabled: boolean;
  onboardingDone: boolean;
  heroName: string;
}

export interface HeroProgress {
  points: number;
  badges: string[];
  actionsCount: {
    reports: number;
    shares: number;
    adviceChecks: number;
    maskPledges: number;
  };
  maskPledgedToday: string | null;
  streakDays?: number;
  lastActiveDate?: string | null;
  completedChallenges?: Record<string, string[]>;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  persona: PersonaId;
  city: string;
  isGuest: boolean;
  createdAt: number;
}

export interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  persona: PersonaId;
  city: string;
  createdAt: number;
}
