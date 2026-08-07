import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Shared-list invite links used to be built straight off `APP_ORIGIN`, which in
 * a real deployment stays `http://localhost:8081` (the mobile app has no browser
 * origin worth allowing) - so every invite the app showed read
 * `http://localhost:8081/invite/<token>`. These pin the two rules that fix it:
 * the link comes off the *website* origin, and a comma-separated CORS list
 * yields one usable URL rather than both origins glued together.
 *
 * `loadEnv()` caches, so each case resets the module registry and re-imports.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const mod = await import('../../src/lib/public-urls');
  return { mod, restore: () => Object.assign(process.env, previous) };
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe('inviteBaseUrl', () => {
  it('uses the website origin, not APP_ORIGIN', async () => {
    const loaded = await load({
      APP_ORIGIN: 'http://localhost:8081',
      WEBSITE_ORIGIN: 'https://birthdayreminders.us',
      INVITE_BASE_URL: undefined,
    });
    restore = loaded.restore;
    expect(loaded.mod.inviteBaseUrl()).toBe('https://birthdayreminders.us');
  });

  it('takes the first entry of a comma-separated origin list', async () => {
    const loaded = await load({
      APP_ORIGIN: 'http://localhost:8081',
      WEBSITE_ORIGIN: 'https://birthdayreminders.us, https://www.birthdayreminders.us',
      INVITE_BASE_URL: undefined,
    });
    restore = loaded.restore;
    expect(loaded.mod.inviteBaseUrl()).toBe('https://birthdayreminders.us');
  });

  it('drops a trailing slash so the path joins cleanly', async () => {
    const loaded = await load({
      APP_ORIGIN: 'http://localhost:8081',
      WEBSITE_ORIGIN: 'https://birthdayreminders.us/',
      INVITE_BASE_URL: undefined,
    });
    restore = loaded.restore;
    expect(`${loaded.mod.inviteBaseUrl()}/invite/abc`).toBe(
      'https://birthdayreminders.us/invite/abc',
    );
  });

  it('lets INVITE_BASE_URL override the website origin', async () => {
    const loaded = await load({
      APP_ORIGIN: 'http://localhost:8081',
      WEBSITE_ORIGIN: 'https://birthdayreminders.us',
      INVITE_BASE_URL: 'https://join.birthdayreminders.us/',
    });
    restore = loaded.restore;
    expect(loaded.mod.inviteBaseUrl()).toBe('https://join.birthdayreminders.us');
  });
});
