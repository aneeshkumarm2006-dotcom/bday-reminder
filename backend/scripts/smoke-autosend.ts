/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 14 - auto-send birthday email (send a greeting
 * to the friend, AS the user, via their Gmail). Against an ephemeral MongoDB and
 * with the Gmail send STUBBED (no real network). Verifies:
 *   - GET /config advertises the feature; GET /integrations/gmail/connect returns
 *     a Google consent URL whose signed `state` binds to the user + platform.
 *   - Enabling auto-send is guarded: needs a recipient email AND the owner's Gmail.
 *   - The dispatch emails the friend on the birthday, once per year (idempotent),
 *     using the custom message when set and the default copy otherwise.
 *   - A failed send rolls the once-per-year claim back so it retries.
 *   - Disabled / not-today / no-email people are skipped.
 *
 * Run: npm run smoke:autosend
 */
import { randomBytes } from 'node:crypto';

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
  // Configure Gmail auto-send so the connect endpoint + config flag are live. The
  // actual send is injected as a stub below, so no real Google traffic happens.
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GMAIL_TOKEN_ENC_KEY = randomBytes(32).toString('base64');

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchBirthdayGreetings } = await import('../src/jobs/reminder-engine');
  const { verifyState } = await import('../src/lib/google-oauth');
  const { encryptToken } = await import('../src/lib/token-crypto');
  const { User } = await import('../src/models/User');
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

  // Injectable Gmail stubs (record calls, no network).
  type Sent = { to: string; subject: string; text: string; from: string };
  const makeStub = (outcome: 'sent' | 'failed') => {
    const calls: Sent[] = [];
    const send = async (user: { email: string }, msg: { to: string; subject: string; text: string }) => {
      calls.push({ to: msg.to, subject: msg.subject, text: msg.text, from: user.email });
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
    let me = await (await get('/me', token)).json();
    const userId: string = me.id;
    check(me.gmailConnected === false && me.gmailEmail === null, 'GET /me starts with Gmail disconnected');

    // --- Config + connect URL (state binds to user + platform) ----------------
    res = await get('/config');
    check((await res.json()).gmailAutoSendAvailable === true, 'GET /config advertises gmailAutoSendAvailable');

    res = await get('/integrations/gmail/connect', token);
    const connect = await res.json();
    check(
      res.status === 200 &&
        typeof connect.url === 'string' &&
        connect.url.includes('accounts.google.com') &&
        connect.url.includes('gmail.send'),
      'GET /integrations/gmail/connect returns a Google consent URL with the gmail.send scope',
    );
    const stateApp = new URL(connect.url).searchParams.get('state')!;
    const parsedApp = verifyState(stateApp);
    check(parsedApp.userId === userId && parsedApp.platform === 'app', 'connect state binds to the user (platform=app default)');
    const webUrl = (await (await get('/integrations/gmail/connect?platform=web', token)).json()).url;
    check(verifyState(new URL(webUrl).searchParams.get('state')!).platform === 'web', '?platform=web is carried in the state');

    // --- Enabling auto-send is guarded (before Gmail is connected) -------------
    res = await post(
      '/people',
      { fullName: 'No Gmail', dob: { ...md(todayUTC), year: 1990 }, email: 'x@example.com', autoBirthdayEmail: { enabled: true } },
      token,
    );
    check(res.status === 400, 'enabling auto-send without Gmail connected → 400');
    res = await post(
      '/people',
      { fullName: 'No Email', dob: { ...md(todayUTC), year: 1990 }, autoBirthdayEmail: { enabled: true } },
      token,
    );
    check(res.status === 400, 'enabling auto-send without a recipient email → 400');

    // --- Simulate a completed OAuth connect (store an encrypted token) --------
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          gmailIntegration: {
            email: 'ana@gmail.com',
            refreshTokenEnc: encryptToken('fake-refresh-token'),
            connectedAt: new Date(),
          },
        },
      },
    );
    me = await (await get('/me', token)).json();
    check(me.gmailConnected === true && me.gmailEmail === 'ana@gmail.com', 'GET /me reflects the connected Gmail (no token exposed)');

    // --- Create a friend with auto-send on (custom message), birthday today ----
    res = await post(
      '/people',
      {
        fullName: 'Ben Carter',
        dob: { ...md(todayUTC), year: 1991 },
        email: 'Ben@Example.com',
        autoBirthdayEmail: { enabled: true, message: 'Have the best day, buddy!' },
      },
      token,
    );
    check(res.status === 201, 'create friend with auto-send enabled + email + Gmail connected → 201');
    const ben = (await res.json()).person;
    check(
      ben.email === 'ben@example.com' && ben.autoBirthdayEmail.enabled === true && ben.autoBirthdayEmail.message === 'Have the best day, buddy!',
      'serialized person exposes email + autoBirthdayEmail (email lower-cased)',
    );

    // --- Dispatch #1: sends the greeting to the friend, as the user -----------
    const s1 = makeStub('sent');
    let summary = await dispatchBirthdayGreetings(now, { send: s1.send });
    check(summary.sent === 1 && s1.calls.length === 1, 'dispatch sends exactly one greeting');
    check(s1.calls[0].to === 'ben@example.com', 'greeting goes to the friend’s email');
    check(s1.calls[0].subject.includes('Ben'), 'subject is personalised with the first name');
    check(s1.calls[0].text === 'Have the best day, buddy!', 'custom message body is used when set');
    const benDoc = await Person.findById(ben.id);
    check(benDoc?.autoBirthdayEmail?.lastSentYear === thisYear, 'lastSentYear stamped to this year after send');

    // --- Dispatch #2: idempotent - no second send this year -------------------
    const s2 = makeStub('sent');
    summary = await dispatchBirthdayGreetings(now, { send: s2.send });
    check(summary.considered === 0 && s2.calls.length === 0, 'second dispatch is a no-op (once per year)');

    // --- A friend with the DEFAULT message; failed send rolls back the claim --
    res = await post(
      '/people',
      { fullName: 'Cara Diaz', dob: { ...md(todayUTC), year: 1992 }, email: 'cara@example.com', autoBirthdayEmail: { enabled: true } },
      token,
    );
    const cara = (await res.json()).person;
    const sFail = makeStub('failed');
    summary = await dispatchBirthdayGreetings(now, { send: sFail.send });
    check(summary.failed === 1 && summary.sent === 0, 'a failed send is counted, nothing marked sent');
    check(sFail.calls.length === 1 && sFail.calls[0].to === 'cara@example.com', 'only the un-sent friend is attempted (Ben is skipped)');
    check(sFail.calls[0].text.startsWith('Happy birthday, Cara!'), 'default greeting body used when no custom message');
    let caraDoc = await Person.findById(cara.id);
    check(caraDoc?.autoBirthdayEmail?.lastSentYear == null, 'failed send rolls back lastSentYear so it retries');

    // --- Retry succeeds ------------------------------------------------------
    const sRetry = makeStub('sent');
    summary = await dispatchBirthdayGreetings(now, { send: sRetry.send });
    check(summary.sent === 1 && sRetry.calls[0].to === 'cara@example.com', 'the retry sends Cara’s greeting');
    caraDoc = await Person.findById(cara.id);
    check(caraDoc?.autoBirthdayEmail?.lastSentYear === thisYear, 'lastSentYear stamped after the successful retry');

    // --- Skips: disabled today, and enabled-but-not-today ---------------------
    await post(
      '/people',
      { fullName: 'Off Today', dob: { ...md(todayUTC), year: 1990 }, email: 'off@example.com', autoBirthdayEmail: { enabled: false } },
      token,
    );
    await post(
      '/people',
      { fullName: 'Future Friend', dob: { ...md(plusDays(todayUTC, 10)), year: 1990 }, email: 'future@example.com', autoBirthdayEmail: { enabled: true } },
      token,
    );
    const sSkip = makeStub('sent');
    summary = await dispatchBirthdayGreetings(now, { send: sSkip.send });
    check(summary.considered === 0 && sSkip.calls.length === 0, 'disabled + not-today people are skipped');

    // --- PATCH enable on an existing person, then turn it off -----------------
    res = await post('/people', { fullName: 'Dee Kim', dob: { ...md(plusDays(todayUTC, 5)), year: 1990 } }, token);
    const dee = (await res.json()).person;
    res = await patch(`/people/${dee.id}`, { email: 'dee@example.com', autoBirthdayEmail: { enabled: true } }, token);
    check(res.status === 200 && (await res.json()).person.autoBirthdayEmail.enabled === true, 'PATCH enables auto-send on an existing person → 200');
    res = await patch(`/people/${dee.id}`, { autoBirthdayEmail: { enabled: false } }, token);
    check(res.status === 200 && (await res.json()).person.autoBirthdayEmail.enabled === false, 'PATCH can turn auto-send back off');

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
