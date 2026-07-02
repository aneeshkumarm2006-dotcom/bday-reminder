import { Schema, model, models, type Model, type Types } from 'mongoose';

import { dateParts, FEB29_RULES, type DateParts, type Feb29Rule } from './common';

/**
 * Auto-send birthday greeting (Stage 14). When `enabled`, the greeting dispatch
 * emails this person (at `Person.email`) on their birthday, sent AS the person's
 * owner through the owner's connected Gmail (see `User.gmailIntegration`).
 * `message` is the editable greeting body (confirmed once when enabling);
 * `lastSentYear` guards against double-sending - the dispatch only fires when the
 * occurrence's year differs from it, then stamps it (idempotent per year).
 */
export interface AutoBirthdayEmail {
  enabled: boolean;
  message?: string;
  lastSentYear?: number;
}

/**
 * Auto-send birthday SMS (Stage 15). Same shape and once-per-year `lastSentYear`
 * guard as {@link AutoBirthdayEmail}, but the greeting is texted to `Person.phone`
 * via one shared Twilio account (there is no per-user carrier account, so the
 * message is signed with the owner's name to read as coming from them).
 */
export interface AutoBirthdaySms {
  enabled: boolean;
  message?: string;
  lastSentYear?: number;
}

/**
 * Person (PRD §7.2, FR-17). The individual whose event is tracked - human or
 * pet. Scoped to an owner and, optionally, one or more shared lists (Stage 8).
 * `createdBy`/`updatedBy` back the "last edited by" attribution (FR-45).
 */
export interface PersonDoc {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  lists: Types.ObjectId[];
  fullName: string;
  type: 'human' | 'pet';
  relationshipTag?: string;
  photoUrl?: string;
  dob: DateParts;
  feb29Rule: Feb29Rule;
  phone?: string;
  /** The person's own email - the recipient of the auto-send birthday greeting. */
  email?: string;
  autoBirthdayEmail?: AutoBirthdayEmail;
  autoBirthdaySms?: AutoBirthdaySms;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const autoBirthdayEmailSchema = new Schema<AutoBirthdayEmail>(
  {
    enabled: { type: Boolean, default: false },
    message: { type: String, trim: true },
    lastSentYear: { type: Number },
  },
  { _id: false },
);

const autoBirthdaySmsSchema = new Schema<AutoBirthdaySms>(
  {
    enabled: { type: Boolean, default: false },
    message: { type: String, trim: true },
    lastSentYear: { type: Number },
  },
  { _id: false },
);

const personSchema = new Schema<PersonDoc>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lists: { type: [{ type: Schema.Types.ObjectId, ref: 'SharedList' }], default: () => [] },
    fullName: { type: String, required: true, trim: true },
    type: { type: String, enum: ['human', 'pet'], default: 'human' },
    relationshipTag: { type: String, trim: true },
    photoUrl: { type: String },
    dob: { type: dateParts(true), required: true },
    feb29Rule: { type: String, enum: FEB29_RULES, default: 'feb28' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    autoBirthdayEmail: { type: autoBirthdayEmailSchema, default: undefined },
    autoBirthdaySms: { type: autoBirthdaySmsSchema, default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

personSchema.index({ lists: 1 });

export const Person: Model<PersonDoc> =
  (models.Person as Model<PersonDoc>) || model<PersonDoc>('Person', personSchema);
