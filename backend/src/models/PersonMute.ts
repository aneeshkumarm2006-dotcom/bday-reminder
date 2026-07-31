import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * "Not in my calendar" - one row per (viewer, person) the viewer has excluded.
 *
 * Shared-list access is all-or-nothing: joining a list makes every person in it
 * visible, and the reminder engine schedules the joiner for all of them. This is
 * the opt-out, so a member of a 100-person list keeps only the birthdays they
 * actually want. Absence of a row means "in my calendar", so the collection
 * starting empty reproduces the historical behaviour exactly.
 *
 * Stored as exclusions but exposed as `inMyCalendar` / `add` / `remove`
 * everywhere above `routes/me.ts` - the inversion is deliberately confined to
 * that one handler so no client ever has to reason about it.
 *
 * A side collection rather than an array on User because `require-auth` loads
 * the user document on every authenticated request, and this list is unbounded.
 */

export interface PersonMuteDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  person: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const personMuteSchema = new Schema<PersonMuteDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  },
  { timestamps: true },
);

// The lookup ("what has this user excluded?") and the idempotency guard for
// bulk upserts, in one index.
personMuteSchema.index({ user: 1, person: 1 }, { unique: true });
// Cleanup when a person is deleted, without scanning.
personMuteSchema.index({ person: 1 });

export const PersonMute: Model<PersonMuteDoc> =
  (models.PersonMute as Model<PersonMuteDoc>) ||
  model<PersonMuteDoc>('PersonMute', personMuteSchema);
