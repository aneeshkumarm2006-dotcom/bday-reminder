import { getUserListAccess } from './access';
import { resolveOccurrence, todayInTimeZone } from './dates';
import { buildCalendar, type IcsEvent } from './ics';
import { reminderHeadline } from './reminder-content';
import { Event, type EventDoc } from '../models/Event';
import { Person, type PersonDoc } from '../models/Person';
import type { UserDoc } from '../models/User';

/**
 * Per-user calendar feed assembly (TODO Stage 9; FR-38/39/40). Resolves which
 * people belong in a user's feed from their opt-in sync settings, then renders
 * one yearly-recurring VEVENT per event. Built fresh on every request, so the
 * feed always reflects current adds/edits/deletes (FR-39).
 *
 * Inclusion (FR-40):
 *   - `includePersonal` → everyone the user owns;
 *   - `lists` → people in each shared list the user chose to sync, intersected
 *     with the lists they can still access (so leaving a list drops it, FR-46).
 * A person owned by the user *and* in a synced list appears once (one query).
 */

const MS_PER_DAY = 86_400_000;

const CATEGORY_LABEL: Record<EventDoc['type'], string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  custom: 'Custom',
};

/** Every person to include in this user's feed, per their sync settings. */
export async function includedPeopleForUser(user: UserDoc): Promise<PersonDoc[]> {
  const cs = user.calendarSync;
  const access = await getUserListAccess(user._id);
  const syncedListIds = (cs?.lists ?? [])
    .map((id) => id.toString())
    .filter((id) => access.accessibleListIds.includes(id));

  const or: Record<string, unknown>[] = [];
  if (cs?.includePersonal) or.push({ owner: user._id });
  if (syncedListIds.length > 0) or.push({ lists: { $in: syncedListIds } });
  if (or.length === 0) return [];

  return Person.find({ $or: or });
}

/** A short, static description line (recurring events can't carry a changing age). */
function describe(person: PersonDoc, event: EventDoc): string | undefined {
  const parts: string[] = [];
  if (person.type === 'pet') parts.push('Pet');
  if (person.relationshipTag) parts.push(person.relationshipTag);
  if (event.type === 'birthday' && person.dob.year) parts.push(`Born in ${person.dob.year}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/** Build the ICS feed text for one user (FR-38). */
export async function buildUserCalendar(user: UserDoc, now: Date = new Date()): Promise<string> {
  const people = await includedPeopleForUser(user);
  const personById = new Map(people.map((p) => [p._id.toString(), p]));
  const events = await Event.find({ person: { $in: people.map((p) => p._id) } });
  const today = todayInTimeZone(user.timezone);

  const icsEvents: IcsEvent[] = [];
  for (const event of events) {
    const person = personById.get(event.person.toString());
    if (!person) continue;
    // Anchor the recurrence on the next observed occurrence (honors the per-person
    // Feb-29 rule and is always a valid date); FREQ=YEARLY repeats it each year.
    const { occurrence } = resolveOccurrence(event.date, person.feb29Rule, today);
    icsEvents.push({
      uid: `${event._id.toString()}@circle-the-date`,
      summary: reminderHeadline({
        name: person.fullName,
        eventType: event.type,
        customName: event.customName ?? null,
      }),
      description: describe(person, event),
      start: occurrence,
      end: new Date(occurrence.getTime() + MS_PER_DAY),
      dtstamp: now,
      lastModified: event.updatedAt,
      categories: CATEGORY_LABEL[event.type],
    });
  }

  return buildCalendar({
    name: 'Birthdays & events',
    description: 'Birthdays and events from Circle the date',
    events: icsEvents,
  });
}
