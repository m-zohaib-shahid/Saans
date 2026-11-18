import { insforge } from './insforgeClient';
import type { PersonaId, UserSession } from '../types';

const SESSION_KEY = 'saans_session';
const PENDING_META_KEY = 'saans_pending_signup_meta';
const REMEMBERED_EMAIL_KEY = 'saans_remembered_email';

const VALID_PERSONAS: PersonaId[] = [
  'general',
  'parent',
  'rider',
  'asthma',
  'school',
  'office',
  'farmer',
];

function sanitizePersona(val: unknown): PersonaId {
  return VALID_PERSONAS.includes(val as PersonaId) ? (val as PersonaId) : 'general';
}

function persistSession(session: UserSession, remember: boolean): void {
  const serialized = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(SESSION_KEY, serialized);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, serialized);
    localStorage.removeItem(SESSION_KEY);
  }
}

interface PendingMeta {
  email: string;
  name: string;
  persona: PersonaId;
  city: string;
}

function savePendingMeta(meta: PendingMeta): void {
  try {
    sessionStorage.setItem(PENDING_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
}

function consumePendingMeta(email: string): PendingMeta | null {
  try {
    const raw = sessionStorage.getItem(PENDING_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMeta;
    if (parsed.email.toLowerCase() !== email.toLowerCase()) return null;
    sessionStorage.removeItem(PENDING_META_KEY);
    return parsed;
  } catch {
    return null;
  }
}

async function ensureUserProfileRow(params: {
  id: string;
  email: string;
  name: string;
  persona: PersonaId;
  city: string;
}): Promise<{ name: string; persona: PersonaId; city: string; alertThresholdAqi?: number }> {
  // First check if a row already exists in public.user_profiles
  const { data: existing } = await insforge.database
    .from('user_profiles')
    .select('id, name, persona, city, alert_threshold_aqi')
    .eq('id', params.id)
    .maybeSingle();

  if (existing) {
    return {
      name: (existing.name as string) || params.name,
      persona: sanitizePersona(existing.persona ?? params.persona),
      city: (existing.city as string) || params.city || 'Lahore',
      alertThresholdAqi:
        typeof existing.alert_threshold_aqi === 'number'
          ? existing.alert_threshold_aqi
          : undefined,
    };
  }

  // Insert initial profile row for new authenticated user
  const { data: inserted } = await insforge.database
    .from('user_profiles')
    .insert([
      {
        id: params.id,
        name: params.name,
        email: params.email,
        persona: params.persona,
        city: params.city || 'Lahore',
      },
    ])
    .select('name, persona, city, alert_threshold_aqi')
    .maybeSingle();

  if (inserted) {
    return {
      name: (inserted.name as string) || params.name,
      persona: sanitizePersona(inserted.persona ?? params.persona),
      city: (inserted.city as string) || params.city || 'Lahore',
      alertThresholdAqi:
        typeof inserted.alert_threshold_aqi === 'number'
          ? inserted.alert_threshold_aqi
          : undefined,
    };
  }

  return {
    name: params.name,
    persona: params.persona,
    city: params.city || 'Lahore',
  };
}

export type SignUpOutcome =
  | { status: 'authenticated'; session: UserSession; alertThresholdAqi?: number }
  | { status: 'verification_required'; email: string };

export const authService = {
  getRememberedEmail(): string {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  },

  getSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as UserSession;
    } catch {
      return null;
    }
  },

  /**
   * Hydrates session from InsForge backend on startup.
   * Guest sessions remain local; authenticated sessions are validated against InsForge.
   */
  async hydrateSession(): Promise<{
    session: UserSession | null;
    alertThresholdAqi?: number;
  }> {
    const cached = this.getSession();
    if (cached?.isGuest) {
      return { session: cached };
    }

    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      // Clear stale non-guest session if backend auth isn't active
      if (cached && !cached.isGuest) {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      }
      return { session: null };
    }

    const user = data.user;
    const rawProfile = (user.profile ?? {}) as Record<string, unknown>;
    const fallbackName =
      (typeof rawProfile.name === 'string' && rawProfile.name.trim()) ||
      user.email.split('@')[0] ||
      'Citizen';
    const fallbackPersona = sanitizePersona(rawProfile.persona);
    const fallbackCity =
      (typeof rawProfile.city === 'string' && rawProfile.city.trim()) || 'Lahore';

    const dbProfile = await ensureUserProfileRow({
      id: user.id,
      email: user.email,
      name: fallbackName,
      persona: fallbackPersona,
      city: fallbackCity,
    });

    const session: UserSession = {
      id: user.id,
      name: dbProfile.name,
      email: user.email,
      persona: dbProfile.persona,
      city: dbProfile.city,
      isGuest: false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
    };

    const remember = Boolean(localStorage.getItem(SESSION_KEY)) || !sessionStorage.getItem(SESSION_KEY);
    persistSession(session, remember);

    return {
      session,
      alertThresholdAqi: dbProfile.alertThresholdAqi,
    };
  },

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    persona: PersonaId;
    city: string;
  }): Promise<SignUpOutcome> {
    const emailNorm = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    const cleanCity = input.city.trim() || 'Lahore';

    const { data, error } = await insforge.auth.signUp({
      email: emailNorm,
      password: input.password,
      name: cleanName,
    });

    if (error) {
      const msg = error.message || '';
      if (
        error.statusCode === 409 ||
        error.error === 'ALREADY_EXISTS' ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('already registered')
      ) {
        throw new Error('EMAIL_EXISTS');
      }
      throw new Error(msg || 'SIGNUP_FAILED');
    }

    if (data?.requireEmailVerification || !data?.accessToken || !data?.user) {
      savePendingMeta({
        email: emailNorm,
        name: cleanName,
        persona: input.persona,
        city: cleanCity,
      });
      localStorage.setItem(REMEMBERED_EMAIL_KEY, emailNorm);
      return { status: 'verification_required', email: emailNorm };
    }

    // No email verification required — user is immediately signed in
    await insforge.auth.setProfile({
      name: cleanName,
      persona: input.persona,
      city: cleanCity,
    });

    const dbProfile = await ensureUserProfileRow({
      id: data.user.id,
      email: data.user.email,
      name: cleanName,
      persona: input.persona,
      city: cleanCity,
    });

    const session: UserSession = {
      id: data.user.id,
      name: dbProfile.name,
      email: data.user.email,
      persona: dbProfile.persona,
      city: dbProfile.city,
      isGuest: false,
      createdAt: data.user.createdAt ? new Date(data.user.createdAt).getTime() : Date.now(),
    };
    localStorage.setItem(REMEMBERED_EMAIL_KEY, emailNorm);
    persistSession(session, true);
    return {
      status: 'authenticated',
      session,
      alertThresholdAqi: dbProfile.alertThresholdAqi,
    };
  },

  async verifyEmailCode(input: {
    email: string;
    otp: string;
    rememberMe?: boolean;
  }): Promise<{ session: UserSession; alertThresholdAqi?: number }> {
    const emailNorm = input.email.trim().toLowerCase();
    const { data, error } = await insforge.auth.verifyEmail({
      email: emailNorm,
      otp: input.otp.trim(),
    });

    if (error || !data?.user) {
      throw new Error(error?.message || 'INVALID_VERIFICATION_CODE');
    }

    const pending = consumePendingMeta(emailNorm);
    const rawProfile = (data.user.profile ?? {}) as Record<string, unknown>;
    const resolvedName =
      pending?.name ||
      (typeof rawProfile.name === 'string' && rawProfile.name.trim()) ||
      emailNorm.split('@')[0];
    const resolvedPersona = pending?.persona ?? sanitizePersona(rawProfile.persona);
    const resolvedCity =
      pending?.city ||
      (typeof rawProfile.city === 'string' && rawProfile.city.trim()) ||
      'Lahore';

    await insforge.auth.setProfile({
      name: resolvedName,
      persona: resolvedPersona,
      city: resolvedCity,
    });

    const dbProfile = await ensureUserProfileRow({
      id: data.user.id,
      email: data.user.email,
      name: resolvedName,
      persona: resolvedPersona,
      city: resolvedCity,
    });

    const session: UserSession = {
      id: data.user.id,
      name: dbProfile.name,
      email: data.user.email,
      persona: dbProfile.persona,
      city: dbProfile.city,
      isGuest: false,
      createdAt: data.user.createdAt ? new Date(data.user.createdAt).getTime() : Date.now(),
    };
    localStorage.setItem(REMEMBERED_EMAIL_KEY, emailNorm);
    persistSession(session, input.rememberMe ?? true);
    return { session, alertThresholdAqi: dbProfile.alertThresholdAqi };
  },

  async resendVerificationCode(email: string): Promise<void> {
    const { error } = await insforge.auth.resendVerificationEmail({
      email: email.trim().toLowerCase(),
    });
    if (error) {
      throw new Error(error.message || 'RESEND_FAILED');
    }
  },

  async signIn(input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<{ session: UserSession; alertThresholdAqi?: number }> {
    const emailNorm = input.email.trim().toLowerCase();
    const { data, error } = await insforge.auth.signInWithPassword({
      email: emailNorm,
      password: input.password,
    });

    if (error || !data?.user) {
      const msg = error?.message || '';
      if (
        error?.statusCode === 403 ||
        msg.toLowerCase().includes('not verified') ||
        msg.toLowerCase().includes('verify')
      ) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      throw new Error('INVALID_CREDENTIALS');
    }

    const user = data.user;
    const rawProfile = (user.profile ?? {}) as Record<string, unknown>;
    const fallbackName =
      (typeof rawProfile.name === 'string' && rawProfile.name.trim()) ||
      emailNorm.split('@')[0];
    const fallbackPersona = sanitizePersona(rawProfile.persona);
    const fallbackCity =
      (typeof rawProfile.city === 'string' && rawProfile.city.trim()) || 'Lahore';

    const dbProfile = await ensureUserProfileRow({
      id: user.id,
      email: user.email,
      name: fallbackName,
      persona: fallbackPersona,
      city: fallbackCity,
    });

    const session: UserSession = {
      id: user.id,
      name: dbProfile.name,
      email: user.email,
      persona: dbProfile.persona,
      city: dbProfile.city,
      isGuest: false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
    };

    if (input.rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, emailNorm);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
    persistSession(session, input.rememberMe);
    return { session, alertThresholdAqi: dbProfile.alertThresholdAqi };
  },

  async sendResetPasswordCode(email: string): Promise<void> {
    const { error } = await insforge.auth.sendResetPasswordEmail({
      email: email.trim().toLowerCase(),
    });
    if (error) {
      throw new Error(error.message || 'RESET_SEND_FAILED');
    }
  },

  async resetPasswordWithCode(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<void> {
    const { data: tokenData, error: tokenErr } =
      await insforge.auth.exchangeResetPasswordToken({
        email: input.email.trim().toLowerCase(),
        code: input.code.trim(),
      });
    if (tokenErr || !tokenData?.token) {
      throw new Error(tokenErr?.message || 'INVALID_RESET_CODE');
    }

    const { error: resetErr } = await insforge.auth.resetPassword({
      newPassword: input.newPassword,
      otp: tokenData.token,
    });
    if (resetErr) {
      throw new Error(resetErr.message || 'RESET_FAILED');
    }
  },

  continueAsGuest(persona: PersonaId = 'general'): UserSession {
    const session: UserSession = {
      id: 'guest_user',
      name: 'Guest Explorer',
      email: 'guest@saans.local',
      persona,
      city: 'Lahore',
      isGuest: true,
      createdAt: Date.now(),
    };
    persistSession(session, true);
    return session;
  },

  updateProfile(
    patch: Partial<Pick<UserSession, 'name' | 'persona' | 'city'>> & {
      alertThresholdAqi?: number;
    }
  ): UserSession | null {
    const current = this.getSession();
    if (!current) return null;

    const updated: UserSession = {
      ...current,
      name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
      persona: patch.persona !== undefined ? patch.persona : current.persona,
      city: patch.city !== undefined ? patch.city.trim() || current.city : current.city,
    };

    const inLocal = Boolean(localStorage.getItem(SESSION_KEY));
    persistSession(updated, inLocal);

    if (!current.isGuest) {
      void (async () => {
        try {
          await insforge.auth.setProfile({
            name: updated.name,
            persona: updated.persona,
            city: updated.city,
          });
          const dbPatch: Record<string, unknown> = {
            name: updated.name,
            persona: updated.persona,
            city: updated.city,
          };
          if (typeof patch.alertThresholdAqi === 'number') {
            dbPatch.alert_threshold_aqi = patch.alertThresholdAqi;
          }
          await insforge.database
            .from('user_profiles')
            .update(dbPatch)
            .eq('id', current.id);
        } catch {
          // keep optimistic local state if offline
        }
      })();
    }

    return updated;
  },

  async signOut(): Promise<void> {
    const current = this.getSession();
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (!current?.isGuest) {
      try {
        await insforge.auth.signOut();
      } catch {
        // ignore network errors on sign out
      }
    }
  },

  async deleteAllLocalData(): Promise<void> {
    await this.signOut();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('saans_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PENDING_META_KEY);
  },
};
