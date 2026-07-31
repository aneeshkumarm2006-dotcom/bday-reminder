/**
 * Draft parking for the Gmail consent round-trip.
 *
 * Connecting Gmail hands the browser to Google and comes back on
 * `/settings?gmail=…`. That's fine on a desktop where the consent runs in a
 * second tab — the original tab keeps its React state — but on phones the new
 * tab *is* the view, so the user lands on Settings and everything they had typed
 * into the person form is gone. Before the hand-off, the page parks a snapshot
 * of itself here; Settings sees the record and bounces back to `returnTo` with
 * `?resume=gmail`, and the form restores from it.
 *
 * localStorage (not sessionStorage) because the return can land in a different
 * tab than the one that started it. Restore only happens on that explicit
 * `resume=gmail` navigation, so a leftover record can't surface in an unrelated
 * visit later; the TTL sweeps it up regardless.
 */

const KEY = "br_gmail_return";
const TTL_MS = 30 * 60 * 1000;

export type GmailReturn<T = unknown> = {
  /** In-site path to land back on, e.g. "/people/new". */
  returnTo: string;
  /** Page state to rehydrate; the shape is owned by the page that saved it. */
  draft?: T;
};

type Stored = GmailReturn & { savedAt: number };

/** Park a page snapshot before leaving for Google. */
export function saveGmailReturn<T>(pending: GmailReturn<T>): void {
  try {
    const stored: Stored = { ...pending, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Private mode / quota - no resume, but never block the connect for it.
  }
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    // Only same-site absolute paths, never "//evil.com" - this value decides a
    // navigation, so it stays a path we could have written ourselves.
    const ok =
      typeof parsed?.returnTo === "string" &&
      parsed.returnTo.startsWith("/") &&
      !parsed.returnTo.startsWith("//");
    if (!ok || Date.now() - parsed.savedAt > TTL_MS) {
      clearGmailReturn();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Read without consuming - for deciding where to bounce back to. */
export function peekGmailReturn(): GmailReturn | null {
  return read();
}

/** Read and consume - for the page restoring itself. */
export function takeGmailReturn<T>(): GmailReturn<T> | null {
  const stored = read();
  if (stored) clearGmailReturn();
  return (stored as GmailReturn<T> | null) ?? null;
}

export function clearGmailReturn(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do - a stale record expires on its own.
  }
}
