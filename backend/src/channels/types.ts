import type { ChannelKey } from '../models/common';

/**
 * Channel-dispatch interface (TODO Stage 4). Every delivery channel — push,
 * email, in-app, and the deferred SMS/WhatsApp — implements the same
 * `ChannelProvider.send(payload)` so new channels (Stage 5's SMS) slot in
 * behind this interface without touching the engine.
 */

/** Everything a channel needs to render and route one reminder. */
export interface ReminderPayload {
  /** Short headline — push title / email subject ("Ravi's birthday"). */
  headline: string;
  /** The reminder line — push/email body and the in-app feed copy (PRD §11). */
  message: string;
  /** Recipient routing. */
  toEmail: string;
  toName: string;
  /** The recipient user's own phone — where a (stubbed) SMS reminder would go. */
  toPhone?: string | null;
  pushTokens: string[];
  /** Context for deep links / data payloads. */
  personId: string;
  reminderId: string;
}

export type SendOutcome = 'sent' | 'skipped' | 'failed';

export interface SendResult {
  channel: ChannelKey;
  outcome: SendOutcome;
  /** Human-readable note for logs ("3 device(s)", "no RESEND_API_KEY"). */
  detail?: string;
}

export interface ChannelProvider {
  key: ChannelKey;
  send(payload: ReminderPayload): Promise<SendResult>;
}
