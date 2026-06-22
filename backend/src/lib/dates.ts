/**
 * Server-side date logic (TODO Stage 3; FR-13/14/15, DESIGN.md §8.2/§8.3).
 * Mirrors the rules the app owns in `app/src/lib/dates.ts` so the feed the
 * client computes locally matches what the backend serves: next occurrence,
 * age-turning, the per-person Feb-29 rule, days-until, and proximity grouping.
 *
 * Dates are reasoned about as UTC calendar days. "Today" is resolved in the
 * recipient's own timezone (FR-53) and pinned to a UTC midnight; every
 * occurrence is likewise a UTC midnight, so day-differences are exact and
 * unaffected by DST. The timezone-aware *time-of-day* scheduling lands in
 * Stage 4 (luxon); Stage 3 only needs calendar-day correctness.
 */

import type { DateParts, Feb29Rule } from '../models/common';

const MS_PER_DAY = 86_400_000;

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Sentence-case month abbreviation for a 1-based month (DESIGN.md §4.2). */
export function monthAbbr(month: number): string {
  return MONTH_ABBR[month - 1] ?? '';
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Max valid day for a 1-based month, used by input validation. February allows
 * 29 unconditionally: the year is optional, and a real Feb-29 birthday is valid
 * (the per-person Feb-29 rule decides how it's observed in non-leap years).
 */
export function maxDayInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/**
 * Today at UTC-midnight, as observed in `timeZone`. Uses Intl to read the
 * wall-clock calendar date in that zone, then pins it to a UTC midnight so the
 * rest of the math is DST-proof. Falls back to the host's date on a bad zone.
 */
export function todayInTimeZone(timeZone: string | undefined): Date {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const lookup = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return new Date(Date.UTC(lookup('year'), lookup('month') - 1, lookup('day')));
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

/**
 * The observed UTC-midnight date in a specific year, applying the Feb-29 rule.
 * Returns null when the date doesn't occur that year (a `feb29only` birthday in
 * a non-leap year), so callers skip ahead to the next leap year.
 */
function occurrenceInYear(
  year: number,
  month: number,
  day: number,
  rule: Feb29Rule,
): Date | null {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    if (rule === 'feb29only') return null;
    if (rule === 'mar1') return new Date(Date.UTC(year, 2, 1)); // Mar 1
    return new Date(Date.UTC(year, 1, 28)); // feb28 (default)
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The next occurrence of a month/day on or after `from`, honoring the Feb-29
 * rule. Searches forward enough years to clear the leap gap (FR-12/15).
 */
export function nextOccurrence(
  month: number,
  day: number,
  rule: Feb29Rule = 'feb28',
  from: Date,
): Date {
  const fromYear = from.getUTCFullYear();
  for (let i = 0; i <= 8; i++) {
    const occ = occurrenceInYear(fromYear + i, month, day, rule);
    if (occ && occ.getTime() >= from.getTime()) return occ;
  }
  // Unreachable for valid input; return a sane fallback.
  return occurrenceInYear(fromYear + 8, month, day, rule) ?? from;
}

/** Whole days from `from` until `target` (both UTC midnights). Today = 0. */
export function daysUntil(target: Date, from: Date): number {
  return Math.round((target.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * The age the person is turning on a given occurrence. Returns null when the
 * birth year is unknown — callers MUST omit age entirely, never guess (FR-14).
 */
export function ageTurning(occurrence: Date, birthYear?: number | null): number | null {
  if (!birthYear) return null;
  return occurrence.getUTCFullYear() - birthYear;
}

export type ProximityGroup = 'This week' | 'This month' | 'Later';

/** Proximity group for the Upcoming feed (DESIGN.md §8.2). */
export function proximityGroup(days: number): ProximityGroup {
  if (days <= 7) return 'This week';
  if (days <= 31) return 'This month';
  return 'Later';
}

/**
 * Resolve an event's next occurrence relative to a recipient's "today",
 * returning the pieces the feed and reminder copy need. `date` carries the
 * stored month/day(/year); `birthYear` (when present) drives age-turning.
 */
export function resolveOccurrence(date: DateParts, rule: Feb29Rule, today: Date) {
  const occurrence = nextOccurrence(date.month, date.day, rule, today);
  const days = daysUntil(occurrence, today);
  return {
    occurrence,
    daysRemaining: days,
    ageTurning: ageTurning(occurrence, date.year),
    group: proximityGroup(days),
  };
}
