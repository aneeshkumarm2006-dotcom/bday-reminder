/**
 * iCalendar (RFC 5545) serialization for the subscribable feed (TODO Stage 9;
 * FR-38). Pure string building — no I/O — so the calendar route and the smoke
 * test can exercise it directly. Each event is one all-day, yearly-recurring
 * VEVENT (`RRULE:FREQ=YEARLY`) with a stable UID, so a calendar that refreshes
 * the feed updates an event in place rather than duplicating it (FR-39).
 *
 * Output uses CRLF line endings, folds long lines at 75 octets (§3.5), and
 * escapes TEXT values (§3.3.11).
 */

/** Escape a TEXT value per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a content line to ≤75 octets (§3.5). Continuation lines are prefixed with
 * a single space when joined, so each continuation chunk holds ≤74 content
 * octets. Folds on character boundaries so a multi-byte codepoint is never split.
 */
function foldLine(line: string): string {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    const limit = chunks.length === 0 ? 75 : 74;
    if (currentBytes + chBytes > limit) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  chunks.push(current);
  return chunks.join('\r\n ');
}

/** All-day date value, `YYYYMMDD` from the date's UTC parts. */
function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** UTC date-time stamp, `YYYYMMDDTHHMMSSZ`. */
function formatDateTimeUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export interface IcsEvent {
  /** Stable, globally-unique id so refreshes update in place (FR-39). */
  uid: string;
  summary: string;
  description?: string;
  /** All-day start, a UTC-midnight calendar date. */
  start: Date;
  /** All-day end, exclusive (typically `start` + 1 day). */
  end: Date;
  /** When this serialization was produced. */
  dtstamp: Date;
  /** Source last-modified time, so calendars can detect edits (FR-39). */
  lastModified?: Date;
  categories?: string;
}

export interface CalendarOptions {
  name: string;
  description?: string;
  events: IcsEvent[];
}

/** Serialize a VCALENDAR with one yearly-recurring VEVENT per event. */
export function buildCalendar(opts: CalendarOptions): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Circle the date//Birthday Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    // Hint clients to re-fetch roughly twice a day so adds/edits/deletes surface
    // without a manual refresh (FR-39).
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];
  if (opts.description) lines.push(`X-WR-CALDESC:${escapeText(opts.description)}`);

  for (const event of opts.events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${formatDateTimeUtc(event.dtstamp)}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(event.end)}`);
    lines.push('RRULE:FREQ=YEARLY');
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.categories) lines.push(`CATEGORIES:${escapeText(event.categories)}`);
    if (event.lastModified) lines.push(`LAST-MODIFIED:${formatDateTimeUtc(event.lastModified)}`);
    // All-day informational events shouldn't mark the user busy.
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
