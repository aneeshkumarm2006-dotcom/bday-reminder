/**
 * Google bulk-import orchestration (Stage 16). Fetches the user's Google Contacts
 * and Google Calendar special dates in parallel, MERGES the two sources into one
 * de-duplicated candidate list, and hands back `RawCandidate[]` in exactly the
 * shape the existing import pipeline (`annotateCandidates` → preview → commit)
 * already consumes - so the Google source reuses the same duplicate detection,
 * review/consent screen, and add/merge/skip commit as the CSV/contacts import.
 *
 * Merge rules: Contacts is the source of truth for identity/name/year/email/phone;
 * Calendar only ADDS a date a linked contact lacks and UNIONS anniversary/custom
 * events. A calendar special date with no linked contact becomes a best-effort
 * standalone candidate (name recovered from the event title, else dropped).
 */

import {
  fetchCalendarSpecialDates,
  type CalendarSpecialDate,
} from './google-calendar';
import { fetchContacts, type NormalizedContact } from './google-contacts';
import {
  MAX_IMPORT_ROWS,
  normalizeName,
  type ParsedDob,
  type ParsedEventItem,
  type RawCandidate,
} from './import';
import { logger } from './logger';

export interface GoogleImportResult {
  candidates: RawCandidate[];
  /** True when the merged list hit MAX_IMPORT_ROWS and was cut short. */
  truncated: boolean;
}

/** A person being assembled from one or both sources before final conversion. */
interface WorkingCandidate {
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  birthday: ParsedDob | null;
  events: ParsedEventItem[];
}

/** Stable key for de-duplicating a person's events (type + name + month/day). */
function eventKey(e: ParsedEventItem): string {
  return `${e.type}|${(e.customName ?? '').toLowerCase()}|${e.date.month}-${e.date.day}`;
}

/** Append an event only if the candidate doesn't already have an equivalent one. */
function addEvent(list: ParsedEventItem[], e: ParsedEventItem): void {
  const key = eventKey(e);
  if (!list.some((x) => eventKey(x) === key)) list.push(e);
}

function dedupeEvents(list: ParsedEventItem[]): ParsedEventItem[] {
  const seen = new Set<string>();
  const out: ParsedEventItem[] = [];
  for (const e of list) {
    const key = eventKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Recover a display name from a calendar-only event title ("Jane's birthday" → "Jane"). */
function deriveNameFromSummary(summary: string | null): string | null {
  if (!summary) return null;
  // Strip a trailing possessive event suffix; leave a plain "Jane Doe" untouched.
  const stripped = summary.replace(/[’']s\s+(birthday|anniversary|bday)\b.*$/i, '').trim();
  if (/^(birthday|anniversary|bday)$/i.test(stripped)) return null;
  return stripped.length ? stripped : null;
}

/** Turn a merged calendar special date into a ParsedEventItem (non-birthday types). */
function calEventToItem(cd: CalendarSpecialDate): ParsedEventItem {
  const date: ParsedDob = { month: cd.month, day: cd.day, year: null };
  if (cd.type === 'anniversary') return { type: 'anniversary', customName: null, date };
  return { type: 'custom', customName: cd.customName || cd.summary || 'Event', date };
}

/**
 * Merge already-fetched Contacts + Calendar results into candidates. Split out
 * (pure) so it can be unit-tested with fixture payloads, no network.
 */
export function mergeGoogleSources(
  contacts: NormalizedContact[],
  calDates: CalendarSpecialDate[],
): GoogleImportResult {
  const byResource = new Map<string, WorkingCandidate>();
  const byNameDate = new Set<string>(); // normalizeName|month-day, to dedupe calendar-only births
  const order: WorkingCandidate[] = [];

  const nameDateKey = (name: string, dob: ParsedDob) =>
    `${normalizeName(name)}|${dob.month}-${dob.day}`;

  for (const c of contacts) {
    const wc: WorkingCandidate = {
      name: c.name,
      email: c.email,
      phone: c.phone,
      photoUrl: c.photoUrl,
      birthday: c.birthday,
      events: [...c.events],
    };
    byResource.set(c.resourceName, wc);
    order.push(wc);
    if (c.birthday) byNameDate.add(nameDateKey(c.name, c.birthday));
  }

  for (const cd of calDates) {
    // 1. Linked to a contact we already have → fold the date in (Contacts wins).
    const linked = cd.resourceName ? byResource.get(cd.resourceName) : null;
    if (linked) {
      if (cd.type === 'birthday') {
        if (!linked.birthday) {
          linked.birthday = { month: cd.month, day: cd.day, year: null };
          byNameDate.add(nameDateKey(linked.name, linked.birthday));
        }
      } else {
        addEvent(linked.events, calEventToItem(cd));
      }
      continue;
    }

    // 2. Calendar-only special date - recover a name or drop it (import only what we can).
    const name = deriveNameFromSummary(cd.summary);
    if (!name) continue;

    if (cd.type === 'birthday') {
      // Skip if a contact already covers this exact person+date (avoids a needless dup row).
      const key = nameDateKey(name, { month: cd.month, day: cd.day, year: null });
      if (byNameDate.has(key)) continue;
      byNameDate.add(key);
      order.push({
        name,
        email: null,
        phone: null,
        photoUrl: null,
        birthday: { month: cd.month, day: cd.day, year: null },
        events: [],
      });
    } else {
      // A calendar-only anniversary/custom with no birthday can't become a person
      // (Person requires a DOB); attach it to an unlinked same-name candidate if one
      // exists, else drop it.
      const host = order.find((w) => normalizeName(w.name) === normalizeName(name) && w.birthday);
      if (host) addEvent(host.events, calEventToItem(cd));
    }
  }

  const candidates: RawCandidate[] = [];
  let truncated = false;
  for (const wc of order) {
    if (!wc.birthday) continue; // Person requires a DOB - anniversary-only entries are dropped.
    if (candidates.length >= MAX_IMPORT_ROWS) {
      truncated = true;
      break;
    }
    candidates.push({
      name: wc.name,
      relationshipTag: null,
      phone: wc.phone,
      photoUrl: wc.photoUrl,
      dob: wc.birthday,
      email: wc.email,
      events: dedupeEvents(wc.events),
      rawDob: null,
    });
  }

  return { candidates, truncated };
}

/**
 * Fetch both Google sources with a fresh access token and merge them. Each source
 * fails soft (a thrown/403 fetch degrades to an empty list) so one granted scope
 * still imports even if the other was declined.
 */
export async function buildGoogleCandidates(accessToken: string): Promise<GoogleImportResult> {
  const [contacts, calDates] = await Promise.all([
    fetchContacts(accessToken).catch((err) => {
      logger.error('google contacts fetch failed', err instanceof Error ? err.message : err);
      return [] as NormalizedContact[];
    }),
    fetchCalendarSpecialDates(accessToken).catch((err) => {
      logger.error('google calendar fetch failed', err instanceof Error ? err.message : err);
      return [] as CalendarSpecialDate[];
    }),
  ]);

  return mergeGoogleSources(contacts, calDates);
}
