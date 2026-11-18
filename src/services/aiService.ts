import { API_BASE_URL } from './config';
import { formatHourLabel, getAqiCategory } from '../lib/aqi';
import type {
  AdviceVerdict,
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
  PersonaId,
  RidgeForecastResult,
  StructuredAdvice,
} from '../types';

export function buildLiveContextSummary(
  lahore: LocationAirSnapshot | null,
  weather: LahoreWeatherSnapshot | null,
  ridge: RidgeForecastResult | null,
  lang: Language
): string {
  if (!lahore) {
    return 'City: Lahore. Live sensor/model reading is currently syncing.';
  }
  const cat = getAqiCategory(lahore.current.us_aqi);
  const nextHours = (ridge?.future24h ?? []).slice(0, 12);
  const bestHour =
    nextHours.length > 0
      ? [...nextHours].sort((a, b) => a.aqi - b.aqi)[0]
      : null;

  const lines = [
    `City: Lahore (CAMS 10km model via Open-Meteo)`,
    `Observed Time: ${lahore.current.time}`,
    `Current US AQI: ${Math.round(lahore.current.us_aqi)} (${cat.labelEn})`,
    `Current PM2.5: ${lahore.current.pm2_5.toFixed(1)} µg/m³`,
    `Current PM10: ${lahore.current.pm10.toFixed(1)} µg/m³`,
    `NO2: ${lahore.current.nitrogen_dioxide.toFixed(1)} µg/m³, O3: ${lahore.current.ozone.toFixed(1)} µg/m³, CO: ${lahore.current.carbon_monoxide.toFixed(0)} µg/m³`,
  ];

  if (weather) {
    lines.push(
      `Weather: Temp ${weather.current.temperature_2m}°C, Humidity ${weather.current.relative_humidity_2m}%, Wind ${weather.current.wind_speed_10m} km/h, Visibility ${Math.round(weather.current.visibility)} m`
    );
  }
  if (ridge?.peakForecast) {
    lines.push(
      `Next 24h Ridge ML Peak Forecast: AQI ${ridge.peakForecast.aqi} (${ridge.peakForecast.pm25} µg/m³) at ${formatHourLabel(ridge.peakForecast.time, lang)}`
    );
  }
  if (bestHour) {
    lines.push(
      `Cleanest Upcoming Window (next 12h): ${formatHourLabel(bestHour.time, lang)} with forecasted AQI ${bestHour.aqi} (${bestHour.pm25} µg/m³)`
    );
  }
  if (nextHours.length > 0) {
    const hourlySummary = nextHours
      .map((h) => `${formatHourLabel(h.time, 'en')}=AQI ${h.aqi}`)
      .join(', ');
    lines.push(`Next 12h Forecast: ${hourlySummary}`);
  }
  return lines.join('\n');
}

