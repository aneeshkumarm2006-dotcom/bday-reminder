import { Router } from 'express';
import { z } from 'zod';

import {
  generateForPersonViewers,
  syncUsersReminders,
} from '../jobs/reminder-engine';
import {
  assertListDeltaWritable,
  assertWritableLists,
  accessiblePeopleFilterFor,
  getUserListAccess,
  resolvePersonAccess,
  usersOfLists,
} from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { maxDayInMonth, resolveOccurrence, todayInTimeZone } from '../lib/dates';
import { badRequest } from '../lib/http-error';
import { normalizePhone } from '../lib/phone';
import { serializeEvent, serializePerson, type PersonExtras } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import type { Feb29Rule } from '../models/common';
import { Event, type EventDoc } from '../models/Event';
import { Note } from '../models/Note';
import { Person, type PersonDoc } from '../models/Person';
import { Reminder } from '../models/Reminder';
import { User, type UserDoc } from '../models/User';

/**
 * People + their birthday events (TODO Stage 3; FR-5/8/9/12/13/14/15). Creating
 * a Person auto-creates their Birthday Event; deleting one cascades its events,
 * pending reminders, and notes (PRD §10). Reads are scoped to everything the
 * caller can see - their own people plus anyone in a shared list they belong to
 * (Stage 8) - and anyone with access can edit (FR-43/45). Every write
 * stamps `updatedBy` for the "Last edited by" attribution (FR-45) and fans
 * reminder changes out to every member who receives reminders for the person.
 */

const CURRENT_YEAR = new Date().getUTCFullYear();

const dobSchema = z
  .object({
    month: z.number().int().min(1, 'Pick a month.').max(12, 'Pick a month.'),
    day: z.number().int().min(1, 'Pick a day.').max(31, 'Pick a day.'),
    // Year is optional (FR-14); reject the future and absurdly old years.
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

// A hosted https URL (Cloudinary) or the data-URL fallback when it's unconfigured.
const photoUrlSchema = z
  .string()
  .trim()
  .max(8_000_000)
  .refine((v) => /^(https?:\/\/|data:image\/)/.test(v), 'Enter a valid image URL.')
  .nullable()
  .optional();

// Simple, permissive email shape - the friend's address, recipient of the
// auto-send birthday greeting (Stage 14). Empty string / null clears it.
const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address.')
  .nullable()
  .optional();

// A 24-hour "HH:mm" send time. `null`/omitted means "inherit the owner's default
// reminder time" at dispatch (see reminder-engine). Shared by both auto-send channels.
const sendTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 09:00.')
  .nullable()
  .optional();

// Auto-send toggle + editable greeting body + per-person send time (Stage 14).
// `null` clears the whole config; `lastSentYear` is server-managed and never
// accepted from the client.
const autoBirthdayEmailSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(2000).nullable().optional(),
    sendTime: sendTimeSchema,
  })
  .strict()
  .nullable()
  .optional();

// Auto-send birthday SMS toggle + editable body + send time (Stage 15). Same shape
// as email but the message is capped at 160 chars to keep it within one SMS segment.
const autoBirthdaySmsSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(160).nullable().optional(),
    sendTime: sendTimeSchema,
  })
  .strict()
  .nullable()
  .optional();

const baseFields = {
  type: z.enum(['human', 'pet']).optional(),
  relationshipTag: z.string().trim().min(1).max(40).nullable().optional(),
  photoUrl: photoUrlSchema,
  feb29Rule: z.enum(['feb28', 'feb29only', 'mar1']).optional(),
  // Stored loosely (any region works); a bare 10-digit number is normalized to
  // NANP E.164 (+1) on save - see lib/phone.ts. No pattern, so we never reject.
  phone: z.string().trim().min(1).max(40).nullable().optional(),
  email: emailSchema,
  autoBirthdayEmail: autoBirthdayEmailSchema,
  autoBirthdaySms: autoBirthdaySmsSchema,
  // Shared-list ids this person belongs to (Stage 8). The caller must own or
  // belong to every list they assign (FR-43/45).
  lists: z.array(z.string().trim().min(1)).optional(),
};

