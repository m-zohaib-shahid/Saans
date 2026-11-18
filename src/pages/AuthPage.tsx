import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Eye,
  EyeOff,
  Check,
  Languages,
  Loader2,
  ArrowRight,
  X,
  MailCheck,
  RotateCcw,
} from 'lucide-react';
import { AqiGauge } from '../components/AqiGauge';
import { PERSONAS, t } from '../lib/i18n';
import { PAKISTAN_CITIES } from '../services/config';
import { authService } from '../services/authService';
import type { Language, LocationAirSnapshot, PersonaId, UserSession } from '../types';

interface AuthPageProps {
  lahore: LocationAirSnapshot | null;
  lang: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  onChangeLanguage: (lang: Language) => void;
  onAuthenticated: (
    session: UserSession,
    selectedPersona: PersonaId,
    alertThresholdAqi?: number
  ) => void;
}

const BRAND_FACTS = [
  {
    en: 'Lahore winter air frequently reaches 15–25× WHO PM2.5 guidelines during temperature inversions.',
    ur: 'سردیوں میں درجہ حرارت کی تبدیلی کے باعث لاہور کی فضا اکثر WHO کی حد سے 15 تا 25 گنا زیادہ آلودہ ہو جاتی ہے۔',
  },
  {
    en: 'Our browser-trained Ridge ML model forecasts 24h smog shifts from wind, humidity & boundary layer height.',
    ur: 'ہمارا براؤزر ML ماڈل ہوا، نمی اور باؤنڈری لیئر ہائٹ کی بنیاد پر آئندہ 24 گھنٹے کی اسموگ کی پیشگوئی کرتا ہے۔',
  },
  {
    en: 'Timing your commute to the cleanest afternoon window can cut inhaled PM2.5 dose by over 40%.',
    ur: 'دوپہر کے صاف ترین وقت میں سفر کرنے سے پھیپھڑوں میں جانے والے زہریلے ذرات میں 40% تک کمی آ سکتی ہے۔',
  },
];

function scorePasswordStrength(pw: string): {
  score: number;
  labelEn: string;
  labelUr: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, labelEn: 'Weak', labelUr: 'کمزور', color: 'bg-red-500' };
  if (score === 2) return { score: 2, labelEn: 'Fair', labelUr: 'مناسب', color: 'bg-amber-500' };
  if (score === 3) return { score: 3, labelEn: 'Good', labelUr: 'اچھا', color: 'bg-teal-500' };
  return { score: 4, labelEn: 'Strong', labelUr: 'مضبوط', color: 'bg-emerald-500' };
}

