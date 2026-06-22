import { Invite } from '../models/Invite';
import { Person } from '../models/Person';
import type { SharedListDoc } from '../models/SharedList';
import { User } from '../models/User';
import { serializeInvite } from './serialize';

/**
 * Detailed shared-list view (TODO Stage 8; DESIGN.md §8.9). Shared by the lists
 * and invites routes so both render members, permissions, and pending invites
 * identically. The owner is surfaced as the first member with an `owner` badge;
 * the actual list `members[]` are accepted members only (FR-42). Pending invites
 * are returned to the owner alone — members don't see who else was invited.
 */

export type ListRole = 'owner' | 'member';
export type ViewerPermission = 'owner' | 'edit' | 'view';

export interface ListMemberView {
  id: string;
  name: string;
  email: string;
  permission: ViewerPermission;
  isOwner: boolean;
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
      permission: 'owner',
      isOwner: true,
    });
  }
  for (const member of list.members) {
    const u = userById.get(member.user.toString());
    if (!u) continue;
    members.push({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      permission: member.permission,
      isOwner: false,
    });
  }

  const isOwner = list.owner.toString() === viewerId;
  const viewerMember = list.members.find((m) => m.user.toString() === viewerId);
  const permission: ViewerPermission = isOwner ? 'owner' : (viewerMember?.permission ?? 'view');

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
    permission,
    owner: owner ? { id: owner._id.toString(), name: owner.name } : null,
    members,
    memberCount: members.length,
    peopleCount,
    pendingInvites,
    createdAt: list.createdAt.toISOString(),
  };
}
