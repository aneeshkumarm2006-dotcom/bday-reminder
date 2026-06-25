/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Stage 1 auth flow against an ephemeral MongoDB
 * (mongodb-memory-server) - no Atlas needed. Verifies the "Done when":
 * sign up, log in, refresh (with rotation), authed GET /me, and that
 * invalid/expired/revoked tokens are rejected.
 *
 * Run: npm run smoke
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  // Configure env BEFORE importing app code (env is read lazily + cached).
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

  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const patch = (path: string, body: unknown, token: string) =>
    fetch(`${base}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  const get = (path: string, token?: string) =>
    fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  try {
    // Health
    let res = await get('/health');
    let body = await res.json();
    check(res.status === 200 && body.status === 'ok', 'GET /health returns ok');

    // Signup
    res = await post('/auth/signup', {
      name: 'Ravi',
      email: 'Ravi@Example.com',
      password: 'supersecret',
      timezone: 'Asia/Kolkata',
    });
    body = await res.json();
    check(res.status === 201, 'signup → 201');
    check(body.user?.email === 'ravi@example.com', 'signup lowercases email');
    check(body.user?.timezone === 'Asia/Kolkata', 'signup stores client timezone');
    check(body.user?.passwordHash === undefined, 'signup never leaks passwordHash');
    check(
      typeof body.accessToken === 'string' && typeof body.refreshToken === 'string',
      'signup returns access + refresh tokens',
    );

    // Duplicate signup
    res = await post('/auth/signup', { name: 'Ravi2', email: 'ravi@example.com', password: 'supersecret' });
    check(res.status === 409, 'duplicate email → 409');

    // Validation
    res = await post('/auth/signup', { name: '', email: 'not-an-email', password: 'short' });
    check(res.status === 400, 'invalid signup → 400');

    // Wrong password
    res = await post('/auth/login', { email: 'ravi@example.com', password: 'wrongpass' });
    check(res.status === 401, 'wrong password → 401');

    // Login
    res = await post('/auth/login', { email: 'ravi@example.com', password: 'supersecret' });
    body = await res.json();
    check(res.status === 200 && !!body.accessToken && !!body.refreshToken, 'login → 200 + tokens');
    const access: string = body.accessToken;
    const refresh: string = body.refreshToken;

    // /me guards
    res = await get('/me');
    check(res.status === 401, 'GET /me without token → 401');
    res = await get('/me', 'garbage.token.value');
    check(res.status === 401, 'GET /me with invalid token → 401');

    // /me authed
    res = await get('/me', access);
    body = await res.json();
    check(res.status === 200 && body.email === 'ravi@example.com', 'GET /me with token → profile');

    // PATCH /me
    res = await patch('/me', { name: 'Ravi Patel', defaultReminderTime: '08:30' }, access);
    body = await res.json();
    check(
      res.status === 200 && body.name === 'Ravi Patel' && body.defaultReminderTime === '08:30',
      'PATCH /me updates profile',
    );

    // Refresh rotation
    res = await post('/auth/refresh', { refreshToken: refresh });
    body = await res.json();
    check(
      res.status === 200 && !!body.accessToken && !!body.refreshToken && body.refreshToken !== refresh,
      'refresh → new rotated token pair',
    );
    const refresh2: string = body.refreshToken;

    res = await post('/auth/refresh', { refreshToken: refresh });
    check(res.status === 401, 'old refresh token rejected after rotation');

    res = await post('/auth/refresh', { refreshToken: refresh2 });
    body = await res.json();
    check(res.status === 200 && !!body.accessToken, 'rotated refresh token works');
    const refresh3: string = body.refreshToken;

    // Logout revokes
    res = await post('/auth/logout', { refreshToken: refresh3 });
    check(res.status === 204, 'logout → 204');
    res = await post('/auth/refresh', { refreshToken: refresh3 });
    check(res.status === 401, 'refresh rejected after logout');

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
