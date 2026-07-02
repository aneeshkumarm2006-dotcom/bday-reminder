import { AutoSmsUsage } from '../models/AutoSmsUsage';
import { loadEnv } from './env';
import { smsPeriod } from './sms-usage';

/**
 * Account-wide budget accounting for auto-send birthday SMS (Stage 15). The
 * shared Twilio account costs real money per message, so the dispatch counts
 * every auto-text against a global monthly cap (`TWILIO_MONTHLY_CAP`); at the cap
 * the rest of the month's greetings are skipped. Distinct from `sms-usage.ts`,
 * which is a PER-USER cap on reminder SMS.
 */

/** Configured account-wide monthly cap; 0 means unlimited. */
export function twilioMonthlyCap(): number {
  return loadEnv().TWILIO_MONTHLY_CAP;
}

/** The billing window for an instant, "YYYY-MM" in UTC (shared format). */
export function autoSmsPeriod(now: Date): string {
  return smsPeriod(now);
}

/** Auto-send SMS already counted account-wide for this period (0 if none). */
export async function getAutoSmsUsage(period: string): Promise<number> {
  const doc = await AutoSmsUsage.findOne({ period });
  return doc?.count ?? 0;
}

/** Atomically record one auto-send SMS for this period; returns the new count. */
export async function incrementAutoSmsUsage(period: string): Promise<number> {
  const doc = await AutoSmsUsage.findOneAndUpdate(
    { period },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc?.count ?? 1;
}
