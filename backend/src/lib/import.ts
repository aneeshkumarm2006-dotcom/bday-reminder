/**
 * Import parsing (TODO Stage 7; FR-6/7/11). Turns a pasted CSV (or already-
 * structured device-contact rows) into normalized candidate people, parsing the
 * many shapes a real spreadsheet's "date of birth" column takes, and provides
 * the dedupe key used to flag possible duplicates (same name + same DOB). The
 * route layer (`routes/import.ts`) handles HTTP, validation status, and
 * duplicate matching against existing people.
 */

import { maxDayInMonth } from './dates';

const CURRENT_YEAR = new Date().getUTCFullYear();

/** Hard cap on rows a single import can carry (matches the preview/commit Zod max). */
export const MAX_IMPORT_ROWS = 2000;

/** A parsed date of birth - month/day required, year optional (FR-14). */
export interface ParsedDob {
  month: number;
  day: number;
  year: number | null;
}

/**
 * An extra dated event (anniversary/custom) to attach to an imported person, on
 * top of their birthday. Sourced from Google Contacts/Calendar; the CSV path
 * never sets these. `date` is already validated (month/day required, year optional).
 */
export interface ParsedEventItem {
  type: 'anniversary' | 'custom';
  customName: string | null;
  date: ParsedDob;
}

/** A normalized import candidate, before validation/duplicate annotation. */
export interface RawCandidate {
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  photoUrl: string | null;
  dob: ParsedDob | null;
  /** The person's own email (Google Contacts import only); CSV leaves this null. */
  email: string | null;
  /** Extra anniversary/custom events (Google import only); CSV leaves this empty. */
  events: ParsedEventItem[];
  /** The original DOB text (CSV only), kept to explain an unparseable date. */
  rawDob: string | null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Expand a 2-digit year around a sliding pivot; pass 4-digit years through. */
function expandYear(y: number): number {
  if (y >= 100) return y;
  const pivot = CURRENT_YEAR % 100;
  return y <= pivot ? 2000 + y : 1900 + y;
}

/** Validate a month/day(/year) triple, returning null if it can't be a real DOB. */
function validate(month: number, day: number, year: number | null): ParsedDob | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > maxDayInMonth(month)) return null;
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR)) return null;
  return { month, day, year };
}

/**
 * Validate an already-structured DOB (e.g. from a device contact). Returns the
 * normalized parts or null when it can't be a real date - callers turn null into
 * an `invalid` import row rather than rejecting the whole request.
 */
export function validateDob(parts: { month: number; day: number; year?: number | null }): ParsedDob | null {
  return validate(parts.month, parts.day, parts.year ?? null);
}

/**
 * Parse a free-form date of birth into month/day(/year). Handles:
 *   • ISO `1990-03-05` (also `/` or `.` separators)
 *   • month names `5 March 1990`, `March 5, 1990`, `Mar 5`, `5 Mar 90`
 *   • numeric `03/05/1990`, `5-3`, `03.05.90`
 * Numeric forms disambiguate by the >12 rule (a part over 12 must be the day);
 * when still ambiguous they default to **month-first** (MM/DD), the US/CA
 * convention - the preview echoes the parsed date so the user can catch a
 * misread before committing. Returns null when it can't be read.
 */
export function parseDob(raw: string | null | undefined): ParsedDob | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO year-first.
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validate(Number(m[2]), Number(m[3]), Number(m[1]));

  // A month name anywhere in the string.
  const lower = s.toLowerCase();
  const monthName = Object.keys(MONTH_NAMES).find((name) =>
    new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(lower),
  );
  if (monthName) {
    const nums = (s.match(/\d+/g) ?? []).map(Number);
    const day = nums.find((n) => n >= 1 && n <= 31);
    const yearNum = nums.find((n) => n > 31 || String(n).length === 4);
    if (day == null) return null;
    return validate(MONTH_NAMES[monthName], day, yearNum != null ? expandYear(yearNum) : null);
  }

  // Numeric day/month(/year).
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Ambiguous → month-first (MM/DD), the US/CA convention.
      month = a;
      day = b;
    }
    return validate(month, day, m[3] != null ? expandYear(Number(m[3])) : null);
  }

  return null;
}

type ColumnKey = 'name' | 'relationshipTag' | 'dob' | 'phone';
type ColumnMap = Record<ColumnKey, number>;

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  name: ['name', 'full name', 'fullname', 'person', 'contact'],
  relationshipTag: ['relationship', 'relationship tag', 'tag', 'relation', 'group'],
  dob: ['dob', 'd.o.b', 'd.o.b.', 'date of birth', 'birthday', 'birth date', 'birthdate', 'born'],
  phone: ['phone', 'phone number', 'mobile', 'cell', 'number', 'telephone', 'tel'],
};

