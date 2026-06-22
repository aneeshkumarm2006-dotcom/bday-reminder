/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 5 — settings & notification preferences
 * (SMS/WhatsApp stub + fair-use cap + per-event overrides), against an
 * ephemeral MongoDB. Verifies the "Done when": global vs per-event channels /
 * lead times change what actually fires, the SMS cap (test-lowered to 2) is
 * counted per user and silently falls back to push/email once hit, zero-channel
 * (global and per-event) keeps the in-app feed as the never-lost fallback, and
 * the config cap is exposed for the UI note (FR-19/21/22/24/26/55/56).
 *
 * Run: npm run smoke:settings
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const MS_PER_DAY = 86_400_000;
const CAP = 2; // test-lowered fair-use cap

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.REMINDER_JOBS_ENABLED = 'false';
  // Lower the fair-use cap so we can hit it deterministically.
  process.env.SMS_WHATSAPP_MONTHLY_CAP = String(CAP);

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchDue } = await import('../src/jobs/reminder-engine');
  const { resolveFairUse, getSmsUsage, incrementSmsUsage, smsPeriod, smsMonthlyCap } = await import(
    '../src/lib/sms-usage'
  );
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
  const get = (p: string, t?: string) => req('GET', p, undefined, t);

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  type FeedItem = { id: string; status: string; person: { fullName: string } };
  const feed = async (token: string): Promise<FeedItem[]> =>
    (await (await get('/reminders', token)).json()).items as FeedItem[];

  try {
    // --- Config endpoint (FR-56): cap exposed, read from config, no auth ------
    let res = await get('/config');
    let body = await res.json();
    check(res.status === 200 && body.smsWhatsappMonthlyCap === CAP, 'GET /config exposes the SMS monthly cap (no auth)');
    check(smsMonthlyCap() === CAP, 'smsMonthlyCap() reads the configured value');

    // --- Account A: SMS-only channels, fire-now reminder time ----------------
    res = await post('/auth/signup', { name: 'Sam', email: 'sam@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenA: string = (await res.json()).accessToken;
    res = await post('/auth/signup', { name: 'Lee', email: 'lee@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenB: string = (await res.json()).accessToken;

    // Persist global defaults (FR-21/22): lead [0], time 00:00, SMS-only channel.
    res = await patch(
      '/me',
      {
        defaultReminderTime: '00:00',
        defaultLeadDays: [0],
        phone: '+15550001111',
        channelPreferences: { push: false, email: false, sms: true, inApp: false },
      },
      tokenA,
    );
    check(res.status === 200, 'PATCH /me persists global lead/time/channel defaults → 200');
    body = await (await get('/me', tokenA)).json();
    const userAId: string = body.id;
    check(
      JSON.stringify(body.defaultLeadDays) === '[0]' &&
        body.defaultReminderTime === '00:00' &&
        body.channelPreferences.sms === true &&
        body.channelPreferences.push === false,
      'GET /me reflects the saved defaults (lead [0], 00:00, SMS-only)',
    );

    // --- Channel resolution: new people inherit the SMS-only default ---------
    for (const name of ['Aki', 'Bea', 'Cy']) {
      res = await post('/people', { fullName: name, dob: { ...md(todayUTC), year: 1990 }, phone: '+15559990000' }, tokenA);
      check(res.status === 201, `create ${name} (today, SMS-only owner) → 201`);
    }
    const aReminders = await Reminder.find({ user: userAId });
    check(aReminders.length === 3, `3 day-of reminders generated (got ${aReminders.length})`);
    check(
      aReminders.every((r) => r.channels.length === 1 && r.channels[0] === 'sms'),
      'reminders resolve to the SMS-only channel set (FR-24)',
    );

    // --- Fair-use cap end-to-end (FR-55): cap=2, 3 due SMS reminders ---------
    const summary = await dispatchDue(new Date());
    check(summary.sent === 3, `all 3 due reminders dispatch (got ${summary.sent})`);
    const used = await getSmsUsage(userAId, smsPeriod(new Date()));
    check(used === CAP, `SMS sends counted and capped at ${CAP} (got ${used}) — the 3rd fell back, didn't count`);
    const sentCount = await Reminder.countDocuments({ user: userAId, status: 'sent' });
    check(sentCount === 3, 'every reminder still delivered (sent) — capped SMS fell back, never lost (FR-55)');

    // --- resolveFairUse fallback channel set (unit-level, separate period) ---
    const farDate = new Date(Date.UTC(2099, 0, 15));
    const farPeriod = smsPeriod(farDate);
    const under = await resolveFairUse(userAId, ['sms', 'inApp'], farDate);
    check(
      under.channels.includes('sms') && !under.fellBack && under.countSms,
      'under the cap, SMS stays and is counted',
    );
    await incrementSmsUsage(userAId, farPeriod);
    await incrementSmsUsage(userAId, farPeriod);
    const over = await resolveFairUse(userAId, ['sms'], farDate);
    check(
      !over.channels.includes('sms') && over.channels.includes('push') && over.channels.includes('email') && over.fellBack,
      'at the cap, SMS is dropped and push + email are added (graceful fallback, FR-55)',
    );

    // --- Per-event override (FR-21/24): changes lead times AND channels ------
    // Account B keeps default channels (push/email/inApp); fire-now time.
    await patch('/me', { defaultReminderTime: '00:00', defaultLeadDays: [0, 7] }, tokenB);
    res = await post('/people', { fullName: 'Override Person', dob: { ...md(plusDays(todayUTC, 10)), year: 1992 } }, tokenB);
    const personId: string = (await res.json()).person.id;
    const eventId: string = (await (await get(`/people/${personId}`, tokenB)).json()).events[0].id;

    const beforeLead = (await Reminder.find({ event: eventId })).map((r) => r.leadDays).sort((a, b) => a - b);
    check(JSON.stringify(beforeLead) === '[0,7]', 'default generation uses the user lead times [0,7]');

    res = await patch(
      `/events/${eventId}`,
      { leadDaysOverride: [3, 10], channelOverride: { push: false, email: false, sms: true, inApp: true } },
      tokenB,
    );
    check(res.status === 200, 'PATCH /events/:id sets the override → 200');
    const afterOverride = await Reminder.find({ event: eventId });
    const overrideLead = afterOverride.map((r) => r.leadDays).sort((a, b) => a - b);
    check(JSON.stringify(overrideLead) === '[3,10]', 'override regenerates reminders with the new lead times [3,10] (FR-21)');
    check(
      afterOverride.every((r) => r.channels.includes('sms') && !r.channels.includes('email')),
      'override regenerates reminders with the new channel set (FR-24)',
    );

    // Clearing the override (null) falls back to the user defaults.
    res = await patch(`/events/${eventId}`, { leadDaysOverride: null, channelOverride: null }, tokenB);
    check(res.status === 200, 'PATCH /events/:id clears the override → 200');
    const cleared = (await Reminder.find({ event: eventId })).map((r) => r.leadDays).sort((a, b) => a - b);
    check(JSON.stringify(cleared) === '[0,7]', 'cleared override falls back to the user default lead times');

    // --- Per-event zero-channel (FR-26): in-app stays as the silent fallback -
    res = await post('/people', { fullName: 'Quiet Event', dob: { ...md(todayUTC) } }, tokenB);
    const quietId: string = (await res.json()).person.id;
    const quietEventId: string = (await (await get(`/people/${quietId}`, tokenB)).json()).events[0].id;
    res = await patch(
      `/events/${quietEventId}`,
      { leadDaysOverride: [0], channelOverride: { push: false, email: false, sms: false, inApp: false } },
      tokenB,
    );
    check(res.status === 200, 'PATCH /events/:id with all channels off → 200 (allowed)');
    const quietReminder = await Reminder.findOne({ event: quietEventId, leadDays: 0 });
    check(!!quietReminder && quietReminder.channels.length === 0, 'zero-channel override stores no delivery channels');
    const feedB = await feed(tokenB);
    check(feedB.some((i) => i.person.fullName === 'Quiet Event'), 'zero-channel event still appears in the in-app feed (FR-26)');

    // --- Validation + ownership ---------------------------------------------
    res = await patch(`/events/${eventId}`, { leadDaysOverride: [-1] }, tokenB);
    check(res.status === 400, 'invalid lead-time override (negative) → 400');
    res = await patch(`/events/${eventId}`, { leadDaysOverride: [1] }, tokenA);
    check(res.status === 403, "another user can't override your event → 403");

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
