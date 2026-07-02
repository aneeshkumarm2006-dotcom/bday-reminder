/* eslint-disable no-console */
/**
 * Smoke test for "Sign in with Google" (identity login). Against an ephemeral
 * MongoDB, with Google configured but no real Google traffic (the code→token
 * exchange needs Google, so we drive the parts around it directly). Verifies:
 *   - GET /config advertises googleAuthAvailable.
 *   - GET /auth/google/start 302s to Google's consent screen with the identity
 *     scope ONLY (openid email profile) and NO gmail.send - the whole point.
 *   - The signed `state` carries the return platform.
 *   - The handoff → POST /auth/google/session exchange issues a real JWT pair;
 *     a bad/expired handoff is rejected.
 *   - A Google-only account (no password) is pointed at the Google button when
 *     it tries to log in with a password.
 *   - Regression: password signup + login still work with passwordHash optional.
 *
 * Run: npm run smoke:googleauth
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
  // Provision Google login (client id + secret). No token-encryption key needed
  // for login, and no real Google network happens in this smoke.
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.API_PUBLIC_URL = 'http://localhost:4040';
  process.env.WEBSITE_ORIGIN = 'http://localhost:3000';

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { verifyLoginState, signGoogleHandoff, LOGIN_SCOPE } = await import('../src/lib/google-oauth');
  const { User } = await import('../src/models/User');

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

  const req = (method: string, path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  const get = (p: string, init?: RequestInit) => req('GET', p, undefined, init);
  const post = (p: string, b?: unknown) => req('POST', p, b);

  try {
    // --- Config advertises the feature -------------------------------------
    let res = await get('/config');
    check((await res.json()).googleAuthAvailable === true, 'GET /config advertises googleAuthAvailable');

    // --- Sign-in scope is IDENTITY ONLY (no gmail.send) --------------------
    check(
      LOGIN_SCOPE.includes('openid') && LOGIN_SCOPE.includes('email') && !LOGIN_SCOPE.includes('gmail'),
      'LOGIN_SCOPE is identity-only (no gmail.send)',
    );

    // --- GET /auth/google/start → 302 to Google with identity scope --------
    res = await get('/auth/google/start?platform=web', { redirect: 'manual' });
    check(res.status === 302, 'GET /auth/google/start redirects (302)');
    const consent = new URL(res.headers.get('location')!);
    check(consent.hostname === 'accounts.google.com', 'start redirects to Google consent screen');
    const scope = consent.searchParams.get('scope') ?? '';
    check(
      scope.includes('openid') && scope.includes('email') && !scope.includes('gmail.send'),
      'consent URL requests identity scope only - never gmail.send at login',
    );
    check(
      verifyLoginState(consent.searchParams.get('state')!).platform === 'web',
      'signed state carries the return platform',
    );

    // --- Handoff → session exchange issues a real JWT pair -----------------
    const created = await User.create({ name: 'Gina Google', email: 'gina@gmail.com', googleId: 'g-123', timezone: 'UTC' });
    const handoff = signGoogleHandoff(created._id.toString(), true);
    res = await post('/auth/google/session', { handoff });
    const session = await res.json();
    check(res.status === 200, 'POST /auth/google/session with a valid handoff → 200');
    check(
      typeof session.accessToken === 'string' && typeof session.refreshToken === 'string',
      'session returns an access + refresh token pair',
    );
    check(session.user?.email === 'gina@gmail.com' && session.isNew === true, 'session returns the user + isNew flag');

    // The freshly-minted access token authenticates a real request.
    res = await get('/me', { headers: { Authorization: `Bearer ${session.accessToken}` } });
    check(res.status === 200 && (await res.json()).email === 'gina@gmail.com', 'the issued token authenticates GET /me');

    // --- Bad / expired handoff is rejected ---------------------------------
    res = await post('/auth/google/session', { handoff: 'not-a-real-token' });
    check(res.status === 401, 'a garbage handoff is rejected (401)');
    res = await post('/auth/google/session', {});
    check(res.status === 400, 'a missing handoff is a validation error (400)');

    // --- A Google-only account is pointed at the Google button -------------
    res = await post('/auth/login', { email: 'gina@gmail.com', password: 'whatever' });
    const loginErr = await res.json();
    check(
      res.status === 401 && /google/i.test(loginErr.message ?? ''),
      'password login on a Google-only account points to "Continue with Google"',
    );

    // --- Regression: password signup + login still work --------------------
    res = await post('/auth/signup', { name: 'Pat Password', email: 'pat@example.com', password: 'supersecret' });
    check(res.status === 201, 'password signup still works (passwordHash optional in schema)');
    res = await post('/auth/login', { email: 'pat@example.com', password: 'supersecret' });
    check(res.status === 200, 'password login still works');
    res = await post('/auth/login', { email: 'pat@example.com', password: 'wrong' });
    check(res.status === 401, 'wrong password is still rejected');

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
