/**
 * "Where was I heading?" for the sign-in detour.
 *
 * Invite links (`/invite/<token>`) are opened by people who usually don't have
 * an account yet: the guard bounces them to /login, and without a return path
 * the invite is simply lost after they sign up. Every authed route carries the
 * path it wanted through `?next=`, and the auth pages land there instead of the
 * calendar.
 *
 * The value decides a navigation, so it is only ever a same-site absolute path -
 * never "//evil.com", never an absolute URL.
 */

const KEY = "br_auth_next";

/** Default landing spot when nothing was requested. */
export const DEFAULT_AFTER_AUTH = "/calendar";

/** Accept only paths we could have written ourselves. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** `?next=` off the current URL, validated. */
export function readNextParam(search: string): string | null {
  return safeNextPath(new URLSearchParams(search).get("next"));
}

/** Build "/login?next=…" for a path the guard just turned away. */
export function withNext(target: string, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `${target}?next=${encodeURIComponent(safe)}` : target;
}

/**
 * Park the return path across a full-page hand-off to Google, which comes back
 * on /auth/google with only its own handoff token in the URL.
 */
export function stashNextPath(next: string | null | undefined): void {
  try {
    const safe = safeNextPath(next);
    if (safe) window.sessionStorage.setItem(KEY, safe);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Private mode - the user just lands on the default. Never block sign-in.
  }
}

/** Read and consume the parked return path. */
export function takeStashedNextPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return safeNextPath(value);
  } catch {
    return null;
  }
}
