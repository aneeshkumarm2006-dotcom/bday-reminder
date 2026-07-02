import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Account-wide auto-send SMS counter (Stage 15). One document per `period`
 * ("YYYY-MM" UTC month), counting every birthday SMS auto-sent across ALL users
 * from the single shared Twilio account. The dispatch reads it before a send and
 * bumps it after a successful one; once `count` reaches `TWILIO_MONTHLY_CAP`
 * (when > 0) the rest of the month's auto-texts are skipped. The `/seoteam` admin
 * dashboard reads this to show usage against the cap.
 *
 * Distinct from `SmsUsage`, which is a PER-USER cap on reminder SMS (a different
 * budget); this one has no `user` and is global to the Twilio account.
 */

export interface AutoSmsUsageDoc {
  _id: Types.ObjectId;
  /** Billing window, "YYYY-MM" in UTC. */
  period: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const autoSmsUsageSchema = new Schema<AutoSmsUsageDoc>(
  {
    period: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const AutoSmsUsage: Model<AutoSmsUsageDoc> =
  (models.AutoSmsUsage as Model<AutoSmsUsageDoc>) ||
  model<AutoSmsUsageDoc>('AutoSmsUsage', autoSmsUsageSchema);
