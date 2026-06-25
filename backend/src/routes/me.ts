import { Router } from 'express';
import { z } from 'zod';

import { regenerateForUser } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { serializeUser } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';

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
    // One-way: marks first-run onboarding complete (Stage 7, FR-2/3). Only
    // `true` is meaningful - onboarding can't be "undone".
    onboarded: z.literal(true).optional(),
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
    if (patch.phone !== undefined) user.phone = patch.phone ?? undefined;
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
    // Set once, on first completion; re-sending `onboarded:true` is a no-op.
    if (patch.onboarded && !user.onboardedAt) user.onboardedAt = new Date();

    await user.save();

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
