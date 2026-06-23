import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeApi, signUp, addPerson, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * Reminder generation + dispatch (TODO Stage 13) with MOCKED channel providers.
 * We mock `src/channels` so the engine's fan-out is observable without hitting
 * Expo/Resend: the mock records every (channels, payload) and reports each
 * channel "sent". That lets us assert the engine generates the right instances,
 * delivers the correct §11 copy, marks them sent, and is idempotent (no
 * double-send if the dispatcher ticks twice), plus the in-app feed + Done/Snooze.
 */

const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/channels', () => ({
  dispatchToChannels: dispatchMock,
}));

// Imported AFTER the mock is declared (vi.mock is hoisted above imports anyway).
import { dispatchDue, generateForUser } from '../../src/jobs/reminder-engine';
import { Reminder } from '../../src/models/Reminder';
import { User } from '../../src/models/User';

const todayParts = () => {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
};

describe('reminder dispatch (mocked providers)', () => {
  useTestDb();
  let api: Api;

  beforeEach(() => {
    ({ api } = makeApi());
    dispatchMock.mockReset();
    // Default: every targeted channel "sent".
    dispatchMock.mockImplementation(async (channels: string[]) =>
      channels.map((channel) => ({ channel, outcome: 'sent' as const })),
    );
  });

  /** Sign up a user (UTC) and add a person whose birthday is TODAY, with a phone. */
  async function seedDayOfPerson() {
    const u = await signUp(api, { timezone: 'UTC' });
    const res = await addPerson(api, u.auth, {
      fullName: 'Aisha Khan',
      dob: { ...todayParts(), year: 1990 },
      phone: '+15555550100',
    });
    expect(res.status).toBe(201);
    const userDoc = await User.findById(u.id);
    return { u, userDoc: userDoc! };
  }

  /** Force every pending reminder due so dispatch fires regardless of wall-clock. */
  async function forceDue() {
    await Reminder.updateMany({ status: 'pending' }, { $set: { scheduledFor: new Date(0) } });
  }

  it('generates a day-of reminder and is idempotent', async () => {
    const { userDoc } = await seedDayOfPerson();
    // Creating the person already generated instances; re-running creates none.
    const created = await generateForUser(userDoc);
    expect(created).toBe(0);
    const count = await Reminder.countDocuments({ user: userDoc._id });
    expect(count).toBeGreaterThan(0);
  });

  it('dispatches due reminders through the channels with the right copy, once', async () => {
    await seedDayOfPerson();
    await forceDue();

    const first = await dispatchDue(new Date());
    expect(first.sent).toBeGreaterThan(0);
    expect(dispatchMock).toHaveBeenCalled();

    // The engine fans out to the resolved channels (default prefs: push+email,
    // sms off) AND carries the §11 day-of copy + headline for the person.
    const [channels, payload] = dispatchMock.mock.calls[0];
    expect(channels).toEqual(expect.arrayContaining(['push', 'email']));
    expect(channels).not.toContain('sms');
    expect(payload.headline).toContain('Aisha Khan');
    expect(payload.message).toContain("Aisha Khan's birthday today");

    // Per-channel delivery outcomes are persisted on the reminder.
    const persisted = await Reminder.findOne({ status: 'sent' });
    expect(persisted?.deliveryResults?.length).toBeGreaterThan(0);
    expect(persisted?.externalDeliveryFailed).toBe(false);

    // Idempotent: a second tick finds nothing pending → sends nothing more.
    dispatchMock.mockClear();
    const second = await dispatchDue(new Date());
    expect(second.sent).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('honors the channel resolution — a user with email off is not sent email', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    // push-only (email + sms off); in-app always implied downstream.
    await api
      .patch('/me')
      .set('Authorization', u.auth)
      .send({ channelPreferences: { push: true, email: false, sms: false, inApp: true } });
    await addPerson(api, u.auth, { fullName: 'Aisha Khan', dob: { ...todayParts(), year: 1990 } });
    await forceDue();
    await dispatchDue(new Date());

    const [channels] = dispatchMock.mock.calls[0];
    expect(channels).toContain('push');
    expect(channels).not.toContain('email');
    expect(channels).not.toContain('sms');
  });

  it('flags externalDeliveryFailed when every external channel fails', async () => {
    await seedDayOfPerson();
    await forceDue();
    // Make the external channels report failure for this run.
    dispatchMock.mockImplementation(async (channels: string[]) =>
      channels.map((channel) => ({ channel, outcome: 'failed' as const })),
    );
    await dispatchDue(new Date());

    const persisted = await Reminder.findOne({ status: 'sent' });
    expect(persisted?.externalDeliveryFailed).toBe(true);
  });

  it('persists the reminder to the in-app feed with day-of greeting eligibility', async () => {
    const { u } = await seedDayOfPerson();
    await forceDue();
    await dispatchDue(new Date());

    const feed = await api.get('/reminders').set('Authorization', u.auth);
    expect(feed.status).toBe(200);
    const item = feed.body.items.find((i: any) => i.person.fullName === 'Aisha Khan');
    expect(item).toBeTruthy();
    expect(item.message).toContain("Aisha Khan's birthday today");
    expect(item.canGreet).toBe(true); // day-of + phone on file (FR-28/30)
  });

  it('hides the greeting action when the person has no phone', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Noah NoPhone', dob: { ...todayParts(), year: 1992 } });
    await forceDue();
    await dispatchDue(new Date());

    const feed = await api.get('/reminders').set('Authorization', u.auth);
    const item = feed.body.items.find((i: any) => i.person.fullName === 'Noah NoPhone');
    expect(item.canGreet).toBe(false);
  });

  it('Mark as done stops the occurrence and de-emphasizes the row', async () => {
    const { u } = await seedDayOfPerson();
    await forceDue();
    await dispatchDue(new Date());

    let feed = await api.get('/reminders').set('Authorization', u.auth);
    const item = feed.body.items.find((i: any) => i.person.fullName === 'Aisha Khan');
    expect(item).toBeTruthy();
    const id = item.id;
    const done = await api.post(`/reminders/${id}/done`).set('Authorization', u.auth);
    expect(done.status).toBe(200);
    expect(done.body.reminder.status).toBe('done');

    feed = await api.get('/reminders').set('Authorization', u.auth);
    expect(feed.body.items.every((i: any) => i.status === 'done')).toBe(true);
  });

  it('Snooze hides the reminder, then it re-fires after the delay', async () => {
    const { u } = await seedDayOfPerson();
    await forceDue();
    await dispatchDue(new Date());

    let feed = await api.get('/reminders').set('Authorization', u.auth);
    const item = feed.body.items.find((i: any) => i.person.fullName === 'Aisha Khan');
    expect(item).toBeTruthy();
    const id = item.id;
    const snoozed = await api.post(`/reminders/${id}/snooze`).set('Authorization', u.auth).send({ preset: 'in1h' });
    expect(snoozed.status).toBe(200);
    expect(snoozed.body.reminder.status).toBe('snoozed');

    // Promote: a dispatch run after the snooze window flips snoozed → pending → sent.
    await Reminder.updateMany({ status: 'snoozed' }, { $set: { snoozeUntil: new Date(0) } });
    const after = await dispatchDue(new Date());
    expect(after.promoted).toBeGreaterThan(0);

    feed = await api.get('/reminders').set('Authorization', u.auth);
    expect(feed.body.items.some((i: any) => i.status === 'sent')).toBe(true);
  });
});
