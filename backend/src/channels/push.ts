import { loadEnv } from '../lib/env';
import { logger } from '../lib/logger';
import { isTransientStatus, retryAfterMs, TransientError, withRetry } from '../lib/retry';
import { User } from '../models/User';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * Push via the Expo push API (FR-23/54, unlimited). Posts to Expo's HTTPS
 * endpoint - no SDK needed. Degrades gracefully: a user with no registered
 * device tokens is "skipped", not "failed".
 *
 * Stage 12 hardening:
 *  - Transient failures (network, 429, 5xx) retry with backoff; permanent 4xx
 *    fails fast. Retries stay inside the provider so the dispatcher sees one
 *    result and is never blocked beyond a few seconds.
 *  - The 200 body carries a per-token ticket array - a 200 does NOT mean every
 *    token was accepted. We parse it, prune `DeviceNotRegistered` tokens from
 *    the user (so dead tokens don't accumulate and silently fail forever), and
 *    report a mixed ok/failed outcome.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo tokens look like `ExponentPushToken[...]` / `ExpoPushToken[...]`. */
function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[/.test(token);
}

interface ExpoTicket {
  status?: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export const pushProvider: ChannelProvider = {
  key: 'push',
  async send(payload: ReminderPayload): Promise<SendResult> {
    const tokens = payload.pushTokens.filter(isExpoToken);
    if (tokens.length === 0) {
      return { channel: 'push', outcome: 'skipped', detail: 'no registered devices' };
    }

    const messages = tokens.map((to) => ({
      to,
      title: payload.headline,
      body: payload.message,
      sound: 'default' as const,
      data: { personId: payload.personId, reminderId: payload.reminderId },
    }));

    const env = loadEnv();
    let lastAttempt = 0;

    try {
      return await withRetry<SendResult>(
        async (attempt) => {
          lastAttempt = attempt;
          let res: Response;
          try {
            res = await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(env.EXPO_ACCESS_TOKEN
                  ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
                  : {}),
              },
              body: JSON.stringify(messages),
            });
          } catch (netErr) {
            throw new TransientError(netErr instanceof Error ? netErr.message : 'network error');
          }

          if (!res.ok) {
            if (isTransientStatus(res.status)) {
              throw new TransientError(`expo responded ${res.status}`, retryAfterMs(res.headers));
            }
            return {
              channel: 'push',
              outcome: 'failed',
              detail: `expo responded ${res.status}`,
              attempts: attempt,
            };
          }

          // 200 OK - inspect the per-token tickets (a 200 can still hold errors).
          const body = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
          const tickets = body?.data ?? [];
          return await resolveTickets(payload.userId, tokens, tickets, attempt);
        },
        {
          onRetry: (err, attempt, delay) =>
            logger.warn(`push retry ${attempt} in ${Math.round(delay)}ms: ${err.message}`),
        },
      );
    } catch (err) {
      // Retries exhausted (persistent transient failure) - record the attempt
      // count too, so telemetry is consistent with the success/permanent paths.
      return {
        channel: 'push',
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'push request failed',
        attempts: lastAttempt,
      };
    }
  },
};

/**
 * Map Expo tickets back to tokens: prune `DeviceNotRegistered` ones from the
 * user and report ok/failed counts. A 200 can still hold per-token errors;
 * `MessageRateExceeded` is transient, so if NOTHING got through we throw a
 * TransientError to let `withRetry` back off and re-send. Failures are counted
 * against the tokens sent (not the ticket array), so a truncated ticket response
 * never silently reports undelivered tokens as sent. With no ticket array
 * (older/edge response) we optimistically treat the batch as sent.
 */
async function resolveTickets(
  userId: string,
  tokens: string[],
  tickets: ExpoTicket[],
  attempt: number,
): Promise<SendResult> {
  if (tickets.length === 0) {
    return { channel: 'push', outcome: 'sent', detail: `${tokens.length} device(s)`, attempts: attempt };
  }

  let ok = 0;
  let retryable = 0;
  const dead: string[] = [];
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok') {
      ok += 1;
      return;
    }
    const errorCode = ticket.details?.error;
    if (errorCode === 'DeviceNotRegistered' && tokens[i]) dead.push(tokens[i]);
    else if (errorCode === 'MessageRateExceeded') retryable += 1;
  });

  if (dead.length > 0) {
    // Stop sending to uninstalled/expired devices - and keep pushTokens bounded.
    // Idempotent, so it's safe even if a later attempt re-sends the same batch.
    await User.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: dead } } }).catch((err) =>
      logger.warn(`could not prune ${dead.length} dead push token(s): ${String(err)}`),
    );
  }

  // Nothing delivered and the only failures are rate-limit (transient) → retry.
  if (ok === 0 && retryable > 0) {
    throw new TransientError(`expo rate-limited ${retryable} message(s)`);
  }

  // Count against the tokens we tried, so missing tickets aren't assumed sent.
  const failed = tokens.length - ok;
  if (ok === 0) {
    return { channel: 'push', outcome: 'failed', detail: `0 ok, ${failed} failed`, attempts: attempt };
  }
  return {
    channel: 'push',
    outcome: 'sent',
    detail: failed > 0 ? `${ok} ok, ${failed} failed` : `${ok} device(s)`,
    attempts: attempt,
  };
}
