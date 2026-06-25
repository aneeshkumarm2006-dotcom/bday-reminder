/**
 * Date logic used app-wide (TODO Stage 2; FR-13/14/15, DESIGN.md §8.3). Mirrors
 * the rules the backend will own: age calc, days-until, next occurrence, the
 * per-person Feb-29 rule, and "today" evaluated in the viewer's local timezone.
 *
 * The device's local time IS the user's timezone, so plain local `Date`s are
 * correct for the app. The backend re-derives the same rules server-side for
 * scheduling (Stage 4).
 */

/** Per-person rule for observing a Feb-29 birthday in non-leap years (FR-15). */
export type Feb29Rule = 'feb28' | 'feb29only' | 'mar1';

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

/** Local midnight for a date (strips the time component). */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Today at local midnight - "today" in the viewer's timezone (FR-53). */
export function todayLocal(): Date {
  return startOfDay(new Date());
}

/**
 * The observed date in a specific year, applying the Feb-29 rule. Returns null
 * when the date doesn't occur that year (a `feb29only` birthday in a non-leap
 * year), so callers can skip ahead to the next leap year.
 */
function occurrenceInYear(
  year: number,
  month: number,
  day: number,
  rule: Feb29Rule,
): Date | null {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    if (rule === 'feb29only') return null;
    if (rule === 'mar1') return new Date(year, 2, 1); // Mar 1
    return new Date(year, 1, 28); // feb28 (default)
  }
  return new Date(year, month - 1, day);
}

/**
 * The next occurrence of a month/day on or after `from` (default: today),
 * honoring the Feb-29 rule. Searches forward enough years to clear the leap gap.
 */
export function nextOccurrence(
  month: number,
  day: number,
  rule: Feb29Rule = 'feb28',
  from: Date = todayLocal(),
): Date {
  const base = startOfDay(from);
  for (let i = 0; i <= 8; i++) {
    const occ = occurrenceInYear(base.getFullYear() + i, month, day, rule);
    if (occ && occ.getTime() >= base.getTime()) return occ;
  }
  // Unreachable for valid input, but return a sane fallback.
  return occurrenceInYear(base.getFullYear() + 8, month, day, rule) ?? base;
}

/** Whole days from `from` (default today) until `target`. Today = 0. */
export function daysUntil(target: Date, from: Date = todayLocal()): number {
  const ms = startOfDay(target).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Whether a month/day falls on today in the local timezone (FR-15/53). */
export function isToday(month: number, day: number, rule: Feb29Rule = 'feb28'): boolean {
  return daysUntil(nextOccurrence(month, day, rule)) === 0;
}

/**
 * The age the person is turning on a given occurrence. Returns null when the
 * birth year is unknown - callers must omit age entirely, never guess (FR-14).
 */
export function ageTurning(occurrence: Date, birthYear?: number | null): number | null {
  if (!birthYear) return null;
  return occurrence.getFullYear() - birthYear;
}

/** Ring state for an occurrence relative to today (DESIGN.md §7.3). */
export function ringStateForOccurrence(occurrence: Date): 'upcoming' | 'today' | 'past' {
  const d = daysUntil(occurrence);
  if (d === 0) return 'today';
  return d < 0 ? 'past' : 'upcoming';
}

/** Countdown copy for a card (DESIGN.md §8.1): "Today" / "in 1 day" / "in N days". */
export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days < 0) return days === -1 ? '1 day ago' : `${Math.abs(days)} days ago`;
  if (days === 1) return 'in 1 day';
  return `in ${days} days`;
}

/** Proximity group for the Upcoming feed (DESIGN.md §8.2). */
export function proximityGroup(days: number): 'This week' | 'This month' | 'Later' {
  if (days <= 7) return 'This week';
  if (days <= 31) return 'This month';
  return 'Later';
}

/**
 * Relative "time ago" label for a past timestamp (DESIGN.md §8.6 gift notes:
 * each entry shows text + relative date). Coarse buckets - notes don't need
 * second precision.
 */
export function relativeDate(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
