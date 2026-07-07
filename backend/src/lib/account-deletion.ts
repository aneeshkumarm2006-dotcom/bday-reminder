import { syncUsersReminders } from '../jobs/reminder-engine';
import { Event } from '../models/Event';
import { Invite } from '../models/Invite';
import { Note } from '../models/Note';
import { Person } from '../models/Person';
import { RefreshToken } from '../models/RefreshToken';
import { Reminder } from '../models/Reminder';
import { SharedList } from '../models/SharedList';
import { SmsUsage } from '../models/SmsUsage';
import { User, type UserDoc } from '../models/User';

import { destroyImage } from './cloudinary';
import { revokeToken } from './google-oauth';
import { logger } from './logger';
import { decryptToken } from './token-crypto';

/**
 * Permanent account deletion (§10, "delete my account"). Removes EVERYTHING tied
 * to one user across every collection, then the user record itself. Irreversible.
 *
 * The order matters:
 *  1. People the user OWNS cascade their events, reminders (across every viewer,
 *     mirroring DELETE /people so shared-list members lose them too), notes, and
 *     hosted photos.
 *  2. Shared lists the user OWNS are torn down like DELETE /lists - people detach,
 *     invites drop, members lose access - and those members are resynced at the
 *     end so their now-stale reminders are pruned.
 *  3. The user's membership in OTHER people's lists is removed.
 *  4. The user's own reminders (for people shared TO them), authored notes, and
 *     sent invites are deleted.
 *  5. Auth (refresh tokens) and the per-user SMS fair-use counter are cleared.
 *     (`AutoSmsUsage` is account-wide, not per-user, so it's intentionally left.)
 *  6. Connected Google tokens are best-effort revoked before the record is gone.
 *
 * Not transactional (matches the existing cascade deletes); each step is
 * idempotent, so a retry after a partial failure converges.
 */
export async function deleteAccount(user: UserDoc): Promise<void> {
  const userId = user._id;

  // --- 1. People this user owns → events, reminders, notes, photos -----------
  const ownedPeople = await Person.find({ owner: userId }).select('_id photoUrl');
  const ownedPersonIds = ownedPeople.map((p) => p._id);
  if (ownedPersonIds.length > 0) {
    const ownedEvents = await Event.find({ person: { $in: ownedPersonIds } }).select('_id');
    const ownedEventIds = ownedEvents.map((e) => e._id);
    // Reminders for these events across EVERY recipient (not just this user), so
    // the people vanish for shared-list members too (§10, as DELETE /people does).
    await Reminder.deleteMany({ event: { $in: ownedEventIds } });
    await Note.deleteMany({ person: { $in: ownedPersonIds } });
    await Event.deleteMany({ person: { $in: ownedPersonIds } });
    await Person.deleteMany({ owner: userId });
  }

  // --- 2. Shared lists this user OWNS → detach people, drop invites, delete ---
  const ownedLists = await SharedList.find({ owner: userId }).select('_id members');
  const ownedListIds = ownedLists.map((l) => l._id);
  // Members who will lose access - resolve them as User docs BEFORE the teardown
  // so we can recompute their reminders once everything else is gone.
  const affectedMemberIds = new Set<string>();
  for (const list of ownedLists) {
    for (const member of list.members) {
      const id = member.user.toString();
      if (id !== userId.toString()) affectedMemberIds.add(id);
    }
  }
  const affectedMembers = await User.find({ _id: { $in: [...affectedMemberIds] } });
  if (ownedListIds.length > 0) {
    await Person.updateMany({ lists: { $in: ownedListIds } }, { $pull: { lists: { $in: ownedListIds } } });
    await Invite.deleteMany({ list: { $in: ownedListIds } });
    await SharedList.deleteMany({ _id: { $in: ownedListIds } });
  }

  // --- 3. Membership in OTHERS' lists → remove this user from members --------
  await SharedList.updateMany({ 'members.user': userId }, { $pull: { members: { user: userId } } });

  // --- 4. This user's own reminders, authored notes, and sent invites -------
  await Reminder.deleteMany({ user: userId });
  await Note.deleteMany({ author: userId });
  await Invite.deleteMany({ invitedBy: userId });

  // --- 5. Auth + fair-use counters ------------------------------------------
  await RefreshToken.deleteMany({ user: userId });
  await SmsUsage.deleteMany({ user: userId });

  // --- 6. Best-effort revoke connected Google tokens (before the doc is gone) -
  await revokeGoogleTokens(userId.toString());

  // --- 7. Best-effort delete hosted photos ----------------------------------
  for (const person of ownedPeople) {
    if (!person.photoUrl) continue;
    try {
      await destroyImage(person.photoUrl);
    } catch (err) {
      logger.warn('photo cleanup failed during account deletion', err instanceof Error ? err.message : err);
    }
  }

  // --- 8. Finally, the user record itself -----------------------------------
  await User.deleteOne({ _id: userId });

  // --- 9. Recompute reminders for members who lost shared-list access --------
  if (affectedMembers.length > 0) {
    await syncUsersReminders(affectedMembers);
  }
}

/**
 * Best-effort revoke the user's Gmail send-as and/or Google-import refresh tokens
 * with Google. The encrypted tokens are `select:false`, so re-read them here.
 * Never throws - the account is being deleted regardless of what Google returns.
 */
async function revokeGoogleTokens(userId: string): Promise<void> {
  try {
    const withTokens = await User.findById(userId).select(
      '+gmailIntegration.refreshTokenEnc +googleImport.refreshTokenEnc',
    );
    if (!withTokens) return;
    const encs = [
      withTokens.gmailIntegration?.refreshTokenEnc,
      withTokens.googleImport?.refreshTokenEnc,
    ].filter((v): v is string => Boolean(v));
    for (const enc of new Set(encs)) {
      try {
        await revokeToken(decryptToken(enc));
      } catch {
        // Per-token best-effort; one failing revoke never blocks the others.
      }
    }
  } catch (err) {
    logger.warn('google token revoke failed during account deletion', err instanceof Error ? err.message : err);
  }
}