// An extra event (anniversary/custom) attached while creating the person, so
// "other dates" can be added in one step instead of a follow-up POST /events
// (FR-16). The birthday is still auto-created from the DOB, so only these two
// types are accepted here; a custom event needs a name. Date rules reuse
// `dobSchema` (month/day required, year optional, day-in-month checked).
const createEventItemSchema = z
  .object({
    type: z.enum(['anniversary', 'custom']),
    customName: z.string().trim().min(1).max(60).nullable().optional(),
    date: dobSchema,
    reminderTimeOverride: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 09:00.')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((e) => e.type !== 'custom' || !!e.customName?.trim(), {
    message: 'Name this event so you know what it is.',
    path: ['customName'],
  });

const createSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Add a name so you know who this is.'),
    dob: dobSchema,
    // Optional extra events created atomically with the person (see above).
    events: z.array(createEventItemSchema).max(20).optional(),
    ...baseFields,
  })
  .strict();

const updateSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Add a name so you know who this is.').optional(),
    dob: dobSchema.optional(),
    ...baseFields,
  })
  .strict();

export const peopleRouter = Router();

peopleRouter.use(requireAuth);

type NextOccurrence = {
  eventId: string;
  occurrenceDate: string;
  daysRemaining: number;
  ageTurning: number | null;
};

/** Soonest upcoming occurrence across a person's events, in the user's tz. */
function nextAcrossEvents(events: EventDoc[], feb29Rule: Feb29Rule, today: Date): NextOccurrence | null {
  let soonest: NextOccurrence | null = null;
  for (const event of events) {
    const r = resolveOccurrence(event.date, feb29Rule, today);
    if (!soonest || r.daysRemaining < soonest.daysRemaining) {
      soonest = {
        eventId: event._id.toString(),
        occurrenceDate: r.occurrence.toISOString(),
        daysRemaining: r.daysRemaining,
        // Age is birthday-only (FR-13/14); other event types never show it.
        ageTurning: event.type === 'birthday' ? r.ageTurning : null,
      };
    }
  }
  return soonest;
}

