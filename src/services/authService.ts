import type { PersonaId, StoredUserRecord, UserSession } from '../types';

const USERS_KEY = 'saans_auth_users_v1';
const SESSION_KEY = 'saans_session';

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

/**
 * Hash password with SHA-256 + per-user random salt using Web Crypto API.
 * Never stores plaintext passwords.
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function loadUsers(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUserRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUserRecord[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
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

export const authService = {
  getSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as UserSession;
    } catch {
      return null;
    }
  },

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    persona: PersonaId;
    city: string;
  }): Promise<UserSession> {
    const emailNorm = input.email.trim().toLowerCase();
    const users = loadUsers();
    if (users.some((u) => u.email === emailNorm)) {
      throw new Error('EMAIL_EXISTS');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);
    const record: StoredUserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name.trim(),
      email: emailNorm,
      passwordHash,
      salt,
      persona: input.persona,
      city: input.city.trim() || 'Lahore',
      createdAt: Date.now(),
    };

    saveUsers([...users, record]);

    const session: UserSession = {
      id: record.id,
      name: record.name,
      email: record.email,
      persona: record.persona,
      city: record.city,
      isGuest: false,
      createdAt: record.createdAt,
    };
    persistSession(session, true);
    return session;
  },

  async signIn(input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<UserSession> {
    const emailNorm = input.email.trim().toLowerCase();
    const users = loadUsers();
    const user = users.find((u) => u.email === emailNorm);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const candidateHash = await hashPassword(input.password, user.salt);
    if (candidateHash !== user.passwordHash) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const session: UserSession = {
      id: user.id,
      name: user.name,
      email: user.email,
      persona: user.persona,
      city: user.city,
      isGuest: false,
      createdAt: user.createdAt,
    };
    persistSession(session, input.rememberMe);
    return session;
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

  updateProfile(patch: Partial<Pick<UserSession, 'name' | 'persona' | 'city'>>): UserSession | null {
    const current = this.getSession();
    if (!current) return null;

    const updated: UserSession = {
      ...current,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
      city: patch.city !== undefined ? patch.city.trim() || current.city : current.city,
    };

    const inLocal = Boolean(localStorage.getItem(SESSION_KEY));
    persistSession(updated, inLocal);

    if (!current.isGuest) {
      const users = loadUsers();
      const nextUsers = users.map((u) =>
        u.id === current.id
          ? { ...u, name: updated.name, persona: updated.persona, city: updated.city }
          : u
      );
      saveUsers(nextUsers);
    }

    return updated;
  },

  signOut(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  deleteAllLocalData(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('saans_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_KEY);
  },
};
