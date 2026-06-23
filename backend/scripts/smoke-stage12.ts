/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Stage 12 cross-cutting hardening against an
 * ephemeral MongoDB (mongodb-memory-server) — no Atlas/Resend/Expo needed.
 * Verifies the "Done when": a security pass, a reliability pass, and the
 * edge-case rules that earlier smokes only partially covered, all with no open
 * criticals.
 *
 * Covers:
 *   Security    — auth rate limiting (429 + Retry-After), malformed ObjectId →
 *                 404 (not 500), malformed JSON body → 400.
 *   Reliability — withRetry backoff (transient retried, permanent not, exhausted
 *                 throws), and per-channel delivery outcome persisted on dispatch.
 *   Edge §10    — Rule 3 Feb-29 (feb28/feb29only/mar1) across non-leap + leap;
 *                 Rule 2 DOB edit regenerates pending to the new date while a
 *                 sent reminder keeps its old occurrence (history preserved);
 *                 Rule 6 timezone travel re-anchors pending scheduledFor but not
 *                 sent history.
 *
 * Run: npm run smoke:stage12
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.REMINDER_JOBS_ENABLED = 'false';
  // Turn rate limiting ON in this test (off by default under NODE_ENV=test) and
  // use a small auth cap so the burst trips quickly; keep the global cap high so
  // the rest of the smoke's traffic is never throttled.
  process.env.RATE_LIMIT_ENABLED = 'true';
  process.env.AUTH_RATE_LIMIT_MAX = '5';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = String(15 * 60 * 1000);
  process.env.GLOBAL_RATE_LIMIT_MAX = '100000';
  process.env.GLOBAL_RATE_LIMIT_WINDOW_MS = String(60 * 1000);

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchDue } = await import('../src/jobs/reminder-engine');
  const { withRetry, TransientError } = await import('../src/lib/retry');
  const { nextOccurrence } = await import('../src/lib/dates');
  const { Reminder } = await import('../src/models/Reminder');
  const { Event } = await import('../src/models/Event');

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

  const signup = async (name: string, email: string, timezone = 'UTC'): Promise<string> => {
    const res = await post('/auth/signup', { name, email, password: 'supersecret', timezone });
    if (res.status !== 201) throw new Error(`signup ${email} → ${res.status}`);
    return (await res.json()).accessToken as string;
  };

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  const ymd = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;

  try {
    // ========================================================================
    // SECURITY
    // ========================================================================

    // --- Auth rate limiting (brute-force defense) --------------------------
    // Burst bad logins for a nonexistent user: the first AUTH_RATE_LIMIT_MAX (5)
    // reach the handler (401), the next is throttled (429) with a Retry-After.
    // Send a browser Origin so we can also assert the 429 carries CORS headers
    // (the limiter is mounted AFTER cors, so a throttled browser client can still
    // read the friendly message).
    const WEBSITE_ORIGIN = 'http://localhost:3000';
    const loginBurst = (i: number) =>
      fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: WEBSITE_ORIGIN },
        body: JSON.stringify({ email: `nobody${i}@example.com`, password: 'whatever' }),
      });
    let throttled: Response | null = null;
    let unthrottled = 0;
    for (let i = 0; i < 7; i++) {
      const r = await loginBurst(i);
      if (r.status === 429) {
        throttled = r;
        break;
      }
      if (r.status === 401) unthrottled += 1;
    }
    check(unthrottled === 5, `first 5 login attempts reach the handler (401) (got ${unthrottled})`);
    check(throttled !== null && throttled.status === 429, 'the 6th login attempt is rate-limited → 429');
    check(throttled?.headers.get('retry-after') != null, '429 carries a Retry-After header');
    check(
      throttled?.headers.get('access-control-allow-origin') === WEBSITE_ORIGIN,
      '429 still carries CORS headers so a browser client can read it (cors before the limiter)',
    );
    check(
      (await throttled!.json()).code === 'rate_limited',
      '429 body uses the rate_limited error code',
    );

    // The signup limiter is an independent counter, so signups still work after
    // the login limiter is tripped (a login burst can't lock out registration).
    const tokenSec = await signup('Sec User', 'sec@example.com');
    check(typeof tokenSec === 'string', 'signup still works after the login limiter trips (independent counter)');

    // --- Malformed ObjectId → 404, not a 500 (CastError mapped) -------------
    let res = await get('/people/not-a-valid-id', tokenSec);
    check(res.status === 404, 'GET /people/<malformed id> → 404 (CastError mapped, not 500)');
    check((await res.json()).code === 'not_found', 'malformed-id response uses the not_found code');

    // --- Malformed JSON body → 400, not a 500 ------------------------------
    res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is not valid json',
    });
    check(res.status === 400, 'unparseable JSON body → 400 (not 500)');
    check((await res.json()).code === 'bad_request', 'bad-JSON response uses the bad_request code');

    // --- Protected route still rejects a missing token (auth coverage) ------
    res = await get('/people');
    check(res.status === 401, 'a protected route without a token → 401');

    // ========================================================================
    // RELIABILITY
    // ========================================================================

    // --- withRetry: bounded backoff classifies transient vs permanent -------
    const noSleep = async () => {};

    let calls = 0;
    const okAfterTwo = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new TransientError('flaky');
        return 'ok';
      },
      { attempts: 3, sleep: noSleep },
    );
    check(okAfterTwo === 'ok' && calls === 3, 'withRetry retries a transient failure then succeeds (3 attempts)');

    calls = 0;
    let permanentThrew = false;
    try {
      await withRetry(
        async () => {
          calls += 1;
          throw new Error('permanent 4xx');
        },
        { attempts: 3, sleep: noSleep },
      );
    } catch {
      permanentThrew = true;
    }
    check(permanentThrew && calls === 1, 'withRetry does NOT retry a permanent (non-transient) error');

    calls = 0;
    let exhausted = false;
    try {
      await withRetry(
        async () => {
          calls += 1;
          throw new TransientError('always flaky');
        },
        { attempts: 3, sleep: noSleep },
      );
    } catch {
      exhausted = true;
    }
    check(exhausted && calls === 3, 'withRetry gives up after the attempt budget on a persistent transient failure');

    // --- Delivery outcome persisted on dispatch (observability) -------------
    // A user with the reminder time at 00:00 so a born-today reminder is due now.
    const tokenDel = await signup('Del User', 'del@example.com');
    await patch('/me', { defaultReminderTime: '00:00' }, tokenDel);
    res = await post('/people', { fullName: 'Due Today', dob: { ...md(todayUTC), year: 1990 } }, tokenDel);
    check(res.status === 201, 'create a born-today person for the delivery test → 201');
    const delUserId: string = (await (await get('/me', tokenDel)).json()).id;

    const summary = await dispatchDue(new Date());
    check(summary.sent >= 1, 'dispatch fires the due reminder');
    const delivered = await Reminder.findOne({ user: delUserId, status: 'sent' });
    check(!!delivered?.deliveryAttemptedAt, 'a dispatched reminder records deliveryAttemptedAt');
    check(
      Array.isArray(delivered?.deliveryResults) &&
        delivered!.deliveryResults!.some((r) => r.channel === 'inApp' && r.outcome === 'sent'),
      'delivery results persist the in-app channel as sent',
    );
    check(
      delivered?.externalDeliveryFailed === false,
      'externalDeliveryFailed is false when external channels are skipped (no keys), never lost',
    );

    // ========================================================================
    // EDGE CASES & BUSINESS RULES (§10)
    // ========================================================================

    // --- Rule 3: Feb-29 per-person rule across non-leap AND leap years ------
    const fromNonLeap = new Date(Date.UTC(2026, 0, 1)); // 2026 is NOT a leap year
    const fromLeap = new Date(Date.UTC(2028, 0, 1)); // 2028 IS a leap year

    check(ymd(nextOccurrence(2, 29, 'feb28', fromNonLeap)) === '2026-2-28', 'Feb-29 feb28 rule → Feb 28 in a non-leap year');
    check(ymd(nextOccurrence(2, 29, 'mar1', fromNonLeap)) === '2026-3-1', 'Feb-29 mar1 rule → Mar 1 in a non-leap year');
    check(
      ymd(nextOccurrence(2, 29, 'feb29only', fromNonLeap)) === '2028-2-29',
      'Feb-29 feb29only rule skips non-leap years → next real Feb 29 (2028)',
    );
    check(ymd(nextOccurrence(2, 29, 'feb28', fromLeap)) === '2028-2-29', 'Feb-29 feb28 rule → real Feb 29 in a leap year');
    check(ymd(nextOccurrence(2, 29, 'mar1', fromLeap)) === '2028-2-29', 'Feb-29 mar1 rule → real Feb 29 in a leap year');
    check(ymd(nextOccurrence(2, 29, 'feb29only', fromLeap)) === '2028-2-29', 'Feb-29 feb29only rule → real Feb 29 in a leap year');

    // --- Rule 2: editing DOB regenerates future reminders, preserves history -
    const tokenDob = await signup('Dob User', 'dob@example.com');
    await patch('/me', { defaultReminderTime: '00:00' }, tokenDob);
    res = await post('/people', { fullName: 'Birthday Mover', dob: { ...md(todayUTC), year: 1990 } }, tokenDob);
    const moverId: string = (await res.json()).person.id;
    const dobUserId: string = (await (await get('/me', tokenDob)).json()).id;

    // Dispatch so today's day-0 reminder becomes sent history.
    await dispatchDue(new Date());
    const sentBefore = await Reminder.findOne({ user: dobUserId, status: 'sent' });
    check(!!sentBefore, 'the born-today reminder dispatched to sent (history)');
    const oldOccurrenceMs = sentBefore!.occurrenceDate.getTime();
    check(oldOccurrenceMs === todayUTC.getTime(), 'the sent reminder is anchored to today (the old occurrence)');

    // Move the DOB to 20 days out.
    const newDob = plusDays(todayUTC, 20);
    res = await patch(`/people/${moverId}`, { dob: { ...md(newDob), year: 1990 } }, tokenDob);
    check(res.status === 200, 'PATCH DOB to a future date → 200');

    const birthdayEvent = await Event.findOne({ person: moverId, type: 'birthday' });
    // History: the sent reminder still exists at its OLD occurrence date.
    const sentAfter = await Reminder.findOne({ event: birthdayEvent!._id, status: 'sent' });
    check(
      !!sentAfter && sentAfter.occurrenceDate.getTime() === oldOccurrenceMs,
      'editing the DOB preserves the sent reminder at its original occurrence (history intact)',
    );
    // Regeneration: a fresh pending reminder now points at the NEW occurrence.
    const pendingAfter = await Reminder.find({ event: birthdayEvent!._id, status: 'pending' });
    check(pendingAfter.length > 0, 'editing the DOB regenerates pending reminders');
    check(
      pendingAfter.every((r) => r.occurrenceDate.getTime() === newDob.getTime()),
      'regenerated pending reminders all point at the new occurrence date',
    );
    check(
      !pendingAfter.some((r) => r.occurrenceDate.getTime() === oldOccurrenceMs),
      'no stale pending reminder remains at the old occurrence date',
    );

    // --- Rule 6: timezone travel re-anchors pending, not history ------------
    // User in UTC, default 09:00 reminder time. A future person → pending; a
    // born-today person dispatched → sent.
    const tokenTz = await signup('Tz User', 'tz@example.com', 'UTC');

    const futureDay = plusDays(todayUTC, 20);
    res = await post('/people', { fullName: 'Future Friend', dob: { ...md(futureDay), year: 1992 } }, tokenTz);
    const futureEventId = (await Event.findOne({ person: (await res.json()).person.id, type: 'birthday' }))!._id;

    res = await post('/people', { fullName: 'Today Friend', dob: { ...md(todayUTC), year: 1992 } }, tokenTz);
    const todayEventId = (await Event.findOne({ person: (await res.json()).person.id, type: 'birthday' }))!._id;

    // Mark today's reminder sent using an explicit dispatch instant after 09:00Z.
    await dispatchDue(new Date(todayUTC.getTime() + 23 * MS_PER_HOUR));
    const tzSentBefore = await Reminder.findOne({ event: todayEventId, status: 'sent' });
    check(!!tzSentBefore, "today's reminder dispatched to sent for the timezone test");
    const sentScheduledBefore = tzSentBefore!.scheduledFor.getTime();

    const futurePendingBefore = await Reminder.findOne({ event: futureEventId, status: 'pending', leadDays: 0 });
    check(!!futurePendingBefore, 'the future person has a pending day-0 reminder');
    const futureScheduledBefore = futurePendingBefore!.scheduledFor.getTime();

    // Travel: UTC → Asia/Kolkata (UTC+5:30). 09:00 IST = 03:30 UTC, so the
    // pending fire-instant should move 5h30m EARLIER.
    res = await patch('/me', { timezone: 'Asia/Kolkata' }, tokenTz);
    check(res.status === 200, 'PATCH /me timezone (travel) → 200');
    // The route already regenerated pending reminders against the new zone.

    const futurePendingAfter = await Reminder.findOne({ event: futureEventId, status: 'pending', leadDays: 0 });
    check(!!futurePendingAfter, 'the future pending reminder still exists after travel');
    const shift = futureScheduledBefore - futurePendingAfter!.scheduledFor.getTime();
    check(
      Math.abs(shift - 5.5 * MS_PER_HOUR) < 1000,
      `pending reminder re-anchors to the new local time (moved ${shift / MS_PER_HOUR}h, expected 5.5h)`,
    );

    const tzSentAfter = await Reminder.findOne({ event: todayEventId, status: 'sent' });
    check(
      !!tzSentAfter && tzSentAfter.scheduledFor.getTime() === sentScheduledBefore,
      'the already-sent reminder is NOT re-anchored by a timezone change (history preserved)',
    );

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