export function buildRuleBasedAdvice(
  lahore: LocationAirSnapshot,
  ridge: RidgeForecastResult | null,
  persona: PersonaId,
  lang: Language
): StructuredAdvice {
  const aqi = Math.round(lahore.current.us_aqi);
  const pm25 = lahore.current.pm2_5.toFixed(1);
  const bestSlot =
    ridge && ridge.future24h.length > 0
      ? [...ridge.future24h].sort((a, b) => a.aqi - b.aqi)[0]
      : null;
  const bestLabel = bestSlot ? formatHourLabel(bestSlot.time, lang) : lang === 'ur' ? 'دوپہر 1 تا 4 بجے' : '13:00–16:00';

  let verdict: AdviceVerdict = 'Safe';
  let mask: 'none' | 'surgical' | 'N95' = 'none';
  if (aqi > 200) {
    verdict = 'Stay indoors';
    mask = 'N95';
  } else if (aqi > 150 || (persona === 'asthma' && aqi > 100)) {
    verdict = 'Avoid outdoor';
    mask = 'N95';
  } else if (aqi > 100) {
    verdict = 'Caution';
    mask = persona === 'rider' || persona === 'asthma' || persona === 'parent' ? 'N95' : 'surgical';
  } else if (aqi > 50) {
    verdict = 'Caution';
    mask = persona === 'asthma' ? 'surgical' : 'none';
  }

  if (lang === 'ur') {
    const personaNote: Record<PersonaId, string> = {
      parent: 'بچوں کو باہر کھیلنے سے روکیں اور اسکول جاتے وقت ماسک پہنائیں۔',
      rider: 'موٹر سائیکل چلاتے ہوئے لازمی N95 ماسک اور آنکھوں کا چشمہ پہنیں۔',
      asthma: 'ریلیف انہیلر ہر وقت پاس رکھیں اور سانس میں دشواری پر فوری ڈاکٹر سے رجوع کریں۔',
      school: 'صبح کی اسمبلی اور بیرونی کھیل منسوخ کریں، کلاس رومز کی کھڑکیاں بند رکھیں۔',
      office: 'عملے کو گھر سے کام یا ماسک کی سہولت دیں اور ایئر پیوریفائر چلائیں۔',
      farmer: 'فصل کی باقیات جلانے سے گریز کریں، متبادل کھاد یا مشینری استعمال کریں۔',
      general: 'غیر ضروری بیرونی سرگرمیوں کو محدود رکھیں اور پانی زیادہ پئیں۔',
    };

    return {
      verdict,
      headline:
        aqi > 150
          ? `لاہور میں AQI ${aqi} ہے — باہر نکلنے سے گریز کریں`
          : aqi > 100
          ? `لاہور میں AQI ${aqi} ہے — احتیاط کے ساتھ باہر نکلیں`
          : `لاہور میں AQI ${aqi} ہے — ہوا نسبتاً بہتر ہے`,
      actions: [
        personaNote[persona],
        `موجودہ PM2.5 کی مقدار ${pm25} µg/m³ ہے، اس لیے سخت جسمانی ورزش اندر کریں۔`,
        aqi > 150 ? 'باہر جاتے وقت اچھی فٹنگ والا N95 ماسک پہنیں۔' : 'حساس افراد سرجیکل یا N95 ماسک ساتھ رکھیں۔',
      ],
      mask,
      ventilation:
        aqi > 150
          ? 'کھڑکیاں اور دروازے بند رکھیں؛ صرف صاف ترین وقت پر مختصر ہوا لگوائیں۔'
          : 'دوپہر کے وقت جب اسموگ کم ہو تب 20 منٹ کے لیے کھڑکیاں کھولیں۔',
      bestWindow: bestLabel,
      reasoning: `WHO اور EPA کے معیارات کے مطابق ${aqi} AQI (${pm25} µg/m³ PM2.5) کی سطح پر یہ احتیاطی تدابیر تجویز کی گئی ہیں۔`,
      isFallback: true,
      generatedAt: Date.now(),
    };
  }

  const personaActionEn: Record<PersonaId, string> = {
    parent: 'Keep children indoors for play and ensure well-fitted masks during school drop-off.',
    rider: 'Wear a sealed N95 mask and protective eyewear on open roads; avoid peak traffic corridors.',
    asthma: 'Keep your rescue inhaler accessible and avoid exertion; monitor chest tightness closely.',
    school: 'Move morning assembly and PE indoors; keep classroom windows sealed during morning/evening peaks.',
    office: 'Enable flexible WFH for vulnerable staff and run HEPA/box-fan air filtration indoors.',
    farmer: 'Avoid burning crop residue; use happy-seeder mulching or soil incorporation instead.',
    general: 'Limit prolonged outdoor exertion and stay hydrated throughout the day.',
  };

  return {
    verdict,
    headline:
      aqi > 200
        ? `AQI ${aqi} in Lahore — Stay indoors and seal indoor air`
        : aqi > 150
        ? `AQI ${aqi} in Lahore — Avoid outdoor exertion today`
        : aqi > 100
        ? `AQI ${aqi} in Lahore — Caution for outdoor routines`
        : `AQI ${aqi} in Lahore — Manageable air quality window`,
    actions: [
      personaActionEn[persona],
      `Current PM2.5 is ${pm25} µg/m³ — schedule essential errands around ${bestLabel}.`,
      mask === 'N95'
        ? 'Wear a snug N95/KN95 respirator when stepping outdoors.'
        : 'Carry a mask if commuting near heavy traffic.',
    ],
    mask,
    ventilation:
      aqi > 150
        ? 'Keep windows closed and use indoor filtration; briefly air out rooms only around midday if AQI dips.'
        : `Best window to briefly ventilate rooms is around ${bestLabel}.`,
    bestWindow: bestLabel,
    reasoning: `Derived deterministically from EPA/WHO thresholds at live Lahore AQI ${aqi} (PM2.5 ${pm25} µg/m³).`,
    isFallback: true,
    generatedAt: Date.now(),
  };
}

