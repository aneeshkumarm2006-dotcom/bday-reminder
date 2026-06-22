import { loadEnv } from '../lib/env';
import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * Push via the Expo push API (FR-23/54, unlimited). Posts to Expo's HTTPS
 * endpoint — no SDK needed. Degrades gracefully: a user with no registered
 * device tokens is "skipped", not "failed", and a network/Expo error is caught
 * so one bad send never aborts a dispatch run.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo tokens look like `ExponentPushToken[...]` / `ExpoPushToken[...]`. */
function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[/.test(token);
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

    try {
      const env = loadEnv();
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        return { channel: 'push', outcome: 'failed', detail: `expo responded ${res.status}` };
      }
      return { channel: 'push', outcome: 'sent', detail: `${tokens.length} device(s)` };
    } catch (err) {
      return {
        channel: 'push',
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'push request failed',
      };
    }
  },
};
