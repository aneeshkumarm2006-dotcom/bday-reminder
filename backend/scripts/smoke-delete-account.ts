/* eslint-disable no-console */
/**
 * End-to-end smoke test for account deletion (DELETE /me, §10) against an
 * ephemeral MongoDB over real HTTP. Verifies the "Done when": deleting an account
 * erases EVERYTHING tied to it - the user, their people/events/reminders/notes,
 * the shared lists they own (with invites), their membership in other people's
 * lists, and their refresh tokens - while leaving every OTHER user's data intact
 * and pruning the now-stale reminders of members who lost shared-list access.
 *
 * Run: npm run smoke:delete-account
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
  const { User } = await import('../src/models/User');
  const { Person } = await import('../src/models/Person');
  const { Event } = await import('../src/models/Event');
  const { Reminder } = await import('../src/models/Reminder');
  const { Note } = await import('../src/models/Note');
  const { SharedList } = await import('../src/models/SharedList');
  const { Invite } = await import('../src/models/Invite');
  const { RefreshToken } = await import('../src/models/RefreshToken');

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

  // "Today" in UTC so a person born now is day-of and yields exactly one reminder
  // per recipient (lead [0]).
  const now = new Date();
  const todayDob = { month: now.getUTCMonth() + 1, day: now.getUTCDate(), year: 1971 };

  try {
    // --- Two accounts, one day-of lead each --------------------------------
    let res = await post('/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'supersecret', timezone: 'UTC' });
    let json = await res.json();
    const tokenA: string = json.accessToken;
    const adaId: string = json.user.id;

    res = await post('/auth/signup', { name: 'Bo', email: 'bo@example.com', password: 'supersecret', timezone: 'UTC' });
    json = await res.json();
    const tokenB: string = json.accessToken;
    const boId: string = json.user.id;

    await patch('/me', { defaultLeadDays: [0] }, tokenA);
    await patch('/me', { defaultLeadDays: [0] }, tokenB);

    // --- Ada's own people, an anniversary event, and a gift note ------------
    res = await post('/people', { fullName: 'Mom', dob: todayDob, events: [{ type: 'anniversary', date: todayDob }] }, tokenA);
    const momId: string = (await res.json()).person.id;
    await post(`/people/${momId}/notes`, { text: 'Gift idea: gardening gloves' }, tokenA);
    check((await Event.countDocuments({ person: momId })) === 2, 'Mom has a birthday + anniversary event');
    check((await Note.countDocuments({ person: momId })) === 1, 'Mom has one gift note');

    // --- Ada owns a shared list; Bo joins; a person is shared into it -------
    res = await post('/lists', { name: 'Family' }, tokenA);
    const familyId: string = (await res.json()).list.id;
    res = await post(`/lists/${familyId}/invite`, { invitedEmailOrPhone: 'bo@example.com' }, tokenA);
    const familyToken: string = (await res.json()).invite.token;
    await post(`/invites/${familyToken}/accept`, undefined, tokenB);

    res = await post('/people', { fullName: 'Dad', dob: todayDob, lists: [familyId] }, tokenA);
    const dadId: string = (await res.json()).person.id;
    // Capture Dad's event ids NOW - after deletion the events are gone, so we need
    // these to prove the shared reminders keyed on them were removed too.
    const dadEventIds = (await Event.find({ person: dadId }).select('_id')).map((e) => e._id);
    check((await reminderCount(boId)) >= 1, 'Bo receives a reminder for Ada-owned Dad (shared list)');

    // --- Bo owns a person shared back into Ada's Family list ----------------
    res = await post('/people', { fullName: 'Gran', dob: todayDob, lists: [familyId] }, tokenB);
    const granId: string = (await res.json()).person.id;

    // --- Bo owns a SEPARATE list that Ada is a member of --------------------
    res = await post('/lists', { name: 'Friends' }, tokenB);
    const friendsId: string = (await res.json()).list.id;
    res = await post(`/lists/${friendsId}/invite`, { invitedEmailOrPhone: 'ada@example.com' }, tokenB);
    const friendsToken: string = (await res.json()).invite.token;
    await post(`/invites/${friendsToken}/accept`, undefined, tokenA);
    res = await post('/people', { fullName: 'Pal', dob: todayDob, lists: [friendsId] }, tokenB);
    const palId: string = (await res.json()).person.id;
    check((await reminderCount(adaId)) >= 1, 'Ada receives a reminder for Bo-owned Pal (member of Friends)');

    const boRemindersBefore = await reminderCount(boId);
    check(boRemindersBefore >= 3, 'Bo has reminders for Dad, Gran, and Pal before the delete');

    // --- Guard: deletion requires auth -------------------------------------
    check((await del('/me')).status === 401, 'DELETE /me requires auth → 401');

    // --- Delete Ada's account ----------------------------------------------
    res = await del('/me', tokenA);
    check(res.status === 204, 'DELETE /me → 204');

    // --- The account and everything it owned is gone -----------------------
    check((await User.findById(adaId)) === null, 'Ada’s user record is deleted');
    check((await get('/me', tokenA)).status === 401, 'Ada’s access token no longer resolves a user → 401');
    check((await Person.countDocuments({ owner: adaId })) === 0, 'Ada’s owned people are deleted (Mom, Dad)');
    check((await Event.countDocuments({ person: { $in: [momId, dadId] } })) === 0, 'events of Ada’s people are deleted');
    check((await Reminder.countDocuments({ user: adaId })) === 0, 'Ada’s own reminders are deleted');
    check((await Note.countDocuments({ person: momId })) === 0, 'notes on Ada’s people are deleted');
    check((await Note.countDocuments({ author: adaId })) === 0, 'notes Ada authored are deleted');
    check((await RefreshToken.countDocuments({ user: adaId })) === 0, 'Ada’s refresh tokens are deleted');

    // --- Ada's owned shared list (+ its invites) is torn down --------------
    check((await SharedList.findById(familyId)) === null, 'the Family list Ada owned is deleted');
    check((await Invite.countDocuments({ list: familyId })) === 0, 'invites for the deleted list are removed');

    // --- Reminders for Ada's people vanish for OTHER viewers too ------------
    check((await Reminder.countDocuments({ event: { $in: dadEventIds } })) === 0, 'Bo’s reminder for Ada-owned Dad is gone');

    // --- Bo keeps everything Bo owns --------------------------------------
    check((await User.findById(boId)) !== null, 'Bo’s account is untouched');
    check((await get('/me', tokenB)).status === 200, 'Bo can still use the app');
    check((await Person.findById(granId)) !== null, 'Bo’s own person Gran survives');
    check((await Person.findById(palId)) !== null, 'Bo’s own person Pal survives');

    // Gran was shared into the now-deleted Family list → detached, not deleted.
    const gran = await Person.findById(granId);
    check(!!gran && gran.lists.every((l) => l.toString() !== familyId), 'Gran is detached from the deleted Family list');

    // Ada was a member of Bo's Friends list → removed from its members.
    const friends = await SharedList.findById(friendsId);
    check(!!friends && friends.members.every((m) => m.user.toString() !== adaId), 'Ada is removed from Bo’s Friends list members');

    // Bo still gets reminders for their own people; the stale Dad one is pruned.
    const boRemindersAfter = await reminderCount(boId);
    check(boRemindersAfter >= 2, 'Bo still has reminders for Gran and Pal');
    check(boRemindersAfter < boRemindersBefore, 'Bo’s stale reminder(s) for the deleted people were pruned');

    console.log(`\n✓ delete-account smoke passed (${passed.length} checks)`);
    passed.forEach((p) => console.log(`  - ${p}`));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDb();
    await mongod.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
