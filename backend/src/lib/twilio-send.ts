import { loadEnv } from './env';
import { logger } from './logger';
import { isTransientStatus, retryAfterMs, TransientError, withRetry } from './retry';

/**
 * Send a birthday SMS AS a user through one shared Twilio account (Stage 15).
 * Unlike the Gmail send-as (which uses the user's OWN account via OAuth), there
 * is no per-user carrier account and no consumer API to send from a user's real
 * phone number - so the text goes out from an app-owned Twilio sender and the
 * message body is signed with the user's name to read as coming from them.
 *
 * Raw `fetch`, no SDK (matching channels/email.ts + gmail-send.ts). Transient
 * failures retry with backoff; a permanent 4xx (e.g. an invalid `To`) fails fast.
 * Absent credentials → the send is skipped (not failed), so the app runs
 * end-to-end in dev/QA without provisioning Twilio.
 */

const messagesUrl = (accountSid: string): string =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

export interface SmsSendResult {
  outcome: 'sent' | 'skipped' | 'failed';
  detail?: string;
  attempts?: number;
}

export type SmsSender = (to: string, body: string) => Promise<SmsSendResult>;

/** True only when an account, token, and at least one sender are all configured. */
export function twilioConfigured(): boolean {
  const env = loadEnv();
  return (
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    (!!env.TWILIO_MESSAGING_SERVICE_SID || !!env.TWILIO_FROM_NUMBER)
  );
}

export const sendTwilioSms: SmsSender = async (to, body) => {
  const env = loadEnv();
  if (!twilioConfigured()) {
    logger.info(`[twilio:stub] would text ${to}: ${body}`);
    return { outcome: 'skipped', detail: 'twilio not configured' };
  }
  if (!to) {
    return { outcome: 'skipped', detail: 'no recipient phone' };
  }

  const url = messagesUrl(env.TWILIO_ACCOUNT_SID!);
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  // Prefer a Messaging Service (Twilio's recommended sender: pools, compliance);
  // fall back to a single From number. Never send both.
  const form = new URLSearchParams({ To: to, Body: body });
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    form.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.set('From', env.TWILIO_FROM_NUMBER!);
  }

  let lastAttempt = 0;
  try {
    return await withRetry<SmsSendResult>(
      async (attempt) => {
        lastAttempt = attempt;
        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${auth}`,
            },
            body: form.toString(),
          });
        } catch (netErr) {
          throw new TransientError(netErr instanceof Error ? netErr.message : 'network error');
        }
        // Twilio returns 201 Created on success; res.ok covers the 2xx range.
        if (res.ok) return { outcome: 'sent', detail: to, attempts: attempt };
        if (isTransientStatus(res.status)) {
          throw new TransientError(`twilio responded ${res.status}`, retryAfterMs(res.headers));
        }
        return { outcome: 'failed', detail: `twilio responded ${res.status}`, attempts: attempt };
      },
      {
        onRetry: (err, attempt, delay) =>
          logger.warn(`twilio retry ${attempt} in ${Math.round(delay)}ms: ${err.message}`),
      },
    );
  } catch (err) {
    return {
      outcome: 'failed',
      detail: err instanceof Error ? err.message : 'twilio send failed',
      attempts: lastAttempt,
    };
  }
};
