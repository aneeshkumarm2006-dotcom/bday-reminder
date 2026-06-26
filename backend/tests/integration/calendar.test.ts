import { beforeEach, describe, expect, it } from 'vitest';

import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

/**
 * Calendar sync (Stage 9; FR-38/39/40). Mirrors scripts/smoke-stage9.ts:
 * opt-in defaults off; enabling mints a tokenized feed; the PUBLIC ICS feed
 * (no auth) renders one yearly-recurring all-day VEVENT per event with a stable
 * UID; the feed is regenerated per request (live add); the "my birthdays"
 * toggle drops personal VEVENTs; rotate/disable/invalid-token revoke (→ 404).
 */
describe('calendar sync (FR-38/39/40)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  const veventCount = (ics: string) => (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  /** Pull the token out of a feed URL (`.../calendar/<token>.ics`). */
  const tokenFromUrl = (url: string) => url.split('/calendar/')[1]?.replace(/\.ics$/, '') ?? '';

  // "Today" in UTC so a person born now is the day-of occurrence.
  const now = new Date();
  const todayDob = { month: now.getUTCMonth() + 1, day: now.getUTCDate(), year: 1990 };

  /** Fetch the public feed (no auth header). */
  const fetchFeed = (token: string, ext = '.ics') => api.get(`/calendar/${token}${ext}`);

  it('requires auth for the settings surface (401)', async () => {
    expect((await api.get('/me/calendar')).status).toBe(401);
    expect((await api.patch('/me/calendar').send({ enabled: true })).status).toBe(401);
  });

  it('defaults sync OFF with no subscribe link and no lists', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    const res = await api.get('/me/calendar').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.includePersonal).toBe(true);
    expect(res.body.feedUrl).toBeNull();
    expect(res.body.webcalUrl).toBeNull();
    expect(Array.isArray(res.body.availableLists)).toBe(true);
    expect(res.body.availableLists).toHaveLength(0);
  });

  it('enabling sync mints a tokenized feed URL + webcal URL with the same token', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob, relationshipTag: 'Family' });

    const res = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(typeof res.body.feedUrl).toBe('string');
    expect(res.body.feedUrl).toContain('/calendar/');
    expect(typeof res.body.webcalUrl).toBe('string');
    expect(res.body.webcalUrl.startsWith('webcal://')).toBe(true);

    const token = tokenFromUrl(res.body.feedUrl);
    expect(token.length).toBeGreaterThan(0);
    expect(res.body.webcalUrl).toContain(token);
  });

  it('serves a well-formed public ICS feed (no auth) with a yearly all-day VEVENT + stable UID', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob, relationshipTag: 'Family' });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    const feed = await fetchFeed(token);
    expect(feed.status).toBe(200);
    expect(feed.headers['content-type']).toContain('text/calendar');
    expect(feed.text.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(feed.text.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(feed.text).toContain('\r\n');
    expect(veventCount(feed.text)).toBe(1);
    expect(feed.text).toContain('RRULE:FREQ=YEARLY');
    expect(feed.text).toContain("SUMMARY:Mom's birthday");
    expect(feed.text).toContain('@circle-the-date');
    expect(feed.text).toContain('DTSTART;VALUE=DATE:');

    // UID must be STABLE across regenerations (FR-39) so calendar clients
    // de-dupe the same event rather than piling up copies on each refresh.
    const uids = (text: string) => (text.match(/^UID:(.+)$/gm) ?? []).map((l) => l.replace(/\r$/, ''));
    const firstUids = uids(feed.text);
    expect(firstUids.length).toBe(1);
    const refetch = await fetchFeed(token);
    expect(uids(refetch.text)).toEqual(firstUids);
  });

  it('also resolves the feed without the .ics extension', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    expect((await fetchFeed(token, '')).status).toBe(200);
  });

  it('regenerates the feed per request: adding a person shows up live (FR-39)', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    let feed = await fetchFeed(token);
    expect(veventCount(feed.text)).toBe(1);

    await addPerson(api, u.auth, { fullName: 'Dad', dob: { month: 3, day: 14 } });
    feed = await fetchFeed(token);
    expect(veventCount(feed.text)).toBe(2);
    expect(feed.text).toContain("SUMMARY:Dad's birthday");
  });

  it('a second event on a person adds its own VEVENT', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    const mum = await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const mumId: string = mum.body.person.id;
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    await api
      .post('/events')
      .set('Authorization', u.auth)
      .send({ person: mumId, type: 'anniversary', date: { month: 6, day: 1 } });

    const feed = await fetchFeed(token);
    expect(veventCount(feed.text)).toBe(2);
    expect(feed.text).toContain("SUMMARY:Mom's anniversary");
  });

  it('turning off "my birthdays" (includePersonal) drops the personal VEVENTs', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    expect(veventCount((await fetchFeed(token)).text)).toBe(1);

    const off = await api
      .patch('/me/calendar')
      .set('Authorization', u.auth)
      .send({ includePersonal: false });
    expect(off.body.includePersonal).toBe(false);
    expect(veventCount((await fetchFeed(token)).text)).toBe(0);

    await api.patch('/me/calendar').set('Authorization', u.auth).send({ includePersonal: true });
    expect(veventCount((await fetchFeed(token)).text)).toBe(1);
  });

  it('rotating issues a new token and revokes the old link (old → 404)', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const oldToken = tokenFromUrl(enable.body.feedUrl);

    const rotate = await api.post('/me/calendar/rotate').set('Authorization', u.auth);
    expect(rotate.status).toBe(200);
    const newTokenValue = tokenFromUrl(rotate.body.feedUrl);
    expect(newTokenValue.length).toBeGreaterThan(0);
    expect(newTokenValue).not.toBe(oldToken);

    expect((await fetchFeed(oldToken)).status).toBe(404);
    expect((await fetchFeed(newTokenValue)).status).toBe(200);
  });

  it('disabling sync turns the feed off (→ 404) and reports no subscribe URL', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);
    expect((await fetchFeed(token)).status).toBe(200);

    await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: false });
    expect((await fetchFeed(token)).status).toBe(404);

    const settings = await api.get('/me/calendar').set('Authorization', u.auth);
    expect(settings.body.feedUrl).toBeNull();
  });

  it('re-enabling restores the same token (not a fresh one)', async () => {
    const u = await signUp(api, { timezone: 'UTC' });
    await addPerson(api, u.auth, { fullName: 'Mom', dob: todayDob });
    const enable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    const token = tokenFromUrl(enable.body.feedUrl);

    await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: false });
    const reEnable = await api.patch('/me/calendar').set('Authorization', u.auth).send({ enabled: true });
    expect(tokenFromUrl(reEnable.body.feedUrl)).toBe(token);
  });

  it('an unknown feed token → 404', async () => {
    expect((await fetchFeed('not-a-real-token')).status).toBe(404);
  });
});
