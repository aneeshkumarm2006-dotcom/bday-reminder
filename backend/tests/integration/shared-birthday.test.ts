import { beforeEach, describe, expect, it } from 'vitest';

import { makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';
import { Person } from '../../src/models/Person';
import { Reminder } from '../../src/models/Reminder';

/**
 * Sharing your own birthday into a list, and the catch-up that follows.
 *
 * Two halves of one exchange: joining a list publishes the joiner's birthday to
 * it so the members already there start getting reminded about them, and the
 * joiner gets everyone else's birthdays and decides which ones belong in their
 * calendar.
 */
describe('shared birthdays + catch-up', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  const ADA_BIRTHDAY = { month: 3, day: 12, year: 1985 };
  const BO_BIRTHDAY = { month: 9, day: 4, year: 1990 };

  const reminderCount = (userId: string) => Reminder.countDocuments({ user: userId });

  async function twoUsers() {
    const ada = await signUp(api, { name: 'Ada', timezone: 'UTC', birthday: ADA_BIRTHDAY });
    const bo = await signUp(api, { name: 'Bo', timezone: 'UTC', birthday: BO_BIRTHDAY });
    await api.patch('/me').set('Authorization', ada.auth).send({ defaultLeadDays: [0] });
    await api.patch('/me').set('Authorization', bo.auth).send({ defaultLeadDays: [0] });
    return { ada, bo };
  }

  /** Ada's list, with `people` extra members added, plus a fresh invite token. */
  async function listWithInvite(adaAuth: string, people: string[] = []) {
    const list = (await api.post('/lists').set('Authorization', adaAuth).send({ name: 'Family' }))
      .body.list;
    for (const [i, fullName] of people.entries()) {
      await api
        .post('/people')
        .set('Authorization', adaAuth)
        .send({ fullName, dob: { month: 1 + (i % 12), day: 1 + (i % 28) }, lists: [list.id] });
    }
    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', adaAuth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    return { list, invite };
  }

  const peopleIn = async (auth: string, listId: string) =>
    (await api.get(`/people?list=${listId}`).set('Authorization', auth)).body.people as {
      id: string;
      fullName: string;
      selfUserId: string | null;
      inMyCalendar: boolean;
      isMine: boolean;
    }[];

  // --- sharing your birthday ------------------------------------------------

  it("publishes the joiner's birthday to the list, and shows the trade in the preview", async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth, ['Mom']);

    const preview = (await api.get(`/invites/${invite.token}`).set('Authorization', bo.auth)).body
      .invite;
    // Mom + Ada's own card - what Bo stands to gain, and what he already has to give.
    expect(preview.peopleCount).toBe(2);
    expect(preview.memberCount).toBe(1);
    expect(preview.yourBirthday).toEqual(BO_BIRTHDAY);

    const accept = await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    expect(accept.status).toBe(200);
    expect(accept.body.selfPerson.created).toBe(true);

    const seenByAda = await peopleIn(ada.auth, list.id);
    const boCard = seenByAda.find((p) => p.selfUserId === bo.id);
    expect(boCard?.fullName).toBe('Bo');
    expect(boCard?.isMine).toBe(false);
    // Ada is reminded about Bo now, not just Mom.
    expect(await reminderCount(ada.id)).toBe(2);
  });

  it('never reminds you about your own birthday', async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    // Bo's card is in the list and Ada is reminded about it...
    const seenByBo = await peopleIn(bo.auth, list.id);
    const own = seenByBo.find((p) => p.selfUserId === bo.id);
    expect(own).toBeTruthy();
    expect(own!.inMyCalendar).toBe(false);
    // ...but Bo only carries Ada's birthday, not his own.
    expect(await reminderCount(bo.id)).toBe(1);
  });

  it('honours an opt-out, and can collect a missing birthday during accept', async () => {
    const ada = await signUp(api, { name: 'Ada', birthday: ADA_BIRTHDAY });
    const bo = await signUp(api, { name: 'Bo', birthday: BO_BIRTHDAY });
    const shy = await signUp(api, { name: 'Shy', birthday: { month: 12, day: 25 } });

    const { list, invite } = await listWithInvite(ada.auth);
    await api
      .post(`/invites/${invite.token}/accept`)
      .set('Authorization', bo.auth)
      .send({ shareBirthday: false });
    expect((await peopleIn(bo.auth, list.id)).some((p) => p.selfUserId === bo.id)).toBe(false);

    // A birthday sent with the accept fills in an account that has none - but an
    // existing one is never overwritten from the invite screen.
    const second = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'shy@example.com' })
    ).body.invite;
    await api
      .post(`/invites/${second.token}/accept`)
      .set('Authorization', shy.auth)
      .send({ birthday: { month: 1, day: 1 } });
    const me = (await api.get('/me').set('Authorization', shy.auth)).body;
    expect(me.birthday).toEqual({ month: 12, day: 25, year: null });
  });

  it('claims a card a member already made rather than adding a duplicate', async () => {
    const { ada, bo } = await twoUsers();
    const list = (await api.post('/lists').set('Authorization', ada.auth).send({ name: 'Family' }))
      .body.list;
    // Ada already tracks Bo's birthday by hand, with the same name + date.
    await api
      .post('/people')
      .set('Authorization', ada.auth)
      .send({ fullName: 'Bo', dob: BO_BIRTHDAY, lists: [list.id] });

    const invite = (
      await api
        .post(`/lists/${list.id}/invite`)
        .set('Authorization', ada.auth)
        .send({ invitedEmailOrPhone: 'bo@example.com' })
    ).body.invite;
    const accept = await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    expect(accept.body.selfPerson.matched).toBe(true);

    const bos = (await peopleIn(ada.auth, list.id)).filter((p) => p.fullName === 'Bo');
    expect(bos.length).toBe(1);
    expect(bos[0].selfUserId).toBe(bo.id);
    // Claimed, not taken: Ada still owns the entry she created.
    expect(bos[0].isMine).toBe(true);
  });

  it('keeps one card across several lists, and re-accepting adds nothing', async () => {
    const { ada, bo } = await twoUsers();
    const first = await listWithInvite(ada.auth);
    const second = await listWithInvite(ada.auth);

    await api.post(`/invites/${first.invite.token}/accept`).set('Authorization', bo.auth);
    await api.post(`/invites/${second.invite.token}/accept`).set('Authorization', bo.auth);
    await api.post(`/invites/${first.invite.token}/accept`).set('Authorization', bo.auth);

    const cards = await Person.find({ selfUser: bo.id });
    expect(cards.length).toBe(1);
    expect(cards[0].lists.map((l) => l.toString()).sort()).toEqual(
      [first.list.id, second.list.id].sort(),
    );
  });

  it("lets only the person themselves change their own name, date, or sharing", async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    const card = (await peopleIn(ada.auth, list.id)).find((p) => p.selfUserId === bo.id)!;

    expect(
      (await api.patch(`/people/${card.id}`).set('Authorization', ada.auth).send({ fullName: 'Bob' }))
        .status,
    ).toBe(403);
    expect(
      (
        await api
          .patch(`/people/${card.id}`)
          .set('Authorization', ada.auth)
          .send({ dob: { month: 1, day: 1 } })
      ).status,
    ).toBe(403);
    expect((await api.delete(`/people/${card.id}`).set('Authorization', ada.auth)).status).toBe(403);

    // Everything else about the entry stays open to the whole list (FR-43/45).
    expect(
      (
        await api
          .patch(`/people/${card.id}`)
          .set('Authorization', ada.auth)
          .send({ relationshipTag: 'Cousin' })
      ).status,
    ).toBe(200);
  });

  it('follows the account: renaming or re-dating the profile updates the shared card', async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    await api
      .patch('/me')
      .set('Authorization', bo.auth)
      .send({ name: 'Bo Turner', birthday: { month: 5, day: 2, year: 1991 } });

    const card = (await peopleIn(ada.auth, list.id)).find((p) => p.selfUserId === bo.id)!;
    const full = (await api.get(`/people/${card.id}`).set('Authorization', ada.auth)).body;
    expect(full.person.fullName).toBe('Bo Turner');
    expect(full.person.dob).toEqual({ month: 5, day: 2, year: 1991 });
    // The birthday event moved with it, so Ada is reminded on the new date.
    expect(full.events.find((e: { type: string }) => e.type === 'birthday').date).toEqual({
      month: 5,
      day: 2,
      year: 1991,
    });
  });

  it('backfills into lists you already belong to when you add a birthday later', async () => {
    const ada = await signUp(api, { name: 'Ada', birthday: ADA_BIRTHDAY });
    const late = await signUp(api, { name: 'Late', birthday: { month: 2, day: 2 } });
    // Simulate an account that predates the feature.
    await api.patch('/me').set('Authorization', late.auth).send({ birthday: null });

    const { list, invite } = await listWithInvite(ada.auth);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', late.auth);
    expect((await peopleIn(ada.auth, list.id)).some((p) => p.selfUserId === late.id)).toBe(false);

    await api.patch('/me').set('Authorization', late.auth).send({ birthday: { month: 8, day: 9 } });
    expect((await peopleIn(ada.auth, list.id)).some((p) => p.selfUserId === late.id)).toBe(true);

    // Clearing it takes the card back out again.
    await api.patch('/me').set('Authorization', late.auth).send({ birthday: null });
    expect((await peopleIn(ada.auth, list.id)).some((p) => p.selfUserId === late.id)).toBe(false);
  });

  it('marks who joined and when, and carries every member\'s birthday on the list', async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);

    const view = (await api.get(`/lists/${list.id}`).set('Authorization', ada.auth)).body.list;
    const owner = view.members.find((m: { isOwner: boolean }) => m.isOwner);
    const member = view.members.find((m: { id: string }) => m.id === bo.id);
    expect(owner.birthday).toEqual(ADA_BIRTHDAY);
    expect(member.birthday).toEqual(BO_BIRTHDAY);
    expect(Date.parse(member.joinedAt)).toBeGreaterThan(0);
  });

  // --- catch-up: what lands in my calendar ---------------------------------

  it('scopes ?list= to that list, and 404s a list you are not in', async () => {
    const { ada, bo } = await twoUsers();
    const { list } = await listWithInvite(ada.auth, ['Mom', 'Dad']);
    await api.post('/people').set('Authorization', ada.auth).send({
      fullName: 'Private Friend',
      dob: { month: 4, day: 4 },
    });

    const scoped = await peopleIn(ada.auth, list.id);
    expect(scoped.map((p) => p.fullName).sort()).toEqual(['Ada', 'Dad', 'Mom']);

    expect((await api.get(`/people?list=${list.id}`).set('Authorization', bo.auth)).status).toBe(404);
  });

  it('takes people out of my calendar and puts them back, without hiding them', async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth, ['Mom', 'Dad', 'Gran']);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    // Mom, Dad, Gran + Ada's card; Bo's own card is excluded from his own feed.
    expect(await reminderCount(bo.id)).toBe(4);

    const shared = await peopleIn(bo.auth, list.id);
    const drop = shared.filter((p) => ['Dad', 'Gran'].includes(p.fullName)).map((p) => p.id);

    const res = await api
      .post('/me/calendar-people')
      .set('Authorization', bo.auth)
      .send({ remove: drop });
    expect(res.status).toBe(200);
    // Bo's own card was already excluded, so it comes back in the authoritative set.
    expect(res.body.excludedPersonIds.length).toBe(3);
    expect(await reminderCount(bo.id)).toBe(2);

    // Still visible in the list - you have to see someone to put them back.
    const after = await peopleIn(bo.auth, list.id);
    expect(after.filter((p) => !p.inMyCalendar).map((p) => p.fullName).sort()).toEqual([
      'Bo',
      'Dad',
      'Gran',
    ]);
    // ...but out of the calendar surfaces.
    const upcoming = (await api.get('/upcoming').set('Authorization', bo.auth)).body.items as {
      fullName: string;
    }[];
    expect(upcoming.some((i) => i.fullName === 'Dad')).toBe(false);
    const grid = (await api.get('/calendar/events').set('Authorization', bo.auth)).body.events as {
      fullName: string;
    }[];
    expect(grid.some((e) => e.fullName === 'Gran')).toBe(false);

    // Putting one back restores their reminder.
    await api
      .post('/me/calendar-people')
      .set('Authorization', bo.auth)
      .send({ add: [drop[0]] });
    expect(await reminderCount(bo.id)).toBe(3);

    // ...and it's personal: Ada's own calendar never moved.
    expect(await reminderCount(ada.id)).toBe(4); // Mom, Dad, Gran + Bo's card
  });

  it('ignores ids it cannot see and rejects a contradictory request', async () => {
    const { ada, bo } = await twoUsers();
    const hidden = (
      await api
        .post('/people')
        .set('Authorization', ada.auth)
        .send({ fullName: 'Not Yours', dob: { month: 4, day: 4 } })
    ).body.person;

    const res = await api
      .post('/me/calendar-people')
      .set('Authorization', bo.auth)
      .send({ remove: [hidden.id, '0'.repeat(24)] });
    expect(res.status).toBe(200);
    expect(res.body.excludedPersonIds).toEqual([]);

    expect(
      (
        await api
          .post('/me/calendar-people')
          .set('Authorization', bo.auth)
          .send({ add: [hidden.id], remove: [hidden.id] })
      ).status,
    ).toBe(400);
    expect(
      (await api.post('/me/calendar-people').set('Authorization', bo.auth).send({})).status,
    ).toBe(400);
  });

  it('keeps an excluded person out of the subscribable calendar feed', async () => {
    const { ada, bo } = await twoUsers();
    const { list, invite } = await listWithInvite(ada.auth, ['Mom']);
    await api.post(`/invites/${invite.token}/accept`).set('Authorization', bo.auth);
    await api
      .patch('/me/calendar')
      .set('Authorization', bo.auth)
      .send({ enabled: true, includePersonal: true, lists: [list.id] });

    const feedUrl = (await api.get('/me/calendar').set('Authorization', bo.auth)).body
      .feedUrl as string;
    const path = new URL(feedUrl).pathname;
    expect((await api.get(path)).text).toContain('Mom');

    const mom = (await peopleIn(bo.auth, list.id)).find((p) => p.fullName === 'Mom')!;
    await api.post('/me/calendar-people').set('Authorization', bo.auth).send({ remove: [mom.id] });
    expect((await api.get(path)).text).not.toContain('Mom');
  });
});
