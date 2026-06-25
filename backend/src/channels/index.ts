import type { ChannelKey } from '../models/common';
import { emailProvider } from './email';
import { inAppProvider } from './in-app';
import { pushProvider } from './push';
import { smsProvider } from './sms';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * Channel registry + fan-out (TODO Stage 4). `dispatchToChannels` delivers one
 * reminder across the channels resolved for it (event override → user default),
 * best-effort: a failing/skipped channel never blocks the others, and results
 * come back for logging. The in-app feed is always implied - even with zero
 * channels selected the reminder still persists and lists (FR-26).
 */

const PROVIDERS: Record<ChannelKey, ChannelProvider> = {
  push: pushProvider,
  email: emailProvider,
  sms: smsProvider,
  inApp: inAppProvider,
};

export async function dispatchToChannels(
  channels: ChannelKey[],
  payload: ReminderPayload,
): Promise<SendResult[]> {
  // De-dup + always treat in-app as covered (the row already exists in the feed).
  const set = new Set<ChannelKey>(channels);
  set.add('inApp');
  const targets = [...set];
  // allSettled so one provider that throws (rather than returning a failed
  // result) can't reject the whole fan-out or block the others.
  const settled = await Promise.allSettled(targets.map((key) => PROVIDERS[key].send(payload)));
  return settled.map((outcome, i) =>
    outcome.status === 'fulfilled'
      ? outcome.value
      : {
          channel: targets[i],
          outcome: 'failed' as const,
          detail: outcome.reason instanceof Error ? outcome.reason.message : 'channel threw',
        },
  );
}

export type { ReminderPayload, SendResult } from './types';
