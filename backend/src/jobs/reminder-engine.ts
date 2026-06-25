/**
 * Reminder engine (TODO Stage 4; FR-12/19/21/22/51-53). Two responsibilities:
 *
 *  1. Generation - from each Event + the user's (or event's) lead-time config,
 *     create one Reminder instance per lead time for the upcoming occurrence,
 *     each stamped with the absolute instant it should fire in the recipient's
 *     timezone. Idempotent: re-running only fills gaps, so it doubles as the
 *     annual rotation (once an occurrence passes, "next" rolls to next year and
 *     fresh instances appear) (FR-12).
 *
 *  2. Dispatch - find reminders due now, claim each atomically (no double-send
 *     if cron ticks overlap), and deliver across its channels. Snoozed reminders
 *     whose delay elapsed are promoted back to pending and re-delivered.
 *
 * The cron wiring lives in `jobs/index.ts`; this module is pure logic so the
 * smoke test can drive it with an injected clock.
 */

import { dispatchToChannels, type ReminderPayload } from '../channels';
import { accessiblePeopleFilter } from '../lib/access';
import { ageTurning, daysUntil, resolveOccurrence, todayInTimeZone } from '../lib/dates';
import { logger } from '../lib/logger';
import { reminderHeadline, reminderMessage } from '../lib/reminder-content';
import { fireInstant } from '../lib/schedule';
import { incrementSmsUsage, resolveFairUse, smsPeriod } from '../lib/sms-usage';
import { CHANNEL_KEYS, type ChannelKey } from '../models/common';
import { Event, type EventDoc } from '../models/Event';
import { Person, type PersonDoc } from '../models/Person';
import { Reminder, type ReminderDoc } from '../models/Reminder';
import { SharedList } from '../models/SharedList';
import { User, type UserDoc } from '../models/User';

const MS_PER_DAY = 86_400_000;

/** Active channels for an event: per-event override wins, else the user default. */
export function resolveChannels(user: UserDoc, event: EventDoc): ChannelKey[] {
  const base = user.channelPreferences;
  const override = event.channelOverride ?? null;
  const isOn = (key: ChannelKey): boolean => {
    const o = override?.[key];
    return o != null ? o : base[key];
  };
  return CHANNEL_KEYS.filter(isOn);
}

/** Lead times for an event: per-event override wins, else the user default (FR-21). */
export function resolveLeadDays(user: UserDoc, event: EventDoc): number[] {
  const source = event.leadDaysOverride ?? user.defaultLeadDays;
  const valid = source.filter((d) => Number.isInteger(d) && d >= 0 && d <= 365);
  return [...new Set(valid)];
}

/**
 * Generate any missing reminder instances for one user's events (idempotent).
 * Returns the number of new instances created. Never clobbers an existing
 * reminder, so a user's snoozed/done/sent actions and history are preserved.
 */
