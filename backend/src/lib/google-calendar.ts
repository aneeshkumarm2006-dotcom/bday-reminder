/**
 * Google Calendar reader for the bulk-import feature (Stage 16). Hand-rolled
 * `fetch` against the Calendar API `events.list` endpoint - no SDK, matching
 * `lib/google-oauth.ts`. Reads TWO surfaces and merges them in `lib/google-import.ts`:
 *
 *  1. `fetchCalendarSpecialDates` - Google's curated "special dates" surface
 *     (`eventTypes=birthday`), which covers birthdays + anniversaries + custom
 *     dates that Google auto-generated from the user's Contacts.
 *  2. `fetchCalendarTitleSpecialDates` - the user's OWN hand-made all-day
 *     recurring events whose title looks like a birthday/anniversary (e.g.
 *     "Daddy bday"). These are ordinary `eventType=default` events that the
 *     special-dates surface above never returns, so without this pass a user who
 *     tracks birthdays as plain calendar events would import nothing.
 *
 * Only ever called with a short-lived access token.
 */

import { logger } from './logger';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MAX_PAGES = 20;
const WINDOW_DAYS = 366; // one year + a day, so each annual event surfaces exactly once

export type SpecialDateType = 'birthday' | 'anniversary' | 'custom';

/** A special date read off the calendar, normalized for merging. */
export interface CalendarSpecialDate {
  /** Linked contact resource name (`people/cXXX`) when Google correlates it; else null. */
  resourceName: string | null;
  type: SpecialDateType;
  month: number;
  day: number;
  /** For custom types, Google's label; otherwise null. */
  customName: string | null;
  /** Event title, used to recover a name for a calendar-only (unlinked) event. */
  summary: string | null;
}

// ── Raw Calendar API shapes (only the bits we read) ──────────────────────────
interface RawCalendarEvent {
  summary?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  birthdayProperties?: {
    type?: string; // 'birthday' | 'anniversary' | 'custom' | 'other' | 'self'
    contact?: string; // 'people/cXXX'
    customTypeName?: string;
  };
}

/** Map one birthday-type calendar event to a CalendarSpecialDate, or null to skip. */
function mapEvent(ev: RawCalendarEvent): CalendarSpecialDate | null {
  const bp = ev.birthdayProperties;
  const rawType = (bp?.type ?? 'birthday').toLowerCase();
  if (rawType === 'self') return null; // the user's own birthday - not a contact to import

  // Birthdays are all-day events → `start.date` = 'YYYY-MM-DD' (the instance year is
  // this calendar year, NOT the birth year, so we deliberately drop it).
  const date = ev.start?.date;
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const type: SpecialDateType =
    rawType === 'anniversary' ? 'anniversary' : rawType === 'birthday' ? 'birthday' : 'custom';

  return {
    resourceName: bp?.contact ?? null,
    type,
    month,
    day,
    customName: type === 'custom' ? bp?.customTypeName?.trim() || null : null,
    summary: ev.summary?.trim() || null,
  };
}