function buildQuestionAwareFallback(
  question: string,
  lahore: LocationAirSnapshot | null,
  ridge: RidgeForecastResult | null,
  lang: Language,
  mode: 'general' | 'health'
): string {
  const aqi = lahore ? Math.round(lahore.current.us_aqi) : 165;
  const pm25 = lahore ? lahore.current.pm2_5.toFixed(1) : '80.0';
  const cat = getAqiCategory(aqi);
  const bestSlot =
    ridge && ridge.future24h.length > 0
      ? [...ridge.future24h].sort((a, b) => a.aqi - b.aqi)[0]
      : null;
  const bestEn = bestSlot ? `${formatHourLabel(bestSlot.time, 'en')} (AQI ${bestSlot.aqi})` : 'early afternoon (13:00–16:00)';
  const bestUr = bestSlot ? `${formatHourLabel(bestSlot.time, 'ur')} (AQI ${bestSlot.aqi})` : 'دوپہر 1 تا 4 بجے';

  const q = question.toLowerCase();
  const isUrduScript = /[\u0600-\u06FF]/.test(question) || lang === 'ur';

  if (mode === 'health') {
    return isUrduScript
      ? `[قواعد پر مبنی صحت گائیڈ] لاہور کا موجودہ AQI ${aqi} (${cat.labelUr}) اور PM2.5 ${pm25} µg/m³ ہے۔\n• فوری احتیاط: باہر جانے سے گریز کریں، نیم گرم پانی پئیں اور N95 ماسک استعمال کریں۔\n• ڈاکٹر سے رجوع: یہ AI معلومات ہیں، طبی مشورہ نہیں۔ اگر سانس پھولے، سینے میں درد ہو یا علامات بڑھیں تو فوری ڈاکٹر یا 1122 سے رابطہ کریں۔`
      : `[Rule-based symptom guidance] Lahore's current AQI is ${aqi} (${cat.labelEn}, PM2.5 ${pm25} µg/m³).\n• Immediate care: Stay indoors with sealed windows, hydrate, and wear a fitted N95 if stepping out.\n• Important: This is informational guidance, not medical advice. Consult a qualified doctor promptly—and seek urgent ER/1122 care for chest pain, severe shortness of breath, or persistent wheezing.`;
  }

  if (q.includes('school') || q.includes('child') || q.includes('اسکول') || q.includes('بچ')) {
    return isUrduScript
      ? `[قواعد پر مبنی جواب] موجودہ AQI ${aqi} (${cat.labelUr}) ہے۔\n• ${aqi > 200 ? 'AQI 200 سے زیادہ ہونے کی وجہ سے بچوں کے لیے آن لائن کلاسز یا گھر پر رہنا محفوظ ہے۔' : aqi > 150 ? 'اسکول کھلے ہونے کی صورت میں اسمبلی اور کھیل بند رکھیں اور بچوں کو لازمی N95/سرجیکل ماسک پہنائیں۔' : 'احتیاط کے ساتھ اسکول جا سکتے ہیں، حساس بچوں کو ماسک پہنائیں۔'}\n• بہتر وقت: ${bestUr}`
      : `[Rule-based guidance] Lahore is currently at AQI ${aqi} (${cat.labelEn}, PM2.5 ${pm25} µg/m³).\n• School guidance: ${aqi > 200 ? 'AQI exceeds 200—remote/online classes are recommended.' : aqi > 150 ? 'Keep all recess and PE strictly indoors and send children with well-fitted masks.' : 'School attendance is manageable with indoor sports restrictions for sensitive children.'}\n• Cleanest upcoming window: ${bestEn}.`;
  }

  if (q.includes('window') || q.includes('khirk') || q.includes('کھڑکی') || q.includes('ventilat')) {
    return isUrduScript
      ? `[قواعد پر مبنی جواب] موجودہ AQI ${aqi} پر صبح اور رات کے اوقات میں کھڑکیاں بند رکھیں۔ اگر ہوا لگوانی ہو تو صرف ${bestUr} کے آس پاس 15–20 منٹ کے لیے کھولیں۔`
      : `[Rule-based guidance] At AQI ${aqi}, keep windows sealed during morning/evening smog peaks. Briefly ventilate for 15–20 minutes only around ${bestEn}.`;
  }

  if (q.includes('run') || q.includes('jog') || q.includes('walk') || q.includes('sport') || q.includes('دوڑ')) {
    return isUrduScript
      ? `[قواعد پر مبنی جواب] لاہور کا AQI ${aqi} (${pm25} µg/m³) ہے۔ تیز دوڑنے سے پھیپھڑوں میں آلودگی زیادہ جاتی ہے—${aqi > 150 ? 'آج باہر دوڑنے کے بجائے گھر کے اندر ورزش کریں۔' : `اگر چہل قدمی کرنی ہو تو ${bestUr} کا وقت منتخب کریں۔`}`
      : `[Rule-based guidance] At AQI ${aqi} (PM2.5 ${pm25} µg/m³), vigorous outdoor running multiplies inhaled particulates. ${aqi > 150 ? 'Skip outdoor running today and exercise indoors.' : `If walking lightly, stick to ${bestEn}.`}`;
  }

  return isUrduScript
    ? `[قواعد پر مبنی جواب] لاہور کا موجودہ AQI ${aqi} (${cat.labelUr}) اور PM2.5 ${pm25} µg/m³ ہے۔\n• باہر نکلتے وقت N95 ماسک پہنیں اور غیر ضروری سفر ${bestUr} کے وقت پر رکھیں۔\n• نوٹ: یہ معلوماتی رہنمائی ہے، طبی مشورہ نہیں۔`
    : `[Rule-based guidance] Lahore's current AQI is ${aqi} (${cat.labelEn}) with PM2.5 at ${pm25} µg/m³.\n• Wear a fitted N95 mask for outdoor commutes and aim for ${bestEn} for essential errands.\n• Note: Informational guidance only, not medical advice.`;
}

