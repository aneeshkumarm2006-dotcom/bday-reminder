import { Schema, model, models, type Model, type Types } from 'mongoose';

import { dateParts, type DateParts } from './common';

/**
 * Event (PRD §7.3). Every person has at least a birthday; anniversaries and
 * custom events are added in Stage 6. All events recur yearly. Per-event
 * overrides fall back to the user's defaults when unset (Stages 4-5).
 */

export interface ChannelOverride {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  inApp?: boolean;
}

export interface EventDoc {
  _id: Types.ObjectId;
  person: Types.ObjectId;
  type: 'birthday' | 'anniversary' | 'custom';
  customName?: string;
  date: DateParts;
  /** Lead times for this event; null/undefined => use the user's default. */
  leadDaysOverride?: number[] | null;
  channelOverride?: ChannelOverride | null;
  /** Reminder time-of-day "HH:mm"; null/undefined => use the user's default reminder time. */
  reminderTimeOverride?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const channelOverrideSchema = new Schema<ChannelOverride>(
  {
    push: { type: Boolean },
    email: { type: Boolean },
    sms: { type: Boolean },
    inApp: { type: Boolean },
  },
  { _id: false },
);

const eventSchema = new Schema<EventDoc>(
  {
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
    type: { type: String, enum: ['birthday', 'anniversary', 'custom'], required: true },
    customName: { type: String, trim: true },
    date: { type: dateParts(true), required: true },
    leadDaysOverride: { type: [Number], default: undefined },
    channelOverride: { type: channelOverrideSchema, default: undefined },
    reminderTimeOverride: { type: String, default: undefined },
  },
  { timestamps: true },
);

export const Event: Model<EventDoc> =
  (models.Event as Model<EventDoc>) || model<EventDoc>('Event', eventSchema);
