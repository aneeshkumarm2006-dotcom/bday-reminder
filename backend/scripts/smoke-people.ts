/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Stage 3 People & Birthdays slice against an
 * ephemeral MongoDB (mongodb-memory-server) - no Atlas needed. Verifies the
 * "Done when": add people with/without a birth year, see them grouped + sorted
 * in /upcoming (age only when the year is known), open/edit/delete the profile,
 * the DOB edit syncs the birthday event, deletes cascade, and ownership holds.
 *
 * Run: npm run smoke:people
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');

  await connectDb(process.env.MONGODB_URI);
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const passed: string[] = [];
  function check(condition: boolean, label: string): void {
    if (!condition) throw new Error(`FAIL: ${label}`);
    passed.push(label);
  }

  const req = (method: string, path: string, body?: unknown, token?: string) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  const post = (p: string, b?: unknown, t?: string) => req('POST', p, b, t);
  const patch = (p: string, b: unknown, t: string) => req('PATCH', p, b, t);
  const get = (p: string, t?: string) => req('GET', p, undefined, t);
  const del = (p: string, t: string) => req('DELETE', p, undefined, t);

  try {
    // Two accounts: A owns the data, B is used for ownership checks.
    let res = await post('/auth/signup', {
      name: 'Michael',
      email: 'michael@example.com',
      password: 'supersecret',
      timezone: 'Asia/Kolkata',
    });
    let body = await res.json();
    const tokenA: string = body.accessToken;
    res = await post('/auth/signup', { name: 'Mira', email: 'mira@example.com', password: 'supersecret' });
    const tokenB: string = (await res.json()).accessToken;

    // Auth guard
    res = await post('/people', { fullName: 'X', dob: { month: 1, day: 1 } });
    check(res.status === 401, 'POST /people without token → 401');

    // Create with a known year → auto-creates the birthday event
    res = await post(
      '/people',
      { fullName: 'Emma Carter', dob: { month: 6, day: 22, year: 1996 }, relationshipTag: 'Family' },
      tokenA,
    );
    body = await res.json();
    check(res.status === 201, 'create person → 201');
    check(body.person?.fullName === 'Emma Carter', 'create returns the person');
    check(body.person?.dob?.year === 1996, 'create stores the birth year');
    check(
      Array.isArray(body.events) && body.events[0]?.type === 'birthday',
      'create auto-adds a birthday event',
    );
    check(
      body.events[0]?.date?.month === 6 && body.events[0]?.date?.day === 22,
      'birthday event mirrors the DOB',
    );
    const emmaId: string = body.person.id;

    // Invalid date (Apr 31 doesn't exist) → 400
    res = await post('/people', { fullName: 'Bad Date', dob: { month: 4, day: 31 } }, tokenA);
    check(res.status === 400, 'impossible date → 400');

    // Create without a year (age must be omitted later)
    res = await post('/people', { fullName: 'Daniel', dob: { month: 12, day: 5 }, relationshipTag: 'Friend' }, tokenA);
    body = await res.json();
    check(res.status === 201 && body.person?.dob?.year === null, 'create without year → year null');

    // Create a pet
    res = await post('/people', { fullName: 'Biscuit', type: 'pet', dob: { month: 3, day: 9 } }, tokenA);
    body = await res.json();
    check(res.status === 201 && body.person?.type === 'pet', 'create pet → type pet');

    // Create a Feb-29 person with the Mar-1 observation rule
    res = await post('/people', { fullName: 'Leap Person', dob: { month: 2, day: 29 }, feb29Rule: 'mar1' }, tokenA);
    check(res.status === 201, 'create Feb-29 person → 201');

    // List + sort + filter
    res = await get('/people', tokenA);
    body = await res.json();
    check(res.status === 200 && body.people?.length === 4, 'list returns all 4 people');
    const nextDays = body.people.map((p: { next?: { daysRemaining: number } }) => p.next?.daysRemaining ?? Infinity);
    check(
      nextDays.every((d: number, i: number) => i === 0 || nextDays[i - 1] <= d),
      'list is sorted ascending by next occurrence',
    );
    res = await get('/people?tag=Family', tokenA);
    body = await res.json();
    check(
      res.status === 200 && body.people.length === 1 && body.people[0].fullName === 'Emma Carter',
      'list filters by relationship tag',
    );

    // Get one with events
    res = await get(`/people/${emmaId}`, tokenA);
    body = await res.json();
    check(res.status === 200 && body.events?.length === 1, 'get person → person + events');

    // Missing person → 404
    res = await get('/people/64b000000000000000000000', tokenA);
    check(res.status === 404, 'get unknown person → 404');

    // Ownership: B cannot read A's person
    res = await get(`/people/${emmaId}`, tokenB);
    check(res.status === 403, "another user can't read your person → 403");

    // Edit DOB → person + birthday event both update
    res = await patch(`/people/${emmaId}`, { dob: { month: 7, day: 1, year: 1996 } }, tokenA);
    body = await res.json();
    check(
      res.status === 200 && body.person.dob.month === 7 && body.person.dob.day === 1,
      'patch updates the DOB',
    );
    check(
      body.events[0].date.month === 7 && body.events[0].date.day === 1,
      'patch syncs the birthday event to the new DOB',
    );

    // Strict body rejects unknown fields
    res = await patch(`/people/${emmaId}`, { nope: true }, tokenA);
    check(res.status === 400, 'unknown field in patch → 400');

    // Upcoming feed
    res = await get('/upcoming', tokenA);
    body = await res.json();
    check(res.status === 200 && body.items?.length === 4, 'upcoming returns one item per event');
    const days: number[] = body.items.map((i: { daysRemaining: number }) => i.daysRemaining);
    check(
      days.every((d, i) => i === 0 || days[i - 1] <= d),
      'upcoming is sorted ascending by days remaining',
    );
    check(
      body.items.every((i: { daysRemaining: number; group: string }) =>
        i.daysRemaining <= 7
          ? i.group === 'This week'
          : i.daysRemaining <= 31
            ? i.group === 'This month'
            : i.group === 'Later',
      ),
      'upcoming groups match days remaining',
    );
    const emmaItem = body.items.find((i: { personId: string }) => i.personId === emmaId);
    check(typeof emmaItem.ageTurning === 'number', 'age shown when birth year is known');
    const danielItem = body.items.find((i: { fullName: string }) => i.fullName === 'Daniel');
    check(danielItem.ageTurning === null, 'age omitted when birth year is unknown');
    check(Array.isArray(body.tags) && body.tags.includes('Family'), 'upcoming exposes relationship tags');

    // Delete cascades: person gone, its event gone from the feed
    res = await del(`/people/${emmaId}`, tokenA);
    check(res.status === 204, 'delete person → 204');
    res = await get(`/people/${emmaId}`, tokenA);
    check(res.status === 404, 'deleted person → 404');
    res = await get('/upcoming', tokenA);
    body = await res.json();
    check(
      body.items.length === 3 && !body.items.some((i: { personId: string }) => i.personId === emmaId),
      'delete cascades the event out of the feed',
    );

    // Ownership: B cannot delete A's remaining person
    res = await get('/people', tokenA);
    const remainingId: string = (await res.json()).people[0].id;
    res = await del(`/people/${remainingId}`, tokenB);
    check(res.status === 403, "another user can't delete your person → 403");

    passed.forEach((label) => console.log(`  PASS  ${label}`));
    console.log(`\n✅ All ${passed.length} checks passed.`);
  } finally {
    server.close();
    await disconnectDb();
    await mongod.stop();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
