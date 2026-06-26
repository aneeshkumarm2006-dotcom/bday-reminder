import { describe, expect, it } from 'vitest';

import { parseCsv } from '../../src/lib/csv';
import { parseDob } from '../../src/lib/import';

describe('parseCsv: RFC-4180-ish parsing', () => {
  it('parses simple comma-separated rows', () => {
    expect(parseCsv('a,b,c\nd,e,f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseCsv('"Smith, John",30')).toEqual([['Smith, John', '30']]);
  });

  it('unescapes a doubled quote ("") inside a quoted field', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('drops a fully-empty line between records', () => {
    expect(parseCsv('a,b\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('preserves a trailing empty cell', () => {
    expect(parseCsv('a,b,')).toEqual([['a', 'b', '']]);
  });
});

describe('parseDob: ISO year-first', () => {
  it('parses ISO "1996-03-05" to {year:1996, month:3, day:5}', () => {
    expect(parseDob('1996-03-05')).toEqual({ year: 1996, month: 3, day: 5 });
  });
});

describe('parseDob: numeric forms', () => {
  it('parses ambiguous "05/03/1996" as MONTH-FIRST (month 5, day 3) — US/CA default', () => {
    expect(parseDob('05/03/1996')).toEqual({ month: 5, day: 3, year: 1996 });
  });

  it('disambiguates by the >12 rule when one part exceeds 12 (a clear DD/MM still parses)', () => {
    // 25 can only be the day, 3 the month — so this European-format date still
    // reads correctly even though the ambiguous default is month-first.
    expect(parseDob('25/03/1996')).toEqual({ month: 3, day: 25, year: 1996 });
  });
});

describe('parseDob: month-name forms', () => {
  it('parses "5 March 1996"', () => {
    expect(parseDob('5 March 1996')).toEqual({ month: 3, day: 5, year: 1996 });
  });

  it('parses "March 5, 1996"', () => {
    expect(parseDob('March 5, 1996')).toEqual({ month: 3, day: 5, year: 1996 });
  });
});

describe('parseDob: 2-digit year expansion', () => {
  it('expands a 2-digit year sensibly around the sliding pivot', () => {
    // CURRENT_YEAR is 2026 -> pivot 26; "96" > 26 so it expands to 1996.
    expect(parseDob('5 Mar 96')).toEqual({ month: 3, day: 5, year: 1996 });
  });
});

describe('parseDob: Feb-29 + day-of-month bounds (FR-15)', () => {
  it('accepts a Feb-29 birthday even in a non-leap year (the per-person rule decides observance later)', () => {
    expect(parseDob('29/02/1997')).toEqual({ month: 2, day: 29, year: 1997 });
  });

  it('rejects an impossible day for the month (Apr 31) as null', () => {
    expect(parseDob('31/04/1990')).toBeNull();
  });
});

describe('parseDob: invalid signal', () => {
  it('returns null for unparseable input', () => {
    expect(parseDob('not a date')).toBeNull();
  });

  it('returns null for empty / nullish input', () => {
    expect(parseDob('')).toBeNull();
    expect(parseDob('   ')).toBeNull();
    expect(parseDob(null)).toBeNull();
    expect(parseDob(undefined)).toBeNull();
  });
});
