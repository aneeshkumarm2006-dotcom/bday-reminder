/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Stage 4 reminders engine against an ephemeral
 * MongoDB (mongodb-memory-server) — no Atlas, Resend, or Expo account needed
 * (delivery channels degrade to "skipped" without keys). Verifies the "Done
 * when": reminders generate per lead time at the right local fire-time, the
 * dispatcher fires due ones (idempotently, no double-send), the in-app feed
 * shows them with correct templated copy/age, and Done / Snooze / Send-greeting
 * eligibility behave per spec. Also covers timezone correctness, annual
 * rotation, the zero-channel in-app fallback, and push-token registration.
 *
 * Run: npm run smoke:reminders
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const MS_PER_DAY = 86_400_000;

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  // Keep the in-process scheduler off; we drive the engine directly for determinism.
  process.env.REMINDER_JOBS_ENABLED = 'false';

  const { connectDb, disconnectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');
  const { dispatchDue } = await import('../src/jobs/reminder-engine');
  const { fireInstant } = await import('../src/lib/schedule');
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
  const del = (p: string, b: unknown, t: string) => req('DELETE', p, b, t);

  // Real "today" at UTC midnight; build birthdays relative to it.
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
  const md = (d: Date) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  type FeedItem = {
    id: string;
    status: string;
    message: string;
    canGreet: boolean;
    daysRemaining: number;
    ageTurning: number | null;
    person: { fullName: string; phone: string | null };
  };
  const feed = async (token: string): Promise<FeedItem[]> =>
    (await (await get('/reminders', token)).json()).items as FeedItem[];

  try {
    // --- Account A (timezone UTC, reminder time moved to 00:00 so "today"
    //     reminders are immediately due) ------------------------------------
    let res = await post('/auth/signup', {
      name: 'Ravi',
      email: 'ravi@example.com',
      password: 'supersecret',
      timezone: 'UTC',
    });
    const tokenA: string = (await res.json()).accessToken;
    res = await post('/auth/signup', { name: 'Mira', email: 'mira@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenB: string = (await res.json()).accessToken;

    // Auth guard
    res = await get('/reminders');
    check(res.status === 401, 'GET /reminders without token → 401');

    res = await patch('/me', { defaultReminderTime: '00:00' }, tokenA);
    check(res.status === 200, 'PATCH /me reminder time → 200');

    // --- People (reminders auto-generate on create) ------------------------
    // P1: birthday today, year known, has phone → day-of due, can greet.
    res = await post('/people', { fullName: 'Aisha Khan', dob: { ...md(todayUTC), year: 1990 }, phone: '+15551234567', relationshipTag: 'Friend' }, tokenA);
    check(res.status === 201, 'create Aisha (today, year, phone) → 201');

    // P2: birthday today, no year, no phone → day-of due, cannot greet.
    res = await post('/people', { fullName: 'Noah', dob: { ...md(todayUTC) } }, tokenA);
    check(res.status === 201, 'create Noah (today, no year, no phone) → 201');

    // P3: birthday in 10 days, no year → both lead instances are in the future.
    res = await post('/people', { fullName: 'Soon Friend', dob: { ...md(plusDays(todayUTC, 10)) } }, tokenA);
    check(res.status === 201, 'create Soon Friend (today+10) → 201');

    // P6: birthday in 7 days, year known → the "1 week before" instance is due now.
    res = await post('/people', { fullName: 'Week Friend', dob: { ...md(plusDays(todayUTC, 7)), year: 1995 } }, tokenA);
    const weekPersonId: string = (await res.json()).person.id;
    check(typeof weekPersonId === 'string', 'create Week Friend (today+7, year) → 201');

    // --- Generation (FR-19/21) ---------------------------------------------
    const userARes = await (await get('/me', tokenA)).json();
    const userAId: string = userARes.id;
    const allA = await Reminder.find({ user: userAId });
    // P1: lead0 (due) — lead7 is 7 days stale, skipped. P2: lead0. P3: lead0+lead7. P6: lead0+lead7. = 6.
    check(allA.length === 6, `generated 6 reminder instances across lead times (got ${allA.length})`);
    check(
      allA.every((r) => r.channels.length === 3 && r.channels.includes('push') && r.channels.includes('email') && r.channels.includes('inApp')),
      'reminders resolve the user default channels (push+email+inApp, sms off)',
    );
    check(
      allA.every((r) => r.scheduledFor instanceof Date),
      'every reminder carries an absolute scheduledFor instant',
    );

    // --- In-app feed before dispatch: only due occurrences appear (FR-27) ---
    let items = await feed(tokenA);
    check(items.length === 3, `feed shows 3 due occurrences (Aisha, Noah, Week); future-only hidden (got ${items.length})`);
    check(!items.some((i) => i.person.fullName === 'Soon Friend'), 'a fully-future occurrence is not in the feed yet');

    const aisha = items.find((i) => i.person.fullName === 'Aisha Khan')!;
    check(aisha.daysRemaining === 0 && /^It's Aisha Khan's birthday today — turns \d+\.$/.test(aisha.message), 'day-of + year copy: "It\'s … today — turns N."');
    check(typeof aisha.ageTurning === 'number' && aisha.ageTurning! > 0, 'age shown when birth year known');
    check(aisha.canGreet === true, 'Send-greeting eligible day-of when a phone exists (FR-28)');

    const noah = items.find((i) => i.person.fullName === 'Noah')!;
    check(noah.message === "It's Noah's birthday today.", 'day-of + no-year copy omits age (FR-14)');
    check(noah.canGreet === false, 'Send-greeting hidden when no phone (FR-30)');

    const week = items.find((i) => i.person.fullName === 'Week Friend')!;
    check(week.daysRemaining === 7 && /Week Friend turns \d+ in 7 days\./.test(week.message), 'lead-time copy: "X turns N in 7 days."');

    // --- Dispatch (FR-22) ---------------------------------------------------
    let summary = await dispatchDue(new Date());
    check(summary.sent === 3, `dispatch fires the 3 due reminders (got ${summary.sent})`);
    const sentCount = await Reminder.countDocuments({ user: userAId, status: 'sent' });
    check(sentCount === 3, 'the 3 due instances are now marked sent with sentAt');

    // Idempotency: a second pass sends nothing (no double-send).
    summary = await dispatchDue(new Date());
    check(summary.sent === 0, 'dispatch is idempotent — no double-send on the second pass');

    // --- Mark as done (FR-31/32) -------------------------------------------
    res = await post(`/reminders/${aisha.id}/done`, undefined, tokenA);
    let body = await res.json();
    check(res.status === 200 && body.reminder.status === 'done', 'POST /reminders/:id/done → done');
    items = await feed(tokenA);
    check(items.length === 3, 'done reminder stays in the feed (persists, de-emphasized)');
    check(items.find((i) => i.person.fullName === 'Aisha Khan')!.status === 'done', 'done status reflected in the feed');

    // --- Snooze (FR-33) -----------------------------------------------------
    res = await post(`/reminders/${noah.id}/snooze`, { preset: 'tomorrow' }, tokenA);
    body = await res.json();
    check(res.status === 200 && body.reminder.status === 'snoozed', 'POST /reminders/:id/snooze → snoozed');
    const until = new Date(body.snoozeUntil);
    check(until.getTime() > Date.now(), 'snooze sets a future snoozeUntil');
    // After the snooze elapses, the dispatcher promotes it back and re-delivers.
    summary = await dispatchDue(new Date(until.getTime() + 60 * 60 * 1000));
    check(summary.promoted >= 1 && summary.sent === 1, 'snoozed reminder re-fires once after the delay (and nothing else)');

    // --- Annual rotation (FR-12): a birthday that just passed schedules next year
    res = await post('/people', { fullName: 'Past Friend', dob: { ...md(plusDays(todayUTC, -1)), year: 2000 } }, tokenA);
    const pastPersonId: string = (await res.json()).person.id;
    const pastEventId: string = (await (await get(`/people/${pastPersonId}`, tokenA)).json()).events[0].id;
    const pastReminder = await Reminder.findOne({ event: pastEventId, leadDays: 0 });
    const rolledDays = pastReminder ? Math.round((pastReminder.occurrenceDate.getTime() - todayUTC.getTime()) / MS_PER_DAY) : 0;
    check(rolledDays >= 360, `passed birthday rotates to next year's occurrence (~${rolledDays} days out)`);

    // --- Timezone correctness (FR-51): same wall-clock, different absolute instant
    const occ = new Date(Date.UTC(2026, 5, 22));
    const utcFire = fireInstant(occ, 0, 'UTC', '09:00');
    const kolFire = fireInstant(occ, 0, 'Asia/Kolkata', '09:00');
    check(utcFire.getTime() - kolFire.getTime() === 5.5 * 60 * 60 * 1000, '09:00 fires 5h30m earlier (absolute) in Asia/Kolkata than in UTC');

    // --- Push-token registration (FR-23/54) --------------------------------
    res = await post('/me/push-tokens', { token: 'ExponentPushToken[abc123]' }, tokenA);
    body = await res.json();
    check(res.status === 201 && body.pushTokens.includes('ExponentPushToken[abc123]'), 'register push token → stored');
    res = await post('/me/push-tokens', { token: 'ExponentPushToken[abc123]' }, tokenA);
    body = await res.json();
    check(body.pushTokens.filter((t: string) => t === 'ExponentPushToken[abc123]').length === 1, 're-registering the same token de-dups');
    res = await del('/me/push-tokens', { token: 'ExponentPushToken[abc123]' }, tokenA);
    body = await res.json();
    check(res.status === 200 && !body.pushTokens.includes('ExponentPushToken[abc123]'), 'unregister push token → removed');

    // --- Ownership: B cannot act on A's reminder ---------------------------
    res = await post(`/reminders/${week.id}/done`, undefined, tokenB);
    check(res.status === 403, "another user can't act on your reminder → 403");

    // --- Zero-channel rule (FR-26): in-app feed stays as a silent fallback ---
    await patch('/me', { defaultReminderTime: '00:00' }, tokenB);
    res = await patch('/me', { channelPreferences: { push: false, email: false, sms: false, inApp: false } }, tokenB);
    check(res.status === 200, 'B disables every channel → 200');
    res = await post('/people', { fullName: 'Quiet Friend', dob: { ...md(todayUTC) } }, tokenB);
    check(res.status === 201, 'create person under zero channels → 201');
    const userBId: string = (await (await get('/me', tokenB)).json()).id;
    const zeroReminder = await Reminder.findOne({ user: userBId, leadDays: 0 });
    check(!!zeroReminder && zeroReminder.channels.length === 0, 'zero-channel reminder stores no delivery channels');
    const feedB = await feed(tokenB);
    check(feedB.length === 1 && feedB[0].person.fullName === 'Quiet Friend', 'zero-channel reminder still appears in the in-app feed (FR-26)');
    summary = await dispatchDue(new Date());
    check(summary.sent === 1, 'zero-channel reminder still "dispatches" (in-app persisted), never lost');

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