export async function fetchPersonalizedAdvice(
  lahore: LocationAirSnapshot,
  weather: LahoreWeatherSnapshot | null,
  ridge: RidgeForecastResult | null,
  persona: PersonaId,
  lang: Language
): Promise<StructuredAdvice> {
  const context = buildLiveContextSummary(lahore, weather, ridge, lang);
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, persona, language: lang }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { advice: StructuredAdvice };
    return { ...data.advice, isFallback: false, generatedAt: Date.now() };
  } catch {
    return buildRuleBasedAdvice(lahore, ridge, persona, lang);
  }
}

export async function streamSaansChat(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  lahore: LocationAirSnapshot | null;
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  persona: PersonaId;
  lang: Language;
  mode?: 'general' | 'health';
  onChunk: (partialText: string) => void;
}): Promise<{ text: string; isFallback: boolean }> {
  const context = buildLiveContextSummary(params.lahore, params.weather, params.ridge, params.lang);
  const latestUserQuestion =
    [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: params.messages,
        context,
        persona: params.persona,
        language: params.lang,
        mode: params.mode ?? 'general',
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    const processLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return;
      const jsonPart = line.slice(5).trim();
      if (!jsonPart) return;
      const payload = JSON.parse(jsonPart) as { text?: string; error?: string; done?: boolean };
      if (payload.error) throw new Error(payload.error);
      if (payload.text) {
        accumulated += payload.text;
        params.onChunk(accumulated);
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    }
    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!accumulated.trim()) {
      throw new Error('Empty AI stream');
    }

    return { text: accumulated, isFallback: false };
  } catch {
    const fallbackText = buildQuestionAwareFallback(
      latestUserQuestion,
      params.lahore,
      params.ridge,
      params.lang,
      params.mode ?? 'general'
    );
    params.onChunk(fallbackText);
    return { text: fallbackText, isFallback: true };
  }
}

