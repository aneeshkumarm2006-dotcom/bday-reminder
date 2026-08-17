/**
 * The web app has a favicon, not a launcher icon, and the site already serves a
 * date-aware one of its own. Metro resolves this file for web so the native
 * dynamic-icon module is never bundled there.
 */
export async function syncAppIconToToday(): Promise<void> {
  // No-op on web.
}

export function startAppIconSync(): () => void {
  return () => {};
}
