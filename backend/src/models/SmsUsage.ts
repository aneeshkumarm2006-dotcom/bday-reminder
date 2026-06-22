import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * SMS/WhatsApp fair-use counter (TODO Stage 5; FR-55). One document per
 * (user, period) where `period` is a "YYYY-MM" UTC month. The dispatcher reads
 * it before an SMS send and bumps it after a (stubbed) delivery; once `count`
 * reaches the configured monthly cap, further SMS reminders fall back to
 * push/email/in-app instead. A new month is simply a new period key, so the cap
 * resets with no scheduled job.
 */

export interface SmsUsageDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** Billing window, "YYYY-MM" in UTC. */
  period: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const smsUsageSchema = new Schema<SmsUsageDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// One counter per user per month; the increment upserts on this.
smsUsageSchema.index({ user: 1, period: 1 }, { unique: true });

export const SmsUsage: Model<SmsUsageDoc> =
  (models.SmsUsage as Model<SmsUsageDoc>) || model<SmsUsageDoc>('SmsUsage', smsUsageSchema);
