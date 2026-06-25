import { beforeEach, describe, expect, it } from 'vitest';

import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * GET /upcoming - the computed Upcoming feed (Stage 3, FR-9/13/14, §8.2).
 * Mirrors scripts/smoke-people.ts: one item per event occurrence, grouped
 * This week / This month / Later, sorted ascending by days remaining, age only
 * when a birth year is known, distinct relationship tags for the filter chips,
 * and pets carried through with their type.
 *
 * "Today" is resolved in the viewer's timezone (we sign up with UTC so the
 * server's UTC midnight matches our own), letting us assert daysRemaining 0 for
 * a birthday whose month/day is today.
 */
describe('upcoming feed (FR-9/13/14)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  /** Today as observed in UTC (the timezone signUp() uses by default). */
  function utcToday() {
    const now = new Date();
    return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }

  it('requires auth', async () => {
    const res = await api.get('/upcoming');
    expect(res.status).toBe(401);
  });

  it('returns the { today, tags, items } shape with one item per event', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Priya Sharma', dob: { month: 6, day: 22, year: 1996 }, relationshipTag: 'Family' });
    await addPerson(api, u.auth, { fullName: 'Arjun', dob: { month: 12, day: 5 }, relationshipTag: 'Friend' });

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(typeof res.body.today).toBe('string');
    expect(Array.isArray(res.body.tags)).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(2);

    const item = res.body.items[0];
    expect(item).toHaveProperty('personId');
    expect(item).toHaveProperty('eventId');
    expect(item).toHaveProperty('fullName');
    expect(item).toHaveProperty('eventType');
    expect(item).toHaveProperty('daysRemaining');
    expect(item).toHaveProperty('ageTurning');
    expect(item).toHaveProperty('group');
    expect(item).toHaveProperty('occurrenceDate');
  });

  it('shows a birthday-today person with daysRemaining 0 in the This week group', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    const today = utcToday();
    const { body: created } = await addPerson(api, u.auth, {
      fullName: 'Birthday Today',
      dob: { month: today.month, day: today.day, year: 1990 },
      relationshipTag: 'Family',
    });
    const personId = created.person.id;

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: { personId: string }) => i.personId === personId);
    expect(item).toBeTruthy();
    expect(item.daysRemaining).toBe(0);
    expect(item.group).toBe('This week');
    // soonest item → first in ascending order
    expect(res.body.items[0].daysRemaining).toBe(0);
  });

  it('includes ageTurning only when a birth year is known, null otherwise', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    const today = utcToday();
    const withYear = await addPerson(api, u.auth, {
      fullName: 'Has Year',
      dob: { month: today.month, day: today.day, year: 2000 },
    });
    const noYear = await addPerson(api, u.auth, {
      fullName: 'No Year',
      dob: { month: today.month, day: today.day },
    });

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    const withYearItem = res.body.items.find(
      (i: { personId: string }) => i.personId === withYear.body.person.id,
    );
    const noYearItem = res.body.items.find(
      (i: { personId: string }) => i.personId === noYear.body.person.id,
    );

    // The birthday today (occurrence year = this year) turns currentYear - 2000.
    expect(typeof withYearItem.ageTurning).toBe('number');
    expect(withYearItem.ageTurning).toBe(new Date().getUTCFullYear() - 2000);
    expect(noYearItem.ageTurning).toBeNull();
  });

  it('surfaces distinct relationship tags, sorted, for the filter chips', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'A', dob: { month: 1, day: 2 }, relationshipTag: 'Family' });
    await addPerson(api, u.auth, { fullName: 'B', dob: { month: 3, day: 4 }, relationshipTag: 'Friend' });
    await addPerson(api, u.auth, { fullName: 'C', dob: { month: 5, day: 6 }, relationshipTag: 'Family' });
    // No tag → should not contribute to the chip list.
    await addPerson(api, u.auth, { fullName: 'D', dob: { month: 7, day: 8 } });

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['Family', 'Friend']);
  });

  it('represents a pet with type "pet"', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    const { body: created } = await addPerson(api, u.auth, {
      fullName: 'Biscuit',
      type: 'pet',
      dob: { month: 3, day: 9 },
    });

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    const item = res.body.items.find((i: { personId: string }) => i.personId === created.person.id);
    expect(item).toBeTruthy();
    expect(item.type).toBe('pet');
  });

  it('sorts items ascending by next occurrence (days remaining)', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'P1', dob: { month: 1, day: 15 } });
    await addPerson(api, u.auth, { fullName: 'P2', dob: { month: 6, day: 1 } });
    await addPerson(api, u.auth, { fullName: 'P3', dob: { month: 11, day: 30 } });

    const res = await api.get('/upcoming').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    const days: number[] = res.body.items.map((i: { daysRemaining: number }) => i.daysRemaining);
    expect(days.length).toBe(3);
    expect(days.every((d, i) => i === 0 || days[i - 1] <= d)).toBe(true);

    // Grouping is consistent with days remaining.
    for (const i of res.body.items) {
      const expected = i.daysRemaining <= 7 ? 'This week' : i.daysRemaining <= 31 ? 'This month' : 'Later';
      expect(i.group).toBe(expected);
    }
  });
});
