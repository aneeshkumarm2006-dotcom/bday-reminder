/* eslint-disable no-console */
/**
 * Smoke test for the Google Calendar + Contacts bulk import (Stage 16). Against an
 * ephemeral MongoDB, with Google configured but NO real Google traffic (the
 * calendar/contacts fetch needs Google, so we exercise the parts around it). Verifies:
 *   - GET /config advertises googleImportAvailable.
 *   - GOOGLE_IMPORT_SCOPE requests calendar.readonly + contacts.readonly + openid
 *     email and NOT gmail.send (import must not piggyback the send scope).
 *   - GET /integrations/google-import/connect (authed) returns a Google consent URL
 *     with both scopes, access_type=offline, prompt=consent, include_granted_scopes,
 *     and a signed state carrying the user + platform. Unauthed → 401.
 *   - The callback with a bad/missing state 302s to the error return URL (never a
 *     raw JSON error in the browser).
 *   - POST /import/google/preview with no stored connection → 409 not_connected.
 *   - The commit EXTENSION over real HTTP (no Google needed): an `add` item carrying
 *     an email + an anniversary event creates the person with the email AND an
 *     anniversary Event; a `merge` item fills the target's empty email and adds the
 *     missing anniversary without duplicating it.
 *
 * Run: npm run smoke:google-import
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
  // Provision Google import: client id + secret AND the token-encryption key (the
  // import refresh token is stored encrypted, so the feature needs it configured).
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GMAIL_TOKEN_ENC_KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
  process.env.API_PUBLIC_URL = 'http://localhost:4040';
  process.env.WEBSITE_ORIGIN = 'http://localhost:3000';

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { verifyImportState, GOOGLE_IMPORT_SCOPE } = await import('../src/lib/google-oauth');
  const { Person } = await import('../src/models/Person');
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

  let token = '';
  const req = (method: string, path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  const get = (p: string, init?: RequestInit) => req('GET', p, undefined, init);
  const post = (p: string, b?: unknown) => req('POST', p, b);

  try {
    // --- Config advertises the feature -------------------------------------
    let res = await get('/config');
    check((await res.json()).googleImportAvailable === true, 'GET /config advertises googleImportAvailable');

    // --- Scope is calendar + contacts read-only, NOT gmail.send -------------
    check(
      GOOGLE_IMPORT_SCOPE.includes('calendar.readonly') &&
        GOOGLE_IMPORT_SCOPE.includes('contacts.readonly') &&
        GOOGLE_IMPORT_SCOPE.includes('openid') &&
        GOOGLE_IMPORT_SCOPE.includes('email') &&
        !GOOGLE_IMPORT_SCOPE.includes('gmail'),
      'GOOGLE_IMPORT_SCOPE = calendar.readonly + contacts.readonly + openid email (no gmail.send)',
    );

    // --- Sign a user in so we can hit the authed endpoints -----------------
    res = await post('/auth/signup', {
      name: 'Ivy Import',
      email: 'ivy@example.com',
      password: 'supersecret',
    });
    const signup = await res.json();
    check(res.status === 201 && typeof signup.accessToken === 'string', 'signup returns an access token');
    token = signup.accessToken;

    // --- Connect requires auth ---------------------------------------------
    const savedToken = token;
    token = '';
    res = await get('/integrations/google-import/connect?platform=web');
    check(res.status === 401, 'GET /integrations/google-import/connect without auth → 401');
    token = savedToken;

    // --- Connect returns a Google consent URL with the right params --------
    res = await get('/integrations/google-import/connect?platform=web');
    check(res.status === 200, 'GET /integrations/google-import/connect (authed) → 200');
    const { url } = (await res.json()) as { url: string };
    const consent = new URL(url);
    check(consent.hostname === 'accounts.google.com', 'connect returns a Google consent URL');
    const scope = consent.searchParams.get('scope') ?? '';
    check(
      scope.includes('calendar.readonly') && scope.includes('contacts.readonly') && !scope.includes('gmail'),
      'consent URL requests calendar + contacts read-only (never gmail.send)',
    );
    check(consent.searchParams.get('access_type') === 'offline', 'consent URL uses access_type=offline (for a refresh token)');
    check(consent.searchParams.get('prompt') === 'consent', 'consent URL uses prompt=consent');
    check(
      consent.searchParams.get('include_granted_scopes') === 'true',
      'consent URL uses include_granted_scopes (incremental auth)',
    );
    const state = verifyImportState(consent.searchParams.get('state')!);
    check(state.platform === 'web', 'signed state carries the return platform');
    check(state.userId === signup.user.id, 'signed state binds the request to the user');

    // --- Callback with bad/missing state → 302 to an error redirect --------
    res = await get('/integrations/google-import/callback', { redirect: 'manual' });
    check(res.status === 302, 'callback with no code/state redirects (302)');
    check(/error/.test(res.headers.get('location') ?? ''), 'callback failure lands on an error return URL');

    // --- Preview with no stored connection → 409 not_connected -------------
    res = await post('/import/google/preview');
    check(res.status === 409, 'POST /import/google/preview without a connection → 409');
    check((await res.json()).code === 'google_import_not_connected', '409 carries code google_import_not_connected');

    // --- Commit extension: `add` with email + an anniversary event ---------
    res = await post('/import/commit', {
      items: [
        {
          name: 'Grandma Rose',
          dob: { month: 5, day: 1, year: 1950 },
          email: 'rose@example.com',
          events: [{ type: 'anniversary', customName: null, date: { month: 6, day: 10, year: 1975 } }],
          resolution: 'add',
        },
      ],
    });
    check(res.status === 201, 'POST /import/commit with an email + anniversary → 201');
    check((await res.json()).summary.added === 1, 'commit summary counts the added person');

    const rose = await Person.findOne({ owner: signup.user.id, fullName: 'Grandma Rose' });
    check(!!rose && rose.email === 'rose@example.com', 'imported person carries the email from the commit item');
    const roseEvents = await Event.find({ person: rose!._id });
    check(roseEvents.some((e) => e.type === 'birthday'), 'imported person got their auto birthday event');
    check(
      roseEvents.some((e) => e.type === 'anniversary' && e.date.month === 6 && e.date.day === 10),
      'the anniversary event was created alongside the person (June 10)',
    );

    // --- Commit extension: `merge` fills empty email + adds a missing event -
    // A person with no email and no anniversary yet.
    const existing = await Person.create({
      owner: signup.user.id,
      fullName: 'Uncle Ray',
      type: 'human',
      dob: { month: 3, day: 3, year: 1960 },
      feb29Rule: 'feb28',
      createdBy: signup.user.id,
      updatedBy: signup.user.id,
    });
    await Event.create({ person: existing._id, type: 'birthday', date: { month: 3, day: 3, year: 1960 } });

    res = await post('/import/commit', {
      items: [
        {
          name: 'Uncle Ray',
          dob: { month: 3, day: 3, year: 1960 },
          email: 'ray@example.com',
          events: [{ type: 'anniversary', customName: null, date: { month: 9, day: 9, year: null } }],
          resolution: 'merge',
          mergeTargetId: existing._id.toString(),
        },
      ],
    });
    check(res.status === 201 && (await res.json()).summary.merged === 1, 'merge item → 201 + counted as merged');

    const rayAfter = await Person.findById(existing._id);
    check(!!rayAfter && rayAfter.email === 'ray@example.com', 'merge filled the target’s empty email');
    let rayEvents = await Event.find({ person: existing._id });
    check(
      rayEvents.some((e) => e.type === 'anniversary' && e.date.month === 9 && e.date.day === 9),
      'merge added the missing anniversary event (Sep 9)',
    );

    // --- Merging the SAME anniversary again does not duplicate it -----------
    res = await post('/import/commit', {
      items: [
        {
          name: 'Uncle Ray',
          dob: { month: 3, day: 3, year: 1960 },
          events: [{ type: 'anniversary', customName: null, date: { month: 9, day: 9, year: null } }],
          resolution: 'merge',
          mergeTargetId: existing._id.toString(),
        },
      ],
    });
    check(res.status === 201, 're-merging the same anniversary → 201');
    rayEvents = await Event.find({ person: existing._id, type: 'anniversary' });
    check(rayEvents.length === 1, 'the anniversary was not duplicated on a second merge');

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
