import type { ImportCandidate } from './api';

/**
 * Parse a pasted/uploaded CSV into import candidates (the non-contacts import
 * path; FR-6). Header-driven and forgiving, identical to the website's parser:
 * a `name` column plus either `month`+`day` (+ optional `year`) or a single
 * `birthday`/`date`/`dob` column (MM/DD/YYYY, MM/DD, or YYYY-MM-DD). Optional
 * `relationship`/`tag` and `phone`. Simple comma split - quoted commas aren't
 * supported (documented in the UI). Rows without a name are dropped; rows with
 * an unreadable date keep `dob: null` so the server can flag them as invalid.
 * Cell values are clamped to the server's per-field caps so one overlong cell
 * can't 400 the whole preview batch.
 */

// Mirrors POST /import/preview's zod caps (backend/src/routes/import.ts):
// candidates max(2000); name max(200), relationshipTag/phone max(40).
export const MAX_IMPORT_ROWS = 2000;
const MAX_NAME = 200;
const MAX_TAG = 40;
const MAX_PHONE = 40;

export function parseCsv(text: string): ImportCandidate[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const iName = col('name', 'full name', 'fullname');
  const iMonth = col('month');
  const iDay = col('day');
  const iYear = col('year');
  const iDate = col('birthday', 'date', 'dob');
  const iTag = col('relationship', 'tag', 'relationshiptag');
  const iPhone = col('phone', 'mobile', 'number');

  const candidates: ImportCandidate[] = [];
  for (const line of lines.slice(1)) {
    // Rows may be shorter than the header (trailing cells omitted), so every
    // indexed read coalesces undefined to ''.
    const cells = line.split(',').map((c) => c.trim());
    const cell = (i: number) => cells[i] ?? '';
    const name = iName >= 0 ? cell(iName) : '';
    if (!name) continue;

    let dob: ImportCandidate['dob'] = null;
    if (iMonth >= 0 && iDay >= 0) {
      const month = toInt(cell(iMonth));
      const day = toInt(cell(iDay));
      const year = iYear >= 0 && cell(iYear) ? toInt(cell(iYear)) : null;
      if (month && day) dob = { month, day, year };
    } else if (iDate >= 0 && cell(iDate)) {
      dob = parseDate(cell(iDate));
    }

    candidates.push({
      name: name.slice(0, MAX_NAME),
      relationshipTag: iTag >= 0 ? cell(iTag).slice(0, MAX_TAG) || null : null,
      phone: iPhone >= 0 ? cell(iPhone).slice(0, MAX_PHONE) || null : null,
      dob,
    });
  }
  return candidates;
}

// The server's dob schema wants integers - a fractional cell (a spreadsheet
// float export like "3.5") must not 400 the whole preview batch, so it reads
// as "no value": a fractional month/day flags the row invalid like any other
// bad date; a fractional year just drops the year and the row still imports.
function toInt(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseDate(value: string): ImportCandidate['dob'] {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return { month: Number(iso[2]), day: Number(iso[3]), year: Number(iso[1]) };
  const us = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (us) {
    return {
      month: Number(us[1]),
      day: Number(us[2]),
      // Two-digit years are read as 19xx (birthdays skew historical).
      year: us[3] ? Number(us[3].length === 2 ? `19${us[3]}` : us[3]) : null,
    };
  }
  return null;
}
