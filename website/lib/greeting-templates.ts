/**
 * Greeting template presets for auto-send birthday email/SMS (Stage 14/15).
 * Picking a preset only prefills the editable message — the final text is what
 * gets stored on the person (no template id is persisted), so `matchTemplateId`
 * re-derives the highlighted preset from the saved text on reopen.
 *
 * Mirrored in `app/src/lib/greeting-templates.ts` — keep the texts in sync.
 * The `classic` texts must exactly equal the server defaults in
 * `backend/src/lib/reminder-content.ts` so people saved before the template
 * picker existed reopen with "Classic" highlighted.
 */

export type GreetingChannel = 'email' | 'sms';
export type GreetingTemplateId = 'classic' | 'heartfelt' | 'funny' | 'short' | 'formal';
export type GreetingTemplate = { id: GreetingTemplateId; label: string; text: string };

/** Server-enforced caps (people route Zod schemas). */
export const EMAIL_MAX = 2000;
/** One GSM-7 SMS segment. */
export const SMS_MAX = 160;

const EMAIL_TEMPLATES: GreetingTemplate[] = [
  {
    id: 'classic',
    label: 'Classic',
    text: 'Happy birthday, {name}! Hope you have a wonderful day. 🎉',
  },
  {
    id: 'heartfelt',
    label: 'Heartfelt',
    text: 'Happy birthday, {name}! I feel really lucky to have you in my life. I hope today is full of the people and things you love, and that this year is your best one yet.',
  },
  {
    id: 'funny',
    label: 'Funny',
    text: "Happy birthday, {name}! Congratulations on levelling up. You don't look a day older than yesterday. Have an amazing one! 🎂",
  },
  {
    id: 'short',
    label: 'Short & sweet',
    text: 'Happy birthday, {name}! 🎂🎉',
  },
  {
    id: 'formal',
    label: 'Warm & formal',
    text: 'Dear {name}, wishing you a very happy birthday and a wonderful year ahead. May it bring you good health, happiness, and every success. Warm wishes.',
  },
];

// SMS presets stay emoji-free (GSM-7, one segment) and sign with the sender's
// name, since the friend sees a shared Twilio number, not the user's.
const SMS_TEMPLATES: GreetingTemplate[] = [
  {
    id: 'classic',
    label: 'Classic',
    text: 'Happy birthday, {name}! Hope you have a great day. - {sender}',
  },
  {
    id: 'heartfelt',
    label: 'Heartfelt',
    text: 'Happy birthday, {name}! So glad to have you in my life. Wishing you your best year yet. - {sender}',
  },
  {
    id: 'funny',
    label: 'Funny',
    text: 'Happy birthday, {name}! Another year wiser... allegedly. Have a great one! - {sender}',
  },
  {
    id: 'short',
    label: 'Short & sweet',
    text: 'Happy birthday, {name}! - {sender}',
  },
  {
    id: 'formal',
    label: 'Warm & formal',
    text: 'Dear {name}, wishing you a wonderful birthday and a great year ahead. - {sender}',
  },
];

/** First word of the name, for `{name}` substitution — matches the server's. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

/** Fill `{name}` / `{sender}` placeholders into a preset's text. */
export function fillTemplate(text: string, opts: { name: string; sender?: string }): string {
  return text
    .replaceAll('{name}', firstName(opts.name))
    .replaceAll('{sender}', opts.sender?.trim() || 'me');
}

export function templatesFor(channel: GreetingChannel): GreetingTemplate[] {
  return channel === 'email' ? EMAIL_TEMPLATES : SMS_TEMPLATES;
}

/**
 * Which preset a saved message came from, by exact match against each filled
 * preset. `null` means the user wrote (or edited into) their own text.
 */
export function matchTemplateId(
  message: string,
  channel: GreetingChannel,
  opts: { name: string; sender?: string },
): GreetingTemplateId | null {
  const trimmed = message.trim();
  for (const t of templatesFor(channel)) {
    if (fillTemplate(t.text, opts) === trimmed) return t.id;
  }
  return null;
}

/** The filled `classic` preset — mirrors the server default used at send time. */
export function defaultGreeting(
  channel: GreetingChannel,
  opts: { name: string; sender?: string },
): string {
  return fillTemplate(templatesFor(channel)[0].text, opts);
}
