import { Invite } from '../models/Invite';
import { Person } from '../models/Person';
import type { SharedListDoc } from '../models/SharedList';
import { User } from '../models/User';
import { serializeInvite } from './serialize';

/**
 * Detailed shared-list view (TODO Stage 8; DESIGN.md §8.9). Shared by the lists
 * and invites routes so both render members and pending invites identically. The
 * owner is surfaced as the first member with an `owner` badge; the actual list
 * `members[]` are accepted members only (FR-42). Pending invites are returned to
 * the owner alone - members don't see who else was invited.
 */

export type ListRole = 'owner' | 'member';

export interface ListMemberView {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  /** Their own birthday, when they've given one. Null otherwise - never guessed. */
  birthday: { month: number; day: number; year: number | null } | null;
  /**
   * When they joined, so the list can mark whoever arrived recently. Null for
   * members who joined before the field existed; that reads as "not new" rather
   * than inventing a date for them.
   */
  joinedAt: string | null;
}

/** The user's own birthday in the shape every client already renders. */
function birthdayOf(user: { birthday?: { month: number; day: number; year?: number } }) {
  return user.birthday
    ? { month: user.birthday.month, day: user.birthday.day, year: user.birthday.year ?? null }
    : null;
}

export async function buildListView(list: SharedListDoc, viewerId: string) {
  const memberUserIds = [list.owner, ...list.members.map((m) => m.user)];
  const users = await User.find({ _id: { $in: memberUserIds } });
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const owner = userById.get(list.owner.toString());
  const members: ListMemberView[] = [];
  if (owner) {
    members.push({
      id: owner._id.toString(),
      name: owner.name,
      email: owner.email,
      isOwner: true,
      birthday: birthdayOf(owner),
      // The owner has been here since the list existed.
      joinedAt: list.createdAt.toISOString(),
    });
  }
  for (const member of list.members) {
    const u = userById.get(member.user.toString());
    if (!u) continue;
    members.push({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      isOwner: false,
      birthday: birthdayOf(u),
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    });
  }

  const isOwner = list.owner.toString() === viewerId;

  const peopleCount = await Person.countDocuments({ lists: list._id });

  // Only the owner manages invites (FR-43); members don't see the pending list.
  const pendingInvites = isOwner
    ? (await Invite.find({ list: list._id, status: 'pending' }).sort({ createdAt: 1 })).map(
        serializeInvite,
      )
    : [];

  return {
    id: list._id.toString(),
    name: list.name,
    role: (isOwner ? 'owner' : 'member') as ListRole,
    owner: owner ? { id: owner._id.toString(), name: owner.name } : null,
    members,
    memberCount: members.length,
    peopleCount,
    pendingInvites,
    createdAt: list.createdAt.toISOString(),
  };
}
