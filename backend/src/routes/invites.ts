import { Router } from 'express';

import { generateForUser } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { badRequest, notFound } from '../lib/http-error';
import { buildListView } from '../lib/list-view';
import { requireAuth } from '../middleware/require-auth';
import { Invite } from '../models/Invite';
import { SharedList } from '../models/SharedList';
import { User } from '../models/User';

/**
 * Invite acceptance (TODO Stage 8; FR-42). Membership is never automatic - an
 * invited user must be logged in and explicitly accept before gaining access.
 * On accept the user joins the list's `members[]` with the invite's permission,
 * the invite is marked accepted, and their reminders are generated so the shared
 * people appear in their feed immediately.
 */

export const invitesRouter = Router();

invitesRouter.use(requireAuth);

/** GET /invites/:token - preview an invite before accepting (list + inviter). */
invitesRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const invite = await Invite.findOne({ token: req.params.token });
    if (!invite) throw notFound('That invite link is invalid or has expired.');
    const list = await SharedList.findById(invite.list);
    if (!list) throw notFound('That list no longer exists.');
    const inviter = await User.findById(invite.invitedBy);

    const userId = req.userId!;
    const alreadyIn =
      list.owner.toString() === userId || list.members.some((m) => m.user.toString() === userId);

    res.json({
      invite: {
        id: invite._id.toString(),
        listName: list.name,
        inviterName: inviter?.name ?? 'Someone',
        permission: invite.permission,
        status: invite.status,
        alreadyMember: alreadyIn,
      },
    });
  }),
);

/** POST /invites/:token/accept - explicitly join the list (FR-42). */
invitesRouter.post(
  '/:token/accept',
  asyncHandler(async (req, res) => {
    const invite = await Invite.findOne({ token: req.params.token });
    if (!invite) throw notFound('That invite link is invalid or has expired.');
    const list = await SharedList.findById(invite.list);
    if (!list) throw notFound('That list no longer exists.');

    const userId = req.userId!;
    if (list.owner.toString() === userId) {
      throw badRequest('You already own this list.');
    }

    const existing = list.members.find((m) => m.user.toString() === userId);
    if (existing) {
      // Already a member (e.g. re-accepting): record acceptance, change nothing else.
      invite.status = 'accepted';
      await invite.save();
    } else {
      list.members.push({ user: req.user!._id, permission: invite.permission });
      await list.save();
      invite.status = 'accepted';
      await invite.save();
      // The shared people are now visible to this user - schedule their reminders.
      await generateForUser(req.user!);
    }

    res.json({ list: await buildListView(list, userId) });
  }),
);
