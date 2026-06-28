import { Router } from 'express';

import { accessiblePeopleFilter } from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { todayInTimeZone } from '../lib/dates';
import { requireAuth } from '../middleware/require-auth';
import type { Feb29Rule } from '../models/common';
import { Event } from '../models/Event';
import { Person } from '../models/Person';

/**
 * GET /calendar/events - flat list of every accessible event with its RAW
 * recurring month/day (not a resolved next-occurrence). The month-grid calendar
 * in the app/website pages to any month, so it needs the stored month/day to
 * place an event on whichever year is being shown - `/upcoming` only knows the
 * single next occurrence and can't render a past-in-month date.
 *
 * Mounted at the literal `/calendar/events` (before the public `/calendar/:token`
 * ICS feed) so its auth guard never runs for token feed requests.
 */

type CalendarEvent = {
  personId: string;
  eventId: string;
  fullName: string;
  type: 'human' | 'pet';
  relationshipTag: string | null;
  photoUrl: string | null;
  eventType: 'birthday' | 'anniversary' | 'custom';
  customName: string | null;
  month: number;
  day: number;
  year: number | null;
  // Needed to place a Feb-29 event on the grid in non-leap years (FR-15).
  feb29Rule: Feb29Rule;
};

export const calendarEventsRouter = Router();

calendarEventsRouter.use(requireAuth);

calendarEventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const today = todayInTimeZone(user.timezone);

    const people = await Person.find(await accessiblePeopleFilter(user._id));
    const peopleById = new Map(people.map((p) => [p._id.toString(), p]));
    const events = await Event.find({ person: { $in: people.map((p) => p._id) } });

    const calendarEvents: CalendarEvent[] = [];
    for (const event of events) {
      const person = peopleById.get(event.person.toString());
      if (!person) continue;
      calendarEvents.push({
        personId: person._id.toString(),
        eventId: event._id.toString(),
        fullName: person.fullName,
        type: person.type,
        relationshipTag: person.relationshipTag ?? null,
        photoUrl: person.photoUrl ?? null,
        eventType: event.type,
        customName: event.customName ?? null,
        month: event.date.month,
        day: event.date.day,
        year: event.date.year ?? null,
        feb29Rule: person.feb29Rule,
      });
    }

    res.json({ today: today.toISOString(), events: calendarEvents });
  }),
);
