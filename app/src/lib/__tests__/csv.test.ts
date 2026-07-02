import { parseCsv } from '@/lib/csv';

/**
 * CSV import parser (FR-6). Mirrors the website's `lib/csv.ts` semantics
 * exactly - header-driven columns, single-date-column fallback, optional year,
 * and forgiving row handling (no name = dropped, bad date = dob null so the
 * server can flag it). Pure string -> ImportCandidate[]; no rendering.
 */

describe('csv: header variants', () => {
  it('reads the canonical name,month,day,year header', () => {
    expect(parseCsv('name,month,day,year\nAda Lovelace,12,10,1815')).toEqual([
      { name: 'Ada Lovelace', relationshipTag: null, phone: null, dob: { month: 12, day: 10, year: 1815 } },
    ]);
  });

  it('accepts "full name" / "fullname" aliases and ignores header case', () => {
    expect(parseCsv('Full Name,Month,Day\nGrace Hopper,12,9')[0].name).toBe('Grace Hopper');
    expect(parseCsv('FULLNAME,month,day\nAlan Turing,6,23')[0].name).toBe('Alan Turing');
  });

  it('ignores column order and unknown columns', () => {
    const [row] = parseCsv('nickname,day,name,month\nAce,10,Ada,12');
    expect(row).toEqual({ name: 'Ada', relationshipTag: null, phone: null, dob: { month: 12, day: 10, year: null } });
  });
});

describe('csv: single birthday column', () => {
  it('parses MM/DD/YYYY, MM/DD, and YYYY-MM-DD', () => {
    expect(parseCsv('name,birthday\nAda,12/10/1815')[0].dob).toEqual({ month: 12, day: 10, year: 1815 });
    expect(parseCsv('name,birthday\nAda,12/10')[0].dob).toEqual({ month: 12, day: 10, year: null });
    expect(parseCsv('name,birthday\nAda,1815-12-10')[0].dob).toEqual({ month: 12, day: 10, year: 1815 });
  });

  it('accepts "date"/"dob" aliases and 2-digit years as 19xx', () => {
    expect(parseCsv('name,date\nAda,12/10/95')[0].dob).toEqual({ month: 12, day: 10, year: 1995 });
    expect(parseCsv('name,dob\nAda,3/5/1990')[0].dob).toEqual({ month: 3, day: 5, year: 1990 });
  });

  it('keeps the row with dob null when the date is unreadable', () => {
    expect(parseCsv('name,birthday\nAda,tenth of december')).toEqual([
      { name: 'Ada', relationshipTag: null, phone: null, dob: null },
    ]);
  });
});

describe('csv: optional year, relationship, phone', () => {
  it('leaves year null when the column is missing or empty', () => {
    expect(parseCsv('name,month,day\nAda,12,10')[0].dob).toEqual({ month: 12, day: 10, year: null });
    expect(parseCsv('name,month,day,year\nAda,12,10,')[0].dob).toEqual({ month: 12, day: 10, year: null });
  });

  it('reads relationship/tag and phone/mobile/number columns, empty as null', () => {
    expect(parseCsv('name,month,day,relationship,phone\nAda,12,10,Friend,+1 555 0100')[0]).toMatchObject({
      relationshipTag: 'Friend',
      phone: '+1 555 0100',
    });
    expect(parseCsv('name,month,day,tag\nAda,12,10,Family')[0].relationshipTag).toBe('Family');
    expect(parseCsv('name,month,day,mobile\nAda,12,10,555-0100')[0].phone).toBe('555-0100');
    expect(parseCsv('name,month,day,relationship,phone\nAda,12,10,,')[0]).toMatchObject({
      relationshipTag: null,
      phone: null,
    });
  });
});

describe('csv: malformed input', () => {
  it('returns [] for empty text, a lone header, or blank lines only', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('name,month,day')).toEqual([]);
    expect(parseCsv('\n  \n')).toEqual([]);
  });

  it('skips rows without a name and keeps the rest', () => {
    const rows = parseCsv('name,month,day\n,12,10\nAda,12,10\n   ,1,2');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Ada');
  });

  it('month/day columns need numeric month AND day, else dob is null', () => {
    expect(parseCsv('name,month,day\nAda,twelve,10')[0].dob).toBeNull();
    expect(parseCsv('name,month,day\nAda,12,')[0].dob).toBeNull();
  });

  it('tolerates CRLF line endings and surrounding whitespace', () => {
    const rows = parseCsv('name,month,day\r\n Ada , 12 , 10 \r\n');
    expect(rows).toEqual([
      { name: 'Ada', relationshipTag: null, phone: null, dob: { month: 12, day: 10, year: null } },
    ]);
  });

  it('handles ragged rows shorter than the header (missing cells read as empty)', () => {
    const rows = parseCsv('name,month,day,year,relationship,phone\nAda,12,10\nBob,1,2,1991,Friend');
    expect(rows).toEqual([
      { name: 'Ada', relationshipTag: null, phone: null, dob: { month: 12, day: 10, year: null } },
      { name: 'Bob', relationshipTag: 'Friend', phone: null, dob: { month: 1, day: 2, year: 1991 } },
    ]);
  });

  it('treats fractional month/day/year as no value instead of 400ing the batch', () => {
    expect(parseCsv('name,month,day\nAda,3.5,10')[0].dob).toBeNull();
    expect(parseCsv('name,month,day,year\nAda,12,10,1991.5')[0].dob).toEqual({
      month: 12,
      day: 10,
      year: null,
    });
  });

  it('clamps overlong cells to the server caps instead of 400ing the batch', () => {
    const rows = parseCsv(
      `name,relationship,phone,month,day\n${'A'.repeat(250)},${'x'.repeat(60)},${'1'.repeat(60)},12,10`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toHaveLength(200);
    expect(rows[0].relationshipTag).toHaveLength(40);
    expect(rows[0].phone).toHaveLength(40);
    expect(rows[0].dob).toEqual({ month: 12, day: 10, year: null });
  });
});
