import type { HydratedDocument } from 'mongoose';

import { Event } from '../models/Event';
import { Note } from '../models/Note';
import type { PersonDoc } from '../models/Person';
import { PersonMute } from '../models/PersonMute';
import { Reminder } from '../models/Reminder';

/** A loaded Person - these helpers save/delete, so they need the live document. */
type LoadedPerson = HydratedDocument<PersonDoc>;

/**
 * The two Person operations that have to behave identically wherever they're
 * triggered. Both started life inline in `routes/people.ts`; they moved here once
 * `lib/self-person.ts` gained its own reasons to move a birthday and to delete a
 * card, because two drifting copies of a cascade is how orphan rows appear.
 */

/**
 * Re-point a person's birthday event at their current DOB (PRD §10). Drops
 * future not-yet-acted reminders across *every* recipient so they refill from
 * the new date; sent history is left intact.
 */
export async function syncBirthdayEvent(person: LoadedPerson): Promise<void> {
  const birthday = await Event.findOne({ person: person._id, type: 'birthday' });
  if (!birthday) return;
  birthday.date = { month: person.dob.month, day: person.dob.day, year: person.dob.year };
  await birthday.save();
  await Reminder.deleteMany({ event: birthday._id, status: { $in: ['pending', 'snoozed'] } });
}

/**
 * Delete a person and everything hanging off them (PRD §10): events, reminders
 * across every recipient (no user filter, so they disappear for all members),
 * notes, and any per-viewer calendar exclusions. Idempotent at the data layer.
 */
export async function deletePersonCascade(person: LoadedPerson): Promise<void> {
  const events = await Event.find({ person: person._id });
  const eventIds = events.map((e) => e._id);

  await Reminder.deleteMany({ event: { $in: eventIds } });
  await Event.deleteMany({ person: person._id });
  await Note.deleteMany({ person: person._id });
  await PersonMute.deleteMany({ person: person._id });
  await person.deleteOne();
}
