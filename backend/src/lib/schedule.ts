/**
 * Timezone-aware scheduling (TODO Stage 4; FR-22/51/52/53). Turns a calendar
 * occurrence + a lead time into the absolute UTC instant a reminder should fire,
 * anchored to the recipient's own wall-clock time-of-day in their timezone.
 *
 * The rest of the date math (next occurrence, age, Feb-29) stays in `dates.ts`
 * and reasons in UTC calendar days; this module is the one place that needs a
 * real timezone library (luxon) because "9:00am in Asia/Kolkata" is a different
 * absolute instant than "9:00am in America/New_York" and DST shifts it twice a
 * year. Bad/unknown zones fall back to UTC so a single corrupt profile can't
 * crash the dispatcher.
 */

import { DateTime } from 'luxon';

const MS_PER_DAY = 86_400_000;

/** Parse a "HH:mm" reminder time, defaulting to 09:00 on anything invalid. */
export function parseTimeOfDay(time: string | undefined): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Build a zoned DateTime, falling back to UTC when the zone is unknown. */
function zoned(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string | undefined,
): DateTime {
  const dt = DateTime.fromObject(parts, { zone: timeZone || 'UTC' });
  return dt.isValid ? dt : DateTime.fromObject(parts, { zone: 'UTC' });
}

/**
 * The absolute instant a reminder fires: `leadDays` before `occurrence`, at the
 * user's `timeOfDay` in their `timeZone`. `occurrence` is a UTC-midnight
 * calendar date; we take its Y/M/D, step back `leadDays` whole days, then anchor
 * the wall-clock time in the zone and resolve to an absolute instant (FR-22/51).
 */
export function fireInstant(
  occurrence: Date,
  leadDays: number,
  timeZone: string | undefined,
  timeOfDay: string | undefined,
): Date {
  const { hour, minute } = parseTimeOfDay(timeOfDay);
  const remindDay = new Date(occurrence.getTime() - leadDays * MS_PER_DAY);
  return zoned(
    {
      year: remindDay.getUTCFullYear(),
      month: remindDay.getUTCMonth() + 1,
      day: remindDay.getUTCDate(),
      hour,
      minute,
    },
    timeZone,
  ).toJSDate();
}

/** Snooze targets (DESIGN.md §10): a couple of hours, or tomorrow morning. */
export type SnoozePreset = 'in1h' | 'in4h' | 'tomorrow';
export const SNOOZE_PRESETS: SnoozePreset[] = ['in1h', 'in4h', 'tomorrow'];

/**
 * Resolve a snooze preset to an absolute instant. The hour presets are simple
 * offsets; "tomorrow" re-anchors to the user's reminder time-of-day the next
 * local day so it doesn't surface at an odd hour (FR-33).
 */
export function snoozeUntil(
  preset: SnoozePreset,
  now: Date,
  timeZone: string | undefined,
  timeOfDay: string | undefined,
): Date {
  if (preset === 'in1h') return new Date(now.getTime() + 60 * 60 * 1000);
  if (preset === 'in4h') return new Date(now.getTime() + 4 * 60 * 60 * 1000);
  // tomorrow → next local day at the user's reminder time.
  const { hour, minute } = parseTimeOfDay(timeOfDay);
  const local = DateTime.fromJSDate(now).setZone(timeZone || 'UTC');
  const base = local.isValid ? local : DateTime.fromJSDate(now).setZone('UTC');
  return base
    .plus({ days: 1 })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}
