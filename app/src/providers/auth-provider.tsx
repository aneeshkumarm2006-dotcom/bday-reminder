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
  ApiError,
  authApi,
  setUnauthorizedHandler,
  type AuthUser,
  type ChannelPreferences,
  type DateParts,
  type UpdateMeInput,
} from '@/lib/api';
import {
  signInWithApple as runAppleSignIn,
  type AppleSignInStatus,
} from '@/lib/apple-auth';
import {
  signInWithGoogle as runGoogleSignIn,
  type GoogleSignInStatus,
} from '@/lib/google-auth';
import { registerForPushNotifications, unregisterPushNotifications } from '@/lib/notifications';
import { clearTokens, loadTokens, saveTokens } from '@/lib/token-store';
import { clearCachedUser, loadCachedUser, saveCachedUser } from '@/lib/user-cache';
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
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    birthday: DateParts;
  }) => Promise<void>;
  /**
   * "Sign in with Google" (identity only, Stage 16). Runs the in-app OAuth
   * session and, on 'ok', adopts the returned tokens + user like `signIn`.
   * Non-ok statuses are returned (never thrown) for the screen to message.
   */
  signInWithGoogle: () => Promise<GoogleSignInStatus>;
  /**
   * "Sign in with Apple" (identity only). Required by App Store Guideline 4.8
   * alongside Google. Runs Apple's native sheet and, on 'ok', adopts the
   * returned tokens + user like `signIn`. Non-ok statuses are returned (never
   * thrown) for the screen to message.
   */
  signInWithApple: () => Promise<AppleSignInStatus>;
  /**
   * Adopt a Google sign-in handoff directly (bypassing the in-app browser
   * session). Used by the `google-login` deep-link route as a fallback for when
   * Android dispatches the OAuth return as a fresh Intent instead of resolving
   * `openAuthSessionAsync`. Resolves `true` on success. The handoff is
   * single-use, so this and `signInWithGoogle` never both consume the same one.
   */
  completeGoogleSession: (handoff: string) => Promise<boolean>;
  /**
   * True right after a Google sign-in that CREATED the account. Those users
   * never see a signup form, so they're the only ones who still owe us a
   * birthday - the app's own form already asks for one, and asking an email
   * signup twice reads as a bug.
   */
  needsBirthdayPrompt: boolean;
  dismissBirthdayPrompt: () => void;
  signOut: () => Promise<void>;
  /**
   * Permanently delete the account and all its data, then clear the local
   * session (irreversible). Throws if the server call fails so the UI can keep
   * the user signed in and surface an error.
   */
  deleteAccount: () => Promise<void>;
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
  if (patch.birthday !== undefined) next.birthday = patch.birthday;
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
  const [needsBirthdayPrompt, setNeedsBirthdayPrompt] = useState(false);
  /**
   * True once this launch has actually reached the server - either by signing in
   * or by revalidating the cached session. `status` alone no longer implies it:
   * a cached user makes us "authenticated" before the first byte comes back, and
   * the network-bound work below (minting a push token, PATCHing the timezone)
   * would then fire into a dead connection and silently give up for the session.
   */
  const [serverConfirmed, setServerConfirmed] = useState(false);
  const dismissBirthdayPrompt = useCallback(() => setNeedsBirthdayPrompt(false), []);

  // Mirror of `user` for optimistic updates that need the pre-edit snapshot to
  // revert to, without adding `user` to updateProfile's dependencies.
  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => {
    userRef.current = user;
    // Mirror every accepted user shape into the launch cache from one place, so
    // sign-in, sign-up, Google, profile edits and the timezone sync all keep it
    // fresh without each having to remember to. Sign-out and delete clear it.
    if (user) void saveCachedUser(user);
  }, [user]);

  // Re-hydrate the session on launch: cached user first so the splash can come
  // down at once, then revalidate against the server behind it. A hard 401 on
  // that revalidation still signs the user out through `setUnauthorizedHandler`
  // below, so the cache buys latency, not trust.
  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        await clearCachedUser();
        if (active) setStatus('unauthenticated');
        return;
      }

      const cached = await loadCachedUser();
      if (cached && active) {
        setUser(cached);
        setStatus('authenticated');
      }

      try {
        const me = await authApi.me();
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
        setServerConfirmed(true);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          // The server rejected the session - drop everything.
          await Promise.all([clearTokens(), clearCachedUser()]);
          setUser(null);
          setStatus('unauthenticated');
          return;
        }
        // Offline, or the API is still cold-starting. Keep the tokens: a
        // network blip must not cost the user their session. With a cache we
        // simply stay on the app; without one there is no user to render, so
        // fall back to login and let the next launch re-hydrate.
        if (!cached) setStatus('unauthenticated');
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
      setServerConfirmed(false);
      // Drop the launch cache too, or the next launch would briefly show the
      // app for a session the server has already rejected.
      void clearCachedUser();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Once authenticated: register this device for push (FR-23/54) and keep the
  // server timezone aligned with the device so reminders re-anchor after travel
  // (FR-52). Both are best-effort and native-aware (push no-ops on web).
  const userTimezone = user?.timezone ?? null;
  useEffect(() => {
    if (status !== 'authenticated' || !serverConfirmed) return;
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
  }, [status, serverConfirmed, userTimezone]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
    setStatus('authenticated');
    setServerConfirmed(true);
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<GoogleSignInStatus> => {
    const result = await runGoogleSignIn();
    if (result.status === 'ok') {
      const { accessToken, refreshToken, user: googleUser } = result.session;
      await saveTokens({ accessToken, refreshToken });
      setUser(googleUser);
      setNeedsBirthdayPrompt(result.session.isNew && !googleUser.birthday);
      setStatus('authenticated');
      setServerConfirmed(true);
    }
    return result.status;
  }, []);

  const signInWithApple = useCallback(async (): Promise<AppleSignInStatus> => {
    const result = await runAppleSignIn();
    if (result.status === 'ok') {
      const { accessToken, refreshToken, user: appleUser } = result.session;
      await saveTokens({ accessToken, refreshToken });
      setUser(appleUser);
      // Same rule as Google: only accounts CREATED by the social flow still owe
      // us a birthday - they never saw the signup form that asks for one.
      setNeedsBirthdayPrompt(result.session.isNew && !appleUser.birthday);
      setStatus('authenticated');
      setServerConfirmed(true);
    }
    return result.status;
  }, []);

  const completeGoogleSession = useCallback(async (handoff: string): Promise<boolean> => {
    try {
      const session = await authApi.googleSession(handoff);
      await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      setUser(session.user);
      setNeedsBirthdayPrompt(session.isNew && !session.user.birthday);
      setStatus('authenticated');
      setServerConfirmed(true);
      return true;
    } catch {
      // Expired/replayed handoff or a network failure - the route sends the user
      // back to the login screen to try again.
      return false;
    }
  }, []);

  const signUp = useCallback(
    async ({
      name,
      email,
      password,
      birthday,
    }: {
      name: string;
      email: string;
      password: string;
      birthday: DateParts;
    }) => {
      const res = await authApi.signup({
        name,
        email,
        password,
        birthday,
        timezone: detectTimezone(),
      });
      await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      setStatus('authenticated');
      setServerConfirmed(true);
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Hand the push token back BEFORE the access token goes away - otherwise
    // the device stays attached to this account server-side and keeps buzzing
    // with its birthdays, including for whoever signs in on this phone next.
    await unregisterPushNotifications();
    const tokens = await loadTokens();
    if (tokens) await authApi.logout(tokens.refreshToken);
    await Promise.all([clearTokens(), clearCachedUser()]);
    // Wipe the home-screen widget so it never shows the signed-out user's data
    // (Stage 10). Native-only + best-effort; a no-op on web.
    void clearWidget();
    setUser(null);
    setStatus('unauthenticated');
    setServerConfirmed(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    // Server wipes all data + revokes the tokens; on success mirror signOut's
    // local teardown. No logout call - the refresh token is already gone.
    await authApi.deleteAccount();
    await Promise.all([clearTokens(), clearCachedUser()]);
    void clearWidget();
    setUser(null);
    setStatus('unauthenticated');
    setServerConfirmed(false);
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
    () => ({
      status,
      user,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      completeGoogleSession,
      needsBirthdayPrompt,
      dismissBirthdayPrompt,
      signOut,
      deleteAccount,
      updateProfile,
      refreshUser,
    }),
    [
      status,
      user,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      completeGoogleSession,
      needsBirthdayPrompt,
      dismissBirthdayPrompt,
      signOut,
      deleteAccount,
      updateProfile,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
