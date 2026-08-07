import { loadEnv } from './env';

/**
 * Public-facing base URLs derived from the origin env vars.
 *
 * `APP_ORIGIN` / `WEBSITE_ORIGIN` are primarily the CORS allow-lists, so each
 * one may hold a comma-separated list (`https://site.com,https://www.site.com`).
 * Anything that builds a *link* out of them has to take the first entry and drop
 * the trailing slash - pasting the raw value into a URL yields a broken link the
 * moment a second origin is added.
 */

/** First entry of a possibly comma-separated origin list, without a trailing slash. */
function firstOrigin(value: string): string {
  return value.split(',')[0].trim().replace(/\/+$/, '');
}

/** First configured website origin - where the web app / marketing site lives. */
export function websiteOrigin(): string {
  return firstOrigin(loadEnv().WEBSITE_ORIGIN);
}

/** First configured app origin (the Expo web build). */
export function appOrigin(): string {
  return firstOrigin(loadEnv().APP_ORIGIN);
}

/**
 * Base for shared-list invite accept links (`<base>/invite/<token>`).
 *
 * Invites are opened by *other people*, usually from an email, on whatever
 * device they happen to be holding - so the link has to be a real, public web
 * URL. It points at the website (which serves `/invite/[token]`), not at
 * `APP_ORIGIN`: that one commonly stays `http://localhost:8081` in a deployment
 * because the mobile app has no browser origin to allow, which is exactly how
 * invite links end up reading `http://localhost:8081/invite/…`.
 *
 * `INVITE_BASE_URL` overrides it outright when the invite landing page lives
 * somewhere else.
 */
export function inviteBaseUrl(): string {
  const env = loadEnv();
  if (env.INVITE_BASE_URL) return firstOrigin(env.INVITE_BASE_URL);
  return websiteOrigin() || appOrigin();
}
