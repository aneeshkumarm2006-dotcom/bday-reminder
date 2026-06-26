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
import { normalizePhone } from '../lib/phone';
import { serializeEvent, serializePerson, type PersonExtras } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import type { Feb29Rule } from '../models/common';
import { Event, type EventDoc } from '../models/Event';
import { Note } from '../models/Note';
import { Person, type PersonDoc } from '../models/Person';
import { Reminder } from '../models/Reminder';
import { User } from '../models/User';

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

const baseFields = {
  type: z.enum(['human', 'pet']).optional(),
  relationshipTag: z.string().trim().min(1).max(40).nullable().optional(),
  photoUrl: photoUrlSchema,
  feb29Rule: z.enum(['feb28', 'feb29only', 'mar1']).optional(),
  // Stored loosely (any region works); a bare 10-digit number is normalized to
  // NANP E.164 (+1) on save - see lib/phone.ts. No pattern, so we never reject.
  phone: z.string().trim().min(1).max(40).nullable().optional(),
  // Shared-list ids this person belongs to (Stage 8). The caller must own or
  // belong to every list they assign (FR-43/45).
  lists: z.array(z.string().trim().min(1)).optional(),
};

const createSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Add a name so you know who this is.'),
    dob: dobSchema,
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

    const person = await Person.create({
      owner: userId,
      lists,
      fullName: body.fullName,
      type: body.type ?? 'human',
      relationshipTag: body.relationshipTag ?? undefined,
      photoUrl: body.photoUrl ?? undefined,
      dob: { month: body.dob.month, day: body.dob.day, year: body.dob.year ?? undefined },
      feb29Rule: body.feb29Rule ?? 'feb28',
      phone: normalizePhone(body.phone) ?? undefined,
      createdBy: userId,
      updatedBy: userId,
    });

    // Every person has at least one event: their birthday, mirroring the DOB.
    const event = await Event.create({
      person: person._id,
      type: 'birthday',
      date: { month: person.dob.month, day: person.dob.day, year: person.dob.year },
    });

    // Schedule reminders for everyone who can see this person (owner + members).
    await generateForPersonViewers(person);

    res.status(201).json({
      person: serializePerson(person, { lastEditedBy: await lastEditedBy(person) }),
      events: [serializeEvent(event)],
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
