import type { Types } from 'mongoose';

import { forbidden, notFound } from './http-error';
import { Event } from '../models/Event';
import { Person, type PersonDoc } from '../models/Person';
import { SharedList } from '../models/SharedList';
import { User, type UserDoc } from '../models/User';

/** A Mongo filter document (Mongoose accepts a plain object for `.find`). */
type PersonFilter = Record<string, unknown>;

/**
 * Shared-list access resolution (Stage 8; FR-43/44/45, §10). A Person is scoped
 * to an `owner` and, optionally, one or more SharedLists. Who can see and edit a
 * person follows from that:
 *
 *   - the person's `owner` has access;
 *   - the owner or any accepted member of a list the person is in has access.
 *
 * Everyone with access can edit - there is no view-only tier. Membership means
 * *accepted* membership; pending invites grant nothing (FR-42). Every
 * people/event/note route resolves access through here so the same rules are
 * enforced everywhere.
 */

export interface UserListAccess {
  /** Lists the user owns. */
  ownedListIds: string[];
  /** Lists the user is an accepted member of. */
  memberListIds: string[];
  /** owned + member - every list the user can access (and edit). */
  accessibleListIds: string[];
}

/** Resolve every list the user owns or has accepted membership in. */
export async function getUserListAccess(userId: string | Types.ObjectId): Promise<UserListAccess> {
  const uid = String(userId);
  const lists = await SharedList.find({ $or: [{ owner: uid }, { 'members.user': uid }] });

  const ownedListIds: string[] = [];
  const memberListIds: string[] = [];
  for (const list of lists) {
    const id = list._id.toString();
    if (String(list.owner) === uid) ownedListIds.push(id);
    else if (list.members.some((m) => String(m.user) === uid)) memberListIds.push(id);
  }

  const accessibleListIds = [...ownedListIds, ...memberListIds];
  return { ownedListIds, memberListIds, accessibleListIds };
}

/** Mongo filter for every Person the user can access (owned + shared). */
export function accessiblePeopleFilterFor(userId: string, access: UserListAccess): PersonFilter {
  return { $or: [{ owner: userId }, { lists: { $in: access.accessibleListIds } }] };
}

/** Convenience: resolve access then build the accessible-people filter. */
export async function accessiblePeopleFilter(
  userId: string | Types.ObjectId,
): Promise<PersonFilter> {
  const access = await getUserListAccess(userId);
  return accessiblePeopleFilterFor(String(userId), access);
}

/** Whether the caller can access (and therefore edit) a person. */
export function canAccessPerson(
  person: PersonDoc,
  userId: string,
  access: UserListAccess,
): boolean {
  if (String(person.owner) === userId) return true;
  const personListIds = person.lists.map((l) => l.toString());
  return personListIds.some((id) => access.accessibleListIds.includes(id));
}

/**
 * Load a person the caller can access. Throws 404 when the person doesn't exist
 * and 403 when it exists but the caller has no access to it (matching the
 * ownership-check convention used since Stage 3).
 */
export async function resolvePersonAccess(personId: string, userId: string) {
  const person = await Person.findById(personId);
  if (!person) throw notFound("We couldn't find that person.");
  const access = await getUserListAccess(userId);
  if (!canAccessPerson(person, userId, access)) throw forbidden();
  return { person, access };
}

/** Load an event whose person the caller can access. */
export async function resolveEventAccess(eventId: string, userId: string) {
  const event = await Event.findById(eventId);
  if (!event) throw notFound("We couldn't find that event.");
  const { person } = await resolvePersonAccess(event.person.toString(), userId);
  return { event, person };
}

/**
 * Validate that the caller may place people into each of `listIds` - they must
 * own the list or be a member of it. Returns the de-duped, validated ids.
 * Throws 403 on any list the caller can't access (or that doesn't exist).
 */
export function assertWritableLists(listIds: string[], access: UserListAccess): string[] {
  const unique = [...new Set(listIds.map(String))];
  for (const id of unique) {
    if (!access.accessibleListIds.includes(id)) {
      throw forbidden('You can only add people to a list you own or belong to.');
    }
  }
  return unique;
}

/**
 * Validate an edit to a person's list memberships: only lists being *added* or
 * *removed* need to be accessible to the caller, so a member can re-save a
 * shared person without losing memberships in lists they aren't in. Returns the
 * de-duped next set.
 */
export function assertListDeltaWritable(
  prevIds: string[],
  nextIds: string[],
  access: UserListAccess,
): string[] {
  const next = [...new Set(nextIds.map(String))];
  const prev = new Set(prevIds.map(String));
  const nextSet = new Set(next);
  const changed = [
    ...next.filter((id) => !prev.has(id)),
    ...[...prev].filter((id) => !nextSet.has(id)),
  ];
  for (const id of changed) {
    if (!access.accessibleListIds.includes(id)) {
      throw forbidden('You can only add or remove a list you own or belong to.');
    }
  }
  return next;
}

/** Every user who owns or is a member of any of the given lists. */
export async function usersOfLists(listIds: Array<string | Types.ObjectId>): Promise<UserDoc[]> {
  const ids = listIds.map(String);
  if (ids.length === 0) return [];
  const lists = await SharedList.find({ _id: { $in: ids } });
  const userIds = new Set<string>();
  for (const list of lists) {
    userIds.add(String(list.owner));
    for (const member of list.members) userIds.add(String(member.user));
  }
  return User.find({ _id: { $in: [...userIds] } });
}
