import { Router } from 'express';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { z } from 'zod';

import { deleteAccount } from '../lib/account-deletion';
import { regenerateForUser, syncUserReminders } from '../jobs/reminder-engine';
import {
  accessiblePeopleFilterFor,
  getUserListAccess,
  mutedPersonIds,
} from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { dobSchema, toDateParts } from '../lib/dob-schema';
import { defaultDialCode, normalizePhone } from '../lib/phone';
import { serializeUser } from '../lib/serialize';
import { syncSelfPerson } from '../lib/self-person';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Person } from '../models/Person';
import { PersonMute, type PersonMuteDoc } from '../models/PersonMute';

/**
 * Account routes (TODO Stage 1). Profile, timezone, and notification
 * preferences. All require a valid access token. Changing anything that affects
 * *when* or *through what* reminders fire - timezone, reminder time, lead times,
 * channels - regenerates the user's pending reminders so the change takes effect
 * (FR-21/52); snoozed/done/sent history is preserved (Stage 4).
 */

const patchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().nullable().optional(),
    // The user's own birthday; `null` clears it (and tears down whatever they've
    // shared into their lists).
    birthday: dobSchema.nullable().optional(),
    timezone: z.string().trim().min(1).optional(),
    channelPreferences: z
      .object({
        push: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        inApp: z.boolean(),
      })
      .partial()
      .optional(),
    defaultLeadDays: z.array(z.number().int().min(0).max(365)).optional(),
    defaultReminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 09:00.')
      .optional(),
  })
  .strict();

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(serializeUser(req.user!));
  }),
);

meRouter.patch(
  '/',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const patch = req.body as z.infer<typeof patchSchema>;

    if (patch.name !== undefined) user.name = patch.name;
    // A country-code-less number is completed with the dial code of the user's
    // own timezone, not a blind +1 (the clients send full E.164 either way).
    if (patch.phone !== undefined)
      user.phone =
        normalizePhone(patch.phone, defaultDialCode(patch.timezone ?? user.timezone)) ?? undefined;
    if (patch.birthday !== undefined) {
      user.birthday = patch.birthday ? toDateParts(patch.birthday) : undefined;
    }
    if (patch.timezone !== undefined) user.timezone = patch.timezone;
    if (patch.channelPreferences) {
      const cp = patch.channelPreferences;
      user.channelPreferences = {
        push: cp.push ?? user.channelPreferences.push,
        email: cp.email ?? user.channelPreferences.email,
        sms: cp.sms ?? user.channelPreferences.sms,
        inApp: cp.inApp ?? user.channelPreferences.inApp,
      };
    }
    if (patch.defaultLeadDays) user.defaultLeadDays = patch.defaultLeadDays;
    if (patch.defaultReminderTime) user.defaultReminderTime = patch.defaultReminderTime;

    await user.save();

    // Their name and date are what the lists they've shared into display, so the
    // card follows the account. Deliberately not folded into `schedulingChanged`
    // below: this fans out to the *other* members who see the card, not to the
    // caller's own reminder timing. Setting a birthday for the first time also
    // backfills the card into every list they already belong to.
    if (patch.birthday !== undefined || patch.name !== undefined) {
      await syncSelfPerson(user);
    }

    // Re-anchor pending reminders when the scheduling inputs change.
    const schedulingChanged =
      patch.timezone !== undefined ||
      patch.defaultReminderTime !== undefined ||
      patch.defaultLeadDays !== undefined ||
      patch.channelPreferences !== undefined;
    if (schedulingChanged) {
      await regenerateForUser(user);
    }

    res.json(serializeUser(user));
  }),
);

/**
 * DELETE /me - permanently delete the account and everything tied to it (§10).
 * Irreversible: cascades the user's people, events, reminders, notes, owned
 * shared lists, invites, refresh tokens, and connected integrations, then the
 * user record itself. The client clears its local session afterward.
 */
meRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    await deleteAccount(req.user!);
    res.status(204).end();
  }),
);

const pushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Missing push token.'),
});

/**
 * POST /me/push-tokens - register this device's Expo push token (FR-23/54).
 * Idempotent: `$addToSet` de-dups, so re-registering on every launch is safe.
 */
meRouter.post(
  '/push-tokens',
  validateBody(pushTokenSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { token } = req.body as z.infer<typeof pushTokenSchema>;
    if (!user.pushTokens.includes(token)) {
      user.pushTokens.push(token);
      await user.save();
    }
    res.status(201).json({ pushTokens: user.pushTokens });
  }),
);

/** DELETE /me/push-tokens - unregister a device's token (e.g. on logout). */
meRouter.delete(
  '/push-tokens',
  validateBody(pushTokenSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { token } = req.body as z.infer<typeof pushTokenSchema>;
    user.pushTokens = user.pushTokens.filter((t) => t !== token);
    await user.save();
    res.json({ pushTokens: user.pushTokens });
  }),
);

const objectIdSchema = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Not a person id.');

const calendarPeopleSchema = z
  .object({
    add: z.array(objectIdSchema).max(500).optional(),
    remove: z.array(objectIdSchema).max(500).optional(),
  })
  .strict()
  .refine((b) => (b.add?.length ?? 0) + (b.remove?.length ?? 0) > 0, 'Choose at least one person.')
  .refine((b) => !b.add?.some((id) => b.remove?.includes(id)), {
    message: "A person can't be added and removed in the same request.",
    path: ['add'],
  });

/**
 * POST /me/calendar-people - choose which shared people are in the caller's
 * calendar and reminders.
 *
 * Joining a shared list grants access to everyone in it, and the engine schedules
 * the joiner for all of them; this is the opt-out. Serves both the catch-up
 * screen right after joining (one call carrying every unchecked person) and the
 * single "in my calendar" switch on a person's page.
 *
 * The vocabulary flips exactly here and nowhere else: `add` means "in my
 * calendar", which is the *absence* of a PersonMute row. Callers never see the
 * exclusion model.
 *
 * Ids the caller can't see are ignored rather than rejected - a bulk submit from
 * a screen rendered a minute ago, against a list someone else is editing, should
 * not fail as a whole. The response is the authoritative excluded set so the
 * client can reconcile.
 */
meRouter.post(
  '/calendar-people',
  validateBody(calendarPeopleSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const userId = user._id.toString();
    const body = req.body as z.infer<typeof calendarPeopleSchema>;
    const add = body.add ?? [];
    const remove = body.remove ?? [];

    const access = await getUserListAccess(user._id);
    const visible = await Person.find({
      ...accessiblePeopleFilterFor(userId, access),
      _id: { $in: [...add, ...remove] },
    }).select('_id');
    const visibleIds = new Set(visible.map((p) => p._id.toString()));

    const toAdd = add.filter((id) => visibleIds.has(id)).map((id) => new Types.ObjectId(id));
    const toRemove = remove.filter((id) => visibleIds.has(id)).map((id) => new Types.ObjectId(id));

    const ops: AnyBulkWriteOperation<PersonMuteDoc>[] = [
      ...toRemove.map((person) => ({
        updateOne: {
          filter: { user: user._id, person },
          update: { $setOnInsert: { user: user._id, person } },
          upsert: true,
        },
      })),
      ...(toAdd.length > 0
        ? [{ deleteMany: { filter: { user: user._id, person: { $in: toAdd } } } }]
        : []),
    ];
    if (ops.length > 0) await PersonMute.bulkWrite(ops);

    // One pass: deletes the reminders for everyone just removed, refills them for
    // everyone just added. `syncUserReminders`, not `regenerateForUser` - the
    // latter only clears pending rows and would strand snoozed/sent ones.
    await syncUserReminders(user);

    res.json({ excludedPersonIds: await mutedPersonIds(user._id) });
  }),
);
