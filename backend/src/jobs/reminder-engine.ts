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
import {
  autoSmsPeriod,
  getAutoSmsUsage,
  incrementAutoSmsUsage,
  twilioMonthlyCap,
} from '../lib/auto-sms-usage';
import {
  birthdayEmailText,
  renderBirthdayEmailHtml,
} from '../lib/birthday-email-template';
import { sendGmailAs, type GmailSender } from '../lib/gmail-send';
import { logger } from '../lib/logger';
import {
  birthdayEmailBody,
  birthdayEmailSubject,
  birthdaySmsBody,
  reminderHeadline,
  reminderMessage,
} from '../lib/reminder-content';
import { fireInstant } from '../lib/schedule';
import { incrementSmsUsage, resolveFairUse, smsPeriod } from '../lib/sms-usage';
import { sendTwilioSms, twilioConfigured, type SmsSender } from '../lib/twilio-send';
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

/** Reminder time-of-day for an event: per-event override wins, else the user default (FR-22). */
export function resolveReminderTime(user: UserDoc, event: EventDoc): string {
  return event.reminderTimeOverride ?? user.defaultReminderTime;
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
      const scheduledFor = fireInstant(occurrence, lead, user.timezone, resolveReminderTime(user, event));
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

export interface GreetingDispatchSummary {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Auto-send birthday greetings (Stage 14). Distinct from the reminder dispatch:
 * this emails the *person* (the friend) on their birthday, AS the person's owner,
 * through the owner's connected Gmail - so it reads like a message the user sent.
 *
 * Runs on the same cron tick as `dispatchDue` but is intentionally decoupled from
 * the per-viewer Reminder rows: it fires whenever the birthday is *today* (in the
 * owner's timezone) at/after their reminder time, regardless of whether they keep
 * a day-of reminder. A per-person atomic claim on `autoBirthdayEmail.lastSentYear`
 * dedupes overlapping ticks and enforces once-per-year; a non-`sent` outcome rolls
 * the claim back so a transient failure is retried on the next tick.
 *
 * `deps.send` is injectable so tests/smoke drive it with a stub (no real Gmail).
 */
export async function dispatchBirthdayGreetings(
  now: Date = new Date(),
  deps: { send?: GmailSender } = {},
): Promise<GreetingDispatchSummary> {
  const send = deps.send ?? sendGmailAs;
  const summary: GreetingDispatchSummary = { considered: 0, sent: 0, skipped: 0, failed: 0 };

  // Only owners who connected Gmail can auto-send; pull the encrypted token
  // (select:false) so the sender can decrypt it.
  const senders = await User.find({ 'gmailIntegration.email': { $exists: true } }).select(
    '+gmailIntegration.refreshTokenEnc',
  );

  for (const user of senders) {
    const today = todayInTimeZone(user.timezone);
    const people = await Person.find({
      owner: user._id,
      'autoBirthdayEmail.enabled': true,
      email: { $exists: true, $nin: [null, ''] },
    });

    for (const person of people) {
      if (!person.email) continue;
      const { occurrence } = resolveOccurrence(person.dob, person.feb29Rule, today);
      // Only on the birthday itself, once the send time has arrived. The person's
      // per-greeting sendTime wins; unset falls back to the owner's default time.
      if (daysUntil(occurrence, today) !== 0) continue;
      const sendTime = person.autoBirthdayEmail?.sendTime ?? user.defaultReminderTime;
      if (now.getTime() < fireInstant(occurrence, 0, user.timezone, sendTime).getTime()) {
        continue;
      }

      const year = occurrence.getUTCFullYear();
      const prevYear = person.autoBirthdayEmail?.lastSentYear;
      if (prevYear === year) continue;
      summary.considered += 1;

      // Claim: only the writer that flips lastSentYear to this year proceeds.
      const claim = await Person.updateOne(
        { _id: person._id, 'autoBirthdayEmail.lastSentYear': { $ne: year } },
        { $set: { 'autoBirthdayEmail.lastSentYear': year } },
      );
      if (claim.modifiedCount !== 1) continue;

      // The greeting the user wrote/picked (plain text); default copy otherwise.
      const greeting = person.autoBirthdayEmail?.message?.trim() || birthdayEmailBody(person.fullName);
      const result = await send(user, {
        to: person.email,
        subject: birthdayEmailSubject(person.fullName),
        // Wrap the greeting in the designed HTML card; keep a plain-text fallback.
        // Both carry the "Sent with Circle the date" footer at the very end.
        text: birthdayEmailText(greeting),
        html: renderBirthdayEmailHtml(greeting),
      });

      if (result.outcome === 'sent') {
        summary.sent += 1;
      } else {
        if (result.outcome === 'skipped') summary.skipped += 1;
        else summary.failed += 1;
        // Roll the claim back so the greeting is retried (next tick / next year).
        await Person.updateOne(
          { _id: person._id },
          prevYear == null
            ? { $unset: { 'autoBirthdayEmail.lastSentYear': '' } }
            : { $set: { 'autoBirthdayEmail.lastSentYear': prevYear } },
        );
      }
      logger.info(
        `greeting ${person._id.toString()} → ${result.outcome}${result.detail ? ` (${result.detail})` : ''}`,
      );
    }
  }

  if (summary.sent > 0 || summary.failed > 0) {
    logger.info(
      `greetings: considered ${summary.considered}, sent ${summary.sent}, failed ${summary.failed}`,
    );
  }
  return summary;
}

/**
 * Auto-send birthday SMS greetings (Stage 15). The SMS analog of
 * `dispatchBirthdayGreetings`, texting the *person* on their birthday AS the
 * person's owner. Two structural differences from the email path:
 *
 *  1. There is no per-user carrier account, so we can't shrink the candidate set
 *     by "users who connected an integration". We query people directly and
 *     resolve each person's OWNER (cached) for timezone / reminder-time gating
 *     and the sender name. Only the owner auto-sends, even for shared-list people
 *     (the single per-person yearly claim guarantees exactly one send).
 *  2. The shared Twilio account costs money per message, so an account-wide
 *     monthly cap (`TWILIO_MONTHLY_CAP`, 0 = unlimited) stops sends once reached.
 *
 * Same once-per-year atomic claim on `autoBirthdaySms.lastSentYear` with rollback
 * on a non-`sent` outcome, so a transient failure is retried on the next tick.
 * `deps.send` is injectable for tests/smoke.
 */
export async function dispatchBirthdaySms(
  now: Date = new Date(),
  deps: { send?: SmsSender } = {},
): Promise<GreetingDispatchSummary> {
  const send = deps.send ?? sendTwilioSms;
  const summary: GreetingDispatchSummary = { considered: 0, sent: 0, skipped: 0, failed: 0 };

  // Nothing to do until a shared Twilio account is provisioned.
  if (!twilioConfigured()) return summary;

  const people = await Person.find({
    'autoBirthdaySms.enabled': true,
    phone: { $exists: true, $nin: [null, ''] },
  });
  if (people.length === 0) return summary;

  // Budget cap: read the account-wide count once, track a running total locally,
  // and stop for the month once the cap is hit.
  const cap = twilioMonthlyCap();
  const period = autoSmsPeriod(now);
  let used = cap > 0 ? await getAutoSmsUsage(period) : 0;

  const ownerCache = new Map<string, UserDoc | null>();
  const ownerOf = async (id: string): Promise<UserDoc | null> => {
    if (!ownerCache.has(id)) ownerCache.set(id, await User.findById(id));
    return ownerCache.get(id) ?? null;
  };

  for (const person of people) {
    if (!person.phone) continue;
    const owner = await ownerOf(person.owner.toString());
    if (!owner) continue;

    const today = todayInTimeZone(owner.timezone);
    const { occurrence } = resolveOccurrence(person.dob, person.feb29Rule, today);
    // Only on the birthday itself, once the send time has arrived. The person's
    // per-greeting sendTime wins; unset falls back to the owner's default time.
    if (daysUntil(occurrence, today) !== 0) continue;
    const sendTime = person.autoBirthdaySms?.sendTime ?? owner.defaultReminderTime;
    if (now.getTime() < fireInstant(occurrence, 0, owner.timezone, sendTime).getTime()) {
      continue;
    }

    const year = occurrence.getUTCFullYear();
    const prevYear = person.autoBirthdaySms?.lastSentYear;
    if (prevYear === year) continue;
    summary.considered += 1;

    // A malformed / non-E.164 number can never send; skip it rather than let
    // Twilio 400 on every tick forever (normalizePhone is soft on non-NANP input).
    if (!/^\+[1-9]\d{6,14}$/.test(person.phone)) {
      summary.skipped += 1;
      logger.info(`greeting-sms ${person._id.toString()} → skipped (phone not E.164)`);
      continue;
    }

    // Budget stop: don't send (or claim) once the month's cap is reached.
    if (cap > 0 && used >= cap) {
      summary.skipped += 1;
      logger.info(
        `greeting-sms ${person._id.toString()} → skipped (twilio monthly cap ${cap} reached)`,
      );
      continue;
    }

    // Claim: only the writer that flips lastSentYear to this year proceeds.
    const claim = await Person.updateOne(
      { _id: person._id, 'autoBirthdaySms.lastSentYear': { $ne: year } },
      { $set: { 'autoBirthdaySms.lastSentYear': year } },
    );
    if (claim.modifiedCount !== 1) continue;

    const result = await send(
      person.phone,
      person.autoBirthdaySms?.message?.trim() || birthdaySmsBody(person.fullName, owner.name),
    );

    if (result.outcome === 'sent') {
      summary.sent += 1;
      used = await incrementAutoSmsUsage(period);
    } else {
      if (result.outcome === 'skipped') summary.skipped += 1;
      else summary.failed += 1;
      // Roll the claim back so the greeting is retried (next tick / next year).
      await Person.updateOne(
        { _id: person._id },
        prevYear == null
          ? { $unset: { 'autoBirthdaySms.lastSentYear': '' } }
          : { $set: { 'autoBirthdaySms.lastSentYear': prevYear } },
      );
    }
    logger.info(
      `greeting-sms ${person._id.toString()} → ${result.outcome}${result.detail ? ` (${result.detail})` : ''}`,
    );
  }

  if (summary.sent > 0 || summary.failed > 0) {
    logger.info(
      `greetings-sms: considered ${summary.considered}, sent ${summary.sent}, failed ${summary.failed}`,
    );
  }
  return summary;
}
