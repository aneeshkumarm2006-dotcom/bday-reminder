import { Router } from 'express';

import { accessiblePeopleFilter } from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { resolveOccurrence, todayInTimeZone, type ProximityGroup } from '../lib/dates';
import { requireAuth } from '../middleware/require-auth';
import { Event } from '../models/Event';
import { Person } from '../models/Person';

/**
 * GET /upcoming — the computed Upcoming feed (TODO Stage 3; DESIGN.md §8.2).
 * One row per event occurrence across everyone the viewer can see — their own
 * people plus anyone in a shared list they belong to (Stage 8, FR-44) — with
 * days-remaining and age-turning resolved in the viewer's own timezone (FR-53),
 * grouped This week / This month / Later and sorted ascending.
 */

type UpcomingItem = {
  personId: string;
  eventId: string;
  fullName: string;
  type: 'human' | 'pet';
  relationshipTag: string | null;
  photoUrl: string | null;
  phone: string | null;
  eventType: 'birthday' | 'anniversary' | 'custom';
  customName: string | null;
  occurrenceDate: string;
  daysRemaining: number;
  ageTurning: number | null;
  group: ProximityGroup;
};

export const upcomingRouter = Router();

upcomingRouter.use(requireAuth);

upcomingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const today = todayInTimeZone(user.timezone);

    const people = await Person.find(await accessiblePeopleFilter(user._id));
    const peopleById = new Map(people.map((p) => [p._id.toString(), p]));
    const events = await Event.find({ person: { $in: people.map((p) => p._id) } });

    const items: UpcomingItem[] = [];
    for (const event of events) {
      const person = peopleById.get(event.person.toString());
      if (!person) continue;
      const { occurrence, daysRemaining, ageTurning, group } = resolveOccurrence(
        event.date,
        person.feb29Rule,
        today,
      );
      items.push({
        personId: person._id.toString(),
        eventId: event._id.toString(),
        fullName: person.fullName,
        type: person.type,
        relationshipTag: person.relationshipTag ?? null,
        photoUrl: person.photoUrl ?? null,
        phone: person.phone ?? null,
        eventType: event.type,
        customName: event.customName ?? null,
        occurrenceDate: occurrence.toISOString(),
        daysRemaining,
        // Age is a birthday concept only — never shown for anniversaries/custom
        // events even when they carry a year (FR-13/14, §11).
        ageTurning: event.type === 'birthday' ? ageTurning : null,
        group,
      });
    }

    // Ascending by days-remaining; stable name tiebreak so equal days read well.
    items.sort((a, b) => a.daysRemaining - b.daysRemaining || a.fullName.localeCompare(b.fullName));

    // Distinct relationship tags present, for the feed's filter chips (FR-9).
    const tags = [...new Set(items.map((i) => i.relationshipTag).filter((t): t is string => !!t))].sort(
      (a, b) => a.localeCompare(b),
    );

    res.json({ today: today.toISOString(), tags, items });
  }),
);
