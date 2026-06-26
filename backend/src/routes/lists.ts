import { randomBytes } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { syncUsersReminders } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { loadEnv } from '../lib/env';
import { badRequest, forbidden, notFound } from '../lib/http-error';
import { sendInviteEmail } from '../lib/invite-email';
import { buildListView } from '../lib/list-view';
import { serializeInvite } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Invite } from '../models/Invite';
import { Person } from '../models/Person';
import { SharedList } from '../models/SharedList';
import { User } from '../models/User';

/**
 * Shared / family lists (TODO Stage 8; FR-41-47, §8.11). A list has an owner and
 * accepted members; everyone in the list can see and edit the same people/events
 * (scoped via `Person.lists`), but each keeps their own notification settings
 * and reminder instances (FR-44). The owner manages membership and invites.
 * Leaving or being removed stops that user's reminders for the list immediately
 * (FR-46/47).
 */

export const listsRouter = Router();

listsRouter.use(requireAuth);

/** Load a list the caller owns or is a member of (else 404 - don't leak it). */
async function loadAccessibleList(id: string, userId: string) {
  const list = await SharedList.findById(id);
  if (!list) throw notFound("We couldn't find that list.");
  const isOwner = list.owner.toString() === userId;
  const isMember = list.members.some((m) => m.user.toString() === userId);
  if (!isOwner && !isMember) throw notFound("We couldn't find that list.");
  return { list, isOwner };
}

/** Load a list the caller owns, or throw 404 (missing) / 403 (member, not owner). */
async function loadOwnedList(id: string, userId: string) {
  const { list, isOwner } = await loadAccessibleList(id, userId);
  if (!isOwner) throw forbidden('Only the list owner can do that.');
  return list;
}

const nameSchema = z
  .object({ name: z.string().trim().min(1, 'Name your list so everyone knows what it is.').max(60) })
  .strict();

/** POST /lists - create a shared list owned by the caller (FR-41). */
listsRouter.post(
  '/',
  validateBody(nameSchema),
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { name } = req.body as z.infer<typeof nameSchema>;
    const list = await SharedList.create({ name, owner: userId, members: [] });
    res.status(201).json({ list: await buildListView(list, userId) });
  }),
);

/** GET /lists - every list the caller owns or belongs to (FR-44). */
listsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const lists = await SharedList.find({
      $or: [{ owner: userId }, { 'members.user': userId }],
    }).sort({ createdAt: 1 });
    const views = await Promise.all(lists.map((l) => buildListView(l, userId)));
    res.json({ lists: views });
  }),
);

/** GET /lists/:id - one list's detail (owner or member). */
listsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { list } = await loadAccessibleList(req.params.id, req.userId!);
    res.json({ list: await buildListView(list, req.userId!) });
  }),
);

/** PATCH /lists/:id - rename the list (owner only). */
listsRouter.patch(
  '/:id',
  validateBody(nameSchema),
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req.params.id, req.userId!);
    list.name = (req.body as z.infer<typeof nameSchema>).name;
    await list.save();
    res.json({ list: await buildListView(list, req.userId!) });
  }),
);

/**
 * DELETE /lists/:id - delete the list (owner only, FR-47). People stay owned by
 * their owner but are detached from the list; pending invites are dropped; every
 * member loses access, so their reminders for the list's people are re-synced
 * (the ones they can no longer see are removed).
 */
listsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req.params.id, req.userId!);

    // Members who will lose access (resolve them before mutating the list).
    const affected = await User.find({ _id: { $in: list.members.map((m) => m.user) } });

    await Person.updateMany({ lists: list._id }, { $pull: { lists: list._id } });
    await Invite.deleteMany({ list: list._id });
    await list.deleteOne();

    await syncUsersReminders(affected);
    res.status(204).end();
  }),
);

const inviteSchema = z
  .object({
    invitedEmailOrPhone: z.string().trim().min(1, 'Enter an email, phone, or leave blank for a link.').max(120).optional(),
  })
  .strict();

/**
 * POST /lists/:id/invite - invite by email / phone / link (owner only, FR-41).
 * Creates a pending Invite with a secret token and emails it when the target is
 * an email + Resend is configured; otherwise the owner shares the returned link.
 * The invitee must explicitly accept before gaining access (FR-42).
 */
listsRouter.post(
  '/:id/invite',
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req.params.id, req.userId!);
    const body = req.body as z.infer<typeof inviteSchema>;

    const token = randomBytes(24).toString('base64url');
    const target = body.invitedEmailOrPhone?.trim() || 'invite link';
    const invite = await Invite.create({
      list: list._id,
      invitedEmailOrPhone: target,
      token,
      invitedBy: req.userId,
    });

    const acceptUrl = `${loadEnv().APP_ORIGIN}/invite/${token}`;
    const emailOutcome = await sendInviteEmail({
      to: target,
      listName: list.name,
      inviterName: req.user!.name,
      acceptUrl,
    });

    res.status(201).json({
      invite: { ...serializeInvite(invite), token, acceptUrl },
      emailOutcome,
    });
  }),
);

/** DELETE /lists/:id/invites/:inviteId - revoke a pending invite (owner only). */
listsRouter.delete(
  '/:id/invites/:inviteId',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req.params.id, req.userId!);
    const invite = await Invite.findOne({ _id: req.params.inviteId, list: list._id });
    if (!invite) throw notFound("We couldn't find that invite.");
    await invite.deleteOne();
    res.status(204).end();
  }),
);

/**
 * DELETE /lists/:id/members/:memberId - remove a member (owner only, FR-46).
 * The removed user loses access, so their reminders for the list's people stop.
 */
listsRouter.delete(
  '/:id/members/:memberId',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req.params.id, req.userId!);
    const before = list.members.length;
    list.members = list.members.filter((m) => m.user.toString() !== req.params.memberId);
    if (list.members.length === before) throw notFound("That person isn't a member of this list.");
    await list.save();

    const removed = await User.findById(req.params.memberId);
    if (removed) await syncUsersReminders([removed]);
    res.json({ list: await buildListView(list, req.userId!) });
  }),
);

/**
 * POST /lists/:id/leave - the caller leaves a list they're a member of (FR-46).
 * The owner can't leave (they delete the list instead). Reminders for the list's
 * people stop immediately.
 */
listsRouter.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const { list, isOwner } = await loadAccessibleList(req.params.id, req.userId!);
    if (isOwner) throw badRequest('As the owner, delete the list instead of leaving it.');

    list.members = list.members.filter((m) => m.user.toString() !== req.userId);
    await list.save();
    await syncUsersReminders([req.user!]);
    res.status(204).end();
  }),
);
