import { Types } from 'mongoose';

import { getUserListAccess, usersOfLists } from './access';
import { dedupeKey } from './import';
import { deletePersonCascade, syncBirthdayEvent } from './person-cascade';
import { generateForPersonViewers, syncUsersReminders } from '../jobs/reminder-engine';
import { Event } from '../models/Event';
import { Person, type PersonDoc } from '../models/Person';
import { PersonMute } from '../models/PersonMute';
import type { UserDoc } from '../models/User';

/**
 * Sharing your own birthday into a list.
 *
 * Until now the product only tracked *other* people: you could join a list of 40
 * birthdays and be reminded about every one while nobody was ever reminded about
 * you. Joining a list can now publish your birthday to it as an ordinary Person
 * carrying that list id - which means reminders, /upcoming, the month grid and
 * the ICS feed all pick it up with no changes of their own.
 *
 * The card is marked with `Person.selfUser` rather than an `isSelf` flag because
 * it may have been *adopted*: if a member already added a card for you, joining
 * claims that one instead of creating a duplicate, and it stays owned by whoever
 * made it. So the marker has to name the user it represents.
 *
 * Everything here is idempotent - re-accepting an invite, re-saving your profile,
 * and racing requests all converge on one card per user.
 */

/** Why `ensureSelfPersonInList` did or didn't produce a card, for the client. */
export type SelfShareReason =
  /** No birthday on the account - nothing to share yet. */
  | 'no-birthday'
  /** A new card was created for this user. */
  | 'created'
  /** An existing card another member had already made was claimed. */
  | 'matched'
  /** The user's existing card gained this list. */
  | 'added'
  /** The card was already in this list. */
  | 'present';

export interface SelfShareResult {
  person: PersonDoc | null;
  reason: SelfShareReason;
}

/** The user's card, wherever it lives and whoever owns it. */
export function findSelfPerson(userId: string | Types.ObjectId) {
  return Person.findOne({ selfUser: String(userId) });
}

/**
 * Claim a card another member already made for this user, rather than adding a
 * second one with the same name and date. Ownership deliberately does NOT move:
 * adoption records who the card is *about*, not who it belongs to - reassigning
 * it would silently take another member's data and change what account deletion
 * cascades.
 *
 * Matching reuses the import dedupe key (exact name + dob), so "Priya Sharma"
 * won't claim a card reading "Priya" and the list shows two entries. That's the
 * safe direction to be wrong in: a looser match could merge two siblings who
 * share a birthday, and the catch-up screen already lets everyone drop the
 * stale card.
 */
async function adoptExistingCard(user: UserDoc, listId: Types.ObjectId): Promise<PersonDoc | null> {
  if (!user.birthday) return null;
  const key = dedupeKey(user.name, {
    month: user.birthday.month,
    day: user.birthday.day,
    year: user.birthday.year ?? null,
  });

  const candidates = await Person.find({ lists: listId, selfUser: { $exists: false } });
  const match = candidates.find(
    (p) =>
      dedupeKey(p.fullName, { month: p.dob.month, day: p.dob.day, year: p.dob.year ?? null }) === key,
  );
  if (!match) return null;

  match.selfUser = user._id;
  match.updatedBy = user._id;
  await match.save();
  return match;
}

/**
 * Put the user's birthday into a list (FR-42 adjacent). No-op without a birthday
 * - the invite screen offers to collect one, and existing accounts have none
 * until they do.
 */
