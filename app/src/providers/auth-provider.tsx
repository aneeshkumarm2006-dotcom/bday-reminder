import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  authApi,
  setUnauthorizedHandler,
  type AuthUser,
  type ChannelPreferences,
  type UpdateMeInput,
} from '@/lib/api';
import {
  signInWithGoogle as runGoogleSignIn,
  type GoogleSignInStatus,
} from '@/lib/google-auth';
import { registerForPushNotifications } from '@/lib/notifications';
import { clearTokens, loadTokens, saveTokens } from '@/lib/token-store';
import { clearWidget } from '@/lib/widget';

/**
 * Auth state (FR-1, FR-4). Custom JWT (access + refresh): tokens live in the
 * secure store, the user is re-hydrated on launch via `GET /me`, and the same
 * login works across web / iOS / Android with synced data. Phone is a profile
 * field only - phone OTP login is deferred (TODO Stage 1 note).
 */

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  /**
   * "Sign in with Google" (identity only, Stage 16). Runs the in-app OAuth
   * session and, on 'ok', adopts the returned tokens + user like `signIn`.
   * Non-ok statuses are returned (never thrown) for the screen to message.
   */
  signInWithGoogle: () => Promise<GoogleSignInStatus>;
  signOut: () => Promise<void>;
  /** Patch the current user's profile/preferences and sync context (Stage 5). */
  updateProfile: (patch: UpdateMeInput) => Promise<AuthUser>;
  /** Re-fetch the current user from the server (e.g. after connecting Gmail). */
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_CHANNELS: ChannelPreferences = { push: true, email: false, sms: false, inApp: true };

/** Apply a /me patch onto the cached user for an optimistic update. */
function applyMePatch(user: AuthUser, patch: UpdateMeInput): AuthUser {
  const next: AuthUser = { ...user };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.timezone !== undefined) next.timezone = patch.timezone;
  if (patch.defaultLeadDays !== undefined) next.defaultLeadDays = patch.defaultLeadDays;
  if (patch.defaultReminderTime !== undefined) next.defaultReminderTime = patch.defaultReminderTime;
  if (patch.channelPreferences !== undefined) {
    next.channelPreferences = {
      ...(user.channelPreferences ?? DEFAULT_CHANNELS),
      ...patch.channelPreferences,
    };
  }
  return next;
}

/** Best-effort device timezone for auto-detection at signup (FR-1). */
function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Mirror of `user` for optimistic updates that need the pre-edit snapshot to
  // revert to, without adding `user` to updateProfile's dependencies.
  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Re-hydrate the session on launch.
  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        if (active) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await authApi.me();
        if (active) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        await clearTokens();
        if (active) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // A failed refresh (hard 401) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Once authenticated: register this device for push (FR-23/54) and keep the
  // server timezone aligned with the device so reminders re-anchor after travel
  // (FR-52). Both are best-effort and native-aware (push no-ops on web).
  const userTimezone = user?.timezone ?? null;
  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    void registerForPushNotifications();
    const deviceTz = detectTimezone();
    if (deviceTz && userTimezone && deviceTz !== userTimezone) {
      authApi
        .updateMe({ timezone: deviceTz })
        .then((updated) => {
          if (active) setUser(updated);
        })
        .catch(() => {
          /* non-fatal - the server keeps the last known zone */
        });
    }
    return () => {
      active = false;
    };
  }, [status, userTimezone]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<GoogleSignInStatus> => {
    const result = await runGoogleSignIn();
    if (result.status === 'ok') {
      const { accessToken, refreshToken, user: googleUser } = result.session;
      await saveTokens({ accessToken, refreshToken });
      setUser(googleUser);
      setStatus('authenticated');
    }
    return result.status;
  }, []);

  const signUp = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const res = await authApi.signup({ name, email, password, timezone: detectTimezone() });
      await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      setStatus('authenticated');
    },
    [],
  );

  const signOut = useCallback(async () => {
    const tokens = await loadTokens();
    if (tokens) await authApi.logout(tokens.refreshToken);
    await clearTokens();
    // Wipe the home-screen widget so it never shows the signed-out user's data
    // (Stage 10). Native-only + best-effort; a no-op on web.
    void clearWidget();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const updateProfile = useCallback(async (patch: UpdateMeInput) => {
    // Optimistic: reflect the change immediately, persist, revert on failure so
    // the toggles/chips feel instant while the server stays the source of truth.
    const previous = userRef.current;
    if (previous) {
      const optimistic = applyMePatch(previous, patch);
      userRef.current = optimistic;
      setUser(optimistic);
    }
    try {
      const updated = await authApi.updateMe(patch);
      userRef.current = updated;
      setUser(updated);
      return updated;
    } catch (err) {
      userRef.current = previous;
      setUser(previous);
      throw err;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      userRef.current = me;
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signUp, signInWithGoogle, signOut, updateProfile, refreshUser }),
    [status, user, signIn, signUp, signInWithGoogle, signOut, updateProfile, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
