import { loadEnv } from './env';
import { logger } from './logger';

/**
 * Shared-list invite email (TODO Stage 8; FR-41). Sends through Resend's REST
 * API - same approach as the reminder email channel, no SDK. When
 * `RESEND_API_KEY` is unset (or the invite is to a phone/link rather than an
 * email), the send is logged and reported "skipped" instead of failing, so the
 * invite flow runs end-to-end in dev/QA without a Resend account. The invite is
 * always persisted regardless of email outcome - the accept link/token works
 * even when no email goes out.
 */

const RESEND_URL = 'https://api.resend.com/emails';

export type InviteEmailOutcome = 'sent' | 'skipped' | 'failed';

export interface InviteEmailInput {
  to: string;
  listName: string;
  inviterName: string;
  acceptUrl: string;
}

/** Loose email check - enough to decide whether to attempt an email send. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal templated HTML - static copy only, no AI (PRD §11). */
function renderHtml(input: InviteEmailInput): string {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#232020">',
    `<h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(input.inviterName)} invited you to a shared list</h2>`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Join “${escapeHtml(input.listName)}” on Circle the date to share birthdays and never track the same date twice.</p>`,
    `<a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#3A53D6;color:#FBF8F4;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:15px">Accept invite</a>`,
    '<p style="margin:16px 0 0;font-size:12px;color:#8B847C">Circle the date · Birthday reminders</p>',
    '</div>',
  ].join('');
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailOutcome> {
  const env = loadEnv();

  if (!looksLikeEmail(input.to)) {
    // Phone / invite-link path - nothing to email; the owner shares the link.
    logger.info(`[invite:link] ${input.listName} → ${input.to}: ${input.acceptUrl}`);
    return 'skipped';
  }
  if (!env.RESEND_API_KEY) {
    logger.info(`[invite:stub] → ${input.to}: join "${input.listName}" - ${input.acceptUrl}`);
    return 'skipped';
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
        to: [input.to],
        subject: `${input.inviterName} invited you to “${input.listName}”`,
        html: renderHtml(input),
        text: `${input.inviterName} invited you to join “${input.listName}” on Circle the date. Accept: ${input.acceptUrl}`,
      }),
    });
    if (!res.ok) {
      logger.error(`invite email failed: resend responded ${res.status}`);
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    logger.error('invite email failed', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
