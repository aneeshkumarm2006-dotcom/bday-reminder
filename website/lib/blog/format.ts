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

/** Human-readable file size (e.g. "1.4 MB"). Returns "—" for 0 / unknown. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const value = i === 0 ? n : Math.round(n * 10) / 10;
  return `${value} ${units[i]}`;
}
