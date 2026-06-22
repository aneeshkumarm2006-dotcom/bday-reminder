/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 9 — calendar sync — against an ephemeral
 * MongoDB over real HTTP. Verifies the "Done when": subscribing to the feed
 * shows the birthdays/events, and adding/deleting a person updates the calendar
 * on its next refresh (FR-38/39/40).
 *
 * Covers: opt-in default off; enable mints a tokenized feed; the public ICS feed
 * (no auth) renders one yearly-recurring VEVENT per event with stable UIDs;
 * live add/delete + a second event; the "My birthdays" toggle; per-list opt-in
 * for a shared-list member (and that a list you don't belong to is refused);
 * leaving a list drops its people; and rotate/disable/invalid-token revoke.
 *
 * Run: npm run smoke:stage9
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.REMINDER_JOBS_ENABLED = 'false';

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
  const del = (p: string, t?: string) => req('DELETE', p, undefined, t);
  const get = (p: string, t?: string) => req('GET', p, undefined, t);

  /** Fetch the public feed (no auth) and return { status, contentType, body }. */
  const fetchFeed = async (token: string, ext = '.ics') => {
    const res = await fetch(`${base}/calendar/${token}${ext}`);
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      body: await res.text(),
    };
  };
  const veventCount = (ics: string) => (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  /** Pull the token out of a feed URL (`.../calendar/<token>.ics`). */
  const tokenFromUrl = (url: string) => url.split('/calendar/')[1]?.replace(/\.ics$/, '') ?? '';

  // "Today" in UTC so a person born now is the day-of occurrence.
  const now = new Date();
  const todayDob = { month: now.getUTCMonth() + 1, day: now.getUTCDate(), year: 1990 };

  try {
    // --- Accounts -----------------------------------------------------------
    let res = await post('/auth/signup', { name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret', timezone: 'UTC' });
    let json = await res.json();
    const tokenA: string = json.accessToken;

    res = await post('/auth/signup', { name: 'Bo Diddley', email: 'bo@example.com', password: 'supersecret', timezone: 'UTC' });
    json = await res.json();
    const tokenB: string = json.accessToken;

    // --- Auth guards --------------------------------------------------------
    check((await get('/me/calendar')).status === 401, 'GET /me/calendar requires auth → 401');
    check((await patch('/me/calendar', { enabled: true }, '')).status === 401, 'PATCH /me/calendar requires auth → 401');

    // --- Defaults: opt-in, off (FR-40) --------------------------------------
    res = await get('/me/calendar', tokenA);
    let settings = await res.json();
    check(res.status === 200, 'GET /me/calendar → 200');
    check(settings.enabled === false, 'calendar sync is OFF by default (opt-in, FR-40)');
    check(settings.includePersonal === true, 'personal people are included by default');
    check(settings.feedUrl === null && settings.webcalUrl === null, 'no subscribe link until enabled');
    check(Array.isArray(settings.availableLists) && settings.availableLists.length === 0, 'no lists to sync yet');

    // --- Ada adds a personal person -----------------------------------------
    res = await post('/people', { fullName: 'Mum', dob: todayDob, relationshipTag: 'Family' }, tokenA);
    const mumId: string = (await res.json()).person.id;

    // --- Enable sync mints a feed (FR-38) -----------------------------------
    res = await patch('/me/calendar', { enabled: true }, tokenA);
    settings = await res.json();
    check(res.status === 200 && settings.enabled === true, 'enabling sync → 200, enabled');
    check(typeof settings.feedUrl === 'string' && settings.feedUrl.includes('/calendar/'), 'enabling returns a tokenized feed URL');
    check(typeof settings.webcalUrl === 'string' && settings.webcalUrl.startsWith('webcal://'), 'a webcal:// subscribe URL is provided');
    const tokenAFeed = tokenFromUrl(settings.feedUrl);
    check(tokenAFeed.length > 0 && settings.webcalUrl.includes(tokenAFeed), 'the webcal + https URLs carry the same token');

    // --- The public ICS feed (no auth) renders the event (FR-38) ------------
    let feed = await fetchFeed(tokenAFeed);
    check(feed.status === 200, 'the public feed responds 200 with no auth header');
    check(feed.contentType.includes('text/calendar'), 'the feed is served as text/calendar');
    check(feed.body.startsWith('BEGIN:VCALENDAR') && feed.body.trimEnd().endsWith('END:VCALENDAR'), 'the body is a well-formed VCALENDAR');
    check(feed.body.includes('\r\n'), 'lines are CRLF-terminated (RFC 5545)');
    check(veventCount(feed.body) === 1, 'the feed has one VEVENT (Mum’s birthday)');
    check(feed.body.includes('RRULE:FREQ=YEARLY'), 'the VEVENT recurs yearly (RRULE:FREQ=YEARLY)');
    check(feed.body.includes("SUMMARY:Mum's birthday"), 'the VEVENT summary names the person + event');
    check(feed.body.includes('@circle-the-date'), 'the VEVENT carries a stable UID');
    check(feed.body.includes('DTSTART;VALUE=DATE:'), 'the birthday is an all-day event');

    // --- Live add reflects immediately (FR-39) ------------------------------
    res = await post('/people', { fullName: 'Dad', dob: { month: 3, day: 14 } }, tokenA);
    const dadId: string = (await res.json()).person.id;
    feed = await fetchFeed(tokenAFeed);
    check(veventCount(feed.body) === 2, 'adding a person shows up in the feed on next fetch (FR-39)');
    check(feed.body.includes("SUMMARY:Dad's birthday"), 'the new person’s birthday is in the feed');

    // --- A second event on one person → its own VEVENT ----------------------
    res = await post('/events', { person: mumId, type: 'anniversary', date: { month: 6, day: 1 } }, tokenA);
    const anniId: string = (await res.json()).event.id;
    feed = await fetchFeed(tokenAFeed);
    check(veventCount(feed.body) === 3, 'a second event on a person adds its own VEVENT');
    check(feed.body.includes("SUMMARY:Mum's anniversary"), 'the anniversary event renders independently');

    // --- Live delete reflects immediately (FR-39) ---------------------------
    await del(`/events/${anniId}`, tokenA);
    await del(`/people/${dadId}`, tokenA);
    feed = await fetchFeed(tokenAFeed);
    check(veventCount(feed.body) === 1, 'deleting a person/event removes it from the feed (FR-39)');
    check(!feed.body.includes("SUMMARY:Dad's birthday"), 'the deleted person is gone from the feed');

    // --- "My birthdays" toggle ----------------------------------------------
    res = await patch('/me/calendar', { includePersonal: false }, tokenA);
    settings = await res.json();
    check(settings.includePersonal === false, 'turning off "my birthdays" persists');
    feed = await fetchFeed(tokenAFeed);
    check(veventCount(feed.body) === 0, 'with personal people excluded the feed is empty');
    await patch('/me/calendar', { includePersonal: true }, tokenA);

    // --- Per-list opt-in for a shared-list member (FR-40) -------------------
    res = await post('/lists', { name: 'Family' }, tokenA);
    const familyId: string = (await res.json()).list.id;
    // Gran is owned by Ada AND shared into Family.
    await post('/people', { fullName: 'Gran', dob: { month: 9, day: 9 }, lists: [familyId] }, tokenA);

    feed = await fetchFeed(tokenAFeed);
    check(
      veventCount(feed.body) === 2 && feed.body.includes("SUMMARY:Gran's birthday"),
      '"my birthdays" includes people I own even when they’re also in a list',
    );

    // A second list Bo is NOT a member of (used for the refusal check).
    res = await post('/lists', { name: 'Work' }, tokenA);
    const workId: string = (await res.json()).list.id;

    // Invite Bo to Family (view) and accept.
    res = await post(`/lists/${familyId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenA);
    const inviteToken: string = (await res.json()).invite.token;
    await post(`/invites/${inviteToken}/accept`, undefined, tokenB);

    res = await get('/me/calendar', tokenB);
    settings = await res.json();
    check(
      settings.availableLists.some((l: { id: string; name: string }) => l.id === familyId) &&
        !settings.availableLists.some((l: { id: string }) => l.id === workId),
      'a member sees Family (joined) but not Work (not joined) in the sync choices',
    );

    // Bo enables sync; he owns nobody and hasn't synced the list yet → empty.
    res = await patch('/me/calendar', { enabled: true }, tokenB);
    settings = await res.json();
    const tokenBFeed = tokenFromUrl(settings.feedUrl);
    feed = await fetchFeed(tokenBFeed);
    check(veventCount(feed.body) === 0, 'before opting the list in, Bo’s feed is empty (per-list opt-in, FR-40)');

    // Refuse a list Bo doesn't belong to.
    check((await patch('/me/calendar', { lists: [workId] }, tokenB)).status === 403, 'syncing a list you don’t belong to → 403');

    // Opt the shared list in → Gran appears.
    res = await patch('/me/calendar', { lists: [familyId] }, tokenB);
    settings = await res.json();
    check(settings.lists.length === 1 && settings.lists[0] === familyId, 'Bo’s synced-list selection persists');
    feed = await fetchFeed(tokenBFeed);
    check(
      veventCount(feed.body) === 1 && feed.body.includes("SUMMARY:Gran's birthday"),
      'opting a shared list in adds its people to the member’s feed (FR-40)',
    );

    // Opt back out → empty again.
    await patch('/me/calendar', { lists: [] }, tokenB);
    feed = await fetchFeed(tokenBFeed);
    check(veventCount(feed.body) === 0, 'opting the list back out removes its people');

    // Re-opt-in, then leave the list → access lost, feed drops the people (FR-46).
    await patch('/me/calendar', { lists: [familyId] }, tokenB);
    feed = await fetchFeed(tokenBFeed);
    check(veventCount(feed.body) === 1, 'Bo re-syncs the list before leaving');
    await post(`/lists/${familyId}/leave`, undefined, tokenB);
    feed = await fetchFeed(tokenBFeed);
    check(veventCount(feed.body) === 0, 'leaving a list immediately drops its people from the feed (FR-46)');
    res = await get('/me/calendar', tokenB);
    settings = await res.json();
    check(
      settings.lists.length === 0 && !settings.availableLists.some((l: { id: string }) => l.id === familyId),
      'a left list silently drops out of the synced + available lists',
    );

    // --- Rotate revokes the old link ----------------------------------------
    res = await post('/me/calendar/rotate', undefined, tokenA);
    settings = await res.json();
    const tokenARotated = tokenFromUrl(settings.feedUrl);
    check(tokenARotated.length > 0 && tokenARotated !== tokenAFeed, 'rotating issues a new token');
    check((await fetchFeed(tokenAFeed)).status === 404, 'the old link stops working after rotate (revoke)');
    check((await fetchFeed(tokenARotated)).status === 200, 'the new link works after rotate');

    // --- Disabling turns the feed off ---------------------------------------
    await patch('/me/calendar', { enabled: false }, tokenA);
    check((await fetchFeed(tokenARotated)).status === 404, 'disabling sync turns the feed off → 404');
    res = await get('/me/calendar', tokenA);
    settings = await res.json();
    check(settings.feedUrl === null, 'a disabled feed reports no subscribe URL');

    // Re-enabling keeps the same (rotated) token, and the extensionless URL works.
    res = await patch('/me/calendar', { enabled: true }, tokenA);
    settings = await res.json();
    check(tokenFromUrl(settings.feedUrl) === tokenARotated, 're-enabling restores the same token (not a fresh one)');
    check((await fetchFeed(tokenARotated, '')).status === 200, 'the feed also resolves without the .ics extension');

    // --- Invalid token ------------------------------------------------------
    check((await fetchFeed('not-a-real-token')).status === 404, 'an unknown feed token → 404');

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
