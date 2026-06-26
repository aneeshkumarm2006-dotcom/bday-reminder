import { beforeEach, describe, expect, it } from 'vitest';

import { Note } from '../../src/models/Note';
import { Reminder } from '../../src/models/Reminder';
import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * People & Birthdays (Stage 3; FR-5/8/9/12/13/14/15). Mirrors
 * scripts/smoke-people.ts: create with/without a year, impossible-date guard,
 * pets, owner-scoped list with tag/sort, ownership on read, DOB-syncs-birthday
 * on patch, and the delete cascade across events + reminders + notes.
 */
describe('people & birthdays (FR-5/8/9/12/13/14/15)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  it('POST /people with a year → 201, auto birthday event, returns the person id', async () => {
    const u = await signUp(api);
    const { status, body } = await addPerson(api, u.auth, {
      fullName: 'Emma Carter',
      dob: { month: 6, day: 22, year: 1996 },
      relationshipTag: 'Family',
    });
    expect(status).toBe(201);
    expect(body.person.id).toBeTruthy();
    expect(body.person.fullName).toBe('Emma Carter');
    expect(body.person.dob.year).toBe(1996);
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events[0].type).toBe('birthday');
    expect(body.events[0].date.month).toBe(6);
    expect(body.events[0].date.day).toBe(22);
  });

  it('POST /people without a year → 201 (year optional, serialized null)', async () => {
    const u = await signUp(api);
    const { status, body } = await addPerson(api, u.auth, {
      fullName: 'Daniel',
      dob: { month: 12, day: 5 },
      relationshipTag: 'Friend',
    });
    expect(status).toBe(201);
    expect(body.person.dob.year).toBeNull();
  });

  it('POST /people with an impossible date (Apr 31) → 400', async () => {
    const u = await signUp(api);
    const { status } = await addPerson(api, u.auth, {
      fullName: 'Bad Date',
      dob: { month: 4, day: 31 },
    });
    expect(status).toBe(400);
  });

  it('POST /people type "pet" → 201 and serialized type is pet', async () => {
    const u = await signUp(api);
    const { status, body } = await addPerson(api, u.auth, {
      fullName: 'Biscuit',
      type: 'pet',
      dob: { month: 3, day: 9 },
    });
    expect(status).toBe(201);
    expect(body.person.type).toBe('pet');
  });

  it('POST /people without a token → 401', async () => {
    const res = await api.post('/people').send({ fullName: 'X', dob: { month: 1, day: 1 } });
    expect(res.status).toBe(401);
  });

  it('GET /people returns { people: [...] } scoped to the owner', async () => {
    const owner = await signUp(api);
    const other = await signUp(api);
    await addPerson(api, owner.auth, { fullName: 'Mine', dob: { month: 6, day: 22 } });
    await addPerson(api, other.auth, { fullName: 'Theirs', dob: { month: 1, day: 1 } });

    const res = await api.get('/people').set('Authorization', owner.auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.people)).toBe(true);
    expect(res.body.people).toHaveLength(1);
    expect(res.body.people[0].fullName).toBe('Mine');
  });

  it('GET /people?tag= filters by relationship tag', async () => {
    const u = await signUp(api);
    await addPerson(api, u.auth, { fullName: 'Emma Carter', dob: { month: 6, day: 22 }, relationshipTag: 'Family' });
    await addPerson(api, u.auth, { fullName: 'Daniel', dob: { month: 12, day: 5 }, relationshipTag: 'Friend' });

    const res = await api.get('/people?tag=Family').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.people).toHaveLength(1);
    expect(res.body.people[0].fullName).toBe('Emma Carter');
  });

  it('GET /people?sort=next orders ascending by soonest occurrence (default)', async () => {
    const u = await signUp(api);
    await addPerson(api, u.auth, { fullName: 'A', dob: { month: 1, day: 1 } });
    await addPerson(api, u.auth, { fullName: 'B', dob: { month: 6, day: 22 } });
    await addPerson(api, u.auth, { fullName: 'C', dob: { month: 12, day: 5 } });

    const res = await api.get('/people?sort=next').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    const days = res.body.people.map((p: { next: { daysRemaining: number } | null }) =>
      p.next ? p.next.daysRemaining : Number.POSITIVE_INFINITY,
    );
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i - 1]).toBeLessThanOrEqual(days[i]);
    }
  });

  it('GET /people?sort=name orders alphabetically by fullName', async () => {
    const u = await signUp(api);
    await addPerson(api, u.auth, { fullName: 'Charlie', dob: { month: 1, day: 1 } });
    await addPerson(api, u.auth, { fullName: 'Alice', dob: { month: 6, day: 22 } });
    await addPerson(api, u.auth, { fullName: 'Bob', dob: { month: 12, day: 5 } });

    const res = await api.get('/people?sort=name').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.people.map((p: { fullName: string }) => p.fullName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('GET /people/:id → 200 for the owner with the person + events', async () => {
    const u = await signUp(api);
    const created = await addPerson(api, u.auth, { fullName: 'Emma Carter', dob: { month: 6, day: 22, year: 1996 } });
    const id = created.body.person.id;

    const res = await api.get(`/people/${id}`).set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.person.id).toBe(id);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].type).toBe('birthday');
  });

  it('GET /people/:id → 403 for a different user', async () => {
    const owner = await signUp(api);
    const other = await signUp(api);
    const created = await addPerson(api, owner.auth, { fullName: 'Emma Carter', dob: { month: 6, day: 22 } });
    const id = created.body.person.id;

    const res = await api.get(`/people/${id}`).set('Authorization', other.auth);
    expect(res.status).toBe(403);
  });

  it('GET /people/:id → 404 for a random valid ObjectId', async () => {
    const u = await signUp(api);
    const res = await api.get('/people/64b000000000000000000000').set('Authorization', u.auth);
    expect(res.status).toBe(404);
  });

  it('PATCH /people/:id updates fields and syncs the birthday event date', async () => {
    const u = await signUp(api);
    const created = await addPerson(api, u.auth, { fullName: 'Emma Carter', dob: { month: 6, day: 22, year: 1996 } });
    const id = created.body.person.id;

    const res = await api
      .patch(`/people/${id}`)
      .set('Authorization', u.auth)
      .send({ fullName: 'Emma C', dob: { month: 7, day: 1, year: 1996 } });
    expect(res.status).toBe(200);
    expect(res.body.person.fullName).toBe('Emma C');
    expect(res.body.person.dob.month).toBe(7);
    expect(res.body.person.dob.day).toBe(1);
    // The birthday event mirrors the new DOB.
    const birthday = res.body.events.find((e: { type: string }) => e.type === 'birthday');
    expect(birthday.date.month).toBe(7);
    expect(birthday.date.day).toBe(1);
  });

  it('PATCH /people/:id rejects an unknown field with 400 (strict body)', async () => {
    const u = await signUp(api);
    const created = await addPerson(api, u.auth, { fullName: 'Emma', dob: { month: 6, day: 22 } });
    const res = await api
      .patch(`/people/${created.body.person.id}`)
      .set('Authorization', u.auth)
      .send({ nope: true });
    expect(res.status).toBe(400);
  });

  it('DELETE /people/:id → 204 and cascades its events, reminders, and notes', async () => {
    const u = await signUp(api);
    const created = await addPerson(api, u.auth, { fullName: 'Emma Carter', dob: { month: 6, day: 22, year: 1996 } });
    const id = created.body.person.id;
    const eventIds: string[] = created.body.events.map((e: { id: string }) => e.id);

    // Add a note so we can assert it cascades too.
    const noteRes = await api
      .post(`/people/${id}/notes`)
      .set('Authorization', u.auth)
      .send({ text: 'Wants a new bike' });
    expect(noteRes.status).toBe(201);

    // Reminders are generated for the owner on create; confirm there is something to cascade.
    const remindersBefore = await Reminder.countDocuments({ event: { $in: eventIds } });
    expect(remindersBefore).toBeGreaterThan(0);
    const notesBefore = await Note.countDocuments({ person: id });
    expect(notesBefore).toBe(1);

    const del = await api.delete(`/people/${id}`).set('Authorization', u.auth);
    expect(del.status).toBe(204);

    // Person is gone.
    const after = await api.get(`/people/${id}`).set('Authorization', u.auth);
    expect(after.status).toBe(404);

    // Its events, reminders, and notes are all gone.
    expect(await Reminder.countDocuments({ event: { $in: eventIds } })).toBe(0);
    expect(await Note.countDocuments({ person: id })).toBe(0);

    // The event no longer appears in the upcoming feed.
    const upcoming = await api.get('/upcoming').set('Authorization', u.auth);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.items.some((i: { personId: string }) => i.personId === id)).toBe(false);
  });

  it('DELETE /people/:id → 403 for a different user', async () => {
    const owner = await signUp(api);
    const other = await signUp(api);
    const created = await addPerson(api, owner.auth, { fullName: 'Emma', dob: { month: 6, day: 22 } });
    const res = await api.delete(`/people/${created.body.person.id}`).set('Authorization', other.auth);
    expect(res.status).toBe(403);
  });
});
