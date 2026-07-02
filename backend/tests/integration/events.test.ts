import { beforeEach, describe, expect, it } from 'vitest';

import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * Stage 6 - additional event types + per-event overrides (FR-16/18). Mirrors the
 * assertions in scripts/smoke-stage6.ts: anniversary/custom events, the
 * birthday's date/name being owned by the DOB, delete cascade of reminders, and
 * lead/channel overrides that fall back to user defaults when cleared.
 */
describe('events (FR-16/18)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  /** Create a person and return { auth, personId, birthdayId }. */
  async function setupPerson(): Promise<{ auth: string; personId: string; birthdayId: string }> {
    const u = await signUp(api);
    const created = await addPerson(api, u.auth, { fullName: 'Rex', dob: { ...md(todayUTC), year: 2018 } });
    expect(created.status).toBe(201);
    const personId: string = created.body.person.id;
    const profile = await api.get(`/people/${personId}`).set('Authorization', u.auth);
    const birthdayId: string = profile.body.events.find((e: { type: string }) => e.type === 'birthday').id;
    return { auth: u.auth, personId, birthdayId };
  }

  it('creates an anniversary event → 201', async () => {
    const { auth, personId } = await setupPerson();
    const res = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'anniversary', date: { ...md(todayUTC), year: 2015 } });
    expect(res.status).toBe(201);
    expect(res.body.event.type).toBe('anniversary');
  });

  it('creates a custom event with a name → 201; without a name → 400', async () => {
    const { auth, personId } = await setupPerson();

    const named = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) });
    expect(named.status).toBe(201);
    expect(named.body.event.customName).toBe('Adoption day');

    const unnamed = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', date: md(todayUTC) });
    expect(unnamed.status).toBe(400);
  });

  it('rejects an impossible date (Apr 31) → 400', async () => {
    const { auth, personId } = await setupPerson();
    const res = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'anniversary', date: { month: 4, day: 31 } });
    expect(res.status).toBe(400);
  });

  it('PATCH renames a custom event', async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) });
    const customId: string = created.body.event.id;

    const res = await api.patch(`/events/${customId}`).set('Authorization', auth).send({ customName: 'Gotcha day' });
    expect(res.status).toBe(200);
    expect(res.body.event.customName).toBe('Gotcha day');
  });

  it("rejects editing the birthday's date (owned by DOB) → 400", async () => {
    const { auth, birthdayId } = await setupPerson();
    const res = await api.patch(`/events/${birthdayId}`).set('Authorization', auth).send({ date: md(todayUTC) });
    expect(res.status).toBe(400);
  });

  it('rejects renaming a non-custom event (anniversary) → 400', async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'anniversary', date: { ...md(todayUTC), year: 2015 } });
    const anniversaryId: string = created.body.event.id;

    const res = await api.patch(`/events/${anniversaryId}`).set('Authorization', auth).send({ customName: 'Nope' });
    expect(res.status).toBe(400);
  });

  it('deletes a non-birthday event and cascades its reminders → 204', async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'anniversary', date: { ...md(todayUTC), year: 2015 } });
    const anniversaryId: string = created.body.event.id;

    // The anniversary is dated today → a day-of reminder is generated. Prove it
    // existed BEFORE the delete so the post-delete count isn't vacuously zero.
    const { Reminder } = await import('../../src/models/Reminder');
    const before = await Reminder.countDocuments({ event: anniversaryId });
    expect(before).toBeGreaterThan(0);

    const del = await api.delete(`/events/${anniversaryId}`).set('Authorization', auth);
    expect(del.status).toBe(204);

    const remaining = await Reminder.countDocuments({ event: anniversaryId });
    expect(remaining).toBe(0);

    const profile = await api.get(`/people/${personId}`).set('Authorization', auth);
    // Birthday only remains.
    expect(profile.body.events.length).toBe(1);
  });

  it("rejects deleting the birthday event directly → 400", async () => {
    const { auth, birthdayId } = await setupPerson();
    const res = await api.delete(`/events/${birthdayId}`).set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  it('sets and clears leadDaysOverride + channelOverride (null reverts to default)', async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) });
    const customId: string = created.body.event.id;
    expect(created.body.event.leadDaysOverride).toBeNull();
    expect(created.body.event.channelOverride).toBeNull();

    const set = await api
      .patch(`/events/${customId}`)
      .set('Authorization', auth)
      .send({ leadDaysOverride: [0, 3], channelOverride: { push: true, email: false } });
    expect(set.status).toBe(200);
    expect(set.body.event.leadDaysOverride).toEqual([0, 3]);
    expect(set.body.event.channelOverride).toEqual({ push: true, email: false });

    const cleared = await api
      .patch(`/events/${customId}`)
      .set('Authorization', auth)
      .send({ leadDaysOverride: null, channelOverride: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.event.leadDaysOverride).toBeNull();
    expect(cleared.body.event.channelOverride).toBeNull();
  });

  it('sets, validates, and clears reminderTimeOverride (null reverts to default)', async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) });
    const customId: string = created.body.event.id;
    expect(created.body.event.reminderTimeOverride).toBeNull();

    const set = await api
      .patch(`/events/${customId}`)
      .set('Authorization', auth)
      .send({ reminderTimeOverride: '18:30' });
    expect(set.status).toBe(200);
    expect(set.body.event.reminderTimeOverride).toBe('18:30');

    // A malformed time is rejected by Zod.
    const bad = await api
      .patch(`/events/${customId}`)
      .set('Authorization', auth)
      .send({ reminderTimeOverride: '25:00' });
    expect(bad.status).toBe(400);

    const cleared = await api
      .patch(`/events/${customId}`)
      .set('Authorization', auth)
      .send({ reminderTimeOverride: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.event.reminderTimeOverride).toBeNull();
  });

  it('a reminderTimeOverride re-anchors the pending reminder to a different instant', async () => {
    const { auth, birthdayId } = await setupPerson();
    const { Reminder } = await import('../../src/models/Reminder');

    // Birthday is dated today → a surviving pending reminder exists at the
    // default 09:00. Capture its lead-day + fire instant before the change.
    const before = await Reminder.findOne({ event: birthdayId });
    expect(before).not.toBeNull();
    const lead = before!.leadDays;
    const beforeTime = before!.scheduledFor!.getTime();

    const res = await api
      .patch(`/events/${birthdayId}`)
      .set('Authorization', auth)
      .send({ reminderTimeOverride: '18:00' });
    expect(res.status).toBe(200);
    expect(res.body.event.reminderTimeOverride).toBe('18:00');

    // Regeneration re-anchored the same lead-day instance to a new time-of-day.
    const after = await Reminder.findOne({ event: birthdayId, leadDays: lead });
    expect(after).not.toBeNull();
    expect(after!.scheduledFor!.getTime()).not.toBe(beforeTime);
  });

  it("rejects another user's access to your event → 403", async () => {
    const { auth, personId } = await setupPerson();
    const created = await api
      .post('/events')
      .set('Authorization', auth)
      .send({ person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) });
    const customId: string = created.body.event.id;

    const other = await signUp(api);

    const add = await api
      .post('/events')
      .set('Authorization', other.auth)
      .send({ person: personId, type: 'anniversary', date: md(todayUTC) });
    expect(add.status).toBe(403);

    const del = await api.delete(`/events/${customId}`).set('Authorization', other.auth);
    expect(del.status).toBe(403);
  });
});
