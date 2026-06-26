import { Router } from 'express';
import { z } from 'zod';

import { generateForPersonViewers } from '../jobs/reminder-engine';
import { resolveEventAccess, resolvePersonAccess } from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { maxDayInMonth } from '../lib/dates';
import { badRequest } from '../lib/http-error';
import { serializeEvent } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Event, type EventDoc } from '../models/Event';
import type { PersonDoc } from '../models/Person';
import { Reminder } from '../models/Reminder';

/**
 * Events - additional event types + per-event overrides (TODO Stage 6; FR-16/18,
 * Stage 5; FR-21/24). Beyond the auto-created birthday, a person can have
 * Anniversary and Custom (user-named) events; each reminds/recurs independently
 * with the same rules unless overridden. Lead time and channels override the
 * user's defaults when set, and fall back when cleared (`null`). Any change that
 * moves *when* or *through what* a reminder fires drops that event's
 * not-yet-acted reminders (across every recipient) and regenerates them for
 * everyone who can see the person, so the change takes effect immediately;
 * sent/done history is preserved (PRD §10). The birthday's date is owned by the
 * person's DOB (PATCH /people), so it can't be edited or deleted here - it lives
 * and dies with the person. Access follows the person: anyone who can see a
 * shared person can add/edit/remove their events (FR-43/45).
 */

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

const CURRENT_YEAR = new Date().getUTCFullYear();

const eventDateSchema = z
  .object({
    month: z.number().int().min(1, 'Pick a month.').max(12, 'Pick a month.'),
    day: z.number().int().min(1, 'Pick a day.').max(31, 'Pick a day.'),
    year: z
      .number()
      .int()
      .min(1900)
      .max(CURRENT_YEAR, 'That year is in the future.')
      .nullable()
      .optional(),
  })
  .refine((d) => d.day <= maxDayInMonth(d.month), {
    message: "That day doesn't exist in the chosen month.",
    path: ['day'],
  });

const channelOverrideSchema = z
  .object({
    push: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
    inApp: z.boolean(),
  })
  .partial();

const overrideFields = {
  // null clears the override → fall back to the user default.
  leadDaysOverride: z.array(z.number().int().min(0).max(365)).nullable().optional(),
  channelOverride: channelOverrideSchema.nullable().optional(),
};

/**
 * POST /events - add an Anniversary or Custom event to a person (FR-16). The
 * birthday is auto-created with the person, so only these two types are created
 * here. A custom event needs a name (e.g. "Met on this day").
 */
const createSchema = z
  .object({
    person: z.string().trim().min(1, 'Which person is this event for?'),
    type: z.enum(['anniversary', 'custom']),
    customName: z.string().trim().min(1).max(60).nullable().optional(),
    date: eventDateSchema,
    ...overrideFields,
  })
  .strict()
  .refine((b) => b.type !== 'custom' || !!b.customName?.trim(), {
    message: 'Name this event so you know what it is.',
    path: ['customName'],
  });

/**
 * Re-anchor an event's pending/snoozed reminders after a scheduling change:
 * drop the not-yet-acted instances for *every* recipient, then regenerate for
 * everyone who can see the person.
 */
async function regenerateEvent(event: EventDoc, person: PersonDoc): Promise<void> {
  await Reminder.deleteMany({ event: event._id, status: { $in: ['pending', 'snoozed'] } });
  await generateForPersonViewers(person);
}

eventsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const { person } = await resolvePersonAccess(body.person, req.userId!);

    const event = await Event.create({
      person: person._id,
      type: body.type,
      customName: body.type === 'custom' ? (body.customName ?? undefined) : undefined,
      date: { month: body.date.month, day: body.date.day, year: body.date.year ?? undefined },
      leadDaysOverride:
        body.leadDaysOverride === undefined
          ? undefined
          : body.leadDaysOverride === null
            ? null
            : [...new Set(body.leadDaysOverride)],
      channelOverride: body.channelOverride === undefined ? undefined : (body.channelOverride ?? null),
    });

    await generateForPersonViewers(person);
    res.status(201).json({ event: serializeEvent(event) });
  }),
);

const patchSchema = z
  .object({
    customName: z.string().trim().min(1).max(60).nullable().optional(),
    date: eventDateSchema.optional(),
    ...overrideFields,
  })
  .strict();

/**
 * PATCH /events/:id - edit an event's name/date and/or its lead-time / channel
 * overrides. The birthday's date can't be edited here (it mirrors the DOB); its
 * overrides can. Scoped to the owner of the event's person.
 */
eventsRouter.patch(
  '/:id',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const patch = req.body as z.infer<typeof patchSchema>;
    const { event, person } = await resolveEventAccess(req.params.id, req.userId!);

    if (patch.date !== undefined && event.type === 'birthday') {
      throw badRequest("Edit a birthday from the person's date of birth.");
    }
    if (patch.customName !== undefined && event.type !== 'custom') {
      throw badRequest('Only custom events can be renamed.');
    }

    let schedulingChanged = false;

    if (patch.customName !== undefined && event.type === 'custom') {
      event.customName = patch.customName ?? undefined;
    }
    if (patch.date !== undefined) {
      event.date = { month: patch.date.month, day: patch.date.day, year: patch.date.year ?? undefined };
      schedulingChanged = true;
    }
    if (patch.leadDaysOverride !== undefined) {
      // An empty array is a valid "no lead time" choice, distinct from null.
      event.leadDaysOverride =
        patch.leadDaysOverride === null ? null : [...new Set(patch.leadDaysOverride)];
      schedulingChanged = true;
    }
    if (patch.channelOverride !== undefined) {
      event.channelOverride = patch.channelOverride ?? null;
      schedulingChanged = true;
    }
    await event.save();

    if (schedulingChanged) {
      await regenerateEvent(event, person);
    }

    res.json({ event: serializeEvent(event) });
  }),
);

/**
 * DELETE /events/:id - remove an Anniversary/Custom event and cascade its
 * reminders (PRD §10). The birthday can't be deleted on its own - deleting the
 * person removes it (DELETE /people/:id).
 */
eventsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { event } = await resolveEventAccess(req.params.id, req.userId!);

    if (event.type === 'birthday') {
      throw badRequest("A birthday can't be removed on its own - delete the person instead.");
    }

    // Cascade across every recipient (no user filter), so the event disappears
    // for all members of the person's lists (PRD §10).
    await Reminder.deleteMany({ event: event._id });
    await event.deleteOne();

    res.status(204).end();
  }),
);
