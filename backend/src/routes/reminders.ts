import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../lib/async-handler';
import { todayInTimeZone } from '../lib/dates';
import { notFound } from '../lib/http-error';
import { serializeReminder } from '../lib/serialize';
import { SNOOZE_PRESETS, snoozeUntil, type SnoozePreset } from '../lib/schedule';
import { assertOwner } from '../middleware/ownership';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Event } from '../models/Event';
import { Person } from '../models/Person';
import { Reminder, type ReminderDoc, type ReminderStatus } from '../models/Reminder';

/**
 * In-app reminder feed + actions (TODO Stage 4; FR-27/31/32/33). The feed lists
 * reminders that are due (delivered) and never removes them on view. A single
 * occurrence can have several lead-time instances (e.g. "1 week before" + "on
 * the day"); the feed collapses them into one row per occurrence with an
 * effective status, and Done/Snooze act on the whole occurrence so further
 * reminders for *that* occurrence stop — next year is untouched (FR-32).
 */

export const remindersRouter = Router();

remindersRouter.use(requireAuth);

/** Effective status for a collapsed occurrence + the instance actions target. */
function collapse(instances: ReminderDoc[]): { rep: ReminderDoc; status: ReminderStatus } {
  // Smallest leadDays first → the instance nearest the event leads.
  const sorted = [...instances].sort((a, b) => a.leadDays - b.leadDays);
  const status: ReminderStatus = sorted.some((r) => r.status === 'done')
    ? 'done'
    : sorted.some((r) => r.status === 'snoozed')
      ? 'snoozed'
      : 'sent';
  // Act on a non-done instance when one exists so Done/Snooze have a live target.
  const rep = sorted.find((r) => r.status !== 'done') ?? sorted[0];
  return { rep, status };
}

const groupKey = (r: ReminderDoc): string => `${r.event.toString()}|${r.occurrenceDate.getTime()}`;

/**
 * GET /reminders — the in-app feed. One row per due occurrence, active rows
 * first then done (de-emphasized), each sorted by soonest occurrence.
 */
remindersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const now = new Date();
    const today = todayInTimeZone(user.timezone);

    // Due = its fire-time has arrived. Future instances stay hidden until then.
    const reminders = await Reminder.find({ user: user._id, scheduledFor: { $lte: now } });

    // Group by (event, occurrence) and load the events/persons they reference.
    const groups = new Map<string, ReminderDoc[]>();
    for (const reminder of reminders) {
      const key = groupKey(reminder);
      const list = groups.get(key);
      if (list) list.push(reminder);
      else groups.set(key, [reminder]);
    }

    const eventIds = [...new Set(reminders.map((r) => r.event.toString()))];
    const events = await Event.find({ _id: { $in: eventIds } });
    const eventById = new Map(events.map((e) => [e._id.toString(), e]));
    const personIds = [...new Set(events.map((e) => e.person.toString()))];
    const persons = await Person.find({ _id: { $in: personIds } });
    const personById = new Map(persons.map((p) => [p._id.toString(), p]));

    const items = [];
    for (const instances of groups.values()) {
      const { rep, status } = collapse(instances);
      const event = eventById.get(rep.event.toString());
      if (!event) continue;
      const person = personById.get(event.person.toString());
      if (!person) continue;
      items.push(serializeReminder(rep, event, person, today, status));
    }

    // Active first, then done; within each, soonest occurrence first.
    items.sort((a, b) => {
      const ad = a.status === 'done' ? 1 : 0;
      const bd = b.status === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return Date.parse(a.occurrenceDate) - Date.parse(b.occurrenceDate);
    });

    res.json({ today: today.toISOString(), items });
  }),
);

/** Load a reminder the caller owns (is the recipient of), or throw 404/403. */
async function loadOwnedReminder(reminderId: string, userId: string): Promise<ReminderDoc> {
  const reminder = await Reminder.findById(reminderId);
  if (!reminder) throw notFound("We couldn't find that reminder.");
  assertOwner(reminder.user, userId);
  return reminder;
}

/** Rebuild the collapsed feed item for one occurrence (action responses). */
async function occurrenceItem(reminder: ReminderDoc, today: Date) {
  const instances = await Reminder.find({
    user: reminder.user,
    event: reminder.event,
    occurrenceDate: reminder.occurrenceDate,
  });
  const { rep, status } = collapse(instances);
  const event = await Event.findById(rep.event);
  if (!event) throw notFound("We couldn't find that reminder's event.");
  const person = await Person.findById(event.person);
  if (!person) throw notFound("We couldn't find that reminder's person.");
  return serializeReminder(rep, event, person, today, status);
}

/**
 * POST /reminders/:id/done — mark this occurrence done (FR-31/32). Stops every
 * remaining reminder for *this* occurrence (all its lead-time instances), keeps
 * the row in the feed (de-emphasized), and never affects next year's occurrence.
 */
remindersRouter.post(
  '/:id/done',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const reminder = await loadOwnedReminder(req.params.id, user._id.toString());

    await Reminder.updateMany(
      { user: reminder.user, event: reminder.event, occurrenceDate: reminder.occurrenceDate, status: { $ne: 'done' } },
      { $set: { status: 'done' }, $unset: { snoozeUntil: '' } },
    );

    const today = todayInTimeZone(user.timezone);
    res.json({ reminder: await occurrenceItem(reminder, today) });
  }),
);

const snoozeSchema = z.object({ preset: z.enum(SNOOZE_PRESETS as [SnoozePreset, ...SnoozePreset[]]) });

/**
 * POST /reminders/:id/snooze — snooze this occurrence (FR-33). All of its
 * not-done instances reappear after the delay; the dispatcher promotes them back
 * to pending and re-delivers when the snooze elapses.
 */
remindersRouter.post(
  '/:id/snooze',
  validateBody(snoozeSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { preset } = req.body as z.infer<typeof snoozeSchema>;
    const reminder = await loadOwnedReminder(req.params.id, user._id.toString());

    const now = new Date();
    const until = snoozeUntil(preset, now, user.timezone, user.defaultReminderTime);

    await Reminder.updateMany(
      { user: reminder.user, event: reminder.event, occurrenceDate: reminder.occurrenceDate, status: { $ne: 'done' } },
      { $set: { status: 'snoozed', snoozeUntil: until } },
    );

    const today = todayInTimeZone(user.timezone);
    res.json({ reminder: await occurrenceItem(reminder, today), snoozeUntil: until.toISOString() });
  }),
);
