import {
  ageTurning,
  countdownLabel,
  daysUntil,
  isLeapYear,
  isToday,
  monthAbbr,
  nextOccurrence,
  proximityGroup,
  relativeDate,
  ringStateForOccurrence,
} from '@/lib/dates';

/**
 * App-side date logic (TODO Stage 13; FR-13/14/15). Mirrors the backend's rules
 * so the feed the client computes locally matches the server. Pure functions —
 * no rendering. `local` builds local-midnight dates (the app reasons in local
 * time: the device clock IS the user's timezone).
 */
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('app dates: calendar helpers', () => {
  it('isLeapYear follows the Gregorian rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('monthAbbr is sentence-case, 1-based', () => {
    expect(monthAbbr(1)).toBe('Jan');
    expect(monthAbbr(6)).toBe('Jun');
    expect(monthAbbr(12)).toBe('Dec');
  });
});

describe('app dates: nextOccurrence + Feb-29 rule (FR-15)', () => {
  it('returns today / rolls to next year correctly', () => {
    const today = local(2026, 6, 22);
    expect(nextOccurrence(6, 22, 'feb28', today)).toEqual(local(2026, 6, 22));
    expect(nextOccurrence(3, 5, 'feb28', today)).toEqual(local(2027, 3, 5));
    expect(nextOccurrence(8, 15, 'feb28', today)).toEqual(local(2026, 8, 15));
  });

  it('feb28 observes Feb 28 in common years, Feb 29 in leap years', () => {
    expect(nextOccurrence(2, 29, 'feb28', local(2026, 1, 1))).toEqual(local(2026, 2, 28));
    expect(nextOccurrence(2, 29, 'feb28', local(2028, 1, 1))).toEqual(local(2028, 2, 29));
  });

  it('mar1 observes Mar 1 in common years', () => {
    expect(nextOccurrence(2, 29, 'mar1', local(2026, 1, 1))).toEqual(local(2026, 3, 1));
  });

  it('feb29only skips to the next leap year', () => {
    expect(nextOccurrence(2, 29, 'feb29only', local(2026, 1, 1))).toEqual(local(2028, 2, 29));
  });
});

describe('app dates: daysUntil / proximity / ring state', () => {
  it('daysUntil counts whole days, today = 0', () => {
    const today = local(2026, 6, 22);
    expect(daysUntil(today, today)).toBe(0);
    expect(daysUntil(local(2026, 6, 29), today)).toBe(7);
    expect(daysUntil(local(2026, 6, 21), today)).toBe(-1);
  });

  it('proximityGroup buckets week / month / later', () => {
    expect(proximityGroup(7)).toBe('This week');
    expect(proximityGroup(8)).toBe('This month');
    expect(proximityGroup(32)).toBe('Later');
  });

  it('ringStateForOccurrence: today / upcoming / past', () => {
    // Pin the clock so the ±day arithmetic can't straddle a DST/midnight boundary.
    jest.useFakeTimers().setSystemTime(local(2026, 6, 22));
    try {
      expect(ringStateForOccurrence(local(2026, 6, 22))).toBe('today');
      expect(ringStateForOccurrence(local(2026, 6, 27))).toBe('upcoming');
      expect(ringStateForOccurrence(local(2026, 6, 17))).toBe('past');
    } finally {
      jest.useRealTimers();
    }
  });

  it('isToday is true for today\'s month/day', () => {
    jest.useFakeTimers().setSystemTime(local(2026, 6, 22));
    try {
      expect(isToday(6, 22)).toBe(true);
      expect(isToday(6, 23)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('app dates: countdownLabel copy (DESIGN §8.1)', () => {
  it('renders Today / in 1 day / in N days / N days ago', () => {
    expect(countdownLabel(0)).toBe('Today');
    expect(countdownLabel(1)).toBe('in 1 day');
    expect(countdownLabel(3)).toBe('in 3 days');
    expect(countdownLabel(-1)).toBe('1 day ago');
    expect(countdownLabel(-3)).toBe('3 days ago');
  });
});

describe('app dates: ageTurning (FR-13/14)', () => {
  it('computes age with a year, omits (null) without one', () => {
    expect(ageTurning(local(2026, 6, 22), 1996)).toBe(30);
    expect(ageTurning(local(2026, 6, 22), undefined)).toBeNull();
    expect(ageTurning(local(2026, 6, 22), null)).toBeNull();
  });
});

describe('app dates: relativeDate (gift notes §8.6)', () => {
  it('buckets recent timestamps coarsely', () => {
    const now = new Date('2026-06-22T12:00:00Z');
    expect(relativeDate(new Date(now.getTime() - 10_000).toISOString(), now)).toBe('just now');
    expect(relativeDate(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('5 minutes ago');
    expect(relativeDate(new Date(now.getTime() - 2 * 3_600_000).toISOString(), now)).toBe('2 hours ago');
    expect(relativeDate(new Date(now.getTime() - 3 * 86_400_000).toISOString(), now)).toBe('3 days ago');
  });
});
