/* eslint-disable no-console */
/**
 * End-to-end smoke test for shared birthdays + the catch-up, against an
 * ephemeral MongoDB over real HTTP. Verifies the "Done when": joining a list
 * publishes the joiner's own birthday to it so the members already there get
 * reminded about them, the joiner receives every birthday already in the list,
 * and they can drop the ones they don't want without hiding them or affecting
 * anyone else's calendar.
 *
 * Runs it at the size the feature exists for: a 100-person list.
 *
 * Run: npm run smoke:shared-birthday
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
  const { Person } = await import('../src/models/Person');
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

  const reminderCount = (userId: string) => Reminder.countDocuments({ user: userId });

  interface PersonRow {
    id: string;
    fullName: string;
    selfUserId: string | null;
    inMyCalendar: boolean;
    isMine: boolean;
  }
  const peopleIn = async (listId: string, token: string): Promise<PersonRow[]> =>
    (await (await get(`/people?list=${listId}`, token)).json()).people;

  const ADA_BIRTHDAY = { month: 3, day: 12, year: 1985 };
  const BO_BIRTHDAY = { month: 9, day: 4, year: 1990 };
  const HEADCOUNT = 100;

  try {
    // --- Accounts -----------------------------------------------------------
    let res = await post('/auth/signup', {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'supersecret',
      birthday: ADA_BIRTHDAY,
      timezone: 'UTC',
    });
    let json = await res.json();
    const tokenA: string = json.accessToken;
    const adaId: string = json.user.id;
    check(
      json.user.birthday.month === 3 && json.user.birthday.day === 12,
      'signup stores the account holder’s own birthday',
    );

    res = await post('/auth/signup', {
      name: 'Bo',
      email: 'bo@example.com',
      password: 'supersecret',
      birthday: BO_BIRTHDAY,
      timezone: 'UTC',
    });
    json = await res.json();
    const tokenB: string = json.accessToken;
    const boId: string = json.user.id;

    await patch('/me', { defaultLeadDays: [0] }, tokenA);
    await patch('/me', { defaultLeadDays: [0] }, tokenB);

    // --- A list with 100 birthdays in it ------------------------------------
    res = await post('/lists', { name: 'The Cohort' }, tokenA);
    const listId: string = (await res.json()).list.id;

    const ownerCard = (await peopleIn(listId, tokenA)).find((p) => p.selfUserId === adaId);
    check(!!ownerCard, 'creating a list puts the owner’s own birthday in it');
    check(
      ownerCard!.inMyCalendar === false,
      'the owner is not reminded about their own birthday (their card is excluded for them)',
    );

    for (let i = 0; i < HEADCOUNT; i += 1) {
      await post(
        '/people',
        {
          fullName: `Person ${i}`,
          dob: { month: 1 + (i % 12), day: 1 + (i % 28) },
          lists: [listId],
        },
        tokenA,
      );
    }
    check(
      (await peopleIn(listId, tokenA)).length === HEADCOUNT + 1,
      `the list holds ${HEADCOUNT} birthdays plus the owner’s`,
    );
    check((await reminderCount(adaId)) === HEADCOUNT, 'the owner is reminded about all of them, and not herself');

    // --- Joining: the exchange runs both ways -------------------------------
    res = await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenA);
    const token1: string = (await res.json()).invite.token;

    const preview = (await (await get(`/invites/${token1}`, tokenB)).json()).invite;
    check(preview.peopleCount === HEADCOUNT + 1, 'the invite preview says how many birthdays are waiting');
    check(preview.yourBirthday.month === 9, 'the invite preview knows the birthday it would share');

    res = await post(`/invites/${token1}/accept`, undefined, tokenB);
    const accept = await res.json();
    check(res.status === 200 && accept.selfPerson.created === true, 'accepting shares the joiner’s birthday into the list');

    const boCard = (await peopleIn(listId, tokenA)).find((p) => p.selfUserId === boId);
    check(boCard?.fullName === 'Bo', 'the members already there can now see the newcomer’s birthday');
    check((await reminderCount(adaId)) === HEADCOUNT + 1, 'and they get reminded about it');
    check(
      (await reminderCount(boId)) === HEADCOUNT + 1,
      'the newcomer picks up every birthday in the list, plus the owner’s - but not their own',
    );

    // --- Catch-up: keep 20, drop 80 -----------------------------------------
    const shared = await peopleIn(listId, tokenB);
    check(shared.length === HEADCOUNT + 2, 'the catch-up screen loads the whole list in one request');
    check(
      shared.filter((p) => p.isMine).length === 1 &&
        shared.find((p) => p.isMine)!.selfUserId === boId,
      'everything on it is shared with the newcomer, except the card of themselves',
    );

    const drop = shared.filter((p) => p.fullName.startsWith('Person ')).slice(0, 80);
    res = await post('/me/calendar-people', { remove: drop.map((p) => p.id) }, tokenB);
    json = await res.json();
    check(res.status === 200, 'the catch-up submits every choice in one call → 200');
    check(json.excludedPersonIds.length === 81, 'the response is the authoritative excluded set (80 + their own card)');
    check((await reminderCount(boId)) === HEADCOUNT + 1 - 80, 'dropping people removes their reminders straight away');

    const afterDrop = await peopleIn(listId, tokenB);
    check(
      afterDrop.length === HEADCOUNT + 2 && afterDrop.filter((p) => !p.inMyCalendar).length === 81,
      'the dropped people are still visible in the list - you have to see someone to put them back',
    );
    const upcoming = (await (await get('/upcoming', tokenB)).json()).items as { id: string }[];
    check(upcoming.length === HEADCOUNT + 1 - 80, 'but they are out of the upcoming feed');
    const grid = (await (await get('/calendar/events', tokenB)).json()).events as { personId: string }[];
    const droppedIds = new Set(drop.map((p) => p.id));
    check(!grid.some((e) => droppedIds.has(e.personId)), 'and out of the month grid');

    check((await reminderCount(adaId)) === HEADCOUNT + 1, 'the owner’s own calendar is completely unaffected');

    res = await post('/me/calendar-people', { add: drop.slice(0, 10).map((p) => p.id) }, tokenB);
    check(res.status === 200, 'putting people back → 200');
    check((await reminderCount(boId)) === HEADCOUNT + 1 - 70, 'putting people back restores their reminders');

    // --- The card follows the account ---------------------------------------
    await patch('/me', { name: 'Bo Turner', birthday: { month: 5, day: 2, year: 1991 } }, tokenB);
    const renamed = (await peopleIn(listId, tokenA)).find((p) => p.selfUserId === boId);
    check(renamed?.fullName === 'Bo Turner', 'renaming the account renames the shared card');
    const detail = await (await get(`/people/${renamed!.id}`, tokenA)).json();
    check(
      detail.person.dob.month === 5 && detail.person.dob.day === 2,
      'changing your birthday moves the date everyone is reminded on',
    );
    res = await patch(`/people/${renamed!.id}`, { fullName: 'Nickname' }, tokenA);
    check(res.status === 403, 'another member cannot rename someone else’s own entry → 403');
    res = await patch(`/people/${renamed!.id}`, { relationshipTag: 'Cousin' }, tokenA);
    check(res.status === 200, 'but everything else about it stays open to the list (FR-43/45)');

    // --- Leaving takes your birthday with you -------------------------------
    res = await post(`/lists/${listId}/leave`, undefined, tokenB);
    check(res.status === 204, 'the newcomer leaves → 204');
    check(
      !(await peopleIn(listId, tokenA)).some((p) => p.selfUserId === boId),
      'leaving stops broadcasting their birthday to the list',
    );
    check((await Person.countDocuments({ selfUser: boId })) === 0, 'the card is gone, not orphaned');
    check((await reminderCount(adaId)) === HEADCOUNT, 'and the remaining members stop being reminded about them');
    check((await reminderCount(boId)) === 0, 'the leaver loses the list’s reminders immediately (FR-46)');

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
