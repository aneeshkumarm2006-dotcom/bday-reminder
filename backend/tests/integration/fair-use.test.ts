import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getSmsUsage,
  incrementSmsUsage,
  resolveFairUse,
  smsMonthlyCap,
  smsPeriod,
} from '../../src/lib/sms-usage';
import { SmsUsage } from '../../src/models/SmsUsage';
import { useTestDb } from '../helpers/db';

/**
 * SMS/WhatsApp fair-use logic (FR-55/56), mirroring the assertions in
 * `scripts/smoke-settings.ts`. DB-backed: drives the sms-usage lib directly
 * against the in-memory Mongo. The cap in the Vitest env is 20.
 */
describe('SMS fair-use cap (FR-55/56)', () => {
  useTestDb();

  // A fresh, isolated user id per test (clean DB between tests).
  let userId: string;
  beforeEach(() => {
    userId = new Types.ObjectId().toString();
  });

  it('uses the configured monthly cap (20 in this env)', () => {
    expect(smsMonthlyCap()).toBe(20);
  });

  it('smsPeriod yields "YYYY-MM" in UTC', () => {
    expect(smsPeriod(new Date(Date.UTC(2099, 0, 15)))).toBe('2099-01');
    expect(smsPeriod(new Date(Date.UTC(2026, 11, 1, 23, 59)))).toBe('2026-12');
    expect(smsPeriod(new Date())).toMatch(/^\d{4}-\d{2}$/);
  });

  it('is a no-op when channels do not include "sms"', async () => {
    const channels = ['push', 'email', 'inApp'] as const;
    const res = await resolveFairUse(userId, [...channels], new Date());
    expect(res.channels).toEqual([...channels]);
    expect(res.countSms).toBe(false);
    expect(res.fellBack).toBe(false);
  });

  it('keeps SMS and flags it to be counted when under the cap', async () => {
    const res = await resolveFairUse(userId, ['sms', 'inApp'], new Date());
    expect(res.channels).toContain('sms');
    expect(res.countSms).toBe(true);
    expect(res.fellBack).toBe(false);
  });

  it('drops SMS and adds push + email when at/over the cap (seeded doc)', async () => {
    const now = new Date(Date.UTC(2099, 0, 15));
    // Seed usage straight to the cap for this user/period.
    await SmsUsage.create({ user: userId, period: smsPeriod(now), count: smsMonthlyCap() });

    const res = await resolveFairUse(userId, ['sms'], now);
    expect(res.channels).not.toContain('sms');
    expect(res.channels).toContain('push');
    expect(res.channels).toContain('email');
    expect(res.countSms).toBe(false);
    expect(res.fellBack).toBe(true);
  });

  it('falls back once the cap is reached via incrementSmsUsage in a loop', async () => {
    const now = new Date(Date.UTC(2099, 5, 1));
    const period = smsPeriod(now);

    // Under the cap right up to the last allowed send.
    for (let i = 0; i < smsMonthlyCap() - 1; i += 1) {
      await incrementSmsUsage(userId, period);
    }
    const stillUnder = await resolveFairUse(userId, ['sms'], now);
    expect(stillUnder.channels).toContain('sms');
    expect(stillUnder.countSms).toBe(true);
    expect(stillUnder.fellBack).toBe(false);

    // One more increment hits the cap → fall back.
    await incrementSmsUsage(userId, period);
    const over = await resolveFairUse(userId, ['sms'], now);
    expect(over.channels).not.toContain('sms');
    expect(over.channels).toContain('push');
    expect(over.channels).toContain('email');
    expect(over.fellBack).toBe(true);
  });

  it('increments per-user per-period and reads it back', async () => {
    const period = smsPeriod(new Date(Date.UTC(2099, 2, 10)));

    expect(await getSmsUsage(userId, period)).toBe(0);

    const first = await incrementSmsUsage(userId, period);
    expect(first).toBe(1);
    const second = await incrementSmsUsage(userId, period);
    expect(second).toBe(2);
    expect(await getSmsUsage(userId, period)).toBe(2);

    // A different period for the same user is counted independently.
    const otherPeriod = smsPeriod(new Date(Date.UTC(2099, 3, 10)));
    expect(await getSmsUsage(userId, otherPeriod)).toBe(0);

    // A different user in the same period is counted independently.
    const otherUser = new Types.ObjectId().toString();
    expect(await getSmsUsage(otherUser, period)).toBe(0);
  });

  it('exposes the cap (no auth) at GET /config', async () => {
    const { makeApi } = await import('../helpers/api');
    const { api } = makeApi();
    const res = await api.get('/config');
    expect(res.status).toBe(200);
    expect(res.body.smsWhatsappMonthlyCap).toBe(smsMonthlyCap());
  });
});