export async function ensureSelfPersonInList(
  user: UserDoc,
  listId: Types.ObjectId | string,
): Promise<SelfShareResult> {
  if (!user.birthday) return { person: null, reason: 'no-birthday' };
  const list = new Types.ObjectId(String(listId));

  const existing = await findSelfPerson(user._id);
  if (existing) {
    if (existing.lists.some((id) => id.equals(list))) {
      return { person: existing, reason: 'present' };
    }
    await Person.updateOne({ _id: existing._id }, { $addToSet: { lists: list } });
    const refreshed = (await Person.findById(existing._id))!;
    await generateForPersonViewers(refreshed);
    return { person: refreshed, reason: 'added' };
  }

  const adopted = await adoptExistingCard(user, list);
  if (adopted) {
    await generateForPersonViewers(adopted);
    return { person: adopted, reason: 'matched' };
  }

  let person: PersonDoc;
  try {
    person = await Person.create({
      owner: user._id,
      selfUser: user._id,
      lists: [list],
      fullName: user.name,
      type: 'human',
      dob: { month: user.birthday.month, day: user.birthday.day, year: user.birthday.year },
      feb29Rule: 'feb28',
      email: user.email,
      phone: user.phone,
      createdBy: user._id,
      updatedBy: user._id,
    });
  } catch (err) {
    // Two accepts racing on the unique `selfUser` index: the loser re-reads the
    // winner's card and just adds the list to it.
    if ((err as { code?: number }).code !== 11000) throw err;
    const winner = await findSelfPerson(user._id);
    if (!winner) throw err;
    await Person.updateOne({ _id: winner._id }, { $addToSet: { lists: list } });
    const refreshed = (await Person.findById(winner._id))!;
    await generateForPersonViewers(refreshed);
    return { person: refreshed, reason: 'added' };
  }

  // A person with no event generates no reminders.
  await Event.create({
    person: person._id,
    type: 'birthday',
    date: { month: person.dob.month, day: person.dob.day, year: person.dob.year },
  });

  // The card is a Person the user owns, so without this they'd be reminded about
  // their own birthday. Stored as a normal exclusion rather than a special case
  // in the filter, so anyone who does want that nudge can just switch it back on.
  await PersonMute.updateOne(
    { user: user._id, person: person._id },
    { $setOnInsert: { user: user._id, person: person._id } },
    { upsert: true },
  );

  await generateForPersonViewers(person);
  return { person, reason: 'created' };
}

/**
 * Keep the shared card in step with the account (from PATCH /me). The represented
 * user is authoritative for their own name and date, so this overwrites whatever
 * a member may have typed into an adopted card.
 *
 * Three cases, one of which is what makes the feature work for accounts that
 * predate it: setting a birthday for the first time backfills the card into every
 * list the user already belongs to, so nobody needs a migration script.
 */
export async function syncSelfPerson(user: UserDoc): Promise<void> {
  const self = await findSelfPerson(user._id);

  if (!user.birthday) {
    if (!self) return;
    const affected = await usersOfLists(self.lists);
    if (self.owner.equals(user._id)) {
      await deletePersonCascade(self);
    } else {
      // Adopted from another member - it's their entry, so leave it standing and
      // just stop claiming it. `$unset`, never `null`: a stored null collides on
      // the sparse unique index.
      await Person.updateOne({ _id: self._id }, { $unset: { selfUser: '' } });
    }
    await syncUsersReminders(affected);
    return;
  }

  if (!self) {
    const access = await getUserListAccess(user._id);
    for (const listId of access.accessibleListIds) {
      await ensureSelfPersonInList(user, listId);
    }
    return;
  }

  const dobMoved =
    self.dob.month !== user.birthday.month ||
    self.dob.day !== user.birthday.day ||
    (self.dob.year ?? null) !== (user.birthday.year ?? null);

  self.fullName = user.name;
  self.dob = { month: user.birthday.month, day: user.birthday.day, year: user.birthday.year };
  self.updatedBy = user._id;
  await self.save();

  if (dobMoved) await syncBirthdayEvent(self);
  await generateForPersonViewers(self);
}

/**
 * Stop sharing the user's birthday with a list they're leaving or being removed
 * from. A privacy requirement rather than tidiness: their card would otherwise
 * keep appearing in the remaining members' calendars indefinitely.
 */
export async function removeSelfFromList(
  userId: Types.ObjectId | string,
  listId: Types.ObjectId | string,
): Promise<void> {
  const self = await findSelfPerson(userId);
  if (!self) return;
  const list = new Types.ObjectId(String(listId));
  if (!self.lists.some((id) => id.equals(list))) return;

  await Person.updateOne({ _id: self._id }, { $pull: { lists: list } });

  // Their own card, now in no list at all, is just clutter in their own feed.
  const remaining = self.lists.filter((id) => !id.equals(list));
  if (remaining.length === 0 && self.owner.equals(new Types.ObjectId(String(userId)))) {
    const refreshed = await Person.findById(self._id);
    if (refreshed) await deletePersonCascade(refreshed);
  }
}
