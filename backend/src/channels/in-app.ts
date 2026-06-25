import type { ChannelProvider, ReminderPayload, SendResult } from './types';

/**
 * In-app feed (FR-27). There's nothing to "send": the Reminder document IS the
 * in-app notification, and `GET /reminders` lists it the moment it's due and
 * keeps it forever (it never disappears on view). This provider exists so the
 * in-app channel is a first-class member of the dispatch interface and always
 * succeeds - it's the silent fallback when every other channel is off (FR-26).
 */
export const inAppProvider: ChannelProvider = {
  key: 'inApp',
  async send(_payload: ReminderPayload): Promise<SendResult> {
    return { channel: 'inApp', outcome: 'sent', detail: 'persisted to feed' };
  },
};
