import { randomBytes } from 'node:crypto';

import { gmailOAuthConfigured, refreshAccessToken } from './google-oauth';
import { logger } from './logger';
import { isTransientStatus, retryAfterMs, TransientError, withRetry } from './retry';
import { decryptToken } from './token-crypto';
import { User, type UserDoc } from '../models/User';

/**
 * Send an email AS a user through their connected Gmail (Stage 14). This is what
 * makes an auto-sent birthday greeting indistinguishable from one the user typed:
 * it goes out from their real address and lands in their Sent folder, because
 * their own account sends it (scope `gmail.send`).
 *
 * Raw `fetch`, no SDK (matching channels/email.ts). Transient failures retry with
 * backoff; a permanent `invalid_grant` on refresh means the user revoked access,
 * so we clear the stored integration and report "failed" (the caller won't stamp
 * lastSentYear, so it's retried next occurrence once reconnected).
 */

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface GreetingMessage {
  to: string;
  subject: string;
  /** Plain-text body (the fallback part when `html` is set). */
  text: string;
  /** Optional HTML body; when present the mail is sent as multipart/alternative. */
  html?: string;
}

export interface GmailSendResult {
  outcome: 'sent' | 'skipped' | 'failed';
  detail?: string;
  attempts?: number;
}

export type GmailSender = (user: UserDoc, msg: GreetingMessage) => Promise<GmailSendResult>;

/** RFC 2047 encoded-word for a header value that contains non-ASCII (e.g. emoji). */
function encodeHeader(value: string): string {
  let ascii = true;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0x7f) {
      ascii = false;
      break;
    }
  }
  if (ascii) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** base64-encode a UTF-8 body wrapped at 76 chars per line (RFC 2045). */
function encodeBase64Body(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');
}

/**
 * Build a base64url-encoded RFC 822 message for the Gmail send API. With `html`
 * set it's a multipart/alternative (text part first, HTML last so clients prefer
 * the card); otherwise a plain-text message, matching the original behaviour.
 */
function buildRawMessage(from: { name: string; email: string }, msg: GreetingMessage): string {
  const headers = [
    `From: ${encodeHeader(from.name)} <${from.email}>`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    'MIME-Version: 1.0',
  ];

  let mime: string;
  if (msg.html) {
    // A random boundary can never collide with the base64-encoded part bodies.
    const boundary = `=_ctd_${randomBytes(12).toString('hex')}`;
    mime = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64Body(msg.text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64Body(msg.html),
      `--${boundary}--`,
      '',
    ].join('\r\n');
  } else {
    mime = [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      msg.text,
    ].join('\r\n');
  }
  return Buffer.from(mime, 'utf8').toString('base64url');
}

/** Drop the stored integration so the UI shows "disconnected" after a hard auth failure. */
async function markDisconnected(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $unset: { gmailIntegration: '' } });
}

export const sendGmailAs: GmailSender = async (user, msg) => {
  if (!gmailOAuthConfigured()) {
    logger.info(`[gmail:stub] would send greeting to ${msg.to} as ${user.email}`);
    return { outcome: 'skipped', detail: 'gmail oauth not configured' };
  }
  const integration = user.gmailIntegration;
  if (!integration?.refreshTokenEnc) {
    return { outcome: 'skipped', detail: 'gmail not connected' };
  }
  if (!msg.to) {
    return { outcome: 'skipped', detail: 'no recipient email' };
  }

  const userId = user._id.toString();
  let refreshToken: string;
  try {
    refreshToken = decryptToken(integration.refreshTokenEnc);
  } catch {
    // A key rotation or corrupt value: can't recover the token, treat as disconnected.
    await markDisconnected(userId);
    return { outcome: 'failed', detail: 'stored gmail token could not be decrypted' };
  }

  // Refresh outside the retry loop: an invalid_grant is permanent (revoked), and
  // a fresh access token is reused across the send attempts.
  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(refreshToken);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'invalid_grant') {
      await markDisconnected(userId);
      return { outcome: 'failed', detail: 'gmail access was revoked - reconnect required' };
    }
    return { outcome: 'failed', detail: err instanceof Error ? err.message : 'token refresh failed' };
  }

  const raw = buildRawMessage({ name: user.name, email: integration.email }, msg);

  let lastAttempt = 0;
  try {
    return await withRetry<GmailSendResult>(
      async (attempt) => {
        lastAttempt = attempt;
        let res: Response;
        try {
          res = await fetch(SEND_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ raw }),
          });
        } catch (netErr) {
          throw new TransientError(netErr instanceof Error ? netErr.message : 'network error');
        }
        if (res.ok) return { outcome: 'sent', detail: msg.to, attempts: attempt };
        if (isTransientStatus(res.status)) {
          throw new TransientError(`gmail responded ${res.status}`, retryAfterMs(res.headers));
        }
        return { outcome: 'failed', detail: `gmail responded ${res.status}`, attempts: attempt };
      },
      {
        onRetry: (err, attempt, delay) =>
          logger.warn(`gmail retry ${attempt} in ${Math.round(delay)}ms: ${err.message}`),
      },
    );
  } catch (err) {
    return {
      outcome: 'failed',
      detail: err instanceof Error ? err.message : 'gmail send failed',
      attempts: lastAttempt,
    };
  }
};
