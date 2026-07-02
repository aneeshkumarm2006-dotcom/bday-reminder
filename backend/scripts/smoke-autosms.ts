/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 15 - auto-send birthday SMS (text a greeting to
 * the friend, signed as the user, via one shared Twilio account). Against an
 * ephemeral MongoDB with the Twilio send STUBBED (no real network). Verifies:
 *   - GET /config advertises `smsAutoSendAvailable`.
 *   - Enabling auto-send SMS is guarded: it needs a recipient phone (no per-user
 *     account, unlike Gmail).
 *   - The dispatch texts the friend on the birthday, once per year (idempotent),
 *     using the custom message when set and the default copy otherwise, to the
 *     stored E.164 number.
 *   - A failed send rolls the once-per-year claim back so it retries.
 *   - A non-E.164 number is skipped (never a churning failure).
 *   - The account-wide monthly cap stops sends once reached.
 *   - Disabled / not-today people are skipped; PATCH toggling preserves lastSentYear.
 *
 * Run: npm run smoke:autosms
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
  process.env.REMINDER_JOBS_ENABLED = 'false';
  // Configure Twilio so twilioConfigured() is true and the config flag is live.
  // The actual send is injected as a stub below, so no real Twilio traffic happens.
  process.env.TWILIO_ACCOUNT_SID = 'ACtest0000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGtest0000000000000000000000000000';
  process.env.TWILIO_MONTHLY_CAP = '5';

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchBirthdaySms } = await import('../src/jobs/reminder-engine');
  const { twilioMonthlyCap, autoSmsPeriod } = await import('../src/lib/auto-sms-usage');
  const { AutoSmsUsage } = await import('../src/models/AutoSmsUsage');
  const { Person } = await import('../src/models/Person');

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

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
  const thisYear = todayUTC.getUTCFullYear();
  const period = autoSmsPeriod(now);
  const cap = twilioMonthlyCap();

  // Injectable Twilio stub (records calls, no network).
  type Texted = { to: string; body: string };
  const makeStub = (outcome: 'sent' | 'failed') => {
    const calls: Texted[] = [];
    const send = async (to: string, body: string) => {
      calls.push({ to, body });
      return { outcome } as { outcome: 'sent' | 'failed' };
    };
    return { calls, send };
  };

  try {
    // --- Signup + UTC/fire-now defaults so "today at 00:00" has already passed --
    let res = await post('/auth/signup', {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'supersecret',
      timezone: 'UTC',
    });
    const token: string = (await res.json()).accessToken;
    await patch('/me', { timezone: 'UTC', defaultReminderTime: '00:00' }, token);

    // --- Config advertises the feature ---------------------------------------
    res = await get('/config');
    check((await res.json()).smsAutoSendAvailable === true, 'GET /config advertises smsAutoSendAvailable');

    // --- Enabling auto-send SMS is guarded (needs a phone) --------------------
    res = await post(
      '/people',
      { fullName: 'No Phone', dob: { ...md(todayUTC), year: 1990 }, autoBirthdaySms: { enabled: true } },
      token,
    );
    check(res.status === 400, 'enabling auto-send SMS without a phone → 400');

    // --- Create a friend with auto-send on (custom message), birthday today ----
    res = await post(
      '/people',
      {
        fullName: 'Ben Carter',
        dob: { ...md(todayUTC), year: 1991 },
        phone: '5551230001',
        autoBirthdaySms: { enabled: true, message: 'Have the best day, buddy!' },
      },
      token,
    );
    check(res.status === 201, 'create friend with auto-send SMS + phone → 201');
    const ben = (await res.json()).person;
    check(
      ben.phone === '+15551230001' &&
        ben.autoBirthdaySms.enabled === true &&
        ben.autoBirthdaySms.message === 'Have the best day, buddy!',
      'serialized person exposes phone (E.164) + autoBirthdaySms',
    );

    // --- Dispatch #1: texts the friend, as the user ---------------------------
    const s1 = makeStub('sent');
    let summary = await dispatchBirthdaySms(now, { send: s1.send });
    check(summary.sent === 1 && s1.calls.length === 1, 'dispatch sends exactly one text');
    check(s1.calls[0].to === '+15551230001', 'text goes to the friend’s E.164 number');
    check(s1.calls[0].body === 'Have the best day, buddy!', 'custom message body is used when set');
    const benDoc = await Person.findById(ben.id);
    check(benDoc?.autoBirthdaySms?.lastSentYear === thisYear, 'lastSentYear stamped to this year after send');

    // --- Dispatch #2: idempotent - no second send this year -------------------
    const s2 = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: s2.send });
    check(summary.considered === 0 && s2.calls.length === 0, 'second dispatch is a no-op (once per year)');

    // --- A friend with the DEFAULT message; failed send rolls back the claim --
    res = await post(
      '/people',
      { fullName: 'Cara Diaz', dob: { ...md(todayUTC), year: 1992 }, phone: '5551230002', autoBirthdaySms: { enabled: true } },
      token,
    );
    const cara = (await res.json()).person;
    const sFail = makeStub('failed');
    summary = await dispatchBirthdaySms(now, { send: sFail.send });
    check(summary.failed === 1 && summary.sent === 0, 'a failed send is counted, nothing marked sent');
    check(sFail.calls.length === 1 && sFail.calls[0].to === '+15551230002', 'only the un-sent friend is attempted (Ben is skipped)');
    check(sFail.calls[0].body.startsWith('Happy birthday, Cara!'), 'default greeting body used when no custom message');
    check(sFail.calls[0].body.includes('- Ana'), 'default body is signed with the sender’s name');
    let caraDoc = await Person.findById(cara.id);
    check(caraDoc?.autoBirthdaySms?.lastSentYear == null, 'failed send rolls back lastSentYear so it retries');

    // --- Retry succeeds ------------------------------------------------------
    const sRetry = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: sRetry.send });
    check(summary.sent === 1 && sRetry.calls[0].to === '+15551230002', 'the retry sends Cara’s text');
    caraDoc = await Person.findById(cara.id);
    check(caraDoc?.autoBirthdaySms?.lastSentYear === thisYear, 'lastSentYear stamped after the successful retry');

    // --- A non-E.164 number is skipped, never a churning failure --------------
    res = await post(
      '/people',
      { fullName: 'Bad Phone', dob: { ...md(todayUTC), year: 1990 }, phone: '12345', autoBirthdaySms: { enabled: true } },
      token,
    );
    const bad = (await res.json()).person;
    check(bad.phone === '12345', 'a non-NANP number is stored as-is (soft normalize)');
    const sBad = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: sBad.send });
    check(sBad.calls.length === 0 && summary.skipped >= 1, 'a non-E.164 number is skipped, stub never called');
    const badDoc = await Person.findById(bad.id);
    check(badDoc?.autoBirthdaySms?.lastSentYear == null, 'a skipped bad number never claims lastSentYear');
    await Person.deleteOne({ _id: bad.id }); // remove so it doesn't skew later counts

    // --- Disabled + not-today people are skipped ------------------------------
    await post(
      '/people',
      { fullName: 'Off Today', dob: { ...md(todayUTC), year: 1990 }, phone: '5551230003', autoBirthdaySms: { enabled: false } },
      token,
    );
    await post(
      '/people',
      { fullName: 'Future Friend', dob: { ...md(plusDays(todayUTC, 10)), year: 1990 }, phone: '5551230004', autoBirthdaySms: { enabled: true } },
      token,
    );
    const sSkip = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: sSkip.send });
    check(summary.considered === 0 && sSkip.calls.length === 0, 'disabled + not-today people are skipped');

    // --- PATCH enable then disable preserves the server-managed lastSentYear ---
    res = await post('/people', { fullName: 'Dee Kim', dob: { ...md(plusDays(todayUTC, 5)), year: 1990 }, phone: '5551230005' }, token);
    const dee = (await res.json()).person;
    res = await patch(`/people/${dee.id}`, { autoBirthdaySms: { enabled: true } }, token);
    check(res.status === 200 && (await res.json()).person.autoBirthdaySms.enabled === true, 'PATCH enables auto-send SMS on an existing person → 200');
    await Person.updateOne({ _id: dee.id }, { $set: { 'autoBirthdaySms.lastSentYear': thisYear } });
    res = await patch(`/people/${dee.id}`, { autoBirthdaySms: { enabled: false } }, token);
    check(res.status === 200 && (await res.json()).person.autoBirthdaySms.enabled === false, 'PATCH can turn auto-send SMS back off');
    const deeDoc = await Person.findById(dee.id);
    check(deeDoc?.autoBirthdaySms?.lastSentYear === thisYear, 'lastSentYear is preserved across an enable→disable toggle');

    // --- Account-wide monthly cap (isolated: reset people + usage) -------------
    await Person.deleteMany({});
    res = await post(
      '/people',
      { fullName: 'Cap Test', dob: { ...md(todayUTC), year: 1990 }, phone: '5551239999', autoBirthdaySms: { enabled: true } },
      token,
    );
    const capPerson = (await res.json()).person;
    // Simulate the account already at the cap for this period.
    await AutoSmsUsage.updateOne({ period }, { $set: { count: cap } }, { upsert: true });
    const sCap = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: sCap.send });
    check(sCap.calls.length === 0 && summary.skipped >= 1, 'at the monthly cap, auto-texts are skipped (not sent)');
    let capDoc = await Person.findById(capPerson.id);
    check(capDoc?.autoBirthdaySms?.lastSentYear == null, 'a capped send never claims lastSentYear');
    // Drop one below the cap → it sends.
    await AutoSmsUsage.updateOne({ period }, { $set: { count: cap - 1 } });
    const sUnder = makeStub('sent');
    summary = await dispatchBirthdaySms(now, { send: sUnder.send });
    check(summary.sent === 1 && sUnder.calls.length === 1, 'below the cap, the auto-text sends');
    capDoc = await Person.findById(capPerson.id);
    check(capDoc?.autoBirthdaySms?.lastSentYear === thisYear, 'a successful send under the cap stamps lastSentYear');

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