/** Group events by their owning person id. */
function groupByPerson(events: EventDoc[]): Map<string, EventDoc[]> {
  const map = new Map<string, EventDoc[]>();
  for (const event of events) {
    const key = event.person.toString();
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return map;
}

/** Resolve `updatedBy` → a {id,name} for the attribution line (FR-45). */
async function lastEditedBy(person: PersonDoc): Promise<PersonExtras['lastEditedBy']> {
  const editor = await User.findById(person.updatedBy);
  return editor ? { id: editor._id.toString(), name: editor.name } : null;
}

/** Trimmed lower-cased friend email, or undefined when blank (Stage 14). */
function normalizeEmail(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

/**
 * Guard enabling auto-send birthday email (Stage 14): it needs a recipient email
 * on the person AND the caller's Gmail connected (the sender). Blocking a
 * half-configured toggle keeps the confirm-once UX honest and the dispatch simple.
 */
function assertAutoSendAllowed(user: UserDoc, email: string | undefined, enabled: boolean): void {
  if (!enabled) return;
  if (!email) throw badRequest("Add this person's email before turning on auto-send.");
  if (!user.gmailIntegration?.email) {
    throw badRequest('Connect your Gmail before turning on auto-send.');
  }
}

/**
 * Guard enabling auto-send birthday SMS (Stage 15): it needs a recipient phone on
 * the person. Unlike email there is NO per-user account check - the Twilio account
 * is server-global, so a user can't "connect" it; the client hides the toggle when
 * SMS auto-send isn't provisioned (GET /config `smsAutoSendAvailable`).
 */
function assertAutoSmsAllowed(phone: string | undefined, enabled: boolean): void {
  if (!enabled) return;
  if (!phone) throw badRequest("Add this person's phone before turning on auto-send SMS.");
}

/**
 * POST /people - create a Person and auto-create their Birthday Event (FR-5/12).
 * Name + DOB month/day are required; the year is optional. An optional `lists`
 * places the person into shared lists the caller can write to.
 */
peopleRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof createSchema>;

    let lists: string[] = [];
    if (body.lists && body.lists.length > 0) {
      const access = await getUserListAccess(userId);
      lists = assertWritableLists(body.lists, access);
    }

    const email = normalizeEmail(body.email);
    const enabled = !!body.autoBirthdayEmail?.enabled;
    assertAutoSendAllowed(req.user!, email, enabled);

    const phone = normalizePhone(body.phone) ?? undefined;
    const smsEnabled = !!body.autoBirthdaySms?.enabled;
    assertAutoSmsAllowed(phone, smsEnabled);

    const person = await Person.create({
      owner: userId,
      lists,
      fullName: body.fullName,
      type: body.type ?? 'human',
      relationshipTag: body.relationshipTag ?? undefined,
      photoUrl: body.photoUrl ?? undefined,
      dob: { month: body.dob.month, day: body.dob.day, year: body.dob.year ?? undefined },
      feb29Rule: body.feb29Rule ?? 'feb28',
      phone,
      email,
      autoBirthdayEmail:
        body.autoBirthdayEmail == null
          ? undefined
          : {
              enabled,
              message: body.autoBirthdayEmail.message?.trim() || undefined,
              sendTime: body.autoBirthdayEmail.sendTime ?? undefined,
            },
      autoBirthdaySms:
        body.autoBirthdaySms == null
          ? undefined
          : {
              enabled: smsEnabled,
              message: body.autoBirthdaySms.message?.trim() || undefined,
              sendTime: body.autoBirthdaySms.sendTime ?? undefined,
            },
      createdBy: userId,
      updatedBy: userId,
    });

    // Every person has at least one event: their birthday, mirroring the DOB.
    const birthday = await Event.create({
      person: person._id,
      type: 'birthday',
      date: { month: person.dob.month, day: person.dob.day, year: person.dob.year },
    });

    // Any extra dates ("other things like anniversaries") requested with the
    // person are created here too, so it's one atomic step (FR-16).
    const events = [birthday];
    if (body.events && body.events.length > 0) {
      const extra = await Event.insertMany(
        body.events.map((e) => ({
          person: person._id,
          type: e.type,
          customName: e.type === 'custom' ? (e.customName ?? undefined) : undefined,
          date: { month: e.date.month, day: e.date.day, year: e.date.year ?? undefined },
          reminderTimeOverride:
            e.reminderTimeOverride === undefined ? undefined : (e.reminderTimeOverride ?? null),
        })),
      );
      events.push(...extra);
    }

    // Schedule reminders for everyone who can see this person (owner + members).
    // Runs once and covers all of the person's events, birthday and extras.
    await generateForPersonViewers(person);

    res.status(201).json({
      person: serializePerson(person, { lastEditedBy: await lastEditedBy(person) }),
      events: events.map(serializeEvent),
    });
  }),
);

/**
 * GET /people - everyone the caller can see (FR-9/44): their own people plus
 * anyone in a shared list they belong to. Optional `?tag=` relationship filter
 * and `?sort=next|name` (default `next`, ascending by soonest occurrence).
 */
peopleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const sort = req.query.sort === 'name' ? 'name' : 'next';
    const today = todayInTimeZone(user.timezone);

    const access = await getUserListAccess(user._id);
    const filter: Record<string, unknown> = accessiblePeopleFilterFor(user._id.toString(), access);
    if (tag) filter.relationshipTag = tag;

    const people = await Person.find(filter);
    const events = await Event.find({ person: { $in: people.map((p) => p._id) } });
    const eventsByPerson = groupByPerson(events);

    // Batch-resolve editor names for the attribution line.
    const editorIds = [...new Set(people.map((p) => p.updatedBy.toString()))];
    const editors = await User.find({ _id: { $in: editorIds } });
    const editorById = new Map(editors.map((u) => [u._id.toString(), u]));

    const items = people.map((person) => {
      const editor = editorById.get(person.updatedBy.toString());
      return {
        ...serializePerson(person, {
          lastEditedBy: editor ? { id: editor._id.toString(), name: editor.name } : null,
        }),
        next: nextAcrossEvents(eventsByPerson.get(person._id.toString()) ?? [], person.feb29Rule, today),
      };
    });

    items.sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName);
      const da = a.next?.daysRemaining ?? Number.POSITIVE_INFINITY;
      const db = b.next?.daysRemaining ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

    res.json({ people: items });
  }),
);

/** GET /people/:id - one person with their events (FR-8), scoped by access. */
peopleRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { person } = await resolvePersonAccess(req.params.id, req.userId!);
    const events = await Event.find({ person: person._id });
    res.json({
      person: serializePerson(person, { lastEditedBy: await lastEditedBy(person) }),
      events: events.map(serializeEvent),
    });
  }),
);

/**
 * PATCH /people/:id - edit a person (FR-8/45). Requires list access.
 * Changing the DOB syncs the birthday event and clears its future
 * pending/snoozed reminders so they regenerate (sent history untouched, §10);
 * the change fans out to every member who receives reminders for the person.
 * Changing `lists` re-scopes who can see the person and re-syncs their reminders.
 */
peopleRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const userId = user._id.toString();
    const { person, access } = await resolvePersonAccess(req.params.id, userId);
    const patch = req.body as z.infer<typeof updateSchema>;

    const prevListIds = person.lists.map((l) => l.toString());

    if (patch.fullName !== undefined) person.fullName = patch.fullName;
    if (patch.type !== undefined) person.type = patch.type;
    if (patch.relationshipTag !== undefined) person.relationshipTag = patch.relationshipTag ?? undefined;
    if (patch.photoUrl !== undefined) person.photoUrl = patch.photoUrl ?? undefined;
    if (patch.phone !== undefined) person.phone = normalizePhone(patch.phone) ?? undefined;
    if (patch.email !== undefined) person.email = normalizeEmail(patch.email);
    if (patch.autoBirthdayEmail !== undefined) {
      if (patch.autoBirthdayEmail === null) {
        person.autoBirthdayEmail = undefined;
      } else {
        // Preserve the server-managed lastSentYear; only `message`/`sendTime`
        // undefined means "leave as-is" (null/'' clears the message → default copy;
        // null sendTime clears it → inherit the owner's default reminder time).
        const prev = person.autoBirthdayEmail;
        const nextMessage =
          patch.autoBirthdayEmail.message === undefined
            ? prev?.message
            : patch.autoBirthdayEmail.message?.trim() || undefined;
        const nextSendTime =
          patch.autoBirthdayEmail.sendTime === undefined
            ? prev?.sendTime
            : (patch.autoBirthdayEmail.sendTime ?? undefined);
        person.autoBirthdayEmail = {
          enabled: patch.autoBirthdayEmail.enabled,
          message: nextMessage,
          sendTime: nextSendTime,
          lastSentYear: prev?.lastSentYear,
        };
      }
    }
    if (patch.autoBirthdaySms !== undefined) {
      if (patch.autoBirthdaySms === null) {
        person.autoBirthdaySms = undefined;
      } else {
        // Preserve the server-managed lastSentYear; only `message`/`sendTime`
        // undefined means "leave as-is" (null/'' clears the message → default copy;
        // null sendTime clears it → inherit the owner's default reminder time).
        const prev = person.autoBirthdaySms;
        const nextMessage =
          patch.autoBirthdaySms.message === undefined
            ? prev?.message
            : patch.autoBirthdaySms.message?.trim() || undefined;
        const nextSendTime =
          patch.autoBirthdaySms.sendTime === undefined
            ? prev?.sendTime
            : (patch.autoBirthdaySms.sendTime ?? undefined);
        person.autoBirthdaySms = {
          enabled: patch.autoBirthdaySms.enabled,
          message: nextMessage,
          sendTime: nextSendTime,
          lastSentYear: prev?.lastSentYear,
        };
      }
    }
    if (patch.feb29Rule !== undefined) person.feb29Rule = patch.feb29Rule;
    if (patch.dob !== undefined) {
      person.dob = { month: patch.dob.month, day: patch.dob.day, year: patch.dob.year ?? undefined };
    }
    if (patch.lists !== undefined) {
      // Only the lists being added/removed must be writable by the caller, so a
      // member can re-save without dropping memberships they don't manage. This
      // can also remove the person from a list (and thus from some members'
      // view). Mongoose casts the id strings to ObjectIds on save.
      person.lists = assertListDeltaWritable(
        prevListIds,
        patch.lists,
        access,
      ) as unknown as PersonDoc['lists'];
    }
    // Auto-send needs a recipient email + the owner's Gmail (checked against the
    // post-patch email). The sender is always the person's owner, so validate
    // against them, not necessarily the (possibly shared) editor.
    if (patch.email !== undefined || patch.autoBirthdayEmail !== undefined) {
      const owner = person.owner.equals(user._id) ? user : await User.findById(person.owner);
      assertAutoSendAllowed(
        owner ?? user,
        person.email,
        !!person.autoBirthdayEmail?.enabled,
      );
    }
    // Auto-send SMS just needs a recipient phone (no per-user account); validate
    // against the post-patch phone.
    if (patch.phone !== undefined || patch.autoBirthdaySms !== undefined) {
      assertAutoSmsAllowed(person.phone, !!person.autoBirthdaySms?.enabled);
    }
    person.updatedBy = user._id;
    await person.save();

    const schedulingChanged = patch.dob !== undefined || patch.feb29Rule !== undefined;
    const listsChanged = patch.lists !== undefined;

    // Keep the birthday event in step with the DOB / Feb-29 rule.
    if (schedulingChanged) {
      const birthday = await Event.findOne({ person: person._id, type: 'birthday' });
      if (birthday) {
        birthday.date = { month: person.dob.month, day: person.dob.day, year: person.dob.year };
        await birthday.save();
        // The date moved: drop future not-yet-acted reminders across *every*
        // recipient, then refill from the new date (sent history left intact, §10).
        await Reminder.deleteMany({ event: birthday._id, status: { $in: ['pending', 'snoozed'] } });
      }
    }

    if (schedulingChanged || listsChanged) {
      // Refill/anchor reminders for everyone who can currently see the person.
      await generateForPersonViewers(person);
    }
    if (listsChanged) {
      // Stop reminders for anyone who lost access via a removed list (FR-46/47).
      const nextListIds = person.lists.map((l) => l.toString());
      const removedListIds = prevListIds.filter((id) => !nextListIds.includes(id));
      if (removedListIds.length > 0) {
        await syncUsersReminders(await usersOfLists(removedListIds));
      }
    }

    const events = await Event.find({ person: person._id });
    res.json({
      person: serializePerson(person, { lastEditedBy: await lastEditedBy(person) }),
      events: events.map(serializeEvent),
    });
  }),
);

/**
 * DELETE /people/:id - remove a person and cascade their events, reminders, and
 * notes (PRD §10). Requires list access (FR-8/45). Reminders are deleted
 * across every recipient (no user filter), so the person disappears for all
 * members. Idempotent at the data layer.
 */
peopleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { person } = await resolvePersonAccess(req.params.id, req.userId!);

    const events = await Event.find({ person: person._id });
    const eventIds = events.map((e) => e._id);

    await Reminder.deleteMany({ event: { $in: eventIds } });
    await Event.deleteMany({ person: person._id });
    await Note.deleteMany({ person: person._id });
    await person.deleteOne();

    res.status(204).end();
  }),
);
