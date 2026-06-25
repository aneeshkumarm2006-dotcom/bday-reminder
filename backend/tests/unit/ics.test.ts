import { describe, expect, it } from 'vitest';

import { buildCalendar, type IcsEvent } from '../../src/lib/ics';

/** UTC-midnight calendar date helper. */
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
/** UTC date-time helper. */
const utcDt = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, s));

/** A minimal valid event. */
const baseEvent = (over: Partial<IcsEvent> = {}): IcsEvent => ({
  uid: 'person-abc123@circlethedate',
  summary: "Alice's birthday",
  start: utc(2026, 6, 25),
  end: utc(2026, 6, 26),
  dtstamp: utcDt(2026, 6, 22, 9, 30, 0),
  ...over,
});

describe('ics: buildCalendar - calendar envelope', () => {
  it('wraps events in BEGIN/END:VCALENDAR with VERSION 2.0', () => {
    const ics = buildCalendar({ name: 'My Birthdays', events: [baseEvent()] });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
  });

  it('begins with BEGIN:VCALENDAR and ends with END:VCALENDAR', () => {
    const ics = buildCalendar({ name: 'My Birthdays', events: [baseEvent()] });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });
});

describe('ics: buildCalendar - VEVENT shape', () => {
  it('emits an all-day DTSTART;VALUE=DATE, a yearly RRULE, and the stable UID', () => {
    const ics = buildCalendar({ name: 'Cal', events: [baseEvent()] });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260625');
    expect(ics).toContain('DTEND;VALUE=DATE:20260626');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
    expect(ics).toContain('UID:person-abc123@circlethedate');
  });

  it('keeps the UID stable across rebuilds so refreshes update in place (FR-39)', () => {
    const first = buildCalendar({ name: 'Cal', events: [baseEvent()] });
    const second = buildCalendar({ name: 'Cal', events: [baseEvent()] });
    expect(first).toContain('UID:person-abc123@circlethedate');
    expect(second).toContain('UID:person-abc123@circlethedate');
  });
});

describe('ics: buildCalendar - TEXT escaping (§3.3.11)', () => {
  it('escapes comma, semicolon, backslash and newline in SUMMARY', () => {
    const ics = buildCalendar({
      name: 'Cal',
      events: [baseEvent({ summary: 'a,b;c\\d\ne' })],
    });
    expect(ics).toContain('SUMMARY:a\\,b\\;c\\\\d\\ne');
  });

  it('escapes the same characters in DESCRIPTION', () => {
    const ics = buildCalendar({
      name: 'Cal',
      events: [baseEvent({ summary: 'Birthday', description: 'gift: socks; cake, & cards' })],
    });
    expect(ics).toContain('DESCRIPTION:gift: socks\\; cake\\, & cards');
  });

  it('normalizes CRLF/CR newlines to a single escaped \\n', () => {
    const ics = buildCalendar({
      name: 'Cal',
      events: [baseEvent({ summary: 'line1\r\nline2\rline3' })],
    });
    expect(ics).toContain('SUMMARY:line1\\nline2\\nline3');
  });
});

describe('ics: buildCalendar - line folding (§3.5)', () => {
  it('folds a long content line with CRLF + a leading space, each piece <=75 octets', () => {
    const longSummary = 'X'.repeat(200);
    const ics = buildCalendar({ name: 'Cal', events: [baseEvent({ summary: longSummary })] });

    // The continuation marker is CRLF followed by exactly one space.
    expect(ics).toContain('\r\n ');

    // No physical line (split on CRLF) exceeds 75 octets.
    for (const physicalLine of ics.split('\r\n')) {
      expect(Buffer.byteLength(physicalLine, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it('continuation lines (those after a fold) start with a single leading space', () => {
    const longSummary = 'Y'.repeat(200);
    const ics = buildCalendar({ name: 'Cal', events: [baseEvent({ summary: longSummary })] });
    const physical = ics.split('\r\n');
    // Find the SUMMARY start and verify the next physical line is a continuation.
    const idx = physical.findIndex((l) => l.startsWith('SUMMARY:'));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(physical[idx + 1].startsWith(' ')).toBe(true);
  });
});

describe('ics: buildCalendar - line endings', () => {
  it('uses CRLF between every content line and a trailing CRLF', () => {
    const ics = buildCalendar({ name: 'Cal', events: [baseEvent()] });
    // No bare LF that is not preceded by CR.
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(ics.endsWith('\r\n')).toBe(true);
  });
});
