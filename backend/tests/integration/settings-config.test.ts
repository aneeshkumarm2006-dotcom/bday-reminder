import { beforeEach, describe, expect, it } from 'vitest';

import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * Stage 5 - settings & notification preferences (FR-19/21/22/24/56). Mirrors the
 * assertions in scripts/smoke-settings.ts: GET /config exposes the SMS/WhatsApp
 * monthly fair-use cap (default 20) without auth; PATCH /me persists channel
 * preferences, lead days, and reminder time and they read back on GET /me;
 * changing those scheduling inputs regenerates the user's pending reminders with
 * the new lead times and channel set; and a malformed PATCH /me body is rejected.
 */
describe('settings & config (FR-19/21/22/24/56)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const MS_PER_DAY = 86_400_000;
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  it('GET /config exposes the SMS/WhatsApp monthly cap (default 20, no auth)', async () => {
    const res = await api.get('/config');
    expect(res.status).toBe(200);
    expect(res.body.smsWhatsappMonthlyCap).toBe(20);
  });

  it('PATCH /me persists channel prefs, lead days, and reminder time; they read back on GET /me', async () => {
    const u = await signUp(api);

    const patch = await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({
        defaultReminderTime: '00:00',
        defaultLeadDays: [0, 7],
        phone: '+15550001111',
        channelPreferences: { push: false, email: false, sms: true, inApp: false },
      });
    expect(patch.status).toBe(200);

    const me = await api.get('/me').set('Authorization', u.auth);
    expect(me.status).toBe(200);
    expect(me.body.defaultLeadDays).toEqual([0, 7]);
    expect(me.body.defaultReminderTime).toBe('00:00');
    expect(me.body.channelPreferences.sms).toBe(true);
    expect(me.body.channelPreferences.push).toBe(false);
    expect(me.body.phone).toBe('+15550001111');
  });

  it('changing settings regenerates pending reminders with the new lead time and channels', async () => {
    const u = await signUp(api);

    // New people inherit the user's default lead times + channels (FR-24).
    await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({
        defaultReminderTime: '00:00',
        defaultLeadDays: [0],
        phone: '+15550001111',
        channelPreferences: { push: false, email: false, sms: true, inApp: false },
      });

    const created = await addPerson(api, u.auth, {
      fullName: 'Aki',
      dob: { ...md(plusDays(todayUTC, 10)), year: 1990 },
      phone: '+15559990000',
    });
    expect(created.status).toBe(201);

    const { Reminder } = await import('../../src/models/Reminder');
    const initial = await Reminder.find({ user: u.id, status: 'pending' });
    expect(initial.length).toBe(1);
    expect(initial[0].leadDays).toBe(0);
    expect(initial[0].channels).toEqual(['sms']);

    // Changing lead days + channels re-anchors the pending reminders.
    const repatch = await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({
        defaultLeadDays: [0, 7],
        channelPreferences: { push: true, email: true, sms: false, inApp: true },
      });
    expect(repatch.status).toBe(200);

    const after = await Reminder.find({ user: u.id, status: 'pending' });
    const leads = after.map((r) => r.leadDays).sort((a, b) => a - b);
    expect(leads).toEqual([0, 7]);
    expect(after.every((r) => r.channels.includes('push') && r.channels.includes('email'))).toBe(true);
    expect(after.every((r) => !r.channels.includes('sms'))).toBe(true);
  });

  it('rejects a malformed PATCH /me body → 400', async () => {
    const u = await signUp(api);

    const badTime = await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({ defaultReminderTime: '25:99' });
    expect(badTime.status).toBe(400);

    const badLead = await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({ defaultLeadDays: [-1] });
    expect(badLead.status).toBe(400);

    const unknownKey = await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({ notAField: true });
    expect(unknownKey.status).toBe(400);
  });
});
