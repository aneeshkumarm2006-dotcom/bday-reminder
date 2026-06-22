import { loadEnv } from '../lib/env';
import { logger } from '../lib/logger';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * Email via Resend (FR-23/54, unlimited). Uses Resend's REST API directly — no
 * SDK. When `RESEND_API_KEY` is unset the channel logs the message and reports
 * "skipped" instead of failing, so the engine runs end-to-end in dev/QA before
 * the Resend account is provisioned.
 */

const RESEND_URL = 'https://api.resend.com/emails';

/** Minimal templated HTML — static copy only, no AI (PRD §11). */
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

    try {
      const res = await fetch(RESEND_URL, {
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
      if (!res.ok) {
        return { channel: 'email', outcome: 'failed', detail: `resend responded ${res.status}` };
      }
      return { channel: 'email', outcome: 'sent', detail: payload.toEmail };
    } catch (err) {
      return {
        channel: 'email',
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'email request failed',
      };
    }
  },
};