export const AuthPage: React.FC<AuthPageProps> = ({
  lahore,
  lang,
  useUrduNumerals,
  liteMode,
  onChangeLanguage,
  onAuthenticated,
}) => {
  const copy = t(lang);
  const isUr = lang === 'ur';
  const prefersReduced = useReducedMotion();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [factIdx, setFactIdx] = useState(0);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => authService.getRememberedEmail());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleChoice, setRoleChoice] = useState<PersonaId | 'regulator'>('general');
  const [city, setCity] = useState('Lahore');
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  // Email verification OTP state (when InsForge requires email code verification)
  const [verifyEmailAddr, setVerifyEmailAddr] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successDone, setSuccessDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // Forgot password 2-step reset modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFactIdx((i) => (i + 1) % BRAND_FACTS.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const pwStrength = useMemo(() => scorePasswordStrength(password), [password]);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShakeKey((k) => k + 1);
  };

  const mappedPersona: PersonaId = roleChoice === 'regulator' ? 'office' : roleChoice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResendMessage(null);

    const emailTrim = email.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      triggerError(isUr ? 'درست ای میل ایڈریس درج کریں۔' : 'Please enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (name.trim().length < 2) {
        triggerError(isUr ? 'اپنا پورا نام درج کریں۔' : 'Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        triggerError(
          isUr ? 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔' : 'Password must be at least 6 characters.'
        );
        return;
      }
      if (password !== confirmPassword) {
        triggerError(isUr ? 'دونوں پاس ورڈ آپس میں نہیں ملتے۔' : 'Passwords do not match.');
        return;
      }
      if (!acceptedTerms) {
        triggerError(
          isUr ? 'براہ کرم شرائط قبول کریں۔' : 'Please accept the terms checkbox to continue.'
        );
        return;
      }
    } else if (!password) {
      triggerError(isUr ? 'پاس ورڈ درج کریں۔' : 'Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const outcome = await authService.signUp({
          name,
          email: emailTrim,
          password,
          persona: mappedPersona,
          city,
        });
        if (outcome.status === 'verification_required') {
          setVerifyEmailAddr(outcome.email);
          setOtpCode('');
          return;
        }
        setSuccessDone(true);
        window.setTimeout(() => {
          onAuthenticated(outcome.session, outcome.session.persona, outcome.alertThresholdAqi);
        }, 420);
      } else {
        const { session, alertThresholdAqi } = await authService.signIn({
          email: emailTrim,
          password,
          rememberMe,
        });
        setSuccessDone(true);
        window.setTimeout(() => {
          onAuthenticated(session, session.persona, alertThresholdAqi);
        }, 420);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'EMAIL_EXISTS') {
        triggerError(
          isUr
            ? 'اس ای میل پر اکاؤنٹ پہلے سے موجود ہے۔ سائن ان کریں۔'
            : 'An account with this email already exists. Please sign in.'
        );
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        setVerifyEmailAddr(emailTrim.toLowerCase());
        setOtpCode('');
        triggerError(
          isUr
            ? 'آپ کی ای میل کی تصدیق باقی ہے۔ نیچے 6 ہندسوں کا کوڈ درج کریں یا نیا کوڈ بھیجیں۔'
            : 'Your email is not verified yet. Enter the 6-digit code from your email or resend it.'
        );
      } else if (code === 'INVALID_CREDENTIALS') {
        triggerError(
          isUr
            ? 'ای میل یا پاس ورڈ غلط ہے۔ اگر پہلی بار آئے ہیں تو Sign Up یا Guest استعمال کریں۔'
            : 'Invalid email or password. New here? Switch to Sign Up or Continue as Guest.'
        );
      } else {
        triggerError(
          code ||
            (isUr
              ? 'توثیق میں مسئلہ پیش آیا۔ دوبارہ کوشش کریں۔'
              : 'Authentication failed. Please check your details and try again.')
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmailAddr) return;
    setErrorMsg(null);
    const cleaned = otpCode.replace(/\s+/g, '');
    if (cleaned.length < 6) {
      triggerError(
        isUr ? 'براہ کرم 6 ہندسوں کا تصدیقی کوڈ درج کریں۔' : 'Please enter the 6-digit verification code.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { session, alertThresholdAqi } = await authService.verifyEmailCode({
        email: verifyEmailAddr,
        otp: cleaned,
        rememberMe,
      });
      setSuccessDone(true);
      window.setTimeout(() => {
        onAuthenticated(session, session.persona, alertThresholdAqi);
      }, 420);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      triggerError(
        msg ||
          (isUr
            ? 'تصدیقی کوڈ غلط یا زائد المیعاد ہے۔ نیا کوڈ منگوائیں۔'
            : 'Invalid or expired verification code. Try resending a fresh code.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!verifyEmailAddr || resending) return;
    setErrorMsg(null);
    setResendMessage(null);
    setResending(true);
    try {
      await authService.resendVerificationCode(verifyEmailAddr);
      setResendMessage(
        isUr ? 'نیا تصدیقی کوڈ آپ کی ای میل پر بھیج دیا گیا ہے۔' : 'A fresh verification code was sent to your email.'
      );
    } catch (err) {
      triggerError(
        err instanceof Error
          ? err.message
          : isUr
          ? 'کوڈ دوبارہ بھیجنے میں ناکامی ہوئی۔'
          : 'Could not resend verification code.'
      );
    } finally {
      setResending(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    const target = resetEmail.trim();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setResetError(isUr ? 'درست ای میل درج کریں۔' : 'Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    try {
      await authService.sendResetPasswordCode(target);
      setResetStep('confirm');
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : isUr
          ? 'ری سیٹ کوڈ بھیجنے میں ناکامی ہوئی۔'
          : 'Failed to send reset code.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (resetCode.trim().length < 6) {
      setResetError(isUr ? '6 ہندسوں کا کوڈ درج کریں۔' : 'Enter the 6-digit code from your email.');
      return;
    }
    if (resetNewPw.length < 6) {
      setResetError(
        isUr ? 'نیا پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔' : 'New password must be at least 6 characters.'
      );
      return;
    }
    setResetLoading(true);
    try {
      await authService.resetPasswordWithCode({
        email: resetEmail,
        code: resetCode,
        newPassword: resetNewPw,
      });
      setResetStep('done');
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : isUr
          ? 'پاس ورڈ ری سیٹ نہیں ہو سکا۔ کوڈ چیک کریں۔'
          : 'Could not reset password. Verify your code and try again.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleGuest = () => {
    const session = authService.continueAsGuest(mappedPersona);
    setSuccessDone(true);
    window.setTimeout(() => {
      onAuthenticated(session, mappedPersona);
    }, 320);
  };

  return (
    <div
      dir={isUr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F6F8FA] dark:bg-[#0B131E] text-slate-900 dark:text-slate-100 grid grid-cols-1 lg:grid-cols-12"
    >
      {/* Left Brand Panel (Desktop) / Top Compact Header (Mobile) */}
      <div className="lg:col-span-6 relative overflow-hidden bg-gradient-to-br from-[#061E33] via-[#0B3C5D] to-[#0E7C86] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
        {/* Top bar: Logo + Mobile Lang Switch */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold tracking-tight font-display">
              {copy.brand}
            </div>
            <div className="text-xs text-teal-200 mt-0.5">{copy.tagline}</div>
          </div>

          <button
            type="button"
            onClick={() => onChangeLanguage(lang === 'en' ? 'ur' : 'en')}
            aria-label="Toggle language"
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? 'اردو' : 'EN'}</span>
          </button>
        </div>

        {/* Live Lahore AQI Preview Card */}
        <div className="relative z-10 my-6 lg:my-0 flex flex-col items-center text-center space-y-5">
          {lahore ? (
            <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white p-5 sm:p-6 shadow-xl border border-white/20 w-full max-w-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                {isUr ? 'لاہور · براہِ راست فضائی منظر' : 'Lahore · Live Atmospheric Snapshot'}
              </div>
              <AqiGauge
                aqi={Math.round(lahore.current.us_aqi)}
                pm25={lahore.current.pm2_5}
                lang={lang}
                useUrduNumerals={useUrduNumerals}
                liteMode={liteMode}
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 border border-white/15 p-6 w-full max-w-sm text-sm text-teal-100">
              {isUr ? 'لاہور کا تازہ AQI لوڈ ہو رہا ہے…' : 'Syncing live Lahore AQI…'}
            </div>
          )}

          {/* Rotating Insight Fact */}
          <div className="max-w-md min-h-[54px] flex items-center justify-center">
            <p className="text-sm text-teal-100/95 leading-relaxed">
              {isUr ? BRAND_FACTS[factIdx].ur : BRAND_FACTS[factIdx].en}
            </p>
          </div>
        </div>

        <div className="relative z-10 hidden lg:flex items-center justify-between text-xs text-teal-200/80">
          <span>{copy.footerHackathon}</span>
          <span>Open-Meteo / CAMS · InsForge · Gemini AI</span>
        </div>
      </div>

      {/* Right Glassmorphism Auth Card */}
      <div className="lg:col-span-6 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-5">
          {/* Desktop Language Toggle */}
          <div className="hidden lg:flex justify-end">
            <button
              type="button"
              onClick={() => onChangeLanguage(lang === 'en' ? 'ur' : 'en')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Languages className="w-3.5 h-3.5 text-teal-600" />
              <span>{lang === 'en' ? 'اردو (RTL)' : 'English'}</span>
            </button>
          </div>

          <motion.div
            key={shakeKey}
            animate={
              errorMsg && !prefersReduced && !liteMode
                ? { x: [0, -8, 8, -5, 5, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 shadow-lg space-y-6 hc-surface"
          >
            {verifyEmailAddr ? (
              /* Email Verification Step (6-digit InsForge OTP) */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                    <MailCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {isUr ? 'اپنی ای میل کی تصدیق کریں' : 'Verify Your Email'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isUr
                        ? `${verifyEmailAddr} پر بھیجا گیا 6 ہندسوں کا کوڈ درج کریں۔`
                        : `Enter the 6-digit code sent to ${verifyEmailAddr}.`}
                    </p>
                  </div>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:text-red-200"
                  >
                    {errorMsg}
                  </div>
                )}

                {resendMessage && (
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    {resendMessage}
                  </div>
                )}

                <form onSubmit={(e) => void handleVerifyOtp(e)} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isUr ? '6 ہندسوں کا تصدیقی کوڈ' : '6-Digit Verification Code'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="123456"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-center text-lg font-mono-tabular tracking-[0.35em] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || successDone}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#092f4a] disabled:opacity-70"
                  >
                    {successDone ? (
                      <>
                        <Check className="w-4 h-4 text-teal-300" />
                        <span>{isUr ? 'تصدیق مکمل!' : 'Verified & Signed In'}</span>
                      </>
                    ) : submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isUr ? 'تصدیق ہو رہی ہے...' : 'Verifying...'}</span>
                      </>
                    ) : (
                      <span>{isUr ? 'تصدیق کریں اور آگے بڑھیں' : 'Verify & Continue'}</span>
                    )}
                  </button>
                </form>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-60"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>{isUr ? 'کوڈ دوبارہ بھیجیں' : 'Resend code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyEmailAddr(null);
                      setErrorMsg(null);
                      setResendMessage(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {isUr ? 'واپس جائیں' : 'Back to Sign In'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sliding Tab Toggle: Sign In / Sign Up */}
                <div className="relative grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    layout={!prefersReduced && !liteMode}
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-700 shadow-sm ${
                      mode === 'signin'
                        ? isUr
                          ? 'right-1'
                          : 'left-1'
                        : isUr
                        ? 'left-1'
                        : 'right-1'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                    }}
                    className={`relative z-10 py-2 text-sm font-semibold transition-colors ${
                      mode === 'signin'
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {copy.auth.signIn}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                    }}
                    className={`relative z-10 py-2 text-sm font-semibold transition-colors ${
                      mode === 'signup'
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {copy.auth.signUp}
                  </button>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:text-red-200"
                  >
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {copy.auth.fullName}
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={isUr ? 'آپ کا نام' : 'Ayesha Khan'}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {copy.auth.email}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {copy.auth.password}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 pe-10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 end-0 px-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {mode === 'signup' && password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map((lvl) => (
                            <div
                              key={lvl}
                              className={`h-1 rounded-full ${
                                pwStrength.score >= lvl
                                  ? pwStrength.color
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isUr ? `مضبوطی: ${pwStrength.labelUr}` : `Strength: ${pwStrength.labelEn}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {mode === 'signup' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {copy.auth.confirmPassword}
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            {copy.auth.role}
                          </label>
                          <select
                            value={roleChoice}
                            onChange={(e) => setRoleChoice(e.target.value as PersonaId | 'regulator')}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            {PERSONAS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {isUr ? p.labelUr : p.labelEn}
                              </option>
                            ))}
                            <option value="regulator">
                              {isUr ? 'ریگولیٹر / پالیسی ساز' : 'Regulator / Policy'}
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            {copy.auth.city}
                          </label>
                          <select
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            {PAKISTAN_CITIES.map((c) => (
                              <option key={c.id} value={c.name}>
                                {isUr ? c.nameUr : c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                        />
                        <span>{copy.auth.terms}</span>
                      </label>
                    </>
                  )}

                  {mode === 'signin' && (
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 accent-teal-600"
                        />
                        <span>{copy.auth.rememberMe}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setResetStep('request');
                          setResetError(null);
                          setResetCode('');
                          setResetNewPw('');
                          setForgotOpen(true);
                        }}
                        className="font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        {copy.auth.forgotPassword}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || successDone}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#092f4a] disabled:opacity-70 active:scale-[0.98] transition-all"
                  >
                    {successDone ? (
                      <>
                        <Check className="w-4 h-4 text-teal-300" />
                        <span>{isUr ? 'خوش آمدید!' : 'Verified'}</span>
                      </>
                    ) : submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isUr ? 'جاری ہے...' : 'Please wait...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'signin' ? copy.auth.signIn : copy.auth.signUp}</span>
                        <ArrowRight className={`w-4 h-4 ${isUr ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  <span className="shrink mx-3 text-xs text-slate-400">
                    {isUr ? 'یا' : 'or'}
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                </div>

                <button
                  type="button"
                  onClick={handleGuest}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  {copy.auth.guestBtn}
                </button>

                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                  {copy.auth.demoHonesty}
                </p>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Forgot Password Modal (InsForge 2-step reset) */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {copy.auth.resetTitle}
              </h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetError && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                {resetError}
              </div>
            )}

            {resetStep === 'request' && (
              <form onSubmit={(e) => void handleRequestReset(e)} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {copy.auth.resetDesc}
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 rounded-xl bg-[#0B3C5D] text-white text-xs font-semibold disabled:opacity-70"
                >
                  {resetLoading
                    ? isUr
                      ? 'بھیجا جا رہا ہے...'
                      : 'Sending...'
                    : isUr
                    ? 'ری سیٹ کوڈ بھیجیں'
                    : 'Send Reset Code'}
                </button>
              </form>
            )}

            {resetStep === 'confirm' && (
              <form onSubmit={(e) => void handleConfirmReset(e)} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {isUr
                    ? `${resetEmail} پر بھیجا گیا 6 ہندسوں کا کوڈ اور نیا پاس ورڈ درج کریں۔`
                    : `Enter the 6-digit code sent to ${resetEmail} and choose a new password.`}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetNewPw}
                  onChange={(e) => setResetNewPw(e.target.value)}
                  placeholder={isUr ? 'نیا پاس ورڈ (کم از کم 6 حروف)' : 'New password (min 6 chars)'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 rounded-xl bg-[#0B3C5D] text-white text-xs font-semibold disabled:opacity-70"
                >
                  {resetLoading
                    ? isUr
                      ? 'تبدیل ہو رہا ہے...'
                      : 'Resetting...'
                    : isUr
                    ? 'پاس ورڈ تبدیل کریں'
                    : 'Reset Password'}
                </button>
              </form>
            )}

            {resetStep === 'done' && (
              <div className="space-y-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  {isUr
                    ? 'پاس ورڈ کامیابی سے تبدیل ہو گیا! اب آپ نئے پاس ورڈ سے سائن ان کر سکتے ہیں۔'
                    : 'Password updated! You can now sign in with your new password.'}
                </p>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-[#0B3C5D] text-white text-xs font-semibold"
                >
                  {isUr ? 'سائن ان پر واپس جائیں' : 'Back to Sign In'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