/**
 * Resolve column indices from a header row, or null if it doesn't look like a
 * header (then callers fall back to the documented positional order:
 * name, relationship, date of birth, phone).
 */
function resolveColumns(header: string[]): ColumnMap | null {
  const find = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));
  const map: ColumnMap = {
    name: find(HEADER_ALIASES.name),
    relationshipTag: find(HEADER_ALIASES.relationshipTag),
    dob: find(HEADER_ALIASES.dob),
    phone: find(HEADER_ALIASES.phone),
  };
  if (map.name === -1 && map.dob === -1) return null;
  return map;
}

const POSITIONAL: ColumnMap = { name: 0, relationshipTag: 1, dob: 2, phone: 3 };

/**
 * Map parsed CSV rows to candidates (FR-7). Maps columns by header name when a
 * header row is present, else assumes the positional order. The DOB is parsed
 * eagerly so the preview can flag rows whose date couldn't be read.
 */
export function mapCsvToCandidates(rows: string[][]): RawCandidate[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const columns = resolveColumns(header);
  const map = columns ?? POSITIONAL;
  const dataRows = columns ? rows.slice(1) : rows;

  return dataRows.map((cells) => {
    const cell = (key: ColumnKey): string => {
      const i = map[key];
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const rawDob = cell('dob');
    return {
      name: cell('name'),
      relationshipTag: cell('relationshipTag') || null,
      phone: cell('phone') || null,
      photoUrl: null,
      dob: parseDob(rawDob),
      email: null,
      events: [],
      rawDob: rawDob || null,
    };
  });
}

/** Lowercased, whitespace-collapsed name for case-insensitive duplicate matching. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Exact-duplicate key: same name + same DOB (FR-11). Year-unknown matches year-unknown. */
export function dedupeKey(name: string, dob: ParsedDob): string {
  return `${normalizeName(name)}|${dob.month}-${dob.day}-${dob.year ?? 'x'}`;
}

/** An existing person to check candidates against, in dedupe-key terms. */
export interface ExistingPerson {
  id: string;
  fullName: string;
  dob: ParsedDob;
}

/** Counts by status for the preview response. */
export interface ImportSummary {
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
}

/** One annotated candidate the client renders + sends back with a resolution. */
export interface PreviewRow {
  id: string;
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  photoUrl: string | null;
  dob: ParsedDob | null;
  email: string | null;
  events: ParsedEventItem[];
  status: 'ready' | 'duplicate' | 'invalid';
  error: string | null;
  duplicate: { kind: 'existing' | 'batch'; personId: string | null; fullName: string } | null;
}

/**
 * Annotate every candidate as `ready`, `invalid` (no name / unreadable date), or
 * `duplicate` (same name + DOB as an existing person, or an earlier row in the same
 * batch - FR-11). Pure + side-effect-free so both the CSV/contacts preview and the
 * Google-import preview share identical duplicate logic. Writes nothing.
 */
export function annotateCandidates(
  candidates: RawCandidate[],
  existing: ExistingPerson[],
): { rows: PreviewRow[]; summary: ImportSummary } {
  const existingByKey = new Map<string, { id: string; fullName: string }>();
  for (const p of existing) {
    const key = dedupeKey(p.fullName, p.dob);
    if (!existingByKey.has(key)) existingByKey.set(key, { id: p.id, fullName: p.fullName });
  }

  const seenInBatch = new Map<string, string>();
  const rows: PreviewRow[] = candidates.map((c, i) => {
    const base = {
      id: `row-${i}`,
      name: c.name,
      relationshipTag: c.relationshipTag,
      phone: c.phone,
      photoUrl: c.photoUrl,
      dob: c.dob,
      email: c.email,
      events: c.events,
    };
    if (!c.name.trim()) {
      return { ...base, status: 'invalid' as const, error: 'Add a name for this row.', duplicate: null };
    }
    if (!c.dob) {
      const error = c.rawDob
        ? `Couldn't read the date "${c.rawDob}".`
        : 'Add a date of birth (month and day).';
      return { ...base, status: 'invalid' as const, error, duplicate: null };
    }
    const key = dedupeKey(c.name, c.dob);
    const existingMatch = existingByKey.get(key);
    if (existingMatch) {
      return {
        ...base,
        status: 'duplicate' as const,
        error: null,
        duplicate: { kind: 'existing' as const, personId: existingMatch.id, fullName: existingMatch.fullName },
      };
    }
    const batchMatch = seenInBatch.get(key);
    if (batchMatch) {
      return {
        ...base,
        status: 'duplicate' as const,
        error: null,
        duplicate: { kind: 'batch' as const, personId: null, fullName: batchMatch },
      };
    }
    seenInBatch.set(key, c.name.trim());
    return { ...base, status: 'ready' as const, error: null, duplicate: null };
  });

  return {
    rows,
    summary: {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'ready').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
    },
  };
}
