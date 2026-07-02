import mongoose, { Schema, type Model } from "mongoose";

import { connectDb } from "@/lib/blog/db";

/**
 * Read-only view of the backend's account-wide auto-send SMS counter (Stage 15),
 * for the /seoteam admin card. The website shares the same Mongo cluster, so we
 * register a matching `AutoSmsUsage` model here (same model name → same
 * `autosmsusages` collection the backend writes) and read the current month's
 * count. The cap is a display value read from the website's own env.
 */

interface AutoSmsUsageDoc {
  period: string;
  count: number;
}

const autoSmsUsageSchema = new Schema<AutoSmsUsageDoc>(
  {
    period: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

const AutoSmsUsage: Model<AutoSmsUsageDoc> =
  (mongoose.models.AutoSmsUsage as Model<AutoSmsUsageDoc>) ||
  mongoose.model<AutoSmsUsageDoc>("AutoSmsUsage", autoSmsUsageSchema);

/** "YYYY-MM" UTC period, matching the backend's `smsPeriod`. */
function currentPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface AutoSmsStats {
  /** Birthday texts auto-sent this UTC month, account-wide. */
  used: number;
  /** Configured monthly cap; 0 means no cap is set. */
  cap: number;
  /** The "YYYY-MM" window these numbers cover. */
  period: string;
}

/**
 * Current-month auto-send SMS usage + the configured cap. `TWILIO_MONTHLY_CAP`
 * should mirror the backend value (enforcement lives there; this is display).
 */
export async function getAutoSmsStats(): Promise<AutoSmsStats> {
  const period = currentPeriod(new Date());
  const cap = Number(process.env.TWILIO_MONTHLY_CAP ?? 0) || 0;
  await connectDb();
  const doc = await AutoSmsUsage.findOne({ period }).lean<{ count?: number } | null>();
  return { used: doc?.count ?? 0, cap, period };
}
