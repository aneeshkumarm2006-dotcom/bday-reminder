import { Schema, model, models, type Model, type Types } from 'mongoose';

import { CHANNEL_KEYS, type ChannelKey } from './common';

/**
 * Reminder instance (PRD §7.4). A specific scheduled notification generated from
 * an Event for one upcoming occurrence and one recipient. The cron dispatcher
 * (Stage 4) queries these by occurrence date + status.
 */

export type ReminderStatus = 'pending' | 'sent' | 'snoozed' | 'done';
export const REMINDER_STATUSES: ReminderStatus[] = ['pending', 'sent', 'snoozed', 'done'];

export interface ReminderDoc {
  _id: Types.ObjectId;
  event: Types.ObjectId;
  user: Types.ObjectId;
  /** The event's occurrence this fires for, a UTC-midnight calendar date. */
  occurrenceDate: Date;
  /** "Days before the occurrence" this instance fires (e.g. 0 = on the day). */
  leadDays: number;
  /**
   * Absolute instant the reminder should fire: `leadDays` before `occurrenceDate`
   * at the user's reminder time-of-day in their timezone (FR-22/51). The cron
   * dispatcher queries `status:'pending', scheduledFor:{$lte:now}` (Stage 4).
   */
  scheduledFor: Date;
  status: ReminderStatus;
  channels: ChannelKey[];
  snoozeUntil?: Date;
  sentAt?: Date;
  /**
   * Delivery outcome of the last dispatch attempt (Stage 12 observability).
   * `status:'sent'` means "claimed + attempted", not "delivered" - these fields
   * record what actually happened per external channel. `externalDeliveryFailed`
   * flags a reminder that reached the in-app feed but failed every external
   * channel (after retries), so failures aren't invisible.
   */
  deliveryAttemptedAt?: Date;
  deliveryResults?: { channel: ChannelKey; outcome: string; detail?: string; attempts?: number }[];
  externalDeliveryFailed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<ReminderDoc>(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    occurrenceDate: { type: Date, required: true },
    leadDays: { type: Number, required: true },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: REMINDER_STATUSES, default: 'pending' },
    channels: { type: [String], enum: CHANNEL_KEYS, default: () => [] },
    snoozeUntil: { type: Date },
    sentAt: { type: Date },
    deliveryAttemptedAt: { type: Date },
    deliveryResults: {
      type: [{ channel: String, outcome: String, detail: String, attempts: Number, _id: false }],
      default: undefined,
    },
    externalDeliveryFailed: { type: Boolean },
  },
  { timestamps: true },
);

// The dispatcher finds due reminders by fire-time + status; the feed lists by user.
reminderSchema.index({ status: 1, scheduledFor: 1 });
reminderSchema.index({ status: 1, snoozeUntil: 1 });
reminderSchema.index({ user: 1, status: 1 });
reminderSchema.index({ event: 1 });
// One instance per (user, event, occurrence, lead time) - generation upserts on this.
reminderSchema.index({ user: 1, event: 1, occurrenceDate: 1, leadDays: 1 }, { unique: true });

export const Reminder: Model<ReminderDoc> =
  (models.Reminder as Model<ReminderDoc>) || model<ReminderDoc>('Reminder', reminderSchema);
