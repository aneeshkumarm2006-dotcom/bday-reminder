/**
 * Google Calendar reader for the bulk-import feature (Stage 16). Hand-rolled
 * `fetch` against the Calendar API `events.list` endpoint - no SDK, matching
 * `lib/google-oauth.ts`. Reads ONLY Google's curated "special dates" surface
 * (`eventTypes=birthday`, which covers birthdays + anniversaries + custom dates
 * sourced from Contacts) - never the user's regular meetings. `lib/google-import.ts`
 * merges these with the Contacts source. Only called with a short-lived access token.
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

/**
 * Fetch + normalize the user's Google Calendar birthdays/anniversaries/custom
 * dates. Constrains the query to a single ~1-year window so each annually-recurring
 * event yields exactly ONE instance (this is how we dedupe Google's own recurrences
 * instead of a multi-year `singleEvents` fan-out). A 403 (the user declined
 * `calendar.readonly`) is a soft failure - return what we have so Contacts can still
 * import - rather than throwing.
 */
export async function fetchCalendarSpecialDates(accessToken: string): Promise<CalendarSpecialDate[]> {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const out: CalendarSpecialDate[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      eventTypes: 'birthday',
      singleEvents: 'true',
      timeMin,
      timeMax,
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);

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

    for (const ev of data?.items ?? []) {
      const mapped = mapEvent(ev);
      if (mapped) out.push(mapped);
    }
    pageToken = data?.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PAGES);

  return out;
}
