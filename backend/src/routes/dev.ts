import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { logger } from '../lib/logger';
import { dispatchDue, generateForAllUsers } from '../jobs/reminder-engine';
import { Reminder } from '../models/Reminder';
import { User } from '../models/User';

/**
 * Dev/QA-only routes (TODO Stage 13: "a way to trigger a reminder on demand for
 * QA"). Mounted ONLY when NODE_ENV !== 'production' (see app.ts), so these never
 * exist in a deployed build. They let the E2E suite and a human QA tester make a
 * reminder fire immediately instead of waiting for its real fire-time.
 *
 * No auth: these run against an ephemeral/dev database only and operate by the
 * (optional) email of the target user, so the browser doesn't need to hand over
 * a token. Never enabled in production.
 */
export const devRouter = Router();

/**
 * POST /dev/reminders/run - make reminders fire now.
 * Body (optional): { email } to scope to one user; omitted = all users.
 * Steps: ensure instances exist (generation/rotation), fast-forward every
 * pending reminder's `scheduledFor` to now, then dispatch. Returns a summary.
 */
devRouter.post(
  '/reminders/run',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : null;

    // Fill any missing instances first (e.g. just-created person today).
    await generateForAllUsers(now);

    const scope: Record<string, unknown> = { status: 'pending' };
    if (email) {
      const user = await User.findOne({ email });
      if (!user) {
        res.status(404).json({ error: { message: 'No user with that email.' } });
        return;
      }
      scope.user = user._id;
    }

    // Fast-forward pending reminders so their fire-time has arrived.
    const forwarded = await Reminder.updateMany(scope, { $set: { scheduledFor: now } });
    const summary = await dispatchDue(now);

    logger.info(`[dev] reminders/run fast-forwarded ${forwarded.modifiedCount ?? 0}, ${JSON.stringify(summary)}`);
    res.json({ forwarded: forwarded.modifiedCount ?? 0, ...summary });
  }),
);

/** POST /dev/reminders/dispatch - run the dispatcher once at `now` (no forwarding). */
devRouter.post(
  '/reminders/dispatch',
  asyncHandler(async (_req, res) => {
    const summary = await dispatchDue(new Date());
    res.json(summary);
  }),
);
