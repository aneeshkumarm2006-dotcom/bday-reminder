/* eslint-disable no-console */
/**
 * End-to-end smoke test for the in-app calendar data endpoint (GET
 * /calendar/events) against an ephemeral MongoDB (mongodb-memory-server) - no
 * Atlas needed. Verifies: auth is required; one entry per event with the RAW
 * stored month/day (not a resolved next-occurrence); a Feb-29 person carries its
 * feb29Rule; anniversaries/custom events appear too; and access is scoped to the
 * caller (another account sees nothing of yours). Also confirms the literal
 * `/calendar/events` path is served as JSON and never treated as a feed token.
 *
 * Run: npm run smoke:calendar
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
  const get = (p: string, t?: string) => req('GET', p, undefined, t);

  type CalEvent = {
    personId: string;
    eventId: string;
    fullName: string;
    eventType: string;
    customName: string | null;
    month: number;
    day: number;
    year: number | null;
    feb29Rule: string;
  };

  try {
    // Two accounts: A owns the data, B is used for access scoping.
    let res = await post('/auth/signup', {
      name: 'Michael',
      email: 'michael@example.com',
      password: 'supersecret',
      timezone: 'America/New_York',
    });
    const tokenA: string = (await res.json()).accessToken;
    res = await post('/auth/signup', { name: 'Mira', email: 'mira@example.com', password: 'supersecret' });
    const tokenB: string = (await res.json()).accessToken;

    // Auth guard
    res = await get('/calendar/events');
    check(res.status === 401, 'GET /calendar/events without token → 401');

    // Person with a known year → auto-creates a birthday event
    res = await post(
      '/people',
      { fullName: 'Emma Carter', dob: { month: 6, day: 22, year: 1996 }, relationshipTag: 'Family' },
      tokenA,
    );
    const emma = await res.json();
    const emmaId: string = emma.person.id;

    // Person without a year
    await post('/people', { fullName: 'Daniel', dob: { month: 12, day: 5 } }, tokenA);

    // Feb-29 person with the Mar-1 observation rule
    await post('/people', { fullName: 'Leap Person', dob: { month: 2, day: 29 }, feb29Rule: 'mar1' }, tokenA);

    // An anniversary event on Emma → calendar shows all event types
    res = await post('/events', { person: emmaId, type: 'anniversary', date: { month: 9, day: 3 } }, tokenA);
    check(res.status === 201, 'create anniversary event → 201');

    // Empty for a fresh account (access scoping)
    res = await get('/calendar/events', tokenB);
    let body = await res.json();
    check(res.status === 200 && Array.isArray(body.events) && body.events.length === 0, "B sees none of A's events");

    // A sees every event with raw month/day
    res = await get('/calendar/events', tokenA);
    body = await res.json();
    const events: CalEvent[] = body.events;
    check(res.status === 200, 'GET /calendar/events → 200');
    check(typeof body.today === 'string', 'response carries server today (tz-anchored)');
    // 3 birthdays + 1 anniversary
    check(events.length === 4, 'one entry per event (3 birthdays + 1 anniversary)');

    const emmaBday = events.find((e) => e.fullName === 'Emma Carter' && e.eventType === 'birthday');
    check(!!emmaBday && emmaBday.month === 6 && emmaBday.day === 22, 'birthday carries raw month/day');
    check(emmaBday?.year === 1996, 'known birth year is returned');

    const daniel = events.find((e) => e.fullName === 'Daniel');
    check(daniel?.year === null, 'unknown birth year → year null');

    const leap = events.find((e) => e.fullName === 'Leap Person');
    check(!!leap && leap.month === 2 && leap.day === 29, 'Feb-29 event keeps its raw Feb-29 date');
    check(leap?.feb29Rule === 'mar1', 'Feb-29 event carries the feb29Rule for grid placement');

    const anniversary = events.find((e) => e.eventType === 'anniversary');
    check(!!anniversary && anniversary.month === 9 && anniversary.day === 3, 'anniversary event appears with its date');

    // The public token feed still works and is NOT shadowed by /calendar/events.
    // An unknown token must 404 (not be treated as the authed events route).
    res = await get('/calendar/some-unknown-token.ics');
    check(res.status === 404, 'unknown ICS token → 404 (public feed route still matches)');

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
