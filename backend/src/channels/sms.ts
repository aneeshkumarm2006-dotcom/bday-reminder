import { logger } from '../lib/logger';
import { sendTwilioSms, twilioConfigured } from '../lib/twilio-send';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * SMS reminder channel (Stage 4 builds the interface; Stage 5 adds the fair-use
 * cap + fallback around it). Live delivery goes through the shared Twilio account
 * (`lib/twilio-send.ts`) when one is configured. When it is NOT configured we
 * keep the original Stage 5 behaviour: log the message and report a *simulated*
 * send - `sent` rather than `skipped` - so the surrounding fair-use accounting
 * (count against the monthly cap, then fall back to push/email) still runs in
 * dev/QA without provisioning Twilio. The cap check + fallback live in
 * `lib/sms-usage.ts` and run in the engine before this provider is ever called.
 */
export const smsProvider: ChannelProvider = {
  key: 'sms',
  async send(payload: ReminderPayload): Promise<SendResult> {
    const to = payload.toPhone ?? '';

    // No Twilio account: keep the simulated send so dev/QA + fair-use tests run.
    if (!twilioConfigured()) {
      logger.info(
        `[sms:stub] would text ${payload.toName} ${to || '(no phone on file)'}: ${payload.message}`,
      );
      return { channel: 'sms', outcome: 'sent', detail: 'stubbed - no Twilio configured' };
    }

    // Twilio rejects anything that isn't E.164; skip (don't fail) so the
    // reminder still falls through to the other channels.
    if (!/^\+[1-9]\d{6,14}$/.test(to)) {
      logger.info(`[sms] skip ${payload.toName}: no valid E.164 phone on file (${to || 'none'})`);
      return { channel: 'sms', outcome: 'skipped', detail: 'no valid E.164 phone on file' };
    }

    const result = await sendTwilioSms(to, payload.message);
    logger.info(`[sms] text ${payload.toName} ${to} → ${result.outcome}`);
    return {
      channel: 'sms',
      outcome: result.outcome,
      detail: result.detail,
      attempts: result.attempts,
    };
  },
};
