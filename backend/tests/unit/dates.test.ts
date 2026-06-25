import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ageTurning,
  daysUntil,
  isLeapYear,
  maxDayInMonth,
  monthAbbr,
  nextOccurrence,
  proximityGroup,
  resolveOccurrence,
  todayInTimeZone,
} from '../../src/lib/dates';

/** UTC midnight helper for terse assertions. */
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('dates: leap years + calendar helpers', () => {
  it('isLeapYear follows the Gregorian rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
  });

  it('maxDayInMonth allows Feb 29 unconditionally (year is optional)', () => {
    expect(maxDayInMonth(2)).toBe(29);
    expect(maxDayInMonth(4)).toBe(30);
    expect(maxDayInMonth(12)).toBe(31);
  });

  it('monthAbbr is sentence-case and 1-based', () => {
    expect(monthAbbr(1)).toBe('Jan');
    expect(monthAbbr(12)).toBe('Dec');
    expect(monthAbbr(0)).toBe('');
  });
});

describe('dates: nextOccurrence', () => {
  it('returns today when the date is today (on-or-after)', () => {
    const today = utc(2026, 6, 22);
    expect(nextOccurrence(6, 22, 'feb28', today)).toEqual(today);
  });

  it('rolls to next year once the date has passed', () => {
    const today = utc(2026, 6, 22);
    expect(nextOccurrence(3, 5, 'feb28', today)).toEqual(utc(2027, 3, 5));
  });

  it('finds a later date in the same year', () => {
    const today = utc(2026, 6, 22);
    expect(nextOccurrence(8, 15, 'feb28', today)).toEqual(utc(2026, 8, 15));
  });

  describe('Feb-29 per-person rule (FR-15)', () => {
    // 2026 is non-leap, 2028 is leap.
    it('feb28: observes Feb 28 in non-leap years', () => {
      expect(nextOccurrence(2, 29, 'feb28', utc(2026, 1, 1))).toEqual(utc(2026, 2, 28));
      expect(nextOccurrence(2, 29, 'feb28', utc(2028, 1, 1))).toEqual(utc(2028, 2, 29));
    });

    it('mar1: observes Mar 1 in non-leap years', () => {
      expect(nextOccurrence(2, 29, 'mar1', utc(2026, 1, 1))).toEqual(utc(2026, 3, 1));
      expect(nextOccurrence(2, 29, 'mar1', utc(2028, 1, 1))).toEqual(utc(2028, 2, 29));
    });

    it('feb29only: skips non-leap years entirely to the next Feb 29', () => {
      expect(nextOccurrence(2, 29, 'feb29only', utc(2026, 1, 1))).toEqual(utc(2028, 2, 29));
      expect(nextOccurrence(2, 29, 'feb29only', utc(2028, 2, 29))).toEqual(utc(2028, 2, 29));
    });
  });
});

describe('dates: daysUntil + proximity', () => {
  it('daysUntil counts whole days, today = 0', () => {
    const today = utc(2026, 6, 22);
    expect(daysUntil(today, today)).toBe(0);
    expect(daysUntil(utc(2026, 6, 23), today)).toBe(1);
    expect(daysUntil(utc(2026, 6, 29), today)).toBe(7);
    expect(daysUntil(utc(2026, 6, 21), today)).toBe(-1);
  });

  it('proximityGroup buckets by week / month / later', () => {
    expect(proximityGroup(0)).toBe('This week');
    expect(proximityGroup(7)).toBe('This week');
    expect(proximityGroup(8)).toBe('This month');
    expect(proximityGroup(31)).toBe('This month');
    expect(proximityGroup(32)).toBe('Later');
  });

  it('proximityGroup buckets a past occurrence (negative days) into This week', () => {
    // Documents the current intent: a just-passed event still groups nearest.
    expect(proximityGroup(-1)).toBe('This week');
    expect(proximityGroup(-30)).toBe('This week');
  });
});

describe('dates: ageTurning (FR-13/14)', () => {
  it('computes the age being turned when a birth year is known', () => {
    expect(ageTurning(utc(2026, 6, 22), 1996)).toBe(30);
  });

  it('returns null when the birth year is unknown - never guesses', () => {
    expect(ageTurning(utc(2026, 6, 22), undefined)).toBeNull();
    expect(ageTurning(utc(2026, 6, 22), null)).toBeNull();
    expect(ageTurning(utc(2026, 6, 22), 0)).toBeNull();
  });
});

describe('dates: resolveOccurrence (feed shape)', () => {
  it('bundles occurrence, days remaining, age and group', () => {
    const today = utc(2026, 6, 22);
    const r = resolveOccurrence({ month: 6, day: 25, year: 1996 }, 'feb28', today);
    expect(r.occurrence).toEqual(utc(2026, 6, 25));
    expect(r.daysRemaining).toBe(3);
    expect(r.ageTurning).toBe(30);
    expect(r.group).toBe('This week');
  });

  it('omits age (null) when no year is stored', () => {
    const today = utc(2026, 6, 22);
    const r = resolveOccurrence({ month: 12, day: 1 }, 'feb28', today);
    expect(r.ageTurning).toBeNull();
    expect(r.group).toBe('Later');
  });
});

describe('dates: todayInTimeZone (FR-53)', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a UTC-midnight Date', () => {
    const d = todayInTimeZone('Asia/Kolkata');
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it('resolves the calendar day IN the given zone - not just the host UTC day', () => {
    // 2026-06-21T20:00:00Z: still the 21st in UTC, but already the 22nd in
    // Asia/Kolkata (UTC+5:30). The zone must actually shift the day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T20:00:00Z'));
    const kolkata = todayInTimeZone('Asia/Kolkata');
    const utc = todayInTimeZone('UTC');
    expect(utc).toEqual(new Date(Date.UTC(2026, 5, 21)));
    expect(kolkata).toEqual(new Date(Date.UTC(2026, 5, 22)));
    expect(kolkata.getUTCDate()).not.toBe(utc.getUTCDate());
  });

  it('falls back to the host UTC date on a bad zone instead of throwing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T20:00:00Z'));
    expect(() => todayInTimeZone('Not/AZone')).not.toThrow();
    expect(todayInTimeZone('Not/AZone')).toEqual(new Date(Date.UTC(2026, 5, 21)));
  });
});
