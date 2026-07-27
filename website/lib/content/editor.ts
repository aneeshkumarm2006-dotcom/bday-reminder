/**
 * Editor attribution for a shared-password dashboard.
 *
 * The whole SEO team signs in with one password, so the session says nothing
 * about *who* is editing. The login form takes an optional display name and
 * stores it here, in a second cookie that is deliberately **unsigned and not
 * httpOnly**: it is stamped onto audit entries and revisions, exactly like the
 * blog's free-text `author` field. Anyone can set it to anything — it is
 * attribution, never authorization, and no code may branch on it.
 *
 * Isomorphic on purpose (the login form reads the cookie to prefill the field).
 * The server-side reader lives in `editor-server.ts` so `next/headers` never
 * reaches a client bundle.
 */
export const EDITOR_COOKIE = "seoteam_editor";
export const EDITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/** Strip anything that isn't a plain, short display name. */
export function normalizeEditorName(input: string | undefined | null): string {
  return (input ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
