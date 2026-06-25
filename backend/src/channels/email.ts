import { loadEnv } from '../lib/env';
import { logger } from '../lib/logger';
import { isTransientStatus, retryAfterMs, TransientError, withRetry } from '../lib/retry';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * Email via Resend (FR-23/54, unlimited). Uses Resend's REST API directly - no
 * SDK. When `RESEND_API_KEY` is unset the channel logs the message and reports
 * "skipped" instead of failing, so the engine runs end-to-end in dev/QA before
 * the Resend account is provisioned.
 *
 * Transient failures (network error, 429, 5xx) are retried with backoff so a
 * brief Resend blip doesn't drop the reminder; a permanent 4xx fails fast
 * (Stage 12). Retries stay inside the provider so the dispatcher sees one result.
 */

const RESEND_URL = 'https://api.resend.com/emails';

/** Minimal templated HTML - static copy only, no AI (PRD §11). */
function renderHtml(payload: ReminderPayload): string {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#232020">',
    `<h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(payload.headline)}</h2>`,
    `<p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(payload.message)}</p>`,
    '<p style="margin:16px 0 0;font-size:12px;color:#8B847C">Circle the date · Birthday reminders</p>',
    '</div>',
  ].join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const emailProvider: ChannelProvider = {
  key: 'email',
  async send(payload: ReminderPayload): Promise<SendResult> {
    const env = loadEnv();
    if (!env.RESEND_API_KEY) {
      logger.info(`[email:stub] → ${payload.toEmail}: ${payload.message}`);
      return { channel: 'email', outcome: 'skipped', detail: 'no RESEND_API_KEY' };
    }
    if (!payload.toEmail) {
      return { channel: 'email', outcome: 'skipped', detail: 'no recipient email' };
    }

    let lastAttempt = 0;
    try {
      return await withRetry<SendResult>(
        async (attempt) => {
          lastAttempt = attempt;
          let res: Response;
          try {
            res = await fetch(RESEND_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: env.EMAIL_FROM,
                to: [payload.toEmail],
                subject: payload.headline,
                html: renderHtml(payload),
                text: payload.message,
              }),
            });
          } catch (netErr) {
            // Network-level failure is always worth a retry.
            throw new TransientError(netErr instanceof Error ? netErr.message : 'network error');
          }
          if (res.ok) {
            return { channel: 'email', outcome: 'sent', detail: payload.toEmail, attempts: attempt };
          }
          if (isTransientStatus(res.status)) {
            throw new TransientError(`resend responded ${res.status}`, retryAfterMs(res.headers));
          }
          // Permanent client error - don't waste retries.
          return {
            channel: 'email',
            outcome: 'failed',
            detail: `resend responded ${res.status}`,
            attempts: attempt,
          };
        },
        {
          onRetry: (err, attempt, delay) =>
            logger.warn(`email retry ${attempt} in ${Math.round(delay)}ms: ${err.message}`),
        },
      );
    } catch (err) {
      return {
        channel: 'email',
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'email request failed',
        attempts: lastAttempt,
      };
    }
  },
};
