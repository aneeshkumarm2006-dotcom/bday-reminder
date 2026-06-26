import { beforeEach, describe, expect, it } from 'vitest';

import { makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

describe('auth flow (FR-1/4)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  it('GET /health returns ok', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('signs up, lowercases email, stores timezone, never leaks the hash', async () => {
    const res = await api
      .post('/auth/signup')
      .send({ name: 'Michael', email: 'Michael@Example.com', password: 'supersecret', timezone: 'Asia/Kolkata' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('michael@example.com');
    expect(res.body.user.timezone).toBe('Asia/Kolkata');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rejects a duplicate email with 409', async () => {
    await signUp(api, { email: 'dupe@example.com' });
    const res = await api
      .post('/auth/signup')
      .send({ name: 'Other', email: 'dupe@example.com', password: 'supersecret' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid signup input with 400', async () => {
    const res = await api.post('/auth/signup').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects a wrong password with 401', async () => {
    const u = await signUp(api, { email: 'login@example.com', password: 'rightpass123' });
    const res = await api.post('/auth/login').send({ email: u.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('logs in and returns a token pair', async () => {
    const u = await signUp(api, { email: 'login2@example.com', password: 'rightpass123' });
    const res = await api.post('/auth/login').send({ email: u.email, password: 'rightpass123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('guards GET /me without / with a bad token', async () => {
    expect((await api.get('/me')).status).toBe(401);
    expect((await api.get('/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('returns the profile for an authed GET /me', async () => {
    const u = await signUp(api);
    const res = await api.get('/me').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(u.email);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const u = await signUp(api);
    const first = await api.post('/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(u.refreshToken);

    const reuse = await api.post('/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);

    const second = await api.post('/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it('revokes a refresh token on logout', async () => {
    const u = await signUp(api);
    const out = await api.post('/auth/logout').send({ refreshToken: u.refreshToken });
    expect(out.status).toBe(204);
    const after = await api.post('/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(after.status).toBe(401);
  });
});
