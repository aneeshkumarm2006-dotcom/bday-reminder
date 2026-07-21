/**
 * Reminder copy (TODO Stage 4; DESIGN.md §10 Voice, PRD §11). Static templated
 * text with name / date / age variables - never AI-generated or personalized
 * beyond substitution. Every line states who, what event, how many days away
 * (or "today"), and the new age when a birth year is on file (PRD §11).
 *
 * The server is the single source of truth for this copy so push, email, and the
 * in-app feed all read identically.
 */

export type ReminderEventType = 'birthday' | 'anniversary' | 'custom';

export interface ReminderCopyInput {
  name: string;
  eventType: ReminderEventType;
  customName?: string | null;
  /** Whole days from "today" to the occurrence; 0 = today, negative = past. */
  daysRemaining: number;
  /** Age the person is turning (birthdays only); null when the year is unknown. */
  ageTurning: number | null;
}

/** "in 1 day" / "in 3 days" for a positive day count. */
function inDays(days: number): string {
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

/** Lower-cased noun for the event, used mid-sentence ("Michael's anniversary"). */
function eventNoun(input: Pick<ReminderCopyInput, 'eventType' | 'customName'>): string {
  if (input.eventType === 'birthday') return 'birthday';
  if (input.eventType === 'anniversary') return 'anniversary';
  return input.customName?.trim() || 'event';
}

/**
 * The reminder line shown in the feed and sent as the push/email body. Variants
 * cover with-year, day-of, and no-year (DESIGN.md §10):
 *   - `Michael turns 29 in 3 days.`
 *   - `It's Michael's birthday today, turns 29.`
 *   - `Emma's birthday is in 3 days.`
 */
export function reminderMessage(input: ReminderCopyInput): string {
  const { name, daysRemaining, ageTurning } = input;
  const noun = eventNoun(input);
  const isBirthday = input.eventType === 'birthday';

  // Past occurrences only appear for already-acted history; keep it factual.
  if (daysRemaining < 0) {
    return `${name}'s ${noun} has passed.`;
  }

  if (daysRemaining === 0) {
    if (isBirthday && ageTurning != null) {
      return `It's ${name}'s birthday today, turns ${ageTurning}.`;
    }
    return `It's ${name}'s ${noun} today.`;
  }

  // Birthdays with a known year lead with the age (the most useful fact).
  if (isBirthday && ageTurning != null) {
    return `${name} turns ${ageTurning} ${inDays(daysRemaining)}.`;
  }
  return `${name}'s ${noun} is ${inDays(daysRemaining)}.`;
}

/** Short headline for a push title / email subject ("Michael's birthday"). */
export function reminderHeadline(input: Pick<ReminderCopyInput, 'name' | 'eventType' | 'customName'>): string {
  if (input.eventType === 'custom') return `${input.name}: ${input.customName?.trim() || 'Event'}`;
  return `${input.name}'s ${eventNoun(input)}`;
}

/** Default greeting (FR-29) - editable in the user's messaging app, never auto-sent. */
export function greetingTemplate(name: string): string {
  return `Happy birthday, ${name}! 🎉`;
}

/** First name (or the whole name if single-word), for personal email copy. */
export function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

/**
 * Auto-send birthday email copy (Stage 14). This is a PERSONAL message the user
 * sends to the friend from their own Gmail - deliberately plain and warm, with no
 * app branding, so it reads like something the user typed. The subject is fixed;
 * the body is the default the user sees (and can edit) when enabling auto-send.
 */
export function birthdayEmailSubject(name: string): string {
  return `Happy Birthday, ${firstName(name)}!`;
}

export function birthdayEmailBody(name: string): string {
  return `Happy birthday, ${firstName(name)}! Hope you have a wonderful day. 🎉`;
}

/**
 * Auto-send birthday SMS copy (Stage 15). Deliberately SHORT and emoji-free to
 * stay within one GSM-7 segment (160 chars) - an emoji would flip the whole
 * message to pricier UCS-2. Signed with the sender's name because the friend
 * sees an app-owned Twilio number, not the user's, so the name is how they know
 * who it's from. This is the default the user sees (and can edit) when enabling.
 */
export function birthdaySmsBody(name: string, senderName: string): string {
  return `Happy birthday, ${firstName(name)}! Hope you have a great day. - ${senderName}`;
}
