/**
 * Curated IANA timezone list for the auto-send "send in this timezone" picker.
 * A hand-picked set (not the full ~400-zone IANA database) keeps the picker
 * usable while covering the US/CA-first product plus one representative zone per
 * major world region — enough to greet a friend abroad at *their* local time.
 *
 * `id` is the IANA name persisted on the person; `label` is the human name shown.
 * US & Canada lead the list to match the product's US/CA-first default. Mirror of
 * the website's `lib/timezones.ts` (the two frontends don't share a package).
 */

export type TimeZoneOption = { id: string; label: string };

export const TIMEZONE_OPTIONS: TimeZoneOption[] = [
  // United States & Canada
  { id: 'America/New_York', label: 'Eastern Time — New York (US & Canada)' },
  { id: 'America/Chicago', label: 'Central Time — Chicago (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain Time — Denver (US & Canada)' },
  { id: 'America/Phoenix', label: 'Arizona — Phoenix (no daylight saving)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time — Los Angeles (US & Canada)' },
  { id: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { id: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
  { id: 'America/Halifax', label: 'Atlantic — Halifax (Canada)' },
  { id: 'America/St_Johns', label: "Newfoundland — St. John's" },
  // Latin America
  { id: 'America/Mexico_City', label: 'Mexico City' },
  { id: 'America/Bogota', label: 'Colombia — Bogotá' },
  { id: 'America/Sao_Paulo', label: 'Brazil — São Paulo' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina — Buenos Aires' },
  // Europe & Africa
  { id: 'Europe/London', label: 'United Kingdom — London' },
  { id: 'Europe/Paris', label: 'Central Europe — Paris' },
  { id: 'Europe/Berlin', label: 'Central Europe — Berlin' },
  { id: 'Europe/Athens', label: 'Eastern Europe — Athens' },
  { id: 'Europe/Moscow', label: 'Moscow' },
  { id: 'Africa/Lagos', label: 'West Africa — Lagos' },
  { id: 'Africa/Cairo', label: 'Egypt — Cairo' },
  { id: 'Africa/Johannesburg', label: 'South Africa — Johannesburg' },
  // Middle East & Asia
  { id: 'Asia/Dubai', label: 'Gulf — Dubai' },
  { id: 'Asia/Karachi', label: 'Pakistan — Karachi' },
  { id: 'Asia/Kolkata', label: 'India — Kolkata' },
  { id: 'Asia/Dhaka', label: 'Bangladesh — Dhaka' },
  { id: 'Asia/Bangkok', label: 'Thailand — Bangkok' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { id: 'Asia/Shanghai', label: 'China — Shanghai' },
  { id: 'Asia/Tokyo', label: 'Japan — Tokyo' },
  { id: 'Asia/Seoul', label: 'South Korea — Seoul' },
  // Oceania
  { id: 'Australia/Perth', label: 'Australia — Perth' },
  { id: 'Australia/Sydney', label: 'Australia — Sydney' },
  { id: 'Pacific/Auckland', label: 'New Zealand — Auckland' },
];

const LABEL_BY_ID = new Map(TIMEZONE_OPTIONS.map((o) => [o.id, o.label]));

/** Human label for a stored zone id, falling back to the raw IANA name. */
export function timeZoneLabel(id: string): string {
  return LABEL_BY_ID.get(id) ?? id;
}

/**
 * Best-effort current UTC-offset suffix for a zone, e.g. "GMT-5" / "GMT+5:30".
 * Returns "" if the runtime can't resolve the zone (keeps the picker resilient
 * on engines with partial Intl support).
 */
export function zoneOffsetLabel(id: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const map: Record<string, number> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value);
    // The wall-clock the zone shows for this instant, read back as if it were UTC.
    const asUtc = Date.UTC(
      map.year,
      (map.month ?? 1) - 1,
      map.day,
      map.hour === 24 ? 0 : map.hour,
      map.minute,
      map.second,
    );
    const offsetMin = Math.round((asUtc - at.getTime()) / 60000);
    if (!Number.isFinite(offsetMin)) return '';
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `GMT${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
  } catch {
    return '';
  }
}
