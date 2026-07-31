import { Router } from 'express';
import { z } from 'zod';

import { generateForUser } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { dobSchema, toDateParts } from '../lib/dob-schema';
import { badRequest, notFound } from '../lib/http-error';
import { buildListView } from '../lib/list-view';
import { ensureSelfPersonInList } from '../lib/self-person';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Invite } from '../models/Invite';
import { Person } from '../models/Person';
import { SharedList } from '../models/SharedList';
import { User } from '../models/User';

/**
 * Invite acceptance (TODO Stage 8; FR-42). Membership is never automatic - an
 * invited user must be logged in and explicitly accept before gaining access.
 * On accept the user joins the list's `members[]`, the invite is marked
 * accepted, and their reminders are generated so the shared people appear in
 * their feed immediately.
 *
 * Accepting also runs the exchange in the other direction: the joiner's own
 * birthday is published to the list as a Person, so the members who were already
 * there start getting reminded about them too. That's opt-out, and the accept
 * body carries the choice.
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

    const user = req.user!;
    const userId = req.userId!;
    const alreadyIn =
      list.owner.toString() === userId || list.members.some((m) => m.user.toString() === userId);

    res.json({
      invite: {
        id: invite._id.toString(),
        listName: list.name,
        inviterName: inviter?.name ?? 'Someone',
        status: invite.status,
        alreadyMember: alreadyIn,
        // What they're walking into, so the screen can be concrete about both
        // halves of the trade - the birthdays they'll receive, and theirs going in.
        memberCount: list.members.length + 1,
        peopleCount: await Person.countDocuments({ lists: list._id }),
        yourBirthday: user.birthday
          ? { month: user.birthday.month, day: user.birthday.day, year: user.birthday.year ?? null }
          : null,
      },
    });
  }),
);

/**
 * Body is fully optional so older clients that POST nothing still parse - with
 * `express.json()` an empty body arrives as `{}`, which satisfies this.
 */
const acceptSchema = z
  .object({
    /** Publish the joiner's birthday to this list. Defaults to on. */
    shareBirthday: z.boolean().optional(),
    /** Only used when the account has no birthday yet; never overwrites one. */
    birthday: dobSchema.optional(),
  })
  .strict();

/** POST /invites/:token/accept - explicitly join the list (FR-42). */
invitesRouter.post(
  '/:token/accept',
  validateBody(acceptSchema),
  asyncHandler(async (req, res) => {
    const invite = await Invite.findOne({ token: req.params.token });
    if (!invite) throw notFound('That invite link is invalid or has expired.');
    const list = await SharedList.findById(invite.list);
    if (!list) throw notFound('That list no longer exists.');

    const user = req.user!;
    const userId = req.userId!;
    const body = req.body as z.infer<typeof acceptSchema>;
    if (list.owner.toString() === userId) {
      throw badRequest('You already own this list.');
    }

    const existing = list.members.find((m) => m.user.toString() === userId);
    if (existing) {
      // Already a member (e.g. re-accepting): record acceptance and leave the
      // membership alone. The sharing step below still runs - they may have added
      // a birthday since, or declined the first time.
      invite.status = 'accepted';
      await invite.save();
    } else {
      list.members.push({ user: user._id, joinedAt: new Date() });
      await list.save();
      invite.status = 'accepted';
      await invite.save();
    }

    // Fill in a birthday the account doesn't have yet, so the ask and the join
    // are one request. An existing one is never overwritten from here.
    if (body.birthday && !user.birthday) {
      user.birthday = toDateParts(body.birthday);
      await user.save();
    }

    // Membership is committed first, so the fan-out inside this resolves the
    // joiner as a viewer of their own card.
    const shared =
      body.shareBirthday === false
        ? null
        : await ensureSelfPersonInList(user, list._id);

    // The shared people are now visible to this user - schedule their reminders.
    await generateForUser(user);

    res.json({
      list: await buildListView(list, userId),
      selfPerson: shared
        ? {
            created: shared.reason === 'created',
            matched: shared.reason === 'matched',
            personId: shared.person?._id.toString() ?? null,
          }
        : null,
      peopleCount: await Person.countDocuments({ lists: list._id }),
    });
  }),
);
