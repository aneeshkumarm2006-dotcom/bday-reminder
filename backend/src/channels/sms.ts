import { logger } from '../lib/logger';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * SMS / WhatsApp (TODO Stage 4 builds the interface; Stage 5 adds the fair-use
 * cap + fallback around it). Real delivery via Twilio/WhatsApp is still DEFERRED
 * until the provider goes live, so this logs the message and reports a
 * *simulated* send - `sent` rather than `skipped` - so the surrounding fair-use
 * accounting (count against the monthly cap, then fall back to push/email) is
 * exercised for real. Swapping in the live provider later is a body change here,
 * nothing else. The cap check + fallback live in `lib/sms-usage.ts` and run in
 * the engine before this provider is ever called.
 */
export const smsProvider: ChannelProvider = {
  key: 'sms',
  async send(payload: ReminderPayload): Promise<SendResult> {
    const to = payload.toPhone ?? '(no phone on file)';
    logger.info(`[sms:stub] would text ${payload.toName} ${to}: ${payload.message}`);
    return { channel: 'sms', outcome: 'sent', detail: 'stubbed - no real SMS sent (Stage 5)' };
  },
};
