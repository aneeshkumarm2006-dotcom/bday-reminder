/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 7 - onboarding, contact import, CSV bulk
 * import, and duplicate detection - against an ephemeral MongoDB over real HTTP.
 * Verifies the "Done when": a new user can finish onboarding (defaults set +
 * flag persisted), import a CSV (parsed + column-mapped + many date formats) and
 * structured device-contact rows, and is correctly prompted to resolve
 * duplicates (merge / keep both / skip) - never a silent auto-merge or overwrite
 * (FR-2/3/6/7/11, §10).
 *
 * Run: npm run smoke:stage7
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

  type PreviewRow = {
    id: string;
    name: string;
    relationshipTag: string | null;
    phone: string | null;
    dob: { month: number; day: number; year: number | null } | null;
    status: 'ready' | 'duplicate' | 'invalid';
    error: string | null;
    duplicate: { kind: 'existing' | 'batch'; personId: string | null; fullName: string } | null;
  };

  try {
    // --- Accounts -----------------------------------------------------------
    let res = await post('/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenA: string = (await res.json()).accessToken;
    res = await post('/auth/signup', { name: 'Bo', email: 'bo@example.com', password: 'supersecret', timezone: 'UTC' });
    const tokenB: string = (await res.json()).accessToken;

    // One day-of lead so every created person yields exactly one reminder.
    await patch('/me', { defaultLeadDays: [0] }, tokenA);

    // --- Onboarding flag (FR-2/3) -------------------------------------------
    let me = await (await get('/me', tokenA)).json();
    check(me.hasOnboarded === false, 'a fresh user starts not-onboarded (hasOnboarded:false)');

    res = await patch('/me', { onboarded: false }, tokenA);
    check(res.status === 400, "onboarded can't be set false (one-way) → 400");

    res = await patch('/me', { onboarded: true }, tokenA);
    check(res.status === 200 && (await res.json()).hasOnboarded === true, 'PATCH /me { onboarded:true } marks onboarding complete');
    me = await (await get('/me', tokenA)).json();
    check(me.hasOnboarded === true, 'the onboarded flag persists across requests (one account, synced - FR-4)');
    res = await patch('/me', { onboarded: true }, tokenA);
    check(res.status === 200, 're-marking onboarded is an idempotent no-op');

    // --- Import requires auth ----------------------------------------------
    res = await post('/import/preview', { csv: 'name,date of birth\nX,2000-01-01' });
    check(res.status === 401, 'POST /import/preview requires auth → 401');
    res = await post('/import/commit', { items: [] });
    check(res.status === 401, 'POST /import/commit requires auth → 401');

    // --- Seed an existing person to detect duplicates against (FR-11) -------
    res = await post(
      '/people',
      { fullName: 'Frank Foster', relationshipTag: 'Cousin', dob: { month: 12, day: 25, year: 1980 } },
      tokenA,
    );
    const frankId: string = (await res.json()).person.id;
    check(res.status === 201, 'seed an existing person (Frank Foster, born 25 Dec 1980)');

    // --- CSV preview: parsing, column mapping, date formats, dups (FR-7/11) --
    const csv = [
      'name,relationship,date of birth,phone',
      'Alice Adams,Friend,1990-03-05,+15551111', // ISO
      'Bob Brown,Family,15/08/1985,+15552222', // DD/MM (15>12 ⇒ day forced; still parses)
      'Carol King,Colleague,March 5,+15553333', // month name, no year
      '"Dave, Jr",Friend,5 Jun 92,', // quoted comma + 2-digit year
      ',Friend,1990-01-01,', // no name → invalid
      'Eve Evans,Friend,notadate,', // unreadable date → invalid
      'Frank Foster,Family,1980-12-25,+15558888', // duplicate of an existing person
      'Grace Green,Friend,2000-07-04,', // first Grace
      'Grace Green,Friend,2000-07-04,+15559999', // duplicate within the batch
      'Henry Hill,Friend,03/04/1991,', // ambiguous numeric ⇒ month-first (Mar 4), US/CA
    ].join('\n');

    res = await post('/import/preview', { csv }, tokenA);
    check(res.status === 200, 'POST /import/preview parses a CSV → 200');
    let body = await res.json();
    const rows = body.rows as PreviewRow[];
    const byName = (n: string) => rows.filter((r) => r.name === n);

    check(rows.length === 10, `preview returns one row per CSV data line (got ${rows.length})`);
    check(
      body.summary.total === 10 && body.summary.ready === 6 && body.summary.duplicates === 2 && body.summary.invalid === 2,
      `summary counts: total 10 / ready 6 / dup 2 / invalid 2 (got ${JSON.stringify(body.summary)})`,
    );

    const alice = byName('Alice Adams')[0];
    check(alice.status === 'ready' && alice.dob?.month === 3 && alice.dob?.day === 5 && alice.dob?.year === 1990, 'ISO date 1990-03-05 → {3,5,1990}');
    const bob = byName('Bob Brown')[0];
    check(bob.dob?.month === 8 && bob.dob?.day === 15 && bob.dob?.year === 1985, '15/08/1985 → {8,15,1985} (15>12 forces day; a clear DD/MM still parses)');
    const carol = byName('Carol King')[0];
    check(carol.dob?.month === 3 && carol.dob?.day === 5 && carol.dob?.year === null, '"March 5" → {3,5,null} (year omitted, FR-14)');
    const dave = byName('Dave, Jr')[0];
    check(!!dave && dave.dob?.month === 6 && dave.dob?.day === 5 && dave.dob?.year === 1992, 'quoted "Dave, Jr" keeps its comma; "5 Jun 92" → {6,5,1992} (2-digit year expanded)');
    const henry = byName('Henry Hill')[0];
    check(henry.dob?.month === 3 && henry.dob?.day === 4, 'ambiguous 03/04/1991 → month-first {3,4} (March 4), US/CA');

    const noName = rows.find((r) => r.name === '')!;
    check(noName.status === 'invalid' && /name/i.test(noName.error ?? ''), 'a row with no name is invalid + says the fix');
    const eve = byName('Eve Evans')[0];
    check(eve.status === 'invalid' && /notadate/.test(eve.error ?? ''), 'an unreadable date is invalid + quotes the bad value');

    const frankRow = byName('Frank Foster')[0];
    check(frankRow.status === 'duplicate' && frankRow.duplicate?.kind === 'existing' && frankRow.duplicate?.personId === frankId, 'a CSV row matching an existing person is flagged as a possible duplicate (existing)');
    const graceRows = byName('Grace Green');
    check(graceRows[0].status === 'ready' && graceRows[1].status === 'duplicate' && graceRows[1].duplicate?.kind === 'batch', 'two identical rows in one import → the second is a duplicate (batch)');

    // Duplicate detection is per-owner: Bo doesn't see Ada's Frank as a dup.
    res = await post('/import/preview', { csv: 'name,date of birth\nFrank Foster,1980-12-25' }, tokenB);
    body = await res.json();
    check(body.rows[0].status === 'ready', "another user's identical person is NOT flagged (dedup is per-owner)");

    // --- Commit: add (keep both) / merge / skip (FR-11, §10) ----------------
    const items = [
      ...['Alice Adams', 'Bob Brown', 'Carol King', 'Dave, Jr', 'Henry Hill'].map((n) => {
        const r = byName(n)[0];
        return { name: r.name, relationshipTag: r.relationshipTag, phone: r.phone, dob: r.dob, resolution: 'add' as const };
      }),
      // Keep the first Grace, drop the in-batch duplicate.
      (() => { const r = graceRows[0]; return { name: r.name, relationshipTag: r.relationshipTag, phone: r.phone, dob: r.dob, resolution: 'add' as const }; })(),
      { name: graceRows[1].name, relationshipTag: graceRows[1].relationshipTag, phone: graceRows[1].phone, dob: graceRows[1].dob, resolution: 'skip' as const },
      // Merge the existing-person duplicate into Frank.
      { name: frankRow.name, relationshipTag: frankRow.relationshipTag, phone: frankRow.phone, dob: frankRow.dob, resolution: 'merge' as const, mergeTargetId: frankId },
    ];

    res = await post('/import/commit', { items }, tokenA);
    check(res.status === 201, 'POST /import/commit → 201');
    body = await res.json();
    check(
      body.summary.added === 6 && body.summary.merged === 1 && body.summary.skipped === 1,
      `commit summary: added 6 / merged 1 / skipped 1 (got ${JSON.stringify(body.summary)})`,
    );

    // 6 added + the pre-existing Frank = 7 people (the skipped Grace dup not created).
    res = await get('/people', tokenA);
    const people = (await res.json()).people as { id: string; fullName: string }[];
    check(people.length === 7, `import added 6 people on top of the existing 1 (got ${people.length})`);
    check(people.filter((p) => p.fullName === 'Grace Green').length === 1, 'the skipped in-batch duplicate was not created (one Grace, not two)');

    // Merge fills empty fields but never overwrites populated ones (§10).
    res = await get(`/people/${frankId}`, tokenA);
    const frank = (await res.json()).person;
    check(frank.phone === '+15558888', "merge filled Frank's empty phone from the import");
    check(frank.relationshipTag === 'Cousin', "merge did NOT overwrite Frank's existing tag (no silent overwrite, §10)");

    // Each created person got their day-of reminder (engine ran on commit).
    const reminderCount = await Reminder.countDocuments({ user: me.id });
    check(reminderCount === 7, `one day-of reminder per person after import: 7 (got ${reminderCount})`);

    // --- Contact import path: structured rows, dob-less skipped (FR-6) ------
    res = await post(
      '/import/preview',
      {
        candidates: [
          { name: 'Iris Ito', phone: '+1', dob: { month: 2, day: 14, year: 1995 } },
          { name: 'Jack Jones', dob: null }, // no birthday field → not importable
          { name: '', dob: { month: 1, day: 1 } }, // no name
          { name: 'Kate Kim', dob: { month: 13, day: 1 } }, // impossible date
        ],
      },
      tokenA,
    );
    body = await res.json();
    check(body.summary.ready === 1 && body.summary.invalid === 3, 'contacts preview: only the one with a valid birthday is importable (FR-6)');
    const iris = (body.rows as PreviewRow[]).find((r) => r.name === 'Iris Ito')!;
    check(iris.status === 'ready' && iris.dob?.month === 2 && iris.dob?.day === 14, 'a structured contact birthday passes through to a ready row');

    // --- Empty / cross-user guards ------------------------------------------
    res = await post('/import/preview', {}, tokenA);
    check(res.status === 400, 'preview with neither csv nor candidates → 400');
    res = await post('/import/commit', { items: [{ name: 'Z', dob: { month: 5, day: 5 }, resolution: 'merge' }] }, tokenA);
    check(res.status === 400, 'a merge with no target → 400');
    res = await post(
      '/import/commit',
      { items: [{ name: 'Z', dob: { month: 5, day: 5 }, resolution: 'merge', mergeTargetId: frankId }] },
      tokenB,
    );
    body = await res.json();
    check(res.status === 201 && body.summary.skipped === 1 && body.summary.merged === 0, "merging into another user's person is skipped, not applied (ownership, §10)");

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