export async function simplifyToSimpleUrdu(
  text: string,
  lahore: LocationAirSnapshot | null,
  weather: LahoreWeatherSnapshot | null,
  ridge: RidgeForecastResult | null
): Promise<{ simplified: string; isFallback: boolean }> {
  const context = buildLiveContextSummary(lahore, weather, ridge, 'ur');
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/simplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { simplified: string };
    return { simplified: data.simplified, isFallback: false };
  } catch {
    const aqi = Math.round(lahore?.current.us_aqi ?? 165);
    return {
      simplified: `آسان الفاظ میں: لاہور کی ہوا میں اس وقت دھند اور گردوغبار زیادہ ہے (اسکور ${aqi})۔ جب تک بہت ضروری نہ ہو باہر کھیلنے یا دوڑنے نہ جائیں، اور باہر نکلتے وقت ماسک ضرور پہنیں۔ کھڑکیاں بند رکھیں۔`,
      isFallback: true,
    };
  }
}

export async function generateSharePost(params: {
  lahore: LocationAirSnapshot;
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  language: 'en' | 'ur' | 'bilingual';
  kind: 'community' | 'school';
  decisionSummary?: string;
}): Promise<{ post: string; isFallback: boolean }> {
  const context = buildLiveContextSummary(
    params.lahore,
    params.weather,
    params.ridge,
    params.language === 'ur' ? 'ur' : 'en'
  );
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/share-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        language: params.language,
        kind: params.kind,
        decisionSummary: params.decisionSummary,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { post: string };
    return { post: data.post, isFallback: false };
  } catch {
    const aqi = Math.round(params.lahore.current.us_aqi);
    const pm25 = params.lahore.current.pm2_5.toFixed(1);
    const fallbackPost =
      params.kind === 'school'
        ? `School Air Quality Notice (Lahore)\nLive AQI: ${aqi} (PM2.5: ${pm25} µg/m³)\nAction: ${params.decisionSummary || 'Monitor air quality and keep masks ready.'}\n\nاسکول اسموگ الرٹ: لاہور کا موجودہ AQI ${aqi} ہے۔ طلبہ کو ماسک پہنائیں اور احتیاطی ہدایات پر عمل کریں۔`
        : params.language === 'ur'
        ? `لاہور اسموگ اپڈیٹ (Saans سانس)\n• موجودہ AQI: ${aqi} | PM2.5: ${pm25} µg/m³\n• احتیاط: باہر جاتے وقت N95 ماسک پہنیں اور غیر ضروری سفر سے گریز کریں۔`
        : `Lahore Smog Update (Saans)\n• Live AQI: ${aqi} | PM2.5: ${pm25} µg/m³\n• Action: Wear a fitted N95 mask outdoors and limit heavy exertion.`;
    return { post: fallbackPost, isFallback: true };
  }
}
