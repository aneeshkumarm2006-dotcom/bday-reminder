import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from './api';

/**
 * Last known `/me`, kept so launch does not have to wait on the network.
 *
 * Rehydration used to block on `GET /me` before the splash could come down. The
 * API is on Render, which spins idle instances down, so the first launch of the
 * day could sit on the splash for the length of a cold start - a blank-looking
 * wait with no way to tell it apart from a hang.
 *
 * With a cache we can show the app straight away and revalidate behind it. This
 * weakens nothing: the same `/me` call still runs, and a revoked or expired
 * session still signs the user out through the existing hard-401 handler. The
 * only thing on screen in the meantime is the user's own last-seen profile.
 *
 * Not secret (the tokens live in SecureStore; this is name/email/prefs), so
 * AsyncStorage is the right home - and it is available on web too.
 */

const KEY = 'circle_cached_user';

export async function saveCachedUser(user: AuthUser): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // A cache that fails to write just means the next launch waits, as before.
  }
}

export async function loadCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    // Guard against a shape change between app versions writing garbage into
    // the tree: anything without an id is not worth rendering the app around.
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort; the tokens are gone regardless, so the cache is unreachable.
  }
}
