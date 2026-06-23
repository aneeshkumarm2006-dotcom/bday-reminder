import { describe, expect, it } from 'vitest';

import { resolveChannels, resolveLeadDays } from '../../src/jobs/reminder-engine';
import { CHANNEL_KEYS } from '../../src/models/common';
import type { EventDoc } from '../../src/models/Event';
import type { UserDoc } from '../../src/models/User';

/**
 * resolveChannels / resolveLeadDays are pure: they only read
 * user.channelPreferences / user.defaultLeadDays and event.channelOverride /
 * event.leadDaysOverride. We feed plain user-like / event-like objects cast as
 * the doc types — no DB needed.
 */
const makeUser = (over: Partial<{
  channelPreferences: { push: boolean; email: boolean; sms: boolean; inApp: boolean };
  defaultLeadDays: number[];
}> = {}): UserDoc =>
  ({
    channelPreferences: { push: true, email: false, sms: false, inApp: true },
    defaultLeadDays: [7, 1, 0],
    ...over,
  }) as unknown as UserDoc;

const makeEvent = (over: Partial<{
  channelOverride: Partial<Record<string, boolean>> | null;
  leadDaysOverride: number[] | null;
}> = {}): EventDoc => ({ ...over }) as unknown as EventDoc;

describe('reminder-engine: resolveChannels (FR-19)', () => {
  it('with no event override returns the user default channels (the true CHANNEL_KEYS)', () => {
    const user = makeUser({ channelPreferences: { push: true, email: true, sms: false, inApp: true } });
    const event = makeEvent();
    // Filtered + ordered by CHANNEL_KEYS, only the true ones.
    expect(resolveChannels(user, event)).toEqual(['push', 'email', 'inApp']);
  });

  it('preserves CHANNEL_KEYS order and drops false defaults', () => {
    const user = makeUser({ channelPreferences: { push: false, email: false, sms: true, inApp: true } });
    expect(resolveChannels(user, makeEvent())).toEqual(['sms', 'inApp']);
    // Sanity: result is always a subset of the canonical key order.
    const result = resolveChannels(user, makeEvent());
    expect(result).toEqual(CHANNEL_KEYS.filter((k) => result.includes(k)));
  });

  it('an event channelOverride wins per-key over the user default (turning a key off)', () => {
    const user = makeUser({ channelPreferences: { push: true, email: true, sms: false, inApp: true } });
    // Override email off; push/sms/inApp not specified → fall back to user default.
    const event = makeEvent({ channelOverride: { email: false } });
    expect(resolveChannels(user, event)).toEqual(['push', 'inApp']);
  });

  it('an event channelOverride wins per-key over the user default (turning a key on)', () => {
    const user = makeUser({ channelPreferences: { push: false, email: false, sms: false, inApp: false } });
    // Override sms on; everything else stays at the user default (off).
    const event = makeEvent({ channelOverride: { sms: true } });
    expect(resolveChannels(user, event)).toEqual(['sms']);
  });
});

describe('reminder-engine: resolveLeadDays (FR-21)', () => {
  it('with no override returns the user default lead days, de-duplicated', () => {
    const user = makeUser({ defaultLeadDays: [7, 1, 0, 7] });
    expect(resolveLeadDays(user, makeEvent())).toEqual([7, 1, 0]);
  });

  it('an event leadDaysOverride wins over the user default', () => {
    const user = makeUser({ defaultLeadDays: [7, 1, 0] });
    const event = makeEvent({ leadDaysOverride: [3, 2] });
    expect(resolveLeadDays(user, event)).toEqual([3, 2]);
  });

  it('filters out invalid lead days (<0, >365, non-integer) and de-dupes', () => {
    const user = makeUser({ defaultLeadDays: [7, 1, 0] });
    const event = makeEvent({ leadDaysOverride: [-1, 0, 0, 366, 1.5, 30, 30, 365] });
    expect(resolveLeadDays(user, event)).toEqual([0, 30, 365]);
  });

  it('applies the same validation to user defaults when no override is present', () => {
    const user = makeUser({ defaultLeadDays: [-5, 14, 14, 400, 2.2, 3] });
    expect(resolveLeadDays(user, makeEvent())).toEqual([14, 3]);
  });
});
