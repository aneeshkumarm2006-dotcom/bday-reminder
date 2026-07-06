/**
 * UTC calendar-day math for ranges, previous-period comparison, and zero-filled
 * day series. Pure functions (import from client + server); all dates are
 * "YYYY-MM-DD" strings anchored to UTC so buckets line up with the Mongo
 * `$dateToString` aggregation and the provider APIs.
 */
import type { SeriesPoint, SourceKey } from "./types";

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "28d", label: "Last 28 days" },
  { key: "90d", label: "Last 90 days" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["key"];

export const DEFAULT_PRESET: RangePreset = "7d";

export interface DateRange {
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function isValidDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** Inclusive day count between two days (same day → 1). */
export function dayCount(range: DateRange): number {
  return Math.round((parseDay(range.to).getTime() - parseDay(range.from).getTime()) / DAY_MS) + 1;
}

/** Resolve a preset to a concrete range, anchored to `now` (default: today). */
export function resolveRange(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = isoDay(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "28d":
      return { from: addDays(today, -27), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    default:
      return { from: addDays(today, -6), to: today };
  }
}

/** The immediately-preceding equal-length range (for %-delta comparison). */
export function previousRange(range: DateRange): DateRange {
  const len = dayCount(range);
  return { from: addDays(range.from, -len), to: addDays(range.to, -len) };
}

/** Every day in the inclusive range, ascending. */
export function enumerateDays(range: DateRange): string[] {
  const out: string[] = [];
  let cursor = range.from;
  // Guard against a reversed / absurd range so we never loop unbounded.
  const max = Math.max(0, Math.min(dayCount(range), 800));
  for (let i = 0; i < max; i += 1) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Parse + sanitize a client-supplied range, falling back to the default preset.
 * Ensures from <= to and caps the span so a hostile query can't fan out forever.
 */
export function safeRange(fromRaw?: string | null, toRaw?: string | null): DateRange {
  if (!fromRaw || !toRaw || !isValidDay(fromRaw) || !isValidDay(toRaw)) {
    return resolveRange(DEFAULT_PRESET);
  }
  let from = fromRaw;
  let to = toRaw;
  if (parseDay(from).getTime() > parseDay(to).getTime()) {
    [from, to] = [to, from];
  }
  if (dayCount({ from, to }) > 800) {
    from = addDays(to, -799);
  }
  return { from, to };
}

/**
 * Turn a sparse map of day → value into a dense, zero-filled `SeriesPoint[]`
 * across the whole range (charts and totals expect every day present).
 */
export function zeroFillSeries(
  source: SourceKey,
  metric: string,
  range: DateRange,
  byDay: Map<string, number>,
): SeriesPoint[] {
  return enumerateDays(range).map((date) => ({
    source,
    metric,
    date,
    value: byDay.get(date) ?? 0,
  }));
}
