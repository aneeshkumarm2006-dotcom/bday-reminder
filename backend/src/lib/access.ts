import type { Types } from 'mongoose';

import { forbidden, notFound } from './http-error';
import { Event } from '../models/Event';
import { Person, type PersonDoc } from '../models/Person';
import { SharedList } from '../models/SharedList';
import { User, type UserDoc } from '../models/User';

/** A Mongo filter document (Mongoose accepts a plain object for `.find`). */
type PersonFilter = Record<string, unknown>;

/**
 * Shared-list access resolution (TODO Stage 8; FR-43/44/45, §10). A Person is
 * scoped to an `owner` and, optionally, one or more SharedLists. Who can see or
 * edit a person follows from that:
 *
 *   - the person's `owner` has full access (`owner`);
 *   - the owner of a list the person is in, or a list member with `edit`
 *     permission, can edit (`edit`);
 *   - a list member with `view` permission can only read (`view`).
 *
 * Membership means *accepted* membership - pending invites grant nothing
 * (FR-42). Every people/event/note route resolves access through here so the
 * same rules are enforced everywhere; writes additionally call `assertCanEdit`.
 */

export type PersonAccessLevel = 'owner' | 'edit' | 'view';

export interface UserListAccess {
  /** Lists the user owns. */
  ownedListIds: string[];
  /** Lists the user is an accepted member of with `edit` permission. */
  editListIds: string[];
  /** Lists the user is an accepted member of with `view` permission. */
  viewListIds: string[];
  /** owned + edit + view - everything the user can at least see. */
  accessibleListIds: string[];
  /** owned + edit - lists whose people the user may modify. */
  writableListIds: string[];
}

/** Resolve every list the user owns or has accepted membership in, by tier. */
export async function getUserListAccess(userId: string | Types.ObjectId): Promise<UserListAccess> {
  const uid = String(userId);
  const lists = await SharedList.find({ $or: [{ owner: uid }, { 'members.user': uid }] });

  const ownedListIds: string[] = [];
  const editListIds: string[] = [];
  const viewListIds: string[] = [];
  for (const list of lists) {
    const id = list._id.toString();
    if (String(list.owner) === uid) {
      ownedListIds.push(id);
      continue;
    }
    const member = list.members.find((m) => String(m.user) === uid);
    if (!member) continue;
    if (member.permission === 'edit') editListIds.push(id);
    else viewListIds.push(id);
  }

  const writableListIds = [...ownedListIds, ...editListIds];
  const accessibleListIds = [...writableListIds, ...viewListIds];
  return { ownedListIds, editListIds, viewListIds, accessibleListIds, writableListIds };
}

/** Mongo filter for every Person the user can at least see (owned + shared). */
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

/** The caller's permission on one person, or null when they have no access. */
export function personAccessLevel(
  person: PersonDoc,
  userId: string,
  access: UserListAccess,
): PersonAccessLevel | null {
  if (String(person.owner) === userId) return 'owner';
  const personListIds = person.lists.map((l) => l.toString());
  if (personListIds.some((id) => access.writableListIds.includes(id))) return 'edit';
  if (personListIds.some((id) => access.viewListIds.includes(id))) return 'view';
  return null;
}

/**
 * Load a person the caller can access, with their permission level. Throws 404
 * when the person doesn't exist and 403 when it exists but the caller has no
 * access to it (matching the ownership-check convention used since Stage 3).
 */
export async function resolvePersonAccess(personId: string, userId: string) {
  const person = await Person.findById(personId);
  if (!person) throw notFound("We couldn't find that person.");
  const access = await getUserListAccess(userId);
  const level = personAccessLevel(person, userId, access);
  if (!level) throw forbidden();
  return { person, level, access };
}

/** Load an event whose person the caller can access, with their permission. */
export async function resolveEventAccess(eventId: string, userId: string) {
  const event = await Event.findById(eventId);
  if (!event) throw notFound("We couldn't find that event.");
  const { person, level } = await resolvePersonAccess(event.person.toString(), userId);
  return { event, person, level };
}

/** Throw 403 when the caller only has view access (writes need owner/edit). */
export function assertCanEdit(level: PersonAccessLevel): void {
  if (level === 'view') {
    throw forbidden('You have view-only access to this list. Ask the list owner for edit access.');
  }
}

/**
 * Validate that the caller may place people into each of `listIds` - they must
 * own the list or be an `edit` member. Returns the de-duped, validated ids.
 * Throws 403 on any list the caller can't write to (or that doesn't exist).
 */
export function assertWritableLists(listIds: string[], access: UserListAccess): string[] {
  const unique = [...new Set(listIds.map(String))];
  for (const id of unique) {
    if (!access.writableListIds.includes(id)) {
      throw forbidden("You can only add people to a list you own or can edit.");
    }
  }
  return unique;
}

/**
 * Validate an edit to a person's list memberships: only lists being *added* or
 * *removed* need to be writable by the caller, so a member can re-save a shared
 * person without losing memberships in lists they don't manage. Returns the
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
    if (!access.writableListIds.includes(id)) {
      throw forbidden('You can only add or remove a list you own or can edit.');
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
