/**
 * Google Contacts (People API) reader for the bulk-import feature (Stage 16).
 * Hand-rolled `fetch` against the People API `connections.list` endpoint - no SDK,
 * matching `lib/google-oauth.ts`. Reads each connection's name, birthday,
 * anniversary/other dated events, email, phone, and photo, normalizing them into
 * the shape `lib/google-import.ts` merges with the Calendar source. Only ever
 * called with a short-lived access token minted from the stored refresh token.
 */

import {
  parseDob,
  validateDob,
  type ParsedDob,
  type ParsedEventItem,
} from './import';
import { logger } from './logger';

const CONNECTIONS_URL = 'https://people.googleapis.com/v1/people/me/connections';
const PERSON_FIELDS = 'names,birthdays,events,emailAddresses,phoneNumbers,photos,metadata';
const PAGE_SIZE = 1000; // People API max
const MAX_PAGES = 30; // safety bound (~30k contacts) so a runaway paginator can't spin

/** A connection normalized to the fields the importer cares about. */
export interface NormalizedContact {
  /** People API resource name (`people/cXXX`); the cross-source key with Calendar. */
  resourceName: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  birthday: ParsedDob | null;
  events: ParsedEventItem[];
}

// ── Raw People API shapes (only the bits we read) ────────────────────────────
interface FieldMetadata {
  primary?: boolean;
}
interface RawDate {
  year?: number;
  month?: number;
  day?: number;
}
interface RawConnection {
  resourceName?: string;
  names?: Array<{ displayName?: string; metadata?: FieldMetadata }>;
  birthdays?: Array<{ date?: RawDate; text?: string; metadata?: FieldMetadata }>;
  events?: Array<{ date?: RawDate; type?: string; formattedType?: string }>;
  emailAddresses?: Array<{ value?: string; metadata?: FieldMetadata }>;
  phoneNumbers?: Array<{ value?: string; metadata?: FieldMetadata }>;
  photos?: Array<{ url?: string; default?: boolean; metadata?: FieldMetadata }>;
}

/** Prefer the entry Google marks `primary`, else the first present one. */
function pickPrimary<T extends { metadata?: FieldMetadata }>(arr: T[] | undefined): T | null {
  if (!arr || arr.length === 0) return null;
  return arr.find((x) => x.metadata?.primary) ?? arr[0];
}

/** A People API `date {year?,month,day}` → our ParsedDob, or null if incomplete/invalid. */
function dobFromApiDate(date: RawDate | undefined): ParsedDob | null {
  if (!date || date.month == null || date.day == null) return null;
  return validateDob({ month: date.month, day: date.day, year: date.year ?? null });
}

/** Map one `events[]` entry (anniversary / other / custom) to a ParsedEventItem, or null. */
function mapContactEvent(ev: NonNullable<RawConnection['events']>[number]): ParsedEventItem | null {
  const date = dobFromApiDate(ev.date);
  if (!date) return null;
  const rawType = (ev.type ?? '').trim().toLowerCase();
  if (rawType === 'anniversary') {
    return { type: 'anniversary', customName: null, date };
  }
  // Everything else (`other` or a user-defined type) becomes a named custom event.
  const label = (ev.formattedType ?? ev.type ?? 'Event').toString().trim() || 'Event';
  return { type: 'custom', customName: label.slice(0, 60), date };
}

/** Map a raw connection to NormalizedContact, or null when it has no usable name. */
function mapConnection(c: RawConnection): NormalizedContact | null {
  const resourceName = c.resourceName?.trim();
  if (!resourceName) return null;
  const name = pickPrimary(c.names)?.displayName?.trim();
  if (!name) return null; // import only what we can - a nameless contact can't become a person

  // Birthday: prefer a structured date; fall back to parsing free `text` ("June 5").
  let birthday: ParsedDob | null = null;
  for (const b of c.birthdays ?? []) {
    birthday = dobFromApiDate(b.date) ?? parseDob(b.text ?? null);
    if (birthday) break;
  }

  const events: ParsedEventItem[] = [];
  for (const ev of c.events ?? []) {
    const mapped = mapContactEvent(ev);
    if (mapped) events.push(mapped);
  }

  const email = pickPrimary(c.emailAddresses)?.value?.trim().toLowerCase() || null;
  const phone = pickPrimary(c.phoneNumbers)?.value?.trim() || null;
  // Skip Google's default silhouette avatar; keep a real hosted (https) photo.
  const realPhoto = (c.photos ?? []).find((p) => !p.default && p.url);
  const photoUrl = realPhoto?.url?.startsWith('http') ? realPhoto.url : null;

  return { resourceName, name, email, phone, photoUrl, birthday, events };
}

/**
 * Fetch + normalize the user's Google Contacts. Pages to exhaustion (bounded by
 * MAX_PAGES). A 403 (the user granularly declined `contacts.readonly` on the
 * consent screen) is a soft failure - return what we have so the Calendar source
 * can still import - rather than throwing.
 */
export async function fetchContacts(accessToken: string): Promise<NormalizedContact[]> {
  const out: NormalizedContact[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      personFields: PERSON_FIELDS,
      pageSize: String(PAGE_SIZE),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CONNECTIONS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 403) {
      logger.warn('google contacts: 403 (contacts.readonly not granted?), skipping contacts source');
      return out;
    }
    if (!res.ok) {
      throw new Error(`google people connections.list failed (${res.status})`);
    }
    const data = (await res.json().catch(() => null)) as {
      connections?: RawConnection[];
      nextPageToken?: string;
    } | null;

    for (const c of data?.connections ?? []) {
      const mapped = mapConnection(c);
      if (mapped) out.push(mapped);
    }
    pageToken = data?.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PAGES);

  return out;
}
