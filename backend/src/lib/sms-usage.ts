import type { ChannelKey } from '../models/common';
import { SmsUsage } from '../models/SmsUsage';
import { loadEnv } from './env';

/**
 * SMS/WhatsApp fair-use logic (TODO Stage 5; FR-55/56). The actual SMS send is
 * stubbed (see `channels/sms.ts`), but everything around it is real: we count
 * sends per user per UTC month, and when the configurable monthly cap is hit we
 * drop SMS from the delivery set and fall back to push + email (in-app is always
 * implied) so a reminder is never lost. The cap is read from config here, never
 * hardcoded into copy.
 */

/** The configured monthly cap (business value, env-driven). */
export function smsMonthlyCap(): number {
  return loadEnv().SMS_WHATSAPP_MONTHLY_CAP;
}

/** The billing window for an instant, "YYYY-MM" in UTC. */
export function smsPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** SMS reminders already counted for this user this period (0 if none). */
export async function getSmsUsage(userId: string, period: string): Promise<number> {
  const doc = await SmsUsage.findOne({ user: userId, period });
  return doc?.count ?? 0;
}

/** Atomically record one SMS send for this user/period; returns the new count. */
export async function incrementSmsUsage(userId: string, period: string): Promise<number> {
  const doc = await SmsUsage.findOneAndUpdate(
    { user: userId, period },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc?.count ?? 1;
}

export interface FairUseResolution {
  /** The channels to actually deliver through after applying the cap. */
  channels: ChannelKey[];
  /** True when this delivery should count against the SMS cap (under cap). */
  countSms: boolean;
  /** True when the cap was hit and SMS was swapped for push/email. */
  fellBack: boolean;
}

/**
 * Resolve the effective channels for one delivery given the user's SMS usage.
 * When SMS isn't selected, this is a no-op. When it is: under the cap, SMS
 * stays and the caller should increment usage after a successful send; at/over
 * the cap, SMS is dropped and push + email are added so the reminder still
 * reaches the user (FR-55). In-app is always implied downstream.
 */
export async function resolveFairUse(
  userId: string,
  channels: ChannelKey[],
  now: Date,
): Promise<FairUseResolution> {
  if (!channels.includes('sms')) {
    return { channels, countSms: false, fellBack: false };
  }

  const used = await getSmsUsage(userId, smsPeriod(now));
  if (used < smsMonthlyCap()) {
    return { channels, countSms: true, fellBack: false };
  }

  // Cap reached: drop SMS, guarantee push + email as the fallback.
  const next = new Set<ChannelKey>(channels.filter((c) => c !== 'sms'));
  next.add('push');
  next.add('email');
  return { channels: [...next], countSms: false, fellBack: true };
}
