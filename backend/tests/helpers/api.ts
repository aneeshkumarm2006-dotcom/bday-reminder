/**
 * Integration-test helpers (TODO Stage 13): build the real Express app and drive
 * it with supertest, plus shortcuts to sign up users and authenticate requests.
 * No network listener — supertest binds the app ephemerally per request.
 */
import supertest from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../src/app';

export type Api = supertest.Agent;

/** A fresh supertest agent over a freshly-built app. */
export function makeApi(): { app: Express; api: Api } {
  const app = createApp();
  return { app, api: supertest(app) };
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  /** Authorization header value for authed requests. */
  auth: string;
}

let counter = 0;

/**
 * Sign up a user and return their tokens + id. Email is unique per call so two
 * `signUp()`s in one test never collide.
 */
export async function signUp(
  api: Api,
  overrides: Partial<{ name: string; email: string; password: string; timezone: string }> = {},
): Promise<TestUser> {
  counter += 1;
  const name = overrides.name ?? `User ${counter}`;
  const email = overrides.email ?? `user${counter}.${Date.now()}@example.com`;
  const password = overrides.password ?? 'supersecret123';
  const timezone = overrides.timezone ?? 'UTC';

  const res = await api.post('/auth/signup').send({ name, email, password, timezone });
  if (res.status !== 201) {
    throw new Error(`signUp failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.user.id,
    name: res.body.user.name,
    email: res.body.user.email,
    password,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    auth: `Bearer ${res.body.accessToken}`,
  };
}

/** Create a person (auto-creates their birthday event) and return the response body. */
export async function addPerson(
  api: Api,
  auth: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const res = await api.post('/people').set('Authorization', auth).send(body);
  return { status: res.status, body: res.body };
}