// ── Title-based detection of hand-made birthday/anniversary events ───────────
// Free-text queries used to narrow the calendar down server-side before we
// title-match client-side. `q` is a token-based full-text search over the event
// (summary, description, etc.), so each spelling needs its own query ("bday" and
// "birthday" are different tokens). Kept in sync with the title regexes below -
// every regex keyword should have a query here so the event is actually fetched.
const TITLE_QUERIES = ['birthday', 'bday', 'anniversary', 'anniv', 'born', 'dob'];
// Whole-word (or emoji) matches, so "Deborah" never trips "dob" and "reborn"
// never trips "born". Covers birthday / bday / b-day / b'day / dob / born, plus
// the 🎂 cake & 🎈 balloon emoji, and anniversary / anniv / 💍.
const BIRTHDAY_TITLE_RE = /(?:\b(?:birthdays?|b['’-]?days?|dob|born)\b|🎂|🎈)/iu;
const ANNIVERSARY_TITLE_RE = /(?:\banniversar(?:y|ies)\b|\banniv\b|💍)/iu;

/**
 * Map one ordinary calendar event to a CalendarSpecialDate purely from its title.
 * Only all-day events qualify (a *timed* event that merely mentions "birthday" is
 * almost always a party/meeting, not the annual date itself). Returns null to skip.
 */
function mapTitleEvent(ev: RawCalendarEvent): CalendarSpecialDate | null {
  const summary = ev.summary?.trim();
  if (!summary) return null;

  const isAnniversary = ANNIVERSARY_TITLE_RE.test(summary);
  const isBirthday = BIRTHDAY_TITLE_RE.test(summary);
  if (!isAnniversary && !isBirthday) return null;

  // All-day events carry `start.date`; timed events carry `start.dateTime` instead.
  const date = ev.start?.date;
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return {
    resourceName: null,
    // A title with both words (rare) is treated as a birthday so it can become a person.
    type: isBirthday ? 'birthday' : 'anniversary',
    month,
    day,
    customName: null,
    summary,
  };
}

/**
 * Page through `events.list` with the given params, collecting raw items. A 403
 * (the user declined `calendar.readonly`) is a soft failure - return what we have
 * so the Contacts source can still import - rather than throwing.
 */
async function listEvents(accessToken: string, params: URLSearchParams): Promise<RawCalendarEvent[]> {
  const out: RawCalendarEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    if (pageToken) params.set('pageToken', pageToken);
    else params.delete('pageToken');

    const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 403) {
      logger.warn('google calendar: 403 (calendar.readonly not granted?), skipping calendar source');
      return out;
    }
    if (!res.ok) {
      throw new Error(`google calendar events.list failed (${res.status})`);
    }
    const data = (await res.json().catch(() => null)) as {
      items?: RawCalendarEvent[];
      nextPageToken?: string;
    } | null;

    for (const ev of data?.items ?? []) out.push(ev);
    pageToken = data?.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PAGES);

  return out;
}

/** The ~1-year window: each annually-recurring event yields exactly ONE instance. */
function currentWindow(): { timeMin: string; timeMax: string } {
  const now = new Date();
  return {
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Fetch + normalize the user's Google Calendar birthdays/anniversaries/custom
 * dates from Google's curated "special dates" surface (auto-generated from
 * Contacts). Constrains the query to a single ~1-year window so each annually-
 * recurring event yields exactly ONE instance.
 */
export async function fetchCalendarSpecialDates(accessToken: string): Promise<CalendarSpecialDate[]> {
  const { timeMin, timeMax } = currentWindow();
  const params = new URLSearchParams({
    eventTypes: 'birthday',
    singleEvents: 'true',
    timeMin,
    timeMax,
    maxResults: '250',
  });

  const items = await listEvents(accessToken, params);
  const out: CalendarSpecialDate[] = [];
  for (const ev of items) {
    const mapped = mapEvent(ev);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * Fetch birthdays/anniversaries the user tracks as ORDINARY all-day recurring
 * events (e.g. "Daddy bday") - the ones Google's special-dates surface omits.
 * Runs a small set of free-text `q` queries to narrow the calendar server-side,
 * then title-matches each all-day result and de-duplicates across the queries
 * (an event matching two keywords comes back twice). Fails soft on 403.
 */
export async function fetchCalendarTitleSpecialDates(accessToken: string): Promise<CalendarSpecialDate[]> {
  const { timeMin, timeMax } = currentWindow();
  const seen = new Set<string>();
  const out: CalendarSpecialDate[] = [];

  for (const q of TITLE_QUERIES) {
    const params = new URLSearchParams({
      q,
      singleEvents: 'true',
      timeMin,
      timeMax,
      maxResults: '250',
    });

    const items = await listEvents(accessToken, params);
    for (const ev of items) {
      const mapped = mapTitleEvent(ev);
      if (!mapped) continue;
      // Dedupe by the identifying fields (no stable id is read); avoids one event
      // surfacing once per matching keyword.
      const key = `${mapped.type}|${(mapped.summary ?? '').toLowerCase()}|${mapped.month}-${mapped.day}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(mapped);
    }
  }

  return out;
}
