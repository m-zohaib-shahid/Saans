import React, { useEffect, useRef, useState } from 'react';
import { Send, Stethoscope, MessageSquare } from 'lucide-react';
import { streamSaansChat, simplifyToSimpleUrdu } from '../services/aiService';
import { t } from '../lib/i18n';
import type {
  ChatMessage,
  LahoreWeatherSnapshot,
  Language,
  LocationAirSnapshot,
  PersonaId,
  RidgeForecastResult,
} from '../types';

interface AskAiPageProps {
  lahore: LocationAirSnapshot | null;
  weather: LahoreWeatherSnapshot | null;
  ridge: RidgeForecastResult | null;
  persona: PersonaId;
  lang: Language;
  initialMode?: 'general' | 'health';
}

const SUGGESTED_CHIPS = [
  'Should my child go to school today?',
  'Kal subah run kar sakta hoon?',
  'کھڑکیاں کب کھولوں؟',
  'Which N95 mask works best for motorbike riders?',
];

const SYMPTOM_CHIPS = [
  'My throat feels scratchy and I have a mild cough after riding.',
  'میرے بچے کو سانس لینے میں ہلکی سیٹی کی آواز آ رہی ہے۔',
  'Chest tightness after going outside in smog',
];

export const AskAiPage: React.FC<AskAiPageProps> = ({
  lahore,
  weather,
  ridge,
  persona,
  lang,
  initialMode = 'general',
}) => {
  const isUr = lang === 'ur';
  const copy = t(lang);
  const [mode, setMode] = useState<'general' | 'health'>(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || streaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const assistantId = `a_${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const res = await streamSaansChat({
        messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        lahore,
        weather,
        ridge,
        persona,
        lang,
        mode,
        onChunk: (partial) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m))
          );
        },
      });
      setUsedFallback(res.isFallback);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: isUr
                  ? 'معذرت، جواب حاصل کرنے میں دشواری ہوئی۔ براہ کرم دوبارہ کوشش کریں۔'
                  : 'Unable to fetch response right now. Please try again.',
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleSimplifyMessage = async (msgId: string, content: string) => {
    const res = await simplifyToSimpleUrdu(content, lahore, weather, ridge);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, simplifiedUr: res.simplified } : m))
    );
  };

  const chips = mode === 'health' ? SYMPTOM_CHIPS : SUGGESTED_CHIPS;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hc-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isUr ? 'سانس AI سے پوچھیں (اردو / انگریزی / رومن اردو)' : 'Ask Saans AI Advisor'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {copy.aiDisclaimer}
              {usedFallback ? ` · ${copy.fallbackBadge}` : ' · Grounded on live Open-Meteo & Ridge ML'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('general')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                mode === 'general'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isUr ? 'عام مشورہ' : 'Smog Advisor'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('health')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                mode === 'health'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{isUr ? 'علامات چیکر' : 'Symptom Checker'}</span>
            </button>
          </div>
        </div>

        {mode === 'health' && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            {isUr
              ? 'طبی انتباہ: یہ چیٹ صرف معلوماتی ہے، ڈاکٹر کا متبادل نہیں۔ اگر سانس شدید پھولے، سینے میں درد ہو یا ہونٹ نیلے ہوں تو فوری طور پر 1122 یا قریبی ایمرجنسی سے رجوع کریں۔'
              : 'Medical disclaimer: Informational guidance only — always consult a qualified doctor. For red-flag symptoms (severe breathlessness, chest pain, blue lips, persistent wheezing), seek emergency care (Rescue 1122 / ER) immediately.'}
          </div>
        )}

        {/* Suggested Prompt Chips */}
        <div className="flex flex-wrap gap-2">
          {chips.map((q) => (
            <button
              key={q}
              type="button"
              disabled={streaming}
              onClick={() => void sendMessage(q)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-start disabled:opacity-50 active:scale-[0.98]"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Conversation Thread */}
        <div className="min-h-[280px] max-h-[440px] overflow-y-auto space-y-4 py-2">
          {messages.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
              {isUr
                ? 'اردو، انگریزی یا رومن اردو میں سوال پوچھیں — سانس آپ کو تازہ ترین AQI ڈیٹا کی بنیاد پر جواب دے گا۔'
                : 'Ask a question in English, Urdu (اردو), or Roman Urdu — answers are grounded strictly on live Lahore data.'}
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#0B3C5D] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                }`}
              >
                {m.content || (streaming ? (isUr ? 'جواب لکھا جا رہا ہے...' : 'Thinking...') : '')}
              </div>

              {m.role === 'assistant' && m.content && (
                <div className="mt-1.5 space-y-2 max-w-[85%]">
                  <button
                    type="button"
                    onClick={() => void handleSimplifyMessage(m.id, m.content)}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                  >
                    {copy.simplifyBtn}
                  </button>
                  {m.simplifiedUr && (
                    <div
                      dir="rtl"
                      className="rounded-xl bg-teal-500/10 border border-teal-500/25 p-3 text-sm font-urdu text-slate-900 dark:text-slate-100"
                    >
                      {m.simplifiedUr}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isUr
                ? 'اپنا سوال اردو، انگریزی یا رومن اردو میں لکھیں...'
                : 'Ask about schools, running, masks, or symptoms...'
            }
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] disabled:opacity-50 active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            <span>{isUr ? 'بھیجیں' : 'Send'}</span>
          </button>
        </form>
      </section>
    </div>
  );
};
