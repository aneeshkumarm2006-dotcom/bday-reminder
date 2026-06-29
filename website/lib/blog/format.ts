/**
 * Fixed-locale, fixed-timezone date formatting so the server-rendered string and
 * any client re-render match exactly (no hydration mismatch).
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
