import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Draft parking for screens that leave the app mid-form.
 *
 * The Gmail consent round-trip returns through the `circlethedate://` deep link.
 * On Android that redirect frequently arrives as a *fresh Intent*, which resets
 * the navigation stack — the add-person screen unmounts and everything typed
 * into it is gone. Before handing off to Google, a screen parks a snapshot of
 * itself here; `gmail-connected.tsx` reads where to go back to, and the screen
 * re-mounts with `?resume=1` and restores the snapshot.
 *
 * Restore only ever happens on that explicit `resume` navigation, so a record
 * left behind by a normal (non-navigating) OAuth session can't leak into a
 * later, unrelated visit to the same screen. The TTL sweeps those up anyway.
 */

const KEY = 'circle_pending_return';
const TTL_MS = 30 * 60 * 1000;

/** Screens that can be resumed after an external auth round-trip. */
export type ResumeRoute = '/add-person' | '/person/[id]';

export type PendingReturn<T = unknown> = {
  pathname: ResumeRoute;
  /** Route params to land back with (`resume` is added by the returning screen). */
  params?: Record<string, string>;
  /** Screen state to rehydrate; the shape is owned by the screen that saved it. */
  draft?: T;
};

type Stored = PendingReturn & { savedAt: number };

/** Park a screen snapshot before leaving for an external auth flow. */
export async function savePendingReturn<T>(pending: PendingReturn<T>): Promise<void> {
  try {
    const stored: Stored = { ...pending, savedAt: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage failures just mean no resume - never block the auth flow for it.
  }
}

async function read(): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.pathname || Date.now() - parsed.savedAt > TTL_MS) {
      await clearPendingReturn();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Read without consuming - for deciding where to navigate back to. */
export async function peekPendingReturn(): Promise<PendingReturn | null> {
  return read();
}

/** Read and consume - for the screen restoring itself. */
export async function takePendingReturn<T>(): Promise<PendingReturn<T> | null> {
  const stored = await read();
  if (stored) await clearPendingReturn();
  return (stored as PendingReturn<T> | null) ?? null;
}

export async function clearPendingReturn(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do - a stale record expires on its own.
  }
}
