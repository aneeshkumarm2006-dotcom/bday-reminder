import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  accessiblePeopleFilterFor,
  assertCanEdit,
  assertListDeltaWritable,
  assertWritableLists,
  personAccessLevel,
  type UserListAccess,
} from '../../src/lib/access';
import type { PersonDoc } from '../../src/models/Person';

/** Mint a fresh Mongo id string — no DB connection required for these pure fns. */
const id = () => new Types.ObjectId().toString();

/** Build a UserListAccess with sane derived (writable/accessible) aggregates. */
const makeAccess = (parts: Partial<UserListAccess> = {}): UserListAccess => {
  const ownedListIds = parts.ownedListIds ?? [];
  const editListIds = parts.editListIds ?? [];
  const viewListIds = parts.viewListIds ?? [];
  const writableListIds = parts.writableListIds ?? [...ownedListIds, ...editListIds];
  const accessibleListIds = parts.accessibleListIds ?? [...writableListIds, ...viewListIds];
  return { ownedListIds, editListIds, viewListIds, accessibleListIds, writableListIds };
};

/** Minimal Person stand-in: personAccessLevel only reads `owner` and `lists`. */
const makePerson = (owner: string, lists: string[] = []): PersonDoc =>
  ({
    owner: new Types.ObjectId(owner),
    lists: lists.map((l) => new Types.ObjectId(l)),
  }) as unknown as PersonDoc;

describe('access: personAccessLevel', () => {
  it('returns "owner" when the caller owns the person', () => {
    const uid = id();
    const person = makePerson(uid, [id()]);
    expect(personAccessLevel(person, uid, makeAccess())).toBe('owner');
  });

  it('returns "edit" when the person is in a writable (owned/edit) list', () => {
    const uid = id();
    const listId = id();
    const person = makePerson(id(), [listId]);
    const access = makeAccess({ editListIds: [listId] });
    expect(personAccessLevel(person, uid, access)).toBe('edit');
  });

  it('returns "view" when the person is only in a view-only list', () => {
    const uid = id();
    const listId = id();
    const person = makePerson(id(), [listId]);
    const access = makeAccess({ viewListIds: [listId] });
    expect(personAccessLevel(person, uid, access)).toBe('view');
  });

  it('returns null when there is no ownership or list overlap', () => {
    const uid = id();
    const person = makePerson(id(), [id()]);
    const access = makeAccess({ viewListIds: [id()], editListIds: [id()] });
    expect(personAccessLevel(person, uid, access)).toBeNull();
  });
});

describe('access: accessiblePeopleFilterFor', () => {
  it('builds an $or of owner + lists $in accessibleListIds', () => {
    const uid = id();
    const accessibleListIds = [id(), id()];
    const access = makeAccess({ accessibleListIds });
    expect(accessiblePeopleFilterFor(uid, access)).toEqual({
      $or: [{ owner: uid }, { lists: { $in: accessibleListIds } }],
    });
  });
});

describe('access: assertCanEdit', () => {
  it('throws 403 forbidden for view-only access', () => {
    try {
      assertCanEdit('view');
      throw new Error('expected assertCanEdit to throw');
    } catch (err) {
      expect((err as { status: number }).status).toBe(403);
    }
  });

  it('does not throw for owner or edit access', () => {
    expect(() => assertCanEdit('owner')).not.toThrow();
    expect(() => assertCanEdit('edit')).not.toThrow();
  });
});

describe('access: assertWritableLists', () => {
  it('returns the de-duped ids when all are writable', () => {
    const a = id();
    const b = id();
    const access = makeAccess({ ownedListIds: [a], editListIds: [b] });
    expect(assertWritableLists([a, b, a], access)).toEqual([a, b]);
  });

  it('throws 403 when any id is not writable', () => {
    const writable = id();
    const stranger = id();
    const access = makeAccess({ ownedListIds: [writable] });
    try {
      assertWritableLists([writable, stranger], access);
      throw new Error('expected assertWritableLists to throw');
    } catch (err) {
      expect((err as { status: number }).status).toBe(403);
    }
  });
});

describe('access: assertListDeltaWritable', () => {
  it('allows re-saving with an unchanged non-writable membership', () => {
    const writable = id();
    const sharedNonWritable = id();
    const access = makeAccess({ ownedListIds: [writable] });
    // Membership unchanged: sharedNonWritable is in both prev and next, so it
    // is not part of the changed set and need not be writable.
    const next = assertListDeltaWritable(
      [sharedNonWritable, writable],
      [writable, sharedNonWritable],
      access,
    );
    expect([...next].sort()).toEqual([writable, sharedNonWritable].sort());
  });

  it('throws 403 when an added id is not writable', () => {
    const writable = id();
    const added = id();
    const access = makeAccess({ ownedListIds: [writable] });
    try {
      assertListDeltaWritable([writable], [writable, added], access);
      throw new Error('expected assertListDeltaWritable to throw');
    } catch (err) {
      expect((err as { status: number }).status).toBe(403);
    }
  });

  it('throws 403 when a removed id is not writable', () => {
    const writable = id();
    const removedNonWritable = id();
    const access = makeAccess({ ownedListIds: [writable] });
    try {
      assertListDeltaWritable([writable, removedNonWritable], [writable], access);
      throw new Error('expected assertListDeltaWritable to throw');
    } catch (err) {
      expect((err as { status: number }).status).toBe(403);
    }
  });
});
