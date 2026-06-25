import { beforeEach, describe, expect, it } from 'vitest';

import { makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';
import { Reminder } from '../../src/models/Reminder';

/**
 * Shared / family lists (Stage 8, FR-41-47, §8.11, §10). Mirrors
 * scripts/smoke-stage8.ts: two accounts share a list, the invitee must accept
 * before access, view-only is read-only, the owner promotes to edit, both see
 * the same people but get reminders per their own settings (with attribution),
 * and leaving / removal / deletion stops the affected user's reminders for the
 * list's people.
 *
 * "Today" in UTC so a person born now is day-of and yields exactly one reminder
 * per recipient (each account uses a single day-of lead `[0]`).
 */
describe('shared lists (FR-41/47)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  function utcTodayDob() {
    const now = new Date();
    return { month: now.getUTCMonth() + 1, day: now.getUTCDate(), year: 1971 };
  }

  const reminderCount = (userId: string) => Reminder.countDocuments({ user: userId });

  /** Sign up Ada (owner) + Bo (invitee), each with a single day-of lead. */
  async function twoUsers() {
    const ada = await signUp(api, { name: 'Ada', timezone: 'UTC' });
    const bo = await signUp(api, { name: 'Bo', timezone: 'UTC' });
    await api.patch('/me').set('Authorization', ada.auth).send({ defaultLeadDays: [0] });
    await api.patch('/me').set('Authorization', bo.auth).send({ defaultLeadDays: [0] });
    return { ada, bo };
  }

  it('requires auth on GET and POST /lists', async () => {
    expect((await api.get('/lists')).status).toBe(401);
    expect((await api.post('/lists').send({ name: 'X' })).status).toBe(401);
  });

  it('rejects a blank list name with 400', async () => {
    const ada = await signUp(api, { name: 'Ada' });
    const res = await api.post('/lists').set('Authorization', ada.auth).send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('creates a list with the creator as the sole owner-member', async () => {
    const ada = await signUp(api, { name: 'Ada' });
    const res = await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' });
    expect(res.status).toBe(201);
    const list = res.body.list;
    expect(list.role).toBe('owner');
    expect(list.permission).toBe('owner');
    expect(list.memberCount).toBe(1);
    expect(list.members[0].isOwner).toBe(true);
  });

  it('lets the owner invite by email (token created, email skipped without a key)', async () => {
    const { ada } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;

    const res = await api
      .post(`/lists/${list.id}/invite`)
      .set('Authorization', ada.auth)
      .send({ invitedEmailOrPhone: 'bo@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.invite.token).toBeTruthy();
    expect(res.body.invite.status).toBe('pending');
    expect(res.body.emailOutcome).toBe('skipped');

    const ownerView = (await api.get(`/lists/${list.id}`).set('Authorization', ada.auth)).body.list;
    expect(ownerView.pendingInvites.length).toBe(1);
  });

  it('blocks a non-member from seeing or inviting to the list (404)', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;

    // Before accepting, Bo has no access at all.
    expect((await api.get('/lists').set('Authorization', bo.auth)).body.lists.length).toBe(0);
    expect((await api.get(`/lists/${list.id}`).set('Authorization', bo.auth)).status).toBe(404);
    const invite = await api
      .post(`/lists/${list.id}/invite`)
      .set('Authorization', bo.auth)
      .send({ invitedEmailOrPhone: 'bo@example.com' });
    expect(invite.status).toBe(404);
  });

  it('keeps shared people hidden until the invitee accepts, then reveals them', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;

    // Bo can't see Mum and has no reminders before accepting (FR-42).
    let people = (await api.get('/people').set('Authorization', bo.auth)).body.people as {
      id: string;
    }[];
    expect(people.some((p) => p.id === mum.id)).toBe(false);
    expect(await reminderCount(bo.id)).toBe(0);

    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;

    // Preview the invite, then accept it.
    const preview = (await api.get(`/invites/${invite.token}`).set('Authorization', bo.auth)).body
      .invite;
    expect(preview.listName).toBe('Family');
    expect(preview.inviterName).toBe('Ada');
    expect(preview.permission).toBe('view');
    expect(preview.alreadyMember).toBe(false);

    const accept = await api
      .post(`/invites/${invite.token}/accept`)
      .set('Authorization', bo.auth);
    expect(accept.status).toBe(200);
    expect(
      accept.body.list.members.some(
        (m: { id: string; permission: string }) => m.id === bo.id && m.permission === 'view',
      ),
    ).toBe(true);

    // Now Bo sees Mum (view access) and got his OWN day-of reminder.
    people = (await api.get('/people').set('Authorization', bo.auth)).body.people as {
      id: string;
      access?: string;
    }[];
    const mumForBo = people.find((p) => p.id === mum.id);
    expect(mumForBo).toBeTruthy();
    expect(mumForBo?.access).toBe('view');
    expect(await reminderCount(bo.id)).toBe(1);
    expect(await reminderCount(ada.id)).toBe(1);

    // The invite is no longer pending for the owner.
    const ownerView = (await api.get(`/lists/${list.id}`).set('Authorization', ada.auth)).body.list;
    expect(ownerView.pendingInvites.length).toBe(0);
  });

  it('blocks a view-only member from writing but allows reading (403 vs 200)', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const dob = utcTodayDob();
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob, lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    expect(
      (await api.patch(`/people/${mum.id}`).set('Authorization', bo.auth).send({ phone: '+100' }))
        .status,
    ).toBe(403);
    expect(
      (await api.post(`/people/${mum.id}/notes`).set('Authorization', bo.auth).send({ text: 'socks' }))
        .status,
    ).toBe(403);
    expect(
      (
        await api
          .post('/events')
          .set('Authorization', bo.auth)
          .send({ person: mum.id, type: 'anniversary', date: dob })
      ).status,
    ).toBe(403);
    expect((await api.delete(`/people/${mum.id}`).set('Authorization', bo.auth)).status).toBe(403);
    // But a view member CAN read the shared person.
    expect((await api.get(`/people/${mum.id}`).set('Authorization', bo.auth)).status).toBe(200);

    // The blocked writes had NO EFFECT - re-read as the owner and confirm.
    const asOwner = (await api.get(`/people/${mum.id}`).set('Authorization', ada.auth)).body;
    expect(asOwner.person.phone == null || asOwner.person.phone !== '+100').toBe(true);
    expect(asOwner.events.length).toBe(1); // only the birthday - Bo's anniversary was rejected
    const notes = (await api.get(`/people/${mum.id}/notes`).set('Authorization', ada.auth)).body
      .notes as { text: string }[];
    expect(notes.some((n) => n.text === 'socks')).toBe(false);
  });

  it('promotes a member to edit, who can then edit with attribution showing the editor', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    // A member can't change permissions; the owner can.
    expect(
      (
        await api
          .patch(`/lists/${list.id}/members/${bo.id}`)
          .set('Authorization', bo.auth)
          .send({ permission: 'edit' })
      ).status,
    ).toBe(403);
    const promote = await api
      .patch(`/lists/${list.id}/members/${bo.id}`)
      .set('Authorization', ada.auth)
      .send({ permission: 'edit' });
    expect(promote.status).toBe(200);
    expect((await api.get(`/people/${mum.id}`).set('Authorization', bo.auth)).body.person.access).toBe(
      'edit',
    );

    // Bo can now edit; the change is visible to Ada and attributed to Bo (FR-45).
    const edit = await api
      .patch(`/people/${mum.id}`)
      .set('Authorization', bo.auth)
      .send({ phone: '+15551234' });
    expect(edit.status).toBe(200);
    const mumForAda = (await api.get(`/people/${mum.id}`).set('Authorization', ada.auth)).body.person;
    expect(mumForAda.phone).toBe('+15551234');
    expect(mumForAda.lastEditedBy?.name).toBe('Bo');

    // An edit member can add an event + a note, attributed to Bo.
    const ev = await api
      .post('/events')
      .set('Authorization', bo.auth)
      .send({ person: mum.id, type: 'anniversary', date: utcTodayDob() });
    expect(ev.status).toBe(201);
    const note = await api
      .post(`/people/${mum.id}/notes`)
      .set('Authorization', bo.auth)
      .send({ text: 'Likes gardening' });
    expect(note.status).toBe(201);
    const notes = (await api.get(`/people/${mum.id}/notes`).set('Authorization', ada.auth)).body
      .notes as { text: string; author: string }[];
    expect(notes.some((n) => n.text === 'Likes gardening' && n.author === bo.id)).toBe(true);
  });

  it('gives each member their OWN reminders per their own settings (shared data, personal settings)', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com', permission: 'edit' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    // Bo (edit) adds an event; both members get an instance for it.
    await api
      .post('/events')
      .set('Authorization', bo.auth)
      .send({ person: mum.id, type: 'anniversary', date: utcTodayDob() });
    expect(await reminderCount(ada.id)).toBe(2);
    expect(await reminderCount(bo.id)).toBe(2);

    // Each member's reminder is a distinct per-recipient instance, fired at
    // their own configured time (Ada 09:00 default, Bo 18:00).
    await api.patch('/me').set('Authorization', bo.auth).send({ defaultReminderTime: '18:00' });
    expect(await reminderCount(ada.id)).toBe(2);
    expect(await reminderCount(bo.id)).toBe(2);

    const adaBday = await Reminder.findOne({ user: ada.id, leadDays: 0 }).sort({ scheduledFor: 1 });
    const boBday = await Reminder.findOne({ user: bo.id, leadDays: 0 }).sort({ scheduledFor: 1 });
    expect(adaBday).not.toBeNull();
    expect(boBday).not.toBeNull();
    expect(adaBday!.scheduledFor.getUTCHours()).toBe(9);
    expect(boBday!.scheduledFor.getUTCHours()).toBe(18);
  });

  it('stops a member\'s reminders when they leave; the owner cannot leave their own list', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    expect(await reminderCount(bo.id)).toBe(1);

    // The owner can't leave their own list.
    expect((await api.post(`/lists/${list.id}/leave`).set('Authorization', ada.auth)).status).toBe(
      400,
    );

    // Bo leaves → 204, loses sight of the shared people, reminders stop.
    expect((await api.post(`/lists/${list.id}/leave`).set('Authorization', bo.auth)).status).toBe(
      204,
    );
    const people = (await api.get('/people').set('Authorization', bo.auth)).body.people as {
      id: string;
    }[];
    expect(people.some((p) => p.id === mum.id)).toBe(false);
    expect(await reminderCount(bo.id)).toBe(0);
    expect(await reminderCount(ada.id)).toBe(1);
  });

  it('lets the owner remove a member, stopping their reminders (members cannot manage the list)', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    expect(await reminderCount(bo.id)).toBe(1);

    // A member (non-owner) cannot rename, delete, or invite to the list.
    expect(
      (await api.patch(`/lists/${list.id}`).set('Authorization', bo.auth).send({ name: 'Hax' }))
        .status,
    ).toBe(403);
    expect((await api.delete(`/lists/${list.id}`).set('Authorization', bo.auth)).status).toBe(403);
    expect(
      (
        await api
          .post(`/lists/${list.id}/invite`)
          .set('Authorization', bo.auth)
          .send({ invitedEmailOrPhone: 'x@example.com' })
      ).status,
    ).toBe(403);

    // The owner removes Bo → 200; his reminders stop and he loses access.
    expect(
      (await api.delete(`/lists/${list.id}/members/${bo.id}`).set('Authorization', ada.auth)).status,
    ).toBe(200);
    expect(await reminderCount(bo.id)).toBe(0);
    const people = (await api.get('/people').set('Authorization', bo.auth)).body.people as {
      id: string;
    }[];
    expect(people.some((p) => p.id === mum.id)).toBe(false);
  });

  it('rejects invalid invite tokens with 404 on preview and accept', async () => {
    const bo = await signUp(api, { name: 'Bo' });
    expect((await api.get('/invites/not-a-real-token').set('Authorization', bo.auth)).status).toBe(
      404,
    );
    expect(
      (await api.post('/invites/not-a-real-token/accept').set('Authorization', bo.auth)).status,
    ).toBe(404);
  });

  it('deletes the list, stopping every member\'s reminders while the people survive detached', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    const mum = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Mum', dob: utcTodayDob(), lists: [list.id] })
    ).body.person;
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    expect(await reminderCount(bo.id)).toBe(1);

    // The owner deletes the list → 204; every member loses access + reminders.
    expect((await api.delete(`/lists/${list.id}`).set('Authorization', ada.auth)).status).toBe(204);
    expect(await reminderCount(bo.id)).toBe(0);

    // The people survive, detached from the deleted list; the owner keeps them.
    const mumAfter = (await api.get(`/people/${mum.id}`).set('Authorization', ada.auth)).body.person;
    expect(mumAfter.lists.length).toBe(0);
    expect(await reminderCount(ada.id)).toBe(1);
    expect((await api.get('/lists').set('Authorization', ada.auth)).body.lists.length).toBe(0);

    // A non-member can no longer read the owner's person (403).
    expect((await api.get(`/people/${mum.id}`).set('Authorization', bo.auth)).status).toBe(403);
  });
});
