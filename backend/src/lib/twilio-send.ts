import { loadEnv } from './env';
import { logger } from './logger';
import { isTransientStatus, retryAfterMs, TransientError, withRetry } from './retry';

/**
 * Send a birthday SMS or WhatsApp message AS a user through one shared Twilio
 * account (Stage 15). Unlike the Gmail send-as (which uses the user's OWN account
 * via OAuth), there is no per-user carrier account and no consumer API to send
 * from a user's real phone number - so the message goes out from an app-owned
 * Twilio sender and the body is signed with the user's name to read as coming
 * from them. The `channel` picks the rail: a plain SMS text or a WhatsApp message
 * (Twilio addresses WhatsApp by prefixing both `To` and `From` with `whatsapp:`).
 *
 * NOTE (WhatsApp): a business-initiated WhatsApp message outside the 24-hour
 * customer-service window must use a Meta pre-approved template; free-form bodies
 * only deliver within an open session (or the Twilio sandbox). The plumbing here
 * sends the body as-is - real production WhatsApp delivery needs an approved
 * template, tracked separately.
 *
 * Raw `fetch`, no SDK (matching channels/email.ts + gmail-send.ts). Transient
 * failures retry with backoff; a permanent 4xx (e.g. an invalid `To`) fails fast.
 * Absent credentials → the send is skipped (not failed), so the app runs
 * end-to-end in dev/QA without provisioning Twilio.
 */

const messagesUrl = (accountSid: string): string =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

export type MessageChannel = 'sms' | 'whatsapp';

export interface SmsSendResult {
  outcome: 'sent' | 'skipped' | 'failed';
  detail?: string;
  attempts?: number;
}

/**
 * Optional WhatsApp template send. Business-initiated WhatsApp can only deliver an
 * approved template, so when `contentSid` is set (WhatsApp only) the message is
 * sent as that template with `contentVariables` filling its `{{1}}`/`{{2}}` slots,
 * and `body` is used only for logging/fallback. Absent, the send is free-form.
 */
export interface SendOptions {
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

export type SmsSender = (
  to: string,
  body: string,
  channel?: MessageChannel,
  opts?: SendOptions,
) => Promise<SmsSendResult>;

/** True only when an account, token, and at least one SMS sender are configured. */
export function twilioConfigured(): boolean {
  const env = loadEnv();
  return (
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    (!!env.TWILIO_MESSAGING_SERVICE_SID || !!env.TWILIO_FROM_NUMBER)
  );
}

/** True only when an account, token, and at least one WhatsApp sender are configured. */
export function twilioWhatsappConfigured(): boolean {
  const env = loadEnv();
  return (
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    (!!env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID || !!env.TWILIO_WHATSAPP_FROM)
  );
}

/** True when the given channel has a configured sender on this server. */
export function twilioChannelConfigured(channel: MessageChannel): boolean {
  return channel === 'whatsapp' ? twilioWhatsappConfigured() : twilioConfigured();
}

/** Twilio addresses a WhatsApp endpoint by prefixing the E.164 number with `whatsapp:`. */
const whatsappAddress = (value: string): string =>
  value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;

export const sendTwilioSms: SmsSender = async (to, body, channel = 'sms', opts) => {
  const env = loadEnv();
  const isWhatsapp = channel === 'whatsapp';
  // A template only applies to WhatsApp (SMS has no approved-template concept).
  const contentSid = isWhatsapp ? opts?.contentSid : undefined;
  if (!twilioChannelConfigured(channel)) {
    logger.info(`[twilio:stub] would ${channel} ${to}: ${contentSid ? `template ${contentSid}` : body}`);
    return { outcome: 'skipped', detail: `twilio ${channel} not configured` };
  }
  if (!to) {
    return { outcome: 'skipped', detail: 'no recipient phone' };
  }

  const url = messagesUrl(env.TWILIO_ACCOUNT_SID!);
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const form = new URLSearchParams({ To: isWhatsapp ? whatsappAddress(to) : to });
  // A WhatsApp template send carries ContentSid + ContentVariables instead of a
  // free-form Body (business-initiated WhatsApp requires an approved template).
  if (contentSid) {
    form.set('ContentSid', contentSid);
    if (opts?.contentVariables) {
      form.set('ContentVariables', JSON.stringify(opts.contentVariables));
    }
  } else {
    form.set('Body', body);
  }
  // Prefer a Messaging Service (Twilio's recommended sender: pools, compliance);
  // fall back to a single From number. Never send both. WhatsApp uses its own
  // sender pair and both endpoints carry the `whatsapp:` prefix.
  const serviceSid = isWhatsapp
    ? env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID
    : env.TWILIO_MESSAGING_SERVICE_SID;
  if (serviceSid) {
    form.set('MessagingServiceSid', serviceSid);
  } else {
    const from = isWhatsapp ? whatsappAddress(env.TWILIO_WHATSAPP_FROM!) : env.TWILIO_FROM_NUMBER!;
    form.set('From', from);
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
