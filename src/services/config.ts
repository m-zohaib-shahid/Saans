import type { GeoPoint } from '../types';

/**
 * Single API base URL constant so a custom backend can replace direct/proxy calls
 * without touching UI components.
 */
export const API_BASE_URL = '';

export const OPEN_METEO_AQ_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const OPEN_METEO_WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
export const NASA_FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

export const PAKISTAN_CITIES: GeoPoint[] = [
  { id: 'lahore', name: 'Lahore', nameUr: 'لاہور', lat: 31.5204, lon: 74.3587, kind: 'city' },
  { id: 'karachi', name: 'Karachi', nameUr: 'کراچی', lat: 24.8607, lon: 67.0011, kind: 'city' },
  { id: 'islamabad', name: 'Islamabad', nameUr: 'اسلام آباد', lat: 33.6844, lon: 73.0479, kind: 'city' },
  { id: 'peshawar', name: 'Peshawar', nameUr: 'پشاور', lat: 34.0151, lon: 71.5249, kind: 'city' },
  { id: 'multan', name: 'Multan', nameUr: 'ملتان', lat: 30.1575, lon: 71.5249, kind: 'city' },
  { id: 'faisalabad', name: 'Faisalabad', nameUr: 'فیصل آباد', lat: 31.4504, lon: 73.135, kind: 'city' },
  { id: 'rawalpindi', name: 'Rawalpindi', nameUr: 'راولپنڈی', lat: 33.5651, lon: 73.0169, kind: 'city' },
];

export const LAHORE_ZONES: GeoPoint[] = [
  { id: 'gulberg', name: 'Gulberg', nameUr: 'گلبرگ', lat: 31.5497, lon: 74.3436, kind: 'zone' },
  { id: 'dha5', name: 'DHA Phase 5', nameUr: 'ڈی ایچ اے فیز 5', lat: 31.4697, lon: 74.4108, kind: 'zone' },
  { id: 'johar', name: 'Johar Town', nameUr: 'جوہر ٹاؤن', lat: 31.4697, lon: 74.2728, kind: 'zone' },
  { id: 'model', name: 'Model Town', nameUr: 'ماڈل ٹاؤن', lat: 31.482, lon: 74.325, kind: 'zone' },
  { id: 'shahdara', name: 'Shahdara', nameUr: 'شاہدرہ', lat: 31.619, lon: 74.297, kind: 'zone' },
  { id: 'walton', name: 'Walton / Cantt', nameUr: 'والٹن / کینٹ', lat: 31.505, lon: 74.399, kind: 'zone' },
  { id: 'airport', name: 'Allama Iqbal Airport', nameUr: 'علامہ اقبال ایئرپورٹ', lat: 31.5216, lon: 74.4036, kind: 'zone' },
];
