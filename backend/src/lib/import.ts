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

/** A parsed date of birth — month/day required, year optional (FR-14). */
export interface ParsedDob {
  month: number;
  day: number;
  year: number | null;
}

/** A normalized import candidate, before validation/duplicate annotation. */
export interface RawCandidate {
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  photoUrl: string | null;
  dob: ParsedDob | null;
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
 * normalized parts or null when it can't be a real date — callers turn null into
 * an `invalid` import row rather than rejecting the whole request.
 */
export function validateDob(parts: { month: number; day: number; year?: number | null }): ParsedDob | null {
  return validate(parts.month, parts.day, parts.year ?? null);
}

/**
 * Parse a free-form date of birth into month/day(/year). Handles:
 *   • ISO `1990-03-05` (also `/` or `.` separators)
 *   • month names `5 March 1990`, `March 5, 1990`, `Mar 5`, `5 Mar 90`
 *   • numeric `05/03/1990`, `5-3`, `03.05.90`
 * Numeric forms disambiguate by the >12 rule; when still ambiguous they default
 * to **day-first** (DD/MM) — the preview echoes the parsed date so the user can
 * catch a misread before committing. Returns null when it can't be read.
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
      // Ambiguous → day-first (documented default).
      day = a;
      month = b;
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
