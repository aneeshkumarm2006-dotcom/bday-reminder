/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 6 - other event types, pets, photos, custom
 * tags, and gift notes - against an ephemeral MongoDB over real HTTP. Verifies
 * the "Done when": a person can have a birthday + anniversary + custom event
 * (each reminding independently), a pet is stored as its own type (the paw
 * indicator), a photo uploads and is stored + served back, custom relationship
 * tags filter the feed, and notes accumulate as a timestamped running list
 * (FR-9/10/16/17/18/35/36/37).
 *
 * Run: npm run smoke:stage6
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

// A 1x1 transparent PNG as a data URI - a valid image payload for /uploads/photo.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.REMINDER_JOBS_ENABLED = 'false';
  // Ensure Cloudinary is unconfigured so we exercise the graceful data-URL path.
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchDue } = await import('../src/jobs/reminder-engine');
  const { Reminder } = await import('../src/models/Reminder');

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
  const del = (p: string, t: string) => req('DELETE', p, undefined, t);
  const get = (p: string, t?: string) => req('GET', p, undefined, t);

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  try {
    // --- Accounts -----------------------------------------------------------
    let res = await post('/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenA: string = (await res.json()).accessToken;
    res = await post('/auth/signup', { name: 'Bo', email: 'bo@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenB: string = (await res.json()).accessToken;

    // Day-of, fire-now defaults so every event yields an immediately-due reminder.
    await patch('/me', { defaultReminderTime: '00:00', defaultLeadDays: [0] }, tokenA);

    // --- Photo upload (FR-10): graceful data-URL fallback when unconfigured --
    res = await post('/uploads/photo', { image: TINY_PNG }, tokenA);
    let body = await res.json();
    check(res.status === 201 && body.hosted === false, 'POST /uploads/photo returns 201 + hosted:false (no Cloudinary)');
    check(typeof body.url === 'string' && body.url.startsWith('data:image/'), 'unconfigured upload echoes the image back as a data URL');
    const photoUrl: string = body.url;

    res = await post('/uploads/photo', { image: 'not-an-image' }, tokenA);
    check(res.status === 400, 'POST /uploads/photo rejects a non-image payload → 400');
    res = await post('/uploads/photo', { image: TINY_PNG });
    check(res.status === 401, 'POST /uploads/photo requires auth → 401');

    // --- Pet + photo + custom relationship tag (FR-9/10/17) -----------------
    res = await post(
      '/people',
      { fullName: 'Rex', type: 'pet', relationshipTag: 'Neighbour', photoUrl, dob: { ...md(todayUTC), year: 2018 } },
      tokenA,
    );
    check(res.status === 201, 'create a pet with a photo + custom tag → 201');
    body = await res.json();
    const personId: string = body.person.id;
    check(body.person.type === 'pet', 'person stored as type "pet" (the paw indicator, FR-17)');
    check(body.person.photoUrl === photoUrl, 'photo URL stored on the person (FR-10)');
    check(body.person.relationshipTag === 'Neighbour', 'custom relationship tag stored (FR-9)');

    res = await get(`/people/${personId}`, tokenA);
    body = await res.json();
    check(body.person.photoUrl === photoUrl, 'GET /people/:id serves the stored photo back (displays on profile)');
    const birthdayId: string = body.events.find((e: { type: string }) => e.type === 'birthday').id;

    // --- Additional events (FR-16/18): anniversary + custom -----------------
    res = await post('/events', { person: personId, type: 'anniversary', date: { ...md(todayUTC), year: 2015 } }, tokenA);
    check(res.status === 201, 'POST /events anniversary → 201');
    const anniversaryId: string = (await res.json()).event.id;

    res = await post('/events', { person: personId, type: 'custom', customName: 'Adoption day', date: md(todayUTC) }, tokenA);
    check(res.status === 201, 'POST /events custom (named) → 201');
    const customId: string = (await res.json()).event.id;

    res = await post('/events', { person: personId, type: 'custom', date: md(todayUTC) }, tokenA);
    check(res.status === 400, 'POST /events custom without a name → 400');
    res = await post('/events', { person: personId, type: 'anniversary', date: { month: 4, day: 31 } }, tokenA);
    check(res.status === 400, 'POST /events with an impossible date (Apr 31) → 400');

    res = await get(`/people/${personId}`, tokenA);
    body = await res.json();
    check(body.events.length === 3, 'person now has 3 events: birthday + anniversary + custom');

    // Age is birthday-only - the anniversary carries year 2015 but must not show
    // "turns N" in the feed (FR-13/14, §11); the birthday (2018) still does.
    body = await (await get('/upcoming', tokenA)).json();
    const upBirthday = body.items.find((i: { eventType: string }) => i.eventType === 'birthday');
    const upAnniversary = body.items.find((i: { eventType: string }) => i.eventType === 'anniversary');
    check(upBirthday && upBirthday.ageTurning !== null, 'birthday feed item carries the age (turns N)');
    check(upAnniversary && upAnniversary.ageTurning === null, 'anniversary feed item omits age even with a year (FR-13/14)');

    // Each event reminds independently - one day-of reminder per event (FR-18).
    const reminders = await Reminder.find({ user: (await (await get('/me', tokenA)).json()).id });
    const eventIdsWithReminders = new Set(reminders.map((r) => r.event.toString()));
    check(reminders.length === 3 && eventIdsWithReminders.size === 3, 'one day-of reminder generated per event, independently (got ' + reminders.length + ')');

    const summary = await dispatchDue(new Date());
    check(summary.sent === 3, `all 3 due reminders dispatch (got ${summary.sent})`);

    // Feed copy distinguishes the event types (PRD §11).
    res = await get('/reminders', tokenA);
    const feed = (await res.json()).items as { message: string; event: { type: string } }[];
    check(feed.length === 3, 'in-app feed shows all 3 events');
    check(feed.some((i) => /birthday today/.test(i.message)), 'birthday reminder copy reads "…birthday today…"');
    check(feed.some((i) => /anniversary today/.test(i.message)), 'anniversary reminder copy reads "…anniversary today…"');
    check(feed.some((i) => /Adoption day today/.test(i.message)), 'custom reminder copy uses the custom name');

    // --- Edit events (FR-16) ------------------------------------------------
    res = await patch(`/events/${customId}`, { customName: 'Gotcha day' }, tokenA);
    check(res.status === 200 && (await res.json()).event.customName === 'Gotcha day', 'PATCH /events/:id renames a custom event');
    res = await patch(`/events/${birthdayId}`, { date: md(todayUTC) }, tokenA);
    check(res.status === 400, "PATCH a birthday's date is rejected (edit via DOB) → 400");
    res = await patch(`/events/${anniversaryId}`, { customName: 'Nope' }, tokenA);
    check(res.status === 400, 'PATCH renames only custom events (anniversary) → 400');

    // --- Delete events (FR-16, §10 cascade) ---------------------------------
    res = await del(`/events/${anniversaryId}`, tokenA);
    check(res.status === 204, 'DELETE an anniversary event → 204');
    const anniversaryReminders = await Reminder.countDocuments({ event: anniversaryId });
    check(anniversaryReminders === 0, "deleting an event cascades its reminders");
    res = await del(`/events/${birthdayId}`, tokenA);
    check(res.status === 400, "a birthday can't be deleted on its own → 400");
    res = await get(`/people/${personId}`, tokenA);
    check((await res.json()).events.length === 2, 'person back to 2 events (birthday + custom) after the delete');

    // --- Gift notes (FR-35/36/37): a running, timestamped list --------------
    res = await get(`/people/${personId}/notes`, tokenA);
    check(res.status === 200 && (await res.json()).notes.length === 0, 'GET notes starts empty');

    res = await post(`/people/${personId}/notes`, { text: 'Likes squeaky toys' }, tokenA);
    check(res.status === 201, 'POST a note → 201');
    await new Promise((r) => setTimeout(r, 5)); // keep createdAt ordering deterministic
    res = await post(`/people/${personId}/notes`, { text: 'New collar, size M' }, tokenA);
    check(res.status === 201, 'POST a second note → 201 (entries accumulate, not overwrite)');

    res = await get(`/people/${personId}/notes`, tokenA);
    const notes = (await res.json()).notes as { id: string; text: string; createdAt: string }[];
    check(notes.length === 2, 'both notes persist as separate entries (FR-36)');
    check(notes[0].text === 'New collar, size M', 'notes are newest-first');
    check(notes.every((n) => typeof n.createdAt === 'string'), 'each note carries a timestamp');

    res = await post(`/people/${personId}/notes`, { text: '   ' }, tokenA);
    check(res.status === 400, 'a blank note is rejected → 400');

    res = await del(`/people/${personId}/notes/${notes[1].id}`, tokenA);
    check(res.status === 204, 'DELETE a single note → 204');
    res = await get(`/people/${personId}/notes`, tokenA);
    check((await res.json()).notes.length === 1, 'only the deleted entry is removed (the list keeps the rest)');

    // --- Custom-tag feed filter (FR-9) --------------------------------------
    res = await get('/people?tag=Neighbour', tokenA);
    check(res.status === 200 && (await res.json()).people.length === 1, 'GET /people?tag=<custom> filters by the custom tag');
    res = await get('/upcoming', tokenA);
    body = await res.json();
    check(body.tags.includes('Neighbour'), 'the custom tag appears in the feed filter chips');
    check(body.items.some((i: { type: string }) => i.type === 'pet'), 'the pet surfaces in the upcoming feed as type "pet"');

    // --- Cross-user ownership (every Stage-6 surface) -----------------------
    res = await post('/events', { person: personId, type: 'anniversary', date: md(todayUTC) }, tokenB);
    check(res.status === 403, "another user can't add an event to your person → 403");
    res = await del(`/events/${customId}`, tokenB);
    check(res.status === 403, "another user can't delete your event → 403");
    res = await get(`/people/${personId}/notes`, tokenB);
    check(res.status === 403, "another user can't read your notes → 403 (FR-37)");
    res = await post(`/people/${personId}/notes`, { text: 'sneaky' }, tokenB);
    check(res.status === 403, "another user can't add notes to your person → 403");

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
