import { describe, expect, it } from 'vitest';

import {
  SNOOZE_PRESETS,
  fireInstant,
  parseTimeOfDay,
  snoozeUntil,
} from '../../src/lib/schedule';

/** UTC midnight helper for terse occurrence assertions. */
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('schedule: parseTimeOfDay', () => {
  it('parses a valid "HH:mm" string', () => {
    expect(parseTimeOfDay('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTimeOfDay('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('defaults to 09:00 on invalid / undefined / out-of-range / unpadded input', () => {
    const def = { hour: 9, minute: 0 };
    expect(parseTimeOfDay(undefined)).toEqual(def);
    expect(parseTimeOfDay('')).toEqual(def);
    expect(parseTimeOfDay('25:00')).toEqual(def); // hour out of range
    expect(parseTimeOfDay('9:5')).toEqual(def); // not zero-padded
    expect(parseTimeOfDay('nonsense')).toEqual(def);
  });
});

describe('schedule: fireInstant', () => {
  it('anchors wall-clock 09:00 in Asia/Kolkata to 03:30 UTC the same calendar day', () => {
    // 09:00 IST (UTC+5:30) === 03:30 UTC.
    const occurrence = utc(2026, 6, 22);
    const fire = fireInstant(occurrence, 0, 'Asia/Kolkata', '09:00');
    expect(fire.getUTCFullYear()).toBe(2026);
    expect(fire.getUTCMonth()).toBe(5); // June (0-based)
    expect(fire.getUTCDate()).toBe(22);
    expect(fire.getUTCHours()).toBe(3);
    expect(fire.getUTCMinutes()).toBe(30);
  });

  it('anchors wall-clock 09:00 in UTC to 09:00 UTC, 5.5h apart from Asia/Kolkata', () => {
    const occurrence = utc(2026, 6, 22);
    const utcFire = fireInstant(occurrence, 0, 'UTC', '09:00');
    expect(utcFire.getUTCHours()).toBe(9);
    expect(utcFire.getUTCMinutes()).toBe(0);

    const kolkataFire = fireInstant(occurrence, 0, 'Asia/Kolkata', '09:00');
    // Same wall-clock time, IST is east of UTC so its absolute instant is earlier.
    const deltaMs = utcFire.getTime() - kolkataFire.getTime();
    expect(deltaMs).toBe(5.5 * 60 * 60 * 1000);
  });

  it('steps the calendar day back by leadDays', () => {
    const occurrence = utc(2026, 6, 22);
    const lead0 = fireInstant(occurrence, 0, 'UTC', '09:00');
    const lead7 = fireInstant(occurrence, 7, 'UTC', '09:00');
    // Seven whole days earlier.
    expect(lead0.getTime() - lead7.getTime()).toBe(7 * 86_400_000);
    expect(lead7.getUTCDate()).toBe(15); // June 22 - 7 days = June 15
    expect(lead7.getUTCMonth()).toBe(5);
  });

  it('falls back to UTC on a bad/unknown zone instead of throwing', () => {
    const occurrence = utc(2026, 6, 22);
    let fire!: Date;
    expect(() => {
      fire = fireInstant(occurrence, 0, 'Not/AZone', '09:00');
    }).not.toThrow();
    // Falling back to UTC means 09:00 wall-clock === 09:00 UTC.
    expect(fire.getUTCHours()).toBe(9);
    expect(fire.getUTCMinutes()).toBe(0);
    expect(fire.getUTCDate()).toBe(22);
  });
});

describe('schedule: snoozeUntil', () => {
  it('"in1h" resolves to roughly now + 1 hour', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const out = snoozeUntil('in1h', now, 'UTC', '09:00');
    expect(out.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  it('"in4h" resolves to roughly now + 4 hours', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const out = snoozeUntil('in4h', now, 'UTC', '09:00');
    expect(out.getTime() - now.getTime()).toBe(4 * 60 * 60 * 1000);
  });

  it('"tomorrow" re-anchors to the next local day at the reminder time', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const out = snoozeUntil('tomorrow', now, 'UTC', '09:00');
    // Strictly after now.
    expect(out.getTime()).toBeGreaterThan(now.getTime());
    // Following local (UTC) day at the reminder time-of-day.
    expect(out.getUTCDate()).toBe(23); // June 23
    expect(out.getUTCMonth()).toBe(5);
    expect(out.getUTCHours()).toBe(9);
    expect(out.getUTCMinutes()).toBe(0);
    expect(out.getUTCSeconds()).toBe(0);
    expect(out.getUTCMilliseconds()).toBe(0);
  });
});

describe('schedule: SNOOZE_PRESETS', () => {
  it('contains exactly in1h, in4h, tomorrow', () => {
    expect(SNOOZE_PRESETS).toEqual(['in1h', 'in4h', 'tomorrow']);
  });
});
