/* eslint-disable no-console */
/**
 * End-to-end smoke test for Stage 8 — shared / family lists — against an
 * ephemeral MongoDB over real HTTP. Verifies the "Done when": two accounts can
 * share a list, the invitee must accept before access, edit permissions are
 * enforced, both see the same people but receive reminders per their own
 * settings, attribution shows, and leaving/removal stops reminders
 * (FR-41–47, §8.11, §10).
 *
 * Run: npm run smoke:stage8
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
  const del = (p: string, t?: string) => req('DELETE', p, undefined, t);
  const get = (p: string, t?: string) => req('GET', p, undefined, t);

  const reminderCount = (userId: string) => Reminder.countDocuments({ user: userId });

  // "Today" in UTC so a person born now is day-of and yields exactly one
  // reminder per recipient (lead [0]).
  const now = new Date();
  const todayDob = { month: now.getUTCMonth() + 1, day: now.getUTCDate(), year: 1971 };

  try {
    // --- Accounts -----------------------------------------------------------
    let res = await post('/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'supersecret', timezone: 'UTC' });
    let json = await res.json();
    const tokenA: string = json.accessToken;
    const adaId: string = json.user.id;

    res = await post('/auth/signup', { name: 'Bo', email: 'bo@example.com', password: 'supersecret', timezone: 'UTC' });
    json = await res.json();
    const tokenB: string = json.accessToken;
    const boId: string = json.user.id;

    // One day-of lead each so every shared person yields exactly one reminder.
    await patch('/me', { defaultLeadDays: [0] }, tokenA);
    await patch('/me', { defaultLeadDays: [0] }, tokenB);

    // --- Auth guards --------------------------------------------------------
    check((await get('/lists')).status === 401, 'GET /lists requires auth → 401');
    check((await post('/lists', { name: 'X' })).status === 401, 'POST /lists requires auth → 401');

    // --- Create a list (FR-41) ----------------------------------------------
    res = await post('/lists', { name: '' }, tokenA);
    check(res.status === 400, 'creating a list with a blank name → 400 (says the fix)');

    res = await post('/lists', { name: 'Family' }, tokenA);
    check(res.status === 201, 'Ada creates a "Family" list → 201');
    const list = (await res.json()).list;
    const listId: string = list.id;
    check(list.role === 'owner' && list.permission === 'owner', 'creator is the owner with owner permission');
    check(list.memberCount === 1 && list.members[0].isOwner, 'a new list has just the owner as a member');

    // --- Add a shared person (FR-44) ----------------------------------------
    res = await post('/people', { fullName: 'Mum', dob: todayDob, lists: [listId] }, tokenA);
    check(res.status === 201, 'Ada adds Mum to the shared list → 201');
    const mumId: string = (await res.json()).person.id;

    check((await reminderCount(adaId)) === 1, 'Ada gets her own day-of reminder for Mum');
    check((await reminderCount(boId)) === 0, 'Bo has no reminders yet (not a member)');

    let people = (await (await get('/people', tokenB)).json()).people as { id: string }[];
    check(!people.some((p) => p.id === mumId), 'Bo cannot see Mum before accepting (no silent access, FR-42)');

    // --- Invite must be accepted (FR-41/42) ---------------------------------
    res = await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenB);
    check(res.status === 404, 'a non-member cannot invite to (or even see) the list → 404');

    res = await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenA);
    check(res.status === 201, 'Ada invites Bo by email → 201');
    const invite = await res.json();
    const token1: string = invite.invite.token;
    check(!!token1 && invite.invite.status === 'pending', 'the invite is created pending with an accept token');
    check(invite.emailOutcome === 'skipped', 'without a Resend key the invite email is skipped (invite still works)');

    const ownerView = (await (await get(`/lists/${listId}`, tokenA)).json()).list;
    check(ownerView.pendingInvites.length === 1, 'the owner sees the pending invite');

    let listsB = (await (await get('/lists', tokenB)).json()).lists as unknown[];
    check(listsB.length === 0, 'Bo still has no access to the list before accepting');

    // Preview the invite, then accept it.
    res = await get(`/invites/${token1}`, tokenB);
    const preview = (await res.json()).invite;
    check(
      preview.listName === 'Family' && preview.inviterName === 'Ada' && preview.permission === 'view' && preview.alreadyMember === false,
      'Bo can preview the invite (list name, inviter, permission, not-yet-member)',
    );

    res = await post(`/invites/${token1}/accept`, undefined, tokenB);
    check(res.status === 200, 'Bo accepts the invite → 200');
    const afterAccept = (await res.json()).list;
    check(afterAccept.members.some((m: { id: string; permission: string }) => m.id === boId && m.permission === 'view'), 'Bo is now a view member of the list');

    // --- Shared data, personal reminders (FR-44) ----------------------------
    people = (await (await get('/people', tokenB)).json()).people as { id: string; access?: string }[];
    const mumForBo = people.find((p) => p.id === mumId);
    check(!!mumForBo, 'Bo now sees the shared person Mum');
    check(mumForBo?.access === 'view', "Bo's access to Mum reads as view");

    check((await reminderCount(boId)) === 1, 'accepting generated Bo his OWN day-of reminder for Mum (FR-44)');
    check((await reminderCount(adaId)) === 1, "Ada's reminders are unchanged by Bo joining");
    const boReminder = await Reminder.findOne({ user: boId });
    check(boReminder !== null && boReminder.user.toString() === boId, "Bo's reminder is a distinct per-recipient instance");

    const refreshedOwnerView = (await (await get(`/lists/${listId}`, tokenA)).json()).list;
    check(refreshedOwnerView.pendingInvites.length === 0, 'the invite is no longer pending after acceptance');

    // --- Permission enforcement: view-only is read-only (FR-43/45, §14) -----
    check((await patch(`/people/${mumId}`, { phone: '+100' }, tokenB)).status === 403, 'a view-only member cannot edit a shared person → 403');
    check((await post(`/people/${mumId}/notes`, { text: 'socks' }, tokenB)).status === 403, 'a view-only member cannot add notes → 403 (§14 default)');
    check((await post('/events', { person: mumId, type: 'anniversary', date: todayDob }, tokenB)).status === 403, 'a view-only member cannot add an event → 403');
    check((await del(`/people/${mumId}`, tokenB)).status === 403, 'a view-only member cannot delete a shared person → 403');
    check((await get(`/people/${mumId}`, tokenB)).status === 200, 'a view-only member CAN read the shared person → 200');

    // --- Owner promotes to edit (FR-43) -------------------------------------
    res = await patch(`/lists/${listId}/members/${boId}`, { permission: 'edit' }, tokenB);
    check(res.status === 403, 'a member cannot change permissions → 403');
    res = await patch(`/lists/${listId}/members/${boId}`, { permission: 'edit' }, tokenA);
    check(res.status === 200, 'the owner promotes Bo to edit → 200');
    check((await (await get(`/people/${mumId}`, tokenB)).json()).person.access === 'edit', "Bo's access to Mum is now edit");

    // --- Edit + attribution (FR-45) -----------------------------------------
    res = await patch(`/people/${mumId}`, { phone: '+15551234' }, tokenB);
    check(res.status === 200, 'an edit member can now edit the shared person → 200');
    const mumAfterEdit = (await (await get(`/people/${mumId}`, tokenA)).json()).person;
    check(mumAfterEdit.phone === '+15551234', "Bo's edit is visible to Ada (shared data)");
    check(mumAfterEdit.lastEditedBy?.name === 'Bo', 'attribution shows "last edited by Bo" to everyone (FR-45)');

    res = await post('/events', { person: mumId, type: 'anniversary', date: todayDob }, tokenB);
    check(res.status === 201, 'an edit member can add an event to the shared person → 201');
    check((await reminderCount(adaId)) === 2 && (await reminderCount(boId)) === 2, 'the new event reminds BOTH members, each their own instance');

    res = await post(`/people/${mumId}/notes`, { text: 'Likes gardening' }, tokenB);
    check(res.status === 201, 'an edit member can add a gift note → 201');
    const notes = (await (await get(`/people/${mumId}/notes`, tokenA)).json()).notes as { text: string; author: string }[];
    check(notes.some((n) => n.text === 'Likes gardening' && n.author === boId), 'the note is shared within the list and attributed to Bo (FR-37)');

    // --- Personal settings stay independent (FR-44) -------------------------
    await patch('/me', { defaultReminderTime: '18:00' }, tokenB);
    check((await reminderCount(adaId)) === 2 && (await reminderCount(boId)) === 2, "changing Bo's reminder time doesn't change Ada's reminders");
    const adaBday = await Reminder.findOne({ user: adaId, leadDays: 0 }).sort({ scheduledFor: 1 });
    const boBday = await Reminder.findOne({ user: boId, leadDays: 0 }).sort({ scheduledFor: 1 });
    check(
      adaBday !== null && boBday !== null && adaBday.scheduledFor.getUTCHours() === 9 && boBday.scheduledFor.getUTCHours() === 18,
      'each member fires at their own configured time (Ada 09:00, Bo 18:00) — shared data, personal settings',
    );

    // --- Leaving stops reminders (FR-46) ------------------------------------
    res = await post(`/lists/${listId}/leave`, undefined, tokenA);
    check(res.status === 400, 'the owner cannot leave their own list → 400 (delete it instead)');

    res = await post(`/lists/${listId}/leave`, undefined, tokenB);
    check(res.status === 204, 'Bo leaves the list → 204');
    people = (await (await get('/people', tokenB)).json()).people as { id: string }[];
    check(!people.some((p) => p.id === mumId), 'after leaving, Bo no longer sees the shared people');
    check((await reminderCount(boId)) === 0, "after leaving, Bo's reminders for the list stop immediately (FR-46)");
    check((await reminderCount(adaId)) === 2, "Ada's reminders are untouched when Bo leaves");

    // --- Re-invite, then member-not-owner guards + owner removal (FR-46) -----
    res = await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'bo@example.com', permission: 'edit' }, tokenA);
    const token2: string = (await res.json()).invite.token;
    await post(`/invites/${token2}/accept`, undefined, tokenB);
    check((await reminderCount(boId)) === 2, 'rejoining restores Bo\'s reminders for the shared people');

    check((await patch(`/lists/${listId}`, { name: 'Hax' }, tokenB)).status === 403, 'a member cannot rename the list → 403');
    check((await del(`/lists/${listId}`, tokenB)).status === 403, 'a member cannot delete the list → 403');
    check((await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'x@example.com' }, tokenB)).status === 403, 'a member (non-owner) cannot invite others → 403');

    res = await del(`/lists/${listId}/members/${boId}`, tokenA);
    check(res.status === 200, 'the owner removes Bo from the list → 200');
    check((await reminderCount(boId)) === 0, "after removal, Bo's reminders for the list stop immediately (FR-46)");
    people = (await (await get('/people', tokenB)).json()).people as { id: string }[];
    check(!people.some((p) => p.id === mumId), 'after removal, Bo no longer sees the shared people');

    // --- Non-member + invalid-token guards ----------------------------------
    check((await get(`/lists/${listId}`, tokenB)).status === 404, 'a non-member cannot see the list → 404');
    check((await get(`/people/${mumId}`, tokenB)).status === 403, "a non-member cannot read the owner's person → 403");
    check((await get('/invites/not-a-real-token', tokenB)).status === 404, 'previewing an invalid invite token → 404');
    check((await post('/invites/not-a-real-token/accept', undefined, tokenB)).status === 404, 'accepting an invalid invite token → 404');

    // --- Delete the list (FR-47) --------------------------------------------
    // Re-add Bo so we can prove deletion revokes a live member too.
    res = await post(`/lists/${listId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenA);
    await post(`/invites/${(await res.json()).invite.token}/accept`, undefined, tokenB);
    check((await reminderCount(boId)) === 2, 'Bo rejoined once more before the list is deleted');

    res = await del(`/lists/${listId}`, tokenA);
    check(res.status === 204, 'the owner deletes the list → 204');
    check((await reminderCount(boId)) === 0, 'deleting the list stops every member\'s reminders (all lose access, FR-47)');

    const mumAfterDelete = (await (await get(`/people/${mumId}`, tokenA)).json()).person;
    check(mumAfterDelete && mumAfterDelete.lists.length === 0, 'the people survive list deletion, detached from the list (§10)');
    check((await reminderCount(adaId)) === 2, "the owner still owns the people and keeps her reminders after deleting the list");
    listsB = (await (await get('/lists', tokenA)).json()).lists as unknown[];
    check(listsB.length === 0, 'the deleted list is gone from the owner\'s lists');

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