export async function generateForUser(user: UserDoc, now: Date = new Date()): Promise<number> {
  const today = todayInTimeZone(user.timezone);
  // Every person the user can see - their own plus anyone in a shared list they
  // own or belong to. Each member gets their own instances with their own lead
  // times / channels / timezone, so shared data still means personal reminders
  // (FR-44).
  const people = await Person.find(await accessiblePeopleFilter(user._id));
  if (people.length === 0) return 0;

  const personById = new Map(people.map((p) => [p._id.toString(), p]));
  const events = await Event.find({ person: { $in: people.map((p) => p._id) } });

  let created = 0;
  for (const event of events) {
    const person = personById.get(event.person.toString());
    if (!person) continue;

    const { occurrence } = resolveOccurrence(event.date, person.feb29Rule, today);
    const channels = resolveChannels(user, event);
    const leadDays = resolveLeadDays(user, event);

    for (const lead of leadDays) {
      const scheduledFor = fireInstant(occurrence, lead, user.timezone, user.defaultReminderTime);
      // Don't backfill a lead time whose moment already passed by more than a
      // day - adding someone two days before their birthday shouldn't resurface
      // a stale "1 week before" reminder. The day-of instance still survives.
      if (scheduledFor.getTime() < now.getTime() - MS_PER_DAY) continue;

      const result = await Reminder.updateOne(
        { user: user._id, event: event._id, occurrenceDate: occurrence, leadDays: lead },
        {
          $setOnInsert: {
            user: user._id,
            event: event._id,
            occurrenceDate: occurrence,
            leadDays: lead,
            scheduledFor,
            status: 'pending',
            channels,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount && result.upsertedCount > 0) created += 1;
    }
  }
  return created;
}

/**
 * Regenerate a user's *pending* reminders from current settings (FR-21/52).
 * Used after a settings change (timezone, reminder time, lead times, channels):
 * the pending set is rebuilt so new fire-times/channels take effect, while
 * snoozed/done/sent instances (user actions + history) are left untouched.
 */
export async function regenerateForUser(user: UserDoc, now: Date = new Date()): Promise<number> {
  await Reminder.deleteMany({ user: user._id, status: 'pending' });
  return generateForUser(user, now);
}

/** Generate across every user - the cron "ensure" pass that also rotates years. */
export async function generateForAllUsers(now: Date = new Date()): Promise<number> {
  const users = await User.find();
  let created = 0;
  for (const user of users) created += await generateForUser(user, now);
  return created;
}

/**
 * Every user who can see a person: their owner plus the owner and members of
 * each shared list the person belongs to. Used to fan a person/event change out
 * to everyone who receives reminders for it (FR-44).
 */
export async function viewersOfPerson(person: PersonDoc): Promise<UserDoc[]> {
  const userIds = new Set<string>([person.owner.toString()]);
  if (person.lists.length > 0) {
    const lists = await SharedList.find({ _id: { $in: person.lists } });
    for (const list of lists) {
      userIds.add(list.owner.toString());
      for (const member of list.members) userIds.add(member.user.toString());
    }
  }
  return User.find({ _id: { $in: [...userIds] } });
}

/** Regenerate reminders for everyone who can see a person (after a create/edit). */
export async function generateForPersonViewers(
  person: PersonDoc,
  now: Date = new Date(),
): Promise<void> {
  for (const viewer of await viewersOfPerson(person)) {
    await generateForUser(viewer, now);
  }
}

/**
 * Re-derive one user's reminder set from their *current* access (FR-46/47).
 * Deletes reminders for events of people the user can no longer see - so
 * leaving / being removed from a list stops those reminders immediately - then
 * fills any gaps for the people they can still see. Their own owned-people
 * reminders are untouched.
 */
export async function syncUserReminders(user: UserDoc, now: Date = new Date()): Promise<void> {
  const people = await Person.find(await accessiblePeopleFilter(user._id));
  const events = await Event.find({ person: { $in: people.map((p) => p._id) } });
  const keepEventIds = events.map((e) => e._id);
  await Reminder.deleteMany({ user: user._id, event: { $nin: keepEventIds } });
  await generateForUser(user, now);
}

/** Run `syncUserReminders` for a batch of users (e.g. after a membership change). */
export async function syncUsersReminders(users: UserDoc[], now: Date = new Date()): Promise<void> {
  for (const user of users) await syncUserReminders(user, now);
}

export interface DispatchSummary {
  promoted: number;
  considered: number;
  sent: number;
}

/**
 * Dispatch all due reminders (FR-22). Steps:
 *   1. Promote snoozed reminders whose delay elapsed back to pending.
 *   2. Find pending reminders with `scheduledFor <= now`.
 *   3. Atomically claim each (pending → sent) so overlapping ticks can't
 *      double-send, then deliver across its channels best-effort.
 */
export async function dispatchDue(now: Date = new Date()): Promise<DispatchSummary> {
  const promote = await Reminder.updateMany(
    { status: 'snoozed', snoozeUntil: { $lte: now } },
    { $set: { status: 'pending' }, $unset: { snoozeUntil: '' } },
  );

  const due = await Reminder.find({ status: 'pending', scheduledFor: { $lte: now } }).sort({
    scheduledFor: 1,
  });

  let sent = 0;
  for (const reminder of due) {
    // Claim: only the tick that flips pending→sent proceeds to deliver.
    const claim = await Reminder.updateOne(
      { _id: reminder._id, status: 'pending' },
      { $set: { status: 'sent', sentAt: now } },
    );
    if (claim.modifiedCount !== 1) continue;

    try {
      await deliverReminder(reminder, now);
    } catch (err) {
      // The reminder is already persisted to the in-app feed; external channel
      // failures are retried with backoff inside each provider (Stage 12) and a
      // throw here is logged, not fatal - the loop continues.
      logger.error('reminder delivery failed', err instanceof Error ? err.message : err);
    }
    sent += 1;
  }

  return { promoted: promote.modifiedCount ?? 0, considered: due.length, sent };
}

/** Build the payload for one reminder and fan it out to its channels. */
async function deliverReminder(reminder: ReminderDoc, now: Date = new Date()): Promise<void> {
  const event = await Event.findById(reminder.event);
  if (!event) return;
  const person = await Person.findById(event.person);
  const user = await User.findById(reminder.user);
  if (!person || !user) return;

  const today = todayInTimeZone(user.timezone);
  const days = daysUntil(reminder.occurrenceDate, today);
  const age = event.type === 'birthday' ? ageTurning(reminder.occurrenceDate, event.date.year) : null;

  const copyInput = {
    name: person.fullName,
    eventType: event.type,
    customName: event.customName ?? null,
    daysRemaining: days,
    ageTurning: age,
  };

  const payload: ReminderPayload = {
    headline: reminderHeadline(copyInput),
    message: reminderMessage(copyInput),
    toEmail: user.email,
    toName: user.name,
    toPhone: user.phone ?? null,
    pushTokens: user.pushTokens,
    personId: person._id.toString(),
    reminderId: reminder._id.toString(),
    userId: user._id.toString(),
  };

  // Apply the SMS/WhatsApp fair-use cap: under cap, SMS stays and we count it
  // after a successful send; at cap, SMS is dropped and push/email fill in so
  // the reminder is never lost (FR-55). In-app is always implied downstream.
  const userId = user._id.toString();
  const fairUse = await resolveFairUse(userId, reminder.channels, now);
  if (fairUse.fellBack) {
    logger.info(`reminder ${reminder._id.toString()} → sms cap reached, fell back to push/email`);
  }

  const results = await dispatchToChannels(fairUse.channels, payload);
  if (fairUse.countSms && results.some((r) => r.channel === 'sms' && r.outcome === 'sent')) {
    await incrementSmsUsage(userId, smsPeriod(now));
  }

  // Persist what actually happened per channel (status:'sent' only means the row
  // was claimed + attempted). Flag a reminder that reached the in-app feed but
  // failed every *external* channel so the failure is visible, not silent.
  const external = results.filter((r) => r.channel !== 'inApp');
  const attemptedExternal = external.filter((r) => r.outcome !== 'skipped');
  const externalDeliveryFailed =
    attemptedExternal.length > 0 && attemptedExternal.every((r) => r.outcome === 'failed');
  // Guard on status:'sent' - a long retry window could overlap a user marking
  // this occurrence done/snoozed; don't stamp delivery metadata onto a row the
  // user has since changed (status is never written here, so the claim/idempotency
  // guarantees are untouched regardless).
  await Reminder.updateOne(
    { _id: reminder._id, status: 'sent' },
    {
      $set: {
        deliveryAttemptedAt: now,
        deliveryResults: results.map((r) => ({
          channel: r.channel,
          outcome: r.outcome,
          ...(r.detail ? { detail: r.detail } : {}),
          ...(r.attempts ? { attempts: r.attempts } : {}),
        })),
        externalDeliveryFailed,
      },
    },
  );

  const summary = results.map((r) => `${r.channel}:${r.outcome}`).join(' ');
  logger.info(`reminder ${reminder._id.toString()} → ${summary}`);
  if (externalDeliveryFailed) {
    logger.warn(
      `reminder ${reminder._id.toString()} delivered in-app only - all external channels failed`,
    );
  }
}
